import { CronRunStatus } from "@/generated/prisma/enums";
import { verifyCronSecret } from "@/lib/cron-auth";
import { getPrisma } from "@/lib/db";
import {
  getQaReminderClockOffsetMinutes,
  getReminderNow,
  isQaReminderClockEnabled,
} from "@/lib/env";
import { logger } from "@/lib/logger";
import { runBrowserReminderPass } from "@/lib/reminders/run-browser-reminders";
import { runEmailReminderPass } from "@/lib/reminders/run-email-reminders";
import { runExpiryPass } from "@/lib/reminders/run-expiry-pass";
import { runPersistencePass } from "@/lib/reminders/run-persistence-pass";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!verifyCronSecret(auth)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const started = Date.now();

  const run = await prisma.cronRun.create({
    data: {
      status: CronRunStatus.running,
      sessionsProcessed: 0,
      messagesSent: 0,
    },
  });

  try {
    logger.info("cron", "Started reminder run", { runId: run.id });

    const realNow = new Date();
    const reminderNow = getReminderNow(realNow);
    const offsetMin = getQaReminderClockOffsetMinutes();
    if (isQaReminderClockEnabled() && offsetMin !== 0) {
      logger.info("cron", "QA reminder clock active", {
        qaReminderClockOffsetMinutes: offsetMin,
        reminderNowIso: reminderNow.toISOString().slice(0, 19),
      });
    }

    const clocks = { realNow, reminderNow };

    const expiry = await runExpiryPass(prisma, realNow);
    const email = await runEmailReminderPass(prisma, clocks);
    const browser = await runBrowserReminderPass(prisma, clocks);
    const persistence = await runPersistencePass(prisma, clocks);
    const sessionsProcessed =
      expiry.sessionsProcessed +
      email.sessionsProcessed +
      browser.sessionsProcessed +
      persistence.sessionsProcessed;
    const messagesSent =
      expiry.messagesSent +
      email.messagesSent +
      browser.messagesSent +
      persistence.messagesSent;

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: CronRunStatus.success,
        sessionsProcessed,
        messagesSent,
      },
    });

    const ms = Date.now() - started;
    logger.info("cron", "Completed reminder run", {
      sessionsProcessed,
      messagesSent,
      ms,
    });

    return NextResponse.json({
      ok: true,
      sessionsProcessed,
      messagesSent,
      ms,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("cron", "Reminder run failed", { error: message, runId: run.id });

    await prisma.cronRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: CronRunStatus.error,
      },
    });

    return NextResponse.json(
      { ok: false, error: "Reminder run failed." },
      { status: 500 },
    );
  }
}
