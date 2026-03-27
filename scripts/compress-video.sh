#!/bin/bash

# Скрипт для сжатия видео для Telegram бота
# Использование: ./compress-video.sh input.mp4 output.mp4

INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Использование: $0 input.mp4 output.mp4"
    exit 1
fi

# Проверяем наличие ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "Ошибка: ffmpeg не установлен"
    echo "Установите ffmpeg: brew install ffmpeg (macOS) или apt install ffmpeg (Ubuntu)"
    exit 1
fi

echo "Сжимаем видео для Telegram бота..."
echo "Входной файл: $INPUT_FILE"
echo "Выходной файл: $OUTPUT_FILE"

# Сжатие с оптимизацией для Telegram
ffmpeg -i "$INPUT_FILE" \
    -c:v libx264 \
    -preset fast \
    -crf 28 \
    -maxrate 2M \
    -bufsize 4M \
    -vf "scale=720:480:force_original_aspect_ratio=decrease,pad=720:480:(ow-iw)/2:(oh-ih)/2" \
    -c:a aac \
    -b:a 128k \
    -movflags +faststart \
    -y \
    "$OUTPUT_FILE"

echo "Сжатие завершено!"
echo "Размер исходного файла: $(du -h "$INPUT_FILE" | cut -f1)"
echo "Размер сжатого файла: $(du -h "$OUTPUT_FILE" | cut -f1)"
