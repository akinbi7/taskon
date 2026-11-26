import { getInitData } from "./telegram";
import { ApiError } from "./errors";

export { ApiError } from "./errors";

const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
const DEMO_FLAG = import.meta.env.VITE_DEMO === "1";

/** Local preview only: no initData and VITE_DEMO=1. Never set it in production. */
export function isDemoMode(): boolean {
  return DEMO_FLAG && !getInitData();
}

export async function apiCall<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  if (isDemoMode()) {
    const { demoCall } = await import("./demo");
    return demoCall<T>(action, payload);
  }

  if (!API_BASE) {
    throw new ApiError(
      "not_configured",
      "Taskon isn't connected to its server yet. The admin needs to set VITE_API_URL.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        initData: getInitData(),
        payload,
      }),
    });
  } catch {
    throw new ApiError(
      "network",
      "Can't reach Taskon right now. Check your connection and try again.",
    );
  }

  const body = (await response.json().catch(() => null)) as
    | { data?: T; error?: { code?: string; message?: string } }
    | null;

  if (!response.ok || body?.error) {
    throw new ApiError(
      body?.error?.code ?? "http_error",
      body?.error?.message ?? "The server didn't like that request. Try again.",
    );
  }

  return body?.data as T;
}
