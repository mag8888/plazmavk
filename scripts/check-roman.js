import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRomanProfile() {
    // Find Roman's partner profile
    const profiles = await prisma.partnerProfile.findMany({
        include: {
            user: true,
            referrals: {
                include: {
                    referred: true
                }
            },
            _count: {
                select: { referrals: true }
            }
        },
        where: {
            OR: [
                { referralCode: 'PW69B576' },
                { user: { firstName: { contains: 'Roman' } } }
            ]
        }
    });

    console.log(`🔍 Found ${profiles.length} profiles\n`);

    profiles.forEach(p => {
        console.log('📊 Profile:', p.referralCode);
        console.log('   User:', p.user.firstName, p.user.telegramId);
        console.log('   Balance:', p.balance / 100, 'PZ');
        console.log('   Total Partners:', p.totalPartners);
        console.log('   Actual Referrals:', p._count.referrals);
        console.log('   Referrals:');
        p.referrals.slice(0, 5).forEach(r => {
            console.log(`     - ${r.referred?.firstName || 'Unknown'} (level ${r.level})`);
        });
        console.log();
    });

    await prisma.$disconnect();
}

checkRomanProfile().catch(e => {
    console.error('💥 Error:', e);
    process.exit(1);
});
