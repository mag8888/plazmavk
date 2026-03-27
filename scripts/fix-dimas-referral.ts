
import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

const prisma = new PrismaClient();
const MONGO_URI = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

// Mongo Schemas (Loose)
const UserSchema = new mongoose.Schema({}, { strict: false });
const UserMongo = mongoose.model('User', UserSchema, 'User');
const PartnerProfileMongo = mongoose.model('PartnerProfile', UserSchema, 'PartnerProfile');
const PartnerReferralMongo = mongoose.model('PartnerReferral', UserSchema, 'PartnerReferral');

async function fixDimas() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected.');

        // 1. Get Dimas in Mongo
        const dimasMongo = await UserMongo.findOne({ username: 'diglukhov' });
        if (!dimasMongo) throw new Error('Dimas not found in Mongo');
        console.log('Dimas Mongo ID:', dimasMongo._id);
        console.log('Dimas Telegram:', dimasMongo.toJSON().telegramId);

        // 2. Get Roman in Mongo (Inviter)
        // We need to find the profile first from the referral
        const referralMongo = await PartnerReferralMongo.findOne({ referredId: dimasMongo._id });
        if (!referralMongo) throw new Error('Referral not found in Mongo');
        console.log('Referral Mongo:', JSON.stringify(referralMongo.toJSON(), null, 2));

        const inviterProfileMongo = await PartnerProfileMongo.findById(referralMongo.toJSON().profileId);
        if (!inviterProfileMongo) throw new Error('Inviter Profile not found in Mongo');
        console.log('Inviter Profile Mongo ID:', inviterProfileMongo._id);
        console.log('Inviter User Mongo ID:', inviterProfileMongo.toJSON().userId);

        const inviterUserMongo = await UserMongo.findById(inviterProfileMongo.toJSON().userId);
        if (!inviterUserMongo) throw new Error('Inviter User not found in Mongo');
        console.log('Inviter Username:', inviterUserMongo.toJSON().username);
        console.log('Inviter Telegram:', inviterUserMongo.toJSON().telegramId);


        // 3. Find in Postgres
        const dimasPg = await prisma.user.findFirst({ where: { telegramId: String(dimasMongo.toJSON().telegramId) } });
        if (!dimasPg) throw new Error('Dimas not found in Postgres');
        console.log('Dimas PG ID:', dimasPg.id);

        const inviterPg = await prisma.user.findFirst({ where: { telegramId: String(inviterUserMongo.toJSON().telegramId) } });
        if (!inviterPg) throw new Error('Inviter not found in Postgres');
        console.log('Inviter PG ID:', inviterPg.id);

        const inviterProfilePg = await prisma.partnerProfile.findFirst({ where: { userId: inviterPg.id } });
        if (!inviterProfilePg) throw new Error('Inviter Profile not found in Postgres');
        console.log('Inviter PG Profile ID:', inviterProfilePg.id);

        // 4. Update Postgres Referral
        const existingRef = await prisma.partnerReferral.findFirst({
            where: { referredId: dimasPg.id, level: 1 }
        });

        if (existingRef) {
            console.log(`Current Referral Profile ID: ${existingRef.profileId}`);
            if (existingRef.profileId !== inviterProfilePg.id) {
                console.log('UPDATING to', inviterProfilePg.id);
                await prisma.partnerReferral.update({
                    where: { id: existingRef.id },
                    data: { profileId: inviterProfilePg.id }
                });
                console.log('Updated!');
            } else {
                console.log('Referral already correct.');
            }
        } else {
            console.log('Creating new referral...');
            await prisma.partnerReferral.create({
                data: {
                    referredId: dimasPg.id,
                    profileId: inviterProfilePg.id,
                    level: 1,
                    referralType: 'DIRECT'
                }
            });
            console.log('Created!');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
        await prisma.$disconnect();
    }
}

fixDimas();
