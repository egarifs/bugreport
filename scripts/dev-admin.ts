// Local helper: make one email an ACTIVE super admin in the dev database.
// Usage: npx tsx scripts/dev-admin.ts you@example.com
import { PrismaClient, UserStatus } from "@prisma/client";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run with NODE_ENV=production.");
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Usage: npx tsx scripts/dev-admin.ts you@example.com");

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: email.split("@")[0], status: UserStatus.ACTIVE, isAdmin: true },
      update: { status: UserStatus.ACTIVE, isAdmin: true },
    });
    console.log(`OK: ${user.email} is ACTIVE super admin (id ${user.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
