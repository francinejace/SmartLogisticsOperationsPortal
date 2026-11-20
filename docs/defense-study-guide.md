# TranceLogix — Evidence Notes for the 16 Defense Questions

Prepared 20 November 2026 from the [as-built report](final-project-report.md), current source, supplied term artifacts and new validation evidence. These are factual study notes for team review. They do not establish personal contributions or replace each member's own explanation and judgment. See Part F of the report for the AI-use disclosure and the supplied assessment's separate rules for the live defense.

## 1. Name the systems your project integrates and state the business process that spans them. Why was integration the right answer rather than duplication or replacement?

The delivered portal integrates its Node API and persistent database with OpenAI for assistance and Open-Meteo for city lookup; Leaflet displays OpenStreetMap tiles. The operational process is order capture, stock checking, warehouse preparation, shipment creation, synchronization recovery and tracking. The OMS/WMS/carrier portions of that process are currently local simulations, not live independent logistics systems.

External geographic and AI services provide specialist capabilities without maintaining an equivalent dataset, tile infrastructure or language model. The original proposal's reason for integrating logistics systems was to preserve their responsibilities and avoid duplicate operational records. That larger business integration remains incomplete. Live utility-adapter HTTP 200 results are in [live-services.json](../evidence/live-services.json); simulated logistics boundaries are explicit in [backend.ts](../server/backend.ts).

## 2. Which middleware, API, or enterprise service technology carries your integration, and why was it selected over the alternatives you considered?

A lightweight Node HTTP backend carries same-origin JSON requests, validates and authorizes them, orchestrates the workflow, and invokes external HTTPS APIs. Netlify uses a function adapter around that backend. `Storage` adapts SQLite and PostgreSQL behind a common interface.

Technical 2 compared SOA/ESB, SOAP/WSDL/UDDI and REST-based services. The current REST-style JSON approach fits the existing browser/client contracts and small integration scope. A full ESB or SOAP stack would introduce additional configuration and operations without an identified required legacy protocol. REST does not make this a microservices system; deployment is one backend. No measured cost comparison supports claiming it is categorically cheaper than every alternative. Source: Technical 2 pp. 10–16; report Parts A, B and D.

## 3. Walk through one integration point in full: protocol, data format, authentication, synchronicity, error handling, retry policy, and versioning strategy.

For city lookup, a signed-in browser calls `GET /api/v1/locations?city=...` over same-origin HTTP locally or HTTPS when hosted. The backend enforces the session and 30 requests per user per minute, validates a 2–120-character city query, then calls Open-Meteo's fixed HTTPS `/v1/search` endpoint. The provider is public and requires no key in this implementation. JSON candidates are filtered for populated places, safe IDs and valid coordinates; at most five are returned.

