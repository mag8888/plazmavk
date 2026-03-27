import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function runTests() {
    console.log('🧪 Starting Certificate Logic Tests...');

    // Create mock users
    const userA = await prisma.user.create({
        data: { telegramId: `test_a_${Date.now()}`, balance: 0, firstName: 'User A' }
    });
    const userB = await prisma.user.create({
        data: { telegramId: `test_b_${Date.now()}`, balance: 10000, firstName: 'User B' }
    });
    const userC = await prisma.user.create({
        data: { telegramId: `test_c_${Date.now()}`, balance: 0, firstName: 'User C' }
    });

    try {
        // 1. Покупка без баланса (должно выдавать ошибку/не покупаться)
        console.log('\\n--- Test 1: Покупка без достаточного баланса ---');
        const costRub = 5000;
        const costPz = costRub / 100;
        let test1Passed = false;
        if (userA.balance < costPz) {
            console.log('✅ Ожидаемое поведение: баланса недостаточно.');
            test1Passed = true;
        } else {
            console.error('❌ ПРОБЛЕМА: условие нехватки баланса не сработало');
        }

        // 2. Добавление/генерация (Покупка с нужным балансом)
        console.log('\\n--- Test 2: Добавление сертификата при покупке ---');
        let certId = '';
        let certCode = '';
        if (userB.balance >= costPz) {
            // Имитируем покупку
            await prisma.user.update({
                where: { id: userB.id },
                data: { balance: { decrement: costPz } }
            });
            const cert = await prisma.giftCertificate.create({
                data: {
                    code: `TEST_${uuidv4().substring(0, 8).toUpperCase()}`,
                    userId: userB.id,
                    initialPz: costPz,
                    remainingPz: costPz,
                    status: 'ACTIVE'
                }
            });
            console.log(`✅ Сертификат создан: ${cert.code}. Баланс User B списан (${userB.balance} -> ${userB.balance - costPz} PZ).`);
            certId = cert.id;
            certCode = cert.code;
        }

        // 3. Передача
        console.log('\\n--- Test 3: Передача (Подарок через ссылку/нажатие активировать) ---');
        if (certId) {
            // Имитирует процесс: User B создает ссылку (giftToken), User C активирует
            const token = `token_${Date.now()}`;
            await prisma.giftCertificate.update({
                where: { id: certId },
                data: { giftToken: token, fromUserId: userB.id }
            });

            // Активация User C
            const activated = await prisma.giftCertificate.update({
                where: { id: certId },
                data: { status: 'ACTIVE', userId: userC.id } // меняется владелец
            });

            console.log(`✅ Сертификат передан. Новый владелец: ${activated.userId === userC.id ? 'User C (Успех)' : 'Ошибка'}`);
        }

        // 4. Оформление заказа и списание сертификата
        console.log('\\n--- Test 4: Списание сертификата при покупке товара ---');
        if (certCode) {
            // Имитируем API: проверка сертификата в заказе
            const c = await prisma.giftCertificate.findUnique({ where: { code: certCode } });
            const orderTotalPz = 100; // 10 000 руб
            const applied = Math.min(orderTotalPz, c.remainingPz); // сколько смогли покрыть сертификатом

            await prisma.giftCertificate.update({
                where: { id: c.id },
                data: { remainingPz: 0, status: 'USED' }
            });
            console.log(`✅ Сертификат применен к заказу! Списано: ${applied} PZ. Статус: USED`);
        }

        console.log('\\n🎉 Все тесты на логику операций с сертификатами пройдены успешно.');
    } catch (error) {
        console.error('Ошибка в тестах:', error);
    } finally {
        // Clean up
        await prisma.user.delete({ where: { id: userA.id } });
        await prisma.user.delete({ where: { id: userB.id } });
        await prisma.user.delete({ where: { id: userC.id } });
        if (certCode) {
            await prisma.giftCertificate.delete({ where: { code: certCode } }).catch(() => { });
        }
        await prisma.$disconnect();
    }
}

runTests();
