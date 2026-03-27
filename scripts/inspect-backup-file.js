import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = path.join(__dirname, '../database-backup-2025-12-01T19-33-19.json');

try {
    console.log(`📂 Reading backup file: ${BACKUP_FILE}`);
    const rawData = fs.readFileSync(BACKUP_FILE, 'utf8');
    const backup = JSON.parse(rawData);

    if (backup.data && Array.isArray(backup.data.users)) {
        const userCount = backup.data.users.length;
        console.log(`✅ Found ${userCount} users in backup.`);

        if (userCount > 0) {
            console.log('🕵️‍♀️ First 3 users:');
            backup.data.users.slice(0, 3).forEach(u => {
                console.log(`   - ${u.firstName || 'No Name'} (@${u.username}) [ID: ${u.id}]`);
            });
        }
    } else {
        console.log('❌ Invalid backup format: "data.users" array not found.');
        console.log('Keys in data:', backup.data ? Object.keys(backup.data) : 'No data object');
    }

} catch (error) {
    console.error('❌ Error reading backup:', error.message);
}
