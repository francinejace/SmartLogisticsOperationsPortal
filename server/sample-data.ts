import type Storage from "./storage.ts"
import type { SampleDataResult } from "../src/api-types.ts"

const datasetKey = "sample-data-logistics-v1"
type Stage = "new" | "picking" | "picked" | "ready" | "shortage" | "wms-unavailable" | "awaiting-carrier" | "unknown" | "label" | "transit" | "delivered" | "exception" | "sync-pending"

// Fictional customers, real city names, and clearly namespaced example IDs.
const examples: [number, string, string, Stage, number, number][] = [
  [2001, "Luntian Retail Hub", "Manila", "new", 0.5, 1.2],
  [2002, "Haraya Home Essentials", "Quezon City", "new", 1, 2.4],
  [2003, "Silangan Office Depot", "Tarlac City", "picking", 2, 3.1],
  [2004, "Bayani Hardware Supply", "Makati", "picked", 3, 4.2],
  [2005, "Amihan School Supplies", "Pasig", "ready", 4, 2.8],
  [2006, "Pinecrest Craft Depot", "Baguio", "shortage", 5, 1.6],
  [
    2007,
    "Sampaguita Packaging",
    "San Fernando, Pampanga",
    "wms-unavailable",
    6,
    3.5,
  ],
  [
    2008,
    "Kapampangan Trade Center",
    "Angeles City",
    "awaiting-carrier",
    10,
    5.1,
  ],
  [2009, "Bayside General Merchandise", "Batangas City", "unknown", 12, 2.2],
  [2010, "Malaya Kitchen Supplies", "Lipa City", "label", 18, 3.4],
  [2011, "Isla Market Collective", "Cebu City", "transit", 36, 4.8],
  [2012, "Kadayawan Business Supplies", "Davao City", "transit", 48, 6.2],
  [2013, "Hablon Home Store", "Iloilo City", "delivered", 96, 2.6],
  [2014, "Hiraya Paper Goods", "Bacolod", "delivered", 144, 1.8],
  [2015, "Higala Retail Depot", "Cagayan de Oro", "exception", 72, 3.7],
  [2016, "Leyte Office Collective", "Tacloban", "sync-pending", 20, 2.9],
  [2017, "Metro Green Supplies", "Taguig", "ready", 7, 1.9],
  [2018, "Mayon Community Store", "Legazpi", "new", 9, 2.1],
  [2019, "Palawan Island Goods", "Puerto Princesa", "label", 22, 4.3],
  [2020, "Sidlak Learning Supplies", "Dumaguete", "delivered", 168, 3.2],
]

const stages: Partial<Record<Stage, string>> = {
  label: "Label created",
  transit: "In transit",
  delivered: "Delivered",
  exception: "Delivery exception",
  "sync-pending": "Label created",
}
const carriers = ["LBC Express", "J&T Express", "2GO Express"]

