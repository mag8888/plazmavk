# Быстрый чеклист для Plazma агента

## 5 шагов (~20 минут)

### ✅ Шаг 1: Railway Plazma — добавить EXTERNAL_API_KEY
- [ ] Открыть проект Plazma на Railway
- [ ] Перейти в Variables
- [ ] Добавить переменную:
  - Key: `EXTERNAL_API_KEY`
  - Value: `838167d1702e25d4d0c97a5db2ccc25727c2342bf025f08858e19b0388ffc0de`
- [ ] Сохранить

**Время:** ~3 минуты

---

### ✅ Шаг 2: Railway Vital — проверить переменные
- [ ] Открыть проект Vital на Railway
- [ ] Перейти в Variables
- [ ] Проверить/добавить:
  - `PLAZMA_API_KEY` = `838167d1702e25d4d0c97a5db2ccc25727c2342bf025f08858e19b0388ffc0de`
  - `PLAZMA_API_URL` = `https://plazma-production.up.railway.app/api/external`
- [ ] Сохранить

**Время:** ~5 минут

---

### ✅ Шаг 3: Перезапустить Plazma
- [ ] В проекте Plazma на Railway
- [ ] Перейти в Deployments
- [ ] Нажать Redeploy
- [ ] Дождаться завершения

**Время:** ~3 минуты

---

### ✅ Шаг 4: Тест API
```bash
curl -X GET "https://plazma-production.up.railway.app/api/external/catalog" \
  -H "X-API-Key: 838167d1702e25d4d0c97a5db2ccc25727c2342bf025f08858e19b0388ffc0de"
```
- [ ] Запрос возвращает JSON (не 401)
- [ ] В ответе есть массив категорий с товарами

**Время:** ~2 минуты

---

### ✅ Шаг 5: Проверить Vital
- [ ] Открыть: https://vital-production-82b0.up.railway.app/webapp
- [ ] Найти секцию "Рекомендуем"
- [ ] Убедиться, что товары отображаются
- [ ] Проверить консоль браузера (F12) — нет ошибок

**Время:** ~5 минут

---

## Критерии успеха

✅ API возвращает каталог (не 401)  
✅ Товары отображаются на Vital  
✅ Нет ошибок в консоли  

## Если что-то не работает

1. **401 Unauthorized** → Проверить `EXTERNAL_API_KEY` в Plazma
2. **Товары не отображаются** → Проверить переменные в Vital
3. **Ошибки в консоли** → Проверить Network tab в браузере

## Ссылки

- [Полное ТЗ](TASK_FOR_PLAZMA_AGENT.md)
- [Краткая инструкция](README_FOR_AGENT.md)
- [Документация API](../../docs/EXTERNAL_API.md)

