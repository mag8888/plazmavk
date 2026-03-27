
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../src/config/env.js';

// Configure using app env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function checkImages() {
    try {
        console.log('--- Checking folder: plazma/products ---');
        try {
            const plazma = await cloudinary.search
                .expression('folder:plazma/products')
                .max_results(30)
                .execute();
            console.log(`Found ${plazma.resources.length} images.`);
            plazma.resources.forEach((r: any) => console.log(`- ${r.secure_url}`));
        } catch (e: any) { console.log('plazma/products error:', e.message); }

        console.log('\n--- Checking folder: vital/products ---');
        try {
            const vital = await cloudinary.search
                .expression('folder:vital/products')
                .max_results(30)
                .execute();
            console.log(`Found ${vital.resources.length} images.`);
            vital.resources.forEach((r: any) => console.log(`- ${r.secure_url}`));
        } catch (e: any) { console.log('vital/products error:', e.message); }

        console.log('\n--- Checking root folder: plazma ---');
        try {
            const root = await cloudinary.search
                .expression('folder:plazma')
                .max_results(30)
                .execute();
            console.log(`Found ${root.resources.length} images.`);
            root.resources.forEach((r: any) => console.log(`- ${r.secure_url}`));
        } catch (e: any) { console.log('plazma root error:', e.message); }

    } catch (e: any) {
        console.error('General Error:', e);
    }
}

checkImages();
