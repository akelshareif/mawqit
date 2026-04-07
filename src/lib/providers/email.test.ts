import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createMockEmailProvider } from "./email";

describe("createMockEmailProvider", () => {
  it("writes message_log on send", async () => {
    const prisma = {
      messageLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;
    const email = createMockEmailProvider(prisma);
    const r = await email.send("to@example.com", "Subject", "Body", {
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      messageLogType: "test_outbound",
    });
    expect(r.success).toBe(true);
    expect(prisma.messageLog.create).toHaveBeenCalled();
  });
});
