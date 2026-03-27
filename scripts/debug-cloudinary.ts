
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function debugCloudinary() {
    const folder = process.env.CLOUDINARY_AUDIO_FOLDER || 'plazma';
    console.log(`📂 Checking folder: ${folder}`);

    try {
        console.log('--- RAW Resources ---');
        const raw = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'raw',
            prefix: folder,
            max_results: 100
        });
        console.log(raw.resources.map((r: any) => `${r.public_id} [${r.format}]`));

        console.log('\n--- VIDEO Resources (Audio often here) ---');
        const video = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'video',
            prefix: folder,
            max_results: 100
        });
        console.log(video.resources.map((r: any) => `${r.public_id} [${r.format}]`));

        console.log('\n--- IMAGE Resources ---');
        const image = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'image',
            prefix: folder,
            max_results: 100
        });
        console.log(image.resources.map((r: any) => `${r.public_id} [${r.format}]`));

    } catch (error) {
        console.error('Error:', error);
    }
}

debugCloudinary();
