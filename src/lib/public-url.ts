/**
 * Public app origin for share links.
 *
 * 1. **`NEXT_PUBLIC_APP_URL`** — set this in production to your canonical URL
 *    (e.g. `https://yourdomain.com` or `https://your-app.vercel.app`), no trailing slash.
 *    On Vercel: Project → Settings → Environment Variables → Production, then redeploy.
 * 2. **`VERCEL_URL`** — on Vercel, if `NEXT_PUBLIC_APP_URL` is unset, we use
 *    `https://` + this value (the deployment hostname) so links work without extra config.
 * 3. Local dev fallback: `http://localhost:3000`.
 */
export function getPublicBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function sessionUrl(sessionId: string): string {
  return `${getPublicBaseUrl()}/s/${sessionId}`;
}
