import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function main() {
    try {
        const res = await cloudinary.uploader.upload("/Users/ADMIN/.gemini/antigravity/brain/9310d1fd-91b6-4c99-83d8-a6d05df8b0ac/media__1772440486161.jpg", {
            folder: 'plazma/certificates',
        });
        console.log("Uploaded URL:", res.secure_url);
    } catch (e) {
        console.error(e);
    }
}
main();
