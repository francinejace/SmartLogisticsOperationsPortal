export class ApiError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(
      `${import.meta.env.BASE_URL}api/${path.replace(/^\//, "")}`,
      {
        ...options,
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-TranceLogix-Request": "1",
          ...options.headers,
        },
      },
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error
    throw new ApiError(
      "The server could not be reached. Check the connection and try again.",
      0,
      "network_error",
    )
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) {
    if (response.status === 401 && !path.startsWith("auth/"))
      window.dispatchEvent(new Event("trancelogix-session-expired"))
    const fallbackMessage =
      response.status === 503
        ? "The workspace database is not connected yet. Please contact the project administrator."
        : response.status === 401 || response.status === 403
          ? "This deployment requires Vercel access before you can sign in."
          : "The server returned an unexpected response. Check the local server or deployment configuration and try again."
    throw new ApiError(
      data?.error?.message ||
        fallbackMessage,
      response.status,
      data?.error?.code || "request_failed",
    )
  }
  return data as T
}

export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again."
