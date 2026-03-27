
import mongoose from 'mongoose';

// MongoDB Connection URI
const MONGO_URI = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';

// Define a loose schema to inspect data
const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', UserSchema, 'users'); // Assuming collection is 'users'

async function inspectMongoUsers() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected!');

        // List collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        // 1. Inspect Dimas in 'User' collection
        const UserSingular = mongoose.model('UserSingular', UserSchema, 'User');
        const dimasUser = await UserSingular.findOne({ username: 'diglukhov' }); // Case sensitive

        console.log('\n--- Dimas in "User" collection ---');
        if (dimasUser) {
            console.log(JSON.stringify(dimasUser.toJSON(), null, 2));
        } else {
            console.log('Not found in "User". trying insensitive...');
            const dimasRegex = await UserSingular.findOne({ username: { $regex: /^diglukhov$/i } });
            if (dimasRegex) {
                console.log('Found with case-insensitive search:', JSON.stringify(dimasRegex.toJSON(), null, 2));
            } else {
                console.log('Not found in "User" even with regex.');
            }
        }

        const targetUser = dimasUser || await UserSingular.findOne({ username: { $regex: /^diglukhov$/i } });

        // 2. Inspect PartnerProfile
        if (targetUser) {
            const PartnerProfile = mongoose.model('PartnerProfile', UserSchema, 'PartnerProfile');
            // Try to find profile by userId (assuming it references User._id or User.id)
            // We need to see the User structure first to know the linking field.
            // But let's try strict userId match or string match

            const profile = await PartnerProfile.findOne({ userId: targetUser._id });
            console.log('\n--- Dimas PartnerProfile ---');
            console.log(profile ? JSON.stringify(profile.toJSON(), null, 2) : 'Profile not found by userId=' + targetUser._id);

            // Check PartnerReferral
            const PartnerReferral = mongoose.model('PartnerReferral', UserSchema, 'PartnerReferral');

            // Find who referred Dimas
            // referredId is likely the User ID? or Profile ID?
            const referral = await PartnerReferral.findOne({ referredId: targetUser._id });
            console.log('\n--- Who referred Dimas? (PartnerReferral) ---');
            if (referral) {
                console.log(JSON.stringify(referral.toJSON(), null, 2));
                // Find the profile of the inviter
                const inviterProfile = await PartnerProfile.findById(referral.profileId);
                if (inviterProfile) {
                    console.log('Inviter Profile:', JSON.stringify(inviterProfile.toJSON(), null, 2));
                    // Find inviter User
                    const inviterUser = await UserSingular.findById(inviterProfile.userId);
                    console.log('Inviter User:', inviterUser ? inviterUser.username : 'Unknown');
                }
            } else {
                console.log('No referral record found for Dimas.');
            }
        }

        // 3. Count Total in 'User'
        const countUser = await UserSingular.countDocuments();
        console.log(`\nTotal Users in 'User': ${countUser}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

inspectMongoUsers();
