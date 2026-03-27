import { prisma } from '../lib/prisma.js';

export async function getActiveReviews(limit = 50) {
  return prisma.review.findMany({
    where: { isActive: true },
    orderBy: [
      { isPinned: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });
}
