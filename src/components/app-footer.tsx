const donateUrl = process.env.NEXT_PUBLIC_DONATE_URL;

export function AppFooter() {
  if (!donateUrl) {
    return null;
  }

  return (
    <footer className="border-t border-border/50 bg-background/80 py-6 text-center text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-6">
        <a
          href={donateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground"
        >
          Support / Donate
        </a>
      </div>
    </footer>
  );
}
