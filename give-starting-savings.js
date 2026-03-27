const mongoose = require('mongoose');

// Схема комнаты (упрощенная версия)
const roomSchema = new mongoose.Schema({
    players: [{
        user_id: String,
        name: String
    }],
    game_data: {
        player_balances: [Number],
        transfers_history: [{
            sender: String,
            recipient: String,
            amount: Number,
            timestamp: Date,
            sender_index: Number,
            recipient_index: Number,
            type: String,
            description: String
        }],
        starting_savings_given: Boolean
    }
});

const Room = mongoose.model('Room', roomSchema);

// Функция для начисления стартовых сбережений
async function giveStartingSavings(roomId, amount = 3000) {
    try {
        console.log(`🔍 Поиск комнаты: ${roomId}`);
        
        const room = await Room.findById(roomId);
        if (!room) {
            console.error('❌ Комната не найдена');
            return;
        }
        
        console.log(`✅ Комната найдена: ${room.players.length} игроков`);
        
        // Проверяем, были ли уже начислены стартовые сбережения
        if (room.game_data?.starting_savings_given) {
            console.log('⚠️ Стартовые сбережения уже были начислены ранее');
            return;
        }
        
        // Инициализируем game_data если его нет
        if (!room.game_data) {
            room.game_data = {
                player_balances: new Array(room.players.length).fill(0),
                transfers_history: [],
                starting_savings_given: false
            };
        }
        
        // Инициализируем player_balances если его нет
        if (!room.game_data.player_balances) {
            room.game_data.player_balances = new Array(room.players.length).fill(0);
        }
        
        console.log('💰 Начисляем стартовые сбережения...');
        
        // Начисляем сбережения каждому игроку
        for (let i = 0; i < room.players.length; i++) {
            const player = room.players[i];
            room.game_data.player_balances[i] += amount;
            
            // Добавляем запись в историю
            const transfer = {
                sender: 'Банк',
                recipient: player.name || `Игрок ${i + 1}`,
                amount: amount,
                timestamp: new Date(),
                sender_index: -1, // -1 означает банк
                recipient_index: i,
                type: 'deposit',
                description: 'Стартовые сбережения'
            };
            
            room.game_data.transfers_history.unshift(transfer);
            
            console.log(`✅ Игрок ${i + 1} (${player.name}): +$${amount} → Баланс: $${room.game_data.player_balances[i]}`);
        }
        
        // Отмечаем, что стартовые сбережения были начислены
        room.game_data.starting_savings_given = true;
        
        // Сохраняем изменения
        await room.save();
        
        console.log('🎉 Стартовые сбережения успешно начислены всем игрокам!');
        console.log(`📊 Итого начислено: $${amount * room.players.length}`);
        
    } catch (error) {
        console.error('❌ Ошибка при начислении сбережений:', error);
    }
}

// Функция для начисления сбережений во всех активных комнатах
async function giveStartingSavingsToAllRooms(amount = 3000) {
    try {
        console.log('🔍 Поиск всех активных комнат...');
        
        const rooms = await Room.find({
            'game_data.starting_savings_given': { $ne: true }
        });
        
        console.log(`✅ Найдено ${rooms.length} комнат без стартовых сбережений`);
        
        for (const room of rooms) {
            console.log(`\n🏠 Обрабатываем комнату: ${room._id}`);
            await giveStartingSavings(room._id, amount);
        }
        
        console.log('\n🎉 Обработка всех комнат завершена!');
        
    } catch (error) {
        console.error('❌ Ошибка при обработке комнат:', error);
    }
}

// Основная функция
async function main() {
    try {
        // Подключение к MongoDB
        console.log('🔌 Подключение к MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/em1');
        console.log('✅ Подключение к MongoDB установлено');
        
        // Получаем аргументы командной строки
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            console.log('📋 Использование:');
            console.log('  node give-starting-savings.js <room_id> [amount]  - начислить сбережения в конкретную комнату');
            console.log('  node give-starting-savings.js --all [amount]     - начислить сбережения во все комнаты');
            console.log('');
            console.log('Примеры:');
            console.log('  node give-starting-savings.js 68c7d02787cef27b53d01f44 3000');
            console.log('  node give-starting-savings.js --all 5000');
            return;
        }
        
        if (args[0] === '--all') {
            const amount = parseInt(args[1]) || 3000;
            await giveStartingSavingsToAllRooms(amount);
        } else {
            const roomId = args[0];
            const amount = parseInt(args[1]) || 3000;
            await giveStartingSavings(roomId, amount);
        }
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
    } finally {
        // Закрываем соединение
        await mongoose.connection.close();
        console.log('🔌 Соединение с MongoDB закрыто');
        process.exit(0);
    }
}

// Запускаем скрипт
main();
