#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const MAX_SIZE_MB = 50; // Максимальный размер для Telegram бота

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkVideoSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        const sizeInBytes = stats.size;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        
        console.log(`📁 Файл: ${path.basename(filePath)}`);
        console.log(`📏 Размер: ${formatBytes(sizeInBytes)}`);
        console.log(`📊 Размер в МБ: ${sizeInMB.toFixed(2)} MB`);
        
        if (sizeInMB <= MAX_SIZE_MB) {
            console.log(`✅ Видео подходит для Telegram бота (≤ ${MAX_SIZE_MB} MB)`);
            return true;
        } else {
            console.log(`❌ Видео слишком большое для Telegram бота (> ${MAX_SIZE_MB} MB)`);
            console.log(`💡 Рекомендация: сжать видео до ${MAX_SIZE_MB} MB или меньше`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Ошибка при проверке файла: ${error.message}`);
        return false;
    }
}

// Получаем путь к файлу из аргументов командной строки
const filePath = process.argv[2];

if (!filePath) {
    console.log('Использование: node check-video-size.js <путь_к_видео>');
    console.log('Пример: node check-video-size.js ./videos/demo.mp4');
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error(`❌ Файл не найден: ${filePath}`);
    process.exit(1);
}

const isValid = checkVideoSize(filePath);
process.exit(isValid ? 0 : 1);
