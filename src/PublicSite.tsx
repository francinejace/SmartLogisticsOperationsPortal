import { useState } from "react"
import type { Theme } from "./theme"
import type { Role } from "./types"
import ThemeToggle from "./components/ThemeToggle"
import BrandMark from "./components/BrandMark"
import PhotoCarousel from "./components/PhotoCarousel"
import useEntranceMotion from "./useEntranceMotion"

interface PublicSiteProps {
  view: "home" | "login"
  onNavigate: (view: "home" | "login") => void
  onLogin: (role: Role) => void
  theme: Theme
  onToggleTheme: () => void
}

interface PublicIconProps {
  name: "arrow" | "box" | "warehouse" | "truck" | "link" | "check" | "lock" | "users"
  size?: number
}

function PublicIcon({ name, size = 22 }: PublicIconProps) {
  const paths = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    box: (
      <>
        <path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4" />
      </>
    ),
    warehouse: (
      <>
        <path d="m3 9 9-6 9 6v12H3V9Z" />
        <path d="M7 21V11h10v10M7 15h10M7 18h10" />
      </>
    ),
    truck: (
      <>
        <path d="M3 5h11v12H3V5Zm11 5h4l3 4v3h-7" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    link: (
      <>
        <rect x="2" y="7" width="7" height="10" rx="2" />
        <rect x="15" y="7" width="7" height="10" rx="2" />
        <path d="M9 10h6M9 14h6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-4-5" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon={name}
    >
      {paths[name]}
    </svg>
  )
}

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [role, setRole] = useState<Role>("Operations staff")
  const description =
    role === "Administrator"
      ? "Explore connection health, integration events, and recovery guidance."
      : role === "Warehouse staff"
        ? "Review inventory and prepare eligible orders for shipment."
        : "Follow customer orders, carrier confirmations, and shipment progress."
  return (
    <main className="public-main login-main" id="public-content">
      <section className="login-story">
        <span className="public-eyebrow">YOUR NEXT SHIFT, CONNECTED</span>
        <h2>
          A clearer view.
          <br />A better handoff.
        </h2>
        <p>
          Bring your people, orders, and shipment information into one shared
          operations workspace.
        </p>
        <div className="login-story-list">
          {[
            "Know which orders need attention",
            "Coordinate picking, packing, and carrier requests",
            "Follow shipment progress and safe recovery steps",
          ].map((text) => (
            <div key={text}>
              <span>
                <PublicIcon name="check" size={18} />
              </span>
              {text}
            </div>
          ))}
        </div>
        <div className="login-story-note">
          <PublicIcon name="link" />
          <div>
            <strong>OMS. WMS. Carrier API.</strong>
            <p>One workflow from order acceptance to shipment information.</p>
          </div>
        </div>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <span className="public-icon-tile">
          <PublicIcon name="lock" size={25} />
        </span>
        <span className="public-eyebrow">TRANSLOGIX WORKSPACE</span>
        <h1 id="login-title" tabIndex={-1}>
          Welcome back
        </h1>
        <p>Choose a demo role to explore the operations portal.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onLogin(role)
          }}
        >
          <div className="login-account">
            <span className="avatar large">MS</span>
            <div>
              <strong>Maria Santos</strong>
              <small>Sample profile · Role preview</small>
            </div>
            <span className="public-tag">Demo</span>
          </div>
          <label htmlFor="login-role">Workspace role</label>
          <select
            id="login-role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            aria-describedby="login-role-help"
          >
            <option>Operations staff</option>
            <option>Warehouse staff</option>
            <option>Administrator</option>
          </select>
          <p className="login-role-help" id="login-role-help">
            {description}
          </p>
          <button className="button primary public-login-submit" type="submit">
            Enter workspace
            <PublicIcon name="arrow" size={18} />
          </button>
        </form>
        <div className="login-demo-note">
          <PublicIcon name="lock" size={17} />
          <p>
            <strong>Demonstration access</strong>No password is needed. This
            frontend prototype does not authenticate users or connect to live
            services.
          </p>
        </div>
      </section>
    </main>
  )
}

