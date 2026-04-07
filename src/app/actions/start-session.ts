"use server";

import { getPrisma } from "@/lib/db";
import { redirect } from "next/navigation";

export async function startSessionAction() {
  const session = await getPrisma().session.create({ data: {} });
  redirect(`/s/${session.id}/setup`);
}
