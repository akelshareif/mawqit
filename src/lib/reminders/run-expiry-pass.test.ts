import { describe, expect, it, vi } from "vitest";
import { runExpiryPass } from "./run-expiry-pass";

describe("runExpiryPass", () => {
  it("processes zero sessions when findMany is empty", async () => {
    const prisma = {
      session: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as never;
    const now = new Date("2025-06-15T12:00:00.000Z");
    const r = await runExpiryPass(prisma, now);
    expect(r).toEqual({ sessionsProcessed: 0, messagesSent: 0 });
  });
});
