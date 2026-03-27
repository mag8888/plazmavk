import express from 'express';
import { prisma } from '../lib/prisma.js';

export const promotionsApiRouter = express.Router();

// GET /api/promotions - Get active promotions
promotionsApiRouter.get('/', async (req, res) => {
    try {
        const promotions = await prisma.promotion.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
            include: {
                product: {
                    select: {
                        id: true,
                        title: true,
                        price: true,
                        imageUrl: true,
                        isActive: true
                    }
                }
            }
        });

        res.json(promotions);
    } catch (error) {
        console.error('Error fetching promotions:', error);
        res.status(500).json({ error: 'Failed to fetch promotions' });
    }
});
