import { useState } from "react"
import type { SampleDataResult } from "../api-types"
import { errorMessage } from "../api"
import { useWorkspace } from "../WorkspaceData"
import Card, { Badge, Button, Icon } from "./PortalUI"

export default function SampleWorkspace() {
  const { mutate } = useWorkspace()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SampleDataResult | null>(null)
  const [error, setError] = useState("")
  const load = async () => {
    if (busy) return
    setBusy(true)
    setError("")
    setResult(null)
    try {
      setResult(await mutate<SampleDataResult>("v1/sample-data", {}))
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <div className="card-head">
        <div>
          <h2>Sample workspace</h2>
          <p>Practice the logistics workflow with fictional records.</p>
        </div>
        <Badge>Demo data</Badge>
      </div>
      <p>
        Add 20 customer orders across Philippine cities, 9 sample shipments,
        warehouse preparation and activity history. Includes shortages,
        in-transit and delivered parcels, and recovery scenarios. Existing
        records, stock levels and accounts are preserved.
      </p>
      {result && (
        <div className="toast-inline" role="status">
          <Icon name="check" />
          <span>
            {result.alreadyLoaded
              ? "Sample data is already available. Your saved progress has been kept."
              : `${result.ordersAdded} sample orders and ${result.shipmentsAdded} sample shipments added.${
                  result.skipped
                    ? ` ${result.skipped} existing records were skipped.`
                    : ""
                } Open the dashboard to explore them.`}
          </span>
        </div>
      )}
      {error && (
        <div className="alert danger" role="alert">
          <Icon name="alert" />
          <p>{error}</p>
        </div>
      )}
      <div className="card-actions">
        <Button
          kind="secondary"
          icon="plus"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Adding sample data…" : "Add sample data"}
        </Button>
      </div>
    </Card>
  )
}
