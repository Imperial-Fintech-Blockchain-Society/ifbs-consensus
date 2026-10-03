import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchema?: string;
};
// Fast Refresh preserves globals, including clients created before a schema change.
const schema = JSON.stringify(Prisma.dmmf.datamodel);
const cached = globalDb.prismaSchema === schema ? globalDb.prisma : undefined;
if (!cached && globalDb.prisma) void globalDb.prisma.$disconnect();
export const db = cached ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalDb.prisma = db;
  globalDb.prismaSchema = schema;
}
