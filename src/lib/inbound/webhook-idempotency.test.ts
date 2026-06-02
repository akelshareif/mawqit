import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimWebhookEvent,
  releaseWebhookEvent,
} from "./webhook-idempotency";

function mockPrisma() {
  return {
    webhookEvent: {
      create: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
}

describe("webhook idempotency", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("claims an unseen event id", async () => {
    const prisma = mockPrisma();
    prisma.webhookEvent.create.mockResolvedValue({});
    const claimed = await claimWebhookEvent(
      prisma as never,
      "msg_1",
      "resend",
      "email.received",
    );
    expect(claimed).toBe(true);
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({
      data: { id: "msg_1", source: "resend", type: "email.received" },
    });
  });

  it("returns false on a duplicate (unique violation)", async () => {
    const prisma = mockPrisma();
    prisma.webhookEvent.create.mockRejectedValue({ code: "P2002" });
    const claimed = await claimWebhookEvent(
      prisma as never,
      "msg_1",
      "resend",
      "email.received",
    );
    expect(claimed).toBe(false);
  });

  it("rethrows non-unique errors", async () => {
    const prisma = mockPrisma();
    prisma.webhookEvent.create.mockRejectedValue(new Error("connection lost"));
    await expect(
      claimWebhookEvent(prisma as never, "msg_1", "resend", "email.received"),
    ).rejects.toThrow("connection lost");
  });

  it("releases a claim by id", async () => {
    const prisma = mockPrisma();
    await releaseWebhookEvent(prisma as never, "msg_1");
    expect(prisma.webhookEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: "msg_1" },
    });
  });
});
