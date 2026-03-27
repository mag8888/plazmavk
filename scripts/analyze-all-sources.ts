
import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URL = 'mongodb://mongo:pJzMMKYOvHUptbOTkFgwiwLOqYVnRqUp@nozomi.proxy.rlwy.net:28672';

function cleanId(id: any): string | null {
    if (!id) return null;
    let s = String(id);
    if (s.startsWith('000000000000000')) {
        // remove leading zeros
        try {
            const hex = s.replace(/^0+/, '');
            if (!hex) return null;
            // convert hex to decimal
            return BigInt('0x' + hex).toString();
        } catch (e) {
            return null;
        }
    }
    return s;
}

async function analyze() {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    console.log('Connected to Mongo');

    const knownUsers = new Set();

    // 1. Get base users
    const usersBot = await client.db('plazma_bot').collection('User').find({}).toArray();
    usersBot.forEach(u => u.telegramId && knownUsers.add(String(u.telegramId)));
    console.log(`Base Users: ${knownUsers.size}`);

    // 2. Scan referrals
    const referrals = await client.db('plazma').collection('partnerReferrals').find({}).toArray();
    const referralIds = new Set();

    for (const r of referrals) {
        if (r.referredId) {
            const id = cleanId(r.referredId);
            if (id) referralIds.add(id);
        }
        // Check if valid user?
    }
    console.log(`Unique IDs in Referrals: ${referralIds.size}`);

    // 3. Scan profiles
    const profiles = await client.db('plazma').collection('partnerProfiles').find({}).toArray();
    const profileIds = new Set();
    for (const p of profiles) {
        if (p.userId) {
            const id = cleanId(p.userId);
            if (id) profileIds.add(id);
        }
    }
    console.log(`Unique IDs in Profiles: ${profileIds.size}`);

    // 4. Scan history
    // warning: userHistories is large
    const history = await client.db('plazma').collection('userHistories').find({}, { projection: { userId: 1 } }).toArray();
    const historyIds = new Set();
    for (const h of history) {
        if (h.userId) {
            const id = cleanId(h.userId);
            if (id) historyIds.add(id);
        }
    }
    console.log(`Unique IDs in History: ${historyIds.size}`);

    // Union ALL
    const allIds = new Set([...knownUsers, ...referralIds, ...profileIds, ...historyIds]);
    console.log(`\nTOTAL UNIQUE USERS RECOVERED: ${allIds.size}`);

    const additional = new Set([...allIds].filter(x => !knownUsers.has(x)));
    console.log(`New Users found outside 'User' collection: ${additional.size}`);

    if (additional.size > 0) {
        console.log('Sample additional IDs:', [...additional].slice(0, 5));
    }

    await client.close();
}

analyze().catch(console.error);
