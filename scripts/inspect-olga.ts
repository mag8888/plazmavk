
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectUser() {
    const username = 'Olga_brug';
    console.log(`🔍 Searching for user: @${username}`);

    try {
        const user = await prisma.user.findFirst({
            where: {
                username: {
                    equals: username,
                    mode: 'insensitive'
                }
            },
            include: {
                partner: true,
                // Removed cart include as it might not be defined in this schema version
                orders: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (user) {
            console.log('✅ User Found:');
            console.log(JSON.stringify(user, null, 2));

            // Check for duplicates
            const count = await prisma.user.count({
                where: {
                    username: {
                        equals: username,
                        mode: 'insensitive'
                    }
                }
            });
            if (count > 1) {
                console.warn(`⚠️ WARNING: Found ${count} users with username ${username}!`);
                const allUsers = await prisma.user.findMany({
                    where: {
                        username: {
                            equals: username,
                            mode: 'insensitive'
                        }
                    }
                });
                console.log('Duplicate users:', allUsers);
            }
        } else {
            console.log('❌ User not found in database.');
        }

    } catch (error) {
        console.error('Error identifying user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

inspectUser();
