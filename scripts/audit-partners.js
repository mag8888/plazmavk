import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PERIOD_DAYS = 45;
const THRESHOLD_AMOUNT = 12000;

async function main() {
    console.log(`🛡 Starting Partner Activation Audit...`);
    console.log(`Condition: Paid orders > ${THRESHOLD_AMOUNT} RUB in last ${PERIOD_DAYS} days.`);

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - PERIOD_DAYS);
    console.log(`📅 Checking payments since: ${thresholdDate.toISOString()}`);

    try {
        // Fetch all partner profiles with their user's payments in the period
        const profiles = await prisma.partnerProfile.findMany({
            include: {
                user: {
                    include: {
                        payments: {
                            where: {
                                status: 'PAID',
                                createdAt: {
                                    gte: thresholdDate
                                }
                            }
                        }
                    }
                }
            }
        });

        console.log(`📊 Found ${profiles.length} partner profiles.`);

        let activated = 0;
        let deactivated = 0;
        let skipped = 0;

        for (const profile of profiles) {
            // Calculate total confirmed payments
            const payments = profile.user.payments || [];
            const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

            const shouldBeActive = totalPaid >= THRESHOLD_AMOUNT;

            if (shouldBeActive) {
                // Activate
                if (!profile.isActive || (profile.expiresAt && profile.expiresAt < new Date())) {
                    console.log(`✅ Activating ${profile.referralCode} (User: ${profile.user.telegramId}). Total: ${totalPaid} RUB`);

                    // Set expiresAt to 30 days from now to ensure they stay active
                    const newExpiresAt = new Date();
                    newExpiresAt.setDate(newExpiresAt.getDate() + 30);

                    await prisma.partnerProfile.update({
                        where: { id: profile.id },
                        data: {
                            isActive: true,
                            expiresAt: newExpiresAt,
                            activationType: 'AUDIT_AUTO'
                        }
                    });
                    activated++;
                } else {
                    // Already active and valid
                    // console.log(`👌 ${profile.referralCode} is already active. Total: ${totalPaid} RUB`);
                    skipped++;
                }
            } else {
                // Deactivate
                if (profile.isActive) {
                    console.log(`⛔ Deactivating ${profile.referralCode} (User: ${profile.user.telegramId}). Total: ${totalPaid} RUB < ${THRESHOLD_AMOUNT}`);

                    await prisma.partnerProfile.update({
                        where: { id: profile.id },
                        data: {
                            isActive: false,
                            // We don't necessarily clear expiresAt, but isActive=false overrides it in checks
                        }
                    });
                    deactivated++;
                } else {
                    skipped++;
                }
            }
        }

        console.log(`\n✨ Audit complete.`);
        console.log(`✅ Activated/Extended: ${activated}`);
        console.log(`⛔ Deactivated: ${deactivated}`);
        console.log(`⏭️ Unchanged: ${skipped}`);

    } catch (error) {
        console.error('🔥 Error during audit:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
