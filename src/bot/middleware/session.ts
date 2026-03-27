
import { Context } from '../context.js';
import { prisma } from '../../lib/prisma.js';

export async function prismaSession(ctx: Context, next: () => Promise<void>) {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const key = `session:${userId}`;

    // Load session
    try {
        const record = await prisma.settings.findUnique({
            where: { key }
        });

        // Initialize session
        ctx.session = record?.value ? JSON.parse(record.value) : {};

        // Ensure default values
        if (!ctx.session) ctx.session = {};
        if (!ctx.session.uiMode) ctx.session.uiMode = 'classic';

    } catch (err) {
        console.error('Session load error:', err);
        ctx.session = {};
    }

    // Run next middleware
    await next();

    // Save session
    try {
        // Only save if session exists
        if (ctx.session) {
            const value = JSON.stringify(ctx.session);
            await prisma.settings.upsert({
                where: { key },
                update: { value },
                create: { key, value, description: 'User Session' }
            });
        }
    } catch (err) {
        console.error('Session save error:', err);
    }
}
