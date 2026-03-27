#!/bin/bash

# Скрипт для настройки replica set на Railway MongoDB
# Использование: ./setup-replica-set.sh

echo "🔗 Подключение к Railway проекту..."
echo "💡 Выберите проект 'plazma-production' из списка"
railway link

echo ""
echo "📊 Проверка подключения..."
railway status

echo ""
echo "🔧 Открытие MongoDB shell..."
echo "💡 В MongoDB shell выполните следующие команды:"
echo ""
echo "rs.initiate({"
echo "  _id: \"rs0\","
echo "  members: ["
echo "    { _id: 0, host: \"localhost:27017\" }"
echo "  ]"
echo "})"
echo ""
echo "// Подождите 5-10 секунд, затем проверьте:"
echo "rs.status()"
echo ""
echo "// Должно показать \"set\": \"rs0\" и \"stateStr\": \"PRIMARY\""
echo "// Выйдите: exit"
echo ""

railway run mongosh
