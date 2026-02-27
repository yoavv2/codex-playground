export interface ServerSecurityConfig {
  host: string;
  isRemoteBind: boolean;
  authToken: string | null;
  allowedOrigins: string[];
  enableDebugApi: boolean;
  requireAuthForHealth: boolean;
}

export interface ServerSecurityConfigInput {
  host: string;
  authToken?: string | undefined;
  allowedOrigins?: string | undefined;
  enableDebugApi?: string | undefined;
  requireAuthForHealth?: string | undefined;
}

type HeaderValue = string | string[] | undefined;

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return defaultValue;
}

function firstHeaderValue(value: HeaderValue): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    return typeof first === "string" ? first : null;
  }

  return null;
}

function isLocalHostBinding(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

function normalizeAuthToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const token = value.trim();
  return token.length > 0 ? token : null;
}

function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of raw.split(",")) {
    const origin = token.trim();
    if (!origin || seen.has(origin)) {
      continue;
    }
    seen.add(origin);
    result.push(origin);
  }

  return result;
}

function usesLocalWildcardCors(config: ServerSecurityConfig): boolean {
  return !config.isRemoteBind && config.allowedOrigins.length === 0;
}

function normalizeOriginHeader(originHeader: HeaderValue): string | null {
  const value = firstHeaderValue(originHeader);
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createServerSecurityConfig(
  input: ServerSecurityConfigInput
): ServerSecurityConfig {
  const isRemoteBind = !isLocalHostBinding(input.host);

  return {
    host: input.host,
    isRemoteBind,
    authToken: normalizeAuthToken(input.authToken),
    allowedOrigins: parseAllowedOrigins(input.allowedOrigins),
    enableDebugApi: parseBooleanEnv(input.enableDebugApi, !isRemoteBind),
    requireAuthForHealth: parseBooleanEnv(input.requireAuthForHealth, false)
  };
}

export function isDebugApiPath(pathname: string): boolean {
  return pathname === "/api/debug" || pathname.startsWith("/api/debug/");
}

export function requiresAuth(pathname: string, config: ServerSecurityConfig): boolean {
  if (!config.authToken) {
    return false;
  }

  if (pathname === "/events") {
    return true;
  }

  if (!pathname.startsWith("/api/")) {
    return false;
  }

  if (pathname === "/api/health" && !config.requireAuthForHealth) {
    return false;
  }

  return true;
}

export function extractBearerToken(authorizationHeader: HeaderValue): string | null {
  const raw = firstHeaderValue(authorizationHeader);
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex <= 0) {
    return null;
  }

  const scheme = trimmed.slice(0, spaceIndex).toLowerCase();
  if (scheme !== "bearer") {
    return null;
  }

  const token = trimmed.slice(spaceIndex + 1).trim();
  return token.length > 0 ? token : null;
}

export function resolveRequestAuthToken(
  pathname: string,
  url: URL,
  authorizationHeader: HeaderValue
): string | null {
  const headerToken = extractBearerToken(authorizationHeader);
  if (headerToken) {
    return headerToken;
  }

  if (pathname === "/events") {
    const queryToken = url.searchParams.get("access_token");
    if (queryToken && queryToken.trim().length > 0) {
      return queryToken.trim();
    }
  }

  return null;
}

export function isAuthorizedRequest(
  pathname: string,
  url: URL,
  authorizationHeader: HeaderValue,
  config: ServerSecurityConfig
): boolean {
  if (!requiresAuth(pathname, config)) {
    return true;
  }

  const requestToken = resolveRequestAuthToken(pathname, url, authorizationHeader);
  return requestToken !== null && requestToken === config.authToken;
}

export function isCorsOriginAllowed(
  originHeader: HeaderValue,
  config: ServerSecurityConfig
): boolean {
  const origin = normalizeOriginHeader(originHeader);
  if (!origin) {
    return usesLocalWildcardCors(config);
  }

  if (usesLocalWildcardCors(config)) {
    return true;
  }

  return config.allowedOrigins.includes(origin);
}

export function isPreflightOriginAllowed(
  originHeader: HeaderValue,
  config: ServerSecurityConfig
): boolean {
  return isCorsOriginAllowed(originHeader, config);
}

export function buildCorsHeaders(
  originHeader: HeaderValue,
  config: ServerSecurityConfig
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };

  const origin = normalizeOriginHeader(originHeader);

  if (usesLocalWildcardCors(config)) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }

  if (config.allowedOrigins.length > 0) {
    headers["Vary"] = "Origin";
  }

  if (origin && config.allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}
