import { prisma } from './prisma.js';
import { initializeBotContent } from '../services/bot-content-service.js';

export async function ensureInitialData() {
  try {
    // Test connection first with a simple query
    try {
      await prisma.$connect();
    } catch (connectError: any) {
      console.warn('⚠️  Cannot connect to database for initial data setup:', connectError?.message);
      return; // Exit early if connection fails
    }

    const reviewCount = await prisma.review.count();
    if (reviewCount === 0) {
      try {
        // Try to create review without transaction (to avoid replica set requirement)
        await prisma.review.create({
          data: {
            name: 'Дмитрий',
            content: 'Будущее наступило ребята\nЭто действительно биохакинг нового поколения. Мне было трудно поверить в такую эффективность. Я забыл что такое усталость!',
            isActive: true,
            isPinned: true,
          },
        });
        console.log('✅ Initial review created');
      } catch (error: any) {
        if (error?.code === 'P2031' || error?.message?.includes('replica set')) {
          console.log('⚠️  MongoDB replica set not configured - skipping initial review creation');
        } else {
          throw error;
        }
      }
    }

    // Инициализируем контент бота
    await initializeBotContent();

    // Проверяем, пуст ли каталог, и если да - теперь ничего не загружаем автоматом, так как у нас Plazma.
    const productCount = await prisma.product.count();
    if (productCount === 0) {
      console.log('📦 Каталог пуст (Siam auto-import отключен).');
    }


    // Seed specialists taxonomy (categories + specialties) if empty
    try {
      const catCount = await prisma.specialistCategory.count();
      if (catCount === 0) {
        const seed = [
          { name: 'Косметология', specialties: ['Косметолог-эстетист', 'Врач-косметолог', 'Дерматолог', 'Инъекционист'] },
          { name: 'Эстетика лица', specialties: ['Бровист', 'Лэшмейкер (ресницы)', 'Визажист', 'Косметолог по уходу'] },
          { name: 'Ногтевой сервис', specialties: ['Мастер маникюра', 'Мастер педикюра', 'Подолог'] },
          { name: 'Волосы', specialties: ['Парикмахер-стилист', 'Колорист', 'Трихолог', 'Барбер'] },
          { name: 'Массаж и тело', specialties: ['Массажист', 'Мануальный терапевт', 'Остеопат', 'Кинезиолог'] },
          { name: 'SPA и велнес', specialties: ['СПА-специалист', 'Терма/банные практики', 'Телесный терапевт'] },
          { name: 'Здоровье и питание', specialties: ['Нутрициолог', 'Диетолог', 'Врач превентивной медицины'] },
          { name: 'Психология и коучинг', specialties: ['Психолог', 'Психотерапевт', 'Коуч'] },
          { name: 'Фитнес и движение', specialties: ['Фитнес-тренер', 'Йога-инструктор', 'Пилатес-инструктор', 'Реабилитолог'] }
        ];

        let order = 0;
        for (const c of seed) {
          // REFACTOR: Manual upsert to avoid transaction requirement
          let category = await prisma.specialistCategory.findFirst({ where: { name: c.name } });
          if (!category) {
            category = await prisma.specialistCategory.create({
              data: { name: c.name, isActive: true, sortOrder: order++ }
            });
          }

          let spOrder = 0;
          for (const s of c.specialties) {
            // Check existence first
            const existingSpec = await prisma.specialistSpecialty.findFirst({
              where: { name: s, categoryId: category.id }
            });
            if (!existingSpec) {
              await prisma.specialistSpecialty.create({
                data: { name: s, categoryId: category.id, isActive: true, sortOrder: spOrder++ }
              });
            }
          }
        }
        console.log('✅ Seeded specialists taxonomy');
      }
    } catch (error: any) {
      // do not block startup on seed failures
      console.warn('⚠️  Failed to seed specialists taxonomy:', error?.message || error);
    }

    console.log('✅ Initial data ensured');
  } catch (error: any) {
    // MongoDB authentication errors - check connection string
    if (error?.code === 'P1013' || error?.message?.includes('Authentication failed')) {
      // Silent fail - MongoDB auth issue, but server can still run
      // Connection will be retried on next request
    } else {
      // Only log non-auth errors
      console.warn('⚠️  Failed to initialize data:', error?.message || error);
    }
    // Continue without initial data if DB connection fails - server can still run
  }
}
