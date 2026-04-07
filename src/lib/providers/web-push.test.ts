import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { createWebPushProvider } from "./web-push";

describe("createWebPushProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("in mock mode logs to message_log only", async () => {
    vi.stubEnv("WEB_PUSH_MODE", "mock");
    const prisma = {
      messageLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaClient;
    const wp = createWebPushProvider(prisma);
    const r = await wp.sendSessionMessage(
      {
        id: "sub-1",
        endpoint: "https://push.example/endpoint",
        p256dh: "key",
        auth: "secret",
      },
      "550e8400-e29b-41d4-a716-446655440000",
      "session_msg",
      "Title",
      "Body text",
      "https://app/s/id",
    );
    expect(r.success).toBe(true);
    expect(prisma.messageLog.create).toHaveBeenCalled();
  });
});
