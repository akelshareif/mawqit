/**
 * Startup checks (Slice 9). Next.js loads this once per server process.
 */
export async function register(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const wantsDebug =
    process.env.ENABLE_DEBUG_TOOLS?.trim().toLowerCase() === "true";
  const allowed =
    process.env.ALLOW_DEBUG_TOOLS_IN_PRODUCTION?.trim().toLowerCase() ===
    "true";
  if (wantsDebug && !allowed) {
    console.warn(
      "[mawqit] ENABLE_DEBUG_TOOLS is set but ignored in production. Set ALLOW_DEBUG_TOOLS_IN_PRODUCTION=true only on staging if you need debug routes.",
    );
  }
}
