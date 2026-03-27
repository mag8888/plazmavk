import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPartnerData() {
    console.log('🔍 Verifying Partner Data in PostgreSQL...\\n');

    // Get all partner profiles
    const profiles = await prisma.partnerProfile.findMany({
        include: {
            user: {
                select: {
                    telegramId: true,
                    firstName: true,
                    lastName: true
                }
            }
        },
        orderBy: { balance: 'desc' }
    });

    console.log(`📊 Total Partner Profiles: ${profiles.length}\\n`);

    // Calculate totals
    const totalBalance = profiles.reduce((sum, p) => sum + p.balance, 0);
    const totalBonus = profiles.reduce((sum, p) => sum + p.bonus, 0);
    const totalPartners = profiles.reduce((sum, p) => sum + p.totalPartners, 0);
    const activeProfiles = profiles.filter(p => p.isActive).length;

    console.log('═'.repeat(50));
    console.log('📈 Summary:');
    console.log('═'.repeat(50));
    console.log(`Active Profiles:    ${activeProfiles}/${profiles.length}`);
    console.log(`Total Balance:      ${totalBalance.toFixed(2)} PZ`);
    console.log(`Total Bonus:        ${totalBonus.toFixed(2)} PZ`);
    console.log(`Total Partners:     ${totalPartners}`);
    console.log('═'.repeat(50));

    console.log('\\n🏆 Top 10 Partners by Balance:\\n');
    profiles.slice(0, 10).forEach((p, i) => {
        const name = p.user.firstName || 'Unknown';
        console.log(`${(i + 1).toString().padStart(2)}. ${name.padEnd(20)} ${p.balance.toFixed(2)} PZ (${p.totalPartners} partners)`);
    });

    await prisma.$disconnect();
}

verifyPartnerData().catch(e => {
    console.error('💥 Error:', e);
    process.exit(1);
});
