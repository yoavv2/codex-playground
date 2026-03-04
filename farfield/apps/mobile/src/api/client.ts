/**
 * Authenticated Farfield transport layer for @farfield/mobile.
 *
 * Provides a single `fetchJson()` helper that:
 *   1. Loads connection settings (serverUrl + authToken) via loadSettings()
 *   2. Rejects calls when serverUrl is missing or blank
 *   3. Appends Authorization: Bearer ... when authToken is present
 *   4. Enforces a configurable timeout via AbortController
 *   5. Normalizes all failure modes into typed FarfieldClientError subclasses
 *   6. Validates the response body against a Zod schema when provided
 *
 * All endpoint modules (threads, approvals, agents, etc.) call fetchJson()
 * rather than implementing their own fetch + auth + error handling.
 *
 * Usage:
 *   import { fetchJson } from "@/src/api/client";
 *   import { ThreadListSchema } from "@farfield/protocol";
 *
 *   const threads = await fetchJson("/api/threads", { schema: ThreadListSchema });
 *
 * Error handling:
 *   Callers can import and check individual error classes from ./errors:
 *     NoServerUrlError | UnauthorizedError | ServerUnreachableError |
 *     RequestTimeoutError | HttpError | SchemaMismatchError
 */

import { type ZodType } from "zod";

import { loadSettings } from "@/src/settings/storage";
import {
  HttpError,
  NoServerUrlError,
  RequestTimeoutError,
  SchemaMismatchError,
  ServerUnreachableError,
  UnauthorizedError,
} from "./errors";

/** Default request timeout in milliseconds. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Build actionable messaging for low-level network failures.
 *
 * Browsers often collapse DNS/TCP/CORS failures into a generic "Failed to fetch"
 * error. Add context so UI surfaces useful next steps.
 */
function normalizeNetworkErrorDetail(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.trim().toLowerCase();

  if (
    normalized === "failed to fetch" ||
    normalized.includes("network request failed")
  ) {
    return "Failed to fetch. Verify the server URL, ensure Farfield is running and reachable, and if using Expo web include this app origin in FARFIELD_ALLOWED_ORIGINS (for example http://localhost:8081).";
  }

  return raw;
}

export interface FetchJsonOptions<T> {
  /** HTTP method (default: "GET"). */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Request body (will be JSON-serialized). Only used for non-GET requests. */
  body?: unknown;
  /** Additional request headers (merged on top of auth + content-type headers). */
  headers?: Record<string, string>;
  /** Zod schema to parse the response body against. When provided, a schema
   *  mismatch throws SchemaMismatchError instead of returning raw data. */
  schema?: ZodType<T>;
  /** Request timeout in milliseconds. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Perform an authenticated JSON request against the configured Farfield server.
 *
 * @param path - Server-relative path (e.g. "/api/threads"). Leading slash is
 *               not required but recommended for clarity.
 * @param options - Optional method, body, headers, schema, and timeout.
 * @returns Parsed response body (validated against schema if provided).
 * @throws {NoServerUrlError} If serverUrl is not configured.
 * @throws {UnauthorizedError} If the server returns 401 or 403.
 * @throws {ServerUnreachableError} If the request cannot reach the server.
 * @throws {RequestTimeoutError} If the request exceeds timeoutMs.
 * @throws {HttpError} If the server returns a non-2xx status (other than auth errors).
 * @throws {SchemaMismatchError} If a schema is provided and the body doesn't match.
 */
export async function fetchJson<T = unknown>(
  path: string,
  options: FetchJsonOptions<T> = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    headers: extraHeaders = {},
    schema,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  // Load settings from persistent storage
  const settings = await loadSettings();

  if (!settings.serverUrl || settings.serverUrl.trim() === "") {
    throw new NoServerUrlError();
  }

  // Build the full URL: trim trailing slash from base, ensure leading slash on path
  const baseUrl = settings.serverUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  // Build headers
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...extraHeaders,
  };

  if (settings.authToken && settings.authToken.trim() !== "") {
    headers["Authorization"] = `Bearer ${settings.authToken.trim()}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // Set up timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof Error && err.name === "AbortError") {
      throw new RequestTimeoutError(timeoutMs);
    }

    const detail = normalizeNetworkErrorDetail(err);
    throw new ServerUnreachableError(detail);
  }

  clearTimeout(timer);

  // Handle auth errors specifically
  if (response.status === 401) {
    throw new UnauthorizedError(401);
  }
  if (response.status === 403) {
    throw new UnauthorizedError(403);
  }

  // Handle other non-2xx responses
  if (!response.ok) {
    throw new HttpError(response.status);
  }

  // Parse JSON body
  let rawJson: unknown;
  try {
    rawJson = await response.json();
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new SchemaMismatchError(path, [`Failed to parse response JSON: ${detail}`]);
  }

  // Validate against schema if provided
  if (schema) {
    const result = schema.safeParse(rawJson);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => {
        const issuePath =
          issue.path.length === 0
            ? "<root>"
            : issue.path
                .map((s) => (typeof s === "number" ? `[${s}]` : s))
                .join(".")
                .replace(".[", "[");
        return `${issuePath}: ${issue.message}`;
      });
      throw new SchemaMismatchError(path, issues);
    }
    return result.data;
  }

  return rawJson as T;
}
