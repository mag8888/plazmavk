// Game Board v2.0 - Player Colors Configuration
// Система цветов для игроков

const PLAYER_COLORS = [
    {
        id: 1,
        name: 'Синий',
        primary: '#3B82F6',
        secondary: '#1E40AF',
        gradient: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
        emoji: '🔵'
    },
    {
        id: 2,
        name: 'Красный',
        primary: '#EF4444',
        secondary: '#DC2626',
        gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        emoji: '🔴'
    },
    {
        id: 3,
        name: 'Зеленый',
        primary: '#10B981',
        secondary: '#059669',
        gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        emoji: '🟢'
    },
    {
        id: 4,
        name: 'Фиолетовый',
        primary: '#8B5CF6',
        secondary: '#7C3AED',
        gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
        emoji: '🟣'
    },
    {
        id: 5,
        name: 'Оранжевый',
        primary: '#F59E0B',
        secondary: '#D97706',
        gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        emoji: '🟠'
    },
    {
        id: 6,
        name: 'Розовый',
        primary: '#EC4899',
        secondary: '#DB2777',
        gradient: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
        emoji: '🩷'
    },
    {
        id: 7,
        name: 'Бирюзовый',
        primary: '#06B6D4',
        secondary: '#0891B2',
        gradient: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
        emoji: '🔵'
    },
    {
        id: 8,
        name: 'Желтый',
        primary: '#EAB308',
        secondary: '#CA8A04',
        gradient: 'linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)',
        emoji: '🟡'
    }
];

// Функции для работы с цветами игроков
const PlayerColorsUtils = {
    // Получить цвет по ID
    getColorById: (id) => {
        return PLAYER_COLORS.find(color => color.id === id) || PLAYER_COLORS[0];
    },

    // Получить цвет по индексу (0-7)
    getColorByIndex: (index) => {
        return PLAYER_COLORS[index % PLAYER_COLORS.length];
    },

    // Получить случайный цвет
    getRandomColor: () => {
        return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
    },

    // Назначить цвет игроку по его порядку в комнате
    assignColorToPlayer: (playerIndex) => {
        return PlayerColorsUtils.getColorByIndex(playerIndex);
    },

    // Получить все цвета
    getAllColors: () => {
        return PLAYER_COLORS;
    },

    // Проверить, свободен ли цвет в комнате
    isColorAvailable: (colorId, roomPlayers) => {
        return !roomPlayers.some(player => player.colorId === colorId);
    },

    // Назначить цвета всем игрокам в комнате
    assignColorsToRoom: (players) => {
        return players.map((player, index) => ({
            ...player,
            colorId: PlayerColorsUtils.getColorByIndex(index).id,
            color: PlayerColorsUtils.getColorByIndex(index)
        }));
    }
};

module.exports = {
    PLAYER_COLORS,
    PlayerColorsUtils
};
