import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

/**
 * Prisma 7 + Postgres: driver adapter. Call only when DATABASE_URL is set.
 */
export function getPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const pool = globalForPrisma.pool ?? new Pool({ connectionString: url });
  globalForPrisma.pool = pool;

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

  globalForPrisma.prisma = prisma;
  return prisma;
}
