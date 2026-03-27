import QRCode from 'qrcode';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { uploadImage } from './cloudinary-service.js';

/**
 * Generate QR code as Buffer with Logo
 */
export async function generateQRCode(text: string): Promise<Buffer> {
    try {
        // Generate QR code as Buffer
        const qrBuffer = await QRCode.toBuffer(text, {
            errorCorrectionLevel: 'H', // High error correction to support logo overlay
            type: 'png',
            margin: 1,
            width: 500,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
        });

        // Path to logo - trying to find logo_new.png
        const logoPath = path.resolve(process.cwd(), 'webapp/static/logo_new.png');

        if (fs.existsSync(logoPath)) {
            try {
                // Settings
                const logoSize = 110;
                const borderSize = 10;
                const bgSize = logoSize + borderSize; // 120

                // 1. Create White Circular Background
                const whiteBg = Buffer.from(
                    `<svg width="${bgSize}" height="${bgSize}">
                        <circle cx="${bgSize / 2}" cy="${bgSize / 2}" r="${bgSize / 2}" fill="white"/>
                    </svg>`
                );

                // 2. Process Logo: Resize and Crop to Circle
                // We use 'cover' to ensure the logo fills the circular area if it has a background
                const logoRounded = await sharp(logoPath)
                    .resize(logoSize, logoSize, {
                        fit: 'cover',
                    })
                    .composite([{
                        input: Buffer.from(
                            `<svg width="${logoSize}" height="${logoSize}">
                                <circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2}" fill="black"/>
                            </svg>`
                        ),
                        blend: 'dest-in'
                    }])
                    .toBuffer();

                // 3. Composite everything onto QR code
                const compositeBuffer = await sharp(qrBuffer)
                    .composite([
                        { input: whiteBg, gravity: 'center' },
                        { input: logoRounded, gravity: 'center' }
                    ])
                    .toBuffer();

                return compositeBuffer;
            } catch (imgError) {
                console.warn('⚠️ Failed to add logo to QR code:', imgError);
                return qrBuffer; // Fallback to QR without logo
            }
        } else {
            console.warn(`⚠️ QR Logo file not found at: ${logoPath}`);
            return qrBuffer;
        }
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
}

/**
 * Generate QR code and upload to Cloudinary
 * Returns the secure URL of the uploaded image
 */
export async function generateAndUploadQRCode(
    text: string,
    folder: string = 'vital/qr-codes',
    filename: string
): Promise<string> {
    try {
        const buffer = await generateQRCode(text);

        // Upload to Cloudinary
        const result = await uploadImage(buffer, {
            folder,
            publicId: filename,
            resourceType: 'image',
            format: 'png',
        });

        return result.secureUrl;
    } catch (error) {
        console.error('Error generating and uploading QR code:', error);
        throw error;
    }
}
