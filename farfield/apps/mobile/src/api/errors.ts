/**
 * Typed client error hierarchy for @farfield/mobile API calls.
 *
 * All endpoint modules surface one of these error types so callers can handle
 * failures consistently without inspecting raw fetch rejections.
 *
 * Error taxonomy:
 *   FarfieldClientError   — base class; never thrown directly
 *     NoServerUrlError    — serverUrl is missing or blank in settings
 *     UnauthorizedError   — server returned HTTP 401 or 403
 *     ServerUnreachableError — network / DNS / connection refused
 *     RequestTimeoutError — request exceeded configured timeout
 *     HttpError           — non-2xx response (4xx/5xx, not 401/403)
 *     SchemaMismatchError — response body did not match expected Zod schema
 */

/** Base class for all Farfield client errors. */
export class FarfieldClientError extends Error {
  public readonly kind: string;

  constructor(kind: string, message: string) {
    super(message);
    this.name = "FarfieldClientError";
    this.kind = kind;
  }
}

/** serverUrl is missing or blank — the user has not configured the server. */
export class NoServerUrlError extends FarfieldClientError {
  constructor() {
    super("NoServerUrl", "No server URL configured. Please set one in Settings.");
    this.name = "NoServerUrlError";
  }
}

/** The server returned HTTP 401 or 403. */
export class UnauthorizedError extends FarfieldClientError {
  public readonly statusCode: number;

  constructor(statusCode: 401 | 403) {
    super(
      "Unauthorized",
      statusCode === 401
        ? "Authentication required. Check your auth token in Settings."
        : "Access denied. Your auth token does not have permission."
    );
    this.name = "UnauthorizedError";
    this.statusCode = statusCode;
  }
}

/** The server could not be reached (network error, DNS failure, connection refused). */
export class ServerUnreachableError extends FarfieldClientError {
  public readonly detail: string;

  constructor(detail: string) {
    super("ServerUnreachable", `Server unreachable: ${detail}`);
    this.name = "ServerUnreachableError";
    this.detail = detail;
  }
}

/** The request timed out before the server responded. */
export class RequestTimeoutError extends FarfieldClientError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      "RequestTimeout",
      `Request timed out after ${timeoutMs / 1000}s. Check the server URL and network.`
    );
    this.name = "RequestTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** The server responded with a non-2xx HTTP status that is not 401 or 403. */
export class HttpError extends FarfieldClientError {
  public readonly statusCode: number;

  constructor(statusCode: number) {
    super("HttpError", `Server returned HTTP ${statusCode}`);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

/** The response body did not conform to the expected Zod schema. */
export class SchemaMismatchError extends FarfieldClientError {
  public readonly context: string;
  public readonly issues: string[];

  constructor(context: string, issues: string[]) {
    super(
      "SchemaMismatch",
      `Response for ${context} did not match expected schema. ${issues.join("; ")}`
    );
    this.name = "SchemaMismatchError";
    this.context = context;
    this.issues = issues;
  }
}
