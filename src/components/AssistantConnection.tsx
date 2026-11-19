import { useEffect, useState } from "react"
import { api, errorMessage, ApiError } from "../api"
import Card, { Badge, Button, Icon } from "./PortalUI"

export default function AssistantConnection() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [quotaError, setQuotaError] = useState(false)
  const local = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
  const refresh = async (signal?: AbortSignal) => {
    const result = await api<{ configured: boolean }>("chat/status", { signal })
    if (!signal?.aborted) {
      setConfigured(result.configured)
      setVerified(false)
    }
    return result.configured
  }
  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal).catch(cause => {
      if (!controller.signal.aborted) setError(errorMessage(cause))
    })
    return () => controller.abort()
  }, [])
  const run = async (test: boolean) => {
    if (busy) return
    setBusy(true)
    setError("")
    setMessage("")
    setQuotaError(false)
    try {
      if (!test) {
        const ready = await refresh()
        setMessage(ready ? "Private key found. Test the connection to verify access." : "No private OpenAI key was found on this server.")
      } else {
        await api<{ ok: boolean }>("chat/check", { method: "POST", body: "{}" })
        setVerified(true)
        setMessage("OpenAI connection verified. The assistant is ready for questions.")
      }
    } catch (cause) {
      setVerified(false)
      setError(errorMessage(cause))
      setQuotaError(cause instanceof ApiError && cause.code === "assistant_quota_exceeded")
    } finally { setBusy(false) }
  }
  return (
    <Card className="assistant-connection">
      <div className="card-head">
        <div><h2>OpenAI assistant</h2><p>Private server connection</p></div>
        <Badge tone={verified ? "success" : "warning"}>
          {verified ? "Verified" : configured === null ? "Checking setup" : configured ? "Key configured" : "Setup needed"}
        </Badge>
      </div>
      <p>Test the connection with a short, fixed message. No workspace records are included in this check.</p>
      {configured === false && (
        <div className="assistant-setup">
          <strong><Icon name="settings" size={17} /> Connect your assistant</strong>
          <ol>
            <li>Create a new key in your <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI project ↗</a>.</li>
            <li>{local ? <>Add it as <code>OPENAI_API_KEY</code> in the Git-ignored <code>.env.local</code> file. Restart the local server.</> : <>Add <code>OPENAI_API_KEY</code> as a secret server environment variable in your hosting project, then redeploy.</>}</li>
            <li>Select <strong>Refresh setup</strong>, then <strong>Test connection</strong>.</li>
          </ol>
          <p>Keep the key on the server. Never put it in a VITE_ variable, a public file or chat.</p>
        </div>
      )}
      {message && <div className="toast-inline" role="status"><Icon name="check" />{message}</div>}
      {error && <div className="alert danger" role="alert"><Icon name="alert" /><div><strong>Connection needs attention</strong><p>{error}</p>{quotaError && <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">Open API billing ↗</a>}</div></div>}
      <div className="card-actions">
        <Button kind="secondary" disabled={busy} onClick={() => void run(false)}>Refresh setup</Button>
        <Button disabled={busy || !configured} onClick={() => void run(true)}>{busy ? "Checking connection…" : "Test connection"}</Button>
      </div>
    </Card>
  )
}
