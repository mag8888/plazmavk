import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: 'dt4r1tigf',
    api_key: '139768499551349',
    api_secret: '3tqNb1QPMICBTW0bTLus5HFHGQI'
});

async function run() {
    try {
        const result = await cloudinary.uploader.upload(
            '/Users/ADMIN/.gemini/antigravity/brain/ad08ca44-d539-4ccf-9bc6-740171361c33/media__1772106826485.png',
            { folder: 'plazma/certificates' }
        );
        console.log('Upload successful:', result.secure_url);
    } catch (error) {
        console.error('Upload failed:', error);
    }
}

run();
