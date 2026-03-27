
import https from 'https';

const BACKUP_URL = 'https://res.cloudinary.com/dt4r1tigf/raw/upload/v1765764005/plazma-bot/backups/database-backup-2025-12-15T02-00-02.json';

console.log(`Downloading backup from: ${BACKUP_URL}`);

https.get(BACKUP_URL, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            console.log(`Download complete. Size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
            const backup = JSON.parse(data);

            if (backup.data && Array.isArray(backup.data.users)) {
                console.log(`✅ User count in backup: ${backup.data.users.length}`);

                if (backup.data.users.length > 0) {
                    console.log('🕵️‍♀️ First 3 users:');
                    backup.data.users.slice(0, 3).forEach(u => {
                        console.log(`   - ${u.firstName || 'No Name'} (@${u.username}) [ID: ${u.id}]`);
                    });
                }
            } else {
                console.log('❌ "users" array not found in backup data.');
            }
        } catch (e) {
            console.error('❌ Error parsing JSON:', e.message);
        }
    });

}).on('error', (err) => {
    console.error('❌ Download error:', err.message);
});
