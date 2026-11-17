import type { Role } from "./types"

export interface User {
  id: string
  name: string
  email: string
  role: Role
}

export interface OrderItem {
  sku: string
  name: string
  qty: number
}

export interface PreparationRecord {
  picked: boolean
  packed: boolean
  weight: number | null
  notes: string
  shortage: boolean
  updatedAt: string | null
}

export interface OrderRecord {
  id: string
  customerId: string
  customer: string
  destination: string
  items: OrderItem[]
  order: string
  inventory: string
  shipment: string
  date: string
  createdAt: string
  preparation: PreparationRecord
  carrierOutcome: string | null
}

export interface ShipmentRecord {
  id: string
  orderId: string
  carrier: string
  tracking: string
  destination: string
  fee: string
  status: string
  sync: string
  updated: string
  createdAt: string
  updatedAt: string
  idempotencyKey: string
}

export interface InventoryRecord {
  sku: string
  name: string
  stock: number
}

export interface ActivityRecord {
  id: string
  title: string
  message: string
  actor: string
  reference: string
  tone: string
  createdAt: string
  correlationId: string
  details?: Record<string, unknown>
}

export interface WorkspaceSnapshot {
  user: User
  orders: OrderRecord[]
  shipments: ShipmentRecord[]
  inventory: InventoryRecord[]
  activity: ActivityRecord[]
  users: User[]
  simulation: boolean
}
