import { useEffect, useMemo, useState } from "react"
import {
  applyTheme,
  getPreferredTheme,
  saveThemePreference,
  type Theme,
} from "./theme"
import type { Page, Navigate } from "./types"
import type { User } from "./api-types"
import { api, errorMessage } from "./api"
import PublicSite from "./PublicSite"
import ThemeToggle from "./components/ThemeToggle"
import BrandMark from "./components/BrandMark"
import ChatAssistant from "./components/ChatAssistant"
import Card, { Icon, Button, PageHead } from "./components/PortalUI"
import useFocusLayer from "./useFocusLayer"
import WorkspaceData, { useWorkspace } from "./WorkspaceData"
import {
  Dashboard,
  Orders,
  CreateOrder,
  OrderDetail,
  Warehouse,
  Preparation,
  CreateShipment,
  Shipments,
  ShipmentDetail,
  Tracking,
  Integration,
  Activity,
  Settings,
  AccessDenied,
} from "./WorkspacePages"

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

function Help() {
  return (
    <>
      <PageHead
        title="Help center"
        section="help"
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
            "Contact the TranceLogix integration support team and include the order or correlation ID.",
          ],
        ].map((x, i) => (
          <Card className="help-topic-card" key={x[0]}>
            <div className="help-topic-top">
              <span className="help-icon">
                <Icon name={i === 5 ? "help" : "info"} />
              </span>
              <span className="help-topic-index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h2>{x[0]}</h2>
            <p>{x[1]}</p>
            <span className="help-topic-label">
              {i === 5
                ? "Support information"
                : i === 2 || i === 3
                  ? "Recovery guidance"
                  : "Workflow reference"}
            </span>
          </Card>
        ))}
      </div>
      <Card className="contract-card">
        <div className="card-head">
          <div>
            <h2>How the systems connect</h2>
            <p>
              Documented integration flow · Persistent local API with simulated
              service adapters
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
            Content-Type: application/json. The UI uses qty internally;
            the API request uses quantity. Orders are validated and saved by the
            backend.
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

interface WorkspaceProps {
  theme: Theme
  onToggleTheme: () => void
  onSignOut: () => void
}

