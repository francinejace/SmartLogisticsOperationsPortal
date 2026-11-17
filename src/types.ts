export type Role = "Operations staff" | "Warehouse staff" | "Administrator"

export type Page = "dashboard" | "orders" | "create-order" | "order-detail" | "warehouse" | "preparation" | "create-shipment" | "shipments" | "shipment-detail" | "tracking" | "integration" | "activity" | "settings" | "help" | "access-denied"
export type Navigate = (page: Page, recordId?: string) => void
