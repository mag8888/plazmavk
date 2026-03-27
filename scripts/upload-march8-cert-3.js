import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function uploadImages() {
    const file1 = '/Users/ADMIN/.gemini/antigravity/brain/9310d1fd-91b6-4c99-83d8-a6d05df8b0ac/media__1772266889959.jpg';

    try {
        const res1 = await cloudinary.uploader.upload(file1, { folder: 'plazma/certificates' });
        console.log('Image 1:', res1.secure_url);
    } catch (err) {
        console.error('Error uploading:', err);
    }
}

uploadImages();
