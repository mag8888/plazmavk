import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, renderFullAdminPage } from './ui-shared.js';
import { broadcastService } from '../services/broadcast-service.js';

// Setup Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

export const broadcastRouter = Router();

// Ensure service is running
console.log('📢 Broadcast Service initialized:', !!broadcastService);

// 1. List Broadcasts
broadcastRouter.get('/', requireAdmin, async (req, res) => {
  const broadcasts = await prisma.broadcast.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { targets: true } } }
  });

  const renderStatus = (status: string) => {
    const colors: any = {
      'DRAFT': 'bg-gray-100 text-gray-800',
      'PROCESSING': 'bg-blue-100 text-blue-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'PAUSED': 'bg-yellow-100 text-yellow-800',
      'FAILED': 'bg-red-100 text-red-800'
    };
    return `<span class="px-2 py-1 text-xs font-semibold rounded-full ${colors[status] || 'bg-gray-100'}">${status}</span>`;
  };

  const content = `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">📢 Рассылки</h1>
        <a href="/admin/broadcasts/create" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Создать рассылку</a>
      </div>

      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Заголовок</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цель</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Прогресс</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${broadcasts.map((b: any) => `
              <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${new Date(b.createdAt).toLocaleString('ru-RU')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">${b.title}</div>
                  <div class="text-sm text-gray-500 truncate max-w-xs">${b.message}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${b.targetType === 'ALL' ? 'Все' : b.targetType === 'BUYERS' ? 'Покупатели' : 'Не покупали'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  ${renderStatus(b.status)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>
                    <span class="font-medium">${b.sentCount}</span> / ${b.totalRecipients}
                    ${b.failedCount > 0 ? `<span class="text-red-500 ml-1">(${b.failedCount} err)</span>` : ''}
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-1.5 mt-1 dark:bg-gray-700">
                    <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${b.totalRecipients > 0 ? (b.sentCount / b.totalRecipients) * 100 : 0}%"></div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <a href="/admin/broadcasts/${b.id}" class="text-blue-600 hover:text-blue-900">Подробнее</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${broadcasts.length === 0 ? '<div class="p-6 text-center text-gray-500">Нет рассылок</div>' : ''}
      </div>
    </div>
  `;

  // Minimal admin layout wrapper (hacky but quick, reusing style from main admin)
  // Better approach: use a layout function exported from web.ts if possible, but for now just returning partial HTML 
  // to be rendered inside the admin shell if we were inside web.ts.
  // Since we are in a separate router, we need to inject the shell. 
  // Importing `renderAdminShell` from web.ts might be circular or hard if not exported.
  // Let's assume we can import a layout helper or just duplicate the shell for now.
  // Inspection showed `renderAdminShell` is a function inside `web.ts`... likely not exported.

  // STRATEGY: Return full HTML page by copying basic admin layout structure or 
  // requesting `web.ts` to export its layout helpers.
  // Let's modify `web.ts` to export `renderAdminShell` first.

  res.send(renderFullAdminPage({ title: 'Рассылки', activePath: '/admin/broadcasts', content }));
});

// 3. Handle Creation
broadcastRouter.post('/create', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { title, targetType, message, buttonText, buttonUrl } = req.body;
    let photoUrl = null;

    if (req.file) {
      photoUrl = req.file.path; // e.g. uploads/123-file.jpg
    }

    // 1. Create Broadcast Record
    const broadcast = await prisma.broadcast.create({
      data: {
        title,
        message,
        photoUrl,
        buttonText,
        buttonUrl,
        targetType,
        status: 'PROCESSING', // Start immediately
        startedAt: new Date()
      }
    });

    // 2. Select Users based on Target
    let whereClause: any = { isBlocked: false };

    if (targetType === 'BUYERS') {
      whereClause.orders = { some: { status: 'COMPLETED' } };
    } else if (targetType === 'NON_BUYERS') {
      whereClause.orders = { none: { status: 'COMPLETED' } };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: { id: true }
    });

    // 3. Bulk Insert Targets (Batching 5000 at a time)
    const BATCH_INSERT = 5000;
    const total = users.length;

    for (let i = 0; i < total; i += BATCH_INSERT) {
      const batch = users.slice(i, i + BATCH_INSERT);
      await prisma.broadcastTarget.createMany({
        data: batch.map((u: any) => ({
          broadcastId: broadcast.id,
          userId: u.id,
          status: 'PENDING'
        }))
      });
    }

    // Update total count
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { totalRecipients: total }
    });

    res.redirect('/admin/broadcasts');

  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating broadcast: ' + error);
  }
});

// 4. Test Broadcast
broadcastRouter.post('/test', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const { message, buttonText, buttonUrl } = req.body;
    const user = (req as any).session?.user || (req as any).user;

    // Find admin's telegram ID
    const adminUser = await prisma.user.findUnique({ where: { id: user?.id || '' } });

    // Fallback to ADMIN_CHAT_ID from env if user has no ID
    let targetTelegramId = adminUser?.telegramId;

    if (!targetTelegramId && process.env.ADMIN_CHAT_ID) {
      const envIds = process.env.ADMIN_CHAT_ID.split(',').map(id => id.trim()).filter(Boolean);
      if (envIds.length > 0) {
        targetTelegramId = envIds[0];
      }
    }

    if (!targetTelegramId) {
      return res.status(400).json({ error: 'Admin has no linked Telegram ID' });
    }

    await broadcastService.sendTestBroadcast(targetTelegramId, {
      message,
      photo: req.file,
      buttonText,
      buttonUrl
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Test broadcast error:', error);
    res.status(500).json({ error: error.message || 'Failed to send test' });
  }
});

// 5. Audience Count/Preview
broadcastRouter.get('/audience-count', requireAdmin, async (req, res) => {
  try {
    const targetType = req.query.type as string;
    let whereClause: any = { isBlocked: false };

    if (targetType === 'BUYERS') {
      whereClause.orders = { some: { status: 'COMPLETED' } };
    } else if (targetType === 'NON_BUYERS') {
      whereClause.orders = { none: { status: 'COMPLETED' } };
    }

    const count = await prisma.user.count({ where: whereClause });
    const previewUsers = await prisma.user.findMany({
      where: whereClause,
      take: 5,
      select: { firstName: true, username: true, telegramId: true }
    });

    res.json({ count, preview: previewUsers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count audience' });
  }
});

// 2. Create Form (Updated)
broadcastRouter.get('/create', requireAdmin, async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, title: true, price: true }
  });

  const content = `
    <div class="p-6 max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">📢 Новая рассылка</h1>
      
      <form id="broadcastForm" action="/admin/broadcasts/create" method="POST" enctype="multipart/form-data" class="bg-white p-6 rounded-lg shadow space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Название (для себя)</label>
          <input type="text" name="title" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
        </div>

        <div>
           <label class="block text-sm font-medium text-gray-700">Аудитория</label>
           <div class="flex gap-2">
               <select name="targetType" id="targetType" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                 <option value="ALL">Все пользователи</option>
                 <option value="BUYERS">Только покупатели (оплаченные заказы)</option>
                 <option value="NON_BUYERS">Только те, кто НЕ покупал</option>
               </select>
               <button type="button" onclick="checkAudience()" class="mt-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">
                   Проверить
               </button>
           </div>
           <div id="audienceResult" class="text-sm text-gray-500 mt-1"></div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Текст сообщения</label>
          <textarea name="message" id="message" rows="5" required class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"></textarea>
          <p class="text-xs text-gray-500 mt-1">Поддерживается Markdown (жирный, курсив, ссылки)</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Фото (опционально)</label>
          <input type="file" name="photo" id="photo" accept="image/*" class="mt-1 block w-full">
        </div>

        <div class="border-t pt-4 mt-4">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-gray-700">Кнопка</span>
                <button type="button" onclick="openProductModal()" class="text-sm text-blue-600 hover:underline">+ Выбрать товар</button>
            </div>
            <div class="grid grid-cols-2 gap-4">
               <div>
                  <label class="block text-xs text-gray-500">Текст кнопки</label>
                  <input type="text" name="buttonText" id="buttonText" placeholder="Например: В магазин" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
               </div>
               <div>
                  <label class="block text-xs text-gray-500">Ссылка</label>
                  <input type="text" name="buttonUrl" id="buttonUrl" placeholder="https://..." class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
               </div>
            </div>
        </div>

        <div class="pt-6 flex justify-between items-center bg-gray-50 -m-6 p-6 mt-6 rounded-b-lg border-t">
           <button type="button" onclick="sendTest()" class="text-gray-700 border border-gray-300 px-4 py-2 rounded hover:bg-white text-sm">
             🧪 Отправить тест мне
           </button>
           <div class="flex space-x-3">
              <a href="/admin/broadcasts" class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50">Отмена</a>
              <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 shadow-sm">🚀 Запустить рассылку</button>
           </div>
        </div>
      </form>
    </div>

    <!-- Product Modal -->
    <div id="productModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white rounded-lg w-full max-w-md max-h-[80vh] flex flex-col m-4">
            <div class="p-4 border-b flex justify-between items-center">
                <h3 class="font-bold">Выбрать товар</h3>
                <button onclick="closeProductModal()" class="text-gray-500 hover:text-gray-800">&times;</button>
            </div>
            <div class="overflow-y-auto p-2 space-y-1">
                ${products.map(p => `
                    <button type="button" onclick="selectProduct('${p.id}', '${p.title.replace(/'/g, "\\'")}')" class="w-full text-left p-3 hover:bg-gray-50 rounded flex justify-between items-center border-b border-gray-100 last:border-0">
                        <span>${p.title}</span>
                        <span class="text-sm font-bold">${p.price} ₽</span>
                    </button>
                `).join('')}
            </div>
        </div>
    </div>

    <script>
        function openProductModal() {
            document.getElementById('productModal').classList.remove('hidden');
            document.getElementById('productModal').classList.add('flex');
        }
        function closeProductModal() {
            document.getElementById('productModal').classList.add('hidden');
            document.getElementById('productModal').classList.remove('flex');
        }
        function selectProduct(id, title) {
            document.getElementById('buttonText').value = 'Купить ' + title;
            document.getElementById('buttonUrl').value = 'https://t.me/${process.env.BOT_USERNAME || 'PlazmaBot'}?start=prod_' + id;
            closeProductModal();
        }

        async function checkAudience() {
            const type = document.getElementById('targetType').value;
            const res = await fetch('/admin/broadcasts/audience-count?type=' + type);
            const data = await res.json();
            const el = document.getElementById('audienceResult');
            if(data.error) {
                el.innerHTML = '<span class="text-red-500">Ошибка</span>';
            } else {
                const names = data.preview.map(u => u.firstName || u.username || 'User').join(', ');
                el.innerHTML = 'Найдено: <b>' + data.count + '</b> чел. (Пример: ' + names + '...)';
            }
        }

        async function sendTest() {
            const btn = event.target;
            const originalText = btn.innerText;
            btn.innerText = 'Отправка...';
            btn.disabled = true;

            const form = document.getElementById('broadcastForm');
            const formData = new FormData(form);

            try {
                const res = await fetch('/admin/broadcasts/test', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if(data.success) {
                    alert('✅ Тестовое сообщение отправлено в ваш Telegram!');
                } else {
                    alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
                }
            } catch(e) {
                alert('Ошибка сети');
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        }
    </script>
  `;
  res.send(renderFullAdminPage({ title: 'Новая рассылка', activePath: '/admin/broadcasts', content }));
});

// 4. View Details
broadcastRouter.get('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const broadcast = await prisma.broadcast.findUnique({
    where: { id },
    include: {
      // _count: { select: { targets: true } } 
    }
  });

  if (!broadcast) return res.status(404).send('Not found');

  const content = `
      <div class="p-6">
        <div class="mb-4">
            <a href="/admin/broadcasts" class="text-blue-600 hover:underline">&larr; Назад к списку</a>
        </div>
        <h1 class="text-2xl font-bold mb-2">${broadcast.title}</h1>
        <div class="flex space-x-4 text-sm text-gray-500 mb-6">
            <span>Статус: <b>${broadcast.status}</b></span>
            <span>Аудитория: <b>${broadcast.targetType}</b></span>
            <span>Создано: ${new Date(broadcast.createdAt).toLocaleString()}</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white p-4 rounded shadow text-center">
                <div class="text-3xl font-bold text-blue-600">${broadcast.totalRecipients}</div>
                <div class="text-gray-500">Всего получателей</div>
            </div>
            <div class="bg-white p-4 rounded shadow text-center">
                <div class="text-3xl font-bold text-green-600">${broadcast.sentCount}</div>
                <div class="text-gray-500">Успешно отправлено</div>
            </div>
             <div class="bg-white p-4 rounded shadow text-center">
                <div class="text-3xl font-bold text-red-600">${broadcast.failedCount}</div>
                <div class="text-gray-500">Ошибок</div>
            </div>
        </div>

        <div class="bg-white p-6 rounded shadow mb-6">
            <h3 class="font-bold mb-4">Предпросмотр сообщения</h3>
            <div class="border p-4 rounded bg-gray-50 max-w-md">
                ${broadcast.photoUrl ? `<img src="/${broadcast.photoUrl}" class="w-full h-48 object-cover rounded mb-4"/>` : ''}
                <div class="whitespace-pre-wrap">${broadcast.message}</div>
                ${broadcast.buttonText ? `<div class="mt-4 text-center bg-blue-500 text-white py-2 rounded">${broadcast.buttonText}</div>` : ''}
            </div>
        </div>

      </div>
    `;
  res.send(renderFullAdminPage({ title: broadcast.title, activePath: '/admin/broadcasts', content }));
});
