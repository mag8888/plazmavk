import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 6 звуковых матриц по методу Гаряева
const audioFiles = [
  {
    title: "Antibiotic water - Anton Matrix Laboratory",
    description: "Звуковая матрица антибиотической воды для поддержки иммунитета",
    fileId: "PLACEHOLDER_FILE_ID_1", // Заменить на реальный при загрузке
    duration: 565, // 9:25 в секундах
    fileSize: 1024000,
    mimeType: "audio/mpeg",
    category: "gift"
  },
  {
    title: "Antivirus water - Anton Matrix Laboratory", 
    description: "Звуковая матрица антивирусной воды для защиты от вирусов",
    fileId: "PLACEHOLDER_FILE_ID_2",
    duration: 630, // 10:30 в секундах
    fileSize: 1200000,
    mimeType: "audio/mpeg",
    category: "gift"
  },
  {
    title: "Energy drink water - Anton Matrix Laboratory",
    description: "Звуковая матрица энергетической воды для повышения энергии",
    fileId: "PLACEHOLDER_FILE_ID_3",
    duration: 555, // 9:15 в секундах
    fileSize: 1100000,
    mimeType: "audio/mpeg",
    category: "gift"
  },
  {
    title: "Life water - Anton Matrix Laboratory",
    description: "Звуковая матрица живой воды для общего оздоровления",
    fileId: "PLACEHOLDER_FILE_ID_4",
    duration: 445, // 7:25 в секундах
    fileSize: 900000,
    mimeType: "audio/mpeg",
    category: "gift"
  },
  {
    title: "Magnesium water - Anton Matrix Laboratory",
    description: "Звуковая матрица магниевой воды для восполнения магния",
    fileId: "PLACEHOLDER_FILE_ID_5",
    duration: 611, // 10:11 в секундах
    fileSize: 1150000,
    mimeType: "audio/mpeg",
    category: "gift"
  },
  {
    title: "Relaxation water - Anton Matrix Laboratory",
    description: "Звуковая матрица релаксирующей воды для расслабления",
    fileId: "PLACEHOLDER_FILE_ID_6",
    duration: 397, // 6:37 в секундах
    mimeType: "audio/mpeg",
    category: "gift"
  }
];

async function initGiftAudioFiles() {
  console.log('🎵 Инициализация звуковых матриц Гаряева...');

  try {
    // Проверяем, есть ли уже файлы
    const existingFiles = await prisma.audioFile.findMany({
      where: { category: 'gift' }
    });

    if (existingFiles.length > 0) {
      console.log(`📋 Найдено ${existingFiles.length} файлов в категории "gift"`);
      console.log('💡 Для пересоздания удалите существующие файлы через админ-панель или команду /admin_audio');
      return;
    }

    // Добавляем новые файлы
    for (const audioData of audioFiles) {
      const audioFile = await prisma.audioFile.create({
        data: audioData
      });
      console.log(`✅ Добавлен: ${audioFile.title} (${Math.floor(audioFile.duration / 60)}:${(audioFile.duration % 60).toString().padStart(2, '0')})`);
    }

    console.log(`\n🎉 Успешно добавлено ${audioFiles.length} звуковых матриц!`);
    console.log('📝 Файлы добавлены в категорию "gift" и будут отображаться в разделе "Звуковые матрицы Гаряева"');
    console.log('⚠️  Внимание: file_id являются заглушками. Для реального использования загрузите файлы через бота.');

  } catch (error) {
    console.error('❌ Ошибка при добавлении аудиофайлов:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initGiftAudioFiles().catch(async (e) => {
  console.error('❌ Script failed:', e);
  await prisma.$disconnect();
  process.exit(1);
});
