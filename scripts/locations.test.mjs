import { test } from "node:test"
import assert from "node:assert/strict"
import createLocationSearch from "../server/locations.ts"

const city = (id = 1, extra = {}) => ({
  id,
  name: "Tarlac City",
  latitude: 15.488,
  longitude: 120.598,
  feature_code: "PPLA2",
  country_code: "PH",
  country: "Philippines",
  admin1: "Central Luzon",
  ...extra,
})

test("city lookup validates provider coordinates, prioritizes PH and coalesces cached requests", async () => {
  let calls = 0
  const search = createLocationSearch({
    fetchImpl: async (url, init) => {
      calls++
      assert.equal(url.origin, "https://geocoding-api.open-meteo.com")
      assert.equal(url.searchParams.get("name"), "Tarlac")
      assert.equal(init.headers.Accept, "application/json")
      await new Promise((resolve) => setTimeout(resolve, 5))
      return Response.json({
        results: [
          city(2, {
            name: "Tarlac",
            country_code: "US",
            country: "United States",
          }),
          city(1),
          city(3, { latitude: 100 }),
          city(4, { longitude: 190 }),
          city(5, { feature_code: "ADM1" }),
          city(1),
        ],
      })
    },
  })
  const results = await Promise.all([search(" Tarlac "), search("tarlac")])
  assert.equal(calls, 1)
  assert.equal(results[0].locations.length, 2)
  assert.equal(results[0].locations[0].countryCode, "PH")
  assert.deepEqual(
    Object.keys(results[0].locations[0]).sort(),
    [
      "country",
      "countryCode",
      "id",
      "latitude",
      "longitude",
      "name",
      "region",
    ].sort(),
  )
  await search("TARLAC")
  assert.equal(calls, 1)
})

test("invalid city queries never reach the provider", async () => {
  let calls = 0
  const search = createLocationSearch({
    fetchImpl: async () => {
      calls++
      return Response.json({})
    },
  })
  for (const query of [
    undefined,
    null,
    "",
    "a",
    "A".repeat(121),
    "Tarlac\nCity",
    "Tarlac\u0000",
  ]) {
    await assert.rejects(
      search(query),
      (error) => error.status === 400 && error.code === "invalid_location",
    )
  }
  assert.equal(calls, 0)
})

test("no-match results never fabricate a location and expire sooner than successful lookups", async () => {
  let time = 0,
    calls = 0
  const search = createLocationSearch({
    now: () => time,
    fetchImpl: async () => {
      calls++
      return Response.json({})
    },
  })
  assert.deepEqual((await search("Unknown city")).locations, [])
  await search("Unknown city")
  assert.equal(calls, 1)
  time = 600001
  await search("Unknown city")
  assert.equal(calls, 2)
})

test("successful coordinates expire and the cache stays bounded", async () => {
  let time = 0,
    calls = 0
  const search = createLocationSearch({
    now: () => time,
    fetchImpl: async () => {
      calls++
      return Response.json({ results: [city()] })
    },
  })
  await search("Tarlac")
  time = 86400001
  await search("Tarlac")
  assert.equal(calls, 2)
  for (let index = 0; index < 257; index++) await search("City " + index)
  const previous = calls
  await search("Tarlac")
  assert.equal(calls, previous + 1)
})

test("provider errors and malformed data are sanitized and can be retried", async () => {
  let calls = 0
  const search = createLocationSearch({
    fetchImpl: async () => {
      calls++
      if (calls === 1)
        return Response.json({ error: "private upstream text" }, {
          status: 429,
        })
      if (calls === 2)
        return Response.json({ results: "private malformed data" })
      return Response.json({ results: [city()] })
    },
  })
  await assert.rejects(
    search("Tarlac"),
    (error) => error.status === 503 && !error.message.includes("private"),
  )
  await assert.rejects(
    search("Tarlac"),
    (error) => error.status === 502 && !error.message.includes("private"),
  )
  assert.equal((await search("Tarlac")).locations.length, 1)
})

test("a slow provider times out with an actionable error", async () => {
  const search = createLocationSearch({
    timeoutMs: 15,
    fetchImpl: async (_url, { signal }) =>
      new Promise((_, reject) => {
        const keepAlive = setTimeout(
          () => reject(new Error("Unexpected delay")),
          1000,
        )
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(keepAlive)
            reject(signal.reason)
          },
          { once: true },
        )
      }),
  })
  await assert.rejects(
    search("Tarlac"),
    (error) => error.status === 504 && error.code === "location_timeout",
  )
})
