/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathnameRef = { value: "/s/550e8400-e29b-41d4-a716-446655440000/dashboard" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.value,
}));

import { SessionSubnav } from "./session-subnav";

const id = "550e8400-e29b-41d4-a716-446655440000";

const locationRemindersName = /location & reminders/i;

describe("SessionSubnav", () => {
  it("renders Mawqit logo, Home, and Location & Reminders", () => {
    pathnameRef.value = `/s/${id}/setup`;
    render(<SessionSubnav sessionId={id} showDebug={false} />);
    expect(screen.getByRole("link", { name: /^Mawqit$/i })).toHaveAttribute(
      "href",
      `/s/${id}/dashboard`,
    );
    expect(screen.getByRole("link", { name: /^home$/i })).toHaveAttribute(
      "href",
      `/s/${id}/dashboard`,
    );
    expect(screen.getByRole("link", { name: locationRemindersName })).toHaveAttribute(
      "href",
      `/s/${id}/settings`,
    );
  });

  it("marks Home current on dashboard path", () => {
    pathnameRef.value = `/s/${id}/dashboard`;
    render(<SessionSubnav sessionId={id} showDebug={false} />);
    expect(screen.getByRole("link", { name: /^home$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows Debug when showDebug is true", () => {
    pathnameRef.value = `/s/${id}/dashboard`;
    render(<SessionSubnav sessionId={id} showDebug />);
    expect(screen.getByRole("link", { name: /^debug$/i })).toHaveAttribute(
      "href",
      `/s/${id}/debug`,
    );
  });

  it("marks Location & Reminders current on setup path", () => {
    pathnameRef.value = `/s/${id}/setup`;
    render(<SessionSubnav sessionId={id} showDebug={false} />);
    const link = screen.getByRole("link", { name: locationRemindersName });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("marks Location & Reminders current with trailing slash on setup", () => {
    pathnameRef.value = `/s/${id}/setup/`;
    render(<SessionSubnav sessionId={id} showDebug={false} />);
    expect(
      screen.getByRole("link", { name: locationRemindersName }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("does not link to site root", () => {
    pathnameRef.value = `/s/${id}/settings`;
    render(<SessionSubnav sessionId={id} showDebug={false} />);
    expect(screen.queryByRole("link", { name: /^\/$/ })).not.toBeInTheDocument();
    const links = screen.getAllByRole("link");
    for (const a of links) {
      expect(a.getAttribute("href")).not.toBe("/");
    }
  });
});
