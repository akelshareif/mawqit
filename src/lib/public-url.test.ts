import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicBaseUrl, sessionUrl } from "./public-url";

describe("getPublicBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to localhost when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(getPublicBaseUrl()).toBe("http://localhost:3000");
  });

  it("uses VERCEL_URL when NEXT_PUBLIC_APP_URL is unset (Vercel)", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");
    expect(getPublicBaseUrl()).toBe("https://my-app.vercel.app");
  });

  it("prefers NEXT_PUBLIC_APP_URL over VERCEL_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://custom.example");
    vi.stubEnv("VERCEL_URL", "my-app.vercel.app");
    expect(getPublicBaseUrl()).toBe("https://custom.example");
  });

  it("strips trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/");
    expect(getPublicBaseUrl()).toBe("https://example.com");
  });
});

describe("sessionUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds share URL with session id", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example");
    expect(sessionUrl("abc-123")).toBe("https://app.example/s/abc-123");
  });
});
