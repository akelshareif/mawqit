/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SetupFormInitial } from "./setup-form";
import { SetupForm } from "./setup-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn() }),
}));

const initial: SetupFormInitial = {
  latitude: null,
  longitude: null,
  timezone: null,
  emailEnabled: true,
  emailAddress: "",
  browserNotificationsEnabled: false,
  persistentReminders: true,
  persistenceCadenceMinutes: 15,
  followupEnabled: false,
  followupDelayMinutes: 15,
  prayerMethod: "MuslimWorldLeague",
};

describe("SetupForm", () => {
  it("renders heading and save action", () => {
    render(
      <SetupForm
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        initial={initial}
      />,
    );
    expect(screen.getByRole("heading", { name: /set up reminders/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save and continue/i }),
    ).toBeInTheDocument();
  });

  it("does not show delete section for first-time setup", () => {
    render(
      <SetupForm
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        initial={initial}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: /delete my data/i }),
    ).not.toBeInTheDocument();
  });

  it("shows delete section when session already has saved location", () => {
    render(
      <SetupForm
        sessionId="550e8400-e29b-41d4-a716-446655440000"
        initial={{
          ...initial,
          latitude: 40,
          longitude: -74,
          timezone: "America/New_York",
        }}
        showDeleteDataSection
      />,
    );
    expect(
      screen.getByRole("heading", { name: /delete my data/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete all my data/i }),
    ).toBeDisabled();
  });
});
