/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFooter } from "./app-footer";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("AppFooter", () => {
  it("does not show lost-link recover entry (that lives on the landing page only)", () => {
    render(<AppFooter />);
    expect(screen.queryByRole("link", { name: /lost your link/i })).not.toBeInTheDocument();
  });

  it("shows donate link when NEXT_PUBLIC_DONATE_URL is set at load time", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_DONATE_URL", "https://donate.example");
    const { AppFooter: Footer } = await import("./app-footer");
    render(<Footer />);
    expect(
      screen.getByRole("link", { name: /support.*donate/i }),
    ).toHaveAttribute("href", "https://donate.example");
    vi.unstubAllEnvs();
  });
});
