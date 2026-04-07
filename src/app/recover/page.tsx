import { RecoverForm } from "@/components/recover-form";
import { AppFooter } from "@/components/app-footer";
import Link from "next/link";

export default function RecoverPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-sky-100/80 to-cyan-50/60">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="space-y-2 text-center sm:text-left">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Recover your link
          </h1>
          <p className="text-muted-foreground">
            We&apos;ll email your session link to the address on file.
            If nothing matches, you won&apos;t get a message — start a new
            session from the home page anytime.
          </p>
        </div>

        <RecoverForm />

        <Link
          href="/"
          className="text-center text-sm font-medium text-primary hover:underline sm:text-left"
        >
          ← Back to home
        </Link>
      </main>
      <AppFooter />
    </div>
  );
}
