import { useEffect, useMemo, useRef, useState } from "react"

type Page = "dashboard" | "orders" | "create-order" | "order-detail" | "warehouse" | "preparation" | "create-shipment" | "shipments" | "shipment-detail" | "tracking" | "integration" | "activity" | "settings" | "help" | "access-denied"
type Role = "Operations staff" | "Warehouse staff" | "Administrator"

interface IconProps {
  name: string
  size?: number
}
interface EmptyStateProps {
  title: string
  text: string
}
interface RolePageProps {
  go: (p: Page) => void
  role: Role
}

const orders = [
  {
    id: "ORD-1001",
    customer: "Luzon Home Supplies",
    customerId: "CUS-001",
    destination: "Tarlac",
    items: [{ sku: "BOX-001", name: "Heavy-duty storage box", qty: 2 }],
    order: "Accepted",
    inventory: "Available",
    shipment: "Created",
    date: "18 Jun 2025, 09:42",
    tone: "success",
  },
  {
    id: "ORD-1002",
    customer: "Metro Retail Co.",
    customerId: "CUS-014",
    destination: "Makati",
    items: [{ sku: "TAPE-004", name: "Packaging tape", qty: 12 }],
    order: "Accepted",
    inventory: "Not checked",
    shipment: "Not started",
    date: "18 Jun 2025, 10:15",
    tone: "neutral",
  },
  {
    id: "ORD-1003",
    customer: "Northstar Merchandising",
    customerId: "CUS-008",
    destination: "Baguio",
    items: [{ sku: "WRAP-010", name: "Protective bubble wrap", qty: 20 }],
    order: "Accepted",
    inventory: "Unavailable",
    shipment: "Blocked",
    date: "18 Jun 2025, 08:51",
    tone: "danger",
  },
  {
    id: "ORD-1004",
    customer: "Cebu Trade Depot",
    customerId: "CUS-020",
    destination: "Cebu City",
    items: [{ sku: "BOX-001", name: "Heavy-duty storage box", qty: 5 }],
    order: "Accepted",
    inventory: "WMS unavailable",
    shipment: "Not started",
    date: "17 Jun 2025, 16:34",
    tone: "warning",
  },
  {
    id: "ORD-1005",
    customer: "Southern Office Hub",
    customerId: "CUS-031",
    destination: "Davao City",
    items: [{ sku: "LABEL-002", name: "Thermal shipping labels", qty: 8 }],
    order: "Accepted",
    inventory: "Available",
    shipment: "Awaiting carrier",
    date: "17 Jun 2025, 15:22",
    tone: "warning",
  },
  {
    id: "ORD-1006",
    customer: "Palawan General Store",
    customerId: "CUS-026",
    destination: "Puerto Princesa",
    items: [{ sku: "POUCH-006", name: "Waterproof mailer pouch", qty: 6 }],
    order: "Accepted",
    inventory: "Available",
    shipment: "Confirmation required",
    date: "17 Jun 2025, 13:05",
    tone: "warning",
  },
]

const shipments = [
  {
    id: "SHP-5012",
    orderId: "ORD-1001",
    carrier: "LBC Express",
    tracking: "TRK-123456",
    destination: "Tarlac",
    fee: "₱350.00",
    status: "In transit",
    sync: "Synchronized",
    updated: "18 Jun, 11:26",
  },
  {
    id: "SHP-5011",
    orderId: "ORD-0998",
    carrier: "J&T Express",
    tracking: "JTX-8094421",
    destination: "Quezon City",
    fee: "₱285.00",
    status: "Delivered",
    sync: "Synchronized",
    updated: "18 Jun, 08:12",
  },
  {
    id: "SHP-5009",
    orderId: "ORD-0995",
    carrier: "LBC Express",
    tracking: "TRK-119028",
    destination: "Batangas",
    fee: "₱410.00",
    status: "Label created",
    sync: "Pending",
    updated: "17 Jun, 17:46",
  },
  {
    id: "SHP-5007",
    orderId: "ORD-0992",
    carrier: "2GO Express",
    tracking: "2GO-771203",
    destination: "Iloilo City",
    fee: "₱520.00",
    status: "Delivery exception",
    sync: "Synchronized",
    updated: "17 Jun, 14:30",
  },
]

const nav = [
  ["dashboard", "Dashboard", "grid"],
  ["orders", "Orders", "clipboard"],
  ["warehouse", "Warehouse", "box"],
  ["shipments", "Shipments", "truck"],
  ["tracking", "Tracking", "location"],
  ["integration", "Integration monitor", "pulse"],
  ["activity", "Activity log", "clock"],
  ["settings", "Settings", "settings"],
] as const

// These layers manage presentation only; the role selector is not authentication.
function useFocusLayer(open: boolean, close: () => void, modal = false) {
  const ref = useRef<HTMLElement | null>(null)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    if (modal) document.body.style.overflow = "hidden"
    const getControls = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]',
        ) || [],
      ).filter((el) => el.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => getControls()[0]?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== "Tab") return
      const controls = getControls()
      const first = controls[0],
        last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const onOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement
      if (
        !modal &&
        !ref.current?.contains(target) &&
        !target.closest("[data-layer-trigger]")
      )
        closeRef.current()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onOutside)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onOutside)
      if (modal) document.body.style.overflow = previousOverflow
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus({ preventScroll: true })
      else
        document
          .querySelector<HTMLButtonElement>(".menu-button")
          ?.focus({ preventScroll: true })
    }
  }, [open, modal])
  return ref
}

function Icon({ name, size = 20 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  }
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    clipboard: (
      <>
        <path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="M8 12h8M8 16h5" />
      </>
    ),
    box: (
      <>
        <path d="m4 7 8-4 8 4-8 4-8-4Z" />
        <path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z" />
        <path d="M12 11v10" />
      </>
    ),
    truck: (
      <>
        <path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    pulse: (
      <>
        <path d="M3 12h4l2-5 4 10 2-5h6" />
        <circle cx="12" cy="12" r="10" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    down: <path d="m6 9 6 6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: (
      <>
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5M6.1 8a7 7 0 0 1 11.8-2L20 8M4 16l2.1 2a7 7 0 0 0 11.8-2" />
      </>
    ),
    filter: <path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" />,
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.9.4-.9 1.2-.9 1.7M12 17h.01" />
      </>
    ),
  }
  return <svg {...common}>{paths[name] || paths.info}</svg>
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: string
}) {
  const icon =
    tone === "success"
      ? "check"
      : tone === "danger" || tone === "warning"
        ? "alert"
        : "info"
  return (
    <span className={`badge ${tone}`}>
      <Icon name={icon} size={13} />
      {children}
    </span>
  )
}

function Button({
  children,
  kind = "primary",
  icon,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode
  kind?: string
  icon?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`button ${kind}`}
      onClick={onClick}
      disabled={disabled || !onClick}
      title={
        !onClick
          ? "Preview control — not connected in this prototype"
          : undefined
      }
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  )
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  return <section className={`card ${className}`}>{children}</section>
}

