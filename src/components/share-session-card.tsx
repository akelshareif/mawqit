"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useState } from "react";

type Props = {
  url: string;
  /** When set with `daysUntilRenewal`, shows session renewal / expiry copy in the header. */
  sessionId?: string;
  /** Days until `expiresAt`; `null` if no expiry date; negative if past renewal window. */
  daysUntilRenewal?: number | null;
};

export function ShareSessionCard({
  url,
  sessionId,
  daysUntilRenewal,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your session link</CardTitle>
        <CardDescription>
          Bookmark or copy this link — it&apos;s how you open Mawqit on any
          device. If you enabled email, keep that address current so
          reminders and recovery can reach you.
        </CardDescription>
        {sessionId != null &&
        daysUntilRenewal != null &&
        daysUntilRenewal >= 0 ? (
          <p className="text-sm text-muted-foreground">
            Session renews in{" "}
            <span className="font-medium text-foreground">
              {daysUntilRenewal}
            </span>{" "}
            {daysUntilRenewal === 1 ? "day" : "days"} — open{" "}
            <Link
              href={`/s/${sessionId}/settings`}
              className="font-medium text-primary underline underline-offset-2"
            >
              Location &amp; Reminders
            </Link>{" "}
            and save to extend.
          </p>
        ) : null}
        {sessionId != null && daysUntilRenewal != null && daysUntilRenewal < 0 ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This session may be past its renewal window — open{" "}
            <Link
              href={`/s/${sessionId}/settings`}
              className="font-medium text-primary underline underline-offset-2"
            >
              Location &amp; Reminders
            </Link>{" "}
            and save to extend. Email and browser expiry notices are sent
            automatically before your session ends.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="break-all rounded-lg border border-border/50 bg-muted/40 px-3 py-2 font-mono text-sm text-foreground">
          {url}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-11 rounded-xl"
          onClick={() => void copy()}
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </CardContent>
    </Card>
  );
}
