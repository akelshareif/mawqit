import { Resend } from "resend";

export type ReceivedEmail = { from: string; text: string };

/**
 * Resend's `email.received` webhook carries metadata only — not the body. Fetch
 * the full message by id to get the sender and plain-text body that
 * `handleInbound` parses (STOP / HELP / ack are plain words, so `text` is what we
 * need; HTML-only replies degrade to an empty body, handled as `outcome: "empty"`).
 *
 * Throws on a missing API key or any Resend error so the caller can release the
 * idempotency claim and let Resend retry.
 */
export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set; cannot fetch inbound email body");
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.receiving.get(emailId);
  if (error || !data) {
    const detail = error ? JSON.stringify(error) : "no data returned";
    throw new Error(`Resend receiving.get failed: ${detail}`);
  }

  return { from: data.from, text: data.text ?? "" };
}
