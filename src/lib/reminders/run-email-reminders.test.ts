import { describe, expect, it, vi } from "vitest";
import { runEmailReminderPass } from "./run-email-reminders";

describe("runEmailReminderPass", () => {
  it("sends nothing when no sessions match", async () => {
    const prisma = {
      session: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as never;
    const clocks = {
      realNow: new Date("2025-06-15T12:00:00.000Z"),
      reminderNow: new Date("2025-06-15T12:00:00.000Z"),
    };
    const r = await runEmailReminderPass(prisma, clocks);
    expect(r).toEqual({ sessionsProcessed: 0, messagesSent: 0 });
  });
});
