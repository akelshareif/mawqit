/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShareSessionCard } from "./share-session-card";

describe("ShareSessionCard", () => {
  it("renders url and copy button", () => {
    render(<ShareSessionCard url="https://example.com/s/id" />);
    expect(
      screen.getByText("https://example.com/s/id"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("copies url to clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });
    render(<ShareSessionCard url="https://example.com/s/abc" />);
    await user.click(screen.getByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith("https://example.com/s/abc");
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });
});
