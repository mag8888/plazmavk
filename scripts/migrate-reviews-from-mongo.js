// migrate-reviews-from-mongo.js
// Переносит отзывы из MongoDB Atlas в PostgreSQL (Prisma)
import { MongoClient } from 'mongodb';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = 'mongodb+srv://plazma_bot:Plazma_bot%232025%21Plazma_bot%232025%21@cluster0.ioccgxp.mongodb.net/plazma_bot?retryWrites=true&w=majority';
const MONGO_DB = 'plazma_bot';

const prisma = new PrismaClient();

async function main() {
    console.log('🔌 Подключаемся к MongoDB...');
    const mongo = new MongoClient(MONGO_URI);
    await mongo.connect();
    console.log('✅ MongoDB подключена');

    try {
        const db = mongo.db(MONGO_DB);

        // Ищем коллекцию с отзывами (пробуем несколько вариантов названий)
        const collections = await db.listCollections().toArray();
        console.log('📂 Коллекции в БД:', collections.map(c => c.name).join(', '));

        const reviewCollectionName = collections.find(c =>
            ['reviews', 'review', 'отзывы'].includes(c.name.toLowerCase())
        )?.name;

        if (!reviewCollectionName) {
            console.log('❌ Коллекция отзывов не найдена. Доступные коллекции:');
            for (const col of collections) {
                const count = await db.collection(col.name).countDocuments();
                console.log(`   - ${col.name}: ${count} документов`);
            }
            return;
        }

        console.log(`📋 Найдена коллекция: "${reviewCollectionName}"`);
        const mongoReviews = await db.collection(reviewCollectionName).find({}).toArray();
        console.log(`📝 Найдено отзывов в MongoDB: ${mongoReviews.length}`);

        if (mongoReviews.length === 0) {
            console.log('⚠️  Отзывов нет, завершаем.');
            return;
        }

        // Показываем первый отзыв для понимания структуры
        console.log('\n🔍 Пример структуры первого отзыва:');
        console.log(JSON.stringify(mongoReviews[0], null, 2));

        // Получаем уже существующие имена в PostgreSQL (чтобы не дублировать)
        const existingReviews = await prisma.review.findMany({ select: { name: true, content: true } });
        const existingSet = new Set(existingReviews.map(r => `${r.name}::${r.content?.slice(0, 50)}`));

        let created = 0;
        let skipped = 0;

        for (const r of mongoReviews) {
            const name = r.name || r.author || r.userName || r.username || 'Аноним';
            const content = r.content || r.text || r.comment || r.body || r.message || '';
            const photoUrl = r.photoUrl || r.photo || r.avatar || r.imageUrl || r.image || null;
            const link = r.link || r.url || null;
            const isPinned = r.isPinned || r.pinned || false;
            const isActive = r.isActive !== undefined ? r.isActive : (r.active !== undefined ? r.active : true);

            if (!content) {
                console.log(`⚠️  Пропускаем (нет текста): ${name}`);
                skipped++;
                continue;
            }

            const key = `${name}::${content.slice(0, 50)}`;
            if (existingSet.has(key)) {
                console.log(`⏭️  Уже существует: ${name}`);
                skipped++;
                continue;
            }

            await prisma.review.create({
                data: {
                    name,
                    content,
                    photoUrl,
                    link,
                    isPinned: Boolean(isPinned),
                    isActive: Boolean(isActive),
                    createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
                }
            });

            existingSet.add(key);
            created++;
            console.log(`✅ Создан: ${name} ${photoUrl ? '(с фото)' : ''}`);
        }

        console.log(`\n🎉 Готово! Создано: ${created}, пропущено: ${skipped}`);

    } finally {
        await mongo.close();
        await prisma.$disconnect();
    }
}

main().catch(err => {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
});
