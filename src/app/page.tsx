import { startSessionAction } from "@/app/actions/start-session";
import { AppFooter } from "@/components/app-footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-sky-100/80 to-cyan-50/60">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="space-y-3 text-center sm:text-left">
          <h1 className="font-heading text-3xl text-primary sm:text-4xl dark:text-sky-400">
            Mawqit
          </h1>
          <p className="text-lg text-muted-foreground">
            Prayer-time reminders by email and browser. Create a private session
            link and choose how you want to be notified.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <form action={startSessionAction}>
            <Button
              type="submit"
              className="h-12 min-w-[10rem] rounded-xl px-8 text-base"
            >
              Get started
            </Button>
          </form>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-xl border-border/80 bg-card/60 text-base"
          >
            <Link href="/recover">Lost your link?</Link>
          </Button>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
