/**
 * Lightweight health-check against the Farfield server.
 *
 * Calls GET /api/health — unauthenticated by default (per Phase 02 contract).
 * If the server has FARFIELD_REQUIRE_AUTH_FOR_HEALTH=true, the auth token is
 * included as a Bearer Authorization header.
 *
 * Returns a HealthCheckResult suitable for user-visible feedback in the
 * Connection screen.
 *
 * Phase 04-compatible: uses the standard fetch API. TanStack Query wrappers
 * can be layered on top in Phase 04 without touching this module.
 */

export type HealthCheckResult =
  | { ok: true; message: string; statusCode: number }
  | { ok: false; message: string; statusCode?: number };

/**
 * Run a GET /api/health request against the given serverUrl.
 *
 * @param serverUrl - Base URL of the Farfield server (e.g. http://100.x.x.x:4311)
 * @param authToken - Optional bearer token; included if provided and non-empty
 * @param timeoutMs - Request timeout in milliseconds (default 8000)
 */
export async function checkHealth(
  serverUrl: string,
  authToken?: string,
  timeoutMs = 8000
): Promise<HealthCheckResult> {
  if (!serverUrl) {
    return { ok: false, message: "No server URL configured." };
  }

  const url = `${serverUrl.replace(/\/$/, "")}/api/health`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (response.ok) {
      return {
        ok: true,
        message: `Server reachable (HTTP ${response.status})`,
        statusCode: response.status,
      };
    }

    return {
      ok: false,
      message: `Server returned HTTP ${response.status}`,
      statusCode: response.status,
    };
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        message: `Request timed out after ${timeoutMs / 1000}s. Check the server URL and network.`,
      };
    }

    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Network error: ${detail}`,
    };
  }
}
