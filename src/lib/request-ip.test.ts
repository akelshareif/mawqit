import { describe, expect, it } from "vitest";
import { getRequestIp } from "./request-ip";

describe("getRequestIp", () => {
  it("uses x-forwarded-for first hop", () => {
    const req = new Request("https://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getRequestIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://x", {
      headers: { "x-real-ip": "9.9.9.9" },
    });
    expect(getRequestIp(req)).toBe("9.9.9.9");
  });

  it("returns unknown when absent", () => {
    const req = new Request("https://x");
    expect(getRequestIp(req)).toBe("unknown");
  });
});
