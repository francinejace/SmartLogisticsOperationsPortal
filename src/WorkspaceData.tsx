import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api, errorMessage } from "./api"
import type { User, WorkspaceSnapshot } from "./api-types"

interface WorkspaceContextValue {
  data: WorkspaceSnapshot
  orderId: string
  shipmentId: string
  selectRecord: (id: string) => void
  mutate: <T>(path: string, body: unknown, method?: string) => Promise<T>
  refresh: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error("Workspace data is unavailable.")
  return context
}

export default function WorkspaceData({ children, onUserChange }: { children: React.ReactNode; onUserChange: (user: User) => void }) {
  const [data, setData] = useState<WorkspaceSnapshot | null>(null)
  const [error, setError] = useState("")
  const [orderId, setOrderId] = useState("ORD-1001")
  const [shipmentId, setShipmentId] = useState("SHP-5012")
  const refresh = useCallback(async () => {
    try {
      const next = await api<WorkspaceSnapshot>("v1/workspace")
      setData(next)
      setError("")
      onUserChange(next.user)
    } catch (cause) { setError(errorMessage(cause)) }
  }, [onUserChange])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const sync = () => { if (document.visibilityState === "visible") void refresh() }
    window.addEventListener("focus", sync)
    return () => window.removeEventListener("focus", sync)
  }, [refresh])
  const mutate = async <T,>(path: string, body: unknown, method = "POST"): Promise<T> => {
    const result = await api<T>(path, { method, body: JSON.stringify(body) })
    await refresh()
    return result
  }
  const selectRecord = (id: string) => {
    const shipment = data?.shipments.find(row => [row.id, row.tracking].includes(id))
    if (shipment) { setShipmentId(shipment.id); setOrderId(shipment.orderId); return }
    setOrderId(id)
    const linked = data?.shipments.find(row => row.orderId === id)
    setShipmentId(linked?.id || "")
  }
  if (!data) return <main className="backend-loading"><h1 tabIndex={-1}>TransLogix workspace</h1>{error ? <><p role="alert">{error}</p><button className="button primary" onClick={() => void refresh()}>Retry connection</button></> : <p role="status">Loading saved workspace…</p>}</main>
  return <WorkspaceContext.Provider value={{ data, orderId, shipmentId, selectRecord, mutate, refresh }}>
    {error && <div className="backend-connection-error" role="alert">{error} <button onClick={() => void refresh()}>Retry refresh</button></div>}
    {children}
  </WorkspaceContext.Provider>
}
