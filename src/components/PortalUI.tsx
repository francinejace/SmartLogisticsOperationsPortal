interface IconProps {
  name: string
  size?: number
}
interface EmptyStateProps {
  title: string
  text: string
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
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    moon: <path d="M20.5 14a8.8 8.8 0 0 1-10.5-10.5A9 9 0 1 0 20.5 14Z" />,
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
  className = "",
}: {
  children: React.ReactNode
  kind?: string
  icon?: string
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      className={`button ${kind} ${className}`}
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

const portalSections = {
  overview: { label: "Operations workspace", icon: "grid" },
  orders: { label: "Order management", icon: "clipboard" },
  warehouse: { label: "Warehouse operations", icon: "box" },
  shipments: { label: "Shipment management", icon: "truck" },
  tracking: { label: "Shipment visibility", icon: "location" },
  integration: { label: "Integration health", icon: "pulse" },
  activity: { label: "Operational history", icon: "clock" },
  settings: { label: "Workspace configuration", icon: "settings" },
  help: { label: "Guides and support", icon: "help" },
} as const

function PageHead({
  title,
  description,
  children,
  back,
  section = "overview",
  featured = false,
}: {
  title: string
  description: string
  children?: React.ReactNode
  back?: () => void
  section?: keyof typeof portalSections
  featured?: boolean
}) {
  const identity = portalSections[section]
  return (
    <div className={`page-head ${featured ? "page-head-feature" : ""}`}>
      {featured && (
        <img
          className="page-heading-photo"
          src={`${import.meta.env.BASE_URL}images/logistics/warehouse.webp`}
          alt=""
          aria-hidden="true"
          width={1400}
          height={1000}
        />
      )}
      <div className="page-heading-main">
        <span className="page-heading-symbol" aria-hidden="true">
          <Icon name={identity.icon} size={24} />
        </span>
        <div className="page-heading-copy">
          {back && (
            <button className="back-link" onClick={back}>
              ← Back to previous
            </button>
          )}
          <span className="page-eyebrow">TRANCELOGIX / {identity.label}</span>
          <h1 tabIndex={-1}>{title}</h1>
          <p>{description}</p>
        </div>
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
      <span className="stat-card-heading">
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
        <small>{label}</small>
      </span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-card-footer">
        <em>{note}</em>
        <Icon name="arrow" size={18} />
      </span>
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

export { Icon, Badge, Button, PageHead, StatCard, SamplePagination, EmptyState }
export default Card
