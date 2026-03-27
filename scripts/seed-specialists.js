
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🌱 Seeding Specialists...');

        // 1. Create a Category
        const category = await prisma.specialistCategory.upsert({
            where: { name: 'Психосоматика' },
            update: {},
            create: {
                name: 'Психосоматика',
                sortOrder: 1
            }
        });

        // 2. Create a Specialty
        const specialty = await prisma.specialistSpecialty.upsert({
            where: {
                categoryId_name: {
                    categoryId: category.id,
                    name: 'Терапевт'
                }
            },
            update: {},
            create: {
                categoryId: category.id,
                name: 'Терапевт',
                sortOrder: 1
            }
        });

        // 3. Create Specialists
        await prisma.specialist.create({
            data: {
                name: 'Анна Иванова',
                specialty: 'Психолог',
                categoryId: category.id,
                specialtyId: specialty.id,
                photoUrl: 'https://placehold.co/400x400',
                about: 'Опытный психолог с 10-летним стажем.',
                isActive: true
            }
        });

        await prisma.specialist.create({
            data: {
                name: 'Петр Петров',
                specialty: 'Нутрициолог',
                categoryId: category.id,
                specialtyId: specialty.id,
                photoUrl: 'https://placehold.co/400x400',
                about: 'Помогу наладить питание и здоровье.',
                isActive: true
            }
        });

        console.log('✅ Dummy specialists created.');

    } catch (error) {
        console.error('❌ Error seeding:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
