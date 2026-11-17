import { useEffect, useState } from "react"
import { api, errorMessage } from "./api"
import type {
  ActivityRecord,
  OrderRecord,
  ShipmentRecord,
  User,
} from "./api-types"
import type { Navigate, Role } from "./types"
import { useWorkspace } from "./WorkspaceData"
import useFocusLayer from "./useFocusLayer"
import Card, {
  Badge,
  Button,
  EmptyState,
  Icon,
  PageHead,
  StatCard,
} from "./components/PortalUI"

interface PageProps {
  go: Navigate
  role?: Role
}
interface SearchPageProps extends PageProps {
  initialSearch?: string
}
const operate = (role: Role) => role !== "Warehouse staff"
const date = (value: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
const tone = (value: string) =>
  /unavailable|blocked|exception/i.test(value)
    ? "danger"
    : /pending|required|unknown|not checked|awaiting/i.test(value)
      ? "warning"
      : /available|accepted|created|delivered|synchronized|transit/i.test(value)
        ? "success"
        : "neutral"

function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  async function run(action: () => Promise<void>, success = "") {
    if (busy) return
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await action()
      setMessage(success)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, message, run }
}
function Feedback({ action }: { action: ReturnType<typeof useAction> }) {
  return (
    <>
      {action.error && (
        <div className="alert danger" role="alert">
          <Icon name="alert" />
          <p>{action.error}</p>
        </div>
      )}
      {action.message && (
        <div className="toast-inline" role="status">
          <Icon name="check" />
          {action.message}
        </div>
      )}
    </>
  )
}
interface CountProps {
  count: number
  label: string
}
function Count({ count, label }: CountProps) {
  return (
    <div className="pagination">
      <span>
        {count} {label} · Saved in workspace database
      </span>
    </div>
  )
}
function Search({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="search-field">
      <Icon name="search" size={18} />
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
      />
    </label>
  )
}
interface OrderTableProps {
  rows: OrderRecord[]
  go: Navigate
}
function OrderTable({ rows, go }: OrderTableProps) {
  return (
    <div className="table-wrap">
      <table className="orders-table">
        <thead>
          <tr>
            {[
              "Order ID",
              "Customer",
              "Destination",
              "Items",
              "Inventory",
              "Shipment",
              "Created",
              "Details",
            ].map((title) => (
              <th key={title}>{title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((order) => (
            <tr
              key={order.id}
              tabIndex={0}
              onKeyDown={(event) => {
                if (["Enter", " "].includes(event.key)) {
                  event.preventDefault()
                  go("order-detail", order.id)
                }
              }}
              onClick={() => go("order-detail", order.id)}
            >
              <td>
                <strong>{order.id}</strong>
              </td>
              <td>
                <strong className="cell-main">{order.customer}</strong>
                <small>{order.customerId}</small>
              </td>
              <td>{order.destination}</td>
              <td>{order.items.reduce((sum, item) => sum + item.qty, 0)}</td>
              <td>
                <Badge tone={tone(order.inventory)}>{order.inventory}</Badge>
              </td>
              <td>
                <Badge tone={tone(order.shipment)}>{order.shipment}</Badge>
              </td>
              <td>{order.date}</td>
              <td>
                <button className="icon-button" aria-label={`View ${order.id}`}>
                  <Icon name="arrow" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Dashboard({ go }: PageProps) {
  const { data } = useWorkspace()
  const { orders, shipments, activity, user } = data
  const waiting = orders.filter((order) => order.shipment !== "Created")
  const inventory = waiting.filter((order) => order.inventory !== "Available")
  const carrier = waiting.filter((order) => order.inventory === "Available")
  const exceptions = orders.filter(
    (order) =>
      ["Unavailable", "WMS unavailable"].includes(order.inventory) ||
      order.carrierOutcome === "unknown",
  )
  const breakdown = [
    {
      label: "Delivered",
      count: shipments.filter((row) => row.status === "Delivered").length,
      color: "var(--chart-delivered)",
    },
    {
      label: "In transit",
      count: shipments.filter((row) => row.status === "In transit").length,
      color: "var(--chart-transit)",
    },
    {
      label: "Label created",
      count: shipments.filter((row) => row.status === "Label created").length,
      color: "var(--chart-label)",
    },
    {
      label: "Exception",
      count: shipments.filter((row) => row.status === "Delivery exception")
        .length,
      color: "var(--chart-exception)",
    },
  ]
  let start = 0
  const chart = breakdown
    .map((row) => {
      const end = start + (row.count / (shipments.length || 1)) * 100
      const result = `${row.color} ${start}% ${end}%`
      start = end
      return result
    })
    .join(", ")
  return (
    <>
      <PageHead
        title="Operations overview"
        featured
        description="Your saved orders, shipments, and exceptions. One connected workspace."
      >
        {operate(user.role) && (
          <Button icon="plus" onClick={() => go("create-order")}>
            Create order
          </Button>
        )}
      </PageHead>
      <div className="demo-strip">
        <Icon name="info" size={17} />
        <strong>Persistent workspace</strong>
        <span>
          Database records · Carrier, WMS and OMS simulations · Asia/Manila
        </span>
      </div>
      <div className="stats-grid">
        <StatCard
          label="Awaiting processing"
          value={waiting.length}
          note="Orders without a shipment"
          onClick={() => go("orders")}
        />
        <StatCard
          label="Awaiting inventory"
          value={inventory.length}
          note="Requires inventory confirmation"
          tone="warning"
          onClick={() => go("warehouse")}
        />
        <StatCard
          label="Awaiting carrier"
          value={carrier.length}
          note="Inventory confirmed"
          tone="warning"
          onClick={() => go("orders")}
        />
        <StatCard
          label="Operational exceptions"
          value={exceptions.length}
          note="Shortage, WMS or unknown outcome"
          tone="danger"
          onClick={() =>
            go(user.role === "Administrator" ? "integration" : "orders")
          }
        />
      </div>
      <div className="dashboard-grid">
        <Card className="recent-orders">
          <div className="card-head">
            <div>
              <h2>Recent orders</h2>
              <p>Latest saved records · Select a row to open its details</p>
            </div>
            <button className="text-button" onClick={() => go("orders")}>
              View all <Icon name="arrow" size={16} />
            </button>
          </div>
          {orders.length ? (
            <OrderTable rows={orders.slice(0, 4)} go={go} />
          ) : (
            <EmptyState
              title="No orders yet"
              text="Create an order to begin the workflow."
            />
          )}
        </Card>
        <Card className="attention-card">
          <div className="card-head">
            <div>
              <h2>Needs attention</h2>
              <p>Review these saved exceptions</p>
            </div>
            <Badge tone="warning">{exceptions.length} orders</Badge>
          </div>
          <div className="attention-list">
            {exceptions.slice(0, 3).map((order) => (
              <button
                key={order.id}
                onClick={() => go("order-detail", order.id)}
              >
                <span className="attention-icon warning">
                  <Icon name="alert" />
                </span>
                <span>
                  <strong>
                    {order.carrierOutcome === "unknown"
                      ? "Carrier outcome unknown"
                      : order.inventory}
                  </strong>
                  <small>
                    {order.id} · {order.destination}
                  </small>
                </span>
                <Icon name="arrow" size={16} />
              </button>
            ))}
            {!exceptions.length && <p>No unresolved order exceptions.</p>}
            {shipments
              .filter((row) => row.sync === "Pending")
              .slice(0, 1)
              .map((row) => (
                <button
                  key={row.id}
                  onClick={() => go("shipment-detail", row.id)}
                >
                  <span className="attention-icon warning">
                    <Icon name="refresh" />
                  </span>
                  <span>
                    <strong>OMS synchronization pending</strong>
                    <small>{row.id}</small>
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
          </div>
        </Card>
        <Card className="shipment-status-card">
          <div className="card-head">
            <div>
              <h2>Shipment status</h2>
              <p>All {shipments.length} saved shipments</p>
            </div>
          </div>
          <div className="donut-row">
            <div
              className="donut"
              style={{
                background: shipments.length
                  ? `conic-gradient(${chart})`
                  : "var(--border)",
              }}
              role="img"
              aria-label={`${shipments.length} shipments. ${breakdown.map((row) => `${row.label}: ${row.count}`).join(", ")}.`}
            >
              <span>
                <strong>{shipments.length}</strong>
                <small>Shipments</small>
              </span>
            </div>
            <div className="shipment-breakdown">
              {breakdown.map((row) => (
                <div className="distribution-row" key={row.label}>
                  <div>
                    <span>{row.label}</span>
                    <strong>
                      {row.count}{" "}
                      <small>
                        {Math.round(
                          (row.count / (shipments.length || 1)) * 100,
                        )}
                        %
                      </small>
                    </strong>
                  </div>
                  <div className="distribution-track" aria-hidden="true">
                    <span
                      style={{
                        width: `${(row.count / (shipments.length || 1)) * 100}%`,
                        background: row.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card className="connection-panel">
          <div className="card-head">
            <div>
              <h2>System connections</h2>
              <p>Local API with simulated service adapters</p>
            </div>
          </div>
          <div className="connections">
            {["Workspace database", "WMS adapter", "Carrier / OMS adapter"].map(
              (label, index) => (
                <div key={label}>
                  <span className={`system-logo s${index}`}>{label[0]}</span>
                  <span>
                    <strong>{label}</strong>
                    <small>
                      {index
                        ? "No external service connected"
                        : "SQLite persistence"}
                    </small>
                  </span>
                  <Badge tone={index ? "neutral" : "success"}>
                    {index ? "Simulation" : "Connected"}
                  </Badge>
                </div>
              ),
            )}
          </div>
        </Card>
        <Card className="activity-summary">
          <div className="card-head">
            <div>
              <h2>Recent activity</h2>
              <p>Latest saved actions</p>
            </div>
          </div>
          <div className="mini-timeline">
            {activity.slice(0, 4).map((event) => (
              <div key={event.id}>
                <i className={event.tone === "warning" ? "warn" : ""} />
                <span>
                  <strong>{event.title}</strong>
                  <small>
                    {event.reference} · {date(event.createdAt)}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

export function Orders({ go, initialSearch = "" }: SearchPageProps) {
  const { data } = useWorkspace()
  const [search, setSearch] = useState(initialSearch)
  const [filter, setFilter] = useState("All inventory states")
  const [sort, setSort] = useState("newest")
  const rows = data.orders
    .filter(
      (order) =>
        `${order.id} ${order.customer} ${order.destination}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (filter === "All inventory states" || order.inventory === filter),
    )
    .sort((a, b) =>
      sort === "newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    )
  return (
    <>
      <PageHead
        title="Orders"
        section="orders"
        description="Manage customer orders from acceptance through shipment."
      >
        {operate(data.user.role) && (
          <Button icon="plus" onClick={() => go("create-order")}>
            Create order
          </Button>
        )}
      </PageHead>
      <Card>
        <div className="toolbar">
          <Search
            label="Search orders"
            value={search}
            onChange={setSearch}
            placeholder="e.g. ORD-1001 or Tarlac"
          />
          <label className="select-label">
            Inventory{" "}
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {[
                "All inventory states",
                "Not checked",
                "Available",
                "Unavailable",
                "WMS unavailable",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="select-label">
            Sort by{" "}
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
        {rows.length ? (
          <OrderTable rows={rows} go={go} />
        ) : (
          <EmptyState
            title="No matching orders"
            text="Try clearing your search or inventory filter."
          />
        )}
        <Count count={rows.length} label="orders" />
      </Card>
    </>
  )
}

export function CreateOrder({ go }: PageProps) {
  const { data, mutate } = useWorkspace()
  const action = useAction()
  const [step, setStep] = useState(1)
  const [orderId, setOrderId] = useState("")
  const [customerId, setCustomerId] = useState("CUS-001")
  const [customer, setCustomer] = useState("")
  const [destination, setDestination] = useState("")
  const [items, setItems] = useState([{ sku: "BOX-001", quantity: "2" }])
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  if (!operate(data.user.role)) return <AccessDenied go={go} />
  const next = () => {
    if (
      step === 1 &&
      (!/^[A-Z0-9_-]{1,64}$/.test(orderId) ||
        !/^[A-Za-z0-9_-]{1,64}$/.test(customerId) ||
        !destination.trim())
    ) {
      setError(
        "Enter an order ID, customer ID, and destination. IDs use letters, numbers, underscores, or hyphens.",
      )
      return
    }
    if (step === 1 && data.orders.some((row) => row.id === orderId)) {
      setError("Order ID already exists. Choose a unique ID.")
      return
    }
    if (
      step === 2 &&
      (items.some(
        (item) =>
          !/^[1-9]\d*$/.test(item.quantity) || Number(item.quantity) > 1000000,
      ) ||
        new Set(items.map((item) => item.sku)).size !== items.length)
    ) {
      setError(
        "Use positive whole quantities up to 1,000,000, and combine duplicate SKUs.",
      )
      return
    }
    setError("")
    setStep(step + 1)
  }
  const submit = () =>
    action.run(async () => {
      await mutate<{ order: OrderRecord }>("v1/orders", {
        orderId,
        customerId,
        customer,
        destination,
        items: items.map((item) => ({
          sku: item.sku,
          quantity: Number(item.quantity),
        })),
      })
      setSubmitted(true)
    })
  if (submitted)
    return (
      <>
        <PageHead
          title="Order created"
          section="orders"
          description="Accepted and saved in the workspace database."
        />
        <Card className="success-panel">
          <span className="success-mark">
            <Icon name="check" size={28} />
          </span>
          <h2>{orderId} accepted</h2>
          <p>
            The order is saved. Check inventory before preparing its shipment.
          </p>
          <div className="review-block">
            <div>
              <small>Customer</small>
              <strong>{customer || customerId}</strong>
            </div>
            <div>
              <small>Destination</small>
              <strong>{destination}</strong>
            </div>
            <div>
              <small>Items</small>
              <strong>
                {items
                  .map((item) => `${item.sku} × ${item.quantity}`)
                  .join(", ")}
              </strong>
            </div>
          </div>
          <div className="card-actions">
            <Button kind="secondary" onClick={() => go("orders")}>
              Return to orders
            </Button>
            <Button onClick={() => go("order-detail", orderId)}>
              Open order
            </Button>
          </div>
        </Card>
      </>
    )
  return (
    <>
      <PageHead
        title="Create order"
        section="orders"
        description="Submit a customer order to the saved integration workflow."
        back={() => go("orders")}
      />
      <div className="stepper">
        {["Customer and destination", "Order items", "Review and submit"].map(
          (label, index) => (
            <div
              key={label}
              className={step > index ? "active" : ""}
              aria-current={step === index + 1 ? "step" : undefined}
            >
              <span>{index + 1}</span>
              <strong>{label}</strong>
            </div>
          ),
        )}
      </div>
      <div className="form-layout">
        <Card className="form-card">
          <Feedback action={action} />
          {error && (
            <div className="alert danger" role="alert">
              {error}
            </div>
          )}
          <div className="state-panel" key={step}>
            <div className="section-title">
              <span>{step}</span>
              <div>
                <h2>
                  {
                    [
                      "Customer and destination",
                      "Order items",
                      "Review and submit",
                    ][step - 1]
                  }
                </h2>
                <p>
                  {step === 3
                    ? "Confirm these details before saving."
                    : "Required fields are marked with an asterisk."}
                </p>
              </div>
            </div>
            {step === 1 ? (
              <div className="form-grid">
                <label>
                  <span>
                    Order ID <b>*</b>
                  </span>
                  <input
                    id="order-orderId"
                    value={orderId}
                    maxLength={64}
                    onChange={(event) =>
                      setOrderId(event.target.value.toUpperCase())
                    }
                    placeholder="e.g. ORD-1010"
                  />
                </label>
                <label>
                  <span>
                    Customer ID <b>*</b>
                  </span>
                  <input
                    id="order-customerId"
                    value={customerId}
                    maxLength={64}
                    onChange={(event) => setCustomerId(event.target.value)}
                  />
                </label>
                <label>
                  <span>Customer display name</span>
                  <input
                    value={customer}
                    maxLength={200}
                    onChange={(event) => setCustomer(event.target.value)}
                  />
                </label>
                <label>
                  <span>
                    Destination <b>*</b>
                  </span>
                  <input
                    id="order-destination"
                    value={destination}
                    maxLength={200}
                    onChange={(event) => setDestination(event.target.value)}
                    placeholder="City or delivery destination"
                  />
                </label>
              </div>
            ) : step === 2 ? (
              <>
                {items.map((item, index) => (
                  <div className="order-editor-item" key={index}>
                    <div className="item-header">
                      <strong>Item {index + 1}</strong>
                      <button
                        className="text-button danger-text"
                        disabled={items.length === 1}
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== index))
                        }
                      >
                        Remove item {index + 1}
                      </button>
                    </div>
                    <div className="form-grid">
                      <label>
                        <span>
                          SKU <b>*</b>
                        </span>
                        <select
                          aria-label={`SKU ${index + 1}`}
                          value={item.sku}
                          onChange={(event) =>
                            setItems(
                              items.map((value, i) =>
                                i === index
                                  ? { ...value, sku: event.target.value }
                                  : value,
                              ),
                            )
                          }
                        >
                          {data.inventory.map((product) => (
                            <option key={product.sku} value={product.sku}>
                              {product.sku} · {product.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>
                          Quantity <b>*</b>
                        </span>
                        <input
                          aria-label={`Quantity ${index + 1}`}
                          value={item.quantity}
                          inputMode="numeric"
                          maxLength={7}
                          onChange={(event) =>
                            setItems(
                              items.map((value, i) =>
                                i === index
                                  ? { ...value, quantity: event.target.value }
                                  : value,
                              ),
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <Button
                  kind="secondary"
                  icon="plus"
                  disabled={items.length >= data.inventory.length}
                  onClick={() =>
                    setItems([
                      ...items,
                      {
                        sku:
                          data.inventory.find(
                            (product) =>
                              !items.some((item) => item.sku === product.sku),
                          )?.sku || "BOX-001",
                        quantity: "1",
                      },
                    ])
                  }
                >
                  Add item
                </Button>
              </>
            ) : (
              <>
                <div className="review-block">
                  <div>
                    <small>Order</small>
                    <strong>{orderId}</strong>
                  </div>
                  <div>
                    <small>Customer</small>
                    <strong>{customer || customerId}</strong>
                    <span>{customerId}</span>
                  </div>
                  <div>
                    <small>Destination</small>
                    <strong>{destination}</strong>
                  </div>
                </div>
                {items.map((item) => (
                  <div className="review-item" key={item.sku}>
                    <span className="product-icon">
                      <Icon name="box" />
                    </span>
                    <strong>{item.sku}</strong>
                    <span>Quantity {item.quantity}</span>
                  </div>
                ))}
                <div className="hint">
                  Inventory checks and shipment creation are separate steps
                  after acceptance.
                </div>
              </>
            )}
          </div>
          <div className="form-footer">
            <Button
              kind="secondary"
              disabled={action.busy}
              onClick={() => (step === 1 ? go("orders") : setStep(step - 1))}
            >
              {step === 1 ? "Cancel" : "Previous"}
            </Button>
            {step < 3 ? (
              <Button onClick={next}>Continue</Button>
            ) : (
              <Button disabled={action.busy} onClick={() => void submit()}>
                {action.busy ? "Saving order…" : "Submit order"}
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
              <dd>{items.length} SKU(s)</dd>
            </div>
          </dl>
          <h3>Before you submit</h3>
          <p>
            Use a unique order ID and known warehouse products. The server
            validates every order before saving.
          </p>
        </aside>
      </div>
    </>
  )
}

export function OrderDetail({ go }: PageProps) {
  const { data, orderId, mutate } = useWorkspace()
  const order = data.orders.find((row) => row.id === orderId)
  const action = useAction()
  if (!order)
    return (
      <EmptyState
        title="Order not found"
        text="Choose a saved order from the Orders page."
      />
    )
  const shipment = data.shipments.find((row) => row.orderId === order.id)
  const prep = order.preparation
  return (
    <>
      <PageHead
        title={`Order ${order.id}`}
        section="orders"
        description={`Accepted ${order.date} PHT`}
        back={() => go("orders")}
      >
        <Button kind="secondary" onClick={() => go("activity")}>
          View activity
        </Button>
        <Button onClick={() => go("preparation", order.id)}>
          Open preparation
        </Button>
      </PageHead>
      <Feedback action={action} />
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Order summary</h2>
                <p>Saved customer and delivery information</p>
              </div>
              <Badge tone="success">Accepted</Badge>
            </div>
            <div className="summary-grid">
              <div>
                <small>Customer</small>
                <strong>{order.customer}</strong>
                <span>{order.customerId}</span>
              </div>
              <div>
                <small>Destination</small>
                <strong>{order.destination}</strong>
              </div>
              <div>
                <small>Created</small>
                <strong>{order.date}</strong>
                <span>Asia/Manila</span>
              </div>
              <div>
                <small>Source</small>
                <strong>TranceLogix API</strong>
              </div>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Order items</h2>
                <p>{order.items.length} SKU(s)</p>
              </div>
            </div>
            {order.items.map((item) => (
              <div className="items-table" key={item.sku}>
                <span className="product-icon">
                  <Icon name="box" />
                </span>
                <span>
                  <strong>{item.sku}</strong>
                  <small>{item.name}</small>
                </span>
                <span>
                  <small>Requested quantity</small>
                  <strong>{item.qty}</strong>
                </span>
              </div>
            ))}
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Inventory check</h2>
                <p>Simulated WMS availability</p>
              </div>
              <Badge tone={tone(order.inventory)}>{order.inventory}</Badge>
            </div>
            <p>
              Checks the requested quantities against the saved warehouse stock.
              This does not reserve or deduct stock.
            </p>
            <div className="card-actions">
              <Button
                kind="secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await mutate("v1/inventory/check", { orderId: order.id })
                  }, "Inventory check saved.")
                }
              >
                {action.busy ? "Checking…" : "Check inventory"}
              </Button>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Warehouse preparation</h2>
                <p>Last saved progress</p>
              </div>
            </div>
            <div className="task-list">
              <span className={prep.picked ? "done" : ""}>
                <Icon name={prep.picked ? "check" : "clock"} />
                {prep.picked ? "All items picked" : "Picking incomplete"}
              </span>
              <span className={prep.packed ? "done" : ""}>
                <Icon name={prep.packed ? "check" : "clock"} />
                {prep.packed ? "Packed" : "Packing incomplete"}
              </span>
              <span>
                {prep.weight ? `${prep.weight} kg` : "Weight not recorded"}
              </span>
              {prep.shortage && <Badge tone="danger">Shortage flagged</Badge>}
            </div>
          </Card>
        </div>
        <aside className="detail-side">
          <Card className="next-action">
            <small>Next action</small>
            <h3>
              {shipment
                ? "Shipment available"
                : order.inventory === "Available"
                  ? "Review package preparation"
                  : "Confirm inventory"}
            </h3>
            <p>
              {shipment
                ? "Open the linked shipment and its saved tracking information."
                : "Inventory, picking, packing, weight, and shortage checks must pass before shipment creation."}
            </p>
            <div className="card-actions">
              <Button
                onClick={() =>
                  shipment
                    ? go("shipment-detail", shipment.id)
                    : go("preparation", order.id)
                }
              >
                {shipment ? "View shipment" : "Open preparation"}
              </Button>
            </div>
          </Card>
          {shipment && (
            <Card>
              <h2>{shipment.id}</h2>
              <p>{shipment.carrier}</p>
              <strong>{shipment.tracking}</strong>
              <p>{shipment.fee}</p>
              <Badge tone={tone(shipment.status)}>{shipment.status}</Badge>
            </Card>
          )}
          {order.carrierOutcome === "unknown" && (
            <div className="alert warning">
              <Icon name="alert" />
              <p>
                Carrier outcome unknown. Check the idempotency reference before
                retrying creation.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

export function Warehouse({ go, initialSearch = "" }: SearchPageProps) {
  const { data } = useWorkspace()
  const [tab, setTab] = useState("Inventory")
  const [query, setQuery] = useState(initialSearch)
  const inventory = data.inventory.filter((row) =>
    `${row.sku} ${row.name}`.toLowerCase().includes(query.toLowerCase()),
  )
  const orders = data.orders.filter((row) =>
    `${row.id} ${row.destination} ${row.items.map((item) => item.sku).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHead
        title="Warehouse"
        section="warehouse"
        description="Saved warehouse products and order preparation progress."
      />
      <div className="tabs" role="group" aria-label="Warehouse views">
        {["Inventory", "Preparation queue"].map((value) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value)
              setQuery("")
            }}
          >
            {value}{" "}
            <span>
              {value === "Inventory"
                ? data.inventory.length
                : data.orders.length}
            </span>
          </button>
        ))}
      </div>
      <Card>
        <div className="toolbar">
          <Search
            label="Search warehouse records"
            value={query}
            onChange={setQuery}
            placeholder={tab === "Inventory" ? "e.g. BOX-001" : "e.g. ORD-1001"}
          />
        </div>
        <div className="table-wrap state-panel" key={tab}>
          {tab === "Inventory" ? (
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>Saved stock</th>
                  <th>Availability</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((product) => (
                  <tr key={product.sku}>
                    <td>
                      <strong>{product.sku}</strong>
                    </td>
                    <td>{product.name}</td>
                    <td>{product.stock}</td>
                    <td>
                      <Badge tone={product.stock > 0 ? "success" : "danger"}>
                        {product.stock > 0 ? "Available" : "Unavailable"}
                      </Badge>
                    </td>
                    <td>Simulated WMS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Destination</th>
                  <th>Inventory</th>
                  <th>Preparation</th>
                  <th>Weight</th>
                  <th>Next action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.id}</strong>
                    </td>
                    <td>{order.destination}</td>
                    <td>
                      <Badge tone={tone(order.inventory)}>
                        {order.inventory}
                      </Badge>
                    </td>
                    <td>
                      {order.preparation.shortage
                        ? "Shortage flagged"
                        : order.preparation.packed
                          ? "Packed"
                          : order.preparation.picked
                            ? "Picked"
                            : "Not started"}
                    </td>
                    <td>
                      {order.preparation.weight
                        ? `${order.preparation.weight} kg`
                        : "—"}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => go("preparation", order.id)}
                      >
                        Open preparation <Icon name="arrow" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!(tab === "Inventory" ? inventory.length : orders.length) && (
          <EmptyState
            title="No matching records"
            text="Try another order or product reference."
          />
        )}
        <Count
          count={tab === "Inventory" ? inventory.length : orders.length}
          label="records"
        />
      </Card>
    </>
  )
}

export function Preparation({ go }: PageProps) {
  const { data, orderId, mutate } = useWorkspace()
  const order = data.orders.find((row) => row.id === orderId)
  const [picked, setPicked] = useState(order?.preparation.picked || false)
  const [packed, setPacked] = useState(order?.preparation.packed || false)
  const [weight, setWeight] = useState(String(order?.preparation.weight ?? ""))
  const [notes, setNotes] = useState(order?.preparation.notes || "")
  const [shortage, setShortage] = useState(order?.preparation.shortage || false)
  const action = useAction()
  if (!order)
    return (
      <EmptyState
        title="Order not found"
        text="Choose a saved order from the preparation queue."
      />
    )
  const shipment = data.shipments.find((row) => row.orderId === order.id)
  const weightValid =
    Number.isFinite(Number(weight)) &&
    Number(weight) > 0 &&
    Number(weight) <= 10000
  const valid =
    picked &&
    packed &&
    weightValid &&
    !shortage &&
    order.inventory === "Available"
  const completed = Number(picked) + Number(packed) + Number(weightValid)
  const save = async () => {
    await mutate(
      `v1/orders/${encodeURIComponent(order.id)}/preparation`,
      {
        picked,
        packed,
        weight: weight ? Number(weight) : null,
        notes,
        shortage,
      },
      "PUT",
    )
  }
  const continueShipment = () =>
    action.run(async () => {
      await save()
      go("create-shipment", order.id)
    })
  return (
    <>
      <PageHead
        title={`Prepare order ${order.id}`}
        section="warehouse"
        description={
          shipment
            ? "Preparation is locked because this order has a shipment."
            : "Save picking, packing, and package details."
        }
        back={() => go("warehouse")}
      >
        <Button kind="secondary" onClick={() => go("order-detail", order.id)}>
          View order
        </Button>
        {shipment ? (
          <Button onClick={() => go("shipment-detail", shipment.id)}>
            View shipment
          </Button>
        ) : (
          <Button
            disabled={!valid || action.busy || !operate(data.user.role)}
            onClick={() => void continueShipment()}
          >
            Continue to shipment
          </Button>
        )}
      </PageHead>
      <Feedback action={action} />
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Destination and inventory</h2>
                <p>
                  {order.customer} · {order.destination}
                </p>
              </div>
              <Badge tone={tone(order.inventory)}>{order.inventory}</Badge>
            </div>
            <p>
              Inventory must be confirmed available before shipment creation.
            </p>
            <Button
              kind="secondary"
              disabled={action.busy || Boolean(shipment)}
              onClick={() =>
                void action.run(async () => {
                  await mutate("v1/inventory/check", { orderId: order.id })
                }, "Inventory check saved.")
              }
            >
              Check inventory
            </Button>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Item checklist</h2>
                <p>Verify all requested items before confirming picking</p>
              </div>
              <span className="progress-text">
                {picked ? "All items picked" : "Picking incomplete"}
              </span>
            </div>
            {order.items.map((item) => (
              <div className="items-table" key={item.sku}>
                <span className="product-icon">
                  <Icon name="box" />
                </span>
                <span>
                  <strong>{item.sku}</strong>
                  <small>{item.name}</small>
                </span>
                <strong>{item.qty} units</strong>
              </div>
            ))}
            <label className="checklist-item">
              <input
                type="checkbox"
                checked={picked}
                disabled={Boolean(shipment)}
                onChange={(event) => setPicked(event.target.checked)}
              />
              <strong>All requested items are picked</strong>
            </label>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Packing and package details</h2>
                <p>Required before creating a shipment</p>
              </div>
            </div>
            <label className="packing-check">
              <input
                type="checkbox"
                checked={packed}
                disabled={Boolean(shipment)}
                onChange={(event) => setPacked(event.target.checked)}
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
                    value={weight}
                    disabled={Boolean(shipment)}
                    aria-invalid={Boolean(weight) && !weightValid}
                    inputMode="decimal"
                    maxLength={12}
                    onChange={(event) => setWeight(event.target.value)}
                  />
                  <span>kg</span>
                </div>
                {Boolean(weight) && !weightValid && (
                  <em>Enter a positive weight up to 10,000 kg.</em>
                )}
              </label>
              <label>
                <span>Warehouse notes</span>
                <input
                  value={notes}
                  disabled={Boolean(shipment)}
                  maxLength={1000}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional handling notes"
                />
              </label>
            </div>
            <label className="shortage-check">
              <input
                type="checkbox"
                checked={shortage}
                disabled={Boolean(shipment)}
                onChange={(event) => setShortage(event.target.checked)}
              />
              <span>
                <strong>Flag an inventory shortage</strong>
                <small>Saved shortages block shipment creation.</small>
              </span>
            </label>
          </Card>
          {!shipment && (
            <div className="footer-actions">
              <Button
                kind="secondary"
                className="action-cancel"
                onClick={() => go("warehouse")}
              >
                Cancel
              </Button>
              <Button
                kind="secondary"
                disabled={action.busy || (Boolean(weight) && !weightValid)}
                onClick={() =>
                  void action.run(save, "Preparation progress saved.")
                }
              >
                {action.busy ? "Saving…" : "Save progress"}
              </Button>
              <Button
                disabled={!valid || action.busy || !operate(data.user.role)}
                onClick={() => void continueShipment()}
              >
                Continue to shipment
              </Button>
            </div>
          )}
        </div>
        <aside className="detail-side">
          <Card>
            <h2>Preparation status</h2>
            <div
              className="completion"
              role="progressbar"
              aria-label="Preparation tasks completed"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={completed}
              aria-valuetext={`${completed} of 3 complete${
                shortage ? "; shortage flagged" : ""
              }`}
            >
              <div style={{ width: `${(completed / 3) * 100}%` }} />
              <span>{completed} of 3 complete</span>
            </div>
            <div className="task-list">
              <span className={picked ? "done" : ""}>Items picked</span>
              <span className={packed ? "done" : ""}>Package packed</span>
              <span className={weightValid ? "done" : ""}>Weight recorded</span>
            </div>
          </Card>
          <Card className="next-action">
            <small>Shipment prerequisite</small>
            <h3>
              {shipment
                ? "Shipment already exists"
                : valid
                  ? "Ready to create shipment"
                  : "Preparation incomplete"}
            </h3>
            <p>
              {shipment
                ? "The saved package record is retained with its shipment."
                : "Complete preparation and inventory confirmation, then save before creating a shipment."}
            </p>
            {!operate(data.user.role) && (
              <p>
                Operations staff or an administrator must create the shipment.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </>
  )
}

export function CreateShipment({ go }: PageProps) {
  const { data, orderId, mutate, refresh } = useWorkspace()
  const order = data.orders.find((row) => row.id === orderId)
  const [carrier, setCarrier] = useState("LBC Express")
  const [simulation, setSimulation] = useState("success")
  const [created, setCreated] = useState<ShipmentRecord | null>(null)
  const action = useAction()
  if (!order)
    return (
      <EmptyState
        title="Order not found"
        text="Choose a saved order before creating a shipment."
      />
    )
  if (!operate(data.user.role)) return <AccessDenied go={go} />
  const existing = data.shipments.find((row) => row.orderId === order.id)
  const prep = order.preparation
  const unknown = order.carrierOutcome === "unknown"
  const valid =
    order.inventory === "Available" &&
    prep.picked &&
    prep.packed &&
    Boolean(prep.weight) &&
    !prep.shortage &&
    !unknown &&
    !existing
  const create = () =>
    action.run(async () => {
      try {
        const result = await mutate<{ shipment: ShipmentRecord }>(
          "v1/shipments",
          { orderId: order.id, carrier, simulation },
        )
        setCreated(result.shipment)
      } catch (cause) {
        await refresh()
        throw cause
      }
    })
  if (created)
    return (
      <>
        <PageHead
          title="Shipment created"
          section="shipments"
          description={`Saved simulated carrier confirmation for ${order.id}.`}
        />
        <Card className="success-panel">
          <span className="success-mark">
            <Icon name="check" size={28} />
          </span>
          <h2>Carrier shipment confirmed</h2>
          <p>
            Simulated carrier booking saved. Confirmation does not mean
            dispatch.
          </p>
          <div className="success-details">
            <div>
              <small>Shipment reference</small>
              <strong>{created.id}</strong>
            </div>
            <div>
              <small>Tracking number</small>
              <strong>{created.tracking}</strong>
            </div>
            <div>
              <small>Shipping fee</small>
              <strong>{created.fee}</strong>
            </div>
            <div>
              <small>OMS synchronization</small>
              <Badge tone={tone(created.sync)}>{created.sync}</Badge>
            </div>
          </div>
          <div className="card-actions">
            <Button
              kind="secondary"
              onClick={() => go("order-detail", order.id)}
            >
              Return to order
            </Button>
            <Button onClick={() => go("shipment-detail", created.id)}>
              View shipment
            </Button>
          </div>
        </Card>
      </>
    )
  return (
    <>
      <PageHead
        title="Create shipment"
        section="shipments"
        description={`Persistent shipment workflow for ${order.id} · Simulated carrier adapter`}
        back={() => go("preparation", order.id)}
      />
      <Feedback action={action} />
      <div className="form-layout">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Eligibility checks</h2>
                <p>The server verifies these prerequisites on submission</p>
              </div>
              <Badge tone={valid ? "success" : "warning"}>
                {valid ? "Eligible" : "Action required"}
              </Badge>
            </div>
            <div className="eligibility">
              {[
                [
                  order.inventory === "Available",
                  "Inventory confirmed",
                  order.inventory,
                ],
                [
                  prep.picked &&
                    prep.packed &&
                    Boolean(prep.weight) &&
                    !prep.shortage,
                  "Package ready",
                  `${prep.weight || "No"} kg recorded`,
                ],
                [
                  !existing,
                  "No existing shipment",
                  existing?.id || "No shipment saved",
                ],
                [
                  !unknown,
                  "Carrier outcome resolved",
                  unknown
                    ? "Check before retrying"
                    : "Safe to evaluate creation",
                ],
              ].map(([passed, title, detail]) => (
                <div key={String(title)}>
                  <Icon name={passed ? "check" : "alert"} />
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                </div>
              ))}
            </div>
            {existing && (
              <Button onClick={() => go("shipment-detail", existing.id)}>
                View existing shipment
              </Button>
            )}
            {unknown && (
              <Button
                kind="secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(async () => {
                    await mutate("v1/carrier/check", { orderId: order.id })
                  }, "Simulation confirmed no shipment exists. You may retry with the saved reference.")
                }
              >
                Check carrier status
              </Button>
            )}
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Shipment request</h2>
                <p>
                  {order.id} · {order.destination}
                </p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                <span>Carrier</span>
                <select
                  value={carrier}
                  onChange={(event) => setCarrier(event.target.value)}
                >
                  {["LBC Express", "J&T Express", "2GO Express"].map(
                    (value) => (
                      <option key={value}>{value}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <span>Simulation outcome</span>
                <select
                  value={simulation}
                  onChange={(event) => setSimulation(event.target.value)}
                >
                  <option value="success">Successful confirmation</option>
                  <option value="timeout">
                    Carrier timeout (unknown outcome)
                  </option>
                  <option value="unavailable">Carrier unavailable</option>
                  <option value="sync_failure">
                    Confirmed, OMS synchronization fails
                  </option>
                </select>
              </label>
            </div>
            <div className="hint">
              This books no real delivery. Saved idempotency reference:
              shipment:{order.id}
            </div>
          </Card>
          <div className="footer-actions">
            <Button
              kind="secondary"
              className="action-cancel"
              onClick={() => go("preparation", order.id)}
            >
              Back to preparation
            </Button>
            <Button
              disabled={!valid || action.busy}
              onClick={() => void create()}
            >
              {action.busy ? "Creating shipment…" : "Create shipment"}
            </Button>
          </div>
        </div>
        <aside className="detail-side">
          <Card className="next-action">
            <small>Duplicate protection</small>
            <h3>One shipment per order</h3>
            <p>
              A repeated request returns its saved shipment. Unknown outcomes
              require a carrier status check before another attempt.
            </p>
            <p>
              If OMS synchronization fails, retain the shipment and retry
              synchronization only.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}

export function Shipments({ go, initialSearch = "" }: SearchPageProps) {
  const { data } = useWorkspace()
  const [query, setQuery] = useState(initialSearch)
  const [status, setStatus] = useState("All statuses")
  const rows = data.shipments.filter(
    (row) =>
      Object.values(row)
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "All statuses" || row.status === status),
  )
  return (
    <>
      <PageHead
        title="Shipments"
        section="shipments"
        description="Saved carrier confirmations, tracking references, and synchronization states."
      />
      <Card>
        <div className="toolbar">
          <Search
            label="Search shipments"
            value={query}
            onChange={setQuery}
            placeholder="e.g. SHP-5012 or TRK-123456"
          />
          <label className="select-label">
            Status{" "}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {[
                "All statuses",
                "Label created",
                "In transit",
                "Delivered",
                "Delivery exception",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Shipment",
                    "Order",
                    "Carrier",
                    "Tracking",
                    "Destination",
                    "Fee",
                    "Status",
                    "OMS sync",
                    "Details",
                  ].map((value) => (
                    <th key={value}>{value}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => go("shipment-detail", row.id)}
                    onKeyDown={(event) => {
                      if (["Enter", " "].includes(event.key)) {
                        event.preventDefault()
                        go("shipment-detail", row.id)
                      }
                    }}
                  >
                    <td>
                      <strong>{row.id}</strong>
                    </td>
                    <td>{row.orderId}</td>
                    <td>{row.carrier}</td>
                    <td>{row.tracking}</td>
                    <td>{row.destination}</td>
                    <td>{row.fee}</td>
                    <td>
                      <Badge tone={tone(row.status)}>{row.status}</Badge>
                    </td>
                    <td>
                      <Badge tone={tone(row.sync)}>{row.sync}</Badge>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`View ${row.id}`}
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
            title="No matching shipments"
            text="Try another reference or clear the status filter."
          />
        )}
        <Count count={rows.length} label="shipments" />
      </Card>
    </>
  )
}

export function ShipmentDetail({ go }: PageProps) {
  const { data, shipmentId, mutate } = useWorkspace()
  const shipment = data.shipments.find((row) => row.id === shipmentId)
  const action = useAction()
  if (!shipment)
    return (
      <EmptyState
        title="Shipment not found"
        text="Choose a saved shipment from the Shipments page."
      />
    )
  return (
    <>
      <PageHead
        title={`Shipment ${shipment.id}`}
        section="shipments"
        description={`Linked to ${shipment.orderId} · Simulated carrier confirmation`}
        back={() => go("shipments")}
      >
        <Button
          kind="secondary"
          onClick={() => go("order-detail", shipment.orderId)}
        >
          View order
        </Button>
        <Button onClick={() => go("tracking", shipment.id)}>
          Track shipment
        </Button>
      </PageHead>
      <Feedback action={action} />
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="card-head">
              <div>
                <h2>Shipment information</h2>
                <p>Saved carrier response</p>
              </div>
              <Badge tone={tone(shipment.status)}>{shipment.status}</Badge>
            </div>
            <div className="summary-grid">
              {[
                ["Carrier", shipment.carrier],
                ["Tracking number", shipment.tracking],
                ["Destination", shipment.destination],
                ["Shipping fee", shipment.fee],
                ["Created", date(shipment.createdAt)],
                ["Updated", date(shipment.updatedAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="hint">
              Confirmation does not mean dispatch. Carrier events in this
              workspace are simulated.
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>OMS synchronization</h2>
                <p>The existing shipment is retained during recovery</p>
              </div>
              <Badge tone={tone(shipment.sync)}>{shipment.sync}</Badge>
            </div>
            <p>
              {shipment.sync === "Pending"
                ? "Retry synchronization using this shipment and tracking number. Do not create another shipment."
                : "The simulated OMS record is synchronized."}
            </p>
            <div className="card-actions">
              <Button
                kind="secondary"
                disabled={
                  action.busy ||
                  shipment.sync !== "Pending" ||
                  !operate(data.user.role)
                }
                onClick={() =>
                  void action.run(async () => {
                    await mutate(
                      `v1/shipments/${encodeURIComponent(shipment.id)}/sync`,
                      {},
                    )
                  }, "OMS is up to date. The existing shipment was retained.")
                }
              >
                {action.busy ? "Synchronizing…" : "Retry synchronization"}
              </Button>
            </div>
          </Card>
        </div>
        <aside className="detail-side">
          <Card className="next-action">
            <small>Request reference</small>
            <h3>Duplicate protection</h3>
            <p className="record-reference">{shipment.idempotencyKey}</p>
            <p>
              Repeated creation requests for the same order return this
              shipment.
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}

export function Tracking({
  go,
  initialQuery,
}: PageProps & { initialQuery?: string }) {
  const { data, shipmentId } = useWorkspace()
  const initial =
    initialQuery ||
    data.shipments.find((row) => row.id === shipmentId)?.tracking ||
    "TRK-123456"
  const [query, setQuery] = useState(initial)
  const [result, setResult] = useState<{
    shipment: ShipmentRecord
    activity: ActivityRecord[]
  } | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  async function lookup(reference: string, signal?: AbortSignal) {
    setBusy(true)
    setError("")
    try {
      const next = await api<{
        shipment: ShipmentRecord
        activity: ActivityRecord[]
      }>(`v1/tracking?reference=${encodeURIComponent(reference.trim())}`, {
        signal,
      })
      if (!signal?.aborted) setResult(next)
    } catch (cause) {
      if (!signal?.aborted) {
        setError(errorMessage(cause))
        setResult(null)
      }
    } finally {
      if (!signal?.aborted) setBusy(false)
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    void lookup(initial, controller.signal)
    return () => controller.abort()
  }, [initial])
  return (
    <>
      <PageHead
        title="Tracking"
        section="tracking"
        description="Look up saved shipment information by order, shipment, or tracking reference."
      />
      <Card>
        <form
          className="tracking-search"
          onSubmit={(event) => {
            event.preventDefault()
            if (query.trim() && !busy) void lookup(query)
          }}
        >
          <label>
            <span>Tracking reference</span>
            <input
              aria-label="Tracking reference"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              maxLength={100}
              placeholder="e.g. TRK-123456 or ORD-1001"
              required
            />
          </label>
          <button
            className="button primary"
            disabled={busy || !query.trim()}
            type="submit"
          >
            {busy ? "Searching…" : "Search"}
          </button>
        </form>
        <p className="demo-disclosure">
          Saved simulation records · Refresh reads the database and does not
          advance carrier status.
        </p>
      </Card>
      {busy && <p role="status">Loading saved tracking record…</p>}
      {error && (
        <Card>
          <div role="alert">
            <EmptyState title="No matching tracking record" text={error} />
          </div>
        </Card>
      )}
      {result && !busy && (
        <div className="state-panel" key={result.shipment.id}>
          <Card>
            <div className="card-head">
              <div>
                <h2>
                  {result.shipment.status === "In transit"
                    ? "Shipment is on the way"
                    : result.shipment.status}
                </h2>
                <p>
                  {result.shipment.tracking} · {result.shipment.carrier}
                </p>
              </div>
              <Badge tone={tone(result.shipment.status)}>
                {result.shipment.status}
              </Badge>
            </div>
            <div className="summary-grid">
              <div>
                <small>Destination</small>
                <strong>{result.shipment.destination}</strong>
              </div>
              <div>
                <small>Saved update</small>
                <strong>{date(result.shipment.updatedAt)} PHT</strong>
              </div>
            </div>
            <div className="card-actions">
              <Button
                kind="secondary"
                onClick={() => void lookup(result.shipment.tracking)}
              >
                Refresh status
              </Button>
              <Button onClick={() => go("shipment-detail", result.shipment.id)}>
                View shipment
              </Button>
            </div>
          </Card>
          <Card>
            <div className="card-head">
              <div>
                <h2>Saved shipment activity</h2>
                <p>Operational history; no live carrier feed connected</p>
              </div>
            </div>
            {result.activity.length ? (
              <div className="mini-timeline">
                {result.activity.map((event) => (
                  <div key={event.id}>
                    <i />
                    <span>
                      <strong>{event.title}</strong>
                      <small>
                        {date(event.createdAt)} · {event.message}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p>No additional saved events for this shipment.</p>
            )}
          </Card>
        </div>
      )}
    </>
  )
}

export function Integration({ go }: PageProps) {
  const { data } = useWorkspace()
  const [selected, setSelected] = useState<ActivityRecord | null>(null)
  const [query, setQuery] = useState("")
  const [technical, setTechnical] = useState(false)
  const ref = useFocusLayer(Boolean(selected), () => setSelected(null), true)
  if (data.user.role !== "Administrator") return <AccessDenied go={go} />
  const rows = data.activity.filter((event) =>
    `${event.title} ${event.reference} ${event.correlationId}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHead
        title="Integration monitor"
        section="integration"
        description="Persisted operation events with administrator-only technical details."
      />
      <div className="demo-strip">
        <Icon name="info" />
        <span>Carrier, WMS, and OMS adapters run in simulation mode.</span>
      </div>
      <Card>
        <div className="toolbar">
          <Search
            label="Search integration events"
            value={query}
            onChange={setQuery}
            placeholder="e.g. ORD-1001"
          />
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time (PHT)</th>
                <th>Reference</th>
                <th>Event</th>
                <th>Outcome</th>
                <th>Correlation ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr
                  key={event.id}
                  tabIndex={0}
                  onClick={() => {
                    setSelected(event)
                    setTechnical(false)
                  }}
                  onKeyDown={(key) => {
                    if (["Enter", " "].includes(key.key)) {
                      key.preventDefault()
                      setSelected(event)
                      setTechnical(false)
                    }
                  }}
                >
                  <td>{date(event.createdAt)}</td>
                  <td>{event.reference}</td>
                  <td>{event.title}</td>
                  <td>
                    <Badge tone={event.tone}>
                      {event.tone === "success" ? "Saved" : "Review"}
                    </Badge>
                  </td>
                  <td>
                    <span className="correlation-reference">
                      {event.correlationId}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Inspect ${event.title}`}
                    >
                      <Icon name="arrow" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            title="No matching events"
            text="Try another order or correlation reference."
          />
        )}
        <Count count={rows.length} label="events (latest 200)" />
      </Card>
      {selected && (
        <div className="overlay">
          <section
            ref={ref}
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
          >
            <div className="drawer-head">
              <div>
                <small>Saved integration event</small>
                <h2>{selected.title}</h2>
                <p>{selected.reference}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelected(null)}
                aria-label="Close event details"
              >
                <Icon name="close" />
              </button>
            </div>
            <Badge tone={selected.tone}>
              {selected.tone === "success" ? "Saved" : "Review required"}
            </Badge>
            <section>
              <h3>Operational message</h3>
              <p>{selected.message}</p>
              <p>
                {date(selected.createdAt)} PHT · {selected.actor}
              </p>
            </section>
            <section>
              <h3>Safe recovery</h3>
              <p>
                {selected.title.includes("unknown")
                  ? "Check carrier status using the idempotency reference before retrying creation."
                  : selected.title.includes("synchronization")
                    ? "Keep the confirmed shipment and retry synchronization only."
                    : "Review the related order and its saved prerequisites before continuing."}
              </p>
              <Button
                onClick={() => {
                  setSelected(null)
                  go(
                    data.shipments.some((row) => row.id === selected.reference)
                      ? "shipment-detail"
                      : "order-detail",
                    selected.reference,
                  )
                }}
              >
                Open related record
              </Button>
            </section>
            <section>
              <button
                className="text-button"
                aria-expanded={technical}
                onClick={() => setTechnical(!technical)}
              >
                Technical details <Icon name="down" />
              </button>
              {technical && (
                <div className="technical-details">
                  <p className="record-reference">{selected.correlationId}</p>
                  <pre>{JSON.stringify(selected.details || {}, null, 2)}</pre>
                </div>
              )}
            </section>
          </section>
        </div>
      )}
    </>
  )
}

export function Activity({ go }: PageProps) {
  const { data } = useWorkspace()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("All outcomes")
  const rows = data.activity.filter(
    (event) =>
      `${event.title} ${event.actor} ${event.reference} ${event.message}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "All outcomes" || event.tone === filter),
  )
  return (
    <>
      <PageHead
        title="Activity log"
        section="activity"
        description="Saved history of operational actions, account changes, and simulated integrations."
      />
      <Card>
        <div className="toolbar">
          <Search
            label="Search activity"
            value={query}
            onChange={setQuery}
            placeholder="e.g. Maria or ORD-1001"
          />
          <label className="select-label">
            Outcome{" "}
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {["All outcomes", "success", "warning", "danger"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="activity-list">
          {rows.map((event) => (
            <div key={event.id}>
              <span
                className={`activity-dot ${
                  event.tone === "danger" ? "error" : ""
                }`}
              >
                <Icon
                  name={event.tone === "danger" ? "alert" : "check"}
                  size={14}
                />
              </span>
              <span className="activity-time">
                {date(event.createdAt)}
                <small>PHT</small>
              </span>
              <span className="activity-copy">
                <strong>{event.title}</strong>
                <small>
                  {event.actor} · {event.message}
                </small>
              </span>
              <Badge tone={event.tone}>
                {event.tone === "success" ? "Saved" : "Review"}
              </Badge>
              {data.orders.some((row) => row.id === event.reference) ||
              data.shipments.some((row) => row.id === event.reference) ? (
                <button
                  className="text-button"
                  onClick={() =>
                    go(
                      event.reference.startsWith("SHP-")
                        ? "shipment-detail"
                        : "order-detail",
                      event.reference,
                    )
                  }
                >
                  {event.reference}
                </button>
              ) : (
                <span className="record-reference">
                  {event.reference.startsWith("usr-")
                    ? "Account"
                    : event.reference}
                </span>
              )}
            </div>
          ))}
        </div>
        {!rows.length && (
          <EmptyState
            title="No matching activity"
            text="Try another record, actor, or action."
          />
        )}
        <Count count={rows.length} label="events (latest 200)" />
      </Card>
    </>
  )
}

export function Settings({ go }: PageProps) {
  const { data, mutate } = useWorkspace()
  const [tab, setTab] = useState("Profile")
  const [name, setName] = useState(data.user.name)
  const [email, setEmail] = useState(data.user.email)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newUserPassword, setNewUserPassword] = useState("")
  const [newRole, setNewRole] = useState<Role>("Operations staff")
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [assistantStatus, setAssistantStatus] = useState<boolean | null>(null)
  const action = useAction()
  const admin = data.user.role === "Administrator"
  useEffect(() => {
    if (tab === "Integrations" && admin)
      api<{ configured: boolean }>("chat/status")
        .then((value) => setAssistantStatus(value.configured))
        .catch(() => setAssistantStatus(null))
  }, [tab, admin])
  return (
    <>
      <PageHead
        title="Settings"
        section="settings"
        description="Manage your saved profile and account access."
      />
      <Feedback action={action} />
      <div className="tabs" role="group" aria-label="Settings views">
        {["Profile", "Users and roles", "Integrations"].map((value) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            aria-pressed={tab === value}
            onClick={() =>
              value !== "Profile" && !admin
                ? go("access-denied")
                : setTab(value)
            }
          >
            {value}
            {!admin && value !== "Profile" && <span>Admin</span>}
          </button>
        ))}
      </div>
      <div className="state-panel" key={tab}>
        {tab === "Profile" && (
          <>
            <Card className="settings-card">
              <div className="settings-section">
                <div className="settings-intro">
                  <span className="settings-intro-icon">
                    <Icon name="settings" size={26} />
                  </span>
                  <span className="section-overline">Personal workspace</span>
                  <h2>Profile information</h2>
                  <p>
                    Update the display name and email used for your account.
                  </p>
                </div>
                <div className="settings-form">
                  <div className="avatar large">
                    {data.user.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div className="form-grid">
                    <label>
                      <span>Display name</span>
                      <input
                        value={name}
                        maxLength={100}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Email address</span>
                      <input
                        type="email"
                        value={email}
                        maxLength={254}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Role</span>
                      <input value={data.user.role} readOnly />
                    </label>
                    <label>
                      <span>Time zone</span>
                      <input value="Asia/Manila (PHT)" readOnly />
                    </label>
                  </div>
                  <div className="card-actions">
                    <Button
                      disabled={action.busy || !name.trim() || !email.trim()}
                      onClick={() =>
                        void action.run(async () => {
                          await mutate("v1/profile", { name, email }, "PATCH")
                        }, "Profile saved.")
                      }
                    >
                      Save profile
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="card-head">
                <div>
                  <h2>Change password</h2>
                  <p>
                    At least 12 characters. All sessions sign out after a
                    password change.
                  </p>
                </div>
              </div>
              <div className="form-grid">
                <label>
                  <span>Current password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    maxLength={200}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </label>
                <label>
                  <span>New password</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    minLength={12}
                    maxLength={200}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
              </div>
              <div className="card-actions">
                <Button
                  kind="secondary"
                  disabled={
                    action.busy || !currentPassword || newPassword.length < 12
                  }
                  onClick={() =>
                    void action.run(async () => {
                      await api("v1/password", {
                        method: "PATCH",
                        body: JSON.stringify({ currentPassword, newPassword }),
                      })
                      window.dispatchEvent(
                        new Event("trancelogix-session-expired"),
                      )
                    })
                  }
                >
                  Change password and sign out
                </Button>
              </div>
            </Card>
          </>
        )}
        {tab === "Users and roles" && admin && (
          <Card>
            <div className="card-head">
              <div>
                <h2>Users and roles</h2>
                <p>
                  Server-enforced access · Role changes sign out the affected
                  account
                </p>
              </div>
              <Button icon="plus" onClick={() => setCreating(!creating)}>
                {creating ? "Close account form" : "Create user"}
              </Button>
            </div>
            {creating && (
              <form
                className="account-create-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void action.run(async () => {
                    await mutate<{ user: User }>("v1/users", {
                      name: newName,
                      email: newEmail,
                      password: newUserPassword,
                      role: newRole,
                    })
                    setCreating(false)
                    setNewName("")
                    setNewEmail("")
                    setNewUserPassword("")
                  }, "User created.")
                }}
              >
                <div className="form-grid">
                  <label>
                    <span>Name</span>
                    <input
                      required
                      value={newName}
                      maxLength={100}
                      onChange={(event) => setNewName(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      maxLength={254}
                      onChange={(event) => setNewEmail(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Initial password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={12}
                      maxLength={200}
                      value={newUserPassword}
                      onChange={(event) =>
                        setNewUserPassword(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    <span>Account role</span>
                    <select
                      value={newRole}
                      onChange={(event) =>
                        setNewRole(event.target.value as Role)
                      }
                    >
                      {[
                        "Operations staff",
                        "Warehouse staff",
                        "Administrator",
                      ].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="card-actions">
                  <button
                    type="submit"
                    className="button primary"
                    disabled={action.busy}
                  >
                    Save new user
                  </button>
                </div>
              </form>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <small>{user.email}</small>
                      </td>
                      <td>
                        <select
                          aria-label={`Role for ${user.name}`}
                          value={roles[user.id] || user.role}
                          disabled={user.id === data.user.id || action.busy}
                          onChange={(event) =>
                            setRoles({
                              ...roles,
                              [user.id]: event.target.value,
                            })
                          }
                        >
                          {[
                            "Operations staff",
                            "Warehouse staff",
                            "Administrator",
                          ].map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {user.id === data.user.id ? (
                          <small>Your account</small>
                        ) : (
                          <Button
                            kind="secondary"
                            disabled={
                              action.busy ||
                              !roles[user.id] ||
                              roles[user.id] === user.role
                            }
                            onClick={() =>
                              void action.run(async () => {
                                await mutate(
                                  `v1/users/${encodeURIComponent(user.id)}/role`,
                                  { role: roles[user.id] },
                                  "PATCH",
                                )
                              }, "Role saved. Previous sessions revoked.")
                            }
                          >
                            Save role
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        {tab === "Integrations" && admin && (
          <div className="settings-stack">
            <div className="alert info">
              <Icon name="info" />
              <div>
                <strong>Simulation adapters</strong>
                <p>
                  Carrier, WMS, and OMS services use local simulations. No
                  external logistics service is connected.
                </p>
              </div>
            </div>
            <Card>
              <div className="card-head">
                <div>
                  <h2>Backend and database</h2>
                  <p>Node.js API · SQLite persistence · Same-origin sessions</p>
                </div>
                <Badge tone="success">Connected</Badge>
              </div>
              <p>
                Orders, preparation, shipment confirmations, account settings,
                and activity are saved by the server.
              </p>
            </Card>
            <Card>
              <div className="card-head">
                <div>
                  <h2>OpenAI assistant</h2>
                  <p>Connection configured privately on the server</p>
                </div>
                <Badge tone={assistantStatus ? "success" : "warning"}>
                  {assistantStatus === null
                    ? "Status unavailable"
                    : assistantStatus
                      ? "Configured"
                      : "Setup needed"}
                </Badge>
              </div>
              <p>
                {assistantStatus
                  ? "The server has an assistant credential configured. Availability also depends on the provider account and network."
                  : "Ask the project administrator to complete the private server configuration described in the project README."}
              </p>
              <div className="card-actions">
                <Button
                  kind="secondary"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      const result = await api<{ configured: boolean }>(
                        "chat/status",
                      )
                      setAssistantStatus(result.configured)
                    })
                  }
                >
                  Check configuration
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}

export function AccessDenied({ go }: PageProps) {
  return (
    <div className="center-state">
      <span>
        <Icon name="alert" size={28} />
      </span>
      <h1 tabIndex={-1}>Access restricted</h1>
      <p>
        Your account role does not have permission for this page. Contact an
        administrator if you need access.
      </p>
      <Button onClick={() => go("dashboard")}>Return to dashboard</Button>
    </div>
  )
}

export default Dashboard
