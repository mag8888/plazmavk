
import { v2 as cloudinary } from 'cloudinary';

const cloud_name = 'dt4r1tigf';
const api_key = '139768499551349';

// Possible variations of the secret based on visual ambiguity (l vs I, etc.)
const secrets = [
    '3tqNb1QPMlCBTW0bTLus5HFHGQI', // Original transcription (lowercase l)
    '3tqNb1QPMICBTW0bTLus5HFHGQI', // Uppercase I instead of l
    '3tqNb1QPM1CBTW0bTLus5HFHGQI', // Number 1 instead of l
];

async function testSecrets() {
    for (const secret of secrets) {
        console.log(`\n🔑 Testing secret: ${secret}`);

        cloudinary.config({
            cloud_name,
            api_key,
            api_secret: secret,
        });

        try {
            // Try a simple ping operation (get usage)
            const result = await cloudinary.api.usage();
            console.log('✅ SUCCESS! usage info received.');
            console.log(`👉 CORRECT SECRET: ${secret}`);
            return;
        } catch (error) {
            console.log(`❌ Failed: ${error.message || error.error?.message}`);
        }
    }
    console.log('\n😭 All variations failed.');
}

testSecrets();
