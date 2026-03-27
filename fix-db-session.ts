import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Recreating session table for connect-pg-simple...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      ) WITH (OIDS=FALSE);
    `);
    
    // Check if primary key exists before adding it
    try {
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        `);
    } catch (e) {
        console.log('Primary key might already exist:', e.message);
    }
    
    // Check if index exists before adding it
    try {
        await prisma.$executeRawUnsafe(`
          CREATE INDEX "IDX_session_expire" ON "session" ("expire");
        `);
    } catch (e) {
        console.log('Index might already exist:', e.message);
    }
    
    console.log('Session table successfully recreated.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
