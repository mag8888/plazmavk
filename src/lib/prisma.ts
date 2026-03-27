import { PrismaClient } from '@prisma/client';

// SQLite initialization
const dbUrl = process.env.DATABASE_URL || '';
const connectionLimit = 5; // Limit Prisma connections

// Append connection_limit if not present (PostgreSQL specific)
let urlWithLimit = dbUrl;
if (dbUrl.includes('postgres')) {
  if (dbUrl.includes('?')) {
    if (!dbUrl.includes('connection_limit')) {
      urlWithLimit += `&connection_limit=${connectionLimit}`;
    }
  } else {
    urlWithLimit += `?connection_limit=${connectionLimit}`;
  }
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: urlWithLimit,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn'],
});

// Ensure connection is ready
prisma.$connect().catch((e) => {
  console.error('Failed to connect to SQLite database:', e);
});
