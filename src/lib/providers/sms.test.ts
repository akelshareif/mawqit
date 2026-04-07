import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createMockSmsProvider } from "./sms";

describe("createMockSmsProvider", () => {
  it("writes message_log on send", async () => {
    const prisma = {
      messageLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;
    const sms = createMockSmsProvider(prisma);
    const r = await sms.send("+1234567890123", "Hello", {
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      messageLogType: "test_sms",
    });
    expect(r.success).toBe(true);
    expect(prisma.messageLog.create).toHaveBeenCalled();
  });
});
