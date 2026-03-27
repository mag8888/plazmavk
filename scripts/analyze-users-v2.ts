
import { MongoClient } from 'mongodb';

const MONGO_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672';

async function analyze() {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('Connected to Mongo');

    // Check potential collections for users
    const collections = [
        { db: 'plazma_bot', coll: 'User' },
        { db: 'plazma', coll: 'users' },
        { db: 'plazma', coll: 'partnerProfiles' },
        { db: 'plazma_bot', coll: 'PartnerProfile' }
    ];

    console.log('--- Collection Counts ---');
    for (const c of collections) {
        try {
            const count = await client.db(c.db).collection(c.coll).countDocuments();
            console.log(`${c.db}.${c.coll}: ${count}`);
        } catch (e) {
            console.log(`${c.db}.${c.coll}: Error ${e.message}`);
        }
    }

    // Check overlap between plazma.users and plazma_bot.User
    console.log('\n--- Checking Overlap ---');
    const botUsers = await client.db('plazma_bot').collection('User').find({}, { projection: { telegramId: 1 } }).toArray();
    const plazmaUsers = await client.db('plazma').collection('users').find({}, { projection: { telegramId: 1 } }).toArray();

    const botIds = new Set(botUsers.map(u => String(u.telegramId)));
    const plazmaIds = new Set(plazmaUsers.map(u => String(u.telegramId)));

    console.log(`Unique bot users: ${botIds.size}`);
    console.log(`Unique plazma users: ${plazmaIds.size}`);

    const intersection = new Set([...botIds].filter(x => plazmaIds.has(x)));
    console.log(`Intersection: ${intersection.size}`);

    const union = new Set([...botIds, ...plazmaIds]);
    console.log(`Union (Total Unique): ${union.size}`);

    // Maybe check PartnerProfiles too? sometimes users are only there?
    const partners = await client.db('plazma').collection('partnerProfiles').find({}, { projection: { userId: 1 } }).toArray();
    console.log(`\nPartners in plazma: ${partners.length}`);
    // userId in partnerProfile is likely an ObjectId to the User collection, not a telegramId.
    // We need to see if there are partnerProfiles pointing to MISSING users.

    await client.close();
}

analyze().catch(console.error);
