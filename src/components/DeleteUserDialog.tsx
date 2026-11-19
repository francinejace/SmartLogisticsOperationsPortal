import { useEffect, useId, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { User } from "../api-types"
import { errorMessage } from "../api"
import { Icon } from "./PortalUI"

interface DeleteUserDialogProps {
  user: User
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function DeleteUserDialog({
  user,
  onClose,
  onConfirm,
}: DeleteUserDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const titleId = useId()
  const descriptionId = useId()
  const identityId = useId()

  useEffect(() => {
    const element = dialog.current!
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    element.showModal()
    cancelButton.current?.focus()
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true })
      else
        document
          .querySelector<HTMLElement>("[data-user-management-heading]")
          ?.focus({ preventScroll: true })
    }
  }, [])

  const remove = async () => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError("")
    try {
      await onConfirm()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="user-delete-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={`${descriptionId} ${identityId}`}
      aria-busy={busy}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return
        const buttons = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        )
        const first = buttons[0]
        const last = buttons.at(-1)
        if (!first) event.preventDefault()
        else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending.current) onClose()
      }}
    >
      <span className="user-delete-symbol">
        <Icon name="users" size={24} />
      </span>
      <h2 id={titleId}>Delete user?</h2>
      <p id={descriptionId}>
        This permanently removes this account and signs out all its sessions.
        Orders, shipments, and activity history stay in the workspace.
      </p>
      <div className="user-delete-identity" id={identityId}>
        <strong>{user.name}</strong>
        <span>{user.email}</span>
        <small>{user.role}</small>
      </div>
      {error && (
        <p className="user-delete-error" role="alert">
          {error}
        </p>
      )}
      <div className="user-delete-actions">
        <button
          ref={cancelButton}
          type="button"
          className="button secondary"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button user-delete-confirm"
          onClick={() => void remove()}
          disabled={busy}
        >
          {busy ? "Deleting user…" : "Delete user"}
        </button>
      </div>
    </dialog>,
    document.body,
  )
}
