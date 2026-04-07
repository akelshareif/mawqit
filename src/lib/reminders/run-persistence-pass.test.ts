import { describe, expect, it, vi } from "vitest";
import { runPersistencePass } from "./run-persistence-pass";

describe("runPersistencePass", () => {
  it("does nothing when no cycles", async () => {
    const prisma = {
      reminderCycle: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as never;
    const clocks = {
      realNow: new Date("2025-06-15T12:00:00.000Z"),
      reminderNow: new Date("2025-06-15T12:00:00.000Z"),
    };
    const r = await runPersistencePass(prisma, clocks);
    expect(r).toEqual({ sessionsProcessed: 0, messagesSent: 0 });
  });
});
