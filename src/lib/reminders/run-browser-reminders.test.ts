import { describe, expect, it, vi } from "vitest";
import { runBrowserReminderPass } from "./run-browser-reminders";

describe("runBrowserReminderPass", () => {
  it("sends nothing when no subscriptions", async () => {
    const prisma = {
      pushSubscription: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as never;
    const clocks = {
      realNow: new Date("2025-06-15T12:00:00.000Z"),
      reminderNow: new Date("2025-06-15T12:00:00.000Z"),
    };
    const r = await runBrowserReminderPass(prisma, clocks);
    expect(r).toEqual({ sessionsProcessed: 0, messagesSent: 0 });
  });
});
