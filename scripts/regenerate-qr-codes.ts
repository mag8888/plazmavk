import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { generateAndUploadQRCode } from '../src/services/qr-service.js';
import { buildReferralLink } from '../src/services/partner-service.js';

async function main() {
    console.log('🔄 Starting QR code regeneration with Logo...');

    try {
        const profiles = await prisma.partnerProfile.findMany({
            include: { user: true }
        });

        console.log(`📊 Found ${profiles.length} partner profiles.`);

        let successCount = 0;
        let failCount = 0;

        for (const profile of profiles) {
            try {
                if (!profile.referralCode) {
                    console.warn(`⚠️ Profile ${profile.id} has no referral code, skipping.`);
                    continue;
                }

                const { main: referralLink } = buildReferralLink(
                    profile.referralCode,
                    (profile.programType as 'DIRECT' | 'MULTI_LEVEL') || 'DIRECT',
                    profile.user?.username || undefined
                );

                process.stdout.write(`Processing ${profile.referralCode}... `);

                // Force regenerate even if exists
                const qrUrl = await generateAndUploadQRCode(
                    referralLink,
                    'vital/qr-codes',
                    `qr_direct_${profile.referralCode}`
                );

                await prisma.partnerProfile.update({
                    where: { id: profile.id },
                    data: { referralDirectQrUrl: qrUrl }
                });

                console.log('✅ Done');
                successCount++;
            } catch (error) {
                console.log('❌ Failed');
                console.error(`Error processing ${profile.referralCode}:`, error);
                failCount++;
            }
        }

        console.log(`\n✨ Regeneration complete.\n✅ Success: ${successCount}\n❌ Failures: ${failCount}`);
    } catch (e) {
        console.error('🔥 Fatal error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