The consumer waits for the response. There is a seven-second deadline: timeout becomes 504, upstream HTTP 500 becomes 502, and invalid JSON or a wrong-shaped container becomes sanitized 502. There is no automatic retry; the user explicitly requests again. Successful and empty results have bounded process-local caching, but failures do not. Both paths use `v1`; runtime validation exists, while a formal frozen schema and compatibility pipeline are still missing. Source: report IP09, [locations.ts](../server/locations.ts), [provider documentation](https://open-meteo.com/en/docs/geocoding-api).

## 4. What happens to your system when an external dependency times out? Describe the measured behavior, not the intended behavior.

In the injected OpenAI timeout, the API returned `504 assistant_timeout` after **30,029.48 ms**. A workspace read while that request was pending returned 200 in **8.24 ms**. The next explicit request after restoring the healthy fixture succeeded in **16.43 ms**, without restarting the backend.

The geocoding timeout returned `504 location_timeout` after **7,009.47 ms**; its pending-request workspace read took **4.99 ms**, and the next healthy lookup took **2.09 ms**. Orders and shipments were unchanged. These are application-containment measurements with fixtures, not real provider outage durations. Separately, the carrier form's “timeout” is an immediate simulation state and must not be described as a measured carrier network timeout. Source: [integration-validation.json](../evidence/integration-validation.json).

## 5. What happens when an external dependency returns malformed data? What did your failure-injection testing actually show?

Invalid JSON and wrong-shaped JSON containers were injected separately into both external adapters. OpenAI returned sanitized `502 connection_error` in **8.13 ms** and **9.54 ms**; geocoding returned `502 location_connection_error` in **3.09 ms** and **2.39 ms**. All corresponding workspace reads succeeded, no order/shipment mutation occurred, and the next request succeeded after the fixture was restored.

The geocoder also filters invalid individual candidates. A valid response container with no acceptable candidates may produce an empty result rather than an error; the tests do not imply every invalid field causes a 502. No background retry occurs. Source: reliability table and [locations.ts](../server/locations.ts).

## 6. At what load does your system degrade, and how? State the environment your measurement was taken in and why that environment supports the conclusion.

Using the experiment's P95 >500 ms or >1% failures rule, degradation first appeared at **50 concurrent workspace-reading clients**: P95 **1,809.62 ms**, **32/655 failures (4.89%)**, all client deadlines. At 200 clients, failures reached 36.36%: 405 deadlines and 44 connection resets. Completed HTTP responses were 200; no application 5xx or server crash was demonstrated.

The run used Node 24.21.0, an Intel i5-5350U laptop, four logical CPUs, 8 GiB RAM, separate generator/server processes, loopback HTTP and a nine-order/four-shipment SQLite fixture. Five-second stages and a two-second client deadline make the observation reproducible on that local workload. This environment supports a local read-latency/saturation finding; it cannot establish a Netlify/Neon capacity limit, a count of human users, or the original order-validation POST target. Source: report Part C and raw load evidence.

## 7. Assess the security of your least protected integration point: authentication, authorization, transport protection, input validation, and logging. What residual risk did you accept, and on what basis?

The public OpenStreetMap tile boundary has no authentication or per-user authorization because it serves anonymous map images. It uses HTTPS on a fixed URL template. Tile coordinates come from validated city results, and labels use text rather than injected HTML. Application credentials are not sent to that host. Requests are not recorded in the app's audit history.

The design tradeoff is simple public map access for a small demonstration. The provider still sees browser IP, referrer origin and requested tile coordinates, and there is no application-controlled service guarantee. Attribution, normal caching and no bulk/offline prefetch are implemented. Formal business acceptance of location privacy and production volume remains unrecorded; do not claim it was signed off. Source: [CityMapCanvas.tsx](../src/components/CityMapCanvas.tsx), report IP10, [tile policy](https://operations.osmfoundation.org/policies/tiles/).

## 8. How would you change an interface contract in this system without breaking its consumers? Describe the sequence.

First publish the current request/response schema and identify consumers; include the existing browser and any future OMS. Add consumer/provider contract checks before changing behavior. Prefer additive optional fields while retaining old fields and semantics. For a breaking change, introduce `/api/v2` or a compatibility adapter while keeping v1 available. Deploy compatible providers first, migrate consumers, verify telemetry/contracts, announce deprecation, and retire v1 only after consumers have migrated. Keep rollback compatible with the database and preserve new records.

That is the required next process, not a completed capability. The current order response changed from Technical 2's `{status,orderId}` to `{order}` under the same v1 path; inventory and shipment DTOs also changed. No formal deprecation pipeline presently prevents recurrence. Source: divergence D05–D08/D16 and risk IR-08.

## 9. Which current direction in systems integration did you deliberately reject, and what engineering reason justified the rejection?

For the current delivery, retaining one backend rather than independently deployed microservices keeps session handling and order/preparation/shipment updates inside a manageable transaction boundary. The evidence does not establish separate service ownership or scaling demands that justify distributed authentication, deployments, consistency and monitoring. This is an engineering assessment of the present system, not a claim that microservices are always unsuitable.

Containerization and event-driven exchange are also absent. The deployment target is a managed Netlify function rather than a container host, and the current workflow has no durable queue, outbox or webhook consumer. These can be reconsidered when a real carrier integration needs asynchronous callbacks or durable reconciliation. Source: Technical 2 pp. 10–16 and report Part D.

## 10. Name the two real-world integration projects you investigated and state the specific change each one produced in your design.

The delivery review investigated **Amazon EC2's API/SDK idempotent retry contract** and the **Amazon S3/dependent-service integration affected on 28 February 2017**. EC2 illustrates safe resource-creation retry through client tokens. S3 illustrates how dependency failures can affect both service operation and recovery visibility. [AWS EC2 case](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/), [AWS S3 report](https://aws.amazon.com/message/41926/)

The traceable changes in this delivery are new executable acceptance gates: EC2's lesson maps to unknown-outcome blocking, same-shipment replay and OMS-only recovery; S3's lesson maps to workspace availability during optional-provider timeouts and unchanged logistics data during malformed/error responses. Both are asserted by the added validation harness and recorded in the release plan. The mechanisms predated this research; do not claim the cases caused earlier implementation decisions or added a real carrier adapter. Source: report G1–G4 and [validation script](../scripts/integration-validation.mjs).

## 11. Which risk from your RMMM register materialized? Compare what happened against what you predicted, and assess the quality of your original scoring.

**SEC-02, Exposure of API Credentials**, materialized when a key was pasted into the project conversation. The risk predicted exposure and prescribed private storage and rotation. A replacement is now private and its fixed diagnostic passed, but revocation and usage review of the old credential are not evidenced, so closure would be premature.

**TR-01** also materialized through HTML/API routing and missing-database configuration incidents that blocked login. Those events support the predicted broad workflow impact, while identifying more specific causes than the original description. Original numeric likelihood/impact scoring cannot be assessed: Module 7 p. 33 says those scores were not assigned. Its summary count also disagrees with its rows; a numeric “before versus after” comparison would be invented. Source: report Part F and [risk register](risk-closure.csv).

## 12. Which risk remains open at delivery, and what would a maintenance team need to know about it?

**IR-03, Middleware-to-Carrier Communication Failure**, remains open because no real carrier adapter or sandbox authentication is delivered. Carrier names, tracking and fees in the demonstration do not represent real bookings. A maintenance team needs the provider contract, credential owner, supported idempotency key and status-query semantics, deadlines, rate limits and acceptance evidence.

An unknown result must remain blocked until reconciled: a provider may have accepted the shipment before a connection failed. Preserve the order, idempotency reference and shipment data; do not blindly replay creation or delete the database as a recovery step. Also track SEC-02's old-key revocation and the independent OMS/WMS gaps. Source: IP04, IR-03, EDR-01 and the updated release gates.

## 13. Where did your delivered system diverge most from the integration specification in Technical 2, and what caused the divergence?

The largest divergence is the proposed independent OMS/WMS/carrier exchange becoming a single portal with local logistics simulations. Current real external exchanges provide AI and geographic capabilities, not the original independent logistics transaction. Authentication and request/response contracts changed with the browser-oriented persistent Node app; the Python Technical 3 component was not carried into the current runtime.

The source demonstrates those changes. A contemporaneous decision record explaining every scope reduction was not supplied, so limited time, budget or provider refusal must not be asserted as historical causes. The group should supply its actual decision history or formally acknowledge the remaining requirement gaps. Source: S7 pp. 5–9, S8, divergence register D02/D04–D11.

## 14. Describe your AI use across this project: where it was used, for what, and what you changed afterwards. Identify one instance where the AI output was wrong and you corrected it.

The supplied artifacts record AI assistance with architecture comparisons, the reusable validator, risk candidates and release-checklist review. The development conversation records AI-assisted UI/backend work and deployment troubleshooting; this delivery adds evidence scripts, source reconciliation, case research, documentation and study notes. Exact historical model versions and member review/sign-off are not established for every entry.

A directly supported incorrect output is calling the fixed validator a complete Strategy implementation. Technical 3 p. 18 acknowledges that it does not fully implement Strategy because interchangeable strategies are not present. Another correction in the current work replaced a crashing fetch-based load generator with Node HTTP and separated client socket failures from application HTTP errors. Members should describe their own verified review/corrections rather than adopt an invented personal contribution. Source: report AI-use log; no secret values belong in that log.

## 15. What is the single weakest part of your system as delivered, and what evidence tells you it is the weakest?

The weakest part relative to the proposal is **real logistics-provider integration**. Warehouse availability is computed from local example stock, carrier results are generated locally, and OMS synchronization updates local records. Tracking has no live carrier feed. Source code and explicit `simulation:true` responses establish this; local success/failure tests cannot prove external provider behavior.

This matters more to proposal completion than visual polish or the number of passing local tests. Real provider onboarding and end-to-end contract/failure/reconciliation evidence are the first operational release gate. The missing Technical 3 shared component is another explicit deliverable gap. Source: report Parts A/B, IP03/IP04 and risk BR-02.

## 16. If this system were handed to another team to maintain for two years, what would cost them the most, and what would you fix now to reduce it?

The largest likely cost is sustaining correct external logistics contracts and reconciliation while maintaining a large orchestration module, dual database behavior and unversioned schema evolution. Current simulations hide provider-specific authentication, rate limits, ambiguous outcomes and callbacks. Existing source and missing live evidence support that assessment; it is a maintenance forecast, not a measured two-year cost estimate.

Reduce the burden by publishing current API contracts, extracting tested provider interfaces, restoring a shared validator, adding migration/backup/rollback discipline, and improving structured failure/authentication auditing and monitoring. Keep idempotency/state-transition tests as release gates, verify hosted TLS and database access, rotate exposed credentials, and require a clean-clone rehearsal by another teammate. Split services only when ownership or measured scaling justifies the operations cost. Source: report maintenance handover and open-risk register.