function WorkflowGuide() {
  const [expanded, setExpanded] = useState<number | null>(0)
  const stages = [
    {
      title: "Accept and validate",
      summary: "Start with a valid, unique customer order.",
      detail:
        "Review the customer, destination, and requested item quantities. Duplicate order references are flagged before an order is accepted.",
      owner: "Order management · Integration middleware",
    },
    {
      title: "Check and prepare",
      summary: "Confirm inventory and prepare the package.",
      detail:
        "Middleware checks inventory with WMS. Warehouse staff pick and pack eligible orders, then confirm the package details before a carrier request.",
      owner: "Integration middleware · Warehouse",
    },
    {
      title: "Confirm and synchronize",
      summary: "Receive the tracking number and update OMS.",
      detail:
        "A confirmed carrier response supplies the shipment details. Middleware updates OMS. If that update fails, keep the confirmed shipment and retry synchronization.",
      owner: "Carrier · Integration middleware · Order management",
    },
  ]
  return (
    <div className="workflow-guide">
      <p className="workflow-guide-hint">Explore each handoff</p>
      <ol aria-label="Shipment workflow stages">
        {stages.map((stage, index) => {
          const open = expanded === index
          return (
            <li key={stage.title} data-expanded={open}>
              <h3>
                <button
                  type="button"
                  id={`workflow-trigger-${index}`}
                  aria-expanded={open}
                  aria-controls={`workflow-panel-${index}`}
                  onClick={() => setExpanded(open ? null : index)}
                >
                  <span className="workflow-step-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="workflow-step-label">
                    <strong>{stage.title}</strong>
                    <span>{stage.summary}</span>
                  </span>
                  <PublicIcon name="arrow" size={17} />
                </button>
              </h3>
              <div
                className="workflow-panel"
                id={`workflow-panel-${index}`}
                role="region"
                aria-labelledby={`workflow-trigger-${index}`}
                aria-hidden={!open}
                inert={!open}
              >
                <div className="workflow-panel-clip">
                  <div className="workflow-panel-content">
                    <p>{stage.detail}</p>
                    <small>{stage.owner}</small>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function PublicSite({
  view,
  onNavigate,
  onLogin,
  theme,
  onToggleTheme,
}: PublicSiteProps) {
  const motionRoot = useEntranceMotion(view)
  return (
    <div className="public-site" ref={motionRoot}>
      <a className="skip-link" href="#public-content">
        Skip to content
      </a>
      <header className="public-header">
        <div className="public-header-inner">
          <button
            className="public-brand"
            onClick={() => onNavigate("home")}
            aria-label="TransLogix homepage"
          >
            <BrandMark />
            <span>
              <strong>TransLogix</strong>
              <small>Logistics Services</small>
            </span>
          </button>
          {view === "home" && (
            <nav className="public-nav" aria-label="Homepage navigation">
              <a href="#platform">The platform</a>
              <a href="#how-it-works">How it works</a>
              <a href="#your-team">For your team</a>
            </nav>
          )}
          <div className="public-header-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            {view === "home" ? (
              <button
                className="button primary"
                onClick={() => onNavigate("login")}
              >
                Log in
                <PublicIcon name="arrow" size={17} />
              </button>
            ) : (
              <button
                className="button secondary"
                onClick={() => onNavigate("home")}
              >
                Back to home
              </button>
            )}
          </div>
        </div>
      </header>
      {view === "login" ? (
        <LoginScreen onLogin={onLogin} />
      ) : (
        <main className="public-main public-home-main" id="public-content">
          <PhotoCarousel>
            <div className="public-hero-copy" data-enter>
              <span className="public-eyebrow public-hero-eyebrow">
                <PublicIcon name="link" size={17} /> SMART LOGISTICS. CONNECTED
                OPERATIONS.
              </span>
              <h1 tabIndex={-1}>
                Every shipment.
                <br />
                <span>One clear picture.</span>
              </h1>
              <p>
                Connect the dots between orders, warehouse preparation, and
                carriers. Give your team the context to keep every handoff
                moving.
              </p>
              <div className="public-hero-actions">
                <button
                  className="button primary"
                  onClick={() => onNavigate("login")}
                >
                  Log in to workspace
                  <PublicIcon name="arrow" size={19} />
                </button>
                <a className="button secondary" href="#platform">
                  Explore the platform
                </a>
              </div>
              <div className="public-hero-note">
                <span>
                  <PublicIcon name="check" size={15} /> Clear next steps
                </span>
                <span>
                  <PublicIcon name="check" size={15} /> Connected workflows
                </span>
                <span>
                  <PublicIcon name="check" size={15} /> Shared visibility
                </span>
              </div>
            </div>
          </PhotoCarousel>
          <div className="public-content-wrap">
            <section
              className="public-systems"
              aria-label="Systems coordinated by integration middleware"
            >
              <span>
                CONNECTED
                <br />
                SYSTEMS
              </span>
              <div>
                <PublicIcon name="box" />
                <strong>Order management</strong>
                <small>OMS</small>
              </div>

              <div>
                <PublicIcon name="link" />
                <strong>Integration middleware</strong>
                <small>SLSIS</small>
              </div>

              <div>
                <PublicIcon name="warehouse" />
                <strong>Warehouse</strong>
                <small>WMS</small>
              </div>

              <div>
                <PublicIcon name="truck" />
                <strong>Carrier</strong>
                <small>API</small>
              </div>
            </section>
            <section className="public-section" id="platform">
              <div className="public-section-heading" data-enter>
                <div>
                  <span className="public-eyebrow">01 / THE PLATFORM</span>
                  <h2>Less searching. More moving forward.</h2>
                </div>
                <p>
                  The operational information your team needs, brought together
                  around each customer order.
                </p>
              </div>
              <div className="public-feature-grid">
                {[
                  {
                    icon: "box",
                    label: "01 / ORDERS",
                    title: "Start with the right details",
                    text: "Create and review customer orders with clear validation and inventory status.",
                  },
                  {
                    icon: "warehouse",
                    label: "02 / PREPARATION",
                    title: "Make every handoff count",
                    text: "Work through picking, packing, and package details before creating a shipment.",
                  },
                  {
                    icon: "truck",
                    label: "03 / SHIPMENTS",
                    title: "Keep the next step in sight",
                    text: "Review carrier confirmations, tracking updates, and synchronization exceptions.",
                  },
                ].map((feature) => (
                  <article
                    className="public-feature-card"
                    key={feature.title}
                    data-enter
                  >
                    <div className="public-feature-top">
                      <span className="public-icon-tile">
                        <PublicIcon
                          name={feature.icon as PublicIconProps["name"]}
                        />
                      </span>
                      <small>{feature.label}</small>
                    </div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                    <button
                      className="text-button"
                      onClick={() => onNavigate("login")}
                    >
                      Explore in the workspace
                      <PublicIcon name="arrow" size={16} />
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <section
              className="public-workflow-banner public-section"
              id="how-it-works"
              data-enter
            >
              <div>
                <span className="public-eyebrow">02 / HOW IT WORKS</span>
                <h2>
                  Different systems.
                  <br />
                  One connected journey.
                </h2>
                <p>
                  An order is validated, inventory is checked with WMS, and
                  middleware coordinates the carrier request. Confirmed shipment
                  information then returns to OMS.
                </p>
              </div>
              <WorkflowGuide />
            </section>
            <section
              className="public-team-section public-section"
              id="your-team"
              data-enter
            >
              <div>
                <span className="public-eyebrow">03 / FOR YOUR TEAM</span>
                <h2>A shared view. A clear responsibility.</h2>
                <p>
                  Operations staff follow orders and shipments. Warehouse staff
                  prepare eligible orders. Administrators review integration
                  health and recovery.
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => onNavigate("login")}
              >
                Find your workspace
                <PublicIcon name="arrow" size={18} />
              </button>
            </section>
          </div>
        </main>
      )}
      <footer className="public-footer">
        <div>
          <strong>TransLogix</strong>
          <span>Smart Logistics Shipment Integration System</span>
        </div>
        <p>Team Sync · Demonstration prototype</p>
        <span>No live APIs or production authentication</span>
      </footer>
    </div>
  )
}
