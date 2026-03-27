import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateReferrals() {
  console.log('🧹 Starting cleanup of duplicate referral records...');
  
  try {
    // Find all referral records
    const allReferrals = await prisma.partnerReferral.findMany({
      orderBy: [
        { profileId: 'asc' },
        { referredId: 'asc' },
        { createdAt: 'asc' }
      ]
    });
    
    console.log(`📊 Found ${allReferrals.length} total referral records`);
    
    // Group by profileId and referredId to find duplicates
    const grouped = {};
    const duplicates = [];
    
    for (const referral of allReferrals) {
      const key = `${referral.profileId}-${referral.referredId}`;
      
      if (!grouped[key]) {
        grouped[key] = [referral];
      } else {
        grouped[key].push(referral);
        if (grouped[key].length === 2) {
          // First duplicate found
          duplicates.push(grouped[key]);
        }
      }
    }
    
    console.log(`🔍 Found ${duplicates.length} sets of duplicate referrals`);
    
    // Remove duplicates, keeping only the oldest record
    for (const duplicateGroup of duplicates) {
      console.log(`🗑️ Removing ${duplicateGroup.length - 1} duplicate(s) for profileId: ${duplicateGroup[0].profileId}, referredId: ${duplicateGroup[0].referredId}`);
      
      // Keep the first (oldest) record, delete the rest
      const toDelete = duplicateGroup.slice(1);
      
      for (const duplicate of toDelete) {
        await prisma.partnerReferral.delete({
          where: { id: duplicate.id }
        });
        console.log(`  ✅ Deleted duplicate record ${duplicate.id}`);
      }
    }
    
    console.log('✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateReferrals();
