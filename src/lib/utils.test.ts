import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