function PageHead({
  title,
  description,
  children,
  back,
}: {
  title: string
  description: string
  children?: React.ReactNode
  back?: () => void
}) {
  return (
    <div className="page-head">
      <div>
        {back && (
          <button className="back-link" onClick={back}>
            ← Back to previous
          </button>
        )}
        <span className="page-eyebrow">TRANSLOGIX / OPERATIONS WORKSPACE</span>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

function StatCard({
  label,
  value,
  note,
  tone,
  onClick,
}: {
  label: string
  value: number
  note: string
  tone?: string
  onClick: () => void
}) {
  return (
    <button className="stat-card" onClick={onClick}>
      <span className={`stat-icon ${tone || ""}`}>
        <Icon
          name={
            tone === "danger"
              ? "alert"
              : tone === "warning"
                ? "clock"
                : "clipboard"
          }
        />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{note}</em>
      </span>
      <Icon name="arrow" size={18} />
    </button>
  )
}

function SamplePagination({
  count,
  label = "records",
}: {
  count: number
  label?: string
}) {
  return (
    <div className="pagination">
      <span>
        {count ? `Showing 1–${count}` : "0 results"} · {count} sample {label}
      </span>
      <div aria-label="Pagination">
        <button disabled>Previous</button>
        <button className="active" aria-current="page">
          1
        </button>
        <button disabled>Next</button>
      </div>
    </div>
  )
}

function EmptyState({ title, text }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span>
        <Icon name="box" size={24} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}

function Dashboard({ go }: { go: (p: Page) => void }) {
  return (
    <>
      <PageHead
        title="Operations overview"
        description="Your orders, shipments, and exceptions. One connected workspace."
      >
        <div className="updated">Snapshot · 18 Jun 2025, 11:30 PHT</div>
        <Button icon="plus" onClick={() => go("create-order")}>
          Create order
        </Button>
      </PageHead>
      <div className="demo-strip">
        <Icon name="info" size={17} />
        <strong>Demonstration data</strong>
        <span>
          Weekly summary: 12–18 June 2025 · Sample records below are a subset ·
          Asia/Manila
        </span>
      </div>
      <div className="stats-grid">
        <StatCard
          label="Awaiting processing"
          value={6}
          note="Weekly operations summary"
          onClick={() => go("orders")}
        />
        <StatCard
          label="Awaiting inventory"
          value={4}
          note="Across the weekly summary"
          tone="warning"
          onClick={() => go("orders")}
        />
        <StatCard
          label="Awaiting carrier"
          value={3}
          note="1 confirmation required"
          tone="warning"
          onClick={() => go("shipments")}
        />
        <StatCard
          label="Integration exceptions"
          value={5}
          note="2 require action"
          tone="danger"
          onClick={() => go("integration")}
        />
      </div>
      <div className="dashboard-grid">
        <Card className="recent-orders">
          <div className="card-head">
            <div>
              <h2>Recent orders</h2>
              <p>
                Four latest sample orders · Select a row to open the sample
                detail
              </p>
            </div>
            <button className="text-button" onClick={() => go("orders")}>
              View all <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Inventory</th>
                  <th>Shipment</th>
                  <th>
                    <span className="sr-only">Open details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 4).map((o) => (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.currentTarget.click()
                      }
                    }}
                    onClick={() => go("order-detail")}
                  >
                    <td>
                      <strong>{o.id}</strong>
                      <small>{o.date}</small>
                    </td>
                    <td className="customer-cell">
                      {o.customer}
                      <small>{o.destination}</small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          o.inventory === "Available"
                            ? "success"
                            : o.inventory === "Unavailable"
                              ? "danger"
                              : o.inventory.includes("WMS")
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {o.inventory}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          o.shipment === "Created"
                            ? "success"
                            : o.shipment === "Blocked"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {o.shipment}
                      </Badge>
                    </td>
                    <td>
                      <Icon name="arrow" size={16} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="attention-card">
          <div className="card-head">
            <div>
              <h2>Needs attention</h2>
              <p>Resolve these exceptions first</p>
            </div>
            <Badge tone="danger">5 total</Badge>
          </div>
          <div className="attention-list">
            <button onClick={() => go("integration")}>
              <span className="attention-icon danger">
                <Icon name="alert" />
              </span>
              <span>
                <strong>Carrier outcome unknown</strong>
                <small>ORD-1006 · Check before retrying</small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
            <button onClick={() => go("preparation")}>
              <span className="attention-icon warning">
                <Icon name="box" />
              </span>
              <span>
                <strong>Inventory shortage</strong>
                <small>ORD-1003 · Review shortage</small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
            <button onClick={() => go("shipment-detail")}>
              <span className="attention-icon warning">
                <Icon name="refresh" />
              </span>
              <span>
                <strong>OMS sync pending</strong>
                <small>SHP-5009 · Retry synchronization</small>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </Card>
        <Card>
          <div className="card-head">
            <div>
              <h2>Shipment status</h2>
              <p>12–18 June</p>
            </div>
          </div>
          <div className="donut-row">
            <div className="donut">
              <span>
                <strong>42</strong>
                <small>Total</small>
              </span>
            </div>
            <div className="legend">
              <span>
                <i className="l1" />
                Delivered <b>18</b>
              </span>
              <span>
                <i className="l2" />
                In transit <b>14</b>
              </span>
              <span>
                <i className="l3" />
                Label created <b>7</b>
              </span>
              <span>
                <i className="l4" />
                Exception <b>3</b>
              </span>
            </div>
          </div>
        </Card>
        <Card className="connection-panel">
          <div className="card-head">
            <div>
              <h2>Connection status</h2>
              <p>Current integration health · demonstration data</p>
            </div>
            <button className="text-button" onClick={() => go("integration")}>
              Open monitor <Icon name="arrow" size={16} />
            </button>
          </div>
          <div className="connections">
            {[
              ["OMS", "Connected", "11:29", "182 ms"],
              ["WMS", "Degraded", "11:27", "1.8 s"],
              ["Carrier API", "Connected", "11:28", "340 ms"],
            ].map((c, i) => (
              <div key={c[0]}>
                <span className={`system-logo s${i}`}>{c[0][0]}</span>
                <span>
                  <strong>{c[0]}</strong>
                  <small>Last success {c[2]}</small>
                </span>
                <span className="connection-meta">
                  <Badge tone={i === 1 ? "warning" : "success"}>{c[1]}</Badge>
                  <small>{c[3]}</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="card-head">
            <div>
              <h2>Recent activity</h2>
              <p>Latest operational events</p>
            </div>
          </div>
          <div className="mini-timeline">
            <div>
              <i />
              <span>
                <strong>Shipment confirmed</strong>
                <small>SHP-5012 · LBC Express · 11:26</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <strong>Inventory verified</strong>
                <small>ORD-1001 · WMS service · 11:18</small>
              </span>
            </div>
            <div>
              <i className="warn" />
              <span>
                <strong>WMS check failed</strong>
                <small>ORD-1004 · Retry 2 of 2 · 10:54</small>
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

function Orders({
  go,
  initialSearch = "",
}: {
  go: (p: Page) => void
  initialSearch?: string
}) {
  const [search, setSearch] = useState(initialSearch)
  const filtered = orders.filter((o) =>
    `${o.id} ${o.customer} ${o.destination}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  return (
    <>
      <PageHead
        title="Orders"
        description="Create and manage customer orders from acceptance through shipment."
      >
        <Button icon="plus" onClick={() => go("create-order")}>
          Create order
        </Button>
      </PageHead>
      <Card>
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search orders"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, customer, or destination"
            />
          </label>
          <Button kind="secondary" icon="filter">
            Filters
          </Button>
          <label className="select-label">
            Sort by{" "}
            <select disabled title="Sorting is a preview control">
              <option>Newest first</option>
              <option>Oldest first</option>
            </select>
          </label>
        </div>
        <div className="list-context">
          <span>
            <i /> {filtered.length} sample orders
          </span>
          <small>
            Search is interactive · Filters and sort are preview controls
          </small>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Destination</th>
                  <th>Items</th>
                  <th>Order status</th>
                  <th>Inventory</th>
                  <th>Shipment</th>
                  <th>Created</th>
                  <th>
                    <span className="sr-only">Open details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.currentTarget.click()
                      }
                    }}
                    onClick={() => go("order-detail")}
                  >
                    <td>
                      <strong>{o.id}</strong>
                    </td>
                    <td>
                      <strong className="cell-main">{o.customer}</strong>
                      <small>{o.customerId}</small>
                    </td>
                    <td>{o.destination}</td>
                    <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                    <td>
                      <Badge tone="success">{o.order}</Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          o.inventory === "Available"
                            ? "success"
                            : o.inventory === "Unavailable"
                              ? "danger"
                              : o.inventory.includes("WMS")
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {o.inventory}
                      </Badge>
                    </td>
                    <td>
                      <Badge
                        tone={
                          o.shipment === "Created"
                            ? "success"
                            : o.shipment === "Blocked"
                              ? "danger"
                              : o.shipment.includes("required")
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {o.shipment}
                      </Badge>
                    </td>
                    <td>
                      {o.date.split(",")[0]}
                      <small>{o.date.split(",")[1]}</small>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${o.id}`}
                      >
                        <Icon name="arrow" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No matching orders"
            text="Try changing or clearing your search and filters."
          />
        )}
        <SamplePagination count={filtered.length} label="orders" />
        <p className="demo-disclosure">
          All detail links open the fixed ORD-1001 example. Submitted demo
          orders are not added to these fixtures.
        </p>
      </Card>
    </>
  )
}

function CreateOrder({ go }: { go: (p: Page) => void }) {
  const [step, setStep] = useState(1)
  const [orderId, setOrderId] = useState("")
  const [customerId, setCustomerId] = useState("CUS-001")
  const [customer, setCustomer] = useState("Luzon Home Supplies")
  const [destination, setDestination] = useState("Tarlac")
  const [sku, setSku] = useState("BOX-001")
  const [qty, setQty] = useState("2")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicate, setDuplicate] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const next = () => {
    const e: Record<string, string> = {}
    if (step === 1) {
      if (!orderId.trim()) e.orderId = "Enter a unique order ID."
      if (!customerId.trim()) e.customerId = "Customer ID is required."
      if (!destination.trim()) e.destination = "Destination is required."
      setDuplicate(orders.some((order) => order.id === orderId.trim()))
    }
    if (step === 2) {
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(sku))
        e.sku = "Use up to 64 letters, numbers, underscores, or hyphens."
      if (!/^[1-9]\d*$/.test(qty))
        e.qty = "Quantity must be a positive whole number."
    }
    setErrors(e)
    const firstError = Object.keys(e)[0]
    if (firstError)
      requestAnimationFrame(() =>
        document.getElementById(`order-${firstError}`)?.focus(),
      )
    if (
      !Object.keys(e).length &&
      !(step === 1 && orders.some((order) => order.id === orderId.trim()))
    )
      setStep((s) => Math.min(3, s + 1))
  }
  if (submitted)
    return (
      <>
        <PageHead
          title="Order reviewed"
          description="Order creation demonstration · No API request has been sent."
        />
        <Card className="success-panel">
          <span className="success-mark">
            <Icon name="check" size={28} />
          </span>
          <h2>{orderId} passed frontend validation</h2>
          <p>
            Your entries are shown below. This prototype does not persist or
            submit orders to OMS.
          </p>
          <div className="review-block">
            <div>
              <small>Customer</small>
              <strong>{customer || customerId}</strong>
              <span>{customerId}</span>
            </div>
            <div>
              <small>Destination</small>
              <strong>{destination}</strong>
            </div>
            <div>
              <small>Order item</small>
              <strong>
                {sku} × {qty}
              </strong>
            </div>
          </div>
          <div className="hint">
            The documented valid order creation response is HTTP 201. Invalid
            input: HTTP 400. Duplicate order: HTTP 409.
          </div>
          <div className="card-actions">
            <Button kind="secondary" onClick={() => setSubmitted(false)}>
              Review entries
            </Button>
            <Button onClick={() => go("orders")}>Return to orders</Button>
            <Button kind="secondary" onClick={() => go("order-detail")}>
              Open sample order
            </Button>
          </div>
        </Card>
      </>
    )
  return (
    <>
      <PageHead
        title="Create order"
        description="Submit a customer order to the integration workflow."
        back={() => go("orders")}
      />
      <div className="stepper">
        {["Customer and destination", "Order items", "Review and submit"].map(
          (x, i) => (
            <div
              className={step > i ? "active" : ""}
              aria-current={step === i + 1 ? "step" : undefined}
              key={x}
            >
              <span>
                {step > i + 1 ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <strong>{x}</strong>
            </div>
          ),
        )}
      </div>
      <div className="form-layout">
        <Card className="form-card">
          {duplicate && (
            <div className="alert danger" id="duplicate-order" role="alert">
              <Icon name="alert" />
              <div>
                <strong>Order ID already exists</strong>
                <p>
                  {orderId} already exists in the sample data (HTTP 409
                  scenario). Your entries are preserved. The detail preview
                  shows ORD-1001.
                </p>
              </div>
              <Button kind="secondary" onClick={() => go("order-detail")}>
                Open sample order
              </Button>
            </div>
          )}
          {step === 1 && (
            <>
              <div className="section-title">
                <span>1</span>
                <div>
                  <h2>Customer and destination</h2>
                  <p>Enter the identifying information for this order.</p>
                </div>
              </div>
              <div className="form-grid">
                <label className={errors.orderId ? "has-error" : ""}>
                  <span>
                    Order ID <b>*</b>
                  </span>
                  <input
                    id="order-orderId"
                    aria-invalid={Boolean(errors.orderId) || duplicate}
                    aria-describedby={
                      errors.orderId
                        ? "error-orderId"
                        : duplicate
                          ? "duplicate-order"
                          : undefined
                    }
                    value={orderId}
                    onChange={(e) => {
                      setOrderId(e.target.value.toUpperCase())
                      setDuplicate(false)
                    }}
                    placeholder="e.g. ORD-1010"
                  />
                  {errors.orderId && (
                    <em id="error-orderId" role="alert">
                      {errors.orderId}
                    </em>
                  )}
                  <small>Must be unique across OMS orders.</small>
                </label>
                <label className={errors.customerId ? "has-error" : ""}>
                  <span>
                    Customer ID <b>*</b>
                  </span>
                  <input
                    id="order-customerId"
                    aria-invalid={Boolean(errors.customerId)}
                    aria-describedby={
                      errors.customerId ? "error-customerId" : undefined
                    }
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  />
                  {errors.customerId && (
                    <em id="error-customerId" role="alert">
                      {errors.customerId}
                    </em>
                  )}
                </label>
                <label>
                  <span>Customer display name</span>
                  <input
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  />
                  <small>Supporting demonstration information</small>
                </label>
                <label className={errors.destination ? "has-error" : ""}>
                  <span>
                    Destination <b>*</b>
                  </span>
                  <select
                    id="order-destination"
                    aria-invalid={Boolean(errors.destination)}
                    aria-describedby={
                      errors.destination ? "error-destination" : undefined
                    }
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    <option value="">Select destination</option>
                    <option>Tarlac</option>
                    <option>Makati</option>
                    <option>Baguio</option>
                    <option>Cebu City</option>
                  </select>
                  {errors.destination && (
                    <em id="error-destination" role="alert">
                      {errors.destination}
                    </em>
                  )}
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="section-title">
                <span>2</span>
                <div>
                  <h2>Order items</h2>
                  <p>Add one or more products and requested quantities.</p>
                </div>
              </div>
              <div className="item-header">
                <strong>Item 1</strong>
                <button
                  className="text-button danger-text"
                  disabled
                  title="At least one item is required; multiple item editing is not implemented"
                >
                  Remove
                </button>
              </div>
              <div className="form-grid">
                <label className={errors.sku ? "has-error wide" : "wide"}>
                  <span>
                    SKU <b>*</b>
                  </span>
                  <div className="input-icon">
                    <Icon name="search" size={17} />
                    <input
                      id="order-sku"
                      aria-invalid={Boolean(errors.sku)}
                      aria-describedby={errors.sku ? "error-sku" : undefined}
                      value={sku}
                      onChange={(e) => setSku(e.target.value.toUpperCase())}
                    />
                  </div>
                  {errors.sku && (
                    <em id="error-sku" role="alert">
                      {errors.sku}
                    </em>
                  )}
                  <small>
                    {sku === "BOX-001" && "Heavy-duty storage box · WMS item"}
                  </small>
                </label>
                <label className={errors.qty ? "has-error" : ""}>
                  <span>
                    Quantity <b>*</b>
                  </span>
                  <input
                    id="order-qty"
                    aria-invalid={Boolean(errors.qty)}
                    aria-describedby={errors.qty ? "error-qty" : undefined}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    inputMode="numeric"
                  />
                  {errors.qty && (
                    <em id="error-qty" role="alert">
                      {errors.qty}
                    </em>
                  )}
                </label>
              </div>
              <Button kind="secondary" icon="plus">
                Add item
              </Button>
              <p className="demo-disclosure">
                This sample editor supports one item. Add and remove item
                controls are previews.
              </p>
              <div className="hint">
                <Icon name="info" size={17} />
                Inventory is checked after order acceptance. Availability does
                not reserve or deduct stock.
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="section-title">
                <span>3</span>
                <div>
                  <h2>Review and submit</h2>
                  <p>Confirm the order before sending it to the middleware.</p>
                </div>
              </div>
              <div className="review-block">
                <div>
                  <small>Order ID</small>
                  <strong>{orderId}</strong>
                </div>
                <div>
                  <small>Customer</small>
                  <strong>{customer}</strong>
                  <span>{customerId}</span>
                </div>
                <div>
                  <small>Destination</small>
                  <strong>{destination}</strong>
                </div>
              </div>
              <h3 className="subheading">Items</h3>
              <div className="review-item">
                <span className="product-icon">
                  <Icon name="box" />
                </span>
                <span>
                  <strong>{sku}</strong>
                  <small>Heavy-duty storage box</small>
                </span>
                <b>Quantity {qty}</b>
              </div>
              <div className="alert info">
                <Icon name="info" />
                <div>
                  <strong>What happens next</strong>
                  <p>
                    The order will be validated and accepted. Inventory and
                    shipment creation are separate steps.
                  </p>
                </div>
              </div>
            </>
          )}
          <div className="form-footer">
            <Button
              kind="secondary"
              onClick={() =>
                step === 1 ? go("orders") : setStep((s) => s - 1)
              }
            >
              {step === 1 ? "Cancel" : "Previous"}
            </Button>
            {step < 3 ? (
              <Button onClick={next}>Continue</Button>
            ) : (
              <Button onClick={() => setSubmitted(true)}>
                Submit demo order
              </Button>
            )}
          </div>
        </Card>
        <aside className="side-note">
          <span className="aside-label">ORDER SUMMARY</span>
          <h3>{orderId || "New customer order"}</h3>
          <dl>
            <div>
              <dt>Customer</dt>
              <dd>{customerId || "—"}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{destination || "—"}</dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>
                {sku || "—"} × {qty || "—"}
              </dd>
            </div>
          </dl>
          <h3>Before you submit</h3>
          <p>Orders are validated by middleware before OMS acceptance.</p>
          <ul>
            <li>Order ID must be unique</li>
            <li>At least one valid item is required</li>
            <li>Quantities must be whole numbers</li>
          </ul>
        </aside>
      </div>
    </>
  )
}

function OrderDetail({ go }: { go: (p: Page) => void }) {
  return (
    <>
      <div className="breadcrumbs">
        <button onClick={() => go("orders")}>Orders</button>
        <Icon name="arrow" size={14} />
        <span>ORD-1001</span>
      </div>
      <PageHead
        title="Order ORD-1001"
        description="Accepted 18 June 2025 at 09:42 PHT · Demonstration data"
        back={() => go("orders")}
      >
        <Button kind="secondary" onClick={() => go("integration")}>
          View events
        </Button>
        <Button onClick={() => go("preparation")}>Open preparation</Button>
      </PageHead>
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Order summary</h2>
                <p>Customer and delivery information from OMS</p>
              </div>
              <Badge tone="success">Accepted</Badge>
            </div>
            <div className="summary-grid">
              <div>
                <small>Customer</small>
                <strong>Luzon Home Supplies</strong>
                <span>CUS-001</span>
              </div>
              <div>
                <small>Destination</small>
                <strong>Tarlac, Central Luzon</strong>
                <span>Philippines</span>
              </div>
              <div>
                <small>Created</small>
                <strong>18 Jun 2025, 09:42</strong>
                <span>Asia/Manila</span>
              </div>
              <div>
                <small>Source system</small>
                <strong>Integration portal</strong>
                <span>Submitted by Maria Santos</span>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Order items</h2>
                <p>1 SKU · 2 total units</p>
              </div>
            </div>
            <div className="items-table">
              <div className="product-icon">
                <Icon name="box" />
              </div>
              <span>
                <strong>BOX-001</strong>
                <small>Heavy-duty storage box</small>
              </span>
              <span>
                <small>Requested quantity</small>
                <strong>2</strong>
              </span>
              <Badge tone="success">Available</Badge>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Inventory check</h2>
                <p>Availability supplied by WMS</p>
              </div>
              <Badge tone="success">Confirmed</Badge>
            </div>
            <div className="result-panel">
              <span>
                <Icon name="check" size={22} />
              </span>
              <div>
                <strong>Inventory is available</strong>
                <p>
                  All requested items were confirmed available by WMS at 18 Jun,
                  10:02 PHT.
                </p>
                <small>
                  Availability does not reserve or deduct inventory.
                </small>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Warehouse preparation</h2>
                <p>Proposed operational progress</p>
              </div>
              <button className="text-button" onClick={() => go("preparation")}>
                Open details <Icon name="arrow" size={16} />
              </button>
            </div>
            <div className="progress-steps">
              <div className="done">
                <i>
                  <Icon name="check" size={14} />
                </i>
                <span>
                  <strong>Picked</strong>
                  <small>10:18</small>
                </span>
              </div>
              <div className="done">
                <i>
                  <Icon name="check" size={14} />
                </i>
                <span>
                  <strong>Packed</strong>
                  <small>10:43</small>
                </span>
              </div>
              <div className="done">
                <i>
                  <Icon name="check" size={14} />
                </i>
                <span>
                  <strong>Weight recorded</strong>
                  <small>2.5 kg</small>
                </span>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Shipment</h2>
                <p>Carrier and tracking information</p>
              </div>
              <Badge tone="success">Created</Badge>
            </div>
            <div className="shipment-summary">
              <div>
                <small>Shipment</small>
                <button onClick={() => go("shipment-detail")}>SHP-5012</button>
              </div>
              <div>
                <small>Carrier</small>
                <strong>LBC Express</strong>
              </div>
              <div>
                <small>Tracking number</small>
                <strong>TRK-123456</strong>
              </div>
              <div>
                <small>Shipping fee</small>
                <strong>₱350.00</strong>
              </div>
            </div>
            <div className="card-actions">
              <Button kind="secondary" onClick={() => go("shipment-detail")}>
                View shipment
              </Button>
              <Button onClick={() => go("tracking")}>Track shipment</Button>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Activity timeline</h2>
                <p>Chronological events for this order</p>
              </div>
            </div>
            <Timeline compact />
          </Card>
        </div>
        <aside className="detail-side">
          <Card>
            <h2>Current status</h2>
            <div className="status-stack">
              <div>
                <span>Order processing</span>
                <Badge tone="success">Accepted</Badge>
              </div>
              <div>
                <span>Inventory verification</span>
                <Badge tone="success">Available</Badge>
              </div>
              <div>
                <span>Shipment creation</span>
                <Badge tone="success">Created</Badge>
              </div>
              <div>
                <span>OMS synchronization</span>
                <Badge tone="success">Synchronized</Badge>
              </div>
            </div>
          </Card>
          <Card className="next-action">
            <span className="action-icon">
              <Icon name="truck" />
            </span>
            <small>Next required action</small>
            <h3>Monitor carrier tracking</h3>
            <p>
              The shipment is in transit. No operational action is required.
            </p>
            <Button kind="secondary" onClick={() => go("tracking")}>
              Open tracking
            </Button>
          </Card>
          <Card>
            <h2>System information</h2>
            <dl>
              <div>
                <dt>OMS reference</dt>
                <dd>ORD-1001</dd>
              </div>
              <div>
                <dt>Correlation ID</dt>
                <dd>cor_8af32d</dd>
              </div>
              <div>
                <dt>Last synchronized</dt>
                <dd>18 Jun, 10:58 PHT</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  )
}

function Warehouse({
  go,
  initialSearch = "",
}: {
  go: (p: Page) => void
  initialSearch?: string
}) {
  const [tab, setTab] = useState("Inventory")
  const [query, setQuery] = useState(initialSearch)
  return (
    <>
      <PageHead
        title="Warehouse"
        description="Review read-only WMS inventory and prepare eligible orders."
      />
      <div className="tabs">
        {["Inventory", "Preparation queue"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
            key={t}
          >
            {t}
            {t === "Preparation queue" && <span>4</span>}
          </button>
        ))}
      </div>
      <Card>
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search warehouse records"
              placeholder={
                tab === "Inventory"
                  ? "Search SKU, product, or location"
                  : "Search order or destination"
              }
            />
          </label>
          <Button kind="secondary" icon="filter">
            Filters
          </Button>
          <div className="read-only">
            <Icon name="info" size={15} />
            WMS data is read-only
          </div>
        </div>
        {tab === "Inventory" ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product name</th>
                  <th>Warehouse location</th>
                  <th>Availability</th>
                  <th>Last synchronized</th>
                  <th>Freshness</th>
                  <th>
                    <span className="sr-only">Open details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "BOX-001",
                    "Heavy-duty storage box",
                    "Tarlac · Zone A-12",
                    "Available",
                    "18 Jun, 11:12",
                    "Current",
                  ],
                  [
                    "TAPE-004",
                    "Packaging tape",
                    "Manila · Zone C-04",
                    "Available",
                    "18 Jun, 11:08",
                    "Current",
                  ],
                  [
                    "WRAP-010",
                    "Protective bubble wrap",
                    "Baguio · Zone B-02",
                    "Unavailable",
                    "18 Jun, 10:51",
                    "Current",
                  ],
                  [
                    "LABEL-002",
                    "Thermal shipping labels",
                    "Davao · Zone D-18",
                    "Available",
                    "18 Jun, 09:02",
                    "Stale",
                  ],
                ]
                  .filter((r) =>
                    r.join(" ").toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((r) => (
                    <tr
                      key={r[0]}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.currentTarget.click()
                        }
                      }}
                      onClick={() => go("preparation")}
                    >
                      <td>
                        <strong>{r[0]}</strong>
                      </td>
                      <td>{r[1]}</td>
                      <td>{r[2]}</td>
                      <td>
                        <Badge
                          tone={r[3] === "Available" ? "success" : "danger"}
                        >
                          {r[3]}
                        </Badge>
                      </td>
                      <td>{r[4]} PHT</td>
                      <td>
                        <Badge
                          tone={r[5] === "Current" ? "success" : "warning"}
                        >
                          {r[5]}
                        </Badge>
                      </td>
                      <td>
                        <Icon name="arrow" size={16} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Destination</th>
                  <th>Requested items</th>
                  <th>Inventory</th>
                  <th>Preparation</th>
                  <th>Weight</th>
                  <th>Next action</th>
                  <th>
                    <span className="sr-only">Open details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders
                  .slice(0, 4)
                  .filter((o) =>
                    `${o.id} ${o.destination}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((o, i) => (
                    <tr
                      key={o.id}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          event.currentTarget.click()
                        }
                      }}
                      onClick={() => go("preparation")}
                    >
                      <td>
                        <strong>{o.id}</strong>
                      </td>
                      <td>{o.destination}</td>
                      <td>
                        {o.items[0].sku} × {o.items[0].qty}
                      </td>
                      <td>
                        <Badge
                          tone={
                            i === 0
                              ? "success"
                              : i === 2
                                ? "danger"
                                : i === 3
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {o.inventory}
                        </Badge>
                      </td>
                      <td>{i === 0 ? "Packed" : "Not started"}</td>
                      <td>{i === 0 ? "2.5 kg" : "—"}</td>
                      <td>
                        <button className="text-button">
                          {i === 0
                            ? "Review"
                            : i === 2
                              ? "Resolve shortage"
                              : "Start preparation"}
                        </button>
                      </td>
                      <td>
                        <Icon name="arrow" size={16} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="demo-disclosure">
          Four sample records per view. Search is interactive; filters are a
          preview. All detail links open the ORD-1001 preparation example.
        </p>
      </Card>
    </>
  )
}

function Preparation({ go, role }: RolePageProps) {
  const [picked, setPicked] = useState(true),
    [packed, setPacked] = useState(true),
    [weight, setWeight] = useState("2.5"),
    [saved, setSaved] = useState(false),
    [shortage, setShortage] = useState(false)
  const weightValid = Number.isFinite(Number(weight)) && Number(weight) > 0
  const completed = Number(picked) + Number(packed) + Number(weightValid)
  const valid = picked && packed && weightValid && !shortage
  return (
    <>
      <div className="breadcrumbs">
        <button onClick={() => go("warehouse")}>Warehouse</button>
        <Icon name="arrow" size={14} />
        <span>Preparation</span>
        <Icon name="arrow" size={14} />
        <span>ORD-1001</span>
      </div>
      <PageHead
        title="Prepare order ORD-1001"
        description="Record proposed picking, packing, and package details."
        back={() => go("warehouse")}
      >
        <Button kind="secondary" onClick={() => go("order-detail")}>
          View order
        </Button>
        <Button onClick={() => go("create-shipment")} disabled={!valid}>
          Continue to shipment
        </Button>
      </PageHead>
      {saved && (
        <div className="toast-inline">
          <Icon name="check" />
          Preparation progress saved for this view only
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Destination and inventory</h2>
                <p>Confirmed information from linked systems</p>
              </div>
              <Badge tone="success">Inventory available</Badge>
            </div>
            <div className="summary-grid">
              <div>
                <small>Customer</small>
                <strong>Luzon Home Supplies</strong>
              </div>
              <div>
                <small>Destination</small>
                <strong>Tarlac, Central Luzon</strong>
              </div>
              <div>
                <small>Inventory checked</small>
                <strong>18 Jun, 10:02 PHT</strong>
              </div>
              <div>
                <small>Availability</small>
                <strong>Boolean confirmation</strong>
                <span>No stock count supplied</span>
              </div>
            </div>
            <div className="hint">
              <Icon name="info" size={17} />
              This check does not reserve or deduct WMS inventory.
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Item checklist</h2>
                <p>Verify each requested item before packing</p>
              </div>
              <span className="progress-text">
                {picked ? "1 of 1 picked" : "0 of 1 picked"}
              </span>
            </div>
            <label className="checklist-item">
              <input
                type="checkbox"
                checked={picked}
                onChange={(e) => setPicked(e.target.checked)}
              />
              <span className="product-icon">
                <Icon name="box" />
              </span>
              <span>
                <strong>BOX-001</strong>
                <small>Heavy-duty storage box</small>
              </span>
              <span>
                <small>Requested</small>
                <strong>2 units</strong>
              </span>
            </label>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Packing and package details</h2>
                <p>Complete these details before creating a shipment</p>
              </div>
            </div>
            <label className="packing-check">
              <input
                type="checkbox"
                checked={packed}
                onChange={(e) => setPacked(e.target.checked)}
              />
              <span>
                <strong>Package is packed and ready</strong>
                <small>Confirm contents and packaging are secure.</small>
              </span>
            </label>
            <div className="form-grid one-row">
              <label>
                <span>
                  Package weight <b>*</b>
                </span>
                <div className="input-suffix">
                  <input
                    id="package-weight"
                    aria-invalid={!weightValid}
                    aria-describedby={!weightValid ? "weight-error" : undefined}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    inputMode="decimal"
                  />
                  <span>kg</span>
                </div>
                {!weightValid && (
                  <em id="weight-error" role="alert">
                    Enter a positive package weight.
                  </em>
                )}
              </label>
              <label>
                <span>Warehouse notes</span>
                <input placeholder="Optional handling notes" />
              </label>
            </div>
            <label className="shortage-check">
              <input
                type="checkbox"
                checked={shortage}
                onChange={(e) => setShortage(e.target.checked)}
              />
              <span>
                <strong>Flag an inventory shortage</strong>
                <small>
                  Blocks continuation in this demo. No notification is sent.
                </small>
              </span>
            </label>
          </Card>
          <div className="footer-actions">
            <Button kind="secondary" onClick={() => go("warehouse")}>
              Cancel
            </Button>
            <Button kind="secondary" onClick={() => setSaved(true)}>
              Save progress
            </Button>
            <Button onClick={() => go("create-shipment")} disabled={!valid}>
              Continue to shipment
            </Button>
          </div>
        </div>
        <aside className="detail-side">
          <Card>
            <h2>Preparation status</h2>
            <div className="completion">
              <div style={{ width: `${(completed / 3) * 100}%` }} />
              <span>
                {completed} of 3 complete{shortage ? " · Shortage flagged" : ""}
              </span>
            </div>
            <div className="task-list">
              <span className={picked ? "done" : ""}>
                <Icon name={picked ? "check" : "clock"} size={15} />
                Items picked
              </span>
              <span className={packed ? "done" : ""}>
                <Icon name={packed ? "check" : "clock"} size={15} />
                Package packed
              </span>
              <span className={weightValid ? "done" : ""}>
                <Icon name={weightValid ? "check" : "clock"} size={15} />
                Weight recorded
              </span>
            </div>
          </Card>
          <Card className="next-action">
            <small>Shipment prerequisite</small>
            <h3>
              {valid ? "Ready to create shipment" : "Preparation incomplete"}
            </h3>
            <p>
              {valid
                ? "All required package details are complete."
                : "Complete picking, packing, and weight first."}
            </p>
          </Card>
          {role === "Operations staff" && (
            <div className="permission-note">
              <Icon name="info" />
              <span>
                Preparation controls are proposed prototype features shared with
                warehouse staff.
              </span>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

function CreateShipment({ go }: { go: (p: Page) => void }) {
  const [created, setCreated] = useState(false)
  if (created)
    return (
      <>
        <PageHead
          title="Shipment created"
          description="Simulated carrier confirmation linked to sample order ORD-1001."
        />
        <Card className="success-panel">
          <span className="success-mark">
            <Icon name="check" size={28} />
          </span>
          <h2>Carrier shipment confirmed</h2>
          <p>
            Demo carrier confirmation · 18 Jun 2025, 10:51 PHT. Confirmation
            does not mean dispatch.
          </p>
          <div className="success-details">
            <div>
              <small>Shipment reference</small>
              <strong>SHP-5012</strong>
            </div>
            <div>
              <small>Tracking number</small>
              <strong>TRK-123456</strong>
            </div>
            <div>
              <small>Shipping fee</small>
              <strong>₱350.00</strong>
            </div>
            <div>
              <small>OMS synchronization</small>
              <Badge tone="success">Synchronized</Badge>
            </div>
          </div>
          <div>
            <Button kind="secondary" onClick={() => go("order-detail")}>
              Return to order
            </Button>
            <Button onClick={() => go("shipment-detail")}>View shipment</Button>
          </div>
        </Card>
      </>
    )
  return (
    <>
      <div className="breadcrumbs">
        <button onClick={() => go("order-detail")}>ORD-1001</button>
        <Icon name="arrow" size={14} />
        <span>Create shipment</span>
      </div>
      <PageHead
        title="Create shipment"
        description="Sample creation scenario for ORD-1001, before carrier confirmation. No network request is sent."
        back={() => go("order-detail")}
      />
      <div className="form-layout">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Eligibility checks</h2>
                <p>All prerequisites must pass before submission</p>
              </div>
              <Badge tone="success">Eligible</Badge>
            </div>
            <div className="eligibility">
              <div>
                <Icon name="check" />
                <span>
                  <strong>Inventory confirmed</strong>
                  <small>Available · 18 Jun, 10:02 PHT</small>
                </span>
              </div>
              <div>
                <Icon name="check" />
                <span>
                  <strong>Package ready</strong>
                  <small>Packed · 2.5 kg</small>
                </span>
              </div>
              <div>
                <Icon name="check" />
                <span>
                  <strong>No existing shipment</strong>
                  <small>Demonstration prerequisite</small>
                </span>
              </div>
              <div>
                <Icon name="check" />
                <span>
                  <strong>No unresolved carrier request</strong>
                  <small>Safe to submit</small>
                </span>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Shipment request</h2>
                <p>Information sent through middleware</p>
              </div>
            </div>
            <div className="summary-grid">
              <div>
                <small>Originating order</small>
                <strong>ORD-1001</strong>
              </div>
              <div>
                <small>Destination</small>
                <strong>Tarlac, Central Luzon</strong>
              </div>
              <div>
                <small>Package weight</small>
                <strong>2.5 kg</strong>
              </div>
              <div>
                <small>Shipping fee</small>
                <strong>Available after carrier confirmation</strong>
              </div>
            </div>
          </Card>
          <div className="alert info">
            <Icon name="info" />
            <div>
              <strong>Duplicate shipment protection</strong>
              <p>
                The proposed integration uses a unique idempotency reference. If
                the carrier outcome is unknown, check that reference before
                retrying. These safeguards are demonstrated in the UI; no
                carrier request is sent.
              </p>
            </div>
          </div>
          <div className="footer-actions">
            <Button kind="secondary" onClick={() => go("preparation")}>
              Back to preparation
            </Button>
            <Button onClick={() => setCreated(true)}>Create shipment</Button>
          </div>
        </div>
        <aside className="detail-side">
          <Card>
            <h2>Carrier connection</h2>
            <div className="carrier-row">
              <span className="system-logo s2">L</span>
              <span>
                <strong>LBC Express</strong>
                <small>Demonstration connection</small>
              </span>
            </div>
            <div className="status-stack">
              <div>
                <span>Connection status</span>
                <Badge tone="success">Connected</Badge>
              </div>
              <div>
                <span>Last health check</span>
                <strong>11:28 PHT</strong>
              </div>
            </div>
          </Card>
          <Card className="next-action">
            <small>After confirmation</small>
            <h3>Shipment information</h3>
            <p>
              The tracking number and fee will be synchronized to OMS. Carrier
              confirmation does not mean dispatch.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}

function Shipments({
  go,
  initialSearch = "",
}: {
  go: (p: Page) => void
  initialSearch?: string
}) {
  const [query, setQuery] = useState(initialSearch)
  const filtered = shipments.filter((shipment) =>
    Object.values(shipment)
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHead
        title="Shipments"
        description="Monitor carrier confirmations, tracking, and OMS synchronization."
      />
      <Card>
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search shipments"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search shipment, order, or tracking number"
            />
          </label>
          <Button kind="secondary" icon="filter">
            Filters
          </Button>
          <label className="select-label">
            Sort by{" "}
            <select disabled title="Sorting is a preview control">
              <option>Last updated</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Shipment</th>
                <th>Order</th>
                <th>Carrier</th>
                <th>Tracking number</th>
                <th>Destination</th>
                <th>Fee</th>
                <th>Status</th>
                <th>OMS sync</th>
                <th>Last update</th>
                <th>
                  <span className="sr-only">Open details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      event.currentTarget.click()
                    }
                  }}
                  onClick={() => go("shipment-detail")}
                >
                  <td>
                    <strong>{s.id}</strong>
                  </td>
                  <td>{s.orderId}</td>
                  <td>{s.carrier}</td>
                  <td>
                    <strong>{s.tracking}</strong>
                  </td>
                  <td>{s.destination}</td>
                  <td>{s.fee}</td>
                  <td>
                    <Badge
                      tone={
                        s.status === "Delivered"
                          ? "success"
                          : s.status.includes("exception")
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {s.status}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      tone={s.sync === "Synchronized" ? "success" : "warning"}
                    >
                      {s.sync}
                    </Badge>
                  </td>
                  <td>{s.updated}</td>
                  <td>
                    <Icon name="arrow" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <EmptyState
            title="No matching shipments"
            text="Try a shipment ID, order, or tracking number from the sample data."
          />
        )}
        <SamplePagination count={filtered.length} label="shipments" />
        <p className="demo-disclosure">
          Search is interactive. Filters and sort are preview controls. Detail
          links open the SHP-5012 example, including a separate OMS recovery
          scenario.
        </p>
      </Card>
    </>
  )
}

function ShipmentDetail({ go }: { go: (p: Page) => void }) {
  const [copied, setCopied] = useState(false),
    [synced, setSynced] = useState(false)
  return (
    <>
      <div className="breadcrumbs">
        <button onClick={() => go("shipments")}>Shipments</button>
        <Icon name="arrow" size={14} />
        <span>SHP-5012</span>
      </div>
      <PageHead
        title="Shipment SHP-5012"
        description="Created 18 June 2025 at 10:51 PHT · Demonstration of OMS synchronization recovery"
        back={() => go("shipments")}
      >
        <Button kind="secondary" onClick={() => go("order-detail")}>
          View order
        </Button>
        <Button onClick={() => go("tracking")}>Track shipment</Button>
      </PageHead>
      {synced && (
        <div className="toast-inline">
          <Icon name="check" />
          Demo synchronization completed · Confirmed shipment retained
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Shipment summary</h2>
                <p>Confirmed carrier information</p>
              </div>
              <Badge tone="neutral">In transit</Badge>
            </div>
            <div className="tracking-number">
              <div>
                <small>Tracking number</small>
                <strong>TRK-123456</strong>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText("TRK-123456")
                  setCopied(true)
                }}
              >
                <Icon name={copied ? "check" : "copy"} size={17} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="summary-grid">
              <div>
                <small>Carrier</small>
                <strong>LBC Express</strong>
              </div>
              <div>
                <small>Shipping fee</small>
                <strong>₱350.00</strong>
              </div>
              <div>
                <small>Destination</small>
                <strong>Tarlac, Central Luzon</strong>
              </div>
              <div>
                <small>Package</small>
                <strong>2.5 kg · 1 package</strong>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Tracking timeline</h2>
                <p>Carrier-reported events</p>
              </div>
              <button className="text-button" onClick={() => go("tracking")}>
                Full tracking <Icon name="arrow" size={16} />
              </button>
            </div>
            <Timeline />
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>OMS synchronization</h2>
                <p>Shipment information returned to the order owner</p>
              </div>
              <Badge tone={synced ? "success" : "warning"}>
                {synced ? "Synchronized" : "Pending"}
              </Badge>
            </div>
            {!synced ? (
              <div className="alert warning">
                <Icon name="alert" />
                <div>
                  <strong>
                    Carrier shipment is confirmed, but OMS synchronization
                    failed
                  </strong>
                  <p>
                    The confirmed shipment is retained. Retry synchronization
                    without creating another carrier shipment.
                  </p>
                </div>
                <Button kind="secondary" onClick={() => setSynced(true)}>
                  Retry synchronization
                </Button>
              </div>
            ) : (
              <div className="result-panel">
                <span>
                  <Icon name="check" />
                </span>
                <div>
                  <strong>OMS is up to date</strong>
                  <p>
                    Tracking number and shipping fee synchronized at 11:32 PHT.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
        <aside className="detail-side">
          <Card>
            <h2>Linked records</h2>
            <div className="linked-list">
              <button onClick={() => go("order-detail")}>
                <span>
                  <small>Order</small>
                  <strong>ORD-1001</strong>
                </span>
                <Icon name="arrow" size={16} />
              </button>
              <button onClick={() => go("integration")}>
                <span>
                  <small>Integration events</small>
                  <strong>3 related events</strong>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </Card>
          <Card>
            <h2>Carrier confirmation</h2>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>Confirmed</dd>
              </div>
              <div>
                <dt>Timestamp</dt>
                <dd>18 Jun, 10:51 PHT</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>LBC-8842017</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </>
  )
}

function Timeline({ compact = false }: { compact?: boolean }) {
  const events = compact
    ? [
        ["Shipment synchronized to OMS", "10:58", "Middleware"],
        ["Carrier shipment confirmed", "10:51", "LBC Express"],
        ["Package preparation completed", "10:43", "Juan Dela Cruz"],
        ["Inventory confirmed available", "10:02", "WMS service"],
        ["Order accepted", "09:42", "Middleware"],
      ]
    : [
        [
          "In transit",
          "18 Jun, 11:26 PHT",
          "Departed LBC Tarlac distribution hub",
        ],
        ["Shipment received at origin hub", "18 Jun, 10:58 PHT", "Tarlac City"],
        ["Label created", "18 Jun, 10:51 PHT", "Shipment information received"],
      ]
  return (
    <div className="timeline">
      {events.map((e, i) => (
        <div className={i === 0 ? "current" : ""} key={e[0]}>
          <i>{i === 0 ? <Icon name="check" size={13} /> : ""}</i>
          <span>
            <strong>{e[0]}</strong>
            <small>
              {e[1]} · {e[2]}
            </small>
          </span>
        </div>
      ))}
    </div>
  )
}

function Tracking({
  go,
  initialQuery = "TRK-123456",
}: {
  go: (p: Page) => void
  initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery),
    [reference, setReference] = useState(initialQuery.toUpperCase()),
    [refreshed, setRefreshed] = useState(false)
  const found = ["TRK-123456", "SHP-5012", "ORD-1001"].includes(reference)
  const search = () => {
    setReference(query.trim().toUpperCase())
    setRefreshed(false)
  }
  return (
    <>
      <PageHead
        title="Tracking"
        description="Look up carrier status by tracking number, shipment ID, or order ID."
      />
      <Card className="lookup-card">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            search()
          }}
        >
          <label htmlFor="tracking-reference">Tracking reference</label>
          <div className="tracking-lookup-field">
            <Icon name="search" />
            <input
              id="tracking-reference"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. TRK-123456, SHP-5012, or ORD-1001"
            />
            <Button onClick={search}>Search</Button>
          </div>
        </form>
        <small>
          Available sample: TRK-123456, SHP-5012, or ORD-1001. Refresh rechecks
          the sample; no live carrier connection.
        </small>
      </Card>
      {found ? (
        <div className="tracking-layout">
          <div className="detail-main">
            <Card className="tracking-hero">
              <div>
                <Badge tone="neutral">In transit</Badge>
                <h2>Shipment is on the way</h2>
                <p>Last carrier update: 18 Jun 2025, 11:26 PHT</p>
              </div>
              <Button
                kind="secondary"
                icon="refresh"
                onClick={() => setRefreshed(true)}
              >
                {refreshed ? "Up to date" : "Refresh status"}
              </Button>
              <div className="route-line">
                <div>
                  <i className="done" />
                  <span>
                    <strong>Manila</strong>
                    <small>Origin</small>
                  </span>
                </div>
                <div className="line">
                  <span style={{ width: "58%" }} />
                </div>
                <div>
                  <i />
                  <span>
                    <strong>Tarlac</strong>
                    <small>Destination</small>
                  </span>
                </div>
              </div>
            </Card>
            <Card>
              <div className="card-head">
                <div>
                  <h2>Tracking events</h2>
                  <p>Chronological carrier-reported updates</p>
                </div>
              </div>
              <Timeline />
            </Card>
          </div>
          <aside className="detail-side">
            <Card>
              <h2>Shipment details</h2>
              <dl>
                <div>
                  <dt>Tracking number</dt>
                  <dd>TRK-123456</dd>
                </div>
                <div>
                  <dt>Carrier</dt>
                  <dd>LBC Express</dd>
                </div>
                <div>
                  <dt>Destination</dt>
                  <dd>Tarlac</dd>
                </div>
                <div>
                  <dt>Estimated delivery</dt>
                  <dd>20 Jun 2025</dd>
                </div>
              </dl>
            </Card>
            <Card>
              <h2>Linked records</h2>
              <div className="linked-list">
                <button onClick={() => go("shipment-detail")}>
                  <span>
                    <small>Shipment</small>
                    <strong>SHP-5012</strong>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
                <button onClick={() => go("order-detail")}>
                  <span>
                    <small>Order</small>
                    <strong>ORD-1001</strong>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </Card>
          </aside>
        </div>
      ) : (
        <Card className="lookup-empty">
          <EmptyState
            title="No matching tracking record"
            text="Check the reference or try the available sample TRK-123456."
          />
        </Card>
      )}
    </>
  )
}

function Integration({ role, go }: RolePageProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [technical, setTechnical] = useState(false)
  const [query, setQuery] = useState("")
  const drawer = selected !== null
  const drawerRef = useFocusLayer(drawer, () => setSelected(null), true)
  if (role !== "Administrator") return <AccessDenied go={go} />
  const events = [
    [
      "18 Jun, 11:28:42",
      "cor_8af32d",
      "ORD-1001",
      "WMS → SLSIS",
      "Inventory check",
      "200 Success",
      "182 ms",
      "1",
    ],
    [
      "18 Jun, 11:21:05",
      "cor_5be101",
      "ORD-1006",
      "SLSIS → Carrier",
      "Create shipment",
      "Timeout",
      "30.0 s",
      "1",
    ],
    [
      "18 Jun, 10:54:18",
      "cor_49f22a",
      "ORD-1004",
      "SLSIS → WMS",
      "Inventory check",
      "503 Unavailable",
      "5.2 s",
      "3",
    ],
    [
      "18 Jun, 10:51:32",
      "cor_74c091",
      "ORD-1001",
      "SLSIS → Carrier",
      "Create shipment",
      "Confirmed",
      "340 ms",
      "1",
    ],
    [
      "18 Jun, 10:43:09",
      "cor_33de20",
      "ORD-1003",
      "WMS → SLSIS",
      "Inventory check",
      "200 Unavailable",
      "211 ms",
      "1",
    ],
    [
      "18 Jun, 10:31:10",
      "cor_b7510e",
      "ORD-1005",
      "SLSIS → Carrier",
      "Create shipment",
      "503 Unavailable",
      "5.0 s",
      "1",
    ],
  ]
  const guidance = [
    {
      title: "Inventory confirmed",
      text: "WMS confirmed availability for the requested items. This does not reserve or deduct inventory.",
      next: "Review warehouse preparation before requesting a shipment.",
      tone: "success",
      stage: "WMS confirmed",
    },
    {
      title: "Carrier outcome unknown",
      text: "The carrier request timed out. The order and package details are preserved. A shipment may already exist.",
      next: "Check carrier status using the idempotency reference. Only retry if no shipment exists.",
      tone: "warning",
      stage: "Confirmation unknown",
    },
    {
      title: "WMS unavailable",
      text: "The inventory service could not be reached after the sample retry attempts. Availability is unknown; no shipment should be requested.",
      next: "Restore the WMS connection, then recheck inventory. A service failure does not mean inventory is unavailable.",
      tone: "warning",
      stage: "WMS unavailable",
    },
    {
      title: "Carrier shipment confirmed",
      text: "The carrier returned shipment SHP-5012 and tracking TRK-123456. Confirmation does not mean dispatch or delivery.",
      next: "Retain the confirmed shipment. If OMS synchronization fails, retry synchronization without creating another shipment.",
      tone: "success",
      stage: "Carrier confirmed",
    },
    {
      title: "Inventory unavailable",
      text: "WMS responded successfully, but the requested stock is unavailable. The accepted order is retained and shipment creation is blocked.",
      next: "Resolve the shortage with the warehouse, then repeat the inventory check before preparation.",
      tone: "danger",
      stage: "Stock unavailable",
    },
    {
      title: "Carrier unavailable",
      text: "The sample carrier service returned an unavailable response. The order and prepared package are retained.",
      next: "Restore the connection and inspect the request outcome and idempotency reference before deciding whether a retry is safe.",
      tone: "danger",
      stage: "Carrier unavailable",
    },
  ]
  const event = events[selected ?? 0]
  const detail = guidance[selected ?? 0]
  return (
    <>
      <PageHead
        title="Integration monitor"
        description="Inspect connection health, events, and authorized recovery actions."
      >
        <Button kind="secondary" icon="refresh">
          Refresh status
        </Button>
      </PageHead>
      <div className="demo-strip">
        <Icon name="info" size={17} />
        <strong>Demonstration data</strong>
        <span>
          Connection measurements below are illustrative, not service-level
          targets.
        </span>
      </div>
      <div className="connection-cards">
        {[
          ["OMS", "Connected", "11:29 PHT", "11:30 PHT", "0", "182 ms"],
          ["WMS", "Degraded", "11:27 PHT", "11:30 PHT", "3", "1.8 s"],
          ["Carrier API", "Connected", "11:28 PHT", "11:30 PHT", "2", "340 ms"],
        ].map((x, i) => (
          <Card key={x[0]}>
            <div className="connection-title">
              <span className={`system-logo s${i}`}>{x[0][0]}</span>
              <span>
                <h2>{x[0]}</h2>
                <Badge tone={i === 1 ? "warning" : "success"}>{x[1]}</Badge>
              </span>
            </div>
            <dl>
              <div>
                <dt>Last successful request</dt>
                <dd>{x[2]}</dd>
              </div>
              <div>
                <dt>Last health check</dt>
                <dd>{x[3]}</dd>
              </div>
              <div>
                <dt>Errors · 24h</dt>
                <dd>{x[4]}</dd>
              </div>
              <div>
                <dt>Recent response time</dt>
                <dd>{x[5]}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>
      <Card>
        <div className="card-head">
          <div>
            <h2>Integration events</h2>
            <p>Requests coordinated by middleware</p>
          </div>
        </div>
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              aria-label="Search integration events"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search correlation ID, order, or operation"
            />
          </label>
          <Button kind="secondary" icon="filter">
            Filters
          </Button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Correlation ID</th>
                <th>Order</th>
                <th>Route</th>
                <th>Operation</th>
                <th>Outcome</th>
                <th>Duration</th>
                <th>Attempts</th>
                <th>
                  <span className="sr-only">Open details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events
                .map((e, i) => ({ e, i }))
                .filter(({ e }) =>
                  e.join(" ").toLowerCase().includes(query.toLowerCase()),
                )
                .map(({ e, i }) => (
                  <tr
                    key={e[1]}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        event.currentTarget.click()
                      }
                    }}
                    onClick={() => {
                      setSelected(i)
                      setTechnical(false)
                    }}
                  >
                    <td>
                      {e[0]}
                      <small>PHT</small>
                    </td>
                    <td>
                      <code>{e[1]}</code>
                    </td>
                    <td>
                      <strong>{e[2]}</strong>
                    </td>
                    <td>{e[3]}</td>
                    <td>{e[4]}</td>
                    <td>
                      <Badge
                        tone={
                          e[5].includes("Success") || e[5] === "Confirmed"
                            ? "success"
                            : e[5].includes("Timeout") || i === 2
                              ? "warning"
                              : "danger"
                        }
                      >
                        {e[5]}
                      </Badge>
                    </td>
                    <td>{e[6]}</td>
                    <td>{e[7]}</td>
                    <td>
                      <Icon name="arrow" size={16} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!events.some((event) =>
          event.join(" ").toLowerCase().includes(query.toLowerCase()),
        ) && (
          <EmptyState
            title="No matching events"
            text="Try a sample order, correlation ID, or operation."
          />
        )}
        <p className="demo-disclosure">
          Filter and refresh controls are previews. Open an event for
          operational context and recovery guidance.
        </p>
      </Card>
      {drawer && (
        <div className="overlay" onMouseDown={() => setSelected(null)}>
          <aside
            ref={drawerRef}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="drawer-head">
              <div>
                <small>Integration event</small>
                <h2 id="event-title">{detail.title}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close diagnostics"
                onClick={() => setSelected(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className={`alert ${detail.tone}`}>
              <Icon name="alert" />
              <div>
                <strong>{detail.stage}</strong>
                <p>{detail.text}</p>
              </div>
            </div>
            <section>
              <h3>Affected record</h3>
              <p>
                {event[2]} · {event[0]} PHT · Detail navigation opens the fixed
                ORD-1001 example.
              </p>
              <button
                className="record-link"
                onClick={() => go("order-detail")}
              >
                <span>
                  <small>Order</small>
                  <strong>{event[2]}</strong>
                </span>
                <Icon name="arrow" />
              </button>
            </section>
            <section>
              <h3>Processing stage</h3>
              <div className="stage-row">
                <span className="done">
                  <Icon name="check" />
                </span>
                <i />
                <span className="done">
                  <Icon name="check" />
                </span>
                <i />
                <span className={detail.tone}>
                  <Icon name="alert" />
                </span>
              </div>
              <div className="stage-labels">
                <span>Validated</span>
                <span>{event[4]}</span>
                <span>{detail.stage}</span>
              </div>
            </section>
            <section>
              <h3>Safe next action</h3>
              <p>{detail.next}</p>
              {(selected === 1 || selected === 5) && (
                <>
                  <div className="hint">
                    Idempotency reference: <code>demo-shipment-{event[2]}</code>
                  </div>
                  <Button icon="refresh">Check carrier status</Button>
                  <p className="demo-disclosure">
                    Carrier verification is not connected. The outcome remains
                    unknown; do not submit another shipment request.
                  </p>
                </>
              )}
              {selected === 3 && (
                <Button onClick={() => go("shipment-detail")}>
                  Open synchronization recovery
                </Button>
              )}
            </section>
            <section>
              <button
                className="expand-button"
                aria-expanded={technical}
                aria-controls="event-technical"
                onClick={() => setTechnical(!technical)}
              >
                Technical details <Icon name="down" />
              </button>
              {technical && (
                <div className="technical" id="event-technical">
                  <div>
                    <small>Operation</small>
                    <code>
                      {event[4] === "Inventory check"
                        ? "POST /api/v1/inventory/check"
                        : "POST /api/v1/shipments"}
                    </code>
                  </div>
                  <div>
                    <small>Correlation ID</small>
                    <code>{event[1]}</code>
                  </div>
                  <div>
                    <small>Response</small>
                    <code>
                      {selected === 1
                        ? "Gateway timeout after 30,000 ms"
                        : event[5]}
                    </code>
                  </div>
                  <p>
                    Authorization headers and sensitive payload values are
                    redacted.
                  </p>
                </div>
              )}
            </section>
          </aside>
        </div>
      )}
    </>
  )
}

function Activity({ go }: { go: (p: Page) => void }) {
  const [query, setQuery] = useState("")
  const rows = [
    [
      "18 Jun, 11:32",
      "Middleware service",
      "OMS synchronization retried",
      "Success",
      "SHP-5012",
    ],
    [
      "18 Jun, 11:26",
      "LBC Express",
      "Tracking update received",
      "In transit",
      "TRK-123456",
    ],
    [
      "18 Jun, 10:54",
      "WMS service",
      "Inventory check failed after 3 attempts",
      "Failed",
      "ORD-1004",
    ],
    [
      "18 Jun, 10:51",
      "Carrier service",
      "Shipment confirmed",
      "Success",
      "SHP-5012",
    ],
    [
      "18 Jun, 10:43",
      "Juan Dela Cruz",
      "Package preparation completed",
      "Success",
      "ORD-1001",
    ],
    [
      "18 Jun, 10:02",
      "WMS service",
      "Inventory availability checked",
      "Available",
      "ORD-1001",
    ],
    [
      "18 Jun, 09:42",
      "Maria Santos",
      "Order submitted",
      "Accepted",
      "ORD-1001",
    ],
  ]
  const filtered = rows.filter((row) =>
    row.join(" ").toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHead
        title="Activity log"
        description="Sample history of operational and integration actions. This prototype has no persistent audit log."
      />
      <Card>
        <div className="toolbar">
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search activity"
              placeholder="Search record, actor, or action"
            />
          </label>
          <Button kind="secondary" icon="filter">
            Filters
          </Button>
          <label className="select-label">
            Date{" "}
            <select disabled title="Date filtering is a preview control">
              <option>Last 7 days</option>
            </select>
          </label>
        </div>
        <div className="activity-list">
          {filtered.map((r, i) => (
            <div key={i}>
              <span
                className={`activity-dot ${r[3] === "Failed" ? "error" : ""}`}
              >
                <Icon name={r[3] === "Failed" ? "alert" : "check"} size={14} />
              </span>
              <span className="activity-time">
                {r[0]}
                <small>PHT</small>
              </span>
              <span className="activity-copy">
                <strong>{r[2]}</strong>
                <small>{r[1]}</small>
              </span>
              <Badge
                tone={
                  r[3] === "Failed"
                    ? "danger"
                    : r[3] === "In transit"
                      ? "neutral"
                      : "success"
                }
              >
                {r[3]}
              </Badge>
              <button
                className="text-button"
                title="Open the sample record detail"
                onClick={() =>
                  go(
                    r[4].startsWith("SHP") ? "shipment-detail" : "order-detail",
                  )
                }
              >
                {r[4]}
              </button>
            </div>
          ))}
        </div>
        {!filtered.length && (
          <EmptyState
            title="No matching activity"
            text="Try another record, actor, or action."
          />
        )}
        <SamplePagination count={filtered.length} label="events" />
        <p className="demo-disclosure">
          Filters and date selection are preview controls. Related links open
          the fixed sample detail views.
        </p>
      </Card>
    </>
  )
}

function Settings({ role, go }: RolePageProps) {
  const [tab, setTab] = useState("Profile"),
    [saved, setSaved] = useState(false),
    [tested, setTested] = useState(false)
  if (role === "Warehouse staff" && tab !== "Profile")
    return <AccessDenied go={go} />
  return (
    <>
      <PageHead
        title="Settings"
        description="Manage your profile and proposed system configuration."
      />
      {saved && (
        <div className="toast-inline">
          <Icon name="check" />
          Demo changes acknowledged for this view only. No settings are
          persisted and no authentication is performed.
        </div>
      )}
      <div className="tabs">
        {["Profile", "Users and roles", "Integrations"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            onClick={() =>
              role === "Warehouse staff" && t !== "Profile"
                ? go("access-denied")
                : setTab(t)
            }
            key={t}
          >
            {t}
            {role === "Warehouse staff" && t !== "Profile" && (
              <span>Restricted</span>
            )}
          </button>
        ))}
      </div>
      {tab === "Profile" && (
        <Card className="settings-card">
          <div className="settings-section">
            <div>
              <h2>Profile information</h2>
              <p>
                Update your display information and notification preferences.
              </p>
            </div>
            <div className="settings-form">
              <div className="avatar large">MS</div>
              <div className="form-grid">
                <label>
                  <span>Display name</span>
                  <input defaultValue="Maria Santos" />
                </label>
                <label>
                  <span>Email address</span>
                  <input defaultValue="maria.santos@translogix.demo" />
                </label>
                <label>
                  <span>Role</span>
                  <input value={role} readOnly disabled />
                </label>
                <label>
                  <span>Time zone</span>
                  <select>
                    <option>Asia/Manila (PHT)</option>
                  </select>
                </label>
              </div>
              <Button onClick={() => setSaved(true)}>Save profile</Button>
            </div>
          </div>
        </Card>
      )}
      {tab === "Users and roles" && (
        <Card>
          <div className="card-head">
            <div>
              <h2>Users and roles</h2>
              <p>Proposed access controls for this prototype</p>
            </div>
            <Button icon="plus">Invite user</Button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last active</th>
                  <th>
                    <span className="sr-only">Open details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Maria Santos",
                    "maria.santos@translogix.demo",
                    "Administrator",
                  ],
                  [
                    "Juan Dela Cruz",
                    "juan.delacruz@translogix.demo",
                    "Warehouse staff",
                  ],
                  [
                    "Ana Reyes",
                    "ana.reyes@translogix.demo",
                    "Operations staff",
                  ],
                ].map((u) => (
                  <tr key={u[0]}>
                    <td>
                      <strong>{u[0]}</strong>
                      <small>{u[1]}</small>
                    </td>
                    <td>{u[2]}</td>
                    <td>
                      <Badge tone="success">Active</Badge>
                    </td>
                    <td>Today</td>
                    <td>
                      <Button kind="ghost">Manage</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {tab === "Integrations" && (
        <div className="settings-stack">
          <div className="alert info">
            <Icon name="info" />
            <div>
              <strong>Proposed configuration controls</strong>
              <p>
                Save and connection test actions are simulated. Credentials are
                illustrative masked values; no authentication is performed.
              </p>
            </div>
          </div>
          {[
            [
              "Order Management System",
              "https://oms.translogix.demo",
              "Connected",
            ],
            [
              "Warehouse Management System",
              "https://wms.translogix.demo",
              "Degraded",
            ],
            [
              "Carrier API",
              "https://carrier-gateway.translogix.demo",
              "Connected",
            ],
          ].map((x, i) => (
            <Card key={x[0]}>
              <div className="card-head">
                <div>
                  <h2>{x[0]}</h2>
                  <p>Demonstration connection</p>
                </div>
                <Badge tone={i === 1 ? "warning" : "success"}>
                  {tested
                    ? i === 1
                      ? "Demo test failed"
                      : "Demo test passed"
                    : x[2]}
                </Badge>
              </div>
              <div className="form-grid integration-form">
                <label>
                  <span>Base URL</span>
                  <input defaultValue={x[1]} />
                </label>
                <label>
                  <span>API version</span>
                  <select>
                    <option>v1</option>
                  </select>
                </label>
                <label>
                  <span>Authentication</span>
                  <select>
                    <option>API key</option>
                  </select>
                </label>
                <label>
                  <span>Credential</span>
                  <input value="••••••••••••••••••••••••" readOnly />
                </label>
              </div>
              <div className="card-actions">
                <Button kind="secondary" onClick={() => setTested(true)}>
                  Test connection
                </Button>
                <Button onClick={() => setSaved(true)}>Save changes</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

function AccessDenied({ go }: { go: (p: Page) => void }) {
  return (
    <div className="center-state">
      <span>
        <Icon name="alert" size={28} />
      </span>
      <h1>Access restricted</h1>
      <p>
        Your current role does not have permission to view this page. Ask an
        administrator if you need access.
      </p>
      <Button onClick={() => go("dashboard")}>Return to dashboard</Button>
    </div>
  )
}

function Help() {
  return (
    <>
      <PageHead
        title="Help center"
        description="Understand statuses, prerequisites, and safe recovery steps."
      />
      <div className="help-grid">
        {[
          [
            "Order and inventory statuses",
            "Accepted means an order passed validation. It does not mean inventory is reserved or a shipment exists.",
          ],
          [
            "Shipment prerequisites",
            "Inventory must be confirmed, preparation completed, and a positive package weight recorded.",
          ],
          [
            "Carrier timeout recovery",
            "Check carrier status before retrying. This prevents duplicate shipments when an outcome is unknown.",
          ],
          [
            "Integration errors",
            "Operational messages explain what is retained and the next safe action. Administrators can inspect redacted technical details.",
          ],
          [
            "Tracking updates",
            "Shipment creation does not mean dispatch. Tracking status changes only when the carrier supplies an event.",
          ],
          [
            "Need more help?",
            "Contact the TransLogix integration support team and include the order or correlation ID.",
          ],
        ].map((x, i) => (
          <Card key={x[0]}>
            <span className="help-icon">
              <Icon name={i === 5 ? "help" : "info"} />
            </span>
            <h2>{x[0]}</h2>
            <p>{x[1]}</p>
            <button
              className="text-button"
              disabled
              title="Additional documentation is not connected"
            >
              Learn more <Icon name="arrow" size={15} />
            </button>
          </Card>
        ))}
      </div>
      <Card className="contract-card">
        <div className="card-head">
          <div>
            <h2>How the systems connect</h2>
            <p>
              Documented integration flow · Implementation in this app is a
              frontend demonstration
            </p>
          </div>
        </div>
        <ol className="contract-flow">
          {[
            "Customer order created",
            "OMS sends order",
            "Middleware validates order",
            "Middleware checks WMS",
            "WMS confirms inventory",
            "Middleware contacts Carrier API",
            "Carrier generates shipment",
            "Tracking number returned",
            "OMS receives shipment information",
          ].map((stage) => (
            <li key={stage}>{stage}</li>
          ))}
        </ol>
        <div className="endpoint-list">
          <div>
            <code>POST /api/v1/orders</code>
            <p>
              <strong>Order creation</strong>Required: unique orderId,
              customerId, destination, and at least one item with quantity
              greater than zero. Valid creation: HTTP 201. Invalid request: HTTP
              400. Duplicate order: HTTP 409.
            </p>
          </div>
          <div>
            <code>POST /api/v1/inventory/check</code>
            <p>
              <strong>Inventory confirmation</strong>Distinguish unavailable
              stock from an unavailable WMS service. Neither permits shipment
              creation.
            </p>
          </div>
          <div>
            <code>POST /api/v1/shipments</code>
            <p>
              <strong>Carrier request</strong>Retain confirmed shipments when
              OMS synchronization fails. Check unknown carrier outcomes by
              idempotency reference before retrying.
            </p>
          </div>
        </div>
        <details>
          <summary>Order request example and data mapping</summary>
          <p>
            Content-Type: application/json. The UI fixtures use qty internally;
            the documented API request uses quantity. No request is sent by this
            prototype.
          </p>
          <pre>
            <code>
              {JSON.stringify(
                {
                  orderId: "ORD-1010",
                  customerId: "CUS-001",
                  items: [{ sku: "BOX-001", quantity: 2 }],
                  destination: "Tarlac",
                },
                null,
                2,
              )}
            </code>
          </pre>
        </details>
      </Card>
    </>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard")
  const [role, setRole] = useState<Role>("Administrator")
  const [mobileNav, setMobileNav] = useState(false)
  const [compactNav, setCompactNav] = useState(
    () => window.matchMedia("(max-width: 820px)").matches,
  )
  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)")
    const sync = () => {
      setCompactNav(media.matches)
      if (!media.matches) setMobileNav(false)
    }
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])
  const [notifications, setNotifications] = useState(false)
  const [profile, setProfile] = useState(false)
  const [globalQuery, setGlobalQuery] = useState("")
  const [searchRequest, setSearchRequest] = useState<{
    page: Page
    query: string
  } | null>(null)
  const [readNotifications, setReadNotifications] = useState(false)
  const profileRef = useFocusLayer(profile, () => setProfile(false))
  const notificationRef = useFocusLayer(notifications, () =>
    setNotifications(false),
  )
  const navRef = useFocusLayer(mobileNav, () => setMobileNav(false), true)
  const activeSection =
    page === "create-order" || page === "order-detail"
      ? "orders"
      : page === "preparation"
        ? "warehouse"
        : page === "create-shipment" || page === "shipment-detail"
          ? "shipments"
          : page
  const title = useMemo(
    () => nav.find((n) => n[0] === activeSection)?.[1] || "Workspace",
    [activeSection],
  )
  const go = (p: Page) => {
    setPage(p)
    setSearchRequest(null)
    setMobileNav(false)
    setNotifications(false)
    setProfile(false)
    window.scrollTo({ top: 0, behavior: "instant" })
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("main h1")?.focus(),
    )
  }
  const render = () => {
    if (page === "dashboard") return <Dashboard go={go} />
    if (page === "orders")
      return (
        <Orders
          go={go}
          initialSearch={
            searchRequest?.page === "orders" ? searchRequest.query : ""
          }
        />
      )
    if (page === "create-order") return <CreateOrder go={go} />
    if (page === "order-detail") return <OrderDetail go={go} />
    if (page === "warehouse")
      return (
        <Warehouse
          go={go}
          initialSearch={
            searchRequest?.page === "warehouse" ? searchRequest.query : ""
          }
        />
      )
    if (page === "preparation") return <Preparation go={go} role={role} />
    if (page === "create-shipment") return <CreateShipment go={go} />
    if (page === "shipments")
      return (
        <Shipments
          go={go}
          initialSearch={
            searchRequest?.page === "shipments" ? searchRequest.query : ""
          }
        />
      )
    if (page === "shipment-detail") return <ShipmentDetail go={go} />
    if (page === "tracking")
      return (
        <Tracking
          go={go}
          initialQuery={
            searchRequest?.page === "tracking" ? searchRequest.query : undefined
          }
        />
      )
    if (page === "integration") return <Integration role={role} go={go} />
    if (page === "activity") return <Activity go={go} />
    if (page === "settings") return <Settings role={role} go={go} />
    if (page === "help") return <Help />
    return <AccessDenied go={go} />
  }
  return (
    <div className="app">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>
      <aside
        ref={navRef}
        inert={compactNav && !mobileNav}
        className={`sidebar ${mobileNav ? "open" : ""}`}
        aria-label="Workspace navigation"
        role={mobileNav ? "dialog" : undefined}
        aria-modal={mobileNav || undefined}
      >
        <div className="brand">
          <div className="brand-mark">
            <span>T</span>
            <i />
          </div>
          <div>
            <strong>TransLogix</strong>
            <small>Logistics Services</small>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="product-name">
          <span className="workspace-symbol">
            <Icon name="box" size={18} />
          </span>
          <div>
            <strong>Operations portal</strong>
            <span>Shipment integration system</span>
          </div>
          <span className="workspace-version">v1</span>
        </div>
        <nav aria-label="Main navigation">
          <div className="nav-section-label">WORKSPACE</div>
          {nav.map(([id, label, icon]) => {
            const restricted = role !== "Administrator" && id === "integration"
            return (
              <div className="nav-entry" key={id}>
                {id === "integration" && (
                  <div className="nav-section-label">SYSTEM MANAGEMENT</div>
                )}
                <button
                  aria-current={activeSection === id ? "page" : undefined}
                  className={activeSection === id ? "active" : ""}
                  onClick={() =>
                    restricted ? go("access-denied") : go(id as Page)
                  }
                >
                  <Icon name={icon} />
                  <span>{label}</span>
                  {restricted && (
                    <small aria-label="Administrator only">Admin</small>
                  )}
                  {!restricted && activeSection === id && (
                    <span className="active-nav-dot" />
                  )}
                </button>
              </div>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <button
            onClick={() => go("help")}
            className={page === "help" ? "active" : ""}
          >
            <Icon name="help" />
            <span>Help center</span>
          </button>
          <div className="sidebar-demo">
            <Icon name="info" size={16} />
            <span>
              Demo workspace<small>Sample data · No live connections</small>
            </span>
          </div>
          <button
            data-layer-trigger
            onClick={() => {
              setMobileNav(false)
              setProfile(!profile)
              setNotifications(false)
            }}
            aria-expanded={profile}
            aria-label="Open profile menu"
          >
            <div className="avatar">MS</div>
            <span>
              <strong>Maria Santos</strong>
              <small>{role}</small>
            </span>
            <Icon name="down" size={16} />
          </button>
        </div>
      </aside>
      {mobileNav && (
        <div className="nav-scrim" onClick={() => setMobileNav(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            aria-expanded={mobileNav}
          >
            <Icon name="menu" />
          </button>
          <div className="workspace-breadcrumb">
            <Icon name="grid" size={16} />
            <span>Workspace</span>
            <Icon name="arrow" size={13} />
            <strong>{title}</strong>
          </div>
          <form
            className="global-search"
            onSubmit={(event) => {
              event.preventDefault()
              const query = globalQuery.trim()
              if (!query) return
              const target: Page = /^TRK-/i.test(query)
                ? "tracking"
                : /^(SHP-|JTX-|2GO-)/i.test(query)
                  ? "shipments"
                  : /^(BOX|TAPE|WRAP|LABEL|POUCH)-/i.test(query)
                    ? "warehouse"
                    : "orders"
              go(target)
              setSearchRequest({ page: target, query })
              setGlobalQuery("")
            }}
          >
            <label className="sr-only" htmlFor="global-search">
              Search sample records
            </label>
            <Icon name="search" />
            <input
              id="global-search"
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              placeholder="Search sample records…"
            />
            <button
              className="search-submit"
              aria-label="Search records"
              type="submit"
            >
              ↵
            </button>
          </form>
          <div className="top-actions">
            <span className="environment">
              <i />
              Demo environment
            </span>
            <button
              className="icon-button notification-button"
              data-layer-trigger
              onClick={() => {
                setNotifications(!notifications)
                setProfile(false)
              }}
              aria-label="Notifications"
              aria-expanded={notifications}
            >
              <Icon name="bell" />
              {!readNotifications && <i>3</i>}
            </button>
            <button
              className="top-user"
              data-layer-trigger
              aria-expanded={profile}
              aria-label="Open profile menu"
              onClick={() => {
                setProfile(!profile)
                setNotifications(false)
              }}
            >
              <div className="avatar">MS</div>
              <span>
                <strong>Maria Santos</strong>
                <small>{role}</small>
              </span>
              <Icon name="down" size={15} />
            </button>
          </div>
          {notifications && (
            <section
              ref={notificationRef}
              className="popover notifications"
              role="dialog"
              aria-label="Notifications"
            >
              <div className="popover-head">
                <h3>Notifications</h3>
                <button onClick={() => setReadNotifications(true)}>
                  {readNotifications ? "All read" : "Mark all as read"}
                </button>
              </div>
              {[
                [
                  "Inventory unavailable",
                  "ORD-1003 · Review shortage",
                  "danger",
                  "preparation",
                ],
                [
                  "Carrier request failed",
                  "ORD-1005 · Connection unavailable",
                  "danger",
                  "integration",
                ],
                [
                  "OMS synchronization pending",
                  "SHP-5009 · Recovery available",
                  "warning",
                  "shipment-detail",
                ],
                [
                  "Tracking update received",
                  "TRK-123456 · Now in transit",
                  "success",
                  "tracking",
                ],
              ].map((n, i) => (
                <button
                  key={n[0]}
                  className={!readNotifications && i < 3 ? "unread" : ""}
                  onClick={() => go(n[3] as Page)}
                >
                  <span className={`notice-icon ${n[2]}`}>
                    <Icon name={n[2] === "success" ? "check" : "alert"} />
                  </span>
                  <span>
                    <strong>{n[0]}</strong>
                    <small>{n[1]}</small>
                  </span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
            </section>
          )}
          {profile && (
            <section
              ref={profileRef}
              className="popover profile-menu"
              role="dialog"
              aria-label="Profile and demo role"
            >
              <div className="profile-summary">
                <div className="avatar large">MS</div>
                <span>
                  <strong>Maria Santos</strong>
                  <small>maria.santos@translogix.demo</small>
                </span>
              </div>
              <button onClick={() => go("settings")}>
                <Icon name="settings" />
                Account settings
              </button>
              <button
                disabled
                title="This prototype has no authentication session"
              >
                <Icon name="logout" />
                Sign out <small>Demo only</small>
              </button>
              <div className="demo-role">
                <span>
                  <strong>Prototype demonstration</strong>
                  <small>Switch role to preview permissions</small>
                </span>
                <select
                  aria-label="Demo role"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as Role)
                    setProfile(false)
                    go("dashboard")
                  }}
                >
                  <option>Administrator</option>
                  <option>Operations staff</option>
                  <option>Warehouse staff</option>
                </select>
              </div>
            </section>
          )}
        </header>
        <main id="workspace-content" aria-label={title}>
          <div
            className="page-transition"
            key={`${page}-${role}-${searchRequest?.query ?? ""}`}
          >
            {render()}
          </div>
          <footer>
            TransLogix SLSIS · Team Sync
            <span>
              Demonstration prototype · Local state resets between views · No
              live APIs
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}
