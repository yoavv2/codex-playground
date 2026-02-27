import { describe, expect, it } from "vitest";
import {
  buildCorsHeaders,
  createServerSecurityConfig,
  isAuthorizedRequest,
  isDebugApiPath,
  isPreflightOriginAllowed,
  requiresAuth
} from "../src/security.js";

describe("server security config", () => {
  it("defaults debug API to enabled on local bind", () => {
    const config = createServerSecurityConfig({
      host: "127.0.0.1"
    });

    expect(config.isRemoteBind).toBe(false);
    expect(config.enableDebugApi).toBe(true);
  });

  it("defaults debug API to disabled on remote bind", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0"
    });

    expect(config.isRemoteBind).toBe(true);
    expect(config.enableDebugApi).toBe(false);
  });

  it("parses allowlisted origins and dedupes entries", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0",
      allowedOrigins: "https://a.example, https://a.example, https://b.example"
    });

    expect(config.allowedOrigins).toEqual(["https://a.example", "https://b.example"]);
  });
});

describe("server auth policy", () => {
  it("does not require auth when no token is configured", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0"
    });

    expect(requiresAuth("/api/threads", config)).toBe(false);
    expect(requiresAuth("/events", config)).toBe(false);
  });

  it("requires auth for API routes and events when token is configured", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0",
      authToken: "secret"
    });

    expect(requiresAuth("/api/threads", config)).toBe(true);
    expect(requiresAuth("/events", config)).toBe(true);
    expect(requiresAuth("/api/health", config)).toBe(false);
  });

  it("can require auth for health when explicitly enabled", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0",
      authToken: "secret",
      requireAuthForHealth: "true"
    });

    expect(requiresAuth("/api/health", config)).toBe(true);
  });

  it("authorizes bearer token requests", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0",
      authToken: "secret"
    });
    const url = new URL("http://127.0.0.1/api/threads");

    expect(isAuthorizedRequest("/api/threads", url, "Bearer secret", config)).toBe(true);
    expect(isAuthorizedRequest("/api/threads", url, "Bearer wrong", config)).toBe(false);
    expect(isAuthorizedRequest("/api/threads", url, undefined, config)).toBe(false);
  });

  it("accepts access_token query param for events", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0",
      authToken: "secret"
    });
    const url = new URL("http://127.0.0.1/events?access_token=secret");

    expect(isAuthorizedRequest("/events", url, undefined, config)).toBe(true);
  });
});

describe("server CORS policy", () => {
  it("uses wildcard CORS for local bind when no allowlist is configured", () => {
    const config = createServerSecurityConfig({
      host: "127.0.0.1"
    });

    const headers = buildCorsHeaders("http://localhost:4312", config);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
    expect(headers["Access-Control-Allow-Headers"]).toContain("authorization");
  });

  it("mirrors allowed origin in remote mode", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0",
      allowedOrigins: "https://phone-ui.example"
    });

    const headers = buildCorsHeaders("https://phone-ui.example", config);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://phone-ui.example");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("does not allow remote origins when allowlist is absent", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0"
    });

    const headers = buildCorsHeaders("https://phone-ui.example", config);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(isPreflightOriginAllowed("https://phone-ui.example", config)).toBe(false);
  });

  it("rejects disallowed origins when allowlist is configured", () => {
    const config = createServerSecurityConfig({
      host: "0.0.0.0",
      allowedOrigins: "https://allowed.example"
    });

    expect(isPreflightOriginAllowed("https://blocked.example", config)).toBe(false);
    expect(isPreflightOriginAllowed("https://allowed.example", config)).toBe(true);
  });
});

describe("debug path detection", () => {
  it("identifies debug routes", () => {
    expect(isDebugApiPath("/api/debug/history")).toBe(true);
    expect(isDebugApiPath("/api/debug/trace/start")).toBe(true);
    expect(isDebugApiPath("/api/threads")).toBe(false);
  });
});
