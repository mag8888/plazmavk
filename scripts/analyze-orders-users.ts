
import { MongoClient } from 'mongodb';

const MONGO_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672';

async function analyze() {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('Connected to Mongo');

    const usersBot = await client.db('plazma_bot').collection('User').find({}, { projection: { telegramId: 1 } }).toArray();
    const knownIds = new Set(usersBot.map(u => String(u.telegramId)));
    console.log(`Known Users in plazma_bot.User: ${knownIds.size}`);

    // Check OrderRequest in plazma_bot
    const ordersBot = await client.db('plazma_bot').collection('OrderRequest').find({}).toArray();
    console.log(`\nplazma_bot.OrderRequest: ${ordersBot.length}`);

    let missingFromOrdersBot = new Set();
    for (const o of ordersBot) {
        // Check various user ID fields
        const uid = o.userId || o.user_id || o.telegramId;
        if (uid && !knownIds.has(String(uid))) {
            missingFromOrdersBot.add(String(uid));
        }
    }
    console.log(`User IDs in plazma_bot.OrderRequest NOT in User: ${missingFromOrdersBot.size}`);

    // Check orderRequests in plazma
    const ordersPlazma = await client.db('plazma').collection('orderRequests').find({}).toArray();
    console.log(`\nplazma.orderRequests: ${ordersPlazma.length}`);

    let missingFromOrdersPlazma = new Set();
    for (const o of ordersPlazma) {
        const uid = o.userId || o.user_id || o.telegramId;
        if (uid && !knownIds.has(String(uid))) {
            missingFromOrdersPlazma.add(String(uid));
        }
    }
    console.log(`User IDs in plazma.orderRequests NOT in User: ${missingFromOrdersPlazma.size}`);

    // Check PartnerReferral
    const referrals = await client.db('plazma').collection('partnerReferrals').find({}).toArray();
    console.log(`\nplazma.partnerReferrals: ${referrals.length}`);
    // referral has 'referredId' and 'partnerId'. Are these telegramIds or ObjectIds?
    // Let's sample one
    if (referrals.length > 0) console.log('Sample Referral:', referrals[0]);

    await client.close();
}

analyze().catch(console.error);
