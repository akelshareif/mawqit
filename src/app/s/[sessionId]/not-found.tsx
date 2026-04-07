import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SessionNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold text-foreground">
        Session not found
      </h1>
      <p className="text-muted-foreground">
        This link may be wrong or expired. Start fresh and we&apos;ll create a
        new session for you.
      </p>
      <Button asChild className="rounded-xl">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
