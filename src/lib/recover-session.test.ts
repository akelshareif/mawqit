import { describe, expect, it, vi } from "vitest";
import {
  findSessionForRecovery,
  RECOVER_MESSAGE_LOG_TYPE,
  sendRecoveryLink,
} from "./recover-session";

describe("findSessionForRecovery", () => {
  it("looks up by normalized email", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "s1" });
    const prisma = { session: { findFirst } } as never;
    await findSessionForRecovery(prisma, "email", "a@example.com");
    expect(findFirst).toHaveBeenCalledWith({
      where: { emailAddress: "a@example.com" },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("looks up by phone", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { session: { findFirst } } as never;
    await findSessionForRecovery(prisma, "sms", "+15551234567");
    expect(findFirst).toHaveBeenCalledWith({
      where: { phoneNumber: "+15551234567" },
      orderBy: { updatedAt: "desc" },
    });
  });
});

describe("sendRecoveryLink", () => {
  it("logs email recovery to message_log", async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma = { messageLog: { create } } as never;
    const ok = await sendRecoveryLink(
      prisma,
      { id: "550e8400-e29b-41d4-a716-446655440000" },
      "email",
      "user@example.com",
    );
    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: RECOVER_MESSAGE_LOG_TYPE,
          sessionId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }),
    );
  });

  it("logs SMS recovery to message_log", async () => {
    const create = vi.fn().mockResolvedValue({});
    const prisma = { messageLog: { create } } as never;
    const ok = await sendRecoveryLink(
      prisma,
      { id: "550e8400-e29b-41d4-a716-446655440000" },
      "sms",
      "+15551234567",
    );
    expect(ok).toBe(true);
    expect(create).toHaveBeenCalled();
  });
});
