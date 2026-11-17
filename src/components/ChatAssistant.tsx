import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { api, errorMessage } from "../api"
import { Icon } from "./PortalUI"
import BrandMark from "./BrandMark"

interface Turn {
  id: string
  question: string
  answer?: string
}

export default function ChatAssistant({ page }: { page: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] =
    useState<"checking" | "ready" | "setup" | "offline">("checking")
  const [draft, setDraft] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState("")
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const sending = useRef(false)

  const check = async (signal?: AbortSignal) => {
    setStatus("checking")
    try {
      const result = await api<{ configured: boolean }>("chat/status", {
        signal,
      })
      if (!signal?.aborted) setStatus(result.configured ? "ready" : "setup")
    } catch {
      if (!signal?.aborted) setStatus("offline")
    }
  }
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void check(controller.signal)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    if (!dialog.current?.open) dialog.current?.showModal()
    const frame = requestAnimationFrame(() => input.current?.focus())
    return () => {
      controller.abort()
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      dialog.current?.close()
    }
  }, [open])
  useEffect(
    () => () => {
      generation.current++
      request.current?.abort()
    },
    [],
  )
  useEffect(() => {
    if (open && log.current)
      log.current.scrollTop = turns.length ? log.current.scrollHeight : 0
  }, [open, turns, busy, error])
  const close = () => {
    setOpen(false)
    requestAnimationFrame(() =>
      launcher.current?.focus({ preventScroll: true }),
    )
  }

  const send = async (question: string) => {
    const content = question.trim()
    if (
      sending.current ||
      !content ||
      content.length > 2000 ||
      status !== "ready"
    )
      return
    const history = turns.filter((turn) => turn.answer !== undefined).slice(-5)
    const messages = history.flatMap((turn) => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer! },
    ])
    messages.push({ role: "user", content })
    while (
      messages.reduce((sum, item) => sum + item.content.length, 0) > 16000 &&
      messages.length > 1
    )
      messages.splice(0, 2)
    const id = crypto.randomUUID()
    const current = ++generation.current
    const controller = new AbortController()
    request.current = controller
    sending.current = true
    setTurns(
      [
        ...turns.filter((turn) => turn.answer !== undefined),
        { id, question: content },
      ].slice(-20),
    )
    setDraft("")
    setError("")
    setRetry("")
    setBusy(true)
    try {
      const result = await api<{ reply: string }>("chat", {
        method: "POST",
        body: JSON.stringify({ messages, page }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(35000),
        ]),
      })
      if (current !== generation.current) return
      setTurns((previous) =>
        previous.map((turn) =>
          turn.id === id ? { ...turn, answer: result.reply } : turn,
        ),
      )
    } catch (cause) {
      if (current !== generation.current) return
      setError(
        controller.signal.aborted
          ? "Response stopped. You can retry or ask another question."
          : errorMessage(cause),
      )
      setRetry(content)
    } finally {
      if (current === generation.current) {
        sending.current = false
        setBusy(false)
        request.current = null
        if (dialog.current?.open) input.current?.focus()
      }
    }
  }
  const reset = () => {
    generation.current++
    request.current?.abort()
    request.current = null
    sending.current = false
    setTurns([])
    setDraft("")
    setError("")
    setRetry("")
    setBusy(false)
    input.current?.focus()
  }
  return createPortal(
    <>
      <button
        ref={launcher}
        className="assistant-launcher"
        onClick={() => setOpen(true)}
        aria-label="Open TransLogix assistant"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z" />
          <path d="M7 10h10M7 14h6" />
        </svg>
        <span>Ask TransLogix</span>
      </button>
      <dialog
        ref={dialog}
        className="assistant-panel"
        aria-labelledby="assistant-title"
        aria-describedby="assistant-description"
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close()
        }}
      >
        <header className="assistant-header">
          <div className="assistant-identity">
            <BrandMark />
            <div>
              <h2 id="assistant-title">TransLogix assistant</h2>
              <p>Workspace guidance</p>
            </div>
          </div>
          <div className="assistant-header-actions">
            <button
              type="button"
              onClick={reset}
              disabled={!turns.length && !draft}
              aria-label="Start a new conversation"
              title="Start a new conversation"
            >
              <Icon name="plus" />
            </button>
            <button type="button" onClick={close} aria-label="Close assistant">
              <Icon name="close" />
            </button>
          </div>
        </header>
        <div className="assistant-context" id="assistant-description">
          <Icon name="info" size={15} />
          <span>
            Explains saved records and workflows. Logistics services are
            simulated.
          </span>
        </div>
        <div
          ref={log}
          className="assistant-conversation"
          role="log"
          aria-label="Assistant conversation"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {!turns.length && (
            <div className="assistant-welcome">
              <span className="assistant-welcome-icon">
                <Icon name="box" size={25} />
              </span>
              <span className="assistant-eyebrow">HERE TO HELP YOUR SHIFT</span>
              <h3>What can I help you move forward?</h3>
              <p>
                Ask about an order, warehouse preparation, or the next safe
                step.
              </p>
              <div className="assistant-suggestions">
                {[
                  "How do I create an order?",
                  "Help me prepare ORD-1002",
                  "What should I do after a carrier timeout?",
                  "How do I fix a pending OMS sync?",
                ].map((question) => (
                  <button
                    key={question}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDraft(question)
                      input.current?.focus()
                    }}
                  >
                    <span>{question}</span>
                    <Icon name="arrow" size={16} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((turn) => (
            <div className="assistant-turn" key={turn.id}>
              <div className="assistant-message assistant-question">
                <span>You</span>
                <p>{turn.question}</p>
              </div>
              {turn.answer !== undefined && (
                <div className="assistant-message assistant-answer">
                  <span>TransLogix · AI</span>
                  <p>{turn.answer}</p>
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="assistant-pending" role="status">
              <Icon name="clock" size={16} />
              <span>Preparing a reply…</span>
            </div>
          )}
        </div>
        <div className="assistant-compose-area">
          {status !== "ready" && (
            <div className="assistant-notice" role="status">
              <p>
                {status === "checking"
                  ? "Checking assistant availability…"
                  : status === "setup"
                    ? "The assistant is not connected yet. Ask your project administrator to finish setup."
                    : "The assistant could not be reached. Check your connection and try again."}
              </p>
              {status !== "checking" && (
                <button type="button" onClick={() => void check()}>
                  Check again
                </button>
              )}
            </div>
          )}
          {error && (
            <div className="assistant-error" role="alert">
              <p>{error}</p>
              {retry && status === "ready" && (
                <button type="button" onClick={() => void send(retry)}>
                  Retry question
                </button>
              )}
            </div>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void send(draft)
            }}
          >
            <label className="sr-only" htmlFor="assistant-question">
              Message TransLogix assistant
            </label>
            <textarea
              ref={input}
              id="assistant-question"
              rows={2}
              maxLength={2000}
              value={draft}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about your logistics workflow…"
              aria-describedby="assistant-privacy"
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault()
                  void send(draft)
                }
              }}
            />
            <div className="assistant-composer-actions">
              <span>{draft.length}/2000</span>
              {busy ? (
                <button
                  type="button"
                  onClick={() => request.current?.abort()}
                  aria-label="Stop assistant response"
                >
                  Stop <span aria-hidden="true">■</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim() || status !== "ready"}
                  aria-label="Send message"
                >
                  Send{" "}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m5 12 7-7 7 7M12 5v15" />
                  </svg>
                </button>
              )}
            </div>
          </form>
          <p id="assistant-privacy" className="assistant-privacy">
            Messages and referenced records are sent to OpenAI. AI can make
            mistakes; verify important details.
          </p>
        </div>
      </dialog>
    </>,
    document.body,
  )
}
