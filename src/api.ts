export class ApiError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api/${path.replace(/^\//, "")}`, {
      ...options,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-TransLogix-Request": "1", ...options.headers },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw new ApiError("The server could not be reached. Check the connection and try again.", 0, "network_error")
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    if (response.status === 401 && !path.startsWith("auth/")) window.dispatchEvent(new Event("translogix-session-expired"))
    throw new ApiError(data?.error?.message || "The request could not be completed. Please try again.", response.status, data?.error?.code || "request_failed")
  }
  return data as T
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again."
