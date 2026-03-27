
import { MongoClient } from 'mongodb';

const MONGO_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672';

async function analyze() {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('Connected to Mongo');

    // Load known users
    const usersBot = await client.db('plazma_bot').collection('User').find({}, { projection: { telegramId: 1 } }).toArray();
    const knownIds = new Set(usersBot.map(u => String(u.telegramId)));
    console.log(`Known Users: ${knownIds.size}`);

    // Check Orders in plazma_bot
    const orders = await client.db('plazma_bot').collection('Order').find({}).toArray();
    console.log(`Total Orders: ${orders.length}`);

    const orderUserIds = new Set();
    const missingFromOrders = new Set();

    for (const o of orders) {
        if (o.userId) {
            orderUserIds.add(String(o.userId));
            if (!knownIds.has(String(o.userId))) {
                missingFromOrders.add(String(o.userId));
            }
        }
    }
    console.log(`Unique Users with Orders: ${orderUserIds.size}`);
    console.log(`Users in Orders but NOT in User collection: ${missingFromOrders.size}`);

    // Check Referrals? `Referral` collection?
    // Let's list collections again to be sure
    const cols = await client.db('plazma_bot').listCollections().toArray();
    console.log('Collections in plazma_bot:', cols.map(c => c.name));

    await client.close();
}

analyze().catch(console.error);