export default async function addSampleData(
  db: Storage,
  now = Date.now(),
): Promise<SampleDataResult> {
  return db.transaction(async () => {
    const result: SampleDataResult = {
      alreadyLoaded: false,
      ordersAdded: 0,
      shipmentsAdded: 0,
      activityAdded: 0,
      skipped: 0,
    }
    if (
      await db
        .prepare("SELECT value FROM metadata WHERE key = ?")
        .get(datasetKey)
    )
      return { ...result, alreadyLoaded: true }

    const products = new Map(
      (await db.prepare("SELECT sku, name FROM inventory").all()).map((row) => [
        String(row.sku),
        String(row.name),
      ]),
    )
    if (
      ["BOX-001", "TAPE-004", "LABEL-002", "WRAP-010", "POUCH-006"].some(
        (sku) => !products.has(sku),
      )
    )
      throw Object.assign(
        new Error(
          "The standard warehouse products are required before adding sample data.",
        ),
        {
          status: 409,
          code: "sample_products_missing",
        },
      )

    const events: {
      title: string
      message: string
      reference: string
      tone: string
      date: string
      key: string
    }[] = []
    for (const [
      index,
      [number, customer, destination, stage, hoursAgo, weight],
    ] of examples.entries()) {
      const id = `ORD-DEMO-${number}`
      const shipmentId = `SHP-DEMO-${number}`
      const carrier = carriers[index % carriers.length]
      const tracking = `${
        carrier === "J&T Express" ? "JTX" : "TRK"
      }-DEMO-${number}`
      const shipmentStatus = stages[stage]
      if (
        (await db.prepare("SELECT id FROM orders WHERE id = ?").get(id)) ||
        (shipmentStatus &&
          (await db
            .prepare("SELECT id FROM shipments WHERE id = ? OR tracking = ?")
            .get(shipmentId, tracking)))
      ) {
        result.skipped++
        continue
      }
      const start = now - hoursAgo * 3600000
      const at = (progress: number) =>
        new Date(start + hoursAgo * 3600000 * progress).toISOString()
      const event = (
        title: string,
        message: string,
        reference = id,
        tone = "success",
        progress = 0,
      ) => {
        events.push({
          title,
          message,
          reference,
          tone,
          date: at(progress),
          key: `sample_v1_${id}_${events.length}`,
        })
      }
      const ready = ![
        "new",
        "picking",
        "picked",
        "shortage",
        "wms-unavailable",
      ].includes(stage)
      const inventory =
        stage === "new"
          ? "Not checked"
          : stage === "shortage"
            ? "Unavailable"
            : stage === "wms-unavailable"
              ? "WMS unavailable"
              : "Available"
      const shipment = shipmentStatus
        ? "Created"
        : stage === "unknown"
          ? "Confirmation required"
          : stage === "awaiting-carrier"
            ? "Awaiting carrier"
            : stage === "shortage"
              ? "Blocked"
              : "Not started"
      const selections: [string, number][] = [
        ["BOX-001", 2 + (index % 5)],
        [index % 2 ? "POUCH-006" : "LABEL-002", 4 + (index % 8)],
      ]
      if (stage === "shortage") selections.push(["WRAP-010", 6])
      else if (index % 3 === 0) selections.push(["TAPE-004", 2])
      const items = selections.map(([sku, qty]) => ({
        sku,
        qty,
        name: products.get(sku)!,
      }))
      await db
        .prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          id,
          `CUS-DEMO-${number}`,
          customer,
          destination,
          JSON.stringify(items),
          inventory,
          shipment,
          at(0),
        )
      await db
        .prepare(
          "INSERT INTO preparations (order_id, picked, packed, weight, notes, shortage, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          id,
          Number(ready || stage === "picked"),
          Number(ready),
          ready ? weight : null,
          stage === "shortage"
            ? "Sample shortage: protective bubble wrap needs replenishment."
            : stage === "picked"
              ? "Sample picking completed; packing and parcel weight are still needed."
              : ready
                ? "Sample parcel checked, packed and weighed. Fictional customer order."
                : "Sample order for workflow practice.",
          Number(stage === "shortage"),
          stage === "new" ? null : at(0.2),
        )
      result.ordersAdded++
      event("Order accepted", `Sample order for ${customer} in ${destination}.`)
      if (stage !== "new") {
        event(
          stage === "shortage"
            ? "Inventory unavailable"
            : stage === "wms-unavailable"
              ? "WMS unavailable"
              : "Inventory confirmed",
          stage === "shortage"
            ? "Sample shortage: stock confirmation failed; shipment is blocked."
            : stage === "wms-unavailable"
              ? "Sample WMS failure. Recheck inventory before preparation."
              : "Sample availability confirmed. Stock has not been reserved or deducted.",
          id,
          ["shortage", "wms-unavailable"].includes(stage)
            ? "warning"
            : "success",
          0.1,
        )
      }
      if (ready || stage === "picked")
        event(
          "Preparation saved",
          ready
            ? "Sample picking, packing and parcel weight are complete."
            : "Sample items picked; packing is still required.",
          id,
          "success",
          0.2,
        )
      if (shipmentStatus) {
        const sync = stage === "sync-pending" ? "Pending" : "Synchronized"
        await db
          .prepare(
            "INSERT INTO shipments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            shipmentId,
            id,
            carrier,
            tracking,
            15000 + Math.round(weight * 8000),
            shipmentStatus,
            sync,
            `shipment:${id}`,
            at(0.35),
            at(0.85),
          )
        await db
          .prepare("INSERT INTO carrier_requests VALUES (?, ?, 'confirmed')")
          .run(id, `shipment:${id}`)
        result.shipmentsAdded++
        event(
          "Shipment created",
          `Sample ${carrier} booking; this is not a real carrier shipment.`,
          shipmentId,
          "success",
          0.35,
        )
        if (stage === "sync-pending")
          event(
            "OMS synchronization pending",
            "Sample shipment retained. Retry synchronization only; do not create another shipment.",
            shipmentId,
            "warning",
            0.85,
          )
        else if (stage !== "label")
          event(
            `Shipment ${shipmentStatus.toLowerCase()}`,
            stage === "exception"
              ? "Sample delivery exception: recipient unavailable. Review the shipment details."
              : `Illustrative ${shipmentStatus.toLowerCase()} event for demonstration only.`,
            shipmentId,
            stage === "exception" ? "warning" : "success",
            0.85,
          )
      } else if (["unknown", "awaiting-carrier"].includes(stage)) {
        await db
          .prepare("INSERT INTO carrier_requests VALUES (?, ?, ?)")
          .run(
            id,
            `shipment:${id}`,
            stage === "unknown" ? "unknown" : "not_created",
          )
        event(
          stage === "unknown"
            ? "Carrier outcome unknown"
            : "Carrier unavailable",
          stage === "unknown"
            ? "Sample uncertain outcome. Check carrier status before retrying with the retained reference."
            : "Sample carrier unavailable. Prepared parcel and order remain saved.",
          id,
          "warning",
          0.4,
        )
      }
    }
    for (const event of events.sort((a, b) => a.date.localeCompare(b.date))) {
      await db
        .prepare(
          "INSERT INTO activity (title, message, actor, reference, tone, created_at, correlation_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          event.title,
          event.message,
          "Sample workspace",
          event.reference,
          event.tone,
          event.date,
          event.key,
          JSON.stringify({
            simulation: true,
            sampleData: true,
            dataset: datasetKey,
          }),
        )
    }
    result.activityAdded = events.length
    await db
      .prepare("INSERT INTO metadata VALUES (?, ?)")
      .run(datasetKey, JSON.stringify(result))
    return result
  })
}
