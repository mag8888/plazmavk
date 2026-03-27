// Add giftToken and fromUserId columns to GiftCertificate
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    await prisma.$executeRawUnsafe(`
    ALTER TABLE "GiftCertificate"
      ADD COLUMN IF NOT EXISTS "fromUserId" TEXT,
      ADD COLUMN IF NOT EXISTS "giftToken" TEXT;
  `);
    await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "GiftCertificate_giftToken_key"
    ON "GiftCertificate"("giftToken");
  `);
    await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "GiftCertificate_giftToken_idx"
    ON "GiftCertificate"("giftToken");
  `);
    // Add FK for fromUserId if not exists (ignore if already there)
    try {
        await prisma.$executeRawUnsafe(`
      ALTER TABLE "GiftCertificate"
        ADD CONSTRAINT "GiftCertificate_fromUserId_fkey"
        FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    } catch (e) { }

    console.log('✅ Gift certificate fields added successfully');
}

main().catch(console.error).finally(() => prisma.$disconnect());
