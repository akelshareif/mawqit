import { AppFooter } from "@/components/app-footer";
import { SessionSubnav } from "@/components/session-subnav";
import { getPrisma } from "@/lib/db";
import { getEnableDebugTools } from "@/lib/env";
import { isSessionIdFormat } from "@/lib/session-id";
import { notFound } from "next/navigation";

type Props = {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
};

export default async function SessionSectionLayout({ children, params }: Props) {
  const { sessionId } = await params;
  if (!isSessionIdFormat(sessionId)) {
    notFound();
  }

  const session = await getPrisma().session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    notFound();
  }

  const showDebug = getEnableDebugTools();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-b from-sky-100/80 to-cyan-50/60">
      <SessionSubnav sessionId={sessionId} showDebug={showDebug} />
      <div className="flex-1">{children}</div>
      <AppFooter />
    </div>
  );
}
