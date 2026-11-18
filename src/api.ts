export class ApiError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function responseFallbackMessage(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (response.url.includes("vercel.com/sso-api"))
    return "This Vercel deployment is protected. Sign in to Vercel with project access, or ask the project owner to disable Deployment Protection."
  if (response.status === 503)
    return "The workspace database is not connected yet. Please contact the project administrator."
  if (response.status === 401 || response.status === 403)
    return "The hosting service denied API access. Ask the project administrator to check site access settings."
  if (contentType.includes("text/html"))
    return "The TranceLogix API is unavailable on this deployment. Ask the project administrator to check the API function and routing configuration."
  return "The server returned an invalid API response. Check the local server or deployment configuration and try again."
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
    throw new ApiError(
      data?.error?.message || responseFallbackMessage(response),
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
