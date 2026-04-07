import { afterEach, describe, expect, it, vi } from "vitest";
import { handleInbound } from "./handle-inbound";

const sessionEmail = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  emailAddress: "user@example.com",
  phoneNumber: null as string | null,
  timezone: "UTC",
  latitude: 0,
  longitude: 0,
  prayerMethod: "MuslimWorldLeague",
};

function mockPrisma() {
  return {
    session: { findFirst: vi.fn() },
    messageLog: { create: vi.fn().mockResolvedValue({}) },
    channelStatus: { upsert: vi.fn().mockResolvedValue({}) },
    reminderCycle: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
  };
}

describe("handleInbound", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns invalid_address for bad SMS number", async () => {
    const prisma = mockPrisma();
    const r = await handleInbound(prisma as never, "sms", "no-plus", "STOP");
    expect(r.outcome).toBe("invalid_address");
    expect(prisma.session.findFirst).not.toHaveBeenCalled();
  });

  it("returns no_session when address unknown", async () => {
    const prisma = mockPrisma();
    prisma.session.findFirst.mockResolvedValue(null);
    const r = await handleInbound(
      prisma as never,
      "email",
      "nobody@example.com",
      "STOP",
    );
    expect(r.outcome).toBe("no_session");
  });

  it("handles STOP for email session", async () => {
    const prisma = mockPrisma();
    prisma.session.findFirst.mockResolvedValue(sessionEmail);
    const r = await handleInbound(
      prisma as never,
      "email",
      "user@example.com",
      "STOP",
    );
    expect(r.outcome).toBe("stop");
    expect(prisma.channelStatus.upsert).toHaveBeenCalled();
  });

  it("returns empty for blank body after trim", async () => {
    const prisma = mockPrisma();
    prisma.session.findFirst.mockResolvedValue(sessionEmail);
    const r = await handleInbound(prisma as never, "email", "user@example.com", "   ");
    expect(r.outcome).toBe("empty");
  });

  it("returns no_active_cycle when no open cycle", async () => {
    const prisma = mockPrisma();
    prisma.session.findFirst.mockResolvedValue(sessionEmail);
    prisma.reminderCycle.findMany.mockResolvedValue([]);
    const r = await handleInbound(
      prisma as never,
      "email",
      "user@example.com",
      "ack please",
    );
    expect(r.outcome).toBe("no_active_cycle");
  });
});
