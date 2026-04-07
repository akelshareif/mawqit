import { getPrisma } from "@/lib/db";
import { isSessionIdFormat } from "@/lib/session-id";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ sessionId: string }> };

/**
 * Session root: always forwards to the dashboard (placeholders when setup is incomplete).
 */
export default async function SessionRootPage({ params }: PageProps) {
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

  redirect(`/s/${sessionId}/dashboard`);
}