function Workspace({ theme, onToggleTheme, onSignOut }: WorkspaceProps) {
  const [page, setPage] = useState<Page>("dashboard")
  const { data, orderId, shipmentId, selectRecord } = useWorkspace()
  const role = data.user.role
  const initials = data.user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
  const alerts = data.activity
    .filter((event) => event.tone !== "success")
    .slice(0, 4)
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
  const [searchExamplesOpen, setSearchExamplesOpen] = useState(false)
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
  const go: Navigate = (p, recordId) => {
    if (recordId) selectRecord(recordId)
    setPage(p)
    setSearchRequest(null)
    setMobileNav(false)
    setNotifications(false)
    setProfile(false)
    setSearchExamplesOpen(false)
    window.scrollTo({ top: 0, behavior: "instant" })
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("main h1")?.focus(),
    )
  }
  const runGlobalSearch = (value: string) => {
    const query = value.trim()
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
          <BrandMark />
          <div>
            <strong>TranceLogix</strong>
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
              Local workspace<small>Saved data · Simulated services</small>
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
            <div className="avatar">{initials}</div>
            <span>
              <strong>{data.user.name}</strong>
              <small>{role}</small>
            </span>
            <Icon name="down" size={16} />
          </button>
        </div>
      </aside>
      {mobileNav && (
        <div className="nav-scrim" onClick={() => setMobileNav(false)} />
      )}
      <ChatAssistant page={page} />
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
            role="search"
            aria-label="Workspace records"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setSearchExamplesOpen(false)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchExamplesOpen(false)
            }}
            onSubmit={(event) => {
              event.preventDefault()
              runGlobalSearch(globalQuery)
            }}
          >
            <label className="sr-only" htmlFor="global-search">
              Search workspace records
            </label>
            <Icon name="search" />
            <input
              id="global-search"
              type="search"
              autoComplete="off"
              aria-describedby="global-search-hint"
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
              onFocus={() => {
                setSearchExamplesOpen(true)
                setProfile(false)
                setNotifications(false)
              }}
              onClick={() => setSearchExamplesOpen(true)}
              placeholder="Try ORD-1001 or BOX-001"
            />
            <span className="sr-only" id="global-search-hint">
              Search an order, shipment, product SKU, or tracking reference.
              When the field is empty, use Tab to choose a sample search, or
              type a reference and press Enter.
            </span>
            <button
              className="search-submit"
              aria-label="Search records"
              type="submit"
            >
              ↵
            </button>
            {searchExamplesOpen && !globalQuery.trim() && (
              <div
                className="global-search-examples"
                role="group"
                aria-label="Example searches"
              >
                <p>
                  Try an example search{" "}
                  <small>Choose a record to explore</small>
                </p>
                {[
                  ["ORD-1001", "Customer order", "clipboard"],
                  ["SHP-5012", "Carrier shipment", "truck"],
                  ["BOX-001", "Warehouse product", "box"],
                  ["TRK-123456", "Shipment tracking", "location"],
                ].map(([term, label, icon]) => (
                  <button
                    type="button"
                    key={term}
                    onClick={() => runGlobalSearch(term)}
                  >
                    <span className="search-example-icon">
                      <Icon name={icon} size={18} />
                    </span>
                    <span>
                      <strong>{term}</strong>
                      <small>{label}</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                ))}
              </div>
            )}
          </form>
          <div className="top-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <span className="environment">
              <i />
              Simulation adapters
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
              {!readNotifications && alerts.length > 0 && (
                <i>{alerts.length}</i>
              )}
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
              <div className="avatar">{initials}</div>
              <span>
                <strong>{data.user.name}</strong>
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
              {alerts.map((event) => (
                <button
                  key={event.id}
                  className={!readNotifications ? "unread" : ""}
                  onClick={() =>
                    go(
                      event.reference.startsWith("SHP-")
                        ? "shipment-detail"
                        : "order-detail",
                      event.reference,
                    )
                  }
                >
                  <span className={`notice-icon ${event.tone}`}>
                    <Icon name="alert" />
                  </span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {event.reference} · {event.message}
                    </small>
                  </span>
                  <Icon name="arrow" size={15} />
                </button>
              ))}
              {!alerts.length && (
                <p className="notification-empty">No saved exceptions.</p>
              )}
            </section>
          )}
          {profile && (
            <section
              ref={profileRef}
              className="popover profile-menu"
              role="dialog"
              aria-label="Profile and account"
            >
              <div className="profile-summary">
                <div className="avatar large">{initials}</div>
                <span>
                  <strong>{data.user.name}</strong>
                  <small>{data.user.email}</small>
                </span>
              </div>
              <button onClick={() => go("settings")}>
                <Icon name="settings" />
                Account settings
              </button>
              <button
                onClick={() => {
                  void onSignOut()
                }}
              >
                <Icon name="logout" />
                Sign out <small>Return to homepage</small>
              </button>
              <div className="demo-role">
                <span>
                  <strong>{role}</strong>
                  <small>Account role verified by the server</small>
                </span>
              </div>
            </section>
          )}
        </header>
        <main id="workspace-content" aria-label={title}>
          <div
            className="page-transition"
            key={`${page}-${role}-${orderId}-${shipmentId}-${searchRequest?.query ?? ""}`}
          >
            {render()}
          </div>
          <footer>
            TranceLogix SLSIS · Team Sync
            <span>Saved workspace data · Carrier, WMS and OMS simulations</span>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState(getPreferredTheme)
  const [view, setView] = useState<"home" | "login" | "workspace">("home")
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => applyTheme(theme), [theme])
  useEffect(() => {
    const controller = new AbortController()
    api<{ user: User | null }>("auth/session", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setUser(result.user)
          if (result.user) setView("workspace")
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    const expired = () => {
      setUser(null)
      setView("login")
      setError("Your session ended. Sign in to continue.")
    }
    window.addEventListener("trancelogix-session-expired", expired)
    return () => {
      controller.abort()
      window.removeEventListener("trancelogix-session-expired", expired)
    }
  }, [])
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    saveThemePreference(next)
  }
  const navigate = (next: "home" | "login") => {
    setView(next)
    setError("")
    window.scrollTo({ top: 0, behavior: "instant" })
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>("main h1")?.focus(),
    )
  }
  const signOut = async () => {
    try {
      await api("auth/logout", { method: "POST", body: "{}" })
      setUser(null)
      navigate("home")
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }
  if (loading)
    return (
      <main className="backend-loading">
        <h1>TranceLogix</h1>
        <p role="status">Connecting to workspace…</p>
      </main>
    )
  return (
    <>
      {error && (
        <div className="backend-connection-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {user && view === "workspace" ? (
        <WorkspaceData onUserChange={setUser}>
          <Workspace
            theme={theme}
            onToggleTheme={toggleTheme}
            onSignOut={signOut}
          />
        </WorkspaceData>
      ) : (
        <PublicSite
          view={view === "workspace" ? "login" : view}
          onNavigate={navigate}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogin={(account) => {
            setUser(account)
            setError("")
            setView("workspace")
            window.scrollTo({ top: 0, behavior: "instant" })
          }}
        />
      )}
    </>
  )
}
