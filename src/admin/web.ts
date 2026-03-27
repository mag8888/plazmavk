import express from 'express';
import multer from 'multer';
import session from 'express-session';
import { prisma } from '../lib/prisma.js';
import { recalculatePartnerBonuses, activatePartnerProfile, checkPartnerActivation, calculateDualSystemBonuses } from '../services/partner-service.js';
import { ordersModule } from './orders-module.js';
import { uploadImage, isCloudinaryConfigured } from '../services/cloudinary-service.js';
import { broadcastRouter } from './broadcast-router.js';
import { promotionsRouter } from './promotions.js';
import { requireAdmin, renderAdminShellStart, renderAdminShellEnd, adminIcon, ADMIN_UI_CSS } from './ui-shared.js';

const router = express.Router();

// Mount promotions router early to avoid shadowing
router.use('/promotions', requireAdmin, promotionsRouter);

// Basic HTML escaping helper (server-side templates)
function escapeHtml(input: any): string {
  const s = String(input ?? '');
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shared UI styles for the web admin (keep inline to avoid relying on static assets).
// Goal: consistent buttons/inputs/focus states across all admin pages.
// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for images
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только файлы изображений разрешены'));
    }
  }
});

// requireAdmin imported from ui-shared.js

// Admin login page
router.get('/login', (req, res) => {
  const error = req.query.error;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Панель управления Plazma</title>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background: #f5f5f5; }
        .login-container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: bold; color: #333; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .error { color: red; margin-top: 10px; text-align: center; }
        h2 { text-align: center; color: #333; margin-bottom: 30px; }

        /* Shared admin UI baseline */
        ${ADMIN_UI_CSS}
      </style>
    </head>
    <body>
      <div class="login-container">
        <h2>🔧 Панель управления Plazma</h2>
        <form method="post" action="/admin/login">
          <div class="form-group">
            <label>Пароль:</label>
            <input type="password" name="password" placeholder="Введите пароль" required>
          </div>
          <button type="submit" class="btn">Войти</button>
          ${error ? '<div class="error">Неверный пароль</div>' : ''}
        </form>
      </div>
    </body>
    </html>
  `);
});

// Handle login POST request
router.post('/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('❌ ADMIN_PASSWORD not set! Login disabled.');
    return res.redirect('/admin/login?error=1');
  }

  if (password && password === adminPassword) {
    const session = req.session as any;
    session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.redirect('/admin/login?error=1');
  }
});

// Main admin panel
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Calculate total balance of all users (not just partners)
    const allUsers = await prisma.user.findMany({
      select: { balance: true }
    });
    const totalBalance = allUsers.reduce((sum, user) => sum + (user.balance || 0), 0);

    console.log(`🔍 Debug: Total balance of all users: ${totalBalance} PZ`);

    const stats = {
      categories: await prisma.category.count(),
      products: await prisma.product.count(),
      partners: await prisma.partnerProfile.count(),
      reviews: await prisma.review.count(),
      orders: await prisma.orderRequest.count(),
      users: await prisma.user.count(),
      totalBalance: totalBalance,
    };
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    // Helper function for detailed users section
    async function getDetailedUsersSection() {
      try {
        // Get recent users with their related data (preview)
        const users = await prisma.user.findMany({
          include: {
            partner: {
              include: {
                referrals: true,
                transactions: true
              }
            },
            orders: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10 // Limit to 10 users for main page
        });

        // Get inviter information for each user
        const usersWithInviterInfo = await Promise.all(users.map(async (user: any) => {
          // Find who invited this user
          const referralRecord = await prisma.partnerReferral.findFirst({
            where: { referredId: user.id },
            include: {
              profile: {
                include: {
                  user: { select: { username: true, firstName: true } }
                }
              }
            }
          });

          return {
            ...user,
            inviter: referralRecord?.profile?.user || null
          };
        }));

        // Calculate additional data for each user
        const usersWithStats = usersWithInviterInfo.map((user: any) => {
          const partnerProfile = user.partner;
          const directPartners = partnerProfile?.referrals?.length || 0;

          // Calculate total referrals at all levels (simplified for main page)
          function countAllReferrals(userId: string, visited = new Set()): number {
            if (visited.has(userId)) return 0; // Prevent infinite loops
            visited.add(userId);

            const directReferrals = users.filter(u =>
              u.partner?.referrals?.some((ref: any) => ref.referredId === userId)
            );

            let totalCount = directReferrals.length;

            // Recursively count referrals of referrals
            directReferrals.forEach(ref => {
              totalCount += countAllReferrals(ref.id, new Set(visited));
            });

            return totalCount;
          }

          const totalPartners = countAllReferrals(user.id);

          // Разделяем заказы по статусам
          const ordersByStatus = {
            new: user.orders?.filter((order: any) => order.status === 'NEW') || [],
            processing: user.orders?.filter((order: any) => order.status === 'PROCESSING') || [],
            completed: user.orders?.filter((order: any) => order.status === 'COMPLETED') || [],
            cancelled: user.orders?.filter((order: any) => order.status === 'CANCELLED') || []
          };

          // Сумма только оплаченных (завершенных) заказов
          const paidOrderSum = ordersByStatus.completed.reduce((sum: number, order: any) => {
            try {
              const items = typeof order.itemsJson === 'string'
                ? JSON.parse(order.itemsJson || '[]')
                : (order.itemsJson || []);
              const orderTotal = items.reduce((itemSum: number, item: any) => itemSum + (item.price || 0) * (item.quantity || 1), 0);
              return sum + orderTotal;
            } catch {
              return sum;
            }
          }, 0);

          // Определяем приоритетный статус (новые заказы имеют приоритет)
          const hasNewOrders = ordersByStatus.new.length > 0;
          const hasProcessingOrders = ordersByStatus.processing.length > 0;
          const hasCompletedOrders = ordersByStatus.completed.length > 0;
          const hasCancelledOrders = ordersByStatus.cancelled.length > 0;

          let priorityStatus = 'none';
          if (hasNewOrders) priorityStatus = 'new';
          else if (hasProcessingOrders) priorityStatus = 'processing';
          else if (hasCompletedOrders) priorityStatus = 'completed';
          else if (hasCancelledOrders) priorityStatus = 'cancelled';

          // Debug: Log status determination
          if (user.orders && user.orders.length > 0) {
            console.log(`User ${user.firstName} orders:`, {
              total: user.orders.length,
              new: ordersByStatus.new.length,
              processing: ordersByStatus.processing.length,
              completed: ordersByStatus.completed.length,
              cancelled: ordersByStatus.cancelled.length,
              priorityStatus: priorityStatus
            });
          }

          const totalOrderSum = paidOrderSum; // Используем только оплаченные заказы
          const balance = user.balance || partnerProfile?.balance || 0;
          const bonus = partnerProfile?.bonus || 0;
          const lastActivity = user.updatedAt || user.createdAt;

          return {
            ...user,
            directPartners,
            totalPartners,
            totalOrderSum,
            balance,
            bonus,
            lastActivity,
            ordersByStatus,
            priorityStatus,
            paidOrderSum
          };
        });

        if (usersWithStats.length === 0) {
          return '<div class="empty-state"><h3>📭 Нет пользователей</h3><p>Пользователи появятся здесь после регистрации</p></div>';
        }

        // Calculate total balance across ALL users (not just this screen)
        const allBalances = await prisma.user.findMany({ select: { balance: true } });
        const totalUserBalance = allBalances.reduce((sum, u) => sum + (u.balance || 0), 0);

        return `
          <div class="detailed-users-container">
            <!-- Total Balance Header -->
            <div style="background: linear-gradient(135deg, #e8f5e8 0%, #d4edda 100%); padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 2px solid #28a745; box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2);">
              <h3 style="margin: 0; color: #28a745; font-size: 18px;">💰 Общий баланс всех пользователей: ${totalUserBalance.toFixed(2)} PZ</h3>
            </div>
            
            <div class="table-controls" style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
              <div class="sort-controls">
                <label>Сортировать по:</label>
                <select id="sortBy" onchange="applySorting()">
                  <option value="createdAt" selected>Дата регистрации</option>
                  <option value="name">Имени</option>
                  <option value="balance">Балансу</option>
                  <option value="partners">Партнёрам</option>
                  <option value="orders">Заказам</option>
                  <option value="activity">Активности</option>
                </select>
                <select id="sortOrder" onchange="applySorting()">
                  <option value="asc">По возрастанию</option>
                  <option value="desc" selected>По убыванию</option>
                </select>
              </div>
              <div class="message-controls">
                <button class="btn" onclick="selectAllUsers()">Выбрать всех</button>
                <button class="btn" onclick="deselectAllUsers()">Снять выбор</button>
                <button class="btn" onclick="openMessageComposer()" style="background: #28a745;">📨 Отправить сообщение</button>
              </div>
            </div>
            <div class="users-table-container">
              <table class="users-table">
                <thead>
                  <tr>
                    <th><input type="checkbox" id="selectAll" onchange="toggleAllUsers()"></th>
                    <th onclick="sortTable('name')" style="cursor: pointer;">Пользователь ↕️</th>
                    <th onclick="sortTable('balance')" style="cursor: pointer;">Баланс ↕️</th>
                    <th onclick="sortTable('partners')" style="cursor: pointer;">Партнёры ↕️</th>
                    <th onclick="sortTable('orders')" style="cursor: pointer;">Заказы ↕️</th>
                    <th onclick="sortTable('activity')" style="cursor: pointer;">Последняя активность ↕️</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  ${usersWithStats.map(user => `
                    <tr data-user-id="${user.id}" data-name="${user.firstName || 'Без имени'}" data-balance="${user.balance}" data-partners="${user.totalPartners}" data-orders="${user.priorityStatus}" data-orders-sum="${user.totalOrderSum}" data-activity="${user.lastActivity.getTime()}">
                      <td><input type="checkbox" class="user-checkbox" value="${user.id}"></td>
                      <td>
                        <div class="user-info">
                          <div class="user-avatar">${(user.firstName || 'U')[0].toUpperCase()}</div>
                          <div class="user-details">
                            <h4><a href="javascript:void(0)" onclick="if(typeof showUserDetails === 'function') { showUserDetails('${user.id}'); } else { console.error('showUserDetails not defined'); window.open('/admin/users/${user.id}', '_blank', 'width=600,height=400'); }" class="user-name-link" style="cursor: pointer; color: #007bff; text-decoration: none;">${user.firstName || 'Без имени'} ${user.lastName || ''}</a></h4>
                            <p>@${user.username || 'без username'}</p>
                            <div style="display:flex; align-items:center; gap:6px;">
                              ${user.inviter ? `<p style=\"font-size: 11px; color: #6c757d; margin:0;\">Пригласил: @${user.inviter.username || user.inviter.firstName || 'неизвестно'}</p>` : `<p style=\"font-size: 11px; color: #6c757d; margin:0;\">Пригласитель: —</p>`}
                              <button class="balance-plus-btn" title="Сменить пригласителя" onclick="openChangeInviter('${user.id}', '${user.firstName || 'Пользователь'}')">+</button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div class="balance ${user.balance > 0 ? 'positive' : 'zero'}">
                            ${user.balance.toFixed(2)} PZ
                          </div>
                          <button class="balance-plus-btn" onclick="openBalanceModal('${user.id}', '${user.firstName || 'Пользователь'}', ${user.balance})" title="Изменить баланс">
                            +
                          </button>
                        </div>
                        ${user.bonus > 0 ? `<div style="font-size: 11px; color: #6c757d;">Бонусы: ${user.bonus.toFixed(2)} PZ</div>` : ''}
                      </td>
                      <td>
                        <button class="partners-count-btn" onclick="if(typeof showUserPartners === 'function') { showUserPartners('${user.id}', '${user.firstName || 'Пользователь'}'); } else { console.error('showUserPartners not defined'); window.open('/admin/users/${user.id}/partners', '_blank', 'width=800,height=600'); }" style="background: none; border: none; cursor: pointer; padding: 0;">
                          <div class="partners-count">${user.totalPartners} всего</div>
                          ${user.directPartners > 0 ? `<div style="font-size: 11px; color: #6c757d;">${user.directPartners} прямых</div>` : ''}
                        </button>
                      </td>
                      <td>
                        <button class="orders-sum-btn" onclick="if(typeof showUserOrders === 'function') { showUserOrders('${user.id}', '${user.firstName || 'Пользователь'}'); } else { console.error('showUserOrders not defined'); window.open('/admin/users/${user.id}/orders', '_blank', 'width=1000,height=700'); }" style="background: none; border: none; cursor: pointer; padding: 0; width: 100%; text-align: left;">
                          <div class="orders-sum">${user.totalOrderSum.toFixed(2)} PZ</div>
                          <div class="orders-count status-${user.priorityStatus}" data-status="${user.priorityStatus}" title="Status: ${user.priorityStatus}">
                            ${user.orders?.length || 0} заказов
                            ${user.priorityStatus === 'new' ? ' 🔴' : ''}
                            ${user.priorityStatus === 'processing' ? ' 🟡' : ''}
                            ${user.priorityStatus === 'completed' ? ' 🟢' : ''}
                            ${user.priorityStatus === 'cancelled' ? ' ⚫' : ''}
                          </div>
                        </button>
                      </td>
                      <td>
                        <div style="font-size: 13px; color: #6c757d;">
                          ${user.lastActivity.toLocaleString('ru-RU')}
                        </div>
                      </td>
                    <td>
                      <button class="action-btn hierarchy" onclick="if(typeof showHierarchy === 'function') { showHierarchy('${user.id}'); } else { console.error('showHierarchy not defined'); window.open('/admin/partners-hierarchy?user=${user.id}', '_blank', 'width=800,height=600'); }">
                        🌳 Иерархия
                      </button>
                      <button class="action-btn" onclick="if(typeof showUserDetails === 'function') { showUserDetails('${user.id}'); } else { console.error('showUserDetails not defined'); window.open('/admin/users/${user.id}', '_blank', 'width=600,height=400'); }">
                          👁 Подробно
                        </button>
                        <button class="action-btn" onclick="openChangeInviter('${user.id}', '${user.firstName || 'Пользователь'}')">
                          🔄 Пригласитель
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="/admin/users-detailed" class="btn">📊 Полный список пользователей</a>
              <a href="/admin/instructions" class="btn" style="background: #28a745; margin-left: 10px;">📋 Инструкции</a>
            </div>
          </div>
        `;
      } catch (error) {
        return '<div class="empty-state"><h3>❌ Ошибка загрузки</h3><p>Не удалось загрузить данные пользователей</p></div>';
      }
    }

    // Helper functions for lists
    async function getRecentUsers() {
      try {
        const users = await prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { firstName: true, lastName: true, username: true, createdAt: true }
        });

        if (users.length === 0) {
          return '<div class="dash-item"><div><div class="title">Нет пользователей</div><div class="muted">Пока пусто</div></div><div class="muted">—</div></div>';
        }

        return users.map(user => `
          <div class="dash-item">
            <div>
              <div class="title">${user.firstName || 'Пользователь'} ${user.lastName || ''}</div>
              <div class="muted">${user.createdAt.toLocaleString('ru-RU')}</div>
            </div>
            <div class="muted">${user.username ? ('@' + user.username) : '—'}</div>
          </div>
        `).join('');
      } catch (error) {
        return '<div class="dash-item"><div><div class="title">Ошибка загрузки</div><div class="muted">Не удалось получить пользователей</div></div><div class="muted">—</div></div>';
      }
    }

    async function getRecentOrders() {
      try {
        const orders = await prisma.orderRequest.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: { select: { firstName: true, lastName: true } }
          }
        });

        if (orders.length === 0) {
          return '<div class="dash-item"><div><div class="title">Нет заказов</div><div class="muted">Пока пусто</div></div><div class="muted">—</div></div>';
        }

        return orders.map(order => `
          <div class="dash-item">
            <div>
              <div class="title">Заказ ${order.id.slice(0, 8)}…</div>
              <div class="muted">${order.createdAt.toLocaleString('ru-RU')}</div>
            </div>
            <div class="muted">${order.user?.firstName || 'Пользователь'}</div>
          </div>
        `).join('');
      } catch (error) {
        return '<div class="dash-item"><div><div class="title">Ошибка загрузки</div><div class="muted">Не удалось получить заказы</div></div><div class="muted">—</div></div>';
      }
    }

    async function getRecentTransactions() {
      try {
        const transactions = await prisma.partnerTransaction.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            profile: {
              include: {
                user: { select: { firstName: true, lastName: true } }
              }
            }
          }
        });

        if (transactions.length === 0) {
          return '<div class="dash-item"><div><div class="title">Нет транзакций</div><div class="muted">Пока пусто</div></div><div class="muted">—</div></div>';
        }

        return transactions.map(tx => `
          <div class="dash-item">
            <div>
              <div class="title">${tx.profile.user.firstName || 'Партнёр'}</div>
              <div class="muted">${tx.createdAt.toLocaleString('ru-RU')} • ${(tx.description || '').toString().slice(0, 60)}${(tx.description || '').toString().length > 60 ? '…' : ''}</div>
            </div>
            <div class="muted" style="font-weight:900; color:${tx.amount < 0 ? 'var(--admin-danger)' : 'var(--admin-text)'};">
              ${tx.amount > 0 ? '+' : ''}${tx.amount.toFixed(2)} PZ
            </div>
          </div>
        `).join('');
      } catch (error) {
        return '<div class="dash-item"><div><div class="title">Ошибка загрузки</div><div class="muted">Не удалось получить транзакции</div></div><div class="muted">—</div></div>';
      }
    }
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Панель управления Plazma v2.0</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        
        <!-- Quill Rich Text Editor -->
        <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
        <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
        
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .tabs { display: flex; border-bottom: 2px solid #e9ecef; margin-bottom: 30px; }
          .tab { padding: 15px 25px; background: none; border: none; cursor: pointer; font-size: 16px; color: #6c757d; border-bottom: 3px solid transparent; transition: all 0.3s; }
          .tab.active { color: #007bff; border-bottom-color: #007bff; font-weight: 600; }
          .tab:hover { color: #007bff; background: #f8f9fa; }
          .tab-content { display: none; }
          .tab-content.active { display: block; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
          .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; cursor: pointer; transition: all 0.3s; }
          .stat-card:hover { background: #e9ecef; transform: translateY(-2px); }
          .stat-number { font-size: 2em; font-weight: bold; color: #007bff; margin-bottom: 5px; }
          .stat-label { color: #6c757d; font-size: 0.9em; }
          .btn { background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px; }
          .btn:hover { background: #0056b3; }
          .section-header { display: flex; justify-content: space-between; align-items: center; margin: 20px 0; }
          .section-title { font-size: 24px; font-weight: 600; color: #333; }
          .action-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
          
          /* Recent Lists Styles */
          .recent-lists { margin: 30px 0; }
          .list-section { margin-bottom: 25px; }
          .list-section h3 { margin-bottom: 15px; color: #333; font-size: 18px; }
          .list-container { 
            background: #f8f9fa; 
            border: 1px solid #e9ecef; 
            border-radius: 8px; 
            padding: 15px; 
            max-height: 200px; 
            overflow-y: auto; 
          }
          .list-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 8px 0; 
            border-bottom: 1px solid #e9ecef; 
          }
          .list-item:last-child { border-bottom: none; }
          .list-item:hover { background: #e9ecef; }
          .list-info { flex: 1; }
          .list-name { font-weight: 600; color: #333; }
          .list-time { color: #6c757d; font-size: 0.9em; }
          .list-amount { font-weight: bold; color: #28a745; }
          .list-amount.negative { color: #dc3545; }
          .empty-list { text-align: center; color: #6c757d; padding: 20px; }
          
          /* Detailed Users Table Styles */
          .detailed-users-container { margin: 20px 0; }
          .users-table-container { overflow-x: auto; }
          .users-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .users-table th { background: #f8f9fa; padding: 15px 12px; text-align: left; font-weight: 600; color: #495057; border-bottom: 2px solid #dee2e6; }
          .users-table td { padding: 15px 12px; border-bottom: 1px solid #dee2e6; vertical-align: top; }
          .users-table tr:hover { background: #f8f9fa; }
          
          .user-info { display: flex; align-items: center; gap: 12px; }
          .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px; }
          .user-details h4 { margin: 0; font-size: 16px; color: #212529; }
          .user-details p { margin: 2px 0 0 0; font-size: 13px; color: #6c757d; }
          .user-name-link { color: #212529; text-decoration: none; transition: color 0.3s ease; }
          .user-name-link:hover { color: #007bff; text-decoration: underline; }
          
          .balance { font-weight: bold; font-size: 14px; }
          .balance.positive { color: #28a745; }
          .balance.zero { color: #6c757d; }
          
          .partners-count { background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
          .orders-sum { background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
          
          .action-btn { background: #007bff; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; margin: 1px; }
          .action-btn:hover { background: #0056b3; }
          .action-btn.hierarchy { background: #28a745; }
          .action-btn.hierarchy:hover { background: #1e7e34; }
          
          .balance-plus-btn { 
            background: #28a745; 
            color: white; 
            border: none; 
            border-radius: 50%; 
            width: 24px; 
            height: 24px; 
            cursor: pointer; 
            font-size: 16px; 
            font-weight: bold; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            transition: all 0.2s ease;
          }
          .balance-plus-btn:hover { 
            background: #218838; 
            transform: scale(1.1); 
          }
          
          .partners-count-btn:hover .partners-count { 
            background: #bbdefb; 
            transform: scale(1.05); 
            transition: all 0.2s ease;
          }
          
          .orders-sum-btn:hover .orders-sum { 
            background: #fff3cd; 
            transform: scale(1.05); 
            transition: all 0.2s ease;
          }
          
          .orders-count {
            padding: 3px 8px;
            border-radius: 6px;
            display: inline-block;
            font-weight: 600;
            font-size: 11px;
            transition: all 0.2s ease;
          }
          
          .orders-count.status-new {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
            box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
          }
          
          .orders-count.status-processing {
            background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%) !important;
            color: white !important;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2) !important;
            box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3) !important;
          }
          
          .orders-count.status-completed {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
            box-shadow: 0 2px 4px rgba(40, 167, 69, 0.3);
          }
          
          .orders-count.status-cancelled {
            background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.2);
            box-shadow: 0 2px 4px rgba(108, 117, 125, 0.3);
          }
          
          .orders-count.status-none {
            color: #6c757d;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
          }
          
          /* Balance Modal Styles */
          .modal-overlay { 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); 
            z-index: 1000; display: flex; align-items: center; justify-content: center; 
            animation: modalFadeIn 0.3s ease-out;
          }
          @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalSlideIn { from { transform: translateY(-20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
          
          .modal-content { 
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); 
            border-radius: 16px; padding: 0; max-width: 500px; width: 95%; 
            box-shadow: 0 25px 50px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.1); 
            animation: modalSlideIn 0.3s ease-out;
          }
          
          .modal-header { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 20px 24px; border-bottom: 1px solid rgba(226, 232, 240, 0.8); 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px 16px 0 0;
            color: white;
          }
          .modal-header h2 { margin: 0; font-size: 20px; font-weight: 700; }
          .close-btn { 
            background: rgba(255,255,255,0.2); border: none; font-size: 18px; 
            cursor: pointer; color: white; padding: 0; width: 28px; height: 28px; 
            display: flex; align-items: center; justify-content: center; 
            border-radius: 6px; transition: all 0.2s ease;
          }
          .close-btn:hover { background: rgba(255,255,255,0.3); }
          
          .modal-body { padding: 24px; }
          .modal-body .form-group { margin-bottom: 16px; }
          .modal-body label { display: block; margin-bottom: 6px; font-weight: 600; color: #374151; }
          .modal-body input, .modal-body select, .modal-body textarea { 
            width: 100%; padding: 10px 12px; border: 2px solid #e2e8f0; 
            border-radius: 8px; font-size: 14px; transition: all 0.2s ease;
          }
          .modal-body input:focus, .modal-body select:focus, .modal-body textarea:focus { 
            outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1); 
          }
          
          .form-actions { 
            display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;
          }
          .form-actions button { 
            padding: 10px 20px; border: none; border-radius: 8px; 
            font-weight: 600; cursor: pointer; transition: all 0.2s ease; 
          }
          .form-actions button[type="button"] { 
            background: #e2e8f0; color: #64748b; 
          }
          .form-actions button[type="button"]:hover { background: #cbd5e1; }
          .form-actions button[type="submit"] { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
          }
          .form-actions button[type="submit"]:hover { 
            background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%); 
          }
          
          /* Table Controls Styles */
          .table-controls { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6; }
          .sort-controls label { font-weight: 600; margin-right: 10px; }
          .sort-controls select { margin-right: 10px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px; }
          .message-controls { display: flex; gap: 10px; }
          .message-controls .btn { padding: 8px 12px; font-size: 14px; }
          
          /* Checkbox Styles */
          .user-checkbox { transform: scale(1.2); cursor: pointer; }
          #selectAll { transform: scale(1.2); cursor: pointer; }
          
          /* Sortable Headers */
          th[onclick] { user-select: none; }
          th[onclick]:hover { background: #e9ecef; }
          
          /* Message Composer Modal */
          .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); }
          .modal-content { background-color: white; margin: 5% auto; padding: 20px; border-radius: 8px; width: 80%; max-width: 600px; max-height: 80vh; overflow-y: auto; }
          .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .close { color: #aaa; font-size: 28px; font-weight: bold; cursor: pointer; }
          .close:hover { color: #000; }
          .form-group { margin-bottom: 15px; }
          .form-group label { display: block; margin-bottom: 5px; font-weight: 600; }
          /* Inputs: don't apply full-width/padding styles to checkboxes/radios (they become huge "switches" in some browsers) */
          .form-group input[type="text"],
          .form-group input[type="password"],
          .form-group input[type="number"],
          .form-group input[type="search"],
          .form-group input[type="email"],
          .form-group input[type="url"],
          .form-group textarea,
          .form-group select { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; }
          .form-group input[type="checkbox"],
          .form-group input[type="radio"] { width: auto; padding: 0; border: 0; box-shadow: none; }
          .form-group textarea { height: 100px; resize: vertical; }
          .modal-footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
          
          /* Product Form Styles */
          .product-modal { max-width: 920px; width: min(920px, 92%); padding: 28px 32px; }
          .product-form { display: flex; flex-direction: column; gap: 24px; }
          .product-section { background: #f8f9fb; border: 1px solid #e9ecef; border-radius: 12px; padding: 20px 24px; box-shadow: 0 18px 22px -18px rgba(15, 23, 42, 0.35); }
          .product-section-header { display: flex; flex-direction: column; gap: 4px; margin-bottom: 18px; }
          .product-section-title { font-size: 17px; font-weight: 600; color: #212529; }
          .product-section-subtitle { font-size: 13px; color: #6c757d; }
          .product-grid { display: grid; gap: 18px; }
          .product-grid.two-columns { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
          .product-grid.three-columns { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
          @media (min-width: 900px) {
            .product-grid.three-columns { grid-template-columns: repeat(3, 1fr); }
          }
          .product-grid.media-layout { grid-template-columns: repeat(2, 1fr); align-items: stretch; }
          .product-form textarea { resize: vertical; }
          #productShortDescription { min-height: 220px; }
          #productFullDescription { min-height: 220px; }
          .category-picker { display: flex; gap: 12px; }
          .category-picker select { flex: 1; }
          .category-picker .btn { padding: 8px 14px; border-radius: 8px; }
          .regions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
          .regions-grid label { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: linear-gradient(135deg, #f8f9fa, #eef1f6); border-radius: 10px; cursor: pointer; border: 1px solid #e1e5eb; transition: all 0.2s ease; }
          .regions-grid label:hover { border-color: #cfd6df; box-shadow: 0 8px 18px -12px rgba(41, 72, 125, 0.45); }
          .switch-row input { transform: scale(1.2); }
          .char-count { text-align: right; font-size: 12px; color: #6c757d; margin-top: 5px; }
          .file-info { font-size: 12px; color: #6c757d; }
          .product-media { display: grid; grid-template-columns: 220px 1fr; gap: 16px; align-items: center; }
          .image-preview { width: 220px; height: 220px; border-radius: 12px; background: #f1f3f5 center/cover no-repeat; border: 1px solid #dee2e6; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6); }
          .image-controls { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
          .image-controls input[type="file"] { cursor: pointer; }
          .image-controls .file-info { margin-top: 4px; }
          .media-group label { margin-bottom: 10px; display: block; }
          .status-toggle { display: inline-flex; align-items: center; gap: 12px; font-weight: 500; color: #343a40; cursor: pointer; }
          .status-toggle input { transform: scale(1.15); }
          @media (max-width: 768px) {
            .product-modal { width: 94%; padding: 20px; }
            .product-section { padding: 18px 20px; }
            .product-media { grid-template-columns: 1fr; }
          }

          /* Shared admin UI baseline */
          ${ADMIN_UI_CSS}

          /* New Dashboard (Dribbble-like) */
          .dash-wrap{ display:grid; grid-template-columns: 1.25fr 1fr; gap: 18px; }
          .dash-cards{ display:grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .dash-card{
            background: var(--admin-surface);
            border: 1px dashed var(--admin-border-strong);
            border-radius: 22px;
            padding: 18px 18px;
            box-shadow: 0 14px 34px rgba(17,24,39,0.06);
            min-height: 120px;
          }
          .dash-card-link{
            display:block;
            text-decoration:none;
            color: inherit;
            cursor: pointer;
            transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
          }
          .dash-card-link:hover{
            transform: translateY(-2px);
            box-shadow: 0 18px 44px rgba(17,24,39,0.08);
            background: rgba(17,24,39,0.01);
          }
          .dash-card-link:focus-visible{
            outline: 3px solid rgba(102,126,234,0.35);
            outline-offset: 3px;
          }
          .dash-card.solid{ border-style: solid; }
          .dash-card h3{ margin:0; font-size: 14px; color: var(--admin-muted); font-weight: 800; }
          .dash-card .value{ margin-top: 12px; font-size: 30px; font-weight: 900; letter-spacing: -0.04em; }
          .dash-card .sub{ margin-top: 6px; font-size: 12px; color: var(--admin-muted); }
          .dash-big{
            background: var(--admin-surface);
            border: 1px solid var(--admin-border);
            border-radius: 22px;
            padding: 18px;
            box-shadow: 0 14px 34px rgba(17,24,39,0.06);
          }
          .dash-row{ display:flex; align-items:center; justify-content:space-between; gap: 10px; }
          .pill{
            display:inline-flex; align-items:center; justify-content:center;
            padding: 8px 12px; border-radius: 999px;
            border: 1px solid var(--admin-border);
            background: rgba(255,255,255,0.7);
            font-size: 12px; font-weight: 800;
          }
          .dash-actions{ display:flex; gap:10px; flex-wrap:wrap; }
          .dash-top-actions{ display:flex; justify-content:flex-end; margin-bottom: 12px; }
          .dash-list{ margin-top: 12px; display:flex; flex-direction:column; gap: 10px; }
          .dash-item{
            background:#fff;
            border: 1px solid var(--admin-border);
            border-radius: 18px;
            padding: 12px 14px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap: 12px;
          }
          .dash-item .title{ font-weight: 900; }
          .dash-item .muted{ color: var(--admin-muted); font-size: 12px; }
          .dash-table{ width:100%; border-collapse: collapse; margin-top: 12px; }
          .dash-table th, .dash-table td{ padding: 12px 10px; border-bottom: 1px solid rgba(17,24,39,0.06); text-align:left; }
          .dash-table th{ font-size: 12px; color: var(--admin-muted); text-transform: uppercase; letter-spacing: .06em; }
          .dash-cta{
            background: linear-gradient(135deg, rgba(17,24,39,0.92) 0%, rgba(17,24,39,0.82) 100%);
            color: #fff;
            border: 1px solid rgba(17,24,39,0.10);
          }
          .dash-cta .sub{ color: rgba(255,255,255,0.75); }
          .dash-cta .value{ color: #fff; }
          .legacy-admin{ display:none !important; }
          @media (max-width: 1120px){ .dash-wrap{ grid-template-columns: 1fr; } .dash-cards{ grid-template-columns: 1fr; } }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Дашборд', activePath: '/admin', buildMarker })}

        <div class="dash-wrap">
          <div>
            <div class="dash-top-actions">
              <div class="dash-actions">
                <a class="btn" href="/admin/products?openAdd=1" style="background:var(--admin-text); color:#fff; border-color:var(--admin-text);">Добавить товар</a>
                <a class="btn" href="/admin/products">Открыть товары</a>
              </div>
            </div>
            <div class="dash-cards">
              <a class="dash-card dash-card-link" href="/admin/users-detailed" aria-label="Перейти к пользователям">
                <div class="dash-row">
                  <h3>Пользователи</h3>
                  <span class="pill">Всего</span>
                </div>
                <div class="value">${stats.users}</div>
                <div class="sub">Аккаунты в системе</div>
              </a>
              <a class="dash-card dash-card-link" href="/admin/products" aria-label="Перейти к товарам">
                <div class="dash-row">
                  <h3>Товары</h3>
                  <span class="pill">Каталог</span>
                </div>
                <div class="value">${stats.products}</div>
                <div class="sub">Позиции</div>
              </a>
              <a class="dash-card dash-card-link" href="/admin/orders" aria-label="Перейти к заказам">
                <div class="dash-row">
                  <h3>Заказы</h3>
                  <span class="pill">Заявки</span>
                </div>
                <div class="value">${stats.orders}</div>
                <div class="sub">Новые/в работе/выполнено</div>
              </a>
            </div>

            <div style="height: 16px;"></div>

            <div class="dash-big">
              <div class="dash-row">
                <div>
                  <h3 style="margin:0; font-size:16px; font-weight:900;">Последние заказы</h3>
                  <div class="muted" style="color:var(--admin-muted); font-size:12px; margin-top:6px;">Быстрый обзор активности</div>
                </div>
                <div class="dash-actions">
                  <a class="btn" href="/admin/orders">Открыть заказы</a>
                  <button type="button" class="btn" onclick="try{ if(typeof openAddProductModal==='function') openAddProductModal(); }catch(e){}">Добавить товар</button>
                </div>
              </div>
              <div class="dash-list">
                ${await getRecentOrders()}
              </div>
            </div>

            <div style="height: 16px;"></div>

            <div class="dash-big">
              <div class="dash-row">
                <div>
                  <h3 style="margin:0; font-size:16px; font-weight:900;">Транзакции</h3>
                  <div class="muted" style="color:var(--admin-muted); font-size:12px; margin-top:6px;">Последние начисления/списания</div>
                </div>
                <a class="btn" href="/admin/partners">Партнёры</a>
              </div>
              <div class="dash-list">
                ${await getRecentTransactions()}
              </div>
            </div>
          </div>

          <div>
            <div class="dash-card dash-cta solid">
              <h3 style="color:rgba(255,255,255,0.82);">Баланс пользователей</h3>
              <div class="value">${stats.totalBalance.toFixed(2)} PZ</div>
              <div class="sub">Сумма по всем пользователям</div>
              <div style="height: 10px;"></div>
              <div class="dash-actions">
                <a class="btn" href="/admin/users-detailed" style="background:#fff; color:#111827;">Открыть пользователей</a>
              </div>
            </div>

            <div style="height: 16px;"></div>

            <div class="dash-big">
              <div class="dash-row">
                <div>
                  <h3 style="margin:0; font-size:16px; font-weight:900;">Быстрые разделы</h3>
                  <div class="muted" style="color:var(--admin-muted); font-size:12px; margin-top:6px;">Навигация по админке</div>
                </div>
              </div>
              <table class="dash-table">
                <tbody>
                  <tr><td><a href="/admin/products" class="link">Товары</a></td><td class="muted">Каталог</td></tr>
                  <tr><td><a href="/admin/categories" class="link">Категории</a></td><td class="muted">Структура</td></tr>
                  <tr><td><a href="/admin/chats" class="link">Чаты</a></td><td class="muted">Поддержка</td></tr>
                  <tr><td><a href="/admin/invoice-import" class="link">Импорт инвойса</a></td><td class="muted">Загрузка</td></tr>
                  <tr><td><a href="/admin/sync-siam-json" class="link">Siam из JSON</a></td><td class="muted">Синхронизация</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="container legacy-admin">
          <div class="header">
            <h1>🚀 Панель управления Plazma v2.0</h1>
            <p>Единое управление ботом, пользователями и партнёрами</p>
          </div>
          
          ${req.query.success === 'all_bonuses_recalculated' ? `<div class="alert alert-success">✅ Все бонусы пересчитаны! Общий баланс: ${req.query.total || 0} PZ</div>` : ''}
          ${req.query.error === 'bonus_recalculation' ? '<div class="alert alert-error">❌ Ошибка при пересчёте бонусов</div>' : ''}
          
          <div class="tabs">
            <button type="button" class="tab active" data-tab="overview" onclick="if(typeof window.switchTab==='function'){window.switchTab('overview', this);}return false;">📊 Обзор</button>
            <button type="button" class="tab" onclick="window.location.href='/admin/users-detailed'">👥 Пользователи</button>
            <button type="button" class="tab" data-tab="partners" onclick="if(typeof window.switchTab==='function'){window.switchTab('partners', this);}return false;">🤝 Партнёры</button>
            <button type="button" class="tab" data-tab="content" onclick="if(typeof window.switchTab==='function'){window.switchTab('content', this);}return false;">📦 Контент</button>
            <button type="button" class="tab" data-tab="invoice-import" onclick="if(typeof window.switchTab==='function'){window.switchTab('invoice-import', this);}return false;">📥 Импорт инвойса</button>
            <button type="button" class="tab" data-tab="tools" onclick="if(typeof window.switchTab==='function'){window.switchTab('tools', this);}return false;">🔧 Инструменты</button>
          </div>
          
          <!-- Overview Tab -->
          <div id="overview" class="tab-content active">
            <div class="section-header">
              <h2 class="section-title">📊 Общая статистика</h2>
            </div>
            
            <div class="stats">
              <button type="button" class="stat-card" onclick="if(typeof window.switchTab==='function'){window.switchTab('users');}return false;">
                <div class="stat-number">${stats.users}</div>
                <div class="stat-label">Пользователи</div>
              </button>
              <button type="button" class="stat-card" onclick="if(typeof window.switchTab==='function'){window.switchTab('partners');}return false;">
                <div class="stat-number">${stats.partners}</div>
                <div class="stat-label">Партнёры</div>
              </button>
              <button type="button" class="stat-card" onclick="if(typeof window.switchTab==='function'){window.switchTab('content');}return false;">
                <div class="stat-number">${stats.products}</div>
                <div class="stat-label">Товары</div>
              </button>
              <button type="button" class="stat-card" onclick="if(typeof window.switchTab==='function'){window.switchTab('content');}return false;">
                <div class="stat-number">${stats.categories}</div>
                <div class="stat-label">Категории</div>
              </button>
              <button type="button" class="stat-card" onclick="if(typeof window.switchTab==='function'){window.switchTab('content');}return false;">
                <div class="stat-number">${stats.reviews}</div>
                <div class="stat-label">Отзывы</div>
              </button>
              <button type="button" class="stat-card" onclick="if(typeof window.switchTab==='function'){window.switchTab('content');}return false;">
                <div class="stat-number">${stats.orders}</div>
                <div class="stat-label">Заказы</div>
              </button>
            </div>
            
            <!-- Detailed Users Section -->
            <div class="section-header">
              <h2 class="section-title">👥 Детальная информация о пользователях</h2>
            </div>
            
            ${await getDetailedUsersSection()}

            <!-- Recent Data Lists -->
            <div class="recent-lists">
              <div class="list-section">
                <h3>👥 Последние пользователи</h3>
                <div class="list-container">
                  ${await getRecentUsers()}
                </div>
              </div>
              
              <div class="list-section">
                <h3>📦 Последние заказы</h3>
                <div class="list-container">
                  ${await getRecentOrders()}
                </div>
              </div>
              
              <div class="list-section">
                <h3>💰 Последние транзакции</h3>
                <div class="list-container">
                  <div class="total-balance-header" style="background: #e8f5e8; padding: 10px; margin-bottom: 10px; border-radius: 6px; text-align: center; border: 2px solid #28a745;">
                    <div style="font-size: 18px; font-weight: bold; color: #28a745;">
                      💰 Общий баланс: ${totalBalance.toFixed(2)} PZ
                    </div>
                    <div style="font-size: 12px; color: #666; margin-top: 2px;">
                      Сумма всех балансов пользователей
                    </div>
                  </div>
                  ${await getRecentTransactions()}
                </div>
              </div>
            </div>
          </div>
          
          <!-- Users Tab -->
          <div id="users" class="tab-content">
            <div class="section-header">
              <h2 class="section-title">👥 Управление пользователями v2.0</h2>
              <div class="action-buttons">
                <a href="/admin/users-detailed" class="btn">👥 Детальная информация</a>
                <a href="/admin/users" class="btn">📋 Список пользователей</a>
                <a href="/admin/user-history" class="btn">📊 История действий</a>
              </div>
            </div>
            <p>Управление пользователями бота, просмотр истории действий и статистики.</p>
          </div>
          
          <!-- Partners Tab -->
          <div id="partners" class="tab-content">
            <div class="section-header">
              <h2 class="section-title">🤝 Управление партнёрами v2.0</h2>
              <div class="action-buttons">
                <a href="/admin/partners" class="btn">📋 Список партнёров</a>
                <a href="/admin/partners-hierarchy" class="btn">🌳 Иерархия</a>
                <a href="/admin/debug-partners" class="btn">🔍 Отладка</a>
              </div>
            </div>
            <p>Управление партнёрской программой, бонусами и рефералами.</p>
          </div>
          
          <!-- Content Tab -->
          <div id="content" class="tab-content">
            <div class="section-header">
              <h2 class="section-title">📦 Управление контентом</h2>
              <div class="action-buttons">
                <a href="/admin/categories" class="btn">📁 Категории</a>
                <a href="/admin/products" class="btn">🛍️ Товары</a>
                <a href="/admin/chats" class="btn">💬 Чаты</a>
                <a href="/admin/reviews" class="btn">⭐ Отзывы</a>
                <a href="/admin/orders" class="btn">📦 Заказы</a>
                <button class="btn" onclick="openAddProductModal()" style="background: #28a745;">➕ Добавить товар</button>
                <a href="/admin/product2" class="btn" style="background: #9c27b0;">🛍️ Товар 2</a>
                <button class="btn import-siam-btn" style="background: #17a2b8; cursor: pointer; pointer-events: auto !important;">🤖 Импорт Siam Botanicals</button>
                <a href="/admin/sync-siam-pdf" class="btn" style="background:#111827;">📄 Siam из PDF</a>
                <a href="/admin/sync-siam-json" class="btn" style="background:#374151;">🧾 Siam из JSON</a>
              </div>
            </div>
            <p>Управление каталогом товаров, отзывами и заказами.</p>
          </div>
          
          <!-- Tools Tab -->
          <div id="tools" class="tab-content">
            <div class="section-header">
              <h2 class="section-title">🔧 Инструменты и утилиты</h2>
            <div class="action-buttons">
              <a href="/admin/test-referral-links" class="btn">🧪 Тест ссылок</a>
              <a href="/admin/force-recalculate-all-bonuses" class="btn" style="background: #28a745;">🔄 Пересчитать все бонусы</a>
            </div>
            </div>
            <p>Дополнительные инструменты для отладки и тестирования.</p>
          </div>
          
          <!-- Invoice Import Tab -->
          <div id="invoice-import" class="tab-content">
            <div class="section-header">
              <h2 class="section-title">📥 Импорт инвойса</h2>
            </div>
            <p>Импортируйте товары из инвойса и управляйте настройками расчета цен.</p>
            
            <div class="action-buttons" style="margin-top: 20px;">
              <a href="/admin/invoice-import" class="btn" style="background: #28a745;">📥 Импорт инвойса</a>
              <a href="/admin/invoice-settings" class="btn" style="background: #667eea;">⚙️ Настройки импорта</a>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
              <h3 style="margin-bottom: 15px;">Как использовать:</h3>
              <ol style="line-height: 1.8;">
                <li>Настройте курс обмена и мультипликатор в разделе "Настройки импорта"</li>
                <li>Подготовьте данные инвойса в формате: SKU|Описание|Количество|Цена в БАТ|Сумма</li>
                <li>Вставьте данные в форму импорта и нажмите "Импортировать"</li>
                <li>Система автоматически:
                  <ul style="margin-top: 10px;">
                    <li>Рассчитает продажные цены по формуле: Цена в БАТ × Курс × Мультипликатор</li>
                    <li>Обновит количество товаров</li>
                    <li>Отправит уведомления при низком остатке (≤3 шт)</li>
                    <li>Деактивирует товары с нулевым остатком</li>
                  </ul>
                </li>
              </ol>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="/admin/logout" class="btn" style="background: #dc3545;">Выйти</a>
          </div>
        </div>
        
        <!-- Message Composer Modal -->
        <div id="messageModal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <h2>📨 Отправить сообщение пользователям</h2>
              <span class="close" onclick="closeMessageComposer()">&times;</span>
            </div>
            
            <div class="form-group">
              <label>Выбранные получатели:</label>
              <div id="selectedUsers" style="background: #f8f9fa; padding: 10px; border-radius: 4px; max-height: 100px; overflow-y: auto;"></div>
            </div>
            
            <div class="form-group">
              <label>Тип сообщения:</label>
              <select id="messageType">
                <option value="text">Текстовое сообщение</option>
                <option value="notification">Уведомление</option>
                <option value="promotion">Акция/Предложение</option>
                <option value="system">Системное сообщение</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Тема сообщения:</label>
              <input type="text" id="messageSubject" placeholder="Введите тему сообщения">
            </div>
            
            <div class="form-group">
              <label>Текст сообщения:</label>
              <textarea id="messageText" placeholder="Введите текст сообщения" required></textarea>
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" id="includeButtons"> Включить кнопки действий
              </label>
            </div>
            
            <div id="buttonsSection" style="display: none;">
              <div class="form-group">
                <label>Кнопка 1:</label>
                <input type="text" id="button1Text" placeholder="Текст кнопки">
                <input type="text" id="button1Url" placeholder="URL или команда">
              </div>
              <div class="form-group">
                <label>Кнопка 2:</label>
                <input type="text" id="button2Text" placeholder="Текст кнопки">
                <input type="text" id="button2Url" placeholder="URL или команда">
              </div>
            </div>
            
            <div class="modal-footer">
              <button class="btn" onclick="closeMessageComposer()" style="background: #6c757d;">Отмена</button>
              <button class="btn" onclick="sendMessages()" style="background: #28a745;">📤 Отправить</button>
            </div>
          </div>
        </div>
        <!-- Add Product Modal -->
        <div id="addProductModal" class="modal">
          <div class="modal-content product-modal">
            <div class="modal-header">
              <h2>Добавить новый товар</h2>
              <span class="close" onclick="closeAddProductModal()">&times;</span>
            </div>
            
            <form id="addProductForm" class="product-form">
              <input type="hidden" id="productId" name="productId" value="">
              <div class="product-section">
                <div class="product-section-header">
                  <span class="product-section-title">Основные параметры</span>
                  <span class="product-section-subtitle">Название, стоимость и наличие товара</span>
                </div>
                <div class="product-grid" style="grid-template-columns: 2fr 1fr 1fr; gap: 15px;">
                  <div class="form-group">
                    <label>Название товара *</label>
                    <div style="display: flex; gap: 8px;">
                      <input type="text" id="productName" required placeholder="Введите название товара" style="flex: 1;">
                      <button type="button" class="btn-translate" onclick="translateProductField('productName', 'title')" title="Перевести с английского через AI">AI</button>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Цена (₽) *</label>
                    <input type="number" id="productPriceRub" step="1" min="0" required placeholder="0">
                    <div class="char-count">1 PZ = 100 ₽</div>
                  </div>
                  <div class="form-group">
                    <label>Цена (PZ) *</label>
                    <input type="number" id="productPrice" step="0.01" min="0" required placeholder="0.00">
                    <div class="char-count">1 PZ = 100 ₽</div>
                  </div>
                  <div class="form-group">
                    <label>Категория *</label>
                    <div class="category-picker">
                      <select id="productCategory" required style="appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e'); background-repeat: no-repeat; background-position: right 1rem center; background-size: 1em; padding-right: 2.5rem;">
                        <option value="">Выберите категорию</option>
                      </select>
                      <button type="button" class="btn" onclick="openAddCategoryModal()" style="background: #17a2b8;">+</button>
                    </div>
                  </div>
                  <div class="form-group">
                    <label>Количество на складе</label>
                    <input type="number" id="productStock" min="0" placeholder="0">
                  </div>
                  <div class="form-group">
                    <label>Активен</label>
                    <div style="height: 42px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--admin-border-strong); border-radius: 10px; background: #fff;">
                      <input type="checkbox" id="productActive" style="width: 20px; height: 20px; margin: 0;">
                    </div>
                  </div>
                </div>
              </div>

              <div class="product-section">
                <div class="product-section-header">
                  <span class="product-section-title">Доставка</span>
                  <span class="product-section-subtitle">Выберите регионы, где товар доступен</span>
                </div>
                <div class="regions-grid">
                  <label class="switch-row"><input type="checkbox" id="regionRussia" checked> Россия</label>
                  <label class="switch-row"><input type="checkbox" id="regionBali"> Бали</label>
                </div>
              </div>

              <div class="product-section">
                <div class="product-section-header">
                  <span class="product-section-title">Описание и медиа</span>
                  <span class="product-section-subtitle">Добавьте текст и изображение для карточки товара</span>
                </div>
                <div class="product-grid media-layout">
                  <div class="form-group">
                    <label>Краткое описание *</label>
                    <div style="position: relative;">
                      <textarea id="productShortDescription" required placeholder="Краткое описание товара (до 200 символов)" maxlength="200" style="padding-right: 50px;"></textarea>
                      <button type="button" class="btn-translate" onclick="translateProductField('productShortDescription', 'summary')" title="Перевести с английского через AI" style="position: absolute; top: 8px; right: 8px;">AI</button>
                    </div>
                    <div class="char-count" id="shortDescCount">0/200</div>
                  </div>
                  <div class="form-group media-group">
                    <label>Фото товара</label>
                    <div class="product-media">
                      <div id="imagePreview" class="image-preview"></div>
                      <div class="image-controls">
                        <input type="file" id="productImage" accept="image/*">
                        <div class="file-info">Квадратное фото 1:1, ~800x800px, JPG/PNG</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="form-group">
                  <label>Полное описание (Поддерживает форматирование) *</label>
                  <div style="position: relative;">
                    <!-- The actual textarea is hidden; Quill handles the UI -->
                    <textarea id="productFullDescription" required style="display:none;"></textarea>
                    <div id="productFullDescriptionEditor" style="height: 250px; background: #fff;"></div>
                    <button type="button" class="btn-translate" onclick="translateProductField('productFullDescription', 'description')" title="Перевести с английского через AI" style="position: absolute; top: -30px; right: 0;">AI Перевод</button>
                  </div>
                </div>
                <div class="form-group">
                  <label>Инструкция по применению</label>
                  <div id="productInstructionEditor" style="height: 150px; background: #fff;"></div>
                  <!-- Hidden textarea to store the HTML for form submission -->
                  <textarea id="productInstruction" name="instruction" style="display:none;"></textarea>
                  <div class="char-count">Инструкция будет отображаться в мини-приложении с форматированием</div>
                </div>
              </div>

              <!-- Publication section removed (merged into main) -->

              <div class="modal-footer">
                <button type="button" class="btn" onclick="closeAddProductModal()">Отмена</button>
                <button type="submit" class="btn" id="productModalSubmit">Создать товар</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Add Category Modal -->
        <div id="addCategoryModal" class="modal">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <h2>📂 Добавить новую категорию</h2>
              <span class="close" onclick="closeAddCategoryModal()">&times;</span>
            </div>
            
            <form id="addCategoryForm">
              <div class="form-group">
                <label>Название категории *</label>
                <input type="text" id="categoryName" required placeholder="Введите название категории">
              </div>
              
              <div class="form-group">
                <label>Описание категории</label>
                <textarea id="categoryDescription" placeholder="Описание категории" style="height: 80px;"></textarea>
              </div>
              
              <div class="form-group">
                <label>Иконка категории</label>
                <input type="text" id="categoryIcon" placeholder="Эмодзи или текст (например: 🍎)">
              </div>
              
              <div class="modal-footer">
                <button type="button" class="btn" onclick="closeAddCategoryModal()" style="background: #6c757d;">Отмена</button>
                <button type="submit" class="btn" style="background: #17a2b8;">📂 Создать категорию</button>
              </div>
            </form>
          </div>
        </div>
        <script>
          // Импорт продуктов - определяем сразу для раннего перехвата
          (function() {
            'use strict';
            
            // Обработчик импорта - определяем глобально сразу
            async function handleImportSiamProducts(event) {
              // Проверяем, что клик именно по кнопке импорта
              const target = event.target.closest('.import-siam-btn');
              if (!target) return;
              
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              
              if (!confirm('Запустить импорт продуктов из Siam Botanicals? Это может занять несколько минут.')) {
                return false;
              }
              
              const btn = target;
              const originalText = btn.textContent;
              btn.disabled = true;
              btn.textContent = '⏳ Импорт запущен...';
              btn.style.opacity = '0.6';
              
              try {
                console.log('📤 Отправляю запрос на импорт...');
                const response = await fetch('/admin/api/import-siam-products', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include'
                });
                
                console.log('📥 Ответ получен, status:', response.status);
                
                if (!response.ok) {
                  const errorText = await response.text();
                  console.error('❌ Ошибка ответа:', errorText);
                  throw new Error('HTTP ' + response.status + ': ' + errorText);
                }
                
                const result = await response.json();
                console.log('📋 Результат:', result);
                
                if (result.success) {
                  alert('✅ Импорт запущен! Продукты будут добавлены в течение нескольких минут. Проверьте логи сервера или обновите страницу через 3-5 минут.');
                } else {
                  throw new Error(result.error || 'Ошибка запуска импорта');
                }
              } catch (error) {
                console.error('❌ Import error:', error);
                console.error('❌ Error details:', {
                  message: error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined
                });
                alert('❌ Ошибка: ' + (error instanceof Error ? error.message : 'Не удалось запустить импорт. Проверьте консоль браузера (F12) для подробностей.'));
              } finally {
                btn.disabled = false;
                btn.textContent = originalText;
                btn.style.opacity = '1';
              }
              
              return false;
            }
            
            // Прикрепляем обработчик СРАЗУ с самым ранним capture phase
            // Это должно сработать до любых блокировщиков
            if (document.readyState === 'loading') {
              document.addEventListener('click', handleImportSiamProducts, true);
            } else {
              document.addEventListener('click', handleImportSiamProducts, true);
            }
            
            // Также прикрепляем после загрузки DOM для надежности
            document.addEventListener('DOMContentLoaded', function() {
              document.addEventListener('click', handleImportSiamProducts, true);
              
              // Прямой обработчик на кнопку
              function attachDirectHandler() {
                const importBtn = document.querySelector('.import-siam-btn');
                if (importBtn && !importBtn.hasAttribute('data-handler-attached')) {
                  importBtn.addEventListener('click', handleImportSiamProducts, true);
                  importBtn.setAttribute('data-handler-attached', 'true');
                  console.log('✅ Direct import button handler attached');
                } else if (!importBtn) {
                  setTimeout(attachDirectHandler, 200);
                }
              }
              
              attachDirectHandler();
              setTimeout(attachDirectHandler, 500);
              setTimeout(attachDirectHandler, 1000);
            });
            
            // Экстренная попытка - через небольшую задержку
            setTimeout(function() {
              document.addEventListener('click', handleImportSiamProducts, true);
              console.log('✅ Import handler attached (delayed)');
            }, 50);
          })();
          
          window.switchTab = function(tabName, tabEl) {
            // Guard: allow only known tabs (prevents invalid selector + broken UI)
            // Но список берём динамически из DOM, чтобы не ломать вкладки при добавлениях.
            const getAllowedTabs = function() {
              const out = [];
              try {
                const tabBtns = document.querySelectorAll('.tab[data-tab]');
                for (let i = 0; i < tabBtns.length; i++) {
                  const t = tabBtns[i];
                  if (t && t.dataset && t.dataset.tab) out.push(String(t.dataset.tab));
                }
                const tabContents = document.querySelectorAll('.tab-content[id]');
                for (let j = 0; j < tabContents.length; j++) {
                  const c = tabContents[j];
                  if (c && c.id) out.push(String(c.id));
                }
              } catch (_) {}
              // уникальные
              const uniq = [];
              const seen = {};
              for (let k = 0; k < out.length; k++) {
                const v = out[k];
                if (!v) continue;
                if (seen[v]) continue;
                seen[v] = true;
                uniq.push(v);
              }
              return uniq;
            };
            const allowedTabs = getAllowedTabs();
            const normalizeTab = function(v) {
              try { return String(v || '').trim(); } catch (_) { return ''; }
            };
            const safeTab = normalizeTab(tabName);
            const finalTab = (allowedTabs && allowedTabs.indexOf(safeTab) !== -1)
              ? safeTab
              : ((allowedTabs && allowedTabs.length > 0 ? allowedTabs[0] : null) || 'overview');

            // Hide all tab contents
            const contents = document.querySelectorAll('.tab-content');
            contents.forEach(content => content.classList.remove('active'));
            
            // Remove active class from all tabs
            const tabs = document.querySelectorAll('.tab');
            tabs.forEach(tab => tab.classList.remove('active'));
            
            // Show selected tab content
            const target = document.getElementById(finalTab);
            if (target) target.classList.add('active');
            
            // Add active class to clicked tab (or infer by data-tab)
            const candidate = (typeof event !== 'undefined' && event && event.target ? event.target : null);
            let inferred = null;
            try {
              if (!inferred && tabEl) inferred = tabEl;
              if (!inferred && candidate && candidate.classList && candidate.classList.contains('tab')) inferred = candidate;
              if (!inferred) {
                const list = document.querySelectorAll('.tab');
                for (let i = 0; i < list.length; i++) {
                  const t = list[i];
                  if (t && t.dataset && t.dataset.tab === finalTab) { inferred = t; break; }
                }
              }
            } catch (_) {}
            const el = inferred;
            if (el && el.classList) el.classList.add('active');

            // Persist in URL for sharable links (e.g. /admin?tab=content)
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('tab', finalTab);
              history.replaceState({}, '', url.toString());
            } catch {}
          };

          // Restore tab from URL on initial load
          ;(function(){
            try {
              const url = new URL(window.location.href);
              const tabRaw = url.searchParams.get('tab');
              if (!tabRaw) return;

              const tab = String(tabRaw || '').trim();
              const allowedTabs = (function(){
                const out = [];
                try {
                  const tabBtns = document.querySelectorAll('.tab[data-tab]');
                  for (let i = 0; i < tabBtns.length; i++) {
                    const t = tabBtns[i];
                    if (t && t.dataset && t.dataset.tab) out.push(String(t.dataset.tab));
                  }
                  const tabContents = document.querySelectorAll('.tab-content[id]');
                  for (let j = 0; j < tabContents.length; j++) {
                    const c = tabContents[j];
                    if (c && c.id) out.push(String(c.id));
                  }
                } catch (_) {}
                const uniq = [];
                const seen = {};
                for (let k = 0; k < out.length; k++) {
                  const v = out[k];
                  if (!v) continue;
                  if (seen[v]) continue;
                  seen[v] = true;
                  uniq.push(v);
                }
                return uniq;
              })();

              if (!allowedTabs || allowedTabs.indexOf(tab) === -1) {
                // Drop invalid tab param to avoid breaking the page
                url.searchParams.delete('tab');
                history.replaceState({}, '', url.toString());
                return;
              }

              let tabBtn = null;
              const list = document.querySelectorAll('.tab');
              for (let i = 0; i < list.length; i++) {
                const t = list[i];
                if (t && t.dataset && t.dataset.tab === tab) { tabBtn = t; break; }
              }

              if (typeof window.switchTab === 'function') window.switchTab(tab, tabBtn);
            } catch {}
          })();
          
          window.showHierarchy = function(userId) {
            window.open(\`/admin/partners-hierarchy?user=\${userId}\`, '_blank', 'width=800,height=600');
          }
          
          window.showUserDetails = function(userId) {
            window.open(\`/admin/users/\${userId}\`, '_blank', 'width=600,height=400');
          }
          
          window.openChangeInviter = async function(userId, userName) {
            const modal = document.createElement('div');
            modal.id = 'inviterModal';
            modal.innerHTML =
              '<div class="modal-overlay" id="inviterOverlay" style="display: flex;">' +
                '<div class="modal-content" id="inviterContent" style="max-width:560px; border-radius:12px; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,.2)">' +
                  '<div class="modal-header" style="background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; padding:16px 20px; display:flex; align-items:center; justify-content:space-between">' +
                    '<h2 style="margin:0; font-size:18px; font-weight:600">🔄 Смена пригласителя</h2>' +
                    '<button class="close-btn" id="inviterClose" style="background:transparent; border:none; color:#fff; font-size:22px; cursor:pointer">&times;</button>' +
                  '</div>' +
                  '<div class="modal-body" style="padding:16px 20px; background:#fff">' +
                    '<div style="margin-bottom:8px; color:#6b7280">Пользователь:</div>' +
                    '<div style="font-weight:600; margin-bottom:12px">' + userName + '</div>' +
                    '<div class="form-group" style="margin-bottom:10px">' +
                      '<label style="display:block; font-weight:600; margin-bottom:6px">Поиск по @username или коду</label>' +
                      '<input type="text" id="inviterSearch" placeholder="@username или код" autocomplete="off" style="width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px" />' +
                    '</div>' +
                    '<div id="inviterResults" style="max-height:220px; overflow:auto; border:1px solid #e5e7eb; border-radius:8px; padding:6px; display:none"></div>' +
                    '<div class="form-group" style="margin-top:10px">' +
                      '<label style="display:block; font-weight:600; margin-bottom:6px">Или введите код вручную</label>' +
                      '<input type="text" id="inviterCodeManual" placeholder="Код пригласителя" style="width:260px; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px" />' +
                    '</div>' +
                  '</div>' +
                  '<div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end; padding:12px 20px; background:#f9fafb">' +
                    '<button class="btn" id="inviterCancel" style="background:#6c757d; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer">Отмена</button>' +
                    '<button class="btn" id="inviterApplyBtn" style="background:#10b981; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer">Применить</button>' +
                  '</div>' +
                '</div>' +
              '</div>';
            (document.querySelector('.admin-shell') || document.body).appendChild(modal);

            const searchInput = document.getElementById('inviterSearch');
            const resultsEl = document.getElementById('inviterResults');
            const codeInput = document.getElementById('inviterCodeManual');
            const applyBtn = document.getElementById('inviterApplyBtn');
            const closeBtn = document.getElementById('inviterClose');
            const cancelBtn = document.getElementById('inviterCancel');
            const overlay = document.getElementById('inviterOverlay');

            function closeModal(){
              const el = document.getElementById('inviterModal');
              if (el && el.parentNode) el.parentNode.removeChild(el);
            }
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
            if (overlay) overlay.addEventListener('click', function(e){ if (e.target === overlay) closeModal(); });

            let selected = null; // {username, referralCode}
            let typingTimer;
            function renderResults(items){
              if (!items || items.length === 0){
                resultsEl.style.display = 'none';
                resultsEl.innerHTML = '';
                return;
              }
              resultsEl.style.display = 'block';
              resultsEl.innerHTML = items.map(function(i){
                const uname = i.username ? '@' + i.username : '';
                const name = ((i.firstName || '') + ' ' + (i.lastName || '')).trim();
                return '<div class="list-item" style="cursor:pointer; padding:6px; border-bottom:1px solid #eee" data-username="' + (i.username || '') + '" data-code="' + i.referralCode + '">' +
                  '<div class="list-info"><div class="list-name">' + (uname || name || 'Без имени') + '</div>' +
                  '<div class="list-time">код: ' + i.referralCode + '</div></div></div>';
              }).join('');
              Array.prototype.slice.call(resultsEl.querySelectorAll('[data-username]')).forEach(function(el){
                el.addEventListener('click', function(){
                  selected = { username: el.getAttribute('data-username'), code: el.getAttribute('data-code') };
                  searchInput.value = selected.username ? '@' + selected.username : selected.code;
                  codeInput.value = '';
                  resultsEl.style.display = 'none';
                });
              });
            }
            searchInput.addEventListener('input', function(){
              clearTimeout(typingTimer);
              const q = searchInput.value.trim();
              if (!q){ renderResults([]); return; }
              typingTimer = setTimeout(async function(){
                try{
                  const resp = await fetch('/admin/inviters/search?q=' + encodeURIComponent(q), { credentials: 'include' });
                  const data = await resp.json();
                  renderResults(data);
                }catch(e){ renderResults([]); }
              }, 300);
            });
            applyBtn.addEventListener('click', async function(){
              var typed = (codeInput.value || searchInput.value).trim();
              var payload = {};
              if (selected && selected.username) {
                payload = { inviterUsername: selected.username };
              } else if (typed) {
                if (typed.startsWith('@')) payload = { inviterUsername: typed.replace(/^@/, '') };
                else payload = { newInviterCode: typed };
              }
              if (!('inviterUsername' in payload) && !('newInviterCode' in payload)) { alert('Укажите пригласителя'); return; }
              try{
                const resp = await fetch('/admin/users/' + userId + '/change-inviter', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, credentials: 'include', body: JSON.stringify(payload)
                });
                if (resp.ok){ alert('Пригласитель изменен'); location.reload(); return; }
                let data = null; try { data = await resp.json(); } catch(e) {}
                alert('Не удалось изменить пригласителя' + (data && data.error ? (' — ' + data.error) : ''));
              }catch(e){ alert('Ошибка сети'); }
            });
          }
          
          // Balance management modal
          function openBalanceModal(userId, userName, currentBalance) {
            const modal = document.createElement('div');
            modal.id = 'balanceModal';
            modal.innerHTML = \`
              <div class="modal-overlay" onclick="closeBalanceModal()" style="display: flex;">
                <div class="modal-content" onclick="event.stopPropagation()">
                  <div class="modal-header">
                    <h2>💰 Управление балансом</h2>
                    <button class="close-btn" onclick="closeBalanceModal()">&times;</button>
                  </div>
                  <div class="modal-body">
                    <p><strong>Пользователь:</strong> \${userName}</p>
                    <p><strong>Текущий баланс:</strong> \${currentBalance.toFixed(2)} PZ</p>
                    <form id="balanceForm">
                      <input type="hidden" name="userId" value="\${userId}">
                      <div class="form-group">
                        <label>Тип операции:</label>
                        <select name="operation" required>
                          <option value="">Выберите операцию</option>
                          <option value="add">Начислить</option>
                          <option value="subtract">Списать</option>
                        </select>
                      </div>
                      <div class="form-group">
                        <label>Сумма (PZ):</label>
                        <input type="number" name="amount" step="0.01" min="0.01" required placeholder="0.00">
                      </div>
                      <div class="form-group">
                        <label>Комментарий: <span style="color: red;">*</span></label>
                        <textarea name="comment" rows="3" placeholder="Причина изменения баланса" required></textarea>
                      </div>
                      <div class="form-actions">
                        <button type="button" onclick="closeBalanceModal()">Отмена</button>
                        <button type="submit">Применить</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            \`;
            (document.querySelector('.admin-shell') || document.body).appendChild(modal);
            
            // Handle form submission
            document.getElementById('balanceForm').onsubmit = async function(e) {
              e.preventDefault();
              const formData = new FormData(this);
              const userId = formData.get('userId');
              const operation = formData.get('operation');
              const amount = parseFloat(formData.get('amount'));
              const comment = formData.get('comment');
              
              // Validate comment field
              if (!comment || comment.trim().length === 0) {
                alert('Пожалуйста, укажите причину изменения баланса в комментарии');
                return;
              }
              
              try {
                const response = await fetch('/admin/users/' + userId + '/update-balance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ operation, amount, comment })
                });
                
                const result = await response.json();
                if (result.success) {
                  alert('Баланс успешно обновлен!');
                  closeBalanceModal();
                  // Force reload without cache
                  window.location.href = window.location.href + '?t=' + Date.now();
                } else {
                  alert('Ошибка: ' + result.error);
                }
              } catch (error) {
                alert('Ошибка: ' + (error instanceof Error ? error.message : String(error)));
              }
            };
          }
          
          function closeBalanceModal() {
            const modal = document.getElementById('balanceModal');
            if (modal) {
              modal.remove();
            }
          }
          
          
          // Global function for loading categories
          window.loadCategories = async function() {
            try {
              const response = await fetch('/admin/api/categories');
              const categories = await response.json();
              
              const select = document.getElementById('productCategory');
              if (select) {
                select.innerHTML = '<option value="">Выберите категорию</option>';
                
                categories.forEach(category => {
                  const option = document.createElement('option');
                  option.value = category.id;
                  option.textContent = category.name;
                  select.appendChild(option);
                });
              }
            } catch (error) {
              console.error('Error loading categories:', error);
            }
          };
          
          // УДАЛЕНО: Старая функция editProduct, которая конфликтовала с новой версией на странице /admin/products
          // Новая версия находится в роутере /admin/products и использует модальное окно editProductModal
          
          // Global function for editing products (legacy)
          window.editProductUsingCreateModal = function(button) {
            const productId = button.dataset.id;
            const title = button.dataset.title;
            const summary = button.dataset.summary;
            const description = button.dataset.description;
            const price = button.dataset.price;
            const categoryId = button.dataset.categoryId;
            const isActive = button.dataset.active === 'true';
            const availableInRussia = button.dataset.russia === 'true';
            const availableInBali = button.dataset.bali === 'true';
            const imageUrl = button.dataset.image;
            
            // Set hidden product ID field
            document.getElementById('productId').value = productId;
            
            // Fill form fields
            document.getElementById('productName').value = title;
            document.getElementById('productShortDescription').value = summary;
            document.getElementById('productFullDescription').value = description;
            if (window.quillEditor) {
              window.quillEditor.clipboard.dangerouslyPasteHTML(description || '');
            }
            document.getElementById('productInstruction').value = button.dataset.instruction || '';
            document.getElementById('productPrice').value = price;
            document.getElementById('productPriceRub').value = (price * 100).toFixed(2);
            document.getElementById('productStock').value = '999'; // Default stock
            document.getElementById('productCategory').value = categoryId;
            
            // Set status toggle
            document.getElementById('productStatus').checked = isActive;
            
            // Set region toggles
            document.getElementById('productRussia').checked = availableInRussia;
            document.getElementById('productBali').checked = availableInBali;
            
            // Set image preview
            const imagePreview = document.getElementById('imagePreview');
            if (imageUrl) {
              imagePreview.src = imageUrl;
              imagePreview.style.display = 'block';
              imagePreview.nextElementSibling.style.display = 'none';
            } else {
              imagePreview.style.display = 'none';
              imagePreview.nextElementSibling.style.display = 'flex';
            }
            
            // Update modal title and submit button
            const modalH2 = document.querySelector('.product-modal h2');
            const submitBtn = document.getElementById('productModalSubmit');
            if (modalH2) modalH2.textContent = 'Редактировать товар';
            if (submitBtn) submitBtn.textContent = 'Обновить товар';
            
            // Load categories and show modal
            loadCategories();
            document.getElementById('addProductModal').style.display = 'block';
          };
          // Sorting: redirect to full users page with server-side sorting across ALL users
          function sortTable(column) {
            const sortBy = document.getElementById('sortBy');
            const sortOrder = document.getElementById('sortOrder');
            switch(column) {
              case 'name': sortBy.value = 'name'; break;
              case 'balance': sortBy.value = 'balance'; break;
              case 'partners': sortBy.value = 'partners'; break;
              case 'orders': sortBy.value = 'orders'; break;
              case 'activity': sortBy.value = 'activity'; break;
            }
            // applySorting(); // ОТКЛЮЧЕНО
          }
          function applySorting() {
            var sortBy = document.getElementById('sortBy').value;
            var sortOrder = document.getElementById('sortOrder').value;
            window.location.href = '/admin/users-detailed?sort=' + encodeURIComponent(sortBy) + '&order=' + encodeURIComponent(sortOrder);
          }
          
          // Checkbox functionality
          function toggleAllUsers() {
            const selectAll = document.getElementById('selectAll');
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => cb.checked = selectAll.checked);
          }
          
          function selectAllUsers() {
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => cb.checked = true);
            document.getElementById('selectAll').checked = true;
          }
          
          function deselectAllUsers() {
            const checkboxes = document.querySelectorAll('.user-checkbox');
            checkboxes.forEach(cb => cb.checked = false);
            document.getElementById('selectAll').checked = false;
          }
          
          // Message composer functionality
          function openMessageComposer() {
            const selectedUsers = getSelectedUsers();
            if (selectedUsers.length === 0) {
              alert('Выберите пользователей для отправки сообщения');
              return;
            }
            
            document.getElementById('selectedUsers').innerHTML = selectedUsers.map(u => 
              \`<span style="background: #e3f2fd; padding: 2px 8px; border-radius: 12px; margin: 2px; display: inline-block;">\${u.name}</span>\`
            ).join('');
            
            document.getElementById('messageModal').style.display = 'block';
          }
          
          function closeMessageComposer() {
            document.getElementById('messageModal').style.display = 'none';
          }
          
          function getSelectedUsers() {
            const checkboxes = document.querySelectorAll('.user-checkbox:checked');
            return Array.from(checkboxes).map(cb => {
              const row = cb.closest('tr');
              return {
                id: cb.value,
                name: row.dataset.name
              };
            });
          }
          
          function sendMessages() {
            const selectedUsers = getSelectedUsers();
            const messageType = document.getElementById('messageType').value;
            const subject = document.getElementById('messageSubject').value;
            const text = document.getElementById('messageText').value;
            
            if (!text.trim()) {
              alert('Введите текст сообщения');
              return;
            }
            
            // Send to server
            fetch('/admin/send-messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userIds: selectedUsers.map(u => u.id),
                type: messageType,
                subject: subject,
                text: text,
                includeButtons: document.getElementById('includeButtons').checked,
                button1: {
                  text: document.getElementById('button1Text').value,
                  url: document.getElementById('button1Url').value
                },
                button2: {
                  text: document.getElementById('button2Text').value,
                  url: document.getElementById('button2Url').value
                }
              })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                let message = data.message;
                if (data.errors && data.errors.length > 0) {
                  message += '\\n\\nОшибки:\\n' + data.errors.slice(0, 3).join('\\n');
                  if (data.errors.length > 3) {
                    message += '\\n... и еще ' + (data.errors.length - 3) + ' ошибок';
                  }
                }
                alert(message);
                closeMessageComposer();
              } else {
                alert('Ошибка при отправке: ' + data.error);
              }
            })
            .catch(error => {
              alert('Ошибка: ' + (error instanceof Error ? error.message : String(error)));
            });
          }
          
          // Show/hide buttons section
          document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('includeButtons').addEventListener('change', function() {
              const buttonsSection = document.getElementById('buttonsSection');
              buttonsSection.style.display = this.checked ? 'block' : 'none';
            });
            
            // Load categories when product modal opens
            document.getElementById('addProductModal').addEventListener('shown.bs.modal', loadCategories);
            
            // Character counter for short description
            const shortDesc = document.getElementById('productShortDescription');
            const charCount = document.getElementById('shortDescCount');
            if (shortDesc && charCount) {
              shortDesc.addEventListener('input', function() {
                charCount.textContent = this.value.length + '/200';
              });
            }

            // Image preview
            const imageInput = document.getElementById('productImage');
            const imagePreview = document.getElementById('imagePreview');
            if (imageInput && imagePreview) {
              imageInput.addEventListener('change', function() {
                const inputEl = this;
                const file = inputEl && inputEl.files ? inputEl.files[0] : null;
                if (!file) { imagePreview.style.backgroundImage = ''; return; }
                const reader = new FileReader();
                reader.onload = function() { imagePreview.style.backgroundImage = 'url(' + reader.result + ')'; };
                reader.readAsDataURL(file);
              });
            }
            }
            
            // Initialize Quill Editor
            if (typeof Quill !== 'undefined' && document.getElementById('productFullDescriptionEditor')) {
              window.quillEditor = new Quill('#productFullDescriptionEditor', {
                theme: 'snow',
                modules: {
                  toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'header': [1, 2, 3, false] }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                  ]
                }
              });
            }
          });
          
          // Product modal functions
          function openAddProductModal() {
            // Reset form for new product
            document.getElementById('productId').value = '';
            const modalH2 = document.querySelector('.product-modal h2');
            const submitBtn = document.getElementById('productModalSubmit');
            if (modalH2) modalH2.textContent = 'Добавить товар';
            if (submitBtn) submitBtn.textContent = 'Создать товар';
            document.getElementById('addProductModal').style.display = 'block';
            loadCategories();
          }
          
          function closeAddProductModal() {
            document.getElementById('addProductModal').style.display = 'none';
            document.getElementById('addProductForm').reset();
            document.getElementById('productId').value = '';
            document.getElementById('shortDescCount').textContent = '0/200';
            
            // Clear Quill editor
            if (window.quillEditor) {
              window.quillEditor.setText('');
            }
            
            // Reset modal title and submit button
            const modalH2 = document.querySelector('.product-modal h2');
            const submitBtn = document.getElementById('productModalSubmit');
            if (modalH2) modalH2.textContent = 'Добавить новый товар';
            if (submitBtn) submitBtn.textContent = 'Создать товар';
          }
          
          function openAddCategoryModal() {
            document.getElementById('addCategoryModal').style.display = 'block';
          }
          
          function closeAddCategoryModal() {
            document.getElementById('addCategoryModal').style.display = 'none';
            document.getElementById('addCategoryForm').reset();
          }
          
          // Edit product using create modal
          function editProductUsingCreateModal(button) {
            const productId = button.dataset.id;
            const title = button.dataset.title;
            const summary = button.dataset.summary;
            const description = button.dataset.description;
            const price = button.dataset.price;
            const categoryId = button.dataset.categoryId;
            const isActive = button.dataset.active === 'true';
            const availableInRussia = button.dataset.russia === 'true';
            const availableInBali = button.dataset.bali === 'true';
            const imageUrl = button.dataset.image;
            
            // Set hidden product ID field
            document.getElementById('productId').value = productId;
            
            // Fill form fields
            document.getElementById('productName').value = title;
            document.getElementById('productShortDescription').value = summary;
            document.getElementById('productFullDescription').value = description;
            if (window.quillEditor) {
              window.quillEditor.clipboard.dangerouslyPasteHTML(description || '');
            }
            document.getElementById('productInstruction').value = button.dataset.instruction || '';
            document.getElementById('productPrice').value = price;
            document.getElementById('productPriceRub').value = (price * 100).toFixed(2);
            document.getElementById('productStock').value = '999'; // Default stock
            document.getElementById('productCategory').value = categoryId;
            
            // Set status toggle
            const activeEl = document.getElementById('productActive');
            if (activeEl) activeEl.checked = isActive;
            
            // Set region toggles
            const rEl = document.getElementById('regionRussia');
            const bEl = document.getElementById('regionBali');
            if (rEl) rEl.checked = availableInRussia;
            if (bEl) bEl.checked = availableInBali;
            
            // Set image preview (div with background-image)
            const imagePreview = document.getElementById('imagePreview');
            if (imagePreview) {
            if (imageUrl) {
                imagePreview.style.backgroundImage = 'url(' + imageUrl + ')';
            } else {
                imagePreview.style.backgroundImage = '';
              }
            }
            
            // Update modal title and submit button
            const modalH2 = document.querySelector('.product-modal h2');
            const submitBtn = document.getElementById('productModalSubmit');
            if (modalH2) modalH2.textContent = 'Редактировать товар';
            if (submitBtn) submitBtn.textContent = 'Обновить товар';
            
            // Load categories and show modal
            loadCategories();
            document.getElementById('addProductModal').style.display = 'block';
          }
          
          // Load categories for product form
          async function loadCategories() {
            try {
              const response = await fetch('/admin/api/categories');
              const categories = await response.json();
              
              const select = document.getElementById('productCategory');
              select.innerHTML = '<option value="">Выберите категорию</option>';
              
              categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                select.appendChild(option);
              });
            } catch (error) {
              console.error('Error loading categories:', error);
            }
          }
          
          // Handle product form submission
          document.getElementById('addProductForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const productId = document.getElementById('productId').value;
            const isEdit = productId !== '';
            
            const formData = new FormData();
            // Backend /admin/products/:productId/update expects: title, summary, description, isActive
            formData.append('title', document.getElementById('productName').value);
            formData.append('price', document.getElementById('productPrice').value);
            formData.append('categoryId', document.getElementById('productCategory').value);
            formData.append('stock', String(document.getElementById('productStock').value || 0));
            formData.append('summary', document.getElementById('productShortDescription').value);
            
            // Extract HTML from Quill editor
            let fullDescHtml = '';
            if (window.quillEditor) {
              fullDescHtml = window.quillEditor.root.innerHTML;
            } else {
              fullDescHtml = document.getElementById('productFullDescription').value;
            }
            // Fallback for empty quill editor inserting <p><br></p>
            if (fullDescHtml === '<p><br></p>') fullDescHtml = '';
            formData.append('description', fullDescHtml);
            
            formData.append('instruction', document.getElementById('productInstruction').value);
            formData.append('isActive', document.getElementById('productActive').checked ? 'true' : 'false');
            
            // Regions
            formData.append('availableInRussia', document.getElementById('regionRussia').checked ? 'true' : 'false');
            formData.append('availableInBali', document.getElementById('regionBali').checked ? 'true' : 'false');
            
            // Add image if selected
            const imageFile = document.getElementById('productImage').files[0];
            if (imageFile) {
              formData.append('image', imageFile);
            }
            
            try {
              const url = isEdit ? \`/admin/products/\${productId}/update\` : '/admin/api/products';
              const response = await fetch(url, {
                method: 'POST',
                body: formData
              });
              
              const result = await response.json();
              
              if (result.success) {
                // Проверка: сравнить отправленные и сохранённые данные
                if (isEdit && result.product) {
                  const saved = result.product;
                  const sentTitle = document.getElementById('productName').value;
                  const sentPrice = parseFloat(document.getElementById('productPrice').value);
                  if (saved.title !== sentTitle || Math.abs(saved.price - sentPrice) > 0.01) {
                    alert('⚠️ Предупреждение: некоторые данные могли не сохраниться. Проверьте товар.');
                  } else {
                    alert('✅ Товар успешно обновлен!');
                  }
                } else {
                  alert(isEdit ? '✅ Товар обновлен' : '✅ Товар создан');
                }
                closeAddProductModal();
                // Refresh the page to show changes
                window.location.reload();
              } else {
                alert('Ошибка: ' + result.error);
              }
            } catch (error) {
              alert('Ошибка: ' + (error instanceof Error ? error.message : String(error)));
            }
          });
          // Handle category form submission
          document.getElementById('addCategoryForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const categoryData = {
              name: document.getElementById('categoryName').value,
              description: document.getElementById('categoryDescription').value,
              icon: document.getElementById('categoryIcon').value
            };
            
            try {
              const response = await fetch('/admin/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryData)
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('✅ Категория успешно создана!');
                closeAddCategoryModal();
                // Reload categories in product form
                loadCategories();
              } else {
                alert('❌ Ошибка при создании категории: ' + result.error);
              }
            } catch (error) {
              alert('❌ Ошибка: ' + (error instanceof Error ? error.message : String(error)));
            }
          });
          
          // Apply default sorting on page load - ОТКЛЮЧЕНО
          // window.addEventListener('DOMContentLoaded', function() {
          //   applySorting();
          // });

          // Global functions for user actions
          window.showUserPartners = function(userId, userName) {
            console.log('showUserPartners called with:', userId, userName);
            window.open('/admin/users/' + userId + '/partners', '_blank', 'width=800,height=600');
          }
          
          window.showUserOrders = function(userId, userName) {
            console.log('showUserOrders called with:', userId, userName);
            window.open('/admin/users/' + userId + '/orders', '_blank', 'width=1000,height=700');
          }

          window.showUserDetails = function(userId) {
            console.log('showUserDetails called with:', userId);
            window.open('/admin/users/' + userId, '_blank', 'width=600,height=400');
          }

          window.showHierarchy = function(userId) {
            console.log('showHierarchy called with:', userId);
            window.open('/admin/partners-hierarchy?user=' + userId, '_blank', 'width=800,height=600');
          }

          // Debug: Check if functions are properly defined
          console.log('Functions defined:', {
            showUserOrders: typeof window.showUserOrders,
            showUserPartners: typeof window.showUserPartners,
            showUserDetails: typeof window.showUserDetails,
            showHierarchy: typeof window.showHierarchy
          });

          // Fallback: Define functions as global variables if window assignment didn't work
          if (typeof showUserOrders === 'undefined') {
            window.showUserOrders = function(userId, userName) {
              console.log('Fallback showUserOrders called with:', userId, userName);
              window.open('/admin/users/' + userId + '/orders', '_blank', 'width=1000,height=700');
            };
          }
          
          if (typeof showUserPartners === 'undefined') {
            window.showUserPartners = function(userId, userName) {
              console.log('Fallback showUserPartners called with:', userId, userName);
              window.open('/admin/users/' + userId + '/partners', '_blank', 'width=800,height=600');
            };
          }
          
          if (typeof showUserDetails === 'undefined') {
            window.showUserDetails = function(userId) {
              console.log('Fallback showUserDetails called with:', userId);
              window.open('/admin/users/' + userId, '_blank', 'width=600,height=400');
            };
          }
          
          if (typeof showHierarchy === 'undefined') {
            window.showHierarchy = function(userId) {
              console.log('Fallback showHierarchy called with:', userId);
              window.open('/admin/partners-hierarchy?user=' + userId, '_blank', 'width=800,height=600');
            };
          }

          // Edit delivery address function
          window.editDeliveryAddress = function(userId) {
            const modal = document.createElement('div');
            modal.id = 'deliveryAddressModal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
            
            const modalContent = '<div style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 500px;">' +
              '<h3>📍 Редактировать адрес доставки</h3>' +
              '<div style="margin: 15px 0;">' +
                '<label style="display: block; margin-bottom: 5px; font-weight: bold;">Тип адреса:</label>' +
                '<select id="addressType" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">' +
                  '<option value="Бали">🇮🇩 Бали - район и вилла</option>' +
                  '<option value="Россия">🇷🇺 РФ - город и адрес</option>' +
                  '<option value="Произвольный">✏️ Произвольный адрес</option>' +
                '</select>' +
              '</div>' +
              '<div style="margin: 15px 0;">' +
                '<label style="display: block; margin-bottom: 5px; font-weight: bold;">Адрес:</label>' +
                '<textarea id="addressText" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; height: 80px; resize: vertical;" placeholder="Введите адрес доставки"></textarea>' +
              '</div>' +
              '<div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">' +
                '<button onclick="closeDeliveryAddressModal()" style="padding: 8px 16px; border: 1px solid #ddd; background: #f8f9fa; border-radius: 4px; cursor: pointer;">Отмена</button>' +
                '<button onclick="saveDeliveryAddress(\\'' + userId + '\\')" style="padding: 8px 16px; border: none; background: #28a745; color: white; border-radius: 4px; cursor: pointer;">💾 Сохранить</button>' +
              '</div>' +
            '</div>';
            
            modal.innerHTML = modalContent;
            (document.querySelector('.admin-shell') || document.body).appendChild(modal);
          };

          window.closeDeliveryAddressModal = function() {
            const modal = document.getElementById('deliveryAddressModal');
            if (modal) {
              modal.remove();
            }
          };

          window.saveDeliveryAddress = async function(userId) {
            const addressType = document.getElementById('addressType').value;
            const addressText = document.getElementById('addressText').value.trim();
            
            if (!addressText) {
              alert('Пожалуйста, введите адрес');
              return;
            }

            try {
              const response = await fetch('/admin/users/' + userId + '/delivery-address', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  addressType: addressType,
                  address: addressText
                })
              });

              if (response.ok) {
                alert('Адрес доставки сохранен');
                location.reload();
              } else {
                const error = await response.json();
                alert('Ошибка: ' + (error.error || 'Не удалось сохранить адрес'));
              }
            } catch (error) {
              alert('Ошибка сети: ' + error.message);
            }
          };
          
          // Instruction modal functions - MOVED TO LATER IN SCRIPT TO AVOID DUPLICATES
          
          window.editInstruction = function(productId) {
            // Redirect to product edit page
            window.location.href = '/admin/products?edit=' + productId;
          };
          
          window.deleteInstruction = function(productId) {
            if (confirm('Вы уверены, что хотите удалить инструкцию для этого товара?')) {
              // Send request to delete instruction
              fetch('/admin/products/' + productId + '/delete-instruction', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include'
              })
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  alert('Инструкция успешно удалена!');
                  closeInstruction();
                  location.reload();
                } else {
                  alert('Ошибка: ' + (data.error || 'Не удалось удалить инструкцию'));
                }
              })
              .catch(error => {
                alert('Ошибка: ' + (error instanceof Error ? error.message : String(error)));
              });
            }
          };
          
          window.saveInstruction = function(productId) {
            const textarea = document.getElementById('instructionTextarea');
            const instructionText = textarea.value.trim();
            
            if (!instructionText) {
              alert('Пожалуйста, введите инструкцию');
              return;
            }
            
            // Send request to save instruction
            fetch('/admin/products/' + productId + '/save-instruction', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ instruction: instructionText })
            })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                alert('Инструкция успешно сохранена!');
                closeInstruction();
                location.reload();
              } else {
                alert('Ошибка: ' + (data.error || 'Не удалось сохранить инструкцию'));
              }
            })
            .catch(error => {
              alert('Ошибка: ' + (error instanceof Error ? error.message : String(error)));
            });
          };
          
          window.cancelInstruction = function() {
            closeInstruction();
          };
        </script>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Admin panel error:', error);
    res.status(500).send('Internal server error');
  }
});
// Detailed users management with sorting and filtering
// Export users to CSV
router.get('/users/export', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        partner: true,
        orders: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // CSV Header
    let csv = 'ID;Username;Имя;Телефон;Роль;Баланс;Бонус;Партнер (статус);Партнеров (всего);Партнеров (1 ур);Заказов;Сумма заказов;Дата регистрации\\n';

    // CSV Rows
    for (const u of users) {
      const user = u as any;
      const partner = user.partner;

      // Calculate total paid orders
      const paidOrders = user.orders.filter((o: any) => o.status === 'COMPLETED');
      const totalSpent = paidOrders.reduce((sum: number, o: any) => {
        try {
          const items = typeof o.itemsJson === 'string' ? JSON.parse(o.itemsJson) : (o.itemsJson || []);
          // @ts-ignore
          return sum + items.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 1), 0);
        } catch { return sum; }
      }, 0);

      const row = [
        user.id,
        user.username || '',
        user.firstName || '',
        user.phone || '',
        user.role,
        user.balance || 0,
        partner?.bonus || 0,
        partner ? (partner.isActive ? 'Активен' : 'Не активен') : 'Нет',
        partner?.totalPartners || 0,
        partner?.directPartners || 0,
        user.orders.length,
        totalSpent,
        user.createdAt.toISOString()
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(';');

      csv += row + '\\n';
    }

    // Send file
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export_' + new Date().toISOString().slice(0, 10) + '.csv"');
    res.send('\ufeff' + csv); // Add BOM for Excel
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).send('Ошибка экспорта');
  }
});
// Detailed users management with sorting and filtering
router.get('/users-detailed', requireAdmin, async (req, res) => {
  try {
    const sortBy = req.query.sort as string || 'orders';
    const sortOrder = req.query.order as string || 'desc';
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    // Get all users with their related data
    // Search by username or phone
    const search = (req.query.search as string | undefined)?.trim().replace(/^@/, '');
    const users = await prisma.user.findMany({
      include: {
        partner: {
          include: {
            referrals: true,
            transactions: true
          }
        },
        orders: true
      },
      where: {
        AND: [
          search ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } }
            ]
          } : {}
        ]
      },
      orderBy: {
        createdAt: sortOrder === 'desc' ? 'desc' : 'asc'
      }
    });

    // OPTIMIZATION: Fetch all referrals once to avoid N+1 queries
    const allReferrals = await prisma.partnerReferral.findMany({
      select: {
        referredId: true,
        profile: {
          select: {
            userId: true,
            user: { select: { id: true, username: true, firstName: true, lastName: true, telegramId: true } }
          }
        }
      }
    });

    // Build in-memory maps for O(1) access
    const downlineMap = new Map<string, string[]>();
    const inviterMap = new Map<string, any>();

    for (const ref of allReferrals) {
      if (!ref.referredId || !ref.profile?.userId) continue;

      // Populate downline (Parent -> Children)
      const inviterId = ref.profile.userId;
      if (!downlineMap.has(inviterId)) downlineMap.set(inviterId, []);
      downlineMap.get(inviterId)?.push(ref.referredId);

      // Populate inviter map (Child -> Parent User)
      if (ref.profile.user) {
        inviterMap.set(ref.referredId, ref.profile.user);
      }
    }

    // Helper function to count partners by level (In-Memory)
    function countPartnersByLevel(userId: string): { level1: number, level2: number, level3: number } {
      // Level 1: Direct referrals
      const level1Ids = downlineMap.get(userId) || [];
      const level1Count = level1Ids.length;

      // Level 2: Referrals of level 1 partners
      let level2Count = 0;
      let level2Ids: string[] = [];
      for (const id of level1Ids) {
        const children = downlineMap.get(id) || [];
        level2Count += children.length;
        level2Ids.push(...children);
      }

      // Level 3: Referrals of level 2 partners
      let level3Count = 0;
      for (const id of level2Ids) {
        const children = downlineMap.get(id) || [];
        level3Count += children.length;
      }

      return { level1: level1Count, level2: level2Count, level3: level3Count };
    }

    // Calculate additional data for each user
    const usersWithStats = await Promise.all(users.map(async (user: any) => {
      const partnerProfile = user.partner;
      const directPartners = partnerProfile?.referrals?.length || 0;

      // Get partners count by level (Sync)
      const partnersByLevel = countPartnersByLevel(user.id);

      console.log(`👤 User ${user.firstName} (@${user.username}) ID: ${user.id}: ${user.orders?.length || 0} orders`);

      // Разделяем заказы по статусам
      const ordersByStatus = {
        new: user.orders?.filter((order: any) => order.status === 'NEW') || [],
        processing: user.orders?.filter((order: any) => order.status === 'PROCESSING') || [],
        completed: user.orders?.filter((order: any) => order.status === 'COMPLETED') || [],
        cancelled: user.orders?.filter((order: any) => order.status === 'CANCELLED') || []
      };

      // Сумма только оплаченных (завершенных) заказов
      const paidOrderSum = ordersByStatus.completed.reduce((sum: number, order: any) => {
        try {
          const items = typeof order.itemsJson === 'string'
            ? JSON.parse(order.itemsJson || '[]')
            : (order.itemsJson || []);
          const orderTotal = items.reduce((itemSum: number, item: any) => itemSum + (item.price || 0) * (item.quantity || 1), 0);
          return sum + orderTotal;
        } catch {
          return sum;
        }
      }, 0);

      // Определяем приоритетный статус (новые заказы имеют приоритет)
      const hasNewOrders = ordersByStatus.new.length > 0;
      const hasProcessingOrders = ordersByStatus.processing.length > 0;
      const hasCompletedOrders = ordersByStatus.completed.length > 0;
      const hasCancelledOrders = ordersByStatus.cancelled.length > 0;

      let priorityStatus = 'none';
      if (hasNewOrders) priorityStatus = 'new';
      else if (hasProcessingOrders) priorityStatus = 'processing';
      else if (hasCompletedOrders) priorityStatus = 'completed';
      else if (hasCancelledOrders) priorityStatus = 'cancelled';

      // Debug: Log status determination for detailed view
      if (user.orders && user.orders.length > 0) {
        console.log(`Detailed view - User ${user.firstName} orders:`, {
          total: user.orders.length,
          new: ordersByStatus.new.length,
          processing: ordersByStatus.processing.length,
          completed: ordersByStatus.completed.length,
          cancelled: ordersByStatus.cancelled.length,
          priorityStatus: priorityStatus
        });
      }

      const totalOrderSum = paidOrderSum; // Используем только оплаченные заказы
      const balance = user.balance || partnerProfile?.balance || 0;
      const bonus = partnerProfile?.bonus || 0;
      const lastActivity = user.updatedAt || user.createdAt;

      return {
        ...user,
        directPartners,
        level2Partners: partnersByLevel.level2,
        level3Partners: partnersByLevel.level3,
        totalOrderSum,
        balance,
        bonus,
        lastActivity,
        ordersByStatus,
        priorityStatus,
        paidOrderSum,
        inviter: inviterMap.get(user.id) || null
      };
    }));

    // Alias for compatibility (already enriched)
    const usersWithInviters = usersWithStats;

    // Apply sorting
    let sortedUsers = usersWithInviters;
    if (sortBy === 'balance') {
      sortedUsers = usersWithInviters.sort((a, b) =>
        sortOrder === 'desc' ? b.balance - a.balance : a.balance - b.balance
      );
    } else if (sortBy === 'partners') {
      sortedUsers = usersWithInviters.sort((a, b) =>
        sortOrder === 'desc' ? b.directPartners - a.directPartners : a.directPartners - b.directPartners
      );
    } else if (sortBy === 'orders') {
      sortedUsers = usersWithInviters.sort((a, b) => {
        // 1. Приоритет: сначала новые красные заказы
        const aHasNew = a.priorityStatus === 'new';
        const bHasNew = b.priorityStatus === 'new';

        if (aHasNew && !bHasNew) return -1;
        if (!aHasNew && bHasNew) return 1;

        // 2. Если оба имеют новые заказы или оба не имеют - сортируем по дате новых заказов
        if (aHasNew && bHasNew) {
          const aNewOrder = a.orders?.find((order: any) => order.status === 'NEW');
          const bNewOrder = b.orders?.find((order: any) => order.status === 'NEW');

          if (aNewOrder && bNewOrder) {
            return new Date(bNewOrder.createdAt).getTime() - new Date(aNewOrder.createdAt).getTime();
          }
        }

        // 3. Затем приоритет: новые зеленые заказы
        const aHasCompleted = a.priorityStatus === 'completed';
        const bHasCompleted = b.priorityStatus === 'completed';

        if (aHasCompleted && !bHasCompleted) return -1;
        if (!aHasCompleted && bHasCompleted) return 1;

        // 4. Если оба имеют завершенные заказы - сортируем по дате
        if (aHasCompleted && bHasCompleted) {
          const aCompletedOrder = a.orders?.find((order: any) => order.status === 'COMPLETED');
          const bCompletedOrder = b.orders?.find((order: any) => order.status === 'COMPLETED');

          if (aCompletedOrder && bCompletedOrder) {
            return new Date(bCompletedOrder.createdAt).getTime() - new Date(aCompletedOrder.createdAt).getTime();
          }
        }

        // 5. Если нет заказов, сортируем по сумме
        return sortOrder === 'desc' ? b.totalOrderSum - a.totalOrderSum : a.totalOrderSum - b.totalOrderSum;
      });
    } else if (sortBy === 'activity') {
      sortedUsers = usersWithInviters.sort((a, b) =>
        sortOrder === 'desc' ? new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime() :
          new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime()
      );
    }

    // Optional filter
    const filter = (req.query.filter as string | undefined) || '';
    if (filter === 'with_balance') {
      sortedUsers = sortedUsers.filter((u: any) => (u.balance || 0) > 0);
    }

    // Pagination
    const PAGE_SIZE = 25;
    const totalUsers = sortedUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
    const currentPage = Math.max(1, Math.min(totalPages, parseInt(req.query.page as string || '1', 10) || 1));
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const paginatedUsers = sortedUsers.slice(startIdx, startIdx + PAGE_SIZE);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Детальная информация о пользователях - Vital Admin</title>
        <meta charset="utf-8">
        <style>
          /* UI kit baseline */
          ${ADMIN_UI_CSS}

          body { margin: 0; padding: 0; background: var(--admin-bg); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .page-title{ margin: 0; font-size: 18px; font-weight: 900; letter-spacing: -0.02em; }
          .page-subtitle{ margin-top: 6px; font-size: 12px; color: var(--admin-muted); }
          .page-header-row{ display:flex; align-items:flex-start; justify-content:space-between; gap: 12px; margin-bottom: 12px; }
          
          .controls { padding: 14px; background: #fff; border: 1px solid var(--admin-border); border-radius: 18px; }
          .sort-controls { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
          .sort-group { display: flex; gap: 10px; align-items: center; }
          .sort-group label { font-weight: 600; color: #495057; }
          .sort-group select { padding: 10px 12px; border: 1px solid var(--admin-border-strong); border-radius: 12px; background: #fff; }
          .sort-group input { padding: 10px 12px; border: 1px solid var(--admin-border-strong); border-radius: 12px; background: #fff; }
          
          .stats-bar { display: grid; grid-template-columns: repeat(5, minmax(160px, 1fr)); gap: 12px; margin-top: 12px; }
          .stat-item { text-align: left; background:#fff; border: 1px solid var(--admin-border); border-radius: 18px; padding: 12px 14px; }
          .stat-number { font-size: 22px; font-weight: 900; letter-spacing: -0.03em; color: var(--admin-text); }
          .stat-label { font-size: 11px; color: var(--admin-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; }
          
          .table-container { overflow: auto; width: 100%; border: 1px solid var(--admin-border); border-radius: 18px; background:#fff; margin-top: 12px; }
          .users-table { width: 100%; border-collapse: collapse; min-width: 100%; table-layout: fixed; }
          .users-table th { background: rgba(17,24,39,0.03); padding: 10px 8px; text-align: left; font-weight: 900; color: var(--admin-muted); border-bottom: 1px solid rgba(17,24,39,0.08); white-space: nowrap; position: sticky; top: 0; z-index: 10; font-size: 11px; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; letter-spacing: .06em; }
          .users-table td { padding: 10px 8px; border-bottom: 1px solid rgba(17,24,39,0.06); vertical-align: top; white-space: nowrap; font-size: 12px; overflow: hidden; text-overflow: ellipsis; position: relative; }
          .users-table tr:hover td { background: rgba(17,24,39,0.02); }
          
          /* Sticky колонка пользователя с улучшенным эффектом */
          .users-table th.user-cell, .users-table td.user-cell { 
            position: sticky; left: 0; z-index: 15; 
            background: #fff; border-right: 1px solid rgba(17,24,39,0.10);
            box-shadow: 2px 0 10px rgba(17,24,39,0.06);
            min-width: 140px; max-width: 140px;
          }
          .users-table tr:hover td.user-cell { background: #fff; }
          
          /* Стили для горизонтального скролла */
          .table-container::-webkit-scrollbar { height: 8px; }
          .table-container::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
          .table-container::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
          .table-container::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
          
          /* Компактные стили для колонок - ограничение до 15 символов */
          .compact-cell { min-width: 80px; max-width: 80px; width: 80px; }
          .user-cell { min-width: 140px; max-width: 140px; width: 140px; }
          .actions-cell { min-width: 120px; max-width: 120px; width: 120px; }
          
          /* Tooltip для полной информации */
          .cell-tooltip {
            position: relative;
            cursor: help;
          }
          
          .cell-tooltip:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            max-width: 300px;
            white-space: normal;
            word-break: break-word;
          }
          
          /* Стили для кликабельных партнеров */
          .clickable-partners {
            transition: all 0.2s ease;
          }
          
          .clickable-partners:hover {
            background: #007bff !important;
            color: white !important;
            transform: scale(1.1);
          }
          
          /* Стили для списка партнеров */
          .partners-list {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 15px;
            margin-top: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-height: 200px;
            overflow-y: auto;
          }
          
          .partners-list-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            border-bottom: 1px solid #f1f3f4;
          }
          
          .partners-list-item:last-child {
            border-bottom: none;
          }
          
          /* Модалки: используем UI kit (не переопределяем глобальные .modal-*) */
          
          /* Стили для формы сообщений */
          .message-form-group {
            margin-bottom: 20px;
          }
          
          .message-form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #495057;
          }
          
          .message-form-group input,
          .message-form-group textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
          }
          
          .message-form-group input:focus,
          .message-form-group textarea:focus {
            outline: none;
            border-color: #007bff;
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
          }
          
          .selected-users-list {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 5px;
          }
          
          .selected-user-tag {
            background: #e9ecef;
            color: #495057;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
          }
          
          .char-count {
            text-align: right;
            font-size: 12px;
            color: #6c757d;
            margin-top: 5px;
          }
          
          .message-error {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 6px;
            margin-top: 10px;
            border: 1px solid #f5c6cb;
          }
          
          .user-info { display: flex; align-items: center; gap: 8px; }
          .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px; }
          .user-details h4 { margin: 0; font-size: 14px; color: #212529; }
          .user-details p { margin: 1px 0 0 0; font-size: 11px; color: #6c757d; }
          .user-name-link { color: #212529; text-decoration: none; transition: color 0.3s ease; }
          .user-name-link:hover { color: #007bff; text-decoration: underline; }
          
          .balance { font-weight: bold; font-size: 14px; }
          .balance.positive { color: #28a745; }
          .balance.zero { color: #6c757d; }
          
          .partners-count { background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
          .orders-sum { background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 8px; font-size: 10px; font-weight: 600; }
          
          /* action-btn already styled by ADMIN_UI_CSS */
          
          .empty-state { text-align: center; padding: 60px 20px; color: #6c757d; }
          .empty-state h3 { margin: 0 0 10px 0; font-size: 24px; }
          .empty-state p { margin: 0; font-size: 16px; }

        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Пользователи', activePath: '/admin/users-detailed', buildMarker })}
        <script>
          // Определяем все функции ДО загрузки HTML
          (function() {
            // Функции для совместимости
            window.showUserDetails = function(userId) {
              window.open('/admin/users/' + userId, '_blank', 'width=600,height=400');
            };
            
            window.showHierarchy = function(userId) {
              window.open('/admin/partners-hierarchy?user=' + userId, '_blank', 'width=800,height=600');
            };
            
            // Функции для массового выбора пользователей
            window.updateSelectedUsers = function() {
              const checkboxes = document.querySelectorAll('.user-checkbox');
              const checkedCount = document.querySelectorAll('.user-checkbox:checked').length;
              const selectAllCheckbox = document.getElementById('selectAllUsers');
              
              if (selectAllCheckbox) {
                selectAllCheckbox.checked = checkedCount === checkboxes.length;
                selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
              }
            };
            
            window.toggleAllUsers = function(checked) {
              const checkboxes = document.querySelectorAll('.user-checkbox');
              checkboxes.forEach(checkbox => {
                checkbox.checked = checked;
              });
              window.updateSelectedUsers();
            };
            
            window.deleteSelectedUser = async function(userId, userName) {
              if (!confirm('⚠️ ВНИМАНИЕ! Вы уверены, что хотите удалить пользователя "' + userName + '"?\\n\\nЭто действие удалит:\\n- Пользователя\\n- Партнерский профиль\\n- Все рефералы\\n- Все транзакции\\n- Все заказы\\n- Историю действий\\n\\nЭто действие НЕОБРАТИМО!')) {
                return;
              }
              
              const doubleCheck = prompt('Для подтверждения введите: УДАЛИТЬ');
              if (doubleCheck !== 'УДАЛИТЬ') {
                alert('Отмена удаления. Пользователь не был удален.');
                return;
              }
              
              try {
                const response = await fetch('/admin/users/' + userId + '/delete', {
                  method: 'DELETE',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });
                
                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.error || 'Ошибка при удалении пользователя');
                }
                
                const result = await response.json();
                
                if (result.success) {
                  alert('✅ Пользователь "' + userName + '" успешно удален!');
                  window.location.reload();
                } else {
                  throw new Error(result.error || 'Ошибка при удалении');
                }
              } catch (error) {
                console.error('Error deleting user:', error);
                alert('❌ Ошибка при удалении пользователя: ' + (error instanceof Error ? error.message : String(error)));
              }
            };
            
            window.deleteSelectedUsers = async function() {
              const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
              if (selectedCheckboxes.length === 0) {
                alert('Выберите пользователей для удаления');
                return;
              }
              
              const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
              
              if (!confirm('⚠️ ВНИМАНИЕ! Вы уверены, что хотите удалить ' + selectedIds.length + ' пользователей?\\n\\nЭто действие удалит:\\n- Пользователей\\n- Партнерские профили\\n- Все рефералы\\n- Все транзакции\\n- Все заказы\\n- Историю действий\\n\\nЭто действие НЕОБРАТИМО!')) {
                return;
              }
              
              const doubleCheck = prompt('Для подтверждения введите: УДАЛИТЬ ВСЕХ');
              if (doubleCheck !== 'УДАЛИТЬ ВСЕХ') {
                alert('Отмена удаления. Пользователи не были удалены.');
                return;
              }
              
              try {
                let successCount = 0;
                let failCount = 0;
                
                for (const userId of selectedIds) {
                  try {
                    const response = await fetch('/admin/users/' + userId + '/delete', {
                      method: 'DELETE',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json'
                      }
                    });
                    
                    if (response.ok) {
                      successCount++;
                    } else {
                      failCount++;
                    }
                  } catch (error) {
                    failCount++;
                  }
                }
                
                alert('✅ Удалено пользователей: ' + successCount + '\\n❌ Ошибок: ' + failCount);
                window.location.reload();
              } catch (error) {
                console.error('Error deleting users:', error);
                alert('❌ Ошибка при удалении пользователей');
              }
            };
            
            // Event delegation - работает сразу
            document.addEventListener('change', function(e) {
              if (e.target && e.target.classList && e.target.classList.contains('user-checkbox')) {
                if (typeof window.updateSelectedUsers === 'function') {
                  window.updateSelectedUsers();
                }
              }
            });
            
            document.addEventListener('click', function(e) {
              if (e.target && e.target.classList && e.target.classList.contains('delete-selected-btn')) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.deleteSelectedUsers === 'function') {
                  window.deleteSelectedUsers();
                }
              }
            });
            
            // После загрузки DOM
            document.addEventListener('DOMContentLoaded', function() {
              const selectAllCheckbox = document.getElementById('selectAllUsers');
              if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', function(e) {
                  if (typeof window.toggleAllUsers === 'function') {
                    window.toggleAllUsers(e.target.checked);
                  }
                });
              }
            });
          })();
        </script>

        <div class="page-header-row">
          <div>
            <div class="page-title">Детальная информация о пользователях</div>
            <div class="page-subtitle">Полная статистика, балансы, партнёры и заказы</div>
          </div>
          <a class="btn" href="/admin">Назад</a>
        </div>
          
          <div class="controls">
            <div class="sort-controls">
              <div class="sort-group" style="position: relative; flex-grow: 1; min-width: 300px;">
                <label>Поиск (юзернейм или телефон):</label>
                <div style="display: flex; gap: 8px;">
                  <input type="text" id="searchUsername" placeholder="@username или 79..." autocomplete="off" style="flex-grow: 1;" />
                  <button type="button" class="btn" onclick="searchByUsername()">Найти</button>
                  <a href="/admin/users/export" class="btn" style="background-color: #198754; color: white; display: flex; align-items: center; gap: 6px; text-decoration: none; padding: 0 12px;" title="Скачать список в Excel">
                    <span>📥</span> Excel
                  </a>
                </div>
                <div id="searchSuggestions" style="position:absolute; top:68px; left:0; background:#fff; border:1px solid #e5e7eb; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,.1); width:100%; max-height:220px; overflow:auto; display:none; z-index:5"></div>
              </div>
              <div class="sort-group">
                <label>Сортировать по:</label>
                <select id="sortSelect">
                  <option value="activity" ${sortBy === 'activity' ? 'selected' : ''}>Активности</option>
                  <option value="balance" ${sortBy === 'balance' ? 'selected' : ''}>Балансу</option>
                  <option value="partners" ${sortBy === 'partners' ? 'selected' : ''}>Количеству партнёров</option>
                  <option value="orders" ${sortBy === 'orders' ? 'selected' : ''}>Сумме заказов</option>
                </select>
              </div>
              
              <div class="sort-group">
                <label>Порядок:</label>
                <select id="orderSelect">
                  <option value="desc" ${sortOrder === 'desc' ? 'selected' : ''}>По убыванию</option>
                  <option value="asc" ${sortOrder === 'asc' ? 'selected' : ''}>По возрастанию</option>
                </select>
              </div>
              
              <button type="button" class="btn" onclick="applySorting()">Применить</button>
            </div>
            <div class="message-controls" style="margin-top: 10px;">
              <button type="button" class="btn btn-danger delete-selected-btn">Удалить выбранных</button>
            </div>
          </div>
          
          <div class="stats-bar">
            <div class="stat-item" style="cursor:pointer" onclick="applyFilter('all')">
              <div class="stat-number">${totalUsers}</div>
              <div class="stat-label">Всего пользователей</div>
            </div>
            <div class="stat-item" style="cursor:pointer" onclick="applyFilter('with_balance')">
              <div class="stat-number">${sortedUsers.filter(u => u.balance > 0).length}</div>
              <div class="stat-label">С балансом</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${sortedUsers.filter(u => u.directPartners > 0).length}</div>
              <div class="stat-label">Партнёры</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${sortedUsers.reduce((sum, u) => sum + u.totalOrderSum, 0).toFixed(2)} PZ</div>
              <div class="stat-label">Общая сумма заказов</div>
            </div>
            <div class="stat-item">
              <div class="stat-number">${sortedUsers.reduce((sum, u) => sum + u.balance, 0).toFixed(2)} PZ</div>
              <div class="stat-label">Общий баланс партнёров</div>
            </div>
          </div>
          
          ${sortedUsers.length === 0 ? `
            <div class="empty-state">
              <h3>📭 Нет пользователей</h3>
              <p>Пользователи появятся здесь после регистрации</p>
            </div>
          ` : `
            <div class="table-container">
              <table class="users-table">
                <thead>
                  <tr>
                    <th class="compact-cell">
                      <input type="checkbox" id="selectAllUsers" style="margin-right: 5px;">
                      <button type="button" onclick="openMessageModal()" class="action-btn" title="Сообщение">Сообщение</button>
                      <button type="button" class="action-btn delete-selected-btn" title="Удалить выбранных" style="border-color: rgba(220,38,38,0.35); color:#991b1b;">Удалить</button>
                    </th>
                    <th class="compact-cell">Партнерская программа</th>
                    <th class="compact-cell">Баланс</th>
                    <th class="compact-cell">Заказы</th>
                    <th class="compact-cell">Пригласитель</th>
                    <th class="user-cell">Пользователь</th>
                    <th class="compact-cell">Партнер 1го уровня</th>
                    <th class="compact-cell">Партнер 2го уровня</th>
                    <th class="compact-cell">Партнер 3го уровня</th>
                    <th class="compact-cell">Покупки (сумма)</th>
                    <th class="compact-cell">Вознаграждение (общая сумма)</th>
                    <th class="compact-cell">Выплаты</th>
                    <th class="compact-cell">Осталось выплатить</th>
                    <th class="actions-cell">Действия</th>
                  </tr>
                </thead>
              <tbody>
                ${paginatedUsers.map(user => {
      // Вычисляем данные для новых колонок
      const partnerProfile = user.partner;
      const totalEarnings = partnerProfile?.totalEarnings || 0;
      const withdrawnEarnings = partnerProfile?.withdrawnEarnings || 0;
      const pendingEarnings = totalEarnings - withdrawnEarnings;

      // Подсчет партнеров по уровням
      const level1Partners = user.directPartners || 0;
      const level2Partners = user.level2Partners || 0;
      const level3Partners = user.level3Partners || 0;

      const isPartnerActive = partnerProfile?.isActive || false;

      return `
                  <tr>
                    <td class="compact-cell">
                      <input type="checkbox" class="user-checkbox" value="${user.id}" data-user-id="${user.id}" style="margin-right: 5px;">
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Партнерская программа: ${partnerProfile?.isSuperPartner ? 'Супер партнёр' : (isPartnerActive ? 'Партнёр' : 'Не активирована')}">
<div style="cursor:pointer;" onclick="openPartnerManager('${user.id}', ${isPartnerActive}, '${user.partner?.expiresAt || ''}')">
                             ${partnerProfile?.isSuperPartner
          ? '<span style="font-weight:bold; color:#d4a017; background:#fff8e1; padding:2px 8px; border-radius:8px; font-size:11px;">⭐ Супер партнёр</span>'
          : (isPartnerActive
            ? '<span style="font-weight:bold; color:#28a745; background:#e8f5e9; padding:2px 8px; border-radius:8px; font-size:11px;">Партнёр</span>'
            : '<span style="font-weight:bold; color:#dc3545; font-size:11px;">Неактивен</span>')}
                             <span style="font-size:12px; margin-left:4px;">⚙️</span>
                             ${user.partner?.expiresAt ? `<div style="font-size:10px; color:#666;">до ${new Date(user.partner.expiresAt).toLocaleDateString()}</div>` : ''}
                           </div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Баланс: ${user.balance.toFixed(2)} PZ${user.bonus > 0 ? ', Бонусы: ' + user.bonus.toFixed(2) + ' PZ' : ''}">
                      <div class="balance ${user.balance > 0 ? 'positive' : 'zero'}">
                        ${user.balance.toFixed(2)} PZ
                      </div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Заказы: ${user.orders?.length || 0} шт., Сумма: ${user.totalOrderSum.toFixed(2)} PZ">
                      <button class="orders-sum-btn" onclick="if(typeof showUserOrders === 'function') { showUserOrders('${user.id}', '${user.firstName || 'Пользователь'}'); } else { console.error('showUserOrders not defined'); window.open('/admin/users/${user.id}/orders', '_blank', 'width=1000,height=700'); }" style="background: none; border: none; cursor: pointer; padding: 0; width: 100%; text-align: left;">
                        <div class="orders-sum">${user.totalOrderSum.toFixed(2)} PZ</div>
                        <div class="orders-count status-${user.priorityStatus}" data-status="${user.priorityStatus}">
                          ${user.orders?.length || 0} шт
                          ${user.priorityStatus === 'new' ? ' 🔴' : ''}
                          ${user.priorityStatus === 'processing' ? ' 🟡' : ''}
                          ${user.priorityStatus === 'completed' ? ' 🟢' : ''}
                          ${user.priorityStatus === 'cancelled' ? ' ⚫' : ''}
                        </div>
                      </button>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Пригласитель: ${user.inviter ? '@' + (user.inviter.username || user.inviter.firstName || 'неизвестно') : 'Не указан'}">
                      <div style="font-size: 10px; color: #6c757d;">
                        ${user.inviter ? `@${(user.inviter.username || user.inviter.firstName || 'неизвестно').substring(0, 12)}${(user.inviter.username || user.inviter.firstName || '').length > 12 ? '...' : ''}` : '—'}
                      </div>
                    </td>
                    <td class="user-cell">
                      <div class="user-info">
                        <div class="user-avatar">${(user.firstName || 'U')[0].toUpperCase()}</div>
                        <div class="user-details">
                          <h4><a href="javascript:void(0)" onclick="if(typeof showUserDetails === 'function') { showUserDetails('${user.id}'); } else { console.error('showUserDetails not defined'); window.open('/admin/users/${user.id}', '_blank', 'width=600,height=400'); }" class="user-name-link" style="cursor: pointer; color: #007bff; text-decoration: none;" title="${user.firstName || 'Без имени'} ${user.lastName || ''}">${(user.firstName || 'Без имени').substring(0, 8)}${(user.firstName || '').length > 8 ? '...' : ''}</a></h4>
                          <p title="@${user.username || 'без username'}">@${(user.username || 'без username').substring(0, 10)}${(user.username || '').length > 10 ? '...' : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Партнеры 1-го уровня: ${level1Partners}">
                      <div class="partners-count clickable-partners" style="display: inline-block; cursor: pointer;" onclick="showPartnersList('${user.id}', '${user.firstName || 'Пользователь'}', 1)">${level1Partners}</div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Партнеры 2-го уровня: ${level2Partners}">
                      <div class="partners-count clickable-partners" style="display: inline-block; cursor: pointer;" onclick="showPartnersList('${user.id}', '${user.firstName || 'Пользователь'}', 2)">${level2Partners}</div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Партнеры 3-го уровня: ${level3Partners}">
                      <div class="partners-count clickable-partners" style="display: inline-block; cursor: pointer;" onclick="showPartnersList('${user.id}', '${user.firstName || 'Пользователь'}', 3)">${level3Partners}</div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Покупки (сумма): ${user.totalOrderSum.toFixed(2)} PZ">
                      <div class="orders-sum">${user.totalOrderSum.toFixed(2)} PZ</div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Вознаграждение (общая сумма): ${totalEarnings.toFixed(2)} PZ">
                      <div class="orders-sum" style="color: #28a745;">${totalEarnings.toFixed(2)} PZ</div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Выплаты: ${withdrawnEarnings.toFixed(2)} PZ">
                      <div class="orders-sum" style="color: #007bff;">${withdrawnEarnings.toFixed(2)} PZ</div>
                    </td>
                    <td class="compact-cell cell-tooltip" data-tooltip="Осталось выплатить: ${pendingEarnings.toFixed(2)} PZ">
                      <div class="orders-sum" style="color: ${pendingEarnings > 0 ? '#ffc107' : '#6c757d'};">${pendingEarnings.toFixed(2)} PZ</div>
                    </td>
                    <td class="actions-cell">
                      <button class="action-btn hierarchy" onclick="if(typeof showHierarchy === 'function') { showHierarchy('${user.id}'); } else { console.error('showHierarchy not defined'); window.open('/admin/partners-hierarchy?user=${user.id}', '_blank', 'width=800,height=600'); }" title="Иерархия партнеров">
                        🌳
                      </button>
                      <button class="action-btn" onclick="if(typeof showUserDetails === 'function') { showUserDetails('${user.id}'); } else { console.error('showUserDetails not defined'); window.open('/admin/users/${user.id}', '_blank', 'width=600,height=400'); }" title="Подробная информация">
                        👁
                      </button>
                      <button class="action-btn" onclick="openChangeInviter('${user.id}', ${JSON.stringify((user.firstName || 'Без имени') + ' ' + (user.lastName || ''))})" title="Сменить пригласителя">
                        🔄
                      </button>
                      <button class="action-btn delete-user-btn" onclick="deleteSelectedUser('${user.id}', ${JSON.stringify(user.firstName || 'Пользователь')})" title="Удалить пользователя" style="background: #dc3545; color: white;">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;
    }).join('')}
              </tbody>
            </table>
            </div>
          `}
          
          <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin: 20px 0; flex-wrap: wrap;">
            ${currentPage > 1 ? `
              <a href="/admin/users-detailed?page=${currentPage - 1}&sort=${sortBy}&order=${sortOrder}${search ? '&search=' + encodeURIComponent(search) : ''}${filter ? '&filter=' + filter : ''}" 
                 class="btn" style="background:#fff; color:#111827; border: 1px solid #d1d5db; font-size: 14px;">← Назад</a>
            ` : ''}
            <span style="font-size: 14px; font-weight: 700; color: #374151;">Стр. ${currentPage} из ${totalPages}</span>
            <span style="font-size: 12px; color: #6b7280;">(${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, totalUsers)} из ${totalUsers})</span>
            ${currentPage < totalPages ? `
              <a href="/admin/users-detailed?page=${currentPage + 1}&sort=${sortBy}&order=${sortOrder}${search ? '&search=' + encodeURIComponent(search) : ''}${filter ? '&filter=' + filter : ''}" 
                 class="btn" style="font-size: 14px;">Далее →</a>
            ` : ''}
          </div>

          <div style="padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <a href="/admin" class="back-btn">← Назад в админ-панель</a>
          </div>
        </div>
        
        <script>
          // Все основные функции уже определены в начале документа в IIFE
          // Здесь только дополнительные функции, которые не были определены выше
          
          // Функция для показа списка партнеров
          window.showPartnersList = async function(userId, userName, level) {
            try {
              const response = await fetch('/admin/users/' + userId + '/partners?level=' + level, {
                credentials: 'include'
              });
              
              if (!response.ok) {
                throw new Error('Ошибка загрузки партнеров');
              }
              
              const partners = await response.json();
              
              // Создаем модальное окно для списка партнеров
              const modal = document.createElement('div');
              modal.id = 'partnersModal';
              modal.innerHTML = 
                '<div class="modal-overlay" onclick="closePartnersModal()" style="display: flex;">' +
                  '<div class="modal-content" onclick="event.stopPropagation()">' +
                    '<div class="modal-header">' +
                      '<h2>👥 Партнеры ' + level + '-го уровня пользователя ' + userName + '</h2>' +
                      '<span class="modal-close" onclick="closePartnersModal()">&times;</span>' +
                    '</div>' +
                    '<div class="modal-body">' +
                      (partners.length === 0 ? 
                        '<p>У этого пользователя нет партнеров данного уровня</p>' :
                        partners.map(partner => 
                          '<div class="partners-list-item">' +
                            '<div class="user-avatar">' + (partner.firstName || 'U')[0].toUpperCase() + '</div>' +
                            '<div>' +
                              '<strong>' + (partner.firstName || 'Без имени') + ' ' + (partner.lastName || '') + '</strong>' +
                              '<br>' +
                              '<small>@' + (partner.username || 'без username') + '</small>' +
                            '</div>' +
                          '</div>'
                        ).join('')
                      ) +
                    '</div>' +
                  '</div>' +
                '</div>';
              
              (document.querySelector('.admin-shell') || document.body).appendChild(modal);
              
            } catch (error) {
              console.error('Error loading partners:', error);
              alert('Ошибка загрузки списка партнеров');
            }
          };
          
          window.closePartnersModal = function() {
            const modal = document.getElementById('partnersModal');
            if (modal) {
              modal.remove();
            }
          };
          
          // Partner Program Manager
          window.openPartnerManager = function(userId, isActive, expiresAtStr) {
            const existingModal = document.getElementById('partnerManagerModal');
            if (existingModal) existingModal.remove();

            const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
            const formattedExpires = expiresAt ? expiresAt.toLocaleDateString() : 'Не установлено';

            const modal = document.createElement('div');
            modal.id = 'partnerManagerModal';
            modal.innerHTML = \`
              <div class="modal-overlay" onclick="closePartnerManager()" style="display: flex;">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
                  <div class="modal-header">
                    <h2>⚙️ Управление партнеркой</h2>
                    <span class="close" onclick="closePartnerManager()">&times;</span>
                  </div>
                  <div class="modal-body">
                    <div class="form-group" style="margin-bottom: 20px;">
                      <label style="font-weight:bold; display:block; margin-bottom:8px;">Статус</label>
                      <label class="switch">
                        <input type="checkbox" id="partnerActiveSwitch" \${isActive ? 'checked' : ''}>
                        <span class="slider round"></span>
                      </label>
                      <span id="partnerStatusLabel" style="margin-left: 10px; font-weight:bold; color:\${isActive ? '#28a745' : '#6c757d'}">
                        \${isActive ? 'Активен' : 'Неактивен'}
                      </span>
                    </div>

                    <div id="partnerDurationSection" style="display: \${isActive ? 'block' : 'none'}; opacity: \${isActive ? '1' : '0.5'}; transition: opacity 0.3s;">
                      <div class="form-group">
                        <label style="font-weight:bold; display:block; margin-bottom:8px;">Текущий срок действия:</label>
                        <div style="padding: 10px; background: #f8f9fa; border-radius: 4px; border: 1px solid #dee2e6;">
                          \${formattedExpires}
                        </div>
                      </div>

                      <div class="form-group" style="margin-top: 15px;">
                        <label style="font-weight:bold; display:block; margin-bottom:8px;">Продлить/Установить срок:</label>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
                          <button type="button" class="btn-duration" onclick="selectDuration(1, this)" style="padding: 6px 12px; border: 1px solid #ced4da; background: white; border-radius: 4px; cursor: pointer;">1 Месяц</button>
                          <button type="button" class="btn-duration" onclick="selectDuration(2, this)" style="padding: 6px 12px; border: 1px solid #ced4da; background: white; border-radius: 4px; cursor: pointer;">2 Месяца</button>
                          <button type="button" class="btn-duration" onclick="selectDuration(3, this)" style="padding: 6px 12px; border: 1px solid #ced4da; background: white; border-radius: 4px; cursor: pointer;">3 Месяца</button>
                          <button type="button" class="btn-duration" onclick="selectDuration(6, this)" style="padding: 6px 12px; border: 1px solid #ced4da; background: white; border-radius: 4px; cursor: pointer;">6 Месяцев</button>
                          <button type="button" class="btn-duration" onclick="selectDuration(12, this)" style="padding: 6px 12px; border: 1px solid #ced4da; background: white; border-radius: 4px; cursor: pointer;">1 Год</button>
                        </div>
                        
                        <div style="margin-top: 10px;">
                          <label style="display:block; font-size: 13px; color: #666; margin-bottom: 4px;">Или укажите дату окончания:</label>
                          <input type="date" id="partnerCustomDate" style="padding: 8px; border: 1px solid #ced4da; border-radius: 4px; width: 100%;">
                        </div>

                        <input type="hidden" id="selectedMonths" value="">
                      </div>
                    </div>
                  </div>
                  <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
                    <button onclick="closePartnerManager()" style="padding: 8px 16px; border: 1px solid #ced4da; background: white; border-radius: 4px; cursor: pointer;">Отмена</button>
                    <button onclick="savePartnerProgram('\${userId}')" style="padding: 8px 16px; border: none; background: #007bff; color: white; border-radius: 4px; cursor: pointer;">Сохранить</button>
                  </div>
                </div>
              </div>
            \`;
            
            document.querySelector('.admin-shell').appendChild(modal);

            // Event listeners
            const switchEl = document.getElementById('partnerActiveSwitch');
            const sectionEl = document.getElementById('partnerDurationSection');
            const statusLabel = document.getElementById('partnerStatusLabel');
            
            if (switchEl) {
              switchEl.addEventListener('change', function() {
                const isActive = this.checked;
                sectionEl.style.display = 'block';
                sectionEl.style.opacity = isActive ? '1' : '0.5';
                statusLabel.textContent = isActive ? 'Активен' : 'Неактивен';
                statusLabel.style.color = isActive ? '#28a745' : '#6c757d';
              });
            }

            // Duration selection helper
            window.selectDuration = function(months, btn) {
              const buttons = document.querySelectorAll('.btn-duration');
              for(let i=0; i<buttons.length; i++) {
                  buttons[i].style.background = 'white';
                  buttons[i].style.color = 'black';
                  buttons[i].style.borderColor = '#ced4da';
              }
              
              // btn is passed explicitly from onclick
              if (btn) {
                btn.style.background = '#007bff';
                btn.style.color = 'white';
                btn.style.borderColor = '#007bff';
              }
              
              document.getElementById('selectedMonths').value = months;
              document.getElementById('partnerCustomDate').value = ''; 
            };

            const dateInput = document.getElementById('partnerCustomDate');
            if (dateInput) {
              dateInput.addEventListener('change', function() {
                 document.getElementById('selectedMonths').value = '';
                 const buttons = document.querySelectorAll('.btn-duration');
                 for(let i=0; i<buttons.length; i++) {
                    buttons[i].style.background = 'white';
                    buttons[i].style.color = 'black';
                    buttons[i].style.borderColor = '#ced4da';
                 }
              });
            }
          };

          window.closePartnerManager = function() {
            const modal = document.getElementById('partnerManagerModal');
            if (modal) modal.remove();
          };

          window.savePartnerProgram = async function(userId) {
            const isActive = document.getElementById('partnerActiveSwitch').checked;
            const months = document.getElementById('selectedMonths').value;
            const date = document.getElementById('partnerCustomDate').value;

            try {
              const response = await fetch('/admin/users/' + userId + '/update-partner-program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive, months, date })
              });

              const result = await response.json();
              if (result.success) {
                const notification = document.createElement('div');
                notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 12px 20px; border-radius: 4px; z-index: 10000; box-shadow: 0 2px 8px rgba(0,0,0,0.2);';
                notification.textContent = '✅ Партнерская программа обновлена';
                document.body.appendChild(notification);
                
                setTimeout(() => {
                  window.location.reload(); 
                }, 1000);
                closePartnerManager();
              } else {
                alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
              }
            } catch (e) {
              console.error(e);
              alert('Ошибка сохранения: ' + e.message);
            }
          };
          
          // Функция для открытия модального окна отправки сообщений
          window.openMessageModal = function() {
            const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
            if (selectedCheckboxes.length === 0) {
              alert('Выберите пользователей для отправки сообщения');
              return;
            }
            
            const selectedUserIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            
            const modal = document.createElement('div');
            modal.id = 'messageModal';
            modal.innerHTML = 
              '<div class="modal-overlay" onclick="closeMessageModal()" style="display: flex;">' +
                '<div class="modal-content" onclick="event.stopPropagation()">' +
                  '<div class="modal-header">' +
                    '<h2>📧 Отправить сообщение</h2>' +
                    '<span class="modal-close" onclick="closeMessageModal()">&times;</span>' +
                  '</div>' +
                  '<div class="modal-body">' +
                    '<div class="message-form-group">' +
                      '<label>Выбранные пользователи (' + selectedUserIds.length + '):</label>' +
                      '<div class="selected-users-list">' +
                        selectedUserIds.map(id => {
                          const checkbox = document.querySelector('input[value="' + id + '"]');
                          const row = checkbox?.closest('tr');
                          const nameCell = row?.querySelector('.user-details h4 a');
                          const name = nameCell?.textContent || 'Пользователь';
                          return '<span class="selected-user-tag">' + name + '</span>';
                        }).join('') +
                      '</div>' +
                    '</div>' +
                    '<div class="message-form-group">' +
                      '<label for="messageSubject">Тема сообщения:</label>' +
                      '<input type="text" id="messageSubject" placeholder="Введите тему сообщения" maxlength="100">' +
                    '</div>' +
                    '<div class="message-form-group">' +
                      '<label for="messageText">Текст сообщения:</label>' +
                      '<textarea id="messageText" placeholder="Введите текст сообщения" rows="5" maxlength="1000"></textarea>' +
                      '<div class="char-count">' +
                        '<span id="charCount">0</span>/1000 символов' +
                      '</div>' +
                    '</div>' +
                    '<div class="message-form-group">' +
                      '<label>' +
                        '<input type="checkbox" id="saveAsTemplate">' +
                        'Сохранить как шаблон' +
                      '</label>' +
                    '</div>' +
                    '<div class="message-error" id="messageError" style="display: none;"></div>' +
                  '</div>' +
                  '<div class="modal-footer">' +
                    '<button class="btn btn-secondary" onclick="closeMessageModal()">Отмена</button>' +
                    '<button class="btn btn-primary" onclick="sendMessage()">Отправить</button>' +
                  '</div>' +
                '</div>' +
              '</div>';
            
            (document.querySelector('.admin-shell') || document.body).appendChild(modal);
            
            // Добавляем счетчик символов
            const textarea = document.getElementById('messageText');
            const charCount = document.getElementById('charCount');
            
            textarea.addEventListener('input', function() {
              charCount.textContent = this.value.length;
            });
          };
          
          window.closeMessageModal = function() {
            const modal = document.getElementById('messageModal');
            if (modal) {
              modal.remove();
            }
          };
          
          window.sendMessage = async function() {
            const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
            const selectedUserIds = Array.from(selectedCheckboxes).map(cb => cb.value);
            const subject = document.getElementById('messageSubject').value.trim();
            const text = document.getElementById('messageText').value.trim();
            const saveAsTemplate = document.getElementById('saveAsTemplate').checked;
            const errorDiv = document.getElementById('messageError');
            
            // Валидация
            if (!subject) {
              showMessageError('Введите тему сообщения');
              return;
            }
            
            if (!text) {
              showMessageError('Введите текст сообщения');
              return;
            }
            
            if (selectedUserIds.length === 0) {
              showMessageError('Выберите получателей');
              return;
            }
            
            try {
              errorDiv.style.display = 'none';
              
              const response = await fetch('/admin/messages/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  userIds: selectedUserIds,
                  subject: subject,
                  text: text,
                  saveAsTemplate: saveAsTemplate
                })
              });
              
              if (!response.ok) {
                throw new Error('Ошибка отправки сообщения');
              }
              
              const result = await response.json();
              alert('Сообщение отправлено ' + result.successCount + ' пользователям');
              closeMessageModal();
              
            } catch (error) {
              console.error('Error sending message:', error);
              showMessageError('Ошибка отправки сообщения: ' + error.message);
            }
          };
          
          window.showMessageError = function(message) {
            const errorDiv = document.getElementById('messageError');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
          };
          
          function applySorting() {
            const sortBy = document.getElementById('sortSelect').value;
            const order = document.getElementById('orderSelect').value;
            window.location.href = '/admin/users-detailed?sort=' + sortBy + '&order=' + order;
          }
          function applyFilter(filter){
            const url = new URL(window.location.href);
            const sortBy = document.getElementById('sortSelect') ? document.getElementById('sortSelect').value : url.searchParams.get('sort') || 'orders';
            const order = document.getElementById('orderSelect') ? document.getElementById('orderSelect').value : url.searchParams.get('order') || 'desc';
            if(filter === 'all') url.searchParams.delete('filter'); else url.searchParams.set('filter', filter);
            url.searchParams.set('sort', sortBy);
            url.searchParams.set('order', order);
            window.location.href = url.pathname + '?' + url.searchParams.toString();
          }
          function searchByUsername(){
            var q = document.getElementById('searchUsername').value.trim();
            if(!q) return;
            if(q.startsWith('@')) q = q.slice(1);
            window.location.href = '/admin/users-detailed?search=' + encodeURIComponent(q);
          }
          (function(){
            var typingTimer; var inputEl = document.getElementById('searchUsername'); var box = document.getElementById('searchSuggestions');
            function hide(){ box.style.display='none'; box.innerHTML=''; }
            inputEl.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); searchByUsername(); hide(); }});
            inputEl.addEventListener('input', function(){
              clearTimeout(typingTimer);
              var val = inputEl.value.trim();
              if(val.startsWith('@')) val = val.slice(1);
              if(!val){ hide(); return; }
              typingTimer = setTimeout(async function(){
                try{
                  const resp = await fetch('/admin/users/search?q=' + encodeURIComponent(val), { credentials:'include' });
                  const data = await resp.json();
                  if(!Array.isArray(data) || data.length===0){ hide(); return; }
                  box.innerHTML = data.map(u => '<div class="list-item" style="padding:6px 10px; cursor:pointer; border-bottom:1px solid #f3f4f6">' +
                    (u.username ? '@'+u.username : (u.firstName||'')) +
                    '</div>').join('');
                  Array.from(box.children).forEach((el, idx)=>{
                    el.addEventListener('click', function(){
                      var uname = data[idx].username || '';
                      if(uname){ window.location.href = '/admin/users-detailed?search=' + encodeURIComponent(uname); }
                      hide();
                    });
                  });
                  box.style.display = 'block';
                }catch(e){ hide(); }
              }, 250);
            });
            document.addEventListener('click', function(e){ if(!box.contains(e.target) && e.target !== inputEl){ hide(); } });
          })();
          
          window.openChangeInviter = async function(userId, userName) {
            const modal = document.createElement('div');
            modal.id = 'inviterModal';
            modal.innerHTML =
              '<div class="modal-overlay" id="inviterOverlay" style="display: flex;">' +
                '<div class="modal-content" id="inviterContent" style="max-width:560px; border-radius:12px; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,.2)">' +
                  '<div class="modal-header" style="background:linear-gradient(135deg,#667eea,#764ba2); color:#fff; padding:16px 20px; display:flex; align-items:center; justify-content:space-between">' +
                    '<h2 style="margin:0; font-size:18px; font-weight:600">🔄 Смена пригласителя</h2>' +
                    '<button class="close-btn" id="inviterClose" style="background:transparent; border:none; color:#fff; font-size:22px; cursor:pointer">&times;</button>' +
                  '</div>' +
                  '<div class="modal-body" style="padding:16px 20px; background:#fff">' +
                    '<div style="margin-bottom:8px; color:#6b7280">Пользователь:</div>' +
                    '<div style="font-weight:600; margin-bottom:12px">' + userName + '</div>' +
                    '<div class="form-group" style="margin-bottom:10px; position:relative">' +
                      '<label style="display:block; font-weight:600; margin-bottom:6px">Поиск по @username или коду</label>' +
                      '<input type="text" id="inviterSearch" placeholder="@username или код" autocomplete="off" style="width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px" />' +
                      '<div id="inviterResults" style="position:absolute; top:72px; left:0; right:0; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:6px; display:none; max-height:220px; overflow:auto; z-index:10"></div>' +
                    '</div>' +
                    '<div class="form-group" style="margin-top:10px">' +
                      '<label style="display:block; font-weight:600; margin-bottom:6px">Или введите код вручную</label>' +
                      '<input type="text" id="inviterCodeManual" placeholder="Код пригласителя" style="width:260px; padding:10px 12px; border:1px solid #e5e7eb; border-radius:8px" />' +
                    '</div>' +
                    '<div id="inviterError" style="margin-top:8px; color:#b91c1c; display:none"></div>' +
                  '</div>' +
                  '<div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end; padding:12px 20px; background:#f9fafb">' +
                    '<button class="btn" id="inviterCancel" style="background:#6c757d; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer">Отмена</button>' +
                    '<button class="btn" id="inviterApplyBtn" style="background:#10b981; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer" disabled>Применить</button>' +
                  '</div>' +
                '</div>' +
              '</div>';
            (document.querySelector('.admin-shell') || document.body).appendChild(modal);

            const searchInput = document.getElementById('inviterSearch');
            const resultsEl = document.getElementById('inviterResults');
            const codeInput = document.getElementById('inviterCodeManual');
            const applyBtn = document.getElementById('inviterApplyBtn');
            const closeBtn = document.getElementById('inviterClose');
            const cancelBtn = document.getElementById('inviterCancel');
            const overlay = document.getElementById('inviterOverlay');

            function closeModal(){
              const el = document.getElementById('inviterModal');
              if (el && el.parentNode) el.parentNode.removeChild(el);
            }
            if (closeBtn) closeBtn.addEventListener('click', closeModal);
            if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
            if (overlay) overlay.addEventListener('click', function(e){ if (e.target === overlay) closeModal(); });

            let selected = null; // {username, referralCode}
            let typingTimer;
            function setError(msg){
              var e = document.getElementById('inviterError');
              e.textContent = msg || '';
              e.style.display = msg ? 'block' : 'none';
            }
            function validate(){
              var typed = (codeInput.value || searchInput.value).trim();
              var ok = (selected && selected.username) || typed.length > 0;
              applyBtn.disabled = !ok;
            }
            searchInput.addEventListener('input', validate);
            codeInput.addEventListener('input', validate);

            function renderResults(items){
              if (!items || items.length === 0){
                resultsEl.style.display = 'none';
                resultsEl.innerHTML = '';
                return;
              }
              resultsEl.style.display = 'block';
              resultsEl.innerHTML = items.map(function(i){
                const uname = i.username ? '@' + i.username : '';
                const name = ((i.firstName || '') + ' ' + (i.lastName || '')).trim();
                return '<div class="list-item" style="cursor:pointer; padding:6px; border-bottom:1px solid #eee" data-username="' + (i.username || '') + '" data-code="' + i.referralCode + '">' +
                  '<div class="list-info"><div class="list-name">' + (uname || name || 'Без имени') + '</div>' +
                  '<div class="list-time">код: ' + i.referralCode + '</div></div></div>';
              }).join('');
              Array.prototype.slice.call(resultsEl.querySelectorAll('[data-username]')).forEach(function(el){
                el.addEventListener('click', function(){
                  selected = { username: el.getAttribute('data-username'), code: el.getAttribute('data-code') };
                  searchInput.value = selected.username ? '@' + selected.username : selected.code;
                  codeInput.value = '';
                  resultsEl.style.display = 'none';
                });
              });
            }
            searchInput.addEventListener('input', function(){
              clearTimeout(typingTimer);
              const q = searchInput.value.trim();
              if (!q){ renderResults([]); return; }
              typingTimer = setTimeout(async function(){
                try{
                  const resp = await fetch('/admin/inviters/search?q=' + encodeURIComponent(q), { credentials: 'include' });
                  const data = await resp.json();
                  renderResults(data);
                }catch(e){ renderResults([]); }
              }, 300);
            });
            applyBtn.addEventListener('click', async function(){
              var typed = (codeInput.value || searchInput.value).trim();
              var payload = {};
              if (selected && selected.username) {
                payload = { inviterUsername: selected.username };
              } else if (typed) {
                if (typed.startsWith('@')) payload = { inviterUsername: typed.replace(/^@/, '') };
                else payload = { newInviterCode: typed };
              }
              if (!('inviterUsername' in payload) && !('newInviterCode' in payload)) { setError('Укажите пригласителя'); return; }
              try{
                const resp = await fetch('/admin/users/' + userId + '/change-inviter', {
                  method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, credentials: 'include', body: JSON.stringify(payload)
                });
                if (resp.ok){ alert('Пригласитель изменен'); location.reload(); return; }
                let data = null; try { data = await resp.json(); } catch(e) {}
                setError('Не удалось изменить пригласителя' + (data && data.error ? (' — ' + data.error) : ''));
              }catch(e){ setError('Ошибка сети'); }
            });
          }
        </script>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ Detailed users page error:', error);
    res.status(500).send('Ошибка загрузки страницы пользователей');
  }
});

// Lightweight username prefix search for suggestions
// Username prefix search (router mounted at /admin → final path /admin/users/search)
router.get('/users/search', requireAdmin, async (req, res) => {
  try {
    const q = String((req.query.q as string) || '').trim().replace(/^@/, '');
    if (!q) return res.json([]);
    const users = await prisma.user.findMany({
      where: { username: { startsWith: q } },
      select: { id: true, username: true, firstName: true },
      take: 10,
      orderBy: { username: 'asc' }
    });
    res.json(users);
  } catch (e) {
    res.json([]);
  }
});

// Inviter search (username or referral code) for modal suggestions
router.get('/inviters/search', requireAdmin, async (req, res) => {
  try {
    const q = String((req.query.q as string) || '').trim();
    if (!q) return res.json([]);
    if (q.startsWith('@')) {
      const uname = q.replace(/^@/, '');
      const users = await prisma.user.findMany({
        where: { username: { startsWith: uname } },
        take: 10,
        select: { id: true, username: true, firstName: true }
      });
      // attach referral codes when exist
      const profiles = await prisma.partnerProfile.findMany({
        where: { userId: { in: users.map(u => u.id) } },
        select: { userId: true, referralCode: true }
      });
      const map = new Map(profiles.map(p => [p.userId, p.referralCode]));
      return res.json(users.map(u => ({ username: u.username, firstName: u.firstName, referralCode: map.get(u.id) || '' })));
    }
    // treat as referral code prefix search
    const partners = await prisma.partnerProfile.findMany({
      where: { referralCode: { startsWith: q } },
      take: 10,
      include: { user: true }
    });
    return res.json(partners.map(p => ({ username: p.user?.username || '', firstName: p.user?.firstName || '', referralCode: p.referralCode })));
  } catch {
    return res.json([]);
  }
});
// Send messages to users
router.post('/send-messages', requireAdmin, async (req, res) => {
  try {
    const { userIds, type, subject, text, includeButtons, button1, button2 } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Не выбраны получатели' });
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Не указан текст сообщения' });
    }

    // Get bot instance for real message sending
    const { getBotInstance } = await import('../lib/bot-instance.js');
    const bot = await getBotInstance();

    let sentCount = 0;
    let errors = [];

    // Send messages to each user
    for (const userId of userIds) {
      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          errors.push(`Пользователь ${userId} не найден`);
          continue;
        }

        // Build message text
        let messageText = '';
        if (subject) {
          messageText += `📢 **${subject}**\n\n`;
        }
        messageText += text;

        // Add type indicator
        const typeEmojiMap: { [key: string]: string } = {
          'text': '💬',
          'notification': '🔔',
          'promotion': '🎉',
          'system': '⚙️'
        };
        const typeEmoji = typeEmojiMap[type] || '💬';

        messageText = `${typeEmoji} ${messageText}`;

        // Send message via Telegram bot
        try {
          // Экранируем Markdown символы
          const escapeMarkdown = (text: string) => {
            return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
          };

          const escapedMessageText = escapeMarkdown(messageText);

          try {
            await bot.telegram.sendMessage(user.telegramId, escapedMessageText, {
              parse_mode: 'Markdown'
            });
          } catch (markdownError) {
            console.log(`⚠️ Markdown отправка не удалась, пробуем без Markdown: ${markdownError instanceof Error ? markdownError.message : String(markdownError)}`);
            // Если Markdown не работает, отправляем без форматирования
            await bot.telegram.sendMessage(user.telegramId, messageText);
          }

          // Add buttons if requested
          if (includeButtons && (button1.text || button2.text)) {
            const buttons = [];
            if (button1.text) {
              buttons.push([{ text: button1.text, url: button1.url }]);
            }
            if (button2.text) {
              buttons.push([{ text: button2.text, url: button2.url }]);
            }

            if (buttons.length > 0) {
              await bot.telegram.sendMessage(user.telegramId, '👇 Выберите действие:', {
                reply_markup: { inline_keyboard: buttons }
              });
            }
          }

          console.log(`✅ Message sent to user ${user.firstName} (${user.id})`);

        } catch (telegramError) {
          console.error(`❌ Telegram error for user ${user.id}:`, telegramError);
          const telegramErrorMessage = telegramError instanceof Error ? telegramError.message : String(telegramError);
          errors.push(`Ошибка Telegram для ${user.firstName}: ${telegramErrorMessage}`);
          continue;
        }

        // Log successful message
        await prisma.userHistory.create({
          data: {
            userId: user.id,
            action: 'admin_message_sent',
            payload: {
              type,
              subject,
              messageLength: text.length,
              hasButtons: includeButtons,
              messageText: messageText,
              status: 'sent',
              telegramId: user.telegramId
            }
          }
        });

        sentCount++;

      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Ошибка отправки пользователю ${userId}: ${errorMessage}`);
      }
    }

    res.json({
      success: true,
      sent: sentCount,
      total: userIds.length,
      failed: userIds.length - sentCount,
      errors: errors.length > 0 ? errors : undefined,
      message: sentCount > 0 ?
        `Успешно отправлено ${sentCount} из ${userIds.length} сообщений` :
        'Не удалось отправить ни одного сообщения'
    });

  } catch (error) {
    console.error('Send messages error:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// API: Get categories
router.get('/api/categories', requireAdmin, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, error: 'Ошибка загрузки категорий' });
  }
});

// Test endpoint for dual system bonuses
router.get('/test-dual-system', requireAdmin, async (req, res) => {
  try {
    // Test with a sample order amount
    const testOrderAmount = 100; // 100 PZ
    const testUserId = '0000000000000001a5d56f19'; // Aurelia (direct referral of Roman)

    console.log(`🧪 Testing dual system with order amount: ${testOrderAmount} PZ for user: ${testUserId}`);

    // Call the dual system calculation
    const bonuses = await calculateDualSystemBonuses(testUserId, testOrderAmount);

    res.json({
      success: true,
      message: 'Dual system test completed',
      testData: {
        orderAmount: testOrderAmount,
        userId: testUserId,
        bonuses: bonuses || []
      }
    });
  } catch (error) {
    console.error('❌ Dual system test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API: Create category
router.post('/api/categories', requireAdmin, async (req, res) => {
  try {
    const { name, description, imageUrl, isVisibleInWebapp } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Название категории обязательно' });
    }

    const category = await (prisma as any).category.create({
      data: {
        name: name.trim(),
        slug: name.trim().toLowerCase().replace(/\s+/g, '-'),
        description: description?.trim() || '',
        imageUrl: String(imageUrl || '').trim() || null,
        isVisibleInWebapp: String(isVisibleInWebapp || '').trim() === 'false' ? false : true,
        isActive: true
      }
    });

    res.json({ success: true, category });
  } catch (error: any) {
    console.error('Create category error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Категория с таким названием уже существует' });
    }
    res.status(500).json({ success: false, error: 'Ошибка создания категории' });
  }
});

// API: Update category
router.post('/api/categories/:id/update', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const name = String((req.body && req.body.name) || '').trim();
    const description = String((req.body && req.body.description) || '').trim();
    const imageUrl = String((req.body && req.body.imageUrl) || '').trim();
    const isVisibleRaw = (req.body && req.body.isVisibleInWebapp);
    const isActiveRaw = (req.body && req.body.isActive);
    const isActive = typeof isActiveRaw === 'boolean' ? isActiveRaw : String(isActiveRaw || '').trim();

    if (!id) return res.status(400).json({ success: false, error: 'category_id_required' });
    if (!name) return res.status(400).json({ success: false, error: 'Название категории обязательно' });

    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const data: any = { name, slug, description, imageUrl: imageUrl || null };
    if (typeof isVisibleRaw === 'boolean') data.isVisibleInWebapp = isVisibleRaw;
    if (String(isVisibleRaw) === 'true' || String(isVisibleRaw) === 'false') data.isVisibleInWebapp = (String(isVisibleRaw) === 'true');
    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (isActive === 'true' || isActive === 'false') data.isActive = (isActive === 'true');

    const updated = await (prisma as any).category.update({
      where: { id },
      data
    });

    return res.json({ success: true, category: updated });
  } catch (error: any) {
    console.error('Update category error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: 'Категория с таким названием/slug уже существует' });
    }
    return res.status(500).json({ success: false, error: 'Ошибка обновления категории' });
  }
});

// API: Auto-assign category covers from first product image
router.post('/api/categories/auto-covers', requireAdmin, async (req, res) => {
  try {
    const categories = await (prisma as any).category.findMany({
      where: {
        OR: [
          { imageUrl: null },
          { imageUrl: '' }
        ]
      }
    });
    let updated = 0;
    for (const cat of categories) {
      const product = await prisma.product.findFirst({
        where: { categoryId: cat.id, imageUrl: { not: null } },
        orderBy: { createdAt: 'desc' }
      });
      const url = product?.imageUrl ? String(product.imageUrl).trim() : '';
      if (!url) continue;
      await (prisma as any).category.update({
        where: { id: cat.id },
        data: { imageUrl: url }
      });
      updated += 1;
    }
    return res.json({ success: true, updated });
  } catch (error: any) {
    console.error('Auto covers error:', error);
    return res.status(500).json({ success: false, error: 'Ошибка автообложек' });
  }
});

// API: Delete category (safe: do not allow deleting non-empty categories)
router.post('/api/categories/:id/delete', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'category_id_required' });

    const productsCount = await prisma.product.count({ where: { categoryId: id } });
    if (productsCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Нельзя удалить категорию: в ней есть товары (${productsCount}). Сначала переместите товары в другую категорию.`
      });
    }

    await prisma.category.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({ success: false, error: 'Ошибка удаления категории' });
  }
});

// HTML action: toggle category active (used by /admin/categories page)
router.post('/categories/:id/toggle-active', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.redirect('/admin/categories?error=category_not_found');
    const cat = await prisma.category.findUnique({ where: { id } });
    if (!cat) return res.redirect('/admin/categories?error=category_not_found');
    await prisma.category.update({ where: { id }, data: { isActive: !cat.isActive } });
    return res.redirect('/admin/categories?success=category_updated');
  } catch (error) {
    console.error('Toggle category error:', error);
    return res.redirect('/admin/categories?error=category_update_failed');
  }
});

// API: Move all products to "Косметика" category
router.post('/api/move-all-to-cosmetics', requireAdmin, async (req, res) => {
  try {
    // Find or create "Косметика" category
    let cosmeticsCategory = await prisma.category.findFirst({
      where: {
        OR: [
          { name: 'Косметика' },
          { slug: 'kosmetika' }
        ]
      }
    });

    if (!cosmeticsCategory) {
      cosmeticsCategory = await prisma.category.create({
        data: {
          name: 'Косметика',
          slug: 'kosmetika',
          description: 'Категория косметических товаров',
          isActive: true
        }
      });
      console.log('✅ Создана категория "Косметика"');
    }

    // Get all active products
    const allProducts = await prisma.product.findMany({
      where: { isActive: true }
    });

    // Update all products to use "Косметика" category
    const updateResult = await prisma.product.updateMany({
      where: { isActive: true },
      data: { categoryId: cosmeticsCategory.id }
    });

    console.log(`✅ Перемещено ${updateResult.count} продуктов в категорию "Косметика"`);

    res.json({
      success: true,
      movedCount: updateResult.count,
      categoryName: cosmeticsCategory.name,
      categoryId: cosmeticsCategory.id
    });
  } catch (error: any) {
    console.error('Move all to cosmetics error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка перемещения продуктов' });
  }
});

// API: Create product
router.post('/api/products', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { name, price, categoryId, stock, sku, shortDescription, fullDescription, instruction, active, availableInRussia, availableInBali } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Название товара обязательно' });
    }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ success: false, error: 'Цена должна быть положительным числом' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, error: 'Выберите категорию' });
    }
    if (!shortDescription || !shortDescription.trim()) {
      return res.status(400).json({ success: false, error: 'Краткое описание обязательно' });
    }
    if (!fullDescription || !fullDescription.trim()) {
      return res.status(400).json({ success: false, error: 'Полное описание обязательно' });
    }

    // Regions parsing removed; using fixed switches on client side

    // Check if category exists
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(400).json({ success: false, error: 'Категория не найдена' });
    }

    // Handle image upload (if provided)
    let imageUrl = '';
    if (req.file) {
      try {
        if (!isCloudinaryConfigured()) {
          return res.status(500).json({ success: false, error: 'Cloudinary не настроен. Установите переменные окружения CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET' });
        }

        // Upload to Cloudinary using service
        const result = await uploadImage(req.file.buffer, {
          folder: 'vital/products',
          resourceType: 'image',
        });

        imageUrl = result.secureUrl;
        console.log('✅ Image uploaded successfully:', imageUrl);
      } catch (error: any) {
        console.error('Image upload error:', error);
        return res.status(500).json({ success: false, error: `Ошибка загрузки изображения: ${error.message || 'Неизвестная ошибка'}` });
      }
    }

    const stockNum = Number.parseInt(String(stock ?? ''), 10);
    const finalStock = Number.isFinite(stockNum) ? Math.max(0, stockNum) : 999;

    const cleanSku = String(sku || '').trim();
    const generatedSku = 'MANUAL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
    const finalSku = cleanSku || generatedSku;

    // Create product
    const product = await prisma.product.create({
      data: {
        title: name.trim(),
        summary: shortDescription.trim(),
        description: fullDescription.trim(),
        instruction: instruction?.trim() || null,
        price: parseFloat(price),
        categoryId,
        imageUrl: imageUrl || null,
        stock: finalStock,
        sku: finalSku,
        isActive: active === 'true' || active === true,
        availableInRussia: availableInRussia === 'true' || availableInRussia === true,
        availableInBali: availableInBali === 'true' || availableInBali === true
      }
    });

    res.json({ success: true, product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, error: 'Ошибка создания товара' });
  }
});
// Individual user details page
router.get('/users/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        partner: {
          include: {
            referrals: true,
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }
        },
        orders: {
          orderBy: { createdAt: 'desc' }
        },
        histories: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!user) {
      return res.status(404).send('Пользователь не найден');
    }

    const partnerProfile = (user as any).partner;
    const directPartners = partnerProfile?.referrals?.length || 0;
    const totalOrderSum = (user as any).orders?.reduce((sum: number, order: any) => {
      // Parse itemsJson to calculate total
      try {
        const items = JSON.parse(order.itemsJson || '[]');
        const orderTotal = items.reduce((itemSum: number, item: any) => itemSum + (item.price || 0) * (item.quantity || 1), 0);
        return sum + orderTotal;
      } catch {
        return sum;
      }
    }, 0) || 0;
    const balance = partnerProfile?.balance || 0;
    const bonus = partnerProfile?.bonus || 0;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Детали пользователя - ${user.firstName || 'Без имени'}</title>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 30px; }
          .section { margin-bottom: 30px; }
          .section h3 { margin: 0 0 15px 0; color: #333; font-size: 18px; }
          .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
          .info-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
          .info-card h4 { margin: 0 0 8px 0; color: #495057; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-card p { margin: 0; font-size: 20px; font-weight: bold; color: #212529; }
          .balance { color: #28a745; }
          .balance.zero { color: #6c757d; }
          .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
          .table th { background: #f8f9fa; font-weight: 600; color: #495057; }
          .table tr:hover { background: #f8f9fa; }
          .back-btn { background: #6c757d; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; margin-bottom: 20px; }
          .back-btn:hover { background: #5a6268; }
          .empty-state { text-align: center; padding: 40px; color: #6c757d; }
          .empty-state .add-order-btn {
            margin-top: 15px;
          }
          
          /* Instruction modal styles */
          .instruction-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .instruction-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .instruction-content {
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            transform: scale(0.8);
            transition: transform 0.3s ease;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
          }
          .instruction-header {
            padding: 20px 24px 16px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .instruction-header h3 {
            color: #333;
            font-size: 18px;
            font-weight: 600;
            margin: 0;
          }
          .btn-close {
            background: none;
            border: none;
            color: #6c757d;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.3s ease;
          }
          .btn-close:hover {
            background: #f8f9fa;
            color: #333;
          }
          .instruction-body {
            padding: 20px 24px;
            max-height: 50vh;
            overflow-y: auto;
          }
          .instruction-text {
            color: #333;
            line-height: 1.6;
            font-size: 14px;
            white-space: pre-wrap;
          }
          .instruction-footer {
            padding: 16px 24px 20px;
            border-top: 1px solid #e9ecef;
            display: flex;
            justify-content: flex-end;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .btn-secondary:hover {
            background: #5a6268;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👤 ${user.firstName || 'Без имени'} ${user.lastName || ''}</h1>
            <p>@${user.username || 'без username'} • ID: ${user.id}</p>
          </div>
          
          <div class="content">
            <div class="section">
              <h3>📊 Основная информация</h3>
              <div class="info-grid">
                <div class="info-card">
                  <h4>Баланс</h4>
                  <p class="balance ${balance > 0 ? '' : 'zero'}">${balance.toFixed(2)} PZ</p>
                </div>
                <div class="info-card">
                  <h4>Всего бонусов</h4>
                  <p class="balance ${bonus > 0 ? '' : 'zero'}">${bonus.toFixed(2)} PZ</p>
                </div>
                <div class="info-card">
                  <h4>Прямых партнёров</h4>
                  <p>${directPartners}</p>
                </div>
                <div class="info-card">
                  <h4>Сумма заказов</h4>
                  <p>${totalOrderSum.toFixed(2)} PZ</p>
                </div>
                <div class="info-card">
                  <h4>Дата регистрации</h4>
                  <p>${user.createdAt.toLocaleString('ru-RU')}</p>
                </div>
                <div class="info-card">
                  <h4>Последняя активность</h4>
                  <p>${(user.updatedAt || user.createdAt).toLocaleString('ru-RU')}</p>
                </div>
                <div class="info-card">
                  <h4>Адрес доставки</h4>
                  <p>${(user as any).deliveryAddress || 'Не указан'}</p>
                  ${(user as any).deliveryAddress ? `
                    <button onclick="editDeliveryAddress('${user.id}')" class="btn" style="background: #17a2b8; margin-top: 5px;">✏️ Редактировать</button>
                  ` : `
                    <button onclick="editDeliveryAddress('${user.id}')" class="btn" style="background: #28a745; margin-top: 5px;">➕ Добавить</button>
                  `}
                </div>
              </div>
            </div>

            ${partnerProfile ? `
              <div class="section">
                <h3>🤝 Партнёрская информация (включая 2-й и 3-й уровень)</h3>
                <div class="info-grid">
                  <div class="info-card">
                    <h4>Тип программы</h4>
                    <p>${partnerProfile.programType === 'DIRECT' ? 'Прямая (15%)' : 'Многоуровневая (15%+5%+5%)'}</p>
                  </div>
                  <div class="info-card">
                    <h4>Реферальный код</h4>
                    <p>${partnerProfile.referralCode}</p>
                  </div>
                </div>
              </div>
            ` : ''}

            ${(user as any).orders && (user as any).orders.length > 0 ? `
              <div class="section">
                <h3>🛒 Последние заказы</h3>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Цена</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(user as any).orders.map((order: any) => {
      try {
        const items = JSON.parse(order.itemsJson || '[]');
        const orderTotal = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);
        const itemNames = items.map((item: any) => `${item.name || 'Товар'} (${item.quantity || 1} шт.)`).join(', ');
        return `
                          <tr>
                            <td>${itemNames || 'Заказ'}</td>
                            <td>${orderTotal.toFixed(2)} PZ</td>
                            <td>${order.createdAt.toLocaleString('ru-RU')}</td>
                          </tr>
                        `;
      } catch {
        return `
                          <tr>
                            <td>Заказ #${order.id}</td>
                            <td>0.00 PZ</td>
                            <td>${order.createdAt.toLocaleString('ru-RU')}</td>
                          </tr>
                        `;
      }
    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${partnerProfile?.transactions && partnerProfile.transactions.length > 0 ? `
              <div class="section">
                <h3>💰 Последние транзакции</h3>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Тип</th>
                      <th>Сумма</th>
                      <th>Описание</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${partnerProfile.transactions.map((tx: any) => `
                      <tr>
                        <td>${tx.type === 'CREDIT' ? '➕ Пополнение' : '➖ Списание'}</td>
                        <td class="${tx.type === 'CREDIT' ? 'balance' : ''}">${tx.amount.toFixed(2)} PZ</td>
                        <td>${tx.description}</td>
                        <td>${tx.createdAt.toLocaleString('ru-RU')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${(user as any).histories && (user as any).histories.length > 0 ? `
              <div class="section">
                <h3>📈 Последние действия</h3>
                <table class="table">
                  <thead>
                    <tr>
                      <th>Действие</th>
                      <th>Данные</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(user as any).histories.map((action: any) => {
      function humanizeAction(a: any): string {
        const map: Record<string, string> = {
          'shop:buy': 'Покупка оформлена',
          'shop:add-to-cart': 'Добавлен товар в корзину',
          'shop:product-details': 'Просмотр товара',
          'shop:category': 'Переход в категорию',
          'nav:more': 'Открыт подробный раздел',
          'partner:invite': 'Открыт экран приглашений',
          'partner:dashboard': 'Просмотр кабинета партнёра',
          'partner:level:1': 'Просмотр партнёров 1-го уровня',
          'partner:level:2': 'Просмотр партнёров 2-го уровня',
          'partner:level:3': 'Просмотр партнёров 3-го уровня',
          'cart:add': 'Товар добавлен в корзину',
          'cart:checkout': 'Оформление заказа',
          'admin_message_sent': 'Отправлено сообщение пользователю'
        };
        return map[a.action] || a.action;
      }
      function humanizePayload(a: any): string {
        try {
          if (!a.payload) return '-';
          const p = a.payload;
          if (p.productId) return `Товар: ${p.productId}`;
          if (p.categoryId) return `Категория: ${p.categoryId}`;
          if (p.type === 'text' && p.messageLength) return `Текст ${p.messageLength} симв.`;
          return JSON.stringify(p);
        } catch { return '-'; }
      }
      return `
                      <tr>
                        <td>${humanizeAction(action)}</td>
                        <td>${humanizePayload(action)}</td>
                        <td>${action.createdAt.toLocaleString('ru-RU')}</td>
                      </tr>`;
    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}
          </div>
          
          <div style="padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <a href="/admin/users-detailed" class="back-btn">← Назад к списку</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ User details page error:', error);
    res.status(500).send('Ошибка загрузки деталей пользователя');
  }
});
// Force recalculate all partner bonuses
router.post('/force-recalculate-all-bonuses', requireAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting force recalculation of all partner bonuses...');

    // Get all partner profiles
    const partners = await prisma.partnerProfile.findMany({
      include: { transactions: true }
    });

    console.log(`📊 Found ${partners.length} partner profiles to recalculate`);

    let totalRecalculated = 0;

    for (const partner of partners) {
      console.log(`🔄 Recalculating bonuses for partner ${partner.id}...`);

      // Calculate total from all transactions
      const totalBonus = partner.transactions.reduce((sum, tx) => {
        const amount = tx.type === 'CREDIT' ? tx.amount : -tx.amount;
        console.log(`  - Transaction: ${tx.type} ${tx.amount} PZ (${tx.description})`);
        return sum + amount;
      }, 0);

      console.log(`💰 Calculated total bonus for partner ${partner.id}: ${totalBonus} PZ`);

      // Update both balance and bonus fields
      await prisma.partnerProfile.update({
        where: { id: partner.id },
        data: {
          balance: totalBonus,
          bonus: totalBonus
        }
      });

      totalRecalculated += totalBonus;
      console.log(`✅ Updated partner ${partner.id}: balance = ${totalBonus} PZ, bonus = ${totalBonus} PZ`);
    }

    console.log(`🎉 Force recalculation completed! Total recalculated: ${totalRecalculated} PZ`);
    res.redirect('/admin?success=all_bonuses_recalculated&total=' + totalRecalculated);
  } catch (error) {
    console.error('❌ Force recalculate all bonuses error:', error);
    res.redirect('/admin?error=bonus_recalculation');
  }
});

router.get('/categories', requireAdmin, async (req, res) => {
  try {
    console.log('📁 Admin categories page accessed');
    const categoriesRaw = await prisma.category.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const categories = await Promise.all(categoriesRaw.map(async (c) => {
      const productsCount = await prisma.product.count({ where: { categoryId: c.id } });
      return { ...c, productsCount };
    }));
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Управление категориями</title>
        <meta charset="utf-8">
        <style>
          ${ADMIN_UI_CSS}
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--admin-bg); }
          .page-actions{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom: 14px; }
          .page-actions .btn{ height: 40px; border-radius: 14px; font-weight: 800; }
          .alert { padding: 12px 14px; margin: 10px 0; border-radius: 16px; border: 1px solid var(--admin-border); background: #fff; }
          .alert-success { border-color: rgba(34,197,94,0.25); background: rgba(34,197,94,0.08); color: #166534; }
          .alert-error { border-color: rgba(220,38,38,0.25); background: rgba(220,38,38,0.08); color: #991b1b; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #fff; border: 1px solid var(--admin-border); border-radius: 18px; overflow:hidden; }
          th, td { padding: 12px 12px; text-align: left; border-bottom: 1px solid rgba(17,24,39,0.06); vertical-align: middle; }
          th { background: rgba(17,24,39,0.03); font-size: 12px; color: var(--admin-muted); text-transform: uppercase; letter-spacing: .06em; }
          tr:hover td{ background: rgba(17,24,39,0.02); }
          .actions{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:flex-end; }
          .btn-mini{
            height: 34px;
            padding: 0 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 900;
            border: 1px solid var(--admin-border-strong);
            background: #fff;
            cursor: pointer;
          }
          .btn-mini:hover{ background: rgba(17,24,39,0.06); }
          .btn-mini.danger{ border-color: rgba(220,38,38,0.35); color: #991b1b; }
          .btn-mini.danger:hover{ background: rgba(220,38,38,0.08); }
          .pill{ display:inline-flex; align-items:center; justify-content:center; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--admin-border); background: rgba(255,255,255,0.7); font-size: 12px; font-weight: 900; }
          .muted{ color: var(--admin-muted); font-size: 12px; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Категории', activePath: '/admin/categories', buildMarker })}
        <div class="page-actions">
          <button type="button" class="btn" onclick="window.openCategoryModal()">Добавить категорию</button>
          <button type="button" class="btn btn-secondary" onclick="window.autoAssignCategoryCovers()">Автообложки из товаров</button>
        </div>

        ${req.query.success ? '<div class="alert alert-success">Изменения сохранены</div>' : ''}
        ${req.query.error ? '<div class="alert alert-error">Ошибка при сохранении</div>' : ''}

        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Обложка</th>
              <th>Slug</th>
              <th>Товары</th>
              <th>Статус</th>
              <th>Видима</th>
              <th>Создана</th>
              <th style="text-align:right;">Действия</th>
            </tr>
          </thead>
          <tbody>
    `;

    const escapeHtml = (str: any) => String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const escapeAttr = (str: any) => escapeHtml(str).replace(/'/g, '&#39;');

    categories.forEach(cat => {
      html += `
        <tr>
          <td>
            <div style="font-weight: 900;">${escapeHtml(cat.name)}</div>
            ${cat.description ? `<div class="muted">${escapeHtml(cat.description)}</div>` : ''}
          </td>
          <td>
            ${(cat as any).imageUrl ? `<img src="${escapeAttr((cat as any).imageUrl)}" alt="" style="width:46px;height:46px;border-radius:10px;object-fit:cover;border:1px solid rgba(17,24,39,0.12);" />` : '<span class="muted">—</span>'}
          </td>
          <td style="color:#6b7280;">${escapeHtml(cat.slug)}</td>
          <td><span class="pill">${Number((cat as any).productsCount || 0)}</span></td>
          <td>
            <form method="post" action="/admin/categories/${escapeAttr(cat.id)}/toggle-active" style="display:inline; margin:0;">
              <button type="submit" class="btn-mini" title="Переключить статус">${cat.isActive ? 'Активна' : 'Отключена'}</button>
            </form>
          </td>
          <td>${(cat as any).isVisibleInWebapp === false ? 'Нет' : 'Да'}</td>
          <td>${new Date(cat.createdAt).toLocaleDateString('ru-RU')}</td>
          <td style="text-align:right;">
            <div class="actions">
              <button type="button" class="btn-mini cat-edit"
                data-id="${escapeAttr(cat.id)}"
                data-name="${escapeAttr(cat.name)}"
                data-description="${escapeAttr(cat.description || '')}"
                data-image-url="${escapeAttr((cat as any).imageUrl || '')}"
                data-visible="${(cat as any).isVisibleInWebapp === false ? 'false' : 'true'}"
                data-active="${cat.isActive ? 'true' : 'false'}">Редактировать</button>
              <button type="button" class="btn-mini danger cat-delete"
                data-id="${escapeAttr(cat.id)}"
                data-name="${escapeAttr(cat.name)}"
                data-products-count="${escapeAttr((cat as any).productsCount || 0)}">Удалить</button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>

        <!-- Modal: add/edit category -->
        <div id="categoryModal" class="modal-overlay" style="display:none; z-index: 12000;">
          <div class="modal-content" style="max-width: 680px;">
            <div class="modal-header">
              <h2 id="categoryModalTitle" style="margin:0;">Категория</h2>
              <button class="close-btn" type="button" onclick="window.closeCategoryModal()">&times;</button>
            </div>
            <form id="categoryForm" class="modal-form">
              <input type="hidden" id="categoryId">
              <div class="form-group">
                <label for="categoryNameInput">Название *</label>
                <input id="categoryNameInput" type="text" required placeholder="Например: Косметика">
              </div>
              <div class="form-group">
                <label for="categoryDescInput">Описание</label>
                <div id="categoryDescEditor" style="height: 120px;"></div>
                <!-- Hidden textarea to store the HTML for form submission -->
                <textarea id="categoryDescInput" style="display:none;"></textarea>
              </div>
              <div class="form-group">
                <label for="categoryImageInput">Обложка (URL)</label>
                <input id="categoryImageInput" type="text" placeholder="https://...">
                <div class="muted" style="margin-top:6px;">Если оставить пустым — в клиенте будет первая картинка товара.</div>
              </div>
              <div class="form-group">
                <label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--admin-border-strong); border-radius:12px; background:#fff;">
                  <input id="categoryActiveInput" type="checkbox" checked>
                  <span style="font-weight:800;">Активна</span>
                </label>
              </div>
              <div class="form-group">
                <label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--admin-border-strong); border-radius:12px; background:#fff;">
                  <input id="categoryVisibleInput" type="checkbox" checked>
                  <span style="font-weight:800;">Видима в клиенте</span>
                </label>
              </div>
              <div class="form-actions">
                <button type="button" onclick="window.closeCategoryModal()">Отмена</button>
                <button type="submit" id="categorySaveBtn">Сохранить</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Modal: confirm delete -->
        <div id="deleteCategoryModal" class="modal-overlay" style="display:none; z-index: 12000;">
          <div class="modal-content" style="max-width: 560px;">
            <div class="modal-header">
              <h2 style="margin:0;">Удалить категорию?</h2>
              <button class="close-btn" type="button" onclick="window.closeDeleteCategoryModal()">&times;</button>
            </div>
            <div class="modal-form">
              <p id="deleteCategoryText" style="margin:0; color:#374151; font-size:14px; line-height:1.5;"></p>
            </div>
            <div class="form-actions">
              <button type="button" onclick="window.closeDeleteCategoryModal()">Отмена</button>
              <button type="button" id="deleteCategoryConfirmBtn" style="background: var(--admin-danger); color:#fff; border-color: var(--admin-danger);">Удалить</button>
            </div>
          </div>
        </div>

        <script>
          'use strict';
          window.__categoryDeleteId = null;

          document.addEventListener("DOMContentLoaded", function() {
            if (typeof Quill !== 'undefined' && !window.catQuill) {
              window.catQuill = new Quill('#categoryDescEditor', {
                theme: 'snow',
                placeholder: 'Описание категории (опционально)...',
                modules: {
                  toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                  ]
                }
              });
            }
          });

          window.openCategoryModal = function(cat){
            const modal = document.getElementById('categoryModal');
            const title = document.getElementById('categoryModalTitle');
            const idEl = document.getElementById('categoryId');
            const nameEl = document.getElementById('categoryNameInput');
            const descEl = document.getElementById('categoryDescInput');
            const imageEl = document.getElementById('categoryImageInput');
            const activeEl = document.getElementById('categoryActiveInput');
            const visibleEl = document.getElementById('categoryVisibleInput');
            if (!modal || !title || !idEl || !nameEl || !descEl || !imageEl || !activeEl || !visibleEl) return;

            const isEdit = !!(cat && cat.id);
            title.textContent = isEdit ? 'Редактировать категорию' : 'Добавить категорию';
            idEl.value = isEdit ? String(cat.id) : '';
            nameEl.value = isEdit ? String(cat.name || '') : '';
            
            const descHtml = isEdit ? String(cat.description || '') : '';
            descEl.value = descHtml;
            if (window.catQuill) {
              window.catQuill.root.innerHTML = descHtml;
            }

            imageEl.value = isEdit ? String(cat.imageUrl || '') : '';
            activeEl.checked = isEdit ? (String(cat.isActive) === 'true') : true;
            visibleEl.checked = isEdit ? (String(cat.isVisibleInWebapp) !== 'false') : true;
            modal.style.display = 'flex';
            modal.onclick = function(e){ if (e && e.target === modal) window.closeCategoryModal(); };
            setTimeout(() => { try { nameEl.focus(); } catch(_){} }, 30);
          };

          window.closeCategoryModal = function(){
            const modal = document.getElementById('categoryModal');
            if (modal) modal.style.display = 'none';
          };

          window.openDeleteCategoryModal = function(id, name, productsCount){
            const modal = document.getElementById('deleteCategoryModal');
            const text = document.getElementById('deleteCategoryText');
            const btn = document.getElementById('deleteCategoryConfirmBtn');
            if (!modal || !text || !btn) return;
            window.__categoryDeleteId = String(id || '');
            const cnt = parseInt(String(productsCount || '0'), 10) || 0;
            if (cnt > 0){
              text.textContent = 'Категорию “' + (name || '') + '” нельзя удалить: в ней есть товары (' + cnt + '). Сначала переместите товары в другую категорию.';
              btn.disabled = true;
              btn.style.opacity = '0.5';
            } else {
              text.textContent = 'Вы точно хотите удалить категорию “' + (name || '') + '”? Это действие нельзя отменить.';
              btn.disabled = false;
              btn.style.opacity = '1';
            }
            modal.style.display = 'flex';
            modal.onclick = function(e){ if (e && e.target === modal) window.closeDeleteCategoryModal(); };
          };

          window.closeDeleteCategoryModal = function(){
            const modal = document.getElementById('deleteCategoryModal');
            if (modal) modal.style.display = 'none';
            window.__categoryDeleteId = null;
          };

          document.addEventListener('click', function(e){
            const t = e.target;
            const el = (t && t.nodeType === 1) ? t : (t && t.parentElement ? t.parentElement : null);
            if (!el) return;
            const edit = el.closest('.cat-edit');
            if (edit){
              e.preventDefault();
              window.openCategoryModal({
                id: edit.getAttribute('data-id'),
                name: edit.getAttribute('data-name'),
                description: edit.getAttribute('data-description'),
                imageUrl: edit.getAttribute('data-image-url'),
                isVisibleInWebapp: edit.getAttribute('data-visible'),
                isActive: edit.getAttribute('data-active')
              });
              return;
            }
            const del = el.closest('.cat-delete');
            if (del){
              e.preventDefault();
              window.openDeleteCategoryModal(
                del.getAttribute('data-id'),
                del.getAttribute('data-name'),
                del.getAttribute('data-products-count')
              );
              return;
            }
          }, true);

          document.getElementById('categoryForm').addEventListener('submit', async function(e){
            e.preventDefault();
            
            // Sync Quill HTML content to the hidden textarea before submitting
            if (window.catQuill) {
              document.getElementById('categoryDescInput').value = window.catQuill.root.innerHTML;
            }

            const id = document.getElementById('categoryId').value.trim();
            const name = document.getElementById('categoryNameInput').value.trim();
            const description = document.getElementById('categoryDescInput').value.trim();
            const imageUrl = document.getElementById('categoryImageInput').value.trim();
            const isActive = document.getElementById('categoryActiveInput').checked ? 'true' : 'false';
            const isVisibleInWebapp = document.getElementById('categoryVisibleInput').checked ? 'true' : 'false';
            if (!name) { alert('Введите название'); return; }

            const btn = document.getElementById('categorySaveBtn');
            const old = btn ? btn.textContent : '';
            if (btn){ btn.disabled = true; btn.textContent = 'Сохранение...'; }
            try{
              const payload = { name, description, imageUrl, isActive, isVisibleInWebapp };
              const url = id ? ('/admin/api/categories/' + encodeURIComponent(id) + '/update') : '/admin/api/categories';
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
              });
              const result = await resp.json().catch(() => ({}));
              if (resp.ok && result && result.success){
                window.closeCategoryModal();
                window.location.reload();
              } else {
                alert('Ошибка: ' + (result && result.error ? result.error : ('HTTP ' + resp.status)));
              }
            }catch(err){
              alert('Ошибка: ' + (err && err.message ? err.message : String(err)));
            }finally{
              if (btn){ btn.disabled = false; btn.textContent = old || 'Сохранить'; }
            }
          });

          window.autoAssignCategoryCovers = async function(){
            if (!confirm('Заполнить обложки из первых картинок товаров?')) return;
            const resp = await fetch('/admin/api/categories/auto-covers', {
              method: 'POST',
              credentials: 'include'
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok) {
              alert(result.error || 'Ошибка автообложек');
              return;
            }
            alert('Готово: обновлено ' + (result.updated || 0) + ' категорий');
            window.location.reload();
          };

          document.getElementById('deleteCategoryConfirmBtn').addEventListener('click', async function(){
            const id = window.__categoryDeleteId;
            if (!id) return;
            const btn = this;
            const old = btn.textContent;
            btn.disabled = true; btn.textContent = 'Удаление...';
            try{
              const resp = await fetch('/admin/api/categories/' + encodeURIComponent(id) + '/delete', {
                method: 'POST',
                credentials: 'include'
              });
              const result = await resp.json().catch(() => ({}));
              if (resp.ok && result && result.success){
                window.closeDeleteCategoryModal();
                window.location.reload();
              } else {
                alert('Ошибка: ' + (result && result.error ? result.error : ('HTTP ' + resp.status)));
              }
            }catch(err){
              alert('Ошибка: ' + (err && err.message ? err.message : String(err)));
            }finally{
              btn.textContent = old || 'Удалить';
            }
          });
        </script>

        ${renderAdminShellEnd()}
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Categories page error:', error);
    res.status(500).send('Ошибка загрузки категорий');
  }
});

router.get('/partners', requireAdmin, async (req, res) => {
  try {
    const partners = await prisma.partnerProfile.findMany({
      where: {
        isActive: true
      },
      include: {
        user: true,
        referrals: {
          include: {
            profile: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total balance of all partners
    const totalBalance = partners.reduce((sum, partner) => sum + partner.balance, 0);

    // Find inviters for each partner
    const partnersWithInviters = await Promise.all(
      partners.map(async (partner) => {
        // Find who invited this partner
        const inviterReferral = await prisma.partnerReferral.findFirst({
          where: { referredId: partner.user.id },
          include: {
            profile: {
              include: {
                user: true
              }
            }
          }
        });

        return {
          ...partner,
          inviter: inviterReferral?.profile?.user || null,
          inviterCode: inviterReferral?.profile?.referralCode || ''
        };
      })
    );

    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Управление партнёрами</title>
        <meta charset="utf-8">
        <style>
          ${ADMIN_UI_CSS}
          body { margin: 0; padding: 0; background: var(--admin-bg); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

          .page-actions{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom: 14px; }
          .page-actions form{ display:inline; margin:0; }
          .page-actions .btn{ height: 40px; border-radius: 14px; font-weight: 800; }

          .metric-card{
            background: var(--admin-surface);
            border: 1px solid var(--admin-border);
            border-radius: 22px;
            padding: 18px;
            box-shadow: 0 14px 34px rgba(17,24,39,0.06);
            display:flex;
            align-items:center;
            justify-content: space-between;
            gap: 12px;
            margin: 10px 0 14px 0;
          }
          .metric-card .label{ font-weight: 900; font-size: 14px; color: var(--admin-muted); }
          .metric-card .value{ font-weight: 900; font-size: 34px; letter-spacing: -0.04em; }

          .alert { padding: 12px 14px; margin: 10px 0; border-radius: 16px; border: 1px solid var(--admin-border); background: #fff; }
          .alert-success { border-color: rgba(34,197,94,0.25); background: rgba(34,197,94,0.08); color: #166534; }
          .alert-error { border-color: rgba(220,38,38,0.25); background: rgba(220,38,38,0.08); color: #991b1b; }

          table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #fff; border: 1px solid var(--admin-border); border-radius: 18px; overflow:hidden; }
          th, td { padding: 12px 12px; text-align: left; border-bottom: 1px solid rgba(17,24,39,0.06); vertical-align: top; }
          th { background: rgba(17,24,39,0.03); font-size: 12px; color: var(--admin-muted); text-transform: uppercase; letter-spacing: .06em; }
          tr:hover td{ background: rgba(17,24,39,0.02); }

          /* Row actions: compact and predictable (no giant stacks) */
          .actions{ display:grid; gap:8px; justify-content:flex-end; }
          .actions form{ display:flex; gap:8px; align-items:center; justify-content:flex-end; margin:0; flex-wrap:nowrap; }
          .mini-input{
            width: 160px;
            height: 34px;
            padding: 0 10px;
            border-radius: 12px;
            border: 1px solid var(--admin-border-strong);
            font-size: 12px;
          }
          .btn-mini{
            height: 34px;
            padding: 0 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 900;
            border: 1px solid var(--admin-border-strong);
            background: #fff;
            cursor: pointer;
          }
          .btn-mini:hover{ background: rgba(17,24,39,0.06); }
          .btn-mini.danger{ border-color: rgba(220,38,38,0.35); color: #991b1b; }
          .btn-mini.danger:hover{ background: rgba(220,38,38,0.08); }
          
          /* Bulk actions styles */
          .bulk-actions-container {
            display: none; /* Hidden by default */
            align-items: center;
            gap: 15px;
            background: #fff3cd;
            border: 1px solid #ffeeba;
            padding: 10px 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            animation: fadeIn 0.3s ease;
          }
          .bulk-actions-container.active { display: flex; }
          .bulk-count { font-weight: bold; color: #856404; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        </style>
        <script>
          function toggleAllPartners(source) {
            const checkboxes = document.querySelectorAll('.partner-checkbox');
            for(var i=0, n=checkboxes.length;i<n;i++) {
              checkboxes[i].checked = source.checked;
            }
            updateBulkActionsState();
          }

          function updateBulkActionsState() {
            const checkboxes = document.querySelectorAll('.partner-checkbox:checked');
            const container = document.getElementById('bulkActionsContainer');
            const countSpan = document.getElementById('selectedCount');
            
            if (checkboxes.length > 0) {
              container.classList.add('active');
              countSpan.textContent = checkboxes.length;
            } else {
              container.classList.remove('active');
            }
          }

          function deactivateSelectedPartners() {
            const checkboxes = document.querySelectorAll('.partner-checkbox:checked');
            const ids = Array.from(checkboxes).map(cb => cb.value);
            
            if (ids.length === 0) return;

            if (confirm(\`Вы уверены, что хотите деактивировать \${ids.length} партнёров? Это действие отменит их партнёрский статус.\`)) {
              fetch('/admin/partners/bulk-deactivate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userIds: ids }),
              })
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  alert(\`Успешно деактивировано \${data.count} партнёров\`);
                  location.reload();
                } else {
                  alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
                }
              })
              .catch(error => {
                console.error('Error:', error);
                alert('Ошибка при выполнении запроса');
              });
            }
          }
        </script>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Партнёры', activePath: '/admin/partners', buildMarker })}

        <div class="page-actions">
          <a href="/admin/partners-hierarchy" class="btn">Иерархия</a>
          <a href="/admin/test-referral-links" class="btn">Тест ссылок</a>
          <a href="/admin/debug-partners" class="btn">Отладка</a>
          <form method="post" action="/admin/recalculate-bonuses">
            <button type="submit" class="btn" onclick="return confirm('Пересчитать бонусы всех партнёров?')">Пересчитать бонусы</button>
        </form>
          <form method="post" action="/admin/recalculate-all-balances">
            <button type="submit" class="btn" onclick="return confirm('Пересчитать ВСЕ балансы партнёров?')">Пересчитать балансы</button>
        </form>
          <form method="post" action="/admin/cleanup-duplicates">
            <button type="submit" class="btn btn-danger" onclick="return confirm('Удалить дублирующиеся записи партнёров и транзакций? Это действие необратимо!')">Очистить дубли</button>
        </form>
          <form method="post" action="/admin/cleanup-referral-duplicates">
            <button type="submit" class="btn btn-danger" onclick="return confirm('Очистить дублирующиеся записи рефералов? Это действие необратимо!')">Очистить дубли рефералов</button>
        </form>
          <form method="post" action="/admin/cleanup-duplicate-bonuses">
            <button type="submit" class="btn btn-danger" onclick="return confirm('Удалить дублирующиеся бонусы? Это действие необратимо!')">Очистить дубли бонусов</button>
        </form>
          <form method="post" action="/admin/fix-roman-bonuses">
            <button type="submit" class="btn" onclick="return confirm('Исправить бонусы Roman Arctur?')">Исправить бонусы Roman</button>
        </form>
          <form method="post" action="/admin/reset-all-partners">
            <button type="submit" class="btn btn-danger" onclick="const confirmed = confirm('КРИТИЧЕСКОЕ ПОДТВЕРЖДЕНИЕ!\\n\\nЭто удалит ВСЕ партнерские профили, рефералы и транзакции!\\n\\nЭто действие НЕОБРАТИМО!\\n\\nПродолжить?'); if (!confirmed) return false; const doubleCheck = prompt('Для подтверждения введите точно: УДАЛИТЬ ВСЕХ ПАРТНЕРОВ'); return doubleCheck === 'УДАЛИТЬ ВСЕХ ПАРТНЕРОВ';">Сбросить всех партнёров</button>
        </form>
        </div>
        
        <div id="bulkActionsContainer" class="bulk-actions-container">
          <span class="bulk-count">Выбрано: <span id="selectedCount">0</span></span>
          <button class="btn btn-danger" onclick="deactivateSelectedPartners()">Деактивировать выбранных</button>
        </div>
        
        <div class="metric-card">
          <div>
            <div class="label">Общий баланс партнёров</div>
            <div class="sub" style="color: var(--admin-muted); font-size: 12px; margin-top: 6px;">Сумма всех балансов партнёров в системе</div>
          </div>
          <div class="value">${totalBalance.toFixed(2)} PZ</div>
        </div>
        
        ${req.query.success === 'inviter_changed' ? '<div class="alert alert-success">✅ Пригласитель успешно изменен</div>' : ''}
        ${req.query.error === 'inviter_not_found' ? '<div class="alert alert-error">❌ Пригласитель с таким кодом не найден</div>' : ''}
        ${req.query.error === 'inviter_change' ? '<div class="alert alert-error">❌ Ошибка при смене пригласителя</div>' : ''}
        ${req.query.success === 'balance_added' ? '<div class="alert alert-success">✅ Баланс успешно пополнен</div>' : ''}
        ${req.query.success === 'balance_subtracted' ? '<div class="alert alert-success">✅ Баланс успешно списан</div>' : ''}
        ${req.query.success === 'bonuses_recalculated' ? '<div class="alert alert-success">✅ Бонусы успешно пересчитаны</div>' : ''}
        ${req.query.success === 'duplicates_cleaned' ? `<div class="alert alert-success">✅ Дубли очищены! Удалено ${req.query.referrals || 0} дублей рефералов и ${req.query.transactions || 0} дублей транзакций</div>` : ''}
        ${req.query.success === 'all_balances_recalculated' ? '<div class="alert alert-success">✅ Все балансы партнёров пересчитаны</div>' : ''}
        ${req.query.success === 'referral_duplicates_cleaned' ? `<div class="alert alert-success">✅ Дубли рефералов очищены! Удалено ${req.query.count || 0} дублей</div>` : ''}
        ${req.query.success === 'bonuses_force_recalculated' ? '<div class="alert alert-success">✅ Все бонусы принудительно пересчитаны</div>' : ''}
        ${req.query.success === 'duplicate_bonuses_cleaned' ? `<div class="alert alert-success">✅ Дубли бонусов очищены! Удалено ${req.query.count || 0} дублей</div>` : ''}
        ${req.query.success === 'roman_bonuses_fixed' ? `<div class="alert alert-success">✅ Бонусы Roman Arctur исправлены! Новый бонус: ${req.query.bonus || 0} PZ</div>` : ''}
        ${req.query.success === 'all_partners_reset' ? `<div class="alert alert-success">✅ Все партнёры удалены! Удалено профилей: ${req.query.count || 0}</div>` : ''}
        ${req.query.error === 'balance_add' ? '<div class="alert alert-error">❌ Ошибка при пополнении баланса</div>' : ''}
        ${req.query.error === 'reset_partners_failed' ? '<div class="alert alert-error">❌ Ошибка при сбросе всех партнёров</div>' : ''}
        ${req.query.error === 'balance_subtract' ? '<div class="alert alert-error">❌ Ошибка при списании баланса</div>' : ''}
        ${req.query.error === 'bonus_recalculation' ? '<div class="alert alert-error">❌ Ошибка при пересчёте бонусов</div>' : ''}
        ${req.query.error === 'balance_recalculation_failed' ? '<div class="alert alert-error">❌ Ошибка при пересчёте всех балансов</div>' : ''}
        ${req.query.error === 'bonus_force_recalculation_failed' ? '<div class="alert alert-error">❌ Ошибка при принудительном пересчёте бонусов</div>' : ''}
        ${req.query.error === 'duplicate_bonuses_cleanup_failed' ? '<div class="alert alert-error">❌ Ошибка при очистке дублей бонусов</div>' : ''}
        ${req.query.error === 'roman_bonuses_fix_failed' ? '<div class="alert alert-error">❌ Ошибка при исправлении бонусов Roman</div>' : ''}
        ${req.query.error === 'roman_profile_not_found' ? '<div class="alert alert-error">❌ Профиль Roman Arctur не найден</div>' : ''}
        ${req.query.error === 'referral_cleanup_failed' ? '<div class="alert alert-error">❌ Ошибка при очистке дублей рефералов</div>' : ''}
        ${req.query.error === 'cleanup_failed' ? '<div class="alert alert-error">❌ Ошибка при очистке дублей</div>' : ''}
        <table>
          <tr>
            <th style="width: 40px; text-align: center;"><input type="checkbox" onclick="toggleAllPartners(this)"></th>
            <th>Пользователь</th><th>Тип программы</th><th>Баланс</th><th>Всего бонусов</th><th>Партнёров</th><th>Код</th><th>Пригласитель</th><th>Создан</th>
          </tr>
    `;

    partnersWithInviters.forEach((partner, index) => {
      const isEven = index % 2 === 0;
      const rowBg = !partner.isActive ? '#fff5f5' : (isEven ? '#ffffff' : '#f8f9fa');
      const rowClass = !partner.isActive ? 'text-muted' : '';

      html += `
        <tr style="background: ${rowBg}; border-bottom: none;" class="${rowClass}">
          <td style="text-align: center; vertical-align: middle;">
            <input type="checkbox" class="partner-checkbox" value="${partner.user.id}" onclick="updateBulkActionsState()">
          </td>
          <td>
            <div style="font-weight: bold;">${partner.user.firstName || 'Не указан'}</div>
            <div style="font-size: 12px; color: #6c757d;">@${partner.user.username || 'без username'}</div>
            ${!partner.isActive ? '<span style="display:inline-block; margin-top:4px; padding:2px 6px; background:#fee2e2; color:#991b1b; border-radius:4px; font-size:10px; font-weight:bold;">DEACTIVATED</span>' : ''}
          </td>
          <td>${partner.programType === 'DIRECT' ? 'Прямая (15%)' : 'Многоуровневая (15%+5%)'}</td>

          <td>${partner.balance} PZ</td>
          <td>${partner.bonus} PZ</td>
          <td>${partner.totalPartners}</td>
          <td>${partner.referralCode}</td>
          <td>
            ${partner.inviter
          ? `${partner.inviter.firstName || ''} ${partner.inviter.lastName || ''} ${partner.inviter.username ? `(@${partner.inviter.username})` : ''}`.trim()
          : 'Нет данных'
        }
          </td>
          <td>${new Date(partner.createdAt).toLocaleDateString()}</td>
        </tr>
        <tr style="background: ${rowBg}; border-bottom: 1px solid #d1d5db;">
          <td colspan="9" style="padding-top: 5px; padding-bottom: 20px;">
            <div class="actions" style="display: flex; gap: 15px; flex-wrap: wrap;">
              <form method="post" action="/admin/partners/${partner.id}/change-inviter" style="display: flex; gap: 5px; align-items: center;">
                <input class="mini-input" type="text" name="newInviterCode" placeholder="${partner.inviterCode || 'Код пригласителя'}" style="width: 140px; background: #fff;" required>
                <button type="submit" class="btn-mini" onclick="return confirm('Изменить пригласителя для ${partner.user.firstName || 'пользователя'}?')">Сменить</button>
              </form>
              <form method="post" action="/admin/partners/${partner.id}/add-balance" style="display: flex; gap: 5px; align-items: center;">
                <input class="mini-input" type="number" name="amount" placeholder="Сумма" step="0.01" style="width: 80px;" required>
                <button type="submit" class="btn-mini">+PZ</button>
              </form>
              <form method="post" action="/admin/partners/${partner.id}/adjust-balance" style="display: flex; gap: 5px; align-items: center;">
                <input class="mini-input" type="number" name="amount" placeholder="Сумма" step="0.01" style="width: 80px;" required>
                <button type="submit" class="btn-mini" name="op" value="add">+PZ</button>
                <button type="submit" class="btn-mini danger" name="op" value="sub">-PZ</button>
              </form>
              <button class="btn-mini" style="background:#6366f1; color:white; border:none;" onclick="openPartnerManagerFromList('${partner.user.id}', ${partner.isActive}, '${partner.expiresAt || ''}', '${partner.user.firstName || partner.user.username || 'Партнёр'}')">
                ⚙️ Подписка
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += `
        </table>
        ${renderAdminShellEnd()}

        <!-- Partner Manager Modal (Partners Page) -->
        <div id="partnerMgrModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center;">
          <div style="background:#fff; border-radius:12px; padding:28px; max-width:480px; width:90%; position:relative; box-shadow:0 8px 32px rgba(0,0,0,0.2);">
            <button onclick="closePMM()" style="position:absolute;top:14px;right:16px;border:none;background:none;font-size:22px;cursor:pointer;color:#666;">×</button>
            <h2 style="margin:0 0 20px; font-size:18px;">⚙️ Управление партнёркой — <span id="pmm-name"></span></h2>

            <div style="margin-bottom:16px;">
              <label style="font-weight:600; display:block; margin-bottom:8px;">Статус</label>
              <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                <input type="checkbox" id="pmm-active" onchange="document.getElementById('pmm-status-label').textContent=this.checked?'Активен':'Неактивен'; document.getElementById('pmm-status-label').style.color=this.checked?'#16a34a':'#6b7280';" style="width:18px;height:18px;">
                <span id="pmm-status-label" style="font-weight:600; color:#6b7280;">Неактивен</span>
              </label>
            </div>

            <div style="margin-bottom:16px;">
              <label style="font-weight:600; display:block; margin-bottom:6px;">Текущий срок действия:</label>
              <div id="pmm-expires" style="padding:10px; background:#f8f9fa; border-radius:6px; border:1px solid #dee2e6; font-size:14px;"></div>
            </div>

            <div style="margin-bottom:16px;">
              <label style="font-weight:600; display:block; margin-bottom:8px;">Продлить / установить срок:</label>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                <button type="button" class="pmm-dur-btn" onclick="pmmSelect(1,this)">1 Месяц</button>
                <button type="button" class="pmm-dur-btn" onclick="pmmSelect(2,this)">2 Месяца</button>
                <button type="button" class="pmm-dur-btn" onclick="pmmSelect(3,this)">3 Месяца</button>
                <button type="button" class="pmm-dur-btn" onclick="pmmSelect(6,this)">6 Месяцев</button>
                <button type="button" class="pmm-dur-btn" onclick="pmmSelect(12,this)">1 Год</button>
              </div>
              <label style="font-size:13px; color:#666; display:block; margin-bottom:4px;">Или введите дату окончания:</label>
              <input type="date" id="pmm-date" style="padding:8px; border:1px solid #ced4da; border-radius:6px; width:100%;"
                onchange="document.getElementById('pmm-months').value=''; document.querySelectorAll('.pmm-dur-btn').forEach(b=>{b.style.background='white';b.style.color='#333';});">
              <input type="hidden" id="pmm-months">
              <input type="hidden" id="pmm-userid">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
              <button onclick="closePMM()" style="padding:9px 18px; border:1px solid #ccc; background:white; border-radius:6px; cursor:pointer;">Отмена</button>
              <button onclick="savePMM()" style="padding:9px 18px; background:#4f46e5; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:600;">💾 Сохранить</button>
            </div>
          </div>
        </div>

        <style>
          .pmm-dur-btn { padding:6px 12px; border:1px solid #ccc; background:white; border-radius:4px; cursor:pointer; color:#333; font-size:13px; }
          .pmm-dur-btn:hover { border-color:#4f46e5; }
        </style>

        <script>
          function openPartnerManagerFromList(userId, isActive, expiresAtStr, name) {
            document.getElementById('pmm-userid').value = userId;
            document.getElementById('pmm-name').textContent = name;
            const cb = document.getElementById('pmm-active');
            cb.checked = isActive;
            document.getElementById('pmm-status-label').textContent = isActive ? 'Активен' : 'Неактивен';
            document.getElementById('pmm-status-label').style.color = isActive ? '#16a34a' : '#6b7280';
            const exp = expiresAtStr ? new Date(expiresAtStr) : null;
            document.getElementById('pmm-expires').textContent = exp ? exp.toLocaleDateString('ru-RU') : 'Не установлено';
            document.getElementById('pmm-months').value = '';
            document.getElementById('pmm-date').value = '';
            document.querySelectorAll('.pmm-dur-btn').forEach(b => { b.style.background='white'; b.style.color='#333'; });
            document.getElementById('partnerMgrModal').style.display = 'flex';
          }
          function closePMM() { document.getElementById('partnerMgrModal').style.display = 'none'; }
          function pmmSelect(months, btn) {
            document.querySelectorAll('.pmm-dur-btn').forEach(b => { b.style.background='white'; b.style.color='#333'; });
            btn.style.background = '#4f46e5'; btn.style.color = 'white';
            document.getElementById('pmm-months').value = months;
            document.getElementById('pmm-date').value = '';
          }
          async function savePMM() {
            const userId = document.getElementById('pmm-userid').value;
            const isActive = document.getElementById('pmm-active').checked;
            const months = document.getElementById('pmm-months').value;
            const date = document.getElementById('pmm-date').value;
            try {
              const r = await fetch('/admin/users/' + userId + '/update-partner-program', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive, months, date })
              });
              const res = await r.json();
              if (res.success) {
                closePMM();
                const n = document.createElement('div');
                n.style.cssText = 'position:fixed;top:20px;right:20px;background:#16a34a;color:white;padding:12px 20px;border-radius:8px;z-index:99999;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
                n.textContent = '✅ Сохранено!';
                document.body.appendChild(n);
                setTimeout(() => { window.location.reload(); }, 1000);
              } else {
                alert('Ошибка: ' + (res.error || 'Неизвестная ошибка'));
              }
            } catch(e) { alert('Ошибка: ' + e.message); }
          }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Partners page error:', error);
    res.status(500).send('Ошибка загрузки партнёров');
  }
});


router.post('/partners/bulk-deactivate', requireAdmin, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No users selected' });
    }

    const result = await prisma.partnerProfile.updateMany({
      where: {
        userId: {
          in: userIds
        }
      },
      data: {
        isActive: false
      }
    });

    res.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Bulk deactivate error:', error);
    res.status(500).json({ success: false, error: 'Database error' });
  }
});
// Partners hierarchy route
router.get('/partners-hierarchy', requireAdmin, async (req, res) => {
  try {
    const userId = req.query.user as string;

    // Get all partners with their referrals
    const partners = await prisma.partnerProfile.findMany({
      include: {
        user: true,
        referrals: {
          include: {
            profile: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Find inviters for each partner
    const partnersWithInviters = await Promise.all(
      partners.map(async (partner) => {
        const inviterReferral = await prisma.partnerReferral.findFirst({
          where: { referredId: partner.user.id },
          include: {
            profile: {
              include: {
                user: true
              }
            }
          }
        });

        return {
          ...partner,
          inviter: inviterReferral?.profile?.user || null
        };
      })
    );
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    // Build interactive hierarchy with multi-level referrals (full tree)
    function buildInteractiveHierarchy() {
      const rootPartners = partnersWithInviters.filter(p => !p.inviter);

      function buildPartnerNode(partner: any, level = 0) {
        const levelEmoji = level === 0 ? '👑' : level === 1 ? '🥈' : level === 2 ? '🥉' : '📋';
        const partnerName = `${partner.user.firstName || ''} ${partner.user.lastName || ''}`.trim();
        const username = partner.user.username ? ` (@${partner.user.username})` : '';
        const balance = partner.balance.toFixed(2);

        // Count all referrals at all levels recursively
        function countAllReferrals(partnerId: string, visited = new Set()): number {
          if (visited.has(partnerId)) return 0; // Prevent infinite loops
          visited.add(partnerId);

          const directReferrals = partnersWithInviters.filter(p =>
            p.inviter && p.inviter.id === partnerId
          );

          let totalCount = directReferrals.length;

          // Recursively count referrals of referrals
          directReferrals.forEach(ref => {
            totalCount += countAllReferrals(ref.user.id, new Set(visited));
          });

          return totalCount;
        }

        const totalReferrals = countAllReferrals(partner.user.id);

        // Get direct referrals (level 1)
        const directReferrals = partnersWithInviters.filter(p =>
          p.inviter && p.inviter.id === partner.user.id
        );

        const hasChildren = directReferrals.length > 0;
        const expandId = `expand-${partner.id}`;
        const childrenId = `children-${partner.id}`;

        let node = `
          <div class="partner-node level-${level}" style="margin-left: ${level * 20}px;">
            <div class="partner-header" onclick="${hasChildren ? `toggleChildren('${expandId}', '${childrenId}')` : ''}" style="cursor: ${hasChildren ? 'pointer' : 'default'};">
              <span class="expand-icon" id="${expandId}" style="display: ${hasChildren ? 'inline-block' : 'none'};">▶</span>
              <span class="partner-info">
                <span class="level-emoji">${levelEmoji}</span>
                <span class="partner-name">${partnerName}${username}</span>
                <span class="balance">${balance} PZ</span>
                <span class="referrals">(${totalReferrals} рефералов всего)</span>
                ${directReferrals.length > 0 ? `<span class="direct-referrals" style="font-size: 11px; color: #666;">(${directReferrals.length} прямых)</span>` : ''}
              </span>
            </div>
            <div class="children" id="${childrenId}" style="display: none;">
        `;

        // Add child nodes recursively
        directReferrals.forEach(referral => {
          node += buildPartnerNode(referral, level + 1);
        });

        node += `
            </div>
          </div>
        `;

        return node;
      }

      let html = '';
      rootPartners.forEach(rootPartner => {
        html += buildPartnerNode(rootPartner);
      });

      return html;
    }
    // If a specific user is provided, render focused 0-4 view: inviter -> user -> L1 -> L2 -> L3
    function buildFocusedHierarchy(userId: string) {
      const target = partnersWithInviters.find(p => p.user.id === userId);
      if (!target) return '<p style="color:#6c757d">Партнёр не найден</p>';

      // 0: inviter
      const inviter = target.inviter;

      // 1: user
      const user = target;

      // 2: level 1 referrals (direct)
      const level1 = partnersWithInviters.filter(p => p.inviter && p.inviter.id === user.user.id);
      const level1Ids = new Set(level1.map(p => p.user.id));

      // 3: level 2 referrals
      const level2 = partnersWithInviters.filter(p => p.inviter && level1Ids.has(p.inviter.id));
      const level2Ids = new Set(level2.map(p => p.user.id));

      // 4: level 3 referrals
      const level3 = partnersWithInviters.filter(p => p.inviter && level2Ids.has(p.inviter.id));

      function renderUserRow(label: string, u: any | null, canChange = false, idForChange: string | null = null) {
        if (!u) return `<div class=\"partner-node\"><div class=\"partner-header level-0\">${label}: —</div></div>`;
        const name = `${u.firstName || u.user?.firstName || ''} ${u.lastName || u.user?.lastName || ''}`.trim();
        const username = (u.username || u.user?.username) ? ` (@${u.username || u.user?.username})` : '';
        const balance = (u.balance ?? u.user?.balance ?? 0).toFixed ? (u.balance).toFixed(2) : (Number(u.balance || 0)).toFixed(2);
        const btn = canChange && idForChange ? ` <button class=\"btn\" style=\"background:#10b981; margin-left:8px;\" onclick=\"changeInviterPrompt('${idForChange}')\">Сменить пригласителя</button>` : '';
        return `<div class=\"partner-node\"><div class=\"partner-header level-0\"><strong>${label}:</strong> ${name}${username} <span class=\"balance\">${balance} PZ</span>${btn}</div></div>`;
      }

      function renderList(label: string, arr: any[]) {
        if (arr.length === 0) return `<div class="partner-node"><div class="partner-header level-1"><strong>${label}:</strong> —</div></div>`;
        return `
          <div class="partner-node"><div class="partner-header level-1"><strong>${label}:</strong> (${arr.length})</div>
            <div class="children">
              ${arr.map(p => {
          const name = `${p.user.firstName || ''} ${p.user.lastName || ''}`.trim();
          const username = p.user.username ? ` (@${p.user.username})` : '';
          return `<div class=\"partner-node\"><div class=\"partner-header level-2\">${name}${username} <span class=\"balance\">${p.balance.toFixed(2)} PZ</span></div></div>`;
        }).join('')}
            </div>
          </div>`;
      }

      return `
        ${renderUserRow('0 — Пригласитель', inviter)}
        ${renderUserRow('1 — Пользователь', user.user || user, true, user.user.id)}
        ${renderList('2 — Партнёры 1-го уровня', level1)}
        ${renderList('3 — Партнёры 2-го уровня', level2)}
        ${renderList('4 — Партнёры 3-го уровня', level3)}
      `;
    }

    const hierarchyHtml = userId ? buildFocusedHierarchy(userId) : buildInteractiveHierarchy();
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Интерактивная иерархия партнёров</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          ${ADMIN_UI_CSS}
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: var(--admin-bg); }
          .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 20px; }
          h2 { color: #333; margin-bottom: 20px; }
          .btn { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; margin: 5px; }
          .btn:hover { background: #0056b3; }
          
          .stats { background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-around; text-align: center; }
          .stat-item h4 { margin: 0; color: #1976d2; }
          .stat-item p { margin: 5px 0 0 0; font-size: 18px; font-weight: bold; }
          
          .hierarchy-container { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #e9ecef; }
          
          .partner-node { margin: 5px 0; }
          .partner-header { padding: 10px; border-radius: 6px; transition: background-color 0.2s; }
          .partner-header:hover { background: #e9ecef; }
          
          .expand-icon { margin-right: 8px; font-size: 12px; transition: transform 0.2s; }
          .expand-icon.expanded { transform: rotate(90deg); }
          
          .partner-info { display: flex; align-items: center; gap: 10px; }
          .level-emoji { font-size: 16px; }
          .partner-name { font-weight: 600; color: #333; }
          .balance { color: #28a745; font-weight: bold; }
          .referrals { color: #6c757d; font-size: 14px; }
          
          .children { margin-left: 20px; border-left: 2px solid #dee2e6; padding-left: 15px; }
          
          .level-0 .partner-header { background: #fff3cd; border-left: 4px solid #ffc107; }
          .level-1 .partner-header { background: #d1ecf1; border-left: 4px solid #17a2b8; }
          .level-2 .partner-header { background: #f8d7da; border-left: 4px solid #dc3545; }
          .level-3 .partner-header { background: #e2e3e5; border-left: 4px solid #6c757d; }
          
          .controls { margin-bottom: 20px; }
          .control-btn { background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 10px; }
          .control-btn:hover { background: #5a6268; }
          .control-btn.primary { background: #007bff; }
          .control-btn.primary:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Иерархия', activePath: '/admin/partners', buildMarker })}
        <div class="container">
          <h2>🌳 Иерархия партнёров ${userId ? '(фокус на пользователе)' : 'v3.0'}</h2>
          <p style="color: #666; font-size: 12px; margin: 5px 0;">Версия: 3.0 | ${new Date().toLocaleString()}</p>
          
          <div class="controls">
            <a href="/admin/partners" class="btn">← К партнёрам</a>
            <a href="/admin" class="btn">🏠 Главная</a>
            <button class="control-btn" onclick="expandAll()">🔽 Развернуть всё</button>
            <button class="control-btn" onclick="collapseAll()">🔼 Свернуть всё</button>
            ${userId ? `<button class="control-btn primary" onclick="changeInviterPrompt('${userId}')">🔄 Сменить пригласителя</button>` : ''}
          </div>
          
          <div class="stats">
            <div class="stat-item">
              <h4>Всего партнёров</h4>
              <p>${partnersWithInviters.length}</p>
            </div>
            <div class="stat-item">
              <h4>Корневых партнёров</h4>
              <p>${partnersWithInviters.filter(p => !p.inviter).length}</p>
            </div>
            <div class="stat-item">
              <h4>Общий баланс</h4>
              <p>${partnersWithInviters.reduce((sum, p) => sum + p.balance, 0).toFixed(2)} PZ</p>
            </div>
          </div>
          
          <div class="hierarchy-container">
            <h3>🌳 Дерево партнёрской иерархии:</h3>
            <div class="hierarchy-tree">
              ${hierarchyHtml || '<p style="text-align: center; color: #6c757d;">Партнёрская иерархия пуста</p>'}
            </div>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">📋 Обозначения:</h4>
            <p style="margin: 0; color: #856404;">
              👑 Корневые партнёры (без пригласителя) - нажмите для раскрытия<br>
              🥈 Партнёры 1-го уровня<br>
              🥉 Партнёры 2-го уровня<br>
              📋 Партнёры 3-го уровня и ниже<br>
              ▶ Нажмите на стрелку для раскрытия/скрытия уровней
            </p>
          </div>
        </div>
        
        <script>
          async function changeInviterPrompt(userId){
            const q = prompt('Введите @username пригласителя или код');
            if (!q) return;
            let payload = {};
            if (q.startsWith('@')) payload = { inviterUsername: q.replace(/^@/, '') };
            else payload = { newInviterCode: q };
            try{
              const resp = await fetch('/admin/users/' + userId + '/change-inviter', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(payload) });
              if (resp.redirected) { location.href = resp.url; return; }
              if (resp.ok) { alert('Пригласитель изменён'); location.reload(); }
              else { alert('Не удалось изменить пригласителя'); }
            }catch(e){ alert('Ошибка сети'); }
          }
          function toggleChildren(expandId, childrenId) {
            const expandIcon = document.getElementById(expandId);
            const children = document.getElementById(childrenId);
            
            if (children.style.display === 'none') {
              children.style.display = 'block';
              expandIcon.classList.add('expanded');
            } else {
              children.style.display = 'none';
              expandIcon.classList.remove('expanded');
            }
          }
          
          function expandAll() {
            const allExpandIcons = document.querySelectorAll('.expand-icon');
            const allChildren = document.querySelectorAll('.children');
            
            allExpandIcons.forEach(icon => {
              icon.classList.add('expanded');
            });
            
            allChildren.forEach(children => {
              children.style.display = 'block';
            });
          }
          
          function collapseAll() {
            const allExpandIcons = document.querySelectorAll('.expand-icon');
            const allChildren = document.querySelectorAll('.children');
            
            allExpandIcons.forEach(icon => {
              icon.classList.remove('expanded');
            });
            
            allChildren.forEach(children => {
              children.style.display = 'none';
            });
          }
        </script>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Partners hierarchy error:', error);
    res.status(500).send('Ошибка загрузки иерархии партнёров');
  }
});

// Handle partner inviter change
router.post('/partners/:id/change-inviter', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newInviterCode, inviterUsername } = req.body as any;

    let newInviter = null as any;
    if (inviterUsername) {
      const uname = String(inviterUsername).trim().replace(/^@/, '');
      const inviterUser = await prisma.user.findFirst({
        where: { username: { equals: uname } }
      });
      if (inviterUser) {
        newInviter = await prisma.partnerProfile.findFirst({ where: { userId: inviterUser.id }, include: { user: true } });
        if (!newInviter) {
          // Auto-create partner profile for inviter if missing
          const code = `REF${inviterUser.id.slice(-6)}${Date.now().toString().slice(-4)}`;
          try {
            newInviter = await prisma.partnerProfile.create({
              data: {
                userId: inviterUser.id,
                programType: 'MULTI_LEVEL',
                referralCode: code,
                balance: 0,
                bonus: 0
              },
              include: { user: true }
            });
          } catch { }
        }
      }
    } else if (newInviterCode) {
      newInviter = await prisma.partnerProfile.findUnique({ where: { referralCode: newInviterCode }, include: { user: true } });
    }

    if (!newInviter) {
      if ((req.headers['accept'] || '').toString().includes('application/json')) {
        return res.status(400).json({ success: false, error: 'inviter_not_found' });
      }
      return res.redirect('/admin/partners?error=inviter_not_found');
    }

    const currentPartner = await prisma.partnerProfile.findUnique({ where: { id }, include: { user: true } });
    if (!currentPartner) {
      if ((req.headers['accept'] || '').toString().includes('application/json')) {
        return res.status(404).json({ success: false, error: 'partner_not_found' });
      }
      return res.redirect('/admin/partners?error=partner_not_found');
    }

    await prisma.partnerReferral.deleteMany({ where: { referredId: currentPartner.userId } });
    await prisma.partnerReferral.create({ data: { profileId: newInviter.id, referredId: currentPartner.userId, level: 1 } });

    if ((req.headers['accept'] || '').toString().includes('application/json')) {
      return res.json({ success: true });
    }
    return res.redirect('/admin/partners?success=inviter_changed');
  } catch (error) {
    console.error('Change inviter error:', error);
    if ((req.headers['accept'] || '').toString().includes('application/json')) {
      return res.status(500).json({ success: false, error: 'inviter_change' });
    }
    return res.redirect('/admin/partners?error=inviter_change');
  }
});

// Partner balance adjust (used by /admin/partners actions)
router.post('/partners/:id/adjust-balance', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const op = String((req.body && (req.body.op || req.body.operation)) || '').trim();
    const amountRaw = (req.body && req.body.amount);
    const amount = Number.parseFloat(String(amountRaw || '0'));
    if (!id) return res.redirect('/admin/partners?error=balance_add');
    if (!Number.isFinite(amount) || amount <= 0) return res.redirect('/admin/partners?error=balance_add');

    const partner = await prisma.partnerProfile.findUnique({ where: { id }, include: { user: true } });
    if (!partner) return res.redirect('/admin/partners?error=partner_not_found');

    const isSub = (op === 'sub' || op === 'subtract' || op === 'debit' || op === '-');
    const txType = isSub ? 'DEBIT' : 'CREDIT';
    const txAmount = amount;
    const description = (isSub ? 'Admin: subtract balance' : 'Admin: add balance');

    // Update balance & bonus to keep them consistent
    await prisma.partnerProfile.update({
      where: { id },
      data: {
        balance: isSub ? { decrement: txAmount } : { increment: txAmount },
        bonus: isSub ? { decrement: txAmount } : { increment: txAmount },
      }
    });

    await prisma.partnerTransaction.create({
      data: {
        profileId: id,
        amount: txAmount,
        type: txType,
        description
      }
    });

    return res.redirect('/admin/partners?success=' + (isSub ? 'balance_subtracted' : 'balance_added'));
  } catch (error) {
    console.error('Partner adjust balance error:', error);
    return res.redirect('/admin/partners?error=balance_add');
  }
});

// Backward-compatible routes (old UI)
router.post('/partners/:id/add-balance', requireAdmin, async (req, res) => {
  req.body = { ...(req.body || {}), op: 'add' };
  return res.redirect(307, `/admin/partners/${encodeURIComponent(String(req.params.id || ''))}/adjust-balance`);
});
router.post('/partners/:id/subtract-balance', requireAdmin, async (req, res) => {
  req.body = { ...(req.body || {}), op: 'sub' };
  return res.redirect(307, `/admin/partners/${encodeURIComponent(String(req.params.id || ''))}/adjust-balance`);
});

// Fetch partners by level for a user
router.get('/users/:id/partners', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const level = parseInt(req.query.level as string) || 1;

    // Find user and check if they have a partner profile
    const user = await prisma.user.findUnique({
      where: { id },
      include: { partner: true }
    });

    if (!user || !user.partner) {
      return res.json([]);
    }

    let partnerIds: string[] = [];

    // Level 1: Direct referrals
    const level1Referrals = await prisma.partnerReferral.findMany({
      where: { profileId: user.partner.id }, // We know partner exists
      select: { referredId: true }
    });

    const level1Ids = level1Referrals.map(r => r.referredId).filter((id): id is string => id !== null);

    if (level === 1) {
      partnerIds = level1Ids;
    } else if (level === 2) {
      if (level1Ids.length === 0) return res.json([]);
      const level1Profiles = await prisma.partnerProfile.findMany({
        where: { userId: { in: level1Ids } },
        select: { id: true }
      });
      const level1ProfileIds = level1Profiles.map(p => p.id);

      const level2Referrals = await prisma.partnerReferral.findMany({
        where: { profileId: { in: level1ProfileIds } },
        select: { referredId: true }
      });
      partnerIds = level2Referrals.map(r => r.referredId).filter((id): id is string => id !== null);
    } else if (level === 3) {
      if (level1Ids.length === 0) return res.json([]);
      const level1Profiles = await prisma.partnerProfile.findMany({
        where: { userId: { in: level1Ids } },
        select: { id: true }
      });
      const level1ProfileIds = level1Profiles.map(p => p.id);

      const level2Referrals = await prisma.partnerReferral.findMany({
        where: { profileId: { in: level1ProfileIds } },
        select: { referredId: true }
      });
      const level2Ids = level2Referrals.map(r => r.referredId).filter((id): id is string => id !== null);

      if (level2Ids.length === 0) return res.json([]);
      const level2Profiles = await prisma.partnerProfile.findMany({
        where: { userId: { in: level2Ids } },
        select: { id: true }
      });
      const level2ProfileIds = level2Profiles.map(p => p.id);

      const level3Referrals = await prisma.partnerReferral.findMany({
        where: { profileId: { in: level2ProfileIds } },
        select: { referredId: true }
      });

      partnerIds = level3Referrals.map(r => r.referredId).filter((id): id is string => id !== null);
    }

    // Fetch user details
    const partners = await prisma.user.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, username: true, firstName: true, lastName: true, telegramId: true }
    });

    res.json(partners);

  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Ошибка при получении списка партнеров' });
  }
});

// Handle user inviter change
router.post('/users/:id/change-inviter', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newInviterCode, inviterUsername } = req.body as any;

    let newInviter = null as any;
    if (inviterUsername) {
      const uname = String(inviterUsername).trim().replace(/^@/, '');
      const inviterUser = await prisma.user.findFirst({
        where: { username: { equals: uname } }
      });
      if (inviterUser) {
        newInviter = await prisma.partnerProfile.findFirst({ where: { userId: inviterUser.id }, include: { user: true } });
        if (!newInviter) {
          const code = `REF${inviterUser.id.slice(-6)}${Date.now().toString().slice(-4)}`;
          try {
            newInviter = await prisma.partnerProfile.create({
              data: {
                userId: inviterUser.id,
                programType: 'MULTI_LEVEL',
                referralCode: code,
                balance: 0,
                bonus: 0
              },
              include: { user: true }
            });
          } catch { }
        }
      }
    } else if (newInviterCode) {
      newInviter = await prisma.partnerProfile.findUnique({ where: { referralCode: newInviterCode }, include: { user: true } });
    }

    if (!newInviter) {
      if ((req.headers['accept'] || '').toString().includes('application/json')) {
        return res.status(400).json({ success: false, error: 'inviter_not_found' });
      }
      return res.redirect('/admin/users?error=inviter_not_found');
    }

    const currentUser = await prisma.user.findUnique({ where: { id } });
    if (!currentUser) {
      if ((req.headers['accept'] || '').toString().includes('application/json')) {
        return res.status(404).json({ success: false, error: 'user_not_found' });
      }
      return res.redirect('/admin/users?error=user_not_found');
    }

    await prisma.partnerReferral.deleteMany({ where: { referredId: id } });
    await prisma.partnerReferral.create({ data: { profileId: newInviter.id, referredId: id, level: 1 } });

    if ((req.headers['accept'] || '').toString().includes('application/json')) {
      return res.json({ success: true });
    }
    return res.redirect('/admin/users?success=inviter_changed');
  } catch (error) {
    console.error('Change user inviter error:', error);
    if ((req.headers['accept'] || '').toString().includes('application/json')) {
      return res.status(500).json({ success: false, error: 'inviter_change' });
    }
    return res.redirect('/admin/users?error=inviter_change');
  }
});

// Delete user endpoint
router.delete('/users/:id/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting user:', id);

    // Find user first
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        partner: true,
        orders: true,
        cartItems: true,
        histories: true,
        payments: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    console.log(`🗑️ User found: ${user.firstName || 'Unknown'} (@${user.username || 'no username'})`);
    console.log(`   - Partner profile: ${user.partner ? 'YES' : 'NO'}`);
    console.log(`   - Orders: ${user.orders?.length || 0}`);
    console.log(`   - Cart items: ${user.cartItems?.length || 0}`);
    console.log(`   - Histories: ${user.histories?.length || 0}`);
    console.log(`   - Payments: ${user.payments?.length || 0}`);

    // Delete in correct order (dependencies first)
    // PartnerReferral with this user as referrer will be deleted via cascade
    // But we need to delete referrals where this user is the referred user
    await prisma.partnerReferral.deleteMany({
      where: { referredId: id }
    });
    console.log('   ✅ Deleted partner referrals');

    // PartnerProfile will be deleted via cascade when user is deleted
    // But transactions and referrals of the partner profile need to be handled
    if (user.partner) {
      await prisma.partnerTransaction.deleteMany({
        where: { profileId: user.partner.id }
      });
      await prisma.partnerReferral.deleteMany({
        where: { profileId: user.partner.id }
      });
      console.log('   ✅ Deleted partner transactions and referrals');
    }

    // Cart items will be deleted via cascade
    // Orders - we keep them but remove user reference
    await prisma.orderRequest.updateMany({
      where: { userId: id },
      data: { userId: null }
    });
    console.log('   ✅ Removed user from orders');

    // Histories will be deleted via cascade
    // Payments - we keep them but could remove user reference if needed

    // Finally delete the user (this will cascade delete partner profile, cart items, histories)
    await prisma.user.delete({
      where: { id }
    });
    console.log('   ✅ User deleted successfully');

    res.json({
      success: true,
      message: 'Пользователь успешно удален'
    });
  } catch (error: any) {
    console.error('❌ Delete user error:', error);
    console.error('❌ Error stack:', error?.stack);
    res.status(500).json({
      success: false,
      error: error?.message || 'Ошибка при удалении пользователя'
    });
  }
});

router.get('/products', requireAdmin, async (req, res) => {
  try {
    console.log('🛍️ Admin products page accessed');
    const categories = await prisma.category.findMany({
      include: {
        products: {
          include: { category: true },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: { name: 'asc' },
    });

    const allProducts = categories.flatMap((category) => category.products.map((product) => ({
      ...product,
      categoryName: category.name,
    })));

    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    const ICONS = {
      pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      power: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v10"/><path d="M6.4 4.9a8 8 0 1 0 11.2 0"/></svg>',
      camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>',
      image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 13 2-2 4 4 2-2 3 3"/><path d="M8.5 8.5h.01"/></svg>',
      trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    };

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Управление товарами</title>
        <meta charset="utf-8">
        
        <!-- Quill Rich Text Editor -->
        <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
        <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
        
        <style>
          ${ADMIN_UI_CSS}
          body { margin: 0; padding: 0; background: var(--admin-bg); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          /* Use shared .btn styles from ADMIN_UI_CSS (no gradients) */
          h2 { margin-top: 0; color: #1f2937; font-weight: 600; }
          .filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
          .filter-btn { padding: 8px 16px; border: 1px solid #111827; border-radius: 999px; background: transparent; color: #111827; cursor: pointer; transition: all 0.15s ease; }
          .filter-btn:hover { background: #111827; color: #fff; }
          .filter-btn.active { background: #111827; color: #fff; }
          .product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
          .product-card { position: relative; background: #fff; border-radius: 12px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); padding: 18px; display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
          .product-card:hover { transform: translateY(-4px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12); }
          .product-header { display: flex; justify-content: space-between; align-items: flex-start; }
          .product-title { font-size: 18px; font-weight: 600; color: #111827; margin: 0; }
          .badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; display: inline-block; }
          .badge-status-active { background: #dcfce7; color: #166534; }
          .badge-status-inactive { background: #fee2e2; color: #991b1b; }
          .status-btn { transition: all 0.2s ease; }
          .status-btn:hover { transform: scale(1.1); }
          .status-btn.active { color: #28a745; }
          .status-btn.inactive { color: #dc3545; }
          .badge-category { background: #e5e7eb; color: #374151; }
          .product-summary { color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0; }
          .product-price { font-size: 16px; font-weight: 600; color: #1f2937; }
          .product-meta { font-size: 12px; color: #6b7280; display: flex; justify-content: space-between; }
          .product-actions { display: grid; grid-template-columns: 1fr; gap: 10px; }
          .product-actions form { margin: 0; }

          /* Card action buttons (clean + consistent) */
          .btn-action{
            width: 100%;
            height: 52px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 0 16px;
            border-radius: 18px;
            font-weight: 800;
            font-size: 15px;
            cursor: pointer;
            border: 1px solid var(--admin-border-strong);
            background: #fff;
            color: var(--admin-text);
            box-shadow: 0 10px 22px rgba(17,24,39,0.06);
          }
          .btn-compact{ height: 40px; border-radius: 14px; font-size: 13px; font-weight: 800; box-shadow: none; }
          .btn-action .btn-ico{
            display:inline-flex;
            width: 18px;
            height: 18px;
            align-items:center;
            justify-content:center;
            flex: 0 0 18px;
          }
          .btn-action svg{
            width: 18px;
            height: 18px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
          .btn-outline{ background: #fff; }
          .btn-outline:hover{ background: rgba(17,24,39,0.06); }
          .btn-solid-black{
            background:#111827;
            border-color:#111827 !important;
            color:#fff;
          }
          .btn-solid-black:hover{
            background:#0b0f19;
            border-color:#0b0f19 !important;
          }
          .btn-solid-danger{
            background: var(--admin-danger);
            border-color: var(--admin-danger) !important;
            color:#fff;
          }
          .btn-solid-danger:hover{
            background:#b91c1c;
            border-color:#b91c1c !important;
          }
          .file-label-btn{ user-select:none; }
          .file-label-btn input{ display:none; }

          .admin-page-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin: 0 0 18px 0; }
          .admin-page-row .btn { min-width: 200px; justify-content: center; }
          
          /* Modal styles - Modern Design */
          .modal-overlay { 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); 
            z-index: 1000; display: flex; align-items: center; justify-content: center; 
            animation: modalFadeIn 0.3s ease-out;
          }
          @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes modalSlideIn { from { transform: translateY(-20px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
          
          .modal-content { 
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%); 
            border-radius: 16px; padding: 0; max-width: 700px; width: 95%; 
            max-height: 90vh; overflow-y: auto; 
            box-shadow: 0 25px 50px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.1); 
            animation: modalSlideIn 0.3s ease-out;
            border: 1px solid rgba(255,255,255,0.2);
          }
          
          .modal-header { 
            display: flex; justify-content: space-between; align-items: center; 
            padding: 24px 28px; border-bottom: 1px solid rgba(226, 232, 240, 0.8); 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px 16px 0 0;
            color: white;
          }
          .modal-header h2 { 
            margin: 0; font-size: 22px; font-weight: 700; 
            color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.1);
          }
          .close-btn { 
            background: rgba(255,255,255,0.2); border: none; font-size: 20px; 
            cursor: pointer; color: white; padding: 0; width: 32px; height: 32px; 
            display: flex; align-items: center; justify-content: center; 
            border-radius: 8px; transition: all 0.2s ease;
          }
          .close-btn:hover { background: rgba(255,255,255,0.3); transform: scale(1.1); }
          
          .modal-form { padding: 28px; }
          .form-section { margin-bottom: 24px; }
          .form-section-title { 
            font-size: 16px; font-weight: 600; color: #1e293b; 
            margin-bottom: 16px; padding-bottom: 8px; 
            border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 8px;
          }
          .form-section-title::before { content: ''; }
          
          .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .form-grid.single { grid-template-columns: 1fr; }
          
          .form-group { margin-bottom: 20px; }
          .form-group label { 
            display: block; margin-bottom: 8px; font-weight: 600; 
            color: #374151; font-size: 14px; text-transform: uppercase; 
            letter-spacing: 0.5px;
          }
          .form-group input, .form-group select, .form-group textarea { 
            width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; 
            border-radius: 10px; font-size: 14px; transition: all 0.2s ease;
            background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
            outline: none; border-color: #667eea; box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1); 
            transform: translateY(-1px);
          }
          .form-group textarea { min-height: 80px; resize: vertical; }
          .form-group textarea.large { min-height: 120px; }
          
          /* AI Translation button styles */
          .btn-translate {
            padding: 6px 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
            white-space: nowrap;
          }
          .btn-translate:hover {
            background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
          }
          .btn-translate:active {
            transform: translateY(0);
          }
          .btn-translate:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          
          .price-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .price-input { position: relative; }
          .price-input::after { 
            content: 'PZ'; position: absolute; right: 12px; top: 50%; 
            transform: translateY(-50%); color: #6b7280; font-weight: 600; 
            pointer-events: none;
          }
          .price-input.rub::after { content: 'RUB'; }
          
          .form-actions { 
            display: flex; gap: 16px; justify-content: flex-end; 
            padding: 24px 28px; border-top: 1px solid rgba(226, 232, 240, 0.8); 
            background: #f8fafc; border-radius: 0 0 16px 16px;
          }
          .form-actions button { 
            padding: 12px 24px; border: none; border-radius: 10px; 
            font-weight: 600; cursor: pointer; transition: all 0.2s ease; 
            font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .form-actions button[type="button"] { 
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
            color: #64748b; border: 1px solid #cbd5e1;
          }
          .form-actions button[type="button"]:hover { 
            background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); 
            transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.15);
          }
          .form-actions button[type="submit"] { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; border: 1px solid #5a67d8;
          }
          .form-actions button[type="submit"]:hover { 
            background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%); 
            transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
          
          .regions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
          .switch-row { 
            display: flex; align-items: center; gap: 12px; cursor: pointer; 
            padding: 12px; border: 2px solid #e2e8f0; border-radius: 10px; 
            transition: all 0.2s ease; background: #ffffff;
          }
          .switch-row:hover { border-color: #667eea; background: #f8fafc; }
          .switch-row input[type="checkbox"], .status-row input[type="checkbox"] { display: none; }
          .switch-slider { 
            width: 48px; height: 28px; background: #cbd5e1; 
            border-radius: 14px; position: relative; transition: all 0.3s ease; 
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
          }
          .switch-slider::before { 
            content: ''; position: absolute; top: 3px; left: 3px; 
            width: 22px; height: 22px; background: white; border-radius: 50%; 
            transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .switch-row input[type="checkbox"]:checked + .switch-slider,
          .status-row input[type="checkbox"]:checked + .switch-slider { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          }
          .switch-row input[type="checkbox"]:checked + .switch-slider::before,
          .status-row input[type="checkbox"]:checked + .switch-slider::before { 
            transform: translateX(20px); 
          }
          .switch-label { font-weight: 600; color: #374151; }
          
          .status-section { background: #f8fafc; padding: 16px; border-radius: 10px; border: 2px solid #e2e8f0; }
          .status-row { display: flex; align-items: center; gap: 12px; }
          .status-label { font-weight: 600; color: #374151; font-size: 16px; }
          
          /* Responsive */
          @media (max-width: 768px) {
            .modal-content { width: 98%; margin: 10px; }
            .form-grid { grid-template-columns: 1fr; }
            .price-row { grid-template-columns: 1fr; }
            .regions-grid { grid-template-columns: 1fr; }
            .form-actions { flex-direction: column; }
          }
          /* Remove legacy rainbow button styles in cards */
          /* iOS/Safari: input[type=file].click() may fail if input is display:none.
             Keep it in DOM (not display:none) but visually hidden. */
          .product-image-input {
            position: absolute;
            width: 1px;
            height: 1px;
            opacity: 0;
            overflow: hidden;
            pointer-events: none;
            left: -9999px;
          }
          .file-label-btn {
            display: inline-block;
            user-select: none;
          }
          /* Instruction button removed from cards; keep empty to avoid accidental legacy overrides */
          .empty-state { text-align: center; padding: 60px 20px; color: #6b7280; background: #fff; border-radius: 12px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); }
          img.product-image { width: 100%; height: 200px; object-fit: cover; border-radius: 10px; }
          .product-image-placeholder { 
            width: 100%; 
            height: 200px; 
            border: 2px dashed #d1d5db; 
            border-radius: 10px; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            background: #f9fafb; 
            color: #6b7280; 
          }
          .placeholder-icon { font-size: 32px; margin-bottom: 8px; }
          .placeholder-text { font-size: 14px; font-weight: 500; }
          .product-image-btn{
            display:block;
            width:100%;
            padding:0;
            margin:0;
            border:none;
            background: transparent;
            cursor:pointer;
          }
          .product-image-btn:focus-visible{
            outline: 3px solid rgba(102,126,234,0.35);
            outline-offset: 3px;
            border-radius: 12px;
          }
          .card-toggle-form{
            position:absolute;
            top: 12px;
            right: 12px;
            z-index: 2;
            margin: 0;
          }
          .card-toggle-btn{
            width: 40px;
            height: 40px;
            border-radius: 14px;
            border: 1px solid var(--admin-border-strong);
            background: rgba(255,255,255,0.9);
            backdrop-filter: blur(6px);
            color: #111827;
            display:flex;
            align-items:center;
            justify-content:center;
            cursor:pointer;
            box-shadow: 0 10px 22px rgba(17,24,39,0.08);
          }
          .card-toggle-btn:hover{ background: rgba(17,24,39,0.06); }
          .card-toggle-btn svg{
            width: 18px;
            height: 18px;
            stroke: currentColor;
            fill: none;
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
          }
          .card-toggle-btn.is-inactive{
            background: #111827;
            border-color: #111827;
            color: #fff;
          }
          .card-toggle-btn.is-inactive:hover{ background: #0b0f19; }
          .alert { padding: 12px 16px; margin: 16px 0; border-radius: 8px; font-weight: 500; }
          .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
          .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
          
          /* Instruction modal styles */
          .instruction-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .instruction-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .instruction-content {
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow: hidden;
            transform: scale(0.8);
            transition: transform 0.3s ease;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
          }
          .instruction-header {
            padding: 20px 24px 16px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .instruction-header h3 {
            color: #333;
            font-size: 18px;
            font-weight: 600;
            margin: 0;
          }
          .btn-close {
            background: none;
            border: none;
            color: #6c757d;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.3s ease;
          }
          .btn-close:hover {
            background: #f8f9fa;
            color: #333;
          }
          .instruction-body {
            padding: 20px 24px;
            max-height: 50vh;
            overflow-y: auto;
          }
          .instruction-text {
            color: #333;
            line-height: 1.6;
            font-size: 14px;
            white-space: pre-wrap;
          }
          .instruction-footer {
            padding: 16px 24px 20px;
            border-top: 1px solid #e9ecef;
            display: flex;
            justify-content: flex-end;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .btn-secondary:hover {
            background: #5a6268;
          }
        </style>
<script>
// КРИТИЧНО: Определяем функции глобально ДО загрузки HTML, чтобы они были доступны для onclick обработчиков
// Защита от ошибок выполнения - оборачиваем в try-catch
try {
  window.editProduct = function (button) {
    console.log('🔵 editProduct called', button);

    if (!button) {
      console.error('❌ editProduct: button is required');
      alert('Ошибка: кнопка не найдена');
      return;
    }

    // Safely extract data from button attributes
    const productId = String(button.dataset.id || '').trim();
    const title = String(button.dataset.title || '').trim();
    const summary = String(button.dataset.summary || '').trim();
    const description = String(button.dataset.description || '').trim();
    const price = String(button.dataset.price || '0').trim();
    const categoryId = String(button.dataset.categoryId || '').trim();
    const isActive = String(button.dataset.active || 'false').trim() === 'true';
    const availableInRussia = String(button.dataset.russia || 'false').trim() === 'true';
    const availableInBali = String(button.dataset.bali || 'false').trim() === 'true';
    const imageUrl = String(button.dataset.image || '').trim();
    const stock = String(button.dataset.stock || '').trim();

    console.log('📦 Product data extracted:', {
      productId: productId.substring(0, 10) + '...',
      title: title.substring(0, 30) + '...',
      price,
      categoryId,
      isActive,
      isActive,
      availableInRussia,
      availableInBali,
      stock
    });

    if (!productId) {
      console.error('❌ Product ID is missing');
      alert('Ошибка: ID товара не найден');
      return;
    }

    // Create modal if it doesn't exist
    let modal = document.getElementById('editProductModal');
    if (!modal) {
      console.log('🔵 Creating new edit modal');
      modal = document.createElement('div');
      modal.id = 'editProductModal';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; align-items: center; justify-content: center;';
      modal.onclick = function (e) {
        if (e.target === modal) {
          window.closeEditModal();
        }
      };
      const content = document.createElement('div');
      content.className = 'modal-content';
      content.style.cssText = 'background: white; border-radius: 12px; padding: 0; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';
      content.addEventListener('click', function (e) { e.stopPropagation(); });
      // Разбиваем длинную innerHTML строку на части для предотвращения SyntaxError
content.innerHTML =
    '<div class="modal-header">' +
    '<h2>Редактировать товар</h2>' +
    '<button type="button" class="close-btn" onclick="window.closeEditModal()">&times;</button>' +
    '</div>' +
    '<form id="editProductForm" enctype="multipart/form-data" class="modal-form">' +
    '<input type="hidden" id="editProductId" name="productId" value="">' +
    '<div class="form-section">' +
    '<div class="form-section-title">Основная информация</div>' +
    '<div class="form-grid single">' +
    '<div class="form-group">' +
    '<label for="editProductName">Название товара</label>' +
    '<input type="text" id="editProductName" name="title" required placeholder="Введите название товара">' +
    '</div>' +
    '</div>' +
    '<div class="form-grid">' +
    '<div class="form-group">' +
    '<label for="editProductPrice">Цена в PZ</label>' +
    '<div class="price-input">' +
    '<input type="number" id="editProductPrice" name="price" step="0.01" required placeholder="0.00">' +
    '</div>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="editProductPriceRub">Цена в RUB</label>' +
    '<div class="price-input rub">' +
    '<input type="number" id="editProductPriceRub" name="priceRub" step="0.01" readonly placeholder="0.00">' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="form-grid">' +
    '<div class="form-group">' +
    '<label for="editProductStock">Остаток на складе</label>' +
    '<input type="number" id="editProductStock" name="stock" value="999" required placeholder="999">' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="editProductCategory">Категория</label>' +
    '<select id="editProductCategory" name="categoryId" required>' +
    '<option value="">Загрузка категорий...</option>' +
    '</select>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="form-section">' +
    '<div class="form-section-title">Описание товара</div>' +
    '<div class="form-group">' +
    '<label for="editProductSummary">Краткое описание</label>' +
    '<textarea id="editProductSummary" name="summary" rows="3" placeholder="Краткое описание для карточки товара"></textarea>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="editProductDescription">Полное описание</label>' +
    '<textarea id="editProductDescription" name="description" style="display:none;"></textarea>' +
    '<div id="editProductDescriptionEditor" style="height: 250px; background: #fff; border-radius: 0 0 10px 10px;"></div>' +
    '</div>' +
    '</div>' +
    '<div class="form-group">' +
    '<label for="editProductInstruction">Инструкция (опционально)</label>' +
    '<textarea id="editProductInstruction" name="instruction" style="display:none;"></textarea>' +
    '<div id="editProductInstructionEditor" style="height: 150px; background: #fff; border-radius: 0 0 10px 10px;"></div>' +
    '</div>' +
    '</div>' +
    '<div class="form-section">' +
    '<div class="form-section-title">Настройки доставки</div>' +
    '<div class="form-group">' +
    '<label>Регионы доставки</label>' +
    '<div class="regions-grid">' +
    '<label class="switch-row">' +
    '<input type="checkbox" id="editProductRussia" name="availableInRussia">' +
    '<span class="switch-slider"></span>' +
    '<span class="switch-label">Россия</span>' +
    '</label>' +
    '<label class="switch-row">' +
    '<input type="checkbox" id="editProductBali" name="availableInBali">' +
    '<span class="switch-slider"></span>' +
    '<span class="switch-label">Бали</span>' +
    '</label>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="form-section">' +
    '<div class="form-section-title">Статус публикации</div>' +
    '<div class="status-section">' +
    '<label class="status-row">' +
    '<input type="checkbox" id="editProductStatus" name="isActive">' +
    '<span class="switch-slider"></span>' +
    '<span class="status-label">Товар активен и доступен для покупки</span>' +
    '</label>' +
    '</div>' +
    '</div>' +
    '<div class="form-actions">' +
    '<button type="button" onclick="window.closeEditModal()">Отмена</button>' +
    '<button type="submit">Обновить товар</button>' +
    '</div>' +
    '</form>';
modal.appendChild(content);
(document.querySelector('.admin-shell') || document.body).appendChild(modal);

// Initialize Quill for editProductModal
if (typeof window.dashboardEditQuill === 'undefined') {
  window.dashboardEditQuill = undefined;
}
if (typeof Quill !== 'undefined' && document.getElementById('editProductDescriptionEditor')) {
  window.dashboardEditQuill = new Quill('#editProductDescriptionEditor', {
    theme: 'snow',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'header': [1, 2, 3, false] }],
        [{ 'color': [] }, { 'background': [] }],
        ['clean']
      ]
    }
  });
  // Load existing description
  const existingDesc = document.getElementById('editProductDescription').value;
  window.dashboardEditQuill.clipboard.dangerouslyPasteHTML(existingDesc || '');
}

if (typeof Quill !== 'undefined' && document.getElementById('editProductInstructionEditor')) {
  if (!window.editInstructionQuill) {
    window.editInstructionQuill = new Quill('#editProductInstructionEditor', {
      theme: 'snow',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['clean']
        ]
      }
    });
  }
}

// Setup form submission handler - удаляем старый обработчик если есть
const editForm = document.getElementById('editProductForm');
if (editForm) {
  // Удаляем старый обработчик если есть
  const oldHandler = editForm.getAttribute('data-handler-attached');
  if (oldHandler) {
    editForm.removeEventListener('submit', oldHandler);
  }

  // Создаем новый обработчик
  const submitHandler = function (e) {
    e.preventDefault();
    e.stopPropagation();

    const form = e.target;
    const formData = new FormData(form);
    const productId = formData.get('productId');

    if (!productId) {
      alert('Ошибка: ID товара не найден');
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append('productId', String(productId));
    formDataToSend.append('title', String(formData.get('title') || ''));
    formDataToSend.append('price', String(formData.get('price') || '0'));
    formDataToSend.append('summary', String(formData.get('summary') || ''));
    
    let descriptionHtml = String(formData.get('description') || '');
    if (window.dashboardEditQuill) {
      descriptionHtml = window.dashboardEditQuill.root.innerHTML;
      if (descriptionHtml === '<p><br></p>') descriptionHtml = '';
    }
    formDataToSend.append('description', descriptionHtml);
    
    let instructionHtml = String(formData.get('instruction') || '');
    if (window.editInstructionQuill) {
      instructionHtml = window.editInstructionQuill.root.innerHTML;
      if (instructionHtml === '<p><br></p>') instructionHtml = '';
    }
    formDataToSend.append('instruction', instructionHtml);
    formDataToSend.append('categoryId', String(formData.get('categoryId') || ''));
    formDataToSend.append('stock', String(formData.get('stock') || '999'));

    const statusCheckbox = document.getElementById('editProductStatus');
    const russiaCheckbox = document.getElementById('editProductRussia');
    const baliCheckbox = document.getElementById('editProductBali');

    if (statusCheckbox && statusCheckbox.checked) {
      formDataToSend.append('isActive', 'true');
    } else {
      formDataToSend.append('isActive', 'false');
    }

    if (russiaCheckbox && russiaCheckbox.checked) {
      formDataToSend.append('availableInRussia', 'true');
    } else {
      formDataToSend.append('availableInRussia', 'false');
    }

    if (baliCheckbox && baliCheckbox.checked) {
      formDataToSend.append('availableInBali', 'true');
    } else {
      formDataToSend.append('availableInBali', 'false');
    }

    console.log('📤 Sending update request for product:', productId);

    fetch('/admin/products/' + productId + '/update', {
      method: 'POST',
      body: formDataToSend,
      credentials: 'include'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('HTTP ' + response.status);
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          alert('✅ Товар успешно обновлен!');
          window.closeEditModal();
          setTimeout(() => {
            if (typeof window.reloadAdminProductsPreservingState === 'function') {
              window.reloadAdminProductsPreservingState({ success: 'product_updated' });
            } else {
              location.reload();
            }
          }, 150);
        } else {
          alert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
      })
      .catch(error => {
        console.error('❌ Update error:', error);
        alert('❌ Ошибка при обновлении товара: ' + (error instanceof Error ? error.message : String(error)));
      });
  };

  editForm.addEventListener('submit', submitHandler);
  editForm.setAttribute('data-handler-attached', 'true');
}
    }

// Helper function to decode HTML entities safely
const decodeHtml = function (html) {
  if (!html) return '';
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

// Fill form fields with decoded values
try {
  const editProductIdEl = document.getElementById('editProductId');
  const editProductNameEl = document.getElementById('editProductName');
  const editProductSummaryEl = document.getElementById('editProductSummary');
  const editProductDescriptionEl = document.getElementById('editProductDescription');
  const editProductPriceEl = document.getElementById('editProductPrice');
  const editProductPriceRubEl = document.getElementById('editProductPriceRub');
  const editProductStockEl = document.getElementById('editProductStock');
  const editProductStatusEl = document.getElementById('editProductStatus');
  const editProductRussiaEl = document.getElementById('editProductRussia');
  const editProductBaliEl = document.getElementById('editProductBali');

  if (!editProductIdEl || !editProductNameEl || !editProductPriceEl) {
    console.error('❌ Required form elements not found');
    alert('Ошибка: форма редактирования не найдена. Пожалуйста, обновите страницу.');
    return;
  }

  editProductIdEl.value = productId || '';
  if (editProductNameEl) editProductNameEl.value = decodeHtml(title) || '';
  if (editProductSummaryEl) editProductSummaryEl.value = decodeHtml(summary) || '';
  if (editProductDescriptionEl) editProductDescriptionEl.value = decodeHtml(description) || '';
  if (window.dashboardEditQuill) {
    window.dashboardEditQuill.clipboard.dangerouslyPasteHTML(decodeHtml(description) || '');
  }
  editProductPriceEl.value = price || '0';
  if (editProductPriceRubEl) editProductPriceRubEl.value = ((parseFloat(price) || 0) * 100).toFixed(2);
  if (editProductStockEl) editProductStockEl.value = stock && stock !== 'null' && stock !== 'undefined' ? stock : '999';
  if (editProductStatusEl) editProductStatusEl.checked = isActive;
  if (editProductRussiaEl) editProductRussiaEl.checked = availableInRussia;
  if (editProductBaliEl) editProductBaliEl.checked = availableInBali;

  console.log('✅ Form fields filled:', {
    productId,
    title: title.substring(0, 50),
    price,
    isActive,
    availableInRussia,
    availableInBali
  });
} catch (error) {
  console.error('❌ Error filling form fields:', error);
  alert('Ошибка при загрузке данных товара: ' + (error instanceof Error ? error.message : String(error)));
  return;
}

// Load categories
fetch('/admin/api/categories', { credentials: 'include' })
  .then(response => response.json())
  .then(categories => {
    const select = document.getElementById('editProductCategory');
    if (select) {
      select.innerHTML = '<option value="">Выберите категорию</option>';
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        if (category.id === categoryId) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }
  })
  .catch(error => {
    console.error('Error loading categories:', error);
  });

// Add price conversion
const priceInput = document.getElementById('editProductPrice');
const priceRubInput = document.getElementById('editProductPriceRub');
if (priceInput && priceRubInput) {
  priceInput.oninput = function () {
    const pzPrice = parseFloat(this.value) || 0;
    priceRubInput.value = (pzPrice * 100).toFixed(2);
  };
  priceRubInput.oninput = function () {
    const rubPrice = parseFloat(this.value) || 0;
    priceInput.value = (rubPrice / 100).toFixed(2);
  };
}

// Show modal
console.log('✅ Showing edit modal');
console.log('✅ Modal element:', modal);
console.log('✅ Modal in DOM:', document.body.contains(modal));

// Убеждаемся, что модальное окно в DOM
if (!document.body.contains(modal)) {
  console.log('⚠️ Modal not in DOM, appending...');
  (document.querySelector('.admin-shell') || document.body).appendChild(modal);
}

// Устанавливаем стили для показа
modal.style.display = 'flex';
modal.style.alignItems = 'center';
modal.style.justifyContent = 'center';
modal.style.position = 'fixed';
modal.style.top = '0';
modal.style.left = '0';
modal.style.width = '100%';
modal.style.height = '100%';
modal.style.background = 'rgba(0,0,0,0.6)';
modal.style.zIndex = '10000';

console.log('✅ Modal display set to:', modal.style.display);
console.log('✅ Modal computed style:', window.getComputedStyle(modal).display);

// Убеждаемся, что модальное окно видимо (и не переоткрываем после закрытия)
try { modal.dataset.__closing = '0'; } catch (_) { }
if (modal.__forceShowTimer) { try { clearTimeout(modal.__forceShowTimer); } catch (_) { } }
modal.__forceShowTimer = setTimeout(() => {
  try {
    if (modal.dataset && modal.dataset.__closing === '1') return;
  } catch (_) { }
  const computedDisplay = window.getComputedStyle(modal).display;
  if (computedDisplay === 'none') {
    console.error('❌ Modal still hidden! Forcing display...');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
  } else {
    console.log('✅ Modal is visible, display:', computedDisplay);
  }
}, 50);
  };
} catch (e) {
  console.error('❌ CRITICAL ERROR defining window.editProduct:', e);
  window.editProduct = function () {
    alert('Ошибка: функция редактирования не загружена. Обновите страницу.');
  };
}

window.closeEditModal = function () {
  const modal = document.getElementById('editProductModal');
  if (modal) {
    try { modal.dataset.__closing = '1'; } catch (_) { }
    if (modal.__forceShowTimer) { try { clearTimeout(modal.__forceShowTimer); } catch (_) { } }
    // remove to avoid any CSS/display re-open edge cases
    modal.remove();
  }
};

// NOTE: Инструкция удалена из карточек по требованию — не держим лишние обработчики,
// чтобы не ломать парсинг JS в HTML-шаблоне.

// КРИТИЧНО: Проверяем, что функция определена
if (typeof window.editProduct !== 'function') {
  console.error('❌ CRITICAL: window.editProduct is not a function after definition!');
  window.editProduct = function () {
    alert('Ошибка: функция редактирования не загружена. Обновите страницу.');
  };
} else {
  console.log('✅ window.editProduct successfully defined');
}

// ===== /admin/products UI state (filter/search/view/sort) =====
window.__adminProductsState = window.__adminProductsState || {
  filter: 'all',
  q: '',
  view: 'cards', // cards | table
  sort: 'title_asc' // title_asc | title_desc | category_asc | category_desc
};

function __safeStr(v) { try { return String(v || ''); } catch (_) { return ''; } }
function __norm(v) { return __safeStr(v).trim().toLowerCase(); }

window.__setAdminProductsUrl = function () {
  try {
    const st = window.__adminProductsState || {};
    const url = new URL(window.location.href);
    url.searchParams.set('filter', __safeStr(st.filter || 'all'));
    url.searchParams.set('q', __safeStr(st.q || ''));
    url.searchParams.set('view', __safeStr(st.view || 'cards'));
    url.searchParams.set('sort', __safeStr(st.sort || 'title_asc'));
    // не ломаем success/error если они есть
    window.history.replaceState(null, '', url.toString());
  } catch (e) {
    console.warn('Failed to update URL state:', e);
  }
};

window.__persistAdminProductsState = function () {
  try {
    const st = window.__adminProductsState || {};
    localStorage.setItem('admin_products_filter', __safeStr(st.filter || 'all'));
    localStorage.setItem('admin_products_q', __safeStr(st.q || ''));
    localStorage.setItem('admin_products_view', __safeStr(st.view || 'cards'));
    localStorage.setItem('admin_products_sort', __safeStr(st.sort || 'title_asc'));
  } catch (e) {
    console.warn('Failed to persist admin products state:', e);
  }
};

window.__restoreAdminProductsState = function () {
  try {
    const st = window.__adminProductsState || {};
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    const urlFilter = sp.get('filter');
    const urlQ = sp.get('q');
    const urlView = sp.get('view');
    const urlSort = sp.get('sort');

    const lsFilter = localStorage.getItem('admin_products_filter');
    const lsQ = localStorage.getItem('admin_products_q');
    const lsView = localStorage.getItem('admin_products_view');
    const lsSort = localStorage.getItem('admin_products_sort');

    st.filter = (urlFilter !== null ? urlFilter : (lsFilter || st.filter || 'all')) || 'all';
    st.q = (urlQ !== null ? urlQ : (lsQ || st.q || '')) || '';
    st.view = (urlView !== null ? urlView : (lsView || st.view || 'cards')) || 'cards';
    st.sort = (urlSort !== null ? urlSort : (lsSort || st.sort || 'title_asc')) || 'title_asc';
    window.__adminProductsState = st;
  } catch (e) {
    console.warn('Failed to restore admin products state:', e);
  }
};

window.__applyAdminProductsView = function () {
  try {
    const st = window.__adminProductsState || {};
    const cardsWrap = document.getElementById('productsCardsContainer');
    const tableWrap = document.getElementById('productsTableContainer');
    const sortWrap = document.getElementById('productsSortWrap');
    if (cardsWrap && tableWrap) {
      if (st.view === 'table') {
        cardsWrap.style.display = 'none';
        tableWrap.style.display = 'block';
        if (sortWrap) sortWrap.style.display = 'flex';
      } else {
        tableWrap.style.display = 'none';
        cardsWrap.style.display = 'block';
        if (sortWrap) sortWrap.style.display = 'none';
      }
    }
    const btnCards = document.getElementById('viewCardsBtn');
    const btnTable = document.getElementById('viewTableBtn');
    if (btnCards && btnCards.classList && btnTable && btnTable.classList) {
      btnCards.classList.toggle('active', st.view !== 'table');
      btnTable.classList.toggle('active', st.view === 'table');
    }
  } catch (e) {
    console.warn('Failed to apply view:', e);
  }
};

window.__sortAdminProductsTable = function () {
  try {
    const st = window.__adminProductsState || {};
    const table = document.getElementById('productsTable');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const sort = __safeStr(st.sort || 'title_asc');
    const by = sort.startsWith('category') ? 'category' : 'title';
    const dir = sort.endsWith('_desc') ? -1 : 1;
    rows.sort((a, b) => {
      const av = __norm(a.getAttribute('data-' + by));
      const bv = __norm(b.getAttribute('data-' + by));
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    rows.forEach(r => tbody.appendChild(r));
  } catch (e) {
    console.warn('Failed to sort table:', e);
  }
};

window.__applyAdminProductsFilters = function () {
  try {
    const st = window.__adminProductsState || {};
    const filter = __safeStr(st.filter || 'all');
    const q = __norm(st.q || '');

    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
      const catOk = (filter === 'all' || __safeStr(card.dataset.category) === filter);
      const title = __norm(card.getAttribute('data-title') || '');
      const sku = __norm(card.getAttribute('data-sku') || '');
      const qOk = (!q || title.includes(q) || sku.includes(q));
      card.style.display = (catOk && qOk) ? 'flex' : 'none';
    });

    const rows = document.querySelectorAll('#productsTable tbody tr');
    rows.forEach(row => {
      const rowCat = __safeStr(row.getAttribute('data-category-id') || '');
      const catOk = (filter === 'all' || rowCat === filter);
      const title = __norm(row.getAttribute('data-title') || '');
      const sku = __norm(row.getAttribute('data-sku') || '');
      const qOk = (!q || title.includes(q) || sku.includes(q));
      row.style.display = (catOk && qOk) ? '' : 'none';
    });

    // active button
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector('.filter-btn[data-filter="' + filter.replace(/"/g, '\\"') + '"]');
    if (activeBtn && activeBtn.classList) activeBtn.classList.add('active');

    window.__applyAdminProductsView();
    window.__sortAdminProductsTable();
    window.__persistAdminProductsState();
    window.__setAdminProductsUrl();
  } catch (e) {
    console.error('applyAdminProductsFilters error:', e);
  }
};

window.setAdminProductsView = function (view) {
  const st = window.__adminProductsState || {};
  st.view = (view === 'table') ? 'table' : 'cards';
  window.__adminProductsState = st;
  window.__applyAdminProductsFilters();
};

window.setAdminProductsSort = function (sort) {
  const st = window.__adminProductsState || {};
  st.sort = __safeStr(sort || 'title_asc') || 'title_asc';
  window.__adminProductsState = st;
  window.__applyAdminProductsFilters();
};

window.setAdminProductsSearch = function (value) {
  const st = window.__adminProductsState || {};
  st.q = __safeStr(value || '');
  window.__adminProductsState = st;
  window.__applyAdminProductsFilters();
};

// КРИТИЧНО: фильтры категорий должны работать даже если нижний <script> сломается
window.filterProducts = function (button) {
  try {
    const filter = button && button.dataset ? button.dataset.filter : 'all';
    const st = window.__adminProductsState || {};
    st.filter = __safeStr(filter || 'all') || 'all';
    window.__adminProductsState = st;
    window.__applyAdminProductsFilters();
  } catch (e) {
    console.error('filterProducts error:', e);
  }
};

window.reloadAdminProductsPreservingState = function (extraParams) {
  try {
    const st = window.__adminProductsState || {};
    const url = new URL(window.location.href);
    url.searchParams.set('filter', __safeStr(st.filter || 'all'));
    url.searchParams.set('q', __safeStr(st.q || ''));
    url.searchParams.set('view', __safeStr(st.view || 'cards'));
    url.searchParams.set('sort', __safeStr(st.sort || 'title_asc'));
    if (extraParams && typeof extraParams === 'object') {
      Object.keys(extraParams).forEach(k => {
        if (extraParams[k] === null || typeof extraParams[k] === 'undefined') return;
        url.searchParams.set(k, __safeStr(extraParams[k]));
      });
    }
    window.location.href = url.toString();
  } catch (e) {
    console.warn('reloadAdminProductsPreservingState failed, fallback reload:', e);
    window.location.reload();
  }
};

// ===== Table thumbnails modal (preview + replace image) =====
window.__tableImageModalState = window.__tableImageModalState || { productId: null, title: '' };

window.openTableImageModal = function (productId, imageUrl, title) {
  try {
    const modal = document.getElementById('tableImageModal');
    const img = document.getElementById('tableImageModalImg');
    const titleEl = document.getElementById('tableImageModalTitle');
    const empty = document.getElementById('tableImageModalEmpty');
    const pid = __safeStr(productId);
    if (!modal || !img || !titleEl || !pid) return;

    window.__tableImageModalState.productId = pid;
    window.__tableImageModalState.title = __safeStr(title);
    titleEl.textContent = __safeStr(title) || 'Фото товара';

    const src = __safeStr(imageUrl);
    if (src) {
      img.src = src;
      img.style.display = 'block';
      if (empty) empty.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.style.display = 'none';
      if (empty) empty.style.display = 'block';
    }

    modal.style.display = 'flex';
    modal.onclick = function (e) { if (e && e.target === modal) window.closeTableImageModal(); };
  } catch (e) {
    console.error('openTableImageModal error:', e);
  }
};

window.closeTableImageModal = function () {
  try {
    const modal = document.getElementById('tableImageModal');
    const input = document.getElementById('tableImageFileInput');
    const img = document.getElementById('tableImageModalImg');
    const empty = document.getElementById('tableImageModalEmpty');
    if (modal) modal.style.display = 'none';
    if (input) input.value = '';
    if (img) { img.removeAttribute('src'); img.style.display = 'none'; }
    if (empty) empty.style.display = 'block';
    window.__tableImageModalState.productId = null;
    window.__tableImageModalState.title = '';
  } catch (_) { }
};

window.triggerTableImageReplace = function () {
  try {
    const input = document.getElementById('tableImageFileInput');
    if (input) input.click();
  } catch (_) { }
};

window.handleTableImageFileSelected = async function (inputEl) {
  try {
    const pid = window.__tableImageModalState && window.__tableImageModalState.productId;
    if (!pid) return;
    if (!inputEl || !inputEl.files || !inputEl.files[0]) return;

    const btn = document.getElementById('tableImageReplaceBtn');
    const oldText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Загрузка...'; }

    const formData = new FormData();
    formData.append('image', inputEl.files[0]);

    const resp = await fetch('/admin/products/' + encodeURIComponent(pid) + '/upload-image', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    if (resp && resp.ok) {
      window.closeTableImageModal();
      if (typeof window.reloadAdminProductsPreservingState === 'function') {
        window.reloadAdminProductsPreservingState({ success: 'image_updated', view: 'table' });
      } else {
        location.reload();
      }
    } else {
      alert('❌ Ошибка загрузки фото (HTTP ' + (resp ? resp.status : '0') + ')');
    }

    if (btn) { btn.disabled = false; btn.textContent = oldText || 'Заменить фото'; }
  } catch (e) {
    console.error('handleTableImageFileSelected error:', e);
    alert('❌ Ошибка: ' + (e && e.message ? e.message : String(e)));
    try {
      const btn = document.getElementById('tableImageReplaceBtn');
      if (btn) { btn.disabled = false; btn.textContent = 'Заменить фото'; }
    } catch (_) { }
  }
};

// КРИТИЧНО: галерея "Выбрать из загруженных" должна работать даже если нижний <script> сломается
if (typeof window.closeImageGallery !== 'function') {
  window.closeImageGallery = function () {
    const modal = document.getElementById('imageGalleryModal');
    if (modal) modal.remove();
    try {
      const html = document.documentElement;
      const body = document.body;
      const prevHtml = html.getAttribute('data-prev-overflow');
      const prevBody = body.getAttribute('data-prev-overflow');
      if (prevHtml !== null) html.style.overflow = prevHtml;
      if (prevBody !== null) body.style.overflow = prevBody;
      html.removeAttribute('data-prev-overflow');
      body.removeAttribute('data-prev-overflow');
    } catch (_) { }
  };
}

if (typeof window.selectGalleryImage !== 'function') {
  window.selectGalleryImage = async function (imageUrl, productId) {
    try {
      if (!imageUrl || !productId) return;
      const response = await fetch('/admin/api/products/' + encodeURIComponent(productId) + '/select-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageUrl: String(imageUrl).trim() })
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result && result.success) {
        window.closeImageGallery();
        setTimeout(() => location.reload(), 300);
      } else {
        alert('❌ Ошибка: ' + (result.error || ('HTTP ' + response.status)));
      }
    } catch (e) {
      alert('❌ Ошибка: ' + (e instanceof Error ? e.message : String(e)));
    }
  };
}

if (typeof window.loadGalleryImages !== 'function') {
  window.loadGalleryImages = async function (productId) {
    const galleryContent = document.getElementById('galleryContent');
    if (!galleryContent) return;
    const previewImg = document.getElementById('galleryPreviewImg');
    const openBtn = document.getElementById('galleryOpenBtn');
    const chooseBtn = document.getElementById('galleryChooseBtn');
    const modal = document.getElementById('imageGalleryModal');
    try {
      const response = await fetch('/admin/api/products/images', { credentials: 'include' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !Array.isArray(result.images) || result.images.length === 0) {
        galleryContent.innerHTML = '<div style="grid-column: span 999; text-align:center; padding:30px; color:#6b7280;">Нет загруженных изображений</div>';
        return;
      }
      let html = '';
      result.images.forEach((imageData) => {
        const imageUrl = imageData.url || '';
        const escapedUrl = encodeURIComponent(String(imageUrl));
        html +=
          '<button type="button" class="gallery-item" data-image-url="' + escapedUrl + '" data-product-id="' + String(productId) + '" ' +
          'style="border:2px solid #e2e8f0; border-radius:14px; overflow:hidden; cursor:pointer; background:#fff; padding:0; width:160px; height:160px; display:flex; align-items:center; justify-content:center;">' +
          '<img src="' + String(imageUrl).replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '" style="width:100%; height:100%; object-fit:contain; display:block; background:#ffffff;" alt="img" data-onerror-hide="true" />' +
          '</button>';
      });
      galleryContent.innerHTML = html;
      galleryContent.onclick = function (e) {
        const target = e.target;
        const el = (target && target.nodeType === 1) ? target : (target && target.parentElement ? target.parentElement : null);
        if (!el) return;
        const item = el.closest('.gallery-item');
        if (!item) return;
        const encoded = item.getAttribute('data-image-url') || '';
        const imageUrl = encoded ? decodeURIComponent(encoded) : '';
        const pid = item.getAttribute('data-product-id') || '';
        if (modal) modal.setAttribute('data-selected-url', imageUrl);
        if (previewImg) previewImg.src = imageUrl;
        if (openBtn) openBtn.disabled = !imageUrl;
        if (chooseBtn) chooseBtn.disabled = !imageUrl;
        // highlight selection
        const all = galleryContent.querySelectorAll('.gallery-item');
        all.forEach((b) => { b.style.borderColor = '#e2e8f0'; b.style.boxShadow = 'none'; });
        item.style.borderColor = '#6366f1';
        item.style.boxShadow = '0 8px 18px rgba(99,102,241,0.20)';
      };

      // preselect first image for better UX
      const first = galleryContent.querySelector('.gallery-item');
      if (first && first.getAttribute) {
        const firstEncoded = first.getAttribute('data-image-url') || '';
        const firstUrl = firstEncoded ? decodeURIComponent(firstEncoded) : '';
        if (modal) modal.setAttribute('data-selected-url', firstUrl);
        if (previewImg) previewImg.src = firstUrl;
        if (openBtn) openBtn.disabled = !firstUrl;
        if (chooseBtn) chooseBtn.disabled = !firstUrl;
        first.style.borderColor = '#6366f1';
        first.style.boxShadow = '0 8px 18px rgba(99,102,241,0.20)';
      }
    } catch (e) {
      galleryContent.innerHTML = '<div style="grid-column: span 999; text-align:center; padding:30px; color:#dc2626;">Ошибка загрузки галереи</div>';
    }
  };
}

if (typeof window.openImageGallery !== 'function') {
  window.openImageGallery = function (productId) {
    try {
      if (!productId) return;
      // Lock background scroll (desktop-safe)
      try {
        const html = document.documentElement;
        const body = document.body;
        if (!html.hasAttribute('data-prev-overflow')) html.setAttribute('data-prev-overflow', html.style.overflow || '');
        if (!body.hasAttribute('data-prev-overflow')) body.setAttribute('data-prev-overflow', body.style.overflow || '');
        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
      } catch (_) { }
      const existingModal = document.getElementById('imageGalleryModal');
      if (existingModal) existingModal.remove();
      const modal = document.createElement('div');
      modal.id = 'imageGalleryModal';
      modal.className = 'modal-overlay';
      modal.style.cssText = 'display:flex; z-index:12000;';
      modal.innerHTML =
        '<div class="modal-content" style="max-width:1100px; width:min(1100px, 96vw); height:92vh;">' +
        '<div class="modal-header">' +
        '<h2 style="margin:0; font-size:18px;">Выбрать изображение</h2>' +
        '<button type="button" id="closeGalleryBtn" class="close-btn">&times;</button>' +
        '</div>' +
        '<div class="modal-body" style="padding:12px; overflow:hidden; flex:1; min-height:0; display:grid; grid-template-columns: minmax(300px, 420px) 1fr; gap:12px;">' +
        '<div style="border:1px solid var(--admin-border); border-radius:14px; overflow:hidden; background:#f8fafc; display:flex; flex-direction:column; min-height:0;">' +
        '<div style="padding:10px 12px; border-bottom:1px solid var(--admin-border); display:flex; gap:10px; align-items:center; justify-content:space-between;">' +
        '<div style="font-weight:900; font-size:13px; color:var(--admin-text);">Предпросмотр</div>' +
        '<button type="button" id="galleryOpenBtn" class="btn" disabled style="height:34px; padding:0 12px; border-radius:12px; font-weight:900;">Увеличить</button>' +
        '</div>' +
        '<div style="flex:1; min-height:0; display:flex; align-items:center; justify-content:center; padding:10px;">' +
        '<img id="galleryPreviewImg" src="" alt="preview" style="max-width:100%; max-height:100%; object-fit:contain; background:#fff; border-radius:12px; border:1px solid var(--admin-border);" />' +
        '</div>' +
        '</div>' +
        '<div id="galleryContent" style="min-height:0; height:100%; overflow:auto; overscroll-behavior: contain; display:grid; grid-template-columns: repeat(auto-fill, 160px); grid-auto-rows:160px; gap:12px; padding:2px; align-content:start; justify-content:start;">' +
        '<div style="grid-column: span 999; text-align:center; padding:30px; color:var(--admin-muted);">Загрузка...</div>' +
        '</div>' +
        '</div>' +
        '<div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">' +
        '<button type="button" id="galleryCancelBtn" class="btn">Отмена</button>' +
        '<button type="button" id="galleryChooseBtn" class="btn btn-success" disabled>Выбрать</button>' +
        '</div>' +
        '</div>';
      const shell = document.querySelector('.admin-shell');
      (shell || document.body).appendChild(modal);
      modal.onclick = function (e) { if (e.target === modal) window.closeImageGallery(); };
      // NOTE: do not block wheel/touch events here.
      // Background scroll is locked via html/body overflow:hidden, and galleryContent has overflow:auto.
      const closeBtn = document.getElementById('closeGalleryBtn');
      if (closeBtn) closeBtn.onclick = function () { window.closeImageGallery(); };
      const cancelBtn = document.getElementById('galleryCancelBtn');
      if (cancelBtn) cancelBtn.onclick = function () { window.closeImageGallery(); };
      const openBtn = document.getElementById('galleryOpenBtn');
      if (openBtn) openBtn.onclick = function () {
        const u = modal.getAttribute('data-selected-url') || '';
        if (!u) return;
        // Large preview as UI-kit modal (no new tab)
        const existing = document.getElementById('galleryFullscreen');
        if (existing) existing.remove();
        const fs = document.createElement('div');
        fs.id = 'galleryFullscreen';
        fs.className = 'modal-overlay';
        fs.style.cssText = 'display:flex; z-index:12001;';
        fs.innerHTML =
          '<div class="modal-content" style="max-width: 1100px; width:min(1100px, 96vw); max-height: 90vh;">' +
          '<div class="modal-header">' +
          '<h2 style="margin:0; font-size:16px;">Предпросмотр</h2>' +
          '<button type="button" class="close-btn" id="galleryFsClose">&times;</button>' +
          '</div>' +
          '<div class="modal-body" style="padding:14px; overflow:hidden; display:flex; align-items:center; justify-content:center; min-height: 60vh;">' +
          '<img src="' + String(u).replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '" style="max-width:100%; max-height:78vh; object-fit:contain; background:#fff; border-radius:12px; border:1px solid var(--admin-border);" />' +
          '</div>' +
          '</div>';
        const shell2 = document.querySelector('.admin-shell');
        (shell2 || document.body).appendChild(fs);
        fs.onclick = function (e2) { if (e2 && e2.target === fs) fs.remove(); };
        const c = document.getElementById('galleryFsClose');
        if (c) c.onclick = function () { fs.remove(); };
      };
      const chooseBtn = document.getElementById('galleryChooseBtn');
      if (chooseBtn) chooseBtn.onclick = function () {
        const u = modal.getAttribute('data-selected-url') || '';
        if (u && typeof window.selectGalleryImage === 'function') window.selectGalleryImage(u, productId);
      };
      if (typeof window.loadGalleryImages === 'function') window.loadGalleryImages(productId);
    } catch (e) {
      alert('❌ Ошибка галереи: ' + (e instanceof Error ? e.message : String(e)));
    }
  };
}

// КРИТИЧНО: модалка подтверждения удаления должна работать даже если нижний <script> сломается
window.__pendingDeleteForm = null;
window.openConfirmDeleteModal = function (deleteForm) {
  try {
    const modal = document.getElementById('confirmDeleteModal');
    const text = document.getElementById('confirmDeleteText');
    const btn = document.getElementById('confirmDeleteBtn');
    if (!modal || !text || !btn) {
      // fallback
      if (deleteForm && typeof deleteForm.submit === 'function') deleteForm.submit();
      return;
    }

    const title = (deleteForm && deleteForm.getAttribute && deleteForm.getAttribute('data-product-title')) || '';
    text.textContent = title
      ? ('Вы точно хотите удалить товар: ' + title + '? Это действие нельзя отменить.')
      : 'Вы точно хотите удалить этот товар? Это действие нельзя отменить.';

    window.__pendingDeleteForm = deleteForm || null;
    modal.style.display = 'flex';
    modal.onclick = function (e) {
      if (e.target === modal) window.closeConfirmDeleteModal();
    };
    btn.onclick = function () {
      const form = window.__pendingDeleteForm;
      window.closeConfirmDeleteModal();
      if (form && typeof form.submit === 'function') form.submit();
    };
  } catch (e) {
    console.error('openConfirmDeleteModal error:', e);
    if (deleteForm && typeof deleteForm.submit === 'function') deleteForm.submit();
  }
};

window.closeConfirmDeleteModal = function () {
  const modal = document.getElementById('confirmDeleteModal');
  if (modal) modal.style.display = 'none';
  window.__pendingDeleteForm = null;
};
</script>
  </head>
  <body>
        ${renderAdminShellStart({ title: 'Товары', activePath: '/admin/products', buildMarker })}
<div class="admin-page-row" style="margin-bottom: 20px;">
  <button type="button" class="btn" onclick="try{ if(typeof window.openAddProductModal==='function'){ window.openAddProductModal(); } else { window.location.href='/admin/products?openAdd=1'; } }catch(e){}">Добавить товар</button>
  <button type="button" class="btn" onclick="scrapeAllImages()">Собрать фото</button>
  <button type="button" class="btn" onclick="moveAllToCosmetics()">Переместить в «Косметика»</button>
</div>
        
${req.query.success === 'image_updated' ? '<div class="alert alert-success">✅ Фото успешно обновлено!</div>' : ''}
${req.query.error === 'no_image' ? '<div class="alert alert-error">❌ Файл не выбран</div>' : ''}
${req.query.error === 'image_upload' ? '<div class="alert alert-error">❌ Ошибка загрузки фото</div>' : ''}
${req.query.error === 'cloudinary_not_configured' ? '<div class="alert alert-error">❌ Загрузка фото недоступна: Cloudinary не настроен (нужны CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET на Railway).</div>' : ''}
${req.query.error === 'product_not_found' ? '<div class="alert alert-error">❌ Товар не найден</div>' : ''}
${req.query.success === 'images_scraped' ? '<div class="alert alert-success">✅ Фото успешно собраны! Проверьте результаты ниже.</div>' : ''}

<div id="scraping-status" style="display: none; margin: 20px 0; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
  <h3 style="margin: 0 0 10px 0; color: #1976d2;">📸 Сбор фотографий...</h3>
  <div id="scraping-progress" style="color: #666; font-size: 14px;">Инициализация...</div>
</div>

<div class="filters" style="gap: 10px;">
  <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; width:100%; margin-bottom:10px;">
    <div style="display:flex; gap:8px; align-items:center; flex:1; min-width:260px;">
      <input id="adminProductsSearch" type="search" placeholder="Поиск по названию или SKU..." autocomplete="off"
style="flex:1; padding:10px 12px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;"
oninput="if(typeof window.setAdminProductsSearch==='function'){window.setAdminProductsSearch(this.value);}">
  <button type="button" class="filter-btn" style="min-width:120px;"
id="viewCardsBtn"
onclick="if(typeof window.setAdminProductsView==='function'){window.setAdminProductsView('cards');}return false;">Карточки</button>
  <button type="button" class="filter-btn" style="min-width:120px;"
id = "viewTableBtn"
onclick = "if(typeof window.setAdminProductsView==='function'){window.setAdminProductsView('table');}return false;" > Таблица </button>
  </div>
  <div id="productsSortWrap" style="display:none; gap:8px; align-items:center;">
    <span style="color:#6b7280; font-size:13px;">Сортировка:</span>
    <select id="adminProductsSort" style="padding:10px 12px; border:1px solid #d1d5db; border-radius:10px; font-size:14px;"
onchange="if(typeof window.setAdminProductsSort==='function'){window.setAdminProductsSort(this.value);}">
      <option value="title_asc">Название (А-Я)</option>
      <option value="title_desc">Название (Я-А)</option>
      <option value="category_asc">Категория (А-Я)</option>
      <option value="category_desc">Категория (Я-А)</option>
    </select>
  </div>
</div>
<button type="button" class="filter-btn active" onclick="if(typeof window.filterProducts==='function'){window.filterProducts(this);}return false;" data-filter="all">Все категории (${allProducts.length})</button>
  `;

    categories.forEach((category) => {
      html += `
<button type="button" class="filter-btn" onclick="if(typeof window.filterProducts==='function'){window.filterProducts(this);}return false;" data-filter="${category.id}">${category.name} (${category.products.length})</button>
    `;
    });

    html += `
<button type="button" class="filter-btn add-category-btn" onclick="openAddCategoryModal()" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border: none;">
  ➕ Категорию
</button>
<button type="button" class="filter-btn add-subcategory-btn" onclick="openAddSubcategoryModal()" style="background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; border: none;">
  ➕ Подкатегорию
</button>
</div>

<div id="productsCardsContainer">
  <div class="product-grid">
    `;

    if (allProducts.length === 0) {
      html += `
    <div class="empty-state">
      <h3>Пока нет добавленных товаров</h3>
      <p>Используйте форму на главной странице админки, чтобы добавить первый товар.</p>
    </div>
  </div>
</body>
</html>
      `;
      return res.send(html);
    }

    // Format description with line breaks and URL links (matches mini-app behavior)
    const formatDescription = (text: string | null | undefined): string => {
      if (!text) return '';
      // 1. Escape HTML
      let safeText = String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      // 2. Linkify URLs
      safeText = safeText.replace(
        /((https?:\/\/)|(www\.))[^\s]+/gi,
        (url) => {
          let href = url;
          if (!href.startsWith('http')) href = 'http://' + href;
          return `<a href="${href}" target="_blank" style="text-decoration:underline; color:#1976d2;">${url}</a>`;
        }
      );
      // 3. Newlines to <br>
      return safeText.replace(/\n/g, '<br>');
    };

    // Helper function to escape HTML attributes safely
    // Улучшенная функция экранирования для HTML атрибутов
    const escapeAttr = (str: string | null | undefined): string => {
      if (!str) return '';
      try {
        // Сначала нормализуем и очищаем строку
        let result = String(str)
          .trim()
          // Удаляем все управляющие символы и null байты
          .replace(/[\x00-\x1F\x7F-\u009F]/g, '')
          // Удаляем специальные разделители строк
          .replace(/\u2028/g, ' ')
          .replace(/\u2029/g, ' ')
          // Заменяем все виды переносов строк на пробелы
          .replace(/[\r\n]+/g, ' ')
          .replace(/\r/g, ' ')
          .replace(/\n/g, ' ')
          // Заменяем табуляцию и множественные пробелы
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' ')
          // Удаляем потенциально проблемные символы Unicode
          .replace(/[\u200B-\u200D\uFEFF]/g, '');

        // Затем экранируем специальные символы HTML в правильном порядке
        result = result
          .replace(/&/g, '&amp;') // Must be first
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;') // Двойные кавычки
          .replace(/'/g, '&#39;') // Одинарные кавычки
          .replace(/`/g, '&#96;'); // Обратные кавычки

        // Ограничиваем длину для предотвращения очень длинных атрибутов
        if (result.length > 10000) {
          result = result.substring(0, 10000) + '...';
        }

        return result;
      } catch (error) {
        console.error('Error in escapeAttr:', error);
        return ''; // В случае ошибки возвращаем пустую строку
      }
    };

    // Helper function to escape HTML content safely
    const escapeHtml = (str: string | null | undefined): string => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    allProducts.forEach((product) => {
      const rubPrice = (product.price * 100).toFixed(2);
      const priceFormatted = `${rubPrice} руб. / ${product.price.toFixed(2)} PZ`;
      const createdAt = new Date(product.createdAt).toLocaleDateString();
      const imageId = `product-img-${product.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const placeholderId = `product-placeholder-${product.id.replace(/[^a-zA-Z0-9]/g, '-')}`;

      const innerImageSection = product.imageUrl
        ? `<img id="${imageId}" src="${escapeAttr(product.imageUrl)}" alt="${escapeAttr(product.title)}" class="product-image" loading="lazy" data-onerror-img="${imageId}" data-onerror-placeholder="${placeholderId}">
           <div id="${placeholderId}" class="product-image-placeholder" style="display: none;">
             <span class="placeholder-icon">📷</span>
             <span class="placeholder-text">Нет фото</span>
           </div>`
        : `<div class="product-image-placeholder">
             <span class="placeholder-icon">📷</span>
             <span class="placeholder-text">Нет фото</span>
           </div>`;

      const imageSection = `
            <button type="button" class="product-image-btn"
              data-product-id="${escapeAttr(product.id)}"
              data-title="${escapeAttr(product.title)}"
              data-image="${escapeAttr(product.imageUrl)}"
              aria-label="Открыть фото товара">
              ${innerImageSection}
            </button>
      `;

      html += `
          <div class="product-card"
               data-category="${escapeAttr(product.categoryId)}"
               data-id="${escapeAttr(product.id)}"
               data-title="${escapeAttr(product.title)}"
               data-sku="${escapeAttr(((product as any).sku || ''))}">
            <form method="post" action="/admin/products/${escapeAttr(product.id)}/toggle-active" class="card-toggle-form" title="${product.isActive ? 'Отключить' : 'Включить'}">
              <button type="submit" class="card-toggle-btn ${product.isActive ? 'is-active' : 'is-inactive'}" aria-label="${product.isActive ? 'Отключить товар' : 'Включить товар'}" onclick="event.stopPropagation();">
                ${ICONS.power}
              </button>
            </form>
            ${imageSection}
            <div class="product-header">
              <h3 class="product-title">
                ${escapeHtml(product.title)}
                ${(product.description || '').includes('скопировано') ? ' 📷' : ''}
              </h3>
              <span class="badge ${product.isActive ? 'badge-status-active' : 'badge-status-inactive'}">${product.isActive ? 'Активен' : 'Отключен'}</span>
            </div>
            ${(product.description || '').includes('скопировано') ? '<div style="margin: 4px 0; font-size: 11px; color: #f59e0b; background: #fef3c7; padding: 4px 8px; border-radius: 4px; display: inline-block;"><strong>📷 Копия фото</strong></div>' : ''}
            ${(product as any).sku ? `<div style="margin: 4px 0; font-size: 12px; color: #6b7280;"><strong>ID товара (Item):</strong> <span style="color: #1f2937; font-weight: 600;">${escapeHtml((product as any).sku)}</span></div>` : ''}
            <span class="badge badge-category">${escapeHtml(product.categoryName)}</span>
            <div style="margin: 8px 0;">
              <span style="font-size: 12px; color: #666;">Регионы:</span>
              ${(product as any).availableInRussia ? '<span style="background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">🇷🇺 Россия</span>' : ''}
              ${(product as any).availableInBali ? '<span style="background: #f3e5f5; color: #7b1fa2; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🇮🇩 Бали</span>' : ''}
            </div>
            <p class="product-summary">${formatDescription(product.summary)}</p>
            <div class="product-price">${priceFormatted}</div>
            <div class="product-meta">
              <span>Создан: ${createdAt}</span>
              <span>ID: ${escapeHtml(product.id.slice(0, 8))}...</span>
            </div>
            <div class="product-actions">
              <button 
                type="button" 
                class="btn-action btn-solid-black edit-btn"
                data-id="${escapeAttr(product.id)}"
                data-title="${escapeAttr(product.title)}"
                data-summary="${escapeAttr(product.summary)}"
                data-description="${escapeAttr((product.description || '').substring(0, 5000))}"
                data-instruction="${escapeAttr(((product as any).instruction || '').substring(0, 5000))}"
                data-price="${product.price}"
                data-category-id="${escapeAttr(product.categoryId)}"
                data-active="${product.isActive ? 'true' : 'false'}"
                data-russia="${(product as any).availableInRussia ? 'true' : 'false'}"
                data-bali="${(product as any).availableInBali ? 'true' : 'false'}"
                data-image="${escapeAttr(product.imageUrl)}"
                onclick="if(typeof window.editProduct==='function'){window.editProduct(this);}else{alert('Ошибка: функция редактирования не загружена. Обновите страницу.');}return false;"
              ><span class="btn-ico">${ICONS.pencil}</span><span>Редактировать</span></button>
              <button
                type="button"
                class="btn-action btn-outline change-photo-btn"
                style="border-color: #6366f1; color: #4f46e5;"
                onclick="(function(btn){
                  var pid='${escapeAttr(product.id)}';
                  var inp=document.createElement('input');
                  inp.type='file'; inp.accept='image/*'; inp.style.display='none';
                  inp.onchange=function(){
                    if(!inp.files||!inp.files[0])return;
                    var fd=new FormData();
                    fd.append('image',inp.files[0]);
                    btn.disabled=true; btn.innerHTML='⏳ Загрузка...';
                    fetch('/admin/products/'+encodeURIComponent(pid)+'/upload-image',{method:'POST',body:fd,credentials:'include'})
                      .then(function(r){window.location.href='/admin/products?success=image_updated';})
                      .catch(function(e){alert('Ошибка загрузки: '+e.message);btn.disabled=false;btn.innerHTML='📷 Сменить фото';});
                  };
                  document.body.appendChild(inp); inp.click(); inp.remove();
                })(this); return false;"
              ><span class="btn-ico">${ICONS.camera}</span><span>Сменить фото</span></button>
              <form method="post" action="/admin/products/${escapeAttr(product.id)}/delete" class="delete-product-form" data-product-id="${escapeAttr(product.id)}" data-product-title="${escapeAttr(product.title)}">
                <button type="button" class="btn-action btn-solid-danger delete-btn"><span class="btn-ico">${ICONS.trash}</span><span>Удалить</span></button>
              </form>
            </div>
          </div>
      `;
    });
    html += `
          </div>
        </div>

        <div id="productsTableContainer" style="display:none; margin-top: 14px;">
          <div style="overflow:auto; background:#fff; border-radius:12px; box-shadow: 0 6px 16px rgba(0,0,0,0.08); border:1px solid #e5e7eb;">
            <table id="productsTable" style="width:100%; border-collapse: collapse; min-width: 980px;">
              <thead>
                <tr style="background:#f9fafb; text-align:left;">
                  <th style="padding:12px; border-bottom:1px solid #e5e7eb; width:72px;">Фото</th>
                  <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Название</th>
                  <th style="padding:12px; border-bottom:1px solid #e5e7eb;">SKU</th>
                  <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Категория</th>
                  <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Статус</th>
                  <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Цена</th>
                  <th style="padding:12px; border-bottom:1px solid #e5e7eb;">Действия</th>
                </tr>
              </thead>
              <tbody>
                ${allProducts.map((p) => {
      const rubPrice = (p.price * 100).toFixed(2);
      const priceFormatted = rubPrice + ' руб. / ' + p.price.toFixed(2) + ' PZ';
      const sku = String((p as any).sku || '').trim();
      const imgUrl = String((p as any).imageUrl || '').trim();
      return (
        '<tr ' +
        'data-id="' + escapeAttr(p.id) + '" ' +
        'data-category-id="' + escapeAttr(p.categoryId) + '" ' +
        'data-category="' + escapeAttr(p.categoryName) + '" ' +
        'data-title="' + escapeAttr(p.title) + '" ' +
        'data-sku="' + escapeAttr(sku) + '">' +
        '<td style="padding:10px 12px; border-bottom:1px solid #f1f5f9;">' +
        '<button type="button" class="table-thumb" ' +
        'data-product-id="' + escapeAttr(p.id) + '" ' +
        'data-title="' + escapeAttr(p.title) + '" ' +
        'data-image="' + escapeAttr(imgUrl) + '" ' +
        'style="width:48px; height:48px; border-radius:10px; overflow:hidden; border:1px solid #e5e7eb; background:#f9fafb; padding:0; cursor:pointer; display:flex; align-items:center; justify-content:center;"' +
        '>' +
        (imgUrl
          ? ('<img src="' + escapeAttr(imgUrl) + '" alt="" style="width:100%; height:100%; object-fit:cover; display:block;" loading="lazy">')
          : ('<span style="font-size:16px; color:#9ca3af;">📷</span>')
        ) +
        '</button>' +
        '</td>' +
        '<td style="padding:12px; border-bottom:1px solid #f1f5f9;">' + escapeHtml(p.title) + '</td>' +
        '<td style="padding:12px; border-bottom:1px solid #f1f5f9; color:#6b7280;">' + (sku ? escapeHtml(sku) : '-') + '</td>' +
        '<td style="padding:12px; border-bottom:1px solid #f1f5f9;">' + escapeHtml(p.categoryName) + '</td>' +
        '<td style="padding:12px; border-bottom:1px solid #f1f5f9;">' + (p.isActive ? '✅ Активен' : '❌ Неактивен') + '</td>' +
        '<td style="padding:12px; border-bottom:1px solid #f1f5f9; white-space:nowrap;">' + priceFormatted + '</td>' +
        '<td style="padding:12px; border-bottom:1px solid #f1f5f9;">' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
        '<button type="button" class="btn-action btn-compact btn-solid-black edit-btn" ' +
        'data-id="' + escapeAttr(p.id) + '" ' +
        'data-title="' + escapeAttr(p.title) + '" ' +
        'data-summary="' + escapeAttr(p.summary) + '" ' +
        'data-description="' + escapeAttr((p.description || '').substring(0, 5000)) + '" ' +
        'data-instruction="' + escapeAttr((((p as any).instruction || '') as string).substring(0, 5000)) + '" ' +
        'data-price="' + (p.price as any) + '" ' +
        'data-category-id="' + escapeAttr(p.categoryId) + '" ' +
        'data-active="' + (p.isActive ? 'true' : 'false') + '" ' +
        'data-russia="' + ((p as any).availableInRussia ? 'true' : 'false') + '" ' +
        'data-bali="' + ((p as any).availableInBali ? 'true' : 'false') + '" ' +
        'data-image="' + escapeAttr(p.imageUrl) + '" ' +
        'data-stock="' + (p.stock !== undefined && p.stock !== null ? p.stock : 999) + '" ' +
        'onclick="if(typeof window.editProduct===\'function\'){window.editProduct(this);}else{alert(\'Ошибка: функция редактирования не загружена.\');} return false;"' +
        '><span class="btn-ico">' + ICONS.pencil + '</span><span>Редактировать</span></button>' +
        '<form method="post" action="/admin/products/' + escapeAttr(p.id) + '/toggle-active" style="display:inline;">' +
        '<button type="submit" class="btn-action btn-compact btn-outline toggle-btn"><span class="btn-ico">' + ICONS.power + '</span><span>' + (p.isActive ? 'Отключить' : 'Включить') + '</span></button>' +
        '</form>' +
        '<form method="post" action="/admin/products/' + escapeAttr(p.id) + '/delete" class="delete-product-form" data-product-id="' + escapeAttr(p.id) + '" data-product-title="' + escapeAttr(p.title) + '" style="display:inline;">' +
        '<button type="button" class="btn-action btn-compact btn-solid-danger delete-btn"><span class="btn-ico">' + ICONS.trash + '</span><span>Удалить</span></button>' +
        '</form>' +
        '</div>' +
        '</td>' +
        '</tr>'
      );
    }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal: table image preview + replace -->
        <div id="tableImageModal" class="modal-overlay" style="display:none; z-index: 12000;">
          <div class="modal-content" style="max-width: 820px; width: 92%; padding: 0; overflow: hidden;">
            <div class="modal-header" style="display:flex; align-items:center; justify-content:space-between;">
              <h2 id="tableImageModalTitle" style="margin:0; font-size:16px;">Фото товара</h2>
              <button class="close-btn" type="button" onclick="window.closeTableImageModal()">&times;</button>
            </div>
            <div style="padding: 16px 18px; background:#fff; display:grid; grid-template-columns: 1fr; gap: 14px;">
              <div style="display:flex; align-items:center; justify-content:center; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; min-height: 360px;">
                <img id="tableImageModalImg" src="" alt="" style="max-width: 100%; max-height: 520px; object-fit: contain; display:none;">
                <div id="tableImageModalEmpty" style="color:#9ca3af; font-size:14px;">Нет фото</div>
              </div>
              <div style="display:flex; gap:10px; justify-content:flex-end; align-items:center; flex-wrap:wrap;">
                <button type="button" class="btn-action btn-outline" onclick="try{ if(typeof window.openImageGallery==='function' && window.__tableImageModalState && window.__tableImageModalState.productId){ window.openImageGallery(window.__tableImageModalState.productId);} }catch(e){}"><span class="btn-ico">${ICONS.image}</span><span>Выбрать из загруженных</span></button>
                <button type="button" class="btn-action btn-outline" id="tableImageReplaceBtn" onclick="window.triggerTableImageReplace()"><span class="btn-ico">${ICONS.camera}</span><span>Заменить фото</span></button>
                <button type="button" class="btn-action btn-outline" onclick="window.closeTableImageModal()">Закрыть</button>
              </div>
              <input id="tableImageFileInput" type="file" accept="image/*" style="display:none" onchange="window.handleTableImageFileSelected(this)">
            </div>
          </div>
        </div>

        <!-- Modal for adding category -->
        <div id="addCategoryModal" class="modal-overlay" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h2>➕ Добавить категорию</h2>
              <button class="close-btn" onclick="closeAddCategoryModal()">&times;</button>
            </div>
            <form id="addCategoryForm" class="modal-form">
              <div class="form-group">
                <label for="categoryName">Название категории</label>
                <input type="text" id="categoryName" name="name" autocomplete="off" required placeholder="Например: Косметика">
              </div>
              <div class="form-group">
                <label for="categoryDescription">Описание (необязательно)</label>
                <textarea id="categoryDescription" name="description" rows="3" placeholder="Описание категории"></textarea>
              </div>
              <div class="form-actions">
                <button type="button" onclick="closeAddCategoryModal()">❌ Отмена</button>
                <button type="submit">✅ Создать категорию</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Modal for adding subcategory -->
        <div id="addSubcategoryModal" class="modal-overlay" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h2>➕ Добавить подкатегорию</h2>
              <button class="close-btn" onclick="closeAddSubcategoryModal()">&times;</button>
            </div>
            <form id="addSubcategoryForm" class="modal-form">
              <div class="form-group">
                <label for="subcategoryName">Название подкатегории</label>
                <input type="text" id="subcategoryName" name="name" autocomplete="off" required placeholder="Например: Кремы для лица">
              </div>
              <div class="form-group">
                <label for="subcategoryParent">Родительская категория</label>
                <select id="subcategoryParent" name="parentId" required>
                  <option value="">Выберите категорию...</option>
                  ${categories.map(cat => '<option value="' + cat.id + '">' + cat.name + '</option>').join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="subcategoryDescription">Описание (необязательно)</label>
                <textarea id="subcategoryDescription" name="description" rows="3" placeholder="Описание подкатегории"></textarea>
              </div>
              <div class="form-actions">
                <button type="button" onclick="closeAddSubcategoryModal()">❌ Отмена</button>
                <button type="submit">✅ Создать подкатегорию</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Modal: confirm delete product -->
        <div id="confirmDeleteModal" class="modal-overlay" style="display: none; z-index: 11000;">
          <div class="modal-content" style="max-width: 520px;">
            <div class="modal-header">
              <h2>🗑️ Удалить товар?</h2>
              <button class="close-btn" type="button" onclick="window.closeConfirmDeleteModal()">&times;</button>
            </div>
            <div class="modal-form" style="padding: 20px 28px;">
              <p id="confirmDeleteText" style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
                Вы точно хотите удалить этот товар? Это действие нельзя отменить.
              </p>
            </div>
            <div class="form-actions">
              <button type="button" onclick="window.closeConfirmDeleteModal()">Отмена</button>
              <button type="button" id="confirmDeleteBtn" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white;">Удалить</button>
            </div>
          </div>
        </div>

        <!-- Modal: create product -->
        <div id="createProductModal" class="modal-overlay" style="display:none; z-index: 12000;">
          <div class="modal-content" style="max-width: 920px; width: min(920px, 96vw);">
            <div class="modal-header">
              <h2 style="margin:0;">Добавить товар</h2>
              <button class="close-btn" type="button" onclick="window.closeAddProductModal()">&times;</button>
            </div>
            <form id="createProductForm" class="modal-form">
              <div class="form-group" style="display:grid; grid-template-columns: 1fr 160px 160px; gap:12px;">
                <div>
                  <label for="cpName">Название *</label>
                  <input id="cpName" name="name" type="text" required placeholder="Введите название товара">
                </div>
                <div>
                  <label for="cpPriceRub">Цена (₽) *</label>
                  <input id="cpPriceRub" type="number" min="0" step="1" required placeholder="0">
                  <div style="font-size:12px; color:#6b7280; margin-top:6px;">1 PZ = 100 ₽</div>
                </div>
                <div>
                  <label for="cpPricePz">Цена (PZ) *</label>
                  <input id="cpPricePz" name="price" type="number" min="0" step="0.01" required placeholder="0.00">
                  <div style="font-size:12px; color:#6b7280; margin-top:6px;">1 PZ = 100 ₽</div>
                </div>
              </div>

              <div class="form-group" style="display:grid; grid-template-columns: 1fr 200px 180px; gap:12px;">
                <div>
                  <label for="cpCategory">Категория *</label>
                  <select id="cpCategory" name="categoryId" required>
                    <option value="">Загрузка...</option>
                  </select>
                </div>
                <div>
                  <label for="cpStock">Количество на складе</label>
                  <input id="cpStock" name="stock" type="number" min="0" step="1" placeholder="999">
                </div>
                <div style="display:flex; align-items:flex-end; gap:10px;">
                  <label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--admin-border-strong); border-radius:12px; background:#fff; width:100%;">
                    <input id="cpActive" type="checkbox" checked>
                    <span style="font-weight:700;">Активен</span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label for="cpSku">ID товара (Item / SKU)</label>
                <input id="cpSku" name="sku" type="text" placeholder="Например: SP0021-230 (если пусто — сгенерируем автоматически)">
              </div>

              <div class="form-group" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                <label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--admin-border-strong); border-radius:12px; background:#fff;">
                  <input id="cpRussia" type="checkbox" checked>
                  <span style="font-weight:700;">Россия</span>
                </label>
                <label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--admin-border-strong); border-radius:12px; background:#fff;">
                  <input id="cpBali" type="checkbox">
                  <span style="font-weight:700;">Бали</span>
                </label>
              </div>

              <div class="form-group">
                <label for="cpSummary">Краткое описание *</label>
                <textarea id="cpSummary" name="shortDescription" rows="4" maxlength="200" required placeholder="Краткое описание (до 200 символов)"></textarea>
              </div>

              <div class="form-group">
                <label for="cpDescription">Полное описание *</label>
                <textarea id="cpDescription" name="fullDescription" style="display:none;"></textarea>
                <div id="cpDescriptionEditor" style="height: 250px; background: #fff; border-radius: 0 0 10px 10px;"></div>
              </div>

              <div class="form-group">
                <label for="cpInstruction">Инструкция (опционально)</label>
                <div id="cpInstructionEditor" style="height: 150px; background: #fff;"></div>
                <textarea id="cpInstruction" name="instruction" style="display:none;"></textarea>
                <div style="font-size:12px; color:#6b7280; margin-top:6px;">Инструкция будет отображаться в мини-приложении</div>
              </div>

              <div class="form-group">
                <label for="cpImage">Фото (опционально)</label>
                <input id="cpImage" type="file" accept="image/*">
                <div style="font-size:12px; color:#6b7280; margin-top:6px;">Квадратное фото 1:1, ~800x800px, JPG/PNG</div>
              </div>

              <div class="form-actions">
                <button type="button" onclick="window.closeAddProductModal()">Отмена</button>
                <button type="submit">Создать</button>
              </div>
            </form>
          </div>
        </div>

        <script>
          // Определяем функции глобально ДО загрузки страницы - сразу, не в IIFE
          'use strict';
          
          // NOTE: window.editProduct, window.closeEditModal, и window.showInstructionSafe уже определены в <head>
          // Они доступны ДО загрузки HTML, поэтому onclick обработчики будут работать

          // ===== Create product modal (for /admin/products) =====
          window.openAddProductModal = async function() {
            try {
              const modal = document.getElementById('createProductModal');
              const form = document.getElementById('createProductForm');
              if (!modal || !form) return;

              // reset
              try { form.reset(); } catch (_) {}
              const activeEl = document.getElementById('cpActive');
              const ruEl = document.getElementById('cpRussia');
              const baliEl = document.getElementById('cpBali');
              const stockEl = document.getElementById('cpStock');
              const skuEl = document.getElementById('cpSku');
              if (activeEl) activeEl.checked = true;
              if (ruEl) ruEl.checked = true;
              if (baliEl) baliEl.checked = false;
              if (stockEl) stockEl.value = '999';
              if (skuEl) skuEl.value = '';

              // load categories
              const select = document.getElementById('cpCategory');
              if (select) {
                select.innerHTML = '<option value="">Загрузка...</option>';
                try {
                  const resp = await fetch('/admin/api/categories', { credentials: 'include' });
                  const cats = await resp.json().catch(() => []);
                  const arr = Array.isArray(cats) ? cats : [];
                  select.innerHTML = '<option value="">Выберите категорию</option>' +
                    arr.map(c => '<option value="' + String(c.id).replace(/"/g,'&quot;') + '">' + String(c.name || '').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</option>').join('');
                } catch (e) {
                  select.innerHTML = '<option value="">Ошибка загрузки категорий</option>';
                }
              }

              modal.style.display = 'flex';
              modal.onclick = function(e){ if (e && e.target === modal) window.closeAddProductModal(); };
              
              // Initialize Quill for createProductModal only once
              if (typeof Quill !== 'undefined' && document.getElementById('cpDescriptionEditor')) {
                if (!window.cpQuill) {
                  window.cpQuill = new Quill('#cpDescriptionEditor', {
                    theme: 'snow',
                    modules: {
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'header': [1, 2, 3, false] }],
                        [{ 'color': [] }, { 'background': [] }],
                        ['clean']
                      ]
                    }
                  });
                }
                window.cpQuill.clipboard.dangerouslyPasteHTML(''); // Clear
              }
              if (typeof Quill !== 'undefined' && document.getElementById('cpInstructionEditor')) {
                if (!window.cpInstructionQuill) {
                  window.cpInstructionQuill = new Quill('#cpInstructionEditor', {
                    theme: 'snow',
                    modules: {
                      toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['clean']
                      ]
                    }
                  });
                }
                window.cpInstructionQuill.clipboard.dangerouslyPasteHTML(''); // Clear
                document.getElementById('cpInstruction').value = '';
              }
            } catch (e) {
              console.error('openAddProductModal error:', e);
              alert('Ошибка открытия формы добавления товара');
            }
          };

          window.closeAddProductModal = function() {
            try {
              const modal = document.getElementById('createProductModal');
              const form = document.getElementById('createProductForm');
              const img = document.getElementById('cpImage');
              if (modal) modal.style.display = 'none';
              if (form) { try { form.reset(); } catch (_) {} }
              if (img) img.value = '';
            } catch (_) {}
          };

          (function(){
            // price sync (RUB <-> PZ)
            const rub = document.getElementById('cpPriceRub');
            const pz = document.getElementById('cpPricePz');
            function syncFromRub(){
              try{
                const v = parseFloat(rub.value || '0');
                if (!isFinite(v)) return;
                pz.value = (v / 100).toFixed(2);
              }catch(_){}
            }
            function syncFromPz(){
              try{
                const v = parseFloat(pz.value || '0');
                if (!isFinite(v)) return;
                rub.value = String(Math.round(v * 100));
              }catch(_){}
            }
            if (rub && pz) {
              rub.addEventListener('input', syncFromRub);
              pz.addEventListener('input', syncFromPz);
            }

            // auto-open via ?openAdd=1
            try{
              const url = new URL(window.location.href);
              if (url.searchParams.get('openAdd') === '1') {
                url.searchParams.delete('openAdd');
                window.history.replaceState({}, '', url.toString());
                if (typeof window.openAddProductModal === 'function') window.openAddProductModal();
              }
            }catch(_){}

            // submit
            const form = document.getElementById('createProductForm');
            if (!form) return;
            form.addEventListener('submit', async function(e){
              e.preventDefault();
              const submitBtn = form.querySelector('button[type="submit"]');
              const oldText = submitBtn ? submitBtn.textContent : '';
              if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Создание...'; }
              try{
                const fd = new FormData();
                fd.append('name', (document.getElementById('cpName').value || '').trim());
                fd.append('price', String(document.getElementById('cpPricePz').value || '0'));
                fd.append('categoryId', String(document.getElementById('cpCategory').value || ''));
                fd.append('stock', String(document.getElementById('cpStock').value || '0'));
                fd.append('sku', String(document.getElementById('cpSku').value || '').trim());
                fd.append('shortDescription', String(document.getElementById('cpSummary').value || ''));
                fd.append('fullDescription', String(document.getElementById('cpDescription').value || '')); // Now gets value from hidden textarea
                fd.append('instruction', String(document.getElementById('cpInstruction').value || '')); // Now gets value from hidden textarea
                fd.append('active', (document.getElementById('cpActive').checked ? 'true' : 'false'));
                fd.append('availableInRussia', (document.getElementById('cpRussia').checked ? 'true' : 'false'));
                fd.append('availableInBali', (document.getElementById('cpBali').checked ? 'true' : 'false'));
                const img = document.getElementById('cpImage');
                if (img && img.files && img.files[0]) fd.append('image', img.files[0]);

                const resp = await fetch('/admin/api/products', { method:'POST', body: fd, credentials:'include' });
                const result = await resp.json().catch(() => ({}));
                if (resp.ok && result && result.success) {
                  window.closeAddProductModal();
                  if (typeof window.reloadAdminProductsPreservingState === 'function') {
                    window.reloadAdminProductsPreservingState({ success: 'product_created' });
                  } else {
                    window.location.reload();
                  }
                } else {
                  alert('Ошибка: ' + (result && result.error ? result.error : ('HTTP ' + resp.status)));
                }
              }catch(err){
                console.error('create product error:', err);
                alert('Ошибка: ' + (err && err.message ? err.message : String(err)));
              }finally{
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = oldText || 'Создать'; }
              }
            });
          })();
          
          // Category modal functions
          window.openAddCategoryModal = function() {
            const modal = document.getElementById('addCategoryModal');
            if (modal) {
              modal.style.display = 'flex';
            }
          };
          
          window.closeAddCategoryModal = function() {
            const modal = document.getElementById('addCategoryModal');
            if (modal) {
              modal.style.display = 'none';
            }
            const form = document.getElementById('addCategoryForm');
            if (form) {
              form.reset();
            }
          };
          
          window.openAddSubcategoryModal = function() {
            const modal = document.getElementById('addSubcategoryModal');
            if (modal) {
              modal.style.display = 'flex';
            }
          };
          
          window.closeAddSubcategoryModal = function() {
            const modal = document.getElementById('addSubcategoryModal');
            if (modal) {
              modal.style.display = 'none';
            }
            const form = document.getElementById('addSubcategoryForm');
            if (form) {
              form.reset();
            }
          };

          // Delete confirmation modal is defined in <head> (to survive any errors in this script block)
          
          // Function to move all products to "Косметика" category
          window.moveAllToCosmetics = async function() {
            if (!confirm('⚠️ Переместить ВСЕ продукты в категорию ' + String.fromCharCode(34) + 'Косметика' + String.fromCharCode(34) + '?\\n\\nЭто действие изменит категорию для всех товаров в базе данных.')) {
              return;
            }
            
            try {
              const response = await fetch('/admin/api/move-all-to-cosmetics', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('✅ Успешно!\\n\\nПеремещено продуктов: ' + (result.movedCount || 0) + '\\nКатегория: \"' + (result.categoryName || 'Косметика') + '\"');
                location.reload();
              } else {
                alert('❌ Ошибка: ' + (result.error || 'Не удалось переместить продукты'));
              }
            } catch (error) {
              console.error('Error moving products:', error);
              alert('❌ Ошибка: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
            }
          };

          // Function to filter products
          // NOTE: основная реализация уже определена в <head> (с поиском/видом/сортировкой).
          // Не перезатираем её здесь, чтобы не ломать сохранение состояния.
          if (typeof window.filterProducts !== 'function') {
          window.filterProducts = function(button) {
              try {
                const filter = button && button.dataset ? button.dataset.filter : 'all';
            const cards = document.querySelectorAll('.product-card');
            cards.forEach(card => {
              if (filter === 'all' || card.dataset.category === filter) {
                card.style.display = 'flex';
              } else {
                card.style.display = 'none';
              }
            });
              } catch (e) {
                console.error('filterProducts fallback error:', e);
              }
            };
          }
          
          // NOTE: window.editProduct and window.closeEditModal already defined at the beginning of script
          
          // Handle category form submission
          document.addEventListener('DOMContentLoaded', function() {
            // Restore admin products UI state (filter/search/view/sort)
            try {
              if (typeof window.__restoreAdminProductsState === 'function') window.__restoreAdminProductsState();
              const st = window.__adminProductsState || {};
              const searchInput = document.getElementById('adminProductsSearch');
              if (searchInput) searchInput.value = String(st.q || '');
              const sortSelect = document.getElementById('adminProductsSort');
              if (sortSelect) sortSelect.value = String(st.sort || 'title_asc');
              // Apply filter button if exists
              const filterBtn = document.querySelector('.filter-btn[data-filter="' + String(st.filter || 'all').replace(/"/g, '\\"') + '"]');
              if (filterBtn && typeof window.filterProducts === 'function') {
                window.filterProducts(filterBtn);
              } else if (typeof window.__applyAdminProductsFilters === 'function') {
                window.__applyAdminProductsFilters();
              }
            } catch (e) {
              console.warn('Failed to restore UI state:', e);
            }

            const categoryForm = document.getElementById('addCategoryForm');
            if (categoryForm) {
              categoryForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const name = document.getElementById('categoryName').value.trim();
                const description = document.getElementById('categoryDescription').value.trim();
                
                if (!name) {
                  alert('Введите название категории');
                  return;
                }
                
                try {
                  const response = await fetch('/admin/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, description })
                  });
                  
                  const result = await response.json();
                  
                  if (result.success) {
                    alert('✅ Категория успешно создана!');
                    closeAddCategoryModal();
                    location.reload();
                  } else {
                    alert('❌ Ошибка: ' + (result.error || 'Не удалось создать категорию'));
                  }
                } catch (error) {
                  alert('❌ Ошибка: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
                }
              });
            }
            
            // Handle subcategory form submission (creates as regular category for now)
            const subcategoryForm = document.getElementById('addSubcategoryForm');
            if (subcategoryForm) {
              subcategoryForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const name = document.getElementById('subcategoryName').value.trim();
                const parentId = document.getElementById('subcategoryParent').value;
                const description = document.getElementById('subcategoryDescription').value.trim();
                
                if (!name) {
                  alert('Введите название подкатегории');
                  return;
                }
                
                if (!parentId) {
                  alert('Выберите родительскую категорию');
                  return;
                }
                
                try {
                  // For now, create as regular category (parentId support can be added later)
                  const response = await fetch('/admin/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ name, description, parentId })
                  });
                  
                  const result = await response.json();
                  
                  if (result.success) {
                    alert('✅ Подкатегория успешно создана!');
                    window.closeAddSubcategoryModal();
                    location.reload();
                  } else {
                    alert('❌ Ошибка: ' + (result.error || 'Не удалось создать подкатегорию'));
                  }
                } catch (error) {
                  alert('❌ Ошибка: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
                }
              });
            }
          });
          
          // Image Gallery Functions - определяем сразу глобально
          // NOTE: основные реализации вынесены в <head> (устойчиво к SyntaxError ниже).
          // Здесь оставляем только fallback, чтобы не перетирать уже определенные функции.
          if (typeof window.openImageGallery !== 'function') window.openImageGallery = function(productId) {
            console.log('🖼️ Opening image gallery for product:', productId);
            
            if (!productId) {
              console.error('❌ Product ID is required');
              alert('Ошибка: не указан ID товара');
              return;
            }

            // Lock background scroll (desktop-safe)
            try {
              const html = document.documentElement;
              const body = document.body;
              if (!html.hasAttribute('data-prev-overflow')) html.setAttribute('data-prev-overflow', html.style.overflow || '');
              if (!body.hasAttribute('data-prev-overflow')) body.setAttribute('data-prev-overflow', body.style.overflow || '');
              html.style.overflow = 'hidden';
              body.style.overflow = 'hidden';
            } catch (_) {}
            
            // Закрываем предыдущее модальное окно, если оно открыто
            const existingModal = document.getElementById('imageGalleryModal');
            if (existingModal) {
              console.log('🗑️ Removing existing modal');
              existingModal.remove();
            }
            
            // Создаем модальное окно
            const modal = document.createElement('div');
            modal.id = 'imageGalleryModal';
            modal.className = 'modal-overlay';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.background = 'rgba(0,0,0,0.6)';
            modal.style.zIndex = '10000';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            
            // Разбиваем длинную innerHTML строку на части для предотвращения SyntaxError
            modal.innerHTML = 
              '<div class="modal-content" style="max-width: 90vw; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">' +
                '<div class="modal-header" style="padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">' +
                  '<h2 style="margin: 0; font-size: 20px; font-weight: 600; color: white;">🖼️ Выбрать изображение из загруженных</h2>' +
                  '<button class="close-btn" style="background: rgba(255,255,255,0.2); border: none; font-size: 24px; cursor: pointer; color: white; padding: 0; width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;">&times;</button>' +
                '</div>' +
                '<div id="galleryContent" style="padding: 12px; overflow-y: auto; overscroll-behavior: contain; flex: 1; min-height:0; display: grid; grid-template-columns: repeat(auto-fill, 160px); grid-auto-rows:160px; gap: 12px; align-content:start; justify-content:start;">' +
                  '<div style="grid-column: span 999; text-align: center; padding: 40px;">' +
                    '<div class="loading-spinner" style="width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px;"></div>' +
                    '<p style="color: #6b7280;">Загрузка изображений...</p>' +
                  '</div>' +
                '</div>' +
              '</div>';
            
            (document.querySelector('.admin-shell') || document.body).appendChild(modal);
            console.log('✅ Modal added to DOM');
            
            // Обработчик закрытия по клику на overlay
            modal.addEventListener('click', function(e) {
              const target = e.target;
              if (target === modal || target.classList.contains('close-btn')) {
                console.log('🔄 Closing gallery');
                window.closeImageGallery();
              }
            });
            
            // Предотвращаем закрытие при клике внутри контента
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
              modalContent.addEventListener('click', function(e) {
                e.stopPropagation();
              });
            }
            
            // Загружаем изображения
            console.log('📥 Loading gallery images...');
            window.loadGalleryImages(productId);
          };
          
          if (typeof window.closeImageGallery !== 'function') window.closeImageGallery = function() {
            const modal = document.getElementById('imageGalleryModal');
            if (modal) modal.remove();
            try {
              const html = document.documentElement;
              const body = document.body;
              const prevHtml = html.getAttribute('data-prev-overflow');
              const prevBody = body.getAttribute('data-prev-overflow');
              if (prevHtml !== null) html.style.overflow = prevHtml;
              if (prevBody !== null) body.style.overflow = prevBody;
              html.removeAttribute('data-prev-overflow');
              body.removeAttribute('data-prev-overflow');
            } catch (_) {}
          };
          
          // Определяем selectGalleryImage глобально, чтобы она была доступна для loadGalleryImages
          if (typeof window.selectGalleryImage !== 'function') window.selectGalleryImage = async function(imageUrl, productId) {
            if (!imageUrl || !productId) {
              console.error('Missing parameters:', { imageUrl, productId });
              alert('❌ Ошибка: Не указаны параметры изображения или товара');
              return;
            }
            
            try {
              console.log('Selecting image:', imageUrl, 'for product:', productId);
              
              const response = await fetch('/admin/api/products/' + encodeURIComponent(productId) + '/select-image', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  imageUrl: String(imageUrl).trim()
                })
              });
              
              if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                throw new Error('HTTP ' + response.status + ': ' + errorText);
              }
              
              const result = await response.json();
              
              if (result.success) {
                alert('✅ Изображение успешно привязано к товару!');
                window.closeImageGallery();
                setTimeout(() => {
                  location.reload();
                }, 500);
              } else {
                alert('❌ Ошибка: ' + (result.error || 'Не удалось привязать изображение'));
              }
            } catch (error) {
              console.error('Error selecting image:', error);
              alert('❌ Ошибка: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
            }
          };
          
          // Определяем loadGalleryImages глобально, чтобы она была доступна
          if (typeof window.loadGalleryImages !== 'function') window.loadGalleryImages = async function(productId) {
            const galleryContent = document.getElementById('galleryContent');
            if (!galleryContent) {
              console.error('Gallery content element not found');
              return;
            }
            
            galleryContent.dataset.currentProductId = productId;
            
            try {
              console.log('Loading gallery images for product:', productId);
              const response = await fetch('/admin/api/products/images', {
                credentials: 'include'
              });
              
              if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
              }
              
              const result = await response.json();
              console.log('Gallery images response:', result);
              
              if (!result.success || !result.images || result.images.length === 0) {
                const emptyDiv = document.createElement('div');
                emptyDiv.style.cssText = 'grid-column: span 999; text-align: center; padding: 40px; color: #6b7280;';
                emptyDiv.innerHTML = '<p style="font-size: 18px; margin-bottom: 8px;">📦 Нет загруженных изображений</p><p style="font-size: 14px;">Сначала загрузите изображения для товаров</p>';
                galleryContent.innerHTML = '';
                galleryContent.appendChild(emptyDiv);
                return;
              }
              
              let html = '';
              result.images.forEach((imageData) => {
                const imageUrl = imageData.url;
                const escapedUrl = imageUrl ? imageUrl.replace(/"/g, '&quot;').replace(/'/g, '&#39;') : '';
                
                // Используем одинарные кавычки для JS-строки, чтобы не полагаться на экранирование \" внутри server-rendered шаблона
                // (иначе легко получить SyntaxError: Unexpected identifier 'gallery')
                html +=
                  '<button type="button" class="gallery-item" data-image-url="' + escapedUrl + '" data-product-id="' + productId + '" ' +
                    'style="border: 2px solid #e2e8f0; border-radius: 14px; overflow: hidden; cursor: pointer; transition: all 0.2s; background: white; padding:0; width:160px; height:160px; display:flex; align-items:center; justify-content:center;">' +
                      '<img src="' + escapedUrl + '" alt="Product image" class="gallery-image" ' +
                        'style="width: 100%; height: 100%; object-fit: contain; display:block; background:#fff;" data-onerror-hide="true">' +
                  '</button>';
              });
              
              galleryContent.innerHTML = html;
              
              const newHandler = function(e) {
                const target = e.target;
                const galleryItem = target.closest('.gallery-item');
                if (galleryItem) {
                  const imageUrl = galleryItem.dataset.imageUrl;
                  const currentProductId = galleryItem.dataset.productId || galleryContent.dataset.currentProductId;
                  if (imageUrl && currentProductId && window.selectGalleryImage) {
                    console.log('Selecting image:', imageUrl, 'for product:', currentProductId);
                    window.selectGalleryImage(imageUrl, currentProductId);
                  }
                }
              };
              
              galleryContent.removeEventListener('click', newHandler);
              galleryContent.addEventListener('click', newHandler);
              
              const galleryItems = galleryContent.querySelectorAll('.gallery-item');
              galleryItems.forEach((item) => {
                item.addEventListener('mouseenter', function() {
                  this.style.borderColor = '#6366f1';
                  this.style.transform = 'translateY(-4px)';
                  this.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.2)';
                });
                item.addEventListener('mouseleave', function() {
                  this.style.borderColor = '#e2e8f0';
                  this.style.transform = 'translateY(0)';
                  this.style.boxShadow = 'none';
                });
              });
            } catch (error) {
              console.error('Error loading gallery images:', error);
              const errorMsg = error instanceof Error ? error.message : 'Попробуйте обновить страницу';
              const errorDiv = document.createElement('div');
              errorDiv.style.cssText = 'grid-column: span 999; text-align: center; padding: 40px; color: #dc3545;';
              errorDiv.innerHTML = '<p style="font-size: 18px; margin-bottom: 8px;">❌ Ошибка загрузки изображений</p><p style="font-size: 14px;">' + (errorMsg || 'Попробуйте обновить страницу') + '</p>';
              galleryContent.innerHTML = '';
              galleryContent.appendChild(errorDiv);
            }
          };
          

          
          // NOTE: window.showInstructionSafe уже определена выше, не дублируем!
          // NOTE: window.editProduct уже определена выше, не дублируем!
          
          // Instruction (инструкция по применению) полностью убрана с этой страницы по требованию,
          // чтобы исключить проблемы с экранированием/парсингом JS в server-rendered шаблоне.
          
          // AI Translation function for product fields
          window.translateProductField = async function(fieldId, type) {
            const field = document.getElementById(fieldId);
            if (!field) {
              alert('Поле не найдено');
              return;
            }
            
            const originalText = field.value.trim();
            if (!originalText) {
              alert('Введите текст на английском языке для перевода');
              field.focus();
              return;
            }
            
            // Show loading state
            const translateBtn = field.parentElement?.querySelector('.btn-translate');
            const originalBtnText = translateBtn ? translateBtn.textContent : '🤖 AI';
            if (translateBtn) {
              translateBtn.disabled = true;
              translateBtn.textContent = '⏳...';
              translateBtn.style.opacity = '0.6';
              translateBtn.style.cursor = 'not-allowed';
            }
            
            try {
              const productName = document.getElementById('productName')?.value || '';
              
              const response = await fetch('/admin/api/products/translate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  text: originalText,
                  type: type,
                  productName: productName,
                  productType: 'cosmetic'
                })
              });
              
              const result = await response.json();
              
              if (result.success && result.translated) {
                field.value = result.translated;
                
                // Update character count if it's summary field
                if (fieldId === 'productShortDescription') {
                  const charCount = document.getElementById('shortDescCount');
                  if (charCount) {
                    charCount.textContent = result.translated.length + '/200';
                  }
                }
                
                // Trigger input event to update any listeners
                field.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 10000; font-size: 14px;';
                successMsg.textContent = '✅ Перевод выполнен успешно!';
                document.body.appendChild(successMsg);
                setTimeout(() => {
                  successMsg.style.transition = 'opacity 0.3s';
                  successMsg.style.opacity = '0';
                  setTimeout(() => successMsg.remove(), 300);
                }, 3000);
              } else {
                throw new Error(result.error || 'Ошибка при переводе');
              }
            } catch (error) {
              console.error('Translation error:', error);
              const errorMsg = (error instanceof Error && error.message)
                ? error.message
                : 'Неизвестная ошибка. Убедитесь, что OPENAI_API_KEY настроен в переменных окружения.';
              alert('Ошибка при переводе: ' + errorMsg);
            } finally {
              // Restore button state
              if (translateBtn) {
                translateBtn.disabled = false;
                translateBtn.textContent = originalBtnText;
                translateBtn.style.opacity = '1';
                translateBtn.style.cursor = 'pointer';
              }
            }
          };
          
          // Импорт продуктов уже обработан в начале скрипта выше
          
          // Функция для сбора всех недостающих фотографий
          async function scrapeAllImages() {
            const statusDiv = document.getElementById('scraping-status');
            const progressDiv = document.getElementById('scraping-progress');
            
            if (statusDiv) statusDiv.style.display = 'block';
            
            try {
              if (progressDiv) progressDiv.textContent = '🚀 Запуск сбора фотографий...';
              
              const response = await fetch('/admin/api/scrape-all-images', {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                throw new Error('Ошибка запуска сбора фотографий');
              }
              
              // Открываем новую вкладку с логами или показываем статус
              if (progressDiv) progressDiv.innerHTML = '✅ Сбор фотографий запущен! Проверьте логи в консоли сервера или подождите завершения...';
              
              // Через 5 секунд перезагружаем страницу для проверки результатов
              setTimeout(() => {
                window.location.href = '/admin/products?success=images_scraped';
              }, 5000);
              
            } catch (error) {
              console.error('Error scraping images:', error);
              if (progressDiv) progressDiv.innerHTML = '❌ Ошибка: ' + (error instanceof Error ? error.message : String(error));
              setTimeout(() => {
                if (statusDiv) statusDiv.style.display = 'none';
              }, 5000);
            }
          }
          
          // Image Gallery Functions - все функции уже определены в начале скрипта в IIFE
          // openImageGallery, loadGalleryImages, selectGalleryImage, closeImageGallery
          // доступны глобально через window.*
          
          // Event delegation для кнопок - работает сразу, без DOMContentLoaded
          (function() {
            let eventHandlerAttached = false;
            
            // Убеждаемся, что все функции определены
            if (typeof window.closeEditModal === 'undefined') {
              window.closeEditModal = function() {
                const modal = document.getElementById('editProductModal');
                if (modal) {
                  modal.style.display = 'none';
                }
              };
            }
            
            // КРИТИЧНО: Убеждаемся, что window.editProduct определена ДО инициализации обработчиков
            // Если функция не определена, ждем её определения
            function waitForEditProductFunction(maxAttempts = 50, attempt = 0) {
              if (typeof window.editProduct === 'function') {
                console.log('✅ window.editProduct is defined:', typeof window.editProduct);
                return true;
              }
              
              if (attempt >= maxAttempts) {
                console.error('❌ CRITICAL: window.editProduct is not defined after', maxAttempts, 'attempts!');
                console.error('❌ Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('edit')));
                // Не показываем alert здесь, так как это может быть вызвано до загрузки страницы
                return false;
              }
              
              // Ждем и проверяем снова
              setTimeout(() => {
                waitForEditProductFunction(maxAttempts, attempt + 1);
              }, 50);
              
              return false;
            }
            
            // Устанавливаем обработчик сразу, но он сработает только после загрузки DOM
            function initEventDelegation() {
              if (eventHandlerAttached) {
                console.log('⚠️ Event handler already attached, skipping');
                return;
              }
              
              console.log('✅ Initializing event delegation for product buttons');
              
              // Проверяем функции перед установкой обработчика
              if (typeof window.editProduct !== 'function') {
                console.warn('⚠️ window.editProduct not yet defined, waiting...');
                // Ждем определения функции с несколькими попытками
                let attempts = 0;
                const checkInterval = setInterval(() => {
                  attempts++;
                  if (typeof window.editProduct === 'function') {
                    clearInterval(checkInterval);
                    console.log('✅ window.editProduct is now defined, initializing event delegation');
                    initEventDelegation();
                  } else if (attempts >= 20) {
                    clearInterval(checkInterval);
                    console.error('❌ Cannot initialize event delegation: window.editProduct is not defined after 1 second');
                    // Не показываем alert здесь, так как onclick обработчик покажет свою ошибку
                  }
                }, 50);
                return;
              }
              
              console.log('✅ window.openImageGallery:', typeof window.openImageGallery);
              console.log('✅ window.showInstructionSafe:', typeof window.showInstructionSafe);
              eventHandlerAttached = true;
              
              document.addEventListener('click', function(event) {
                // event.target может быть Text node — тогда .closest не существует и весь обработчик падает,
                // из‑за чего клики по кнопкам (фото/фильтры) перестают работать.
                const target = event.target;
                const el = (target && target.nodeType === 1) ? target : (target && target.parentElement ? target.parentElement : null);
                if (!el) return;
                
                // Обработка кнопки редактирования товара (проверяем первой, так как она самая важная)
                // Ищем кнопку через closest, так как клик может быть на дочернем элементе (текст, иконка)
                const editBtn = el.closest('.edit-btn') || (el.classList && el.classList.contains('edit-btn') ? el : null);
                
                if (editBtn) {
                  // Проверяем, что это действительно кнопка редактирования
                  const isEditButton = editBtn.classList.contains('edit-btn') && 
                                      (editBtn.type === 'button' || !editBtn.type || editBtn.tagName === 'BUTTON');
                  
                  if (isEditButton) {
                    console.log('🔵 Edit button clicked', editBtn);
                    console.log('🔵 Button data:', {
                      id: editBtn.dataset.id,
                      title: editBtn.dataset.title?.substring(0, 30),
                      hasEditProduct: typeof window.editProduct
                    });
                    
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    
                    try {
                      if (typeof window.editProduct === 'function') {
                        window.editProduct(editBtn);
                      } else {
                        console.error('❌ window.editProduct is not defined');
                        console.error('❌ Available window functions:', Object.keys(window).filter(k => k.includes('edit')));
                        alert('Ошибка: функция редактирования не доступна. Пожалуйста, обновите страницу.');
                      }
                    } catch (error) {
                      console.error('❌ Error in editProduct:', error);
                      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack');
                      alert('Ошибка при открытии формы редактирования: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    return false;
                  }
                }

                // Миниатюры в табличном виде (клик -> модалка с большим фото + замена)
                const tableThumb = el.closest('.table-thumb');
                if (tableThumb) {
                  event.preventDefault();
                  event.stopPropagation();
                  try {
                    const pid = tableThumb.getAttribute('data-product-id') || '';
                    const img = tableThumb.getAttribute('data-image') || '';
                    const title = tableThumb.getAttribute('data-title') || '';
                    if (typeof window.openTableImageModal === 'function') {
                      window.openTableImageModal(pid, img, title);
                    }
                  } catch (e) {
                    console.error('Table thumb click error:', e);
                  }
                  return;
                }

                // Фото в карточках (клик -> модалка с большим фото + замена / выбор из загруженных)
                const cardImageBtn = el.closest('.product-image-btn');
                if (cardImageBtn) {
                  event.preventDefault();
                  event.stopPropagation();
                  try {
                    const pid = cardImageBtn.getAttribute('data-product-id') || '';
                    const img = cardImageBtn.getAttribute('data-image') || '';
                    const title = cardImageBtn.getAttribute('data-title') || '';
                    if (typeof window.openTableImageModal === 'function') {
                      window.openTableImageModal(pid, img, title);
                    }
                  } catch (e) {
                    console.error('Card image click error:', e);
                  }
                  return;
                }
                
                // Фильтры категорий (дублируем inline onclick, чтобы работало даже если он сломан/перекрыт)
                // Важно: не перехватываем кнопки вида "Карточки/Таблица" — у них нет data-filter.
                const filterBtn = el.closest('.filter-btn[data-filter]');
                if (filterBtn && typeof window.filterProducts === 'function') {
                  console.log('🔵 Filter button clicked', filterBtn);
                  event.preventDefault();
                  event.stopPropagation();
                  try {
                    window.filterProducts(filterBtn);
                  } catch (error) {
                    console.error('❌ Error in filterProducts:', error);
                  }
                  return;
                }
                
                // Обработка кнопки "Выбрать из загруженных"
                const selectImageBtn = el.closest('.select-image-btn');
                if (selectImageBtn) {
                  console.log('🔵 Select image button clicked');
                  event.preventDefault();
                  event.stopPropagation();
                  const productId = selectImageBtn.getAttribute('data-product-id');
                  if (productId && typeof window.openImageGallery === 'function') {
                    window.openImageGallery(productId);
                  } else {
                    console.error('❌ Product ID not found or openImageGallery not defined:', { 
                      productId, 
                      hasFunction: typeof window.openImageGallery
                    });
                    alert('Ошибка: функция выбора изображения не доступна. Пожалуйста, обновите страницу.');
                  }
                  return;
                }
                
                // Обработка кнопки загрузки изображения через data-атрибут
                const imageBtn = el.closest('.image-btn[data-image-input-id]');
                if (imageBtn) {
                  console.log('🔵 Image upload button clicked');
                  event.preventDefault();
                  event.stopPropagation();
                  const inputId = imageBtn.getAttribute('data-image-input-id');
                  const fileInput = document.getElementById(inputId);
                  if (fileInput) {
                    fileInput.click();
                  } else {
                    console.error('❌ File input not found:', inputId);
                  }
                  return;
                }
                
                // Обработка формы удаления товара (кнопка внутри формы)
                const deleteBtn = el.closest('.delete-btn');
                if (deleteBtn) {
                  const deleteForm = deleteBtn.closest('.delete-product-form');
                  if (deleteForm) {
                    console.log('🔵 Delete button clicked');
                  event.preventDefault();
                    event.stopPropagation();
                    if (typeof window.openConfirmDeleteModal === 'function') {
                      window.openConfirmDeleteModal(deleteForm);
                  } else {
                      if (confirm('Удалить товар?')) deleteForm.submit();
                  }
                  return;
                }
                }
              }, true); // Используем capture phase для раннего перехвата
              
              // Обработка загрузки изображений
              document.addEventListener('change', function(event) {
                const target = event.target;
                if (target && target.classList && target.classList.contains('product-image-input')) {
                  const form = target.closest('.upload-image-form');
                  if (form && target.files && target.files.length > 0) {
                    form.submit();
                  }
                }
              });
              
              // Обработка ошибок загрузки изображений
              document.addEventListener('error', function(event) {
                const target = event.target;
                if (target && target.tagName === 'IMG') {
                  if (target.hasAttribute('data-onerror-img') || target.hasAttribute('data-onerror-hide')) {
                    target.style.display = 'none';
                  }
                  if (target.hasAttribute('data-onerror-img')) {
                    const placeholderId = target.getAttribute('data-onerror-placeholder');
                    if (placeholderId) {
                      const placeholder = document.getElementById(placeholderId);
                      if (placeholder) {
                        placeholder.style.display = 'flex';
                      }
                    }
                  }
                }
              }, true);
            }
            
            // Инициализируем сразу, если DOM уже загружен
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', initEventDelegation);
            } else {
              initEventDelegation();
            }
          })();
        </script>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Products page error:', error);
    res.status(500).send('Ошибка загрузки товаров');
  }
});

// Product2 module - управление товарами через веб-интерфейс
router.get('/product2', requireAdmin, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Подсчитываем количество товаров для каждой категории
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const productCount = await prisma.product.count({
          where: { categoryId: cat.id },
        });
        return { ...cat, productCount };
      })
    );

    const products = await prisma.product.findMany({
      where: { imageUrl: { not: null }, isActive: true },
      select: { id: true, title: true, imageUrl: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Товар 2 - Управление товарами</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          ${ADMIN_UI_CSS}
          body{ margin:0; padding:0; background: var(--admin-bg); }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
          }
          .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
          .header { margin-bottom: 30px; border-bottom: 2px solid #e9ecef; padding-bottom: 20px; }
          .header h1 { color: #9c27b0; font-size: 28px; margin-bottom: 10px; }
          .header p { color: #6c757d; }
          .back-link { display: inline-block; margin-bottom: 20px; color: #667eea; text-decoration: none; font-weight: 600; }
          .back-link:hover { text-decoration: underline; }
          .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .action-card { 
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border: 2px solid #dee2e6;
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .action-card:hover { 
            transform: translateY(-5px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            border-color: #9c27b0;
          }
          .action-card h3 { color: #333; margin-bottom: 10px; font-size: 20px; }
          .action-card p { color: #6c757d; font-size: 14px; }
          .action-icon { font-size: 48px; margin-bottom: 15px; }
          .modal-overlay { 
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); 
            z-index: 1000; display: none; align-items: center; justify-content: center; 
          }
          .modal-overlay.active { display: flex; }
          .modal-content { 
            background: white; border-radius: 16px; padding: 0; max-width: 600px; width: 90%; 
            max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.3);
          }
          .modal-header { 
            background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
            color: white; padding: 20px 25px; border-radius: 16px 16px 0 0;
            display: flex; justify-content: space-between; align-items: center;
          }
          .modal-header h2 { margin: 0; font-size: 22px; }
          .close-btn { background: rgba(255,255,255,0.2); border: none; color: white; font-size: 24px; cursor: pointer; width: 32px; height: 32px; border-radius: 6px; }
          .close-btn:hover { background: rgba(255,255,255,0.3); }
          .modal-body { padding: 25px; }
          .form-group { margin-bottom: 20px; }
          .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
          .form-group input, .form-group select, .form-group textarea { 
            width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; 
            font-size: 14px; transition: all 0.2s;
          }
          .form-group input:focus, .form-group select:focus, .form-group textarea:focus { 
            outline: none; border-color: #9c27b0; box-shadow: 0 0 0 3px rgba(156,39,176,0.1);
          }
          .form-group textarea { min-height: 100px; resize: vertical; }
          .form-actions { 
            display: flex; gap: 12px; justify-content: flex-end; 
            padding: 20px 25px; border-top: 1px solid #e9ecef;
          }
          .btn { 
            padding: 12px 24px; border: none; border-radius: 8px; 
            font-weight: 600; cursor: pointer; transition: all 0.2s;
          }
          .btn-primary { background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%); color: white; }
          .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(156,39,176,0.4); }
          .btn-secondary { background: #e9ecef; color: #333; }
          .btn-secondary:hover { background: #dee2e6; }
          .alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
          .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; margin-top: 15px; max-height: 400px; overflow-y: auto; }
          .image-item { 
            border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden; cursor: pointer;
            transition: all 0.2s;
          }
          .image-item:hover { border-color: #9c27b0; transform: scale(1.05); }
          .image-item.selected { border-color: #9c27b0; box-shadow: 0 0 0 3px rgba(156,39,176,0.3); }
          .image-item img { width: 100%; height: 150px; object-fit: cover; }
          .image-item-title { padding: 8px; font-size: 12px; text-align: center; color: #333; }
          .spinner { 
            border: 4px solid #f3f3f3; 
            border-top: 4px solid #9c27b0; 
            border-radius: 50%; 
            width: 40px; 
            height: 40px; 
            animation: spin 1s linear infinite; 
            margin: 0 auto; 
          }
          @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <a href="/admin" class="back-link">← Вернуться в админ панель</a>
          <div class="header">
            <h1>🛍️ Товар 2 - Управление товарами</h1>
            <p>Добавление категорий, подкатегорий и товаров с фото</p>
          </div>
          
          <div id="alertContainer"></div>
          
          <!-- Categories List -->
          <div style="margin-bottom: 30px; background: #f8f9fa; padding: 20px; border-radius: 12px;">
            <h3 style="margin-bottom: 15px; color: #333;">📂 Созданные категории (${categoriesWithCounts.length})</h3>
            ${categoriesWithCounts.length > 0 ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;">
                ${categoriesWithCounts.map(cat => `
                  <div style="background: white; padding: 15px; border-radius: 8px; border: 2px solid #e9ecef; cursor: pointer; transition: all 0.2s;" 
                       onclick="showCategoryProducts('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')"
                       onmouseover="this.style.borderColor='#9c27b0'; this.style.boxShadow='0 4px 12px rgba(156,39,176,0.2)'"
                       onmouseout="this.style.borderColor='#e9ecef'; this.style.boxShadow='none'">
                    <div style="font-weight: 600; color: #333; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                      <span>${cat.name}</span>
                      <span style="font-size: 10px; color: #6c757d;">📦</span>
                    </div>
                    <div style="font-size: 12px; color: #6c757d;">Слаг: ${cat.slug}</div>
                    <div style="font-size: 12px; color: ${cat.isActive ? '#28a745' : '#dc3545'}; margin-top: 5px;">
                      ${cat.isActive ? '✅ Активна' : '❌ Неактивна'}
                    </div>
                    <div style="margin-top: 8px; padding: 6px 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 6px; text-align: center; font-weight: 700; font-size: 18px;">
                      ${cat.productCount} товаров
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 8px;">
                      <button onclick="event.stopPropagation(); openMoveToSubcategoryModal('${cat.id}', '${cat.name.replace(/'/g, "\\'")}')" 
                              style="flex: 1; padding: 6px 12px; background: #9c27b0; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600;">
                        📁 В подкатегорию
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="color: #6c757d; text-align: center; padding: 20px;">Категории пока не созданы. Создайте первую категорию!</p>
            `}
          </div>
          
          <div class="actions-grid">
            <div class="action-card" onclick="openAddCategoryModal()">
              <div class="action-icon">📂</div>
              <h3>Добавить категорию</h3>
              <p>Создать новую категорию товаров</p>
            </div>
            <div class="action-card" onclick="openAddSubcategoryModal()">
              <div class="action-icon">📁</div>
              <h3>Добавить подкатегорию</h3>
              <p>Создать подкатегорию в существующей категории</p>
            </div>
            <div class="action-card" onclick="openAddProductModal()">
              <div class="action-icon">➕</div>
              <h3>Добавить товар</h3>
              <p>Создать новый товар с фото</p>
            </div>
            <div class="action-card" onclick="fetchSiamImages()" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              <div class="action-icon">📷</div>
              <h3>Загрузить фото с Siam Botanicals</h3>
              <p>Обновить изображения товаров с сайта</p>
            </div>
          </div>
        </div>

        <!-- Add Category Modal -->
        <div id="categoryModal" class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2>📂 Добавить категорию</h2>
              <button class="close-btn" onclick="closeModal('categoryModal')">&times;</button>
            </div>
            <form id="categoryForm" class="modal-body">
              <div class="form-group">
                <label>Название категории *</label>
                <input type="text" id="categoryName" required placeholder="Введите название категории">
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('categoryModal')">Отмена</button>
                <button type="submit" class="btn btn-primary">Создать категорию</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Add Subcategory Modal -->
        <div id="subcategoryModal" class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2>📁 Добавить подкатегорию</h2>
              <button class="close-btn" onclick="closeModal('subcategoryModal')">&times;</button>
            </div>
            <form id="subcategoryForm" class="modal-body">
              <div class="form-group">
                <label>Родительская категория *</label>
                <select id="parentCategory" required>
                  <option value="">Выберите категорию</option>
                  ${categoriesWithCounts.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Название подкатегории *</label>
                <input type="text" id="subcategoryName" required placeholder="Введите название подкатегории">
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('subcategoryModal')">Отмена</button>
                <button type="submit" class="btn btn-primary">Создать подкатегорию</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Add Product Modal -->
        <div id="productModal" class="modal-overlay">
          <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
              <h2>➕ Добавить товар</h2>
              <button class="close-btn" onclick="closeModal('productModal')">&times;</button>
            </div>
            <form id="productForm" class="modal-body" enctype="multipart/form-data">
              <div class="form-group">
                <label>Категория *</label>
                <select id="productCategory" required>
                  <option value="">Выберите категорию</option>
                  ${categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Название товара *</label>
                <input type="text" id="productName" required placeholder="Введите название товара">
              </div>
              <div class="form-group">
                <label>Краткое описание *</label>
                <textarea id="productSummary" required placeholder="Краткое описание товара"></textarea>
              </div>
              <div class="form-group">
                <label>Цена в PZ *</label>
                <input type="number" id="productPrice" step="0.01" required placeholder="0.00">
              </div>
              <div class="form-group">
                <label>Фото товара</label>
                <input type="file" id="productImage" accept="image/*">
                <button type="button" class="btn btn-secondary" onclick="openImageSelector()" style="margin-top: 10px;">📂 Выбрать из загруженных</button>
              </div>
              <input type="hidden" id="selectedImageUrl" value="">
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('productModal')">Отмена</button>
                <button type="submit" class="btn btn-primary">Создать товар</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Image Selector Modal -->
        <div id="imageSelectorModal" class="modal-overlay">
          <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
              <h2>📷 Выбрать фото</h2>
              <button class="close-btn" onclick="closeModal('imageSelectorModal')">&times;</button>
            </div>
            <div class="modal-body">
              <div class="image-grid" id="imageGrid">
                ${products.map(p => `
                  <div class="image-item" onclick="selectImage('${p.imageUrl}', '${p.id}')">
                    <img src="${p.imageUrl}" alt="${p.title}">
                    <div class="image-item-title">${p.title}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- Move to Subcategory Modal -->
        <div id="moveToSubcategoryModal" class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2>📁 Перенести в подкатегорию</h2>
              <button class="close-btn" onclick="closeModal('moveToSubcategoryModal')">&times;</button>
            </div>
            <form id="moveToSubcategoryForm" class="modal-body">
              <input type="hidden" id="moveCategoryId" value="">
              <div class="form-group">
                <label>Родительская категория *</label>
                <select id="moveParentCategory" required>
                  <option value="">Выберите родительскую категорию</option>
                  ${categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="closeModal('moveToSubcategoryModal')">Отмена</button>
                <button type="submit" class="btn btn-primary">Перенести</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Category Products Modal -->
        <div id="categoryProductsModal" class="modal-overlay">
          <div class="modal-content" style="max-width: 1000px;">
            <div class="modal-header">
              <h2 id="categoryProductsTitle">📦 Товары категории</h2>
              <button class="close-btn" onclick="closeModal('categoryProductsModal')">&times;</button>
            </div>
            <div class="modal-body">
              <div id="categoryProductsList" style="min-height: 200px;">
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                  <div class="spinner" style="margin: 0 auto 20px;"></div>
                  <p>Загрузка товаров...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <script>
          function showAlert(message, type = 'success') {
            const container = document.getElementById('alertContainer');
            container.innerHTML = \`<div class="alert alert-\${type}">\${message}</div>\`;
            setTimeout(() => container.innerHTML = '', 5000);
          }

          function openModal(modalId) {
            document.getElementById(modalId).classList.add('active');
          }

          function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
          }

          function openAddCategoryModal() {
            document.getElementById('categoryForm').reset();
            openModal('categoryModal');
          }

          function openAddSubcategoryModal() {
            document.getElementById('subcategoryForm').reset();
            openModal('subcategoryModal');
          }

          function openAddProductModal() {
            document.getElementById('productForm').reset();
            document.getElementById('selectedImageUrl').value = '';
            openModal('productModal');
          }

          function openImageSelector() {
            openModal('imageSelectorModal');
          }

          function selectImage(imageUrl, productId) {
            // Check if selecting for edit modal
            const imageSelectorModal = document.getElementById('imageSelectorModal');
            if (imageSelectorModal && imageSelectorModal.dataset.forEdit === 'true') {
              const editSelectedImageUrl = document.getElementById('editSelectedImageUrl2');
              const previewImg = document.getElementById('editProductImagePreviewImg2');
              if (editSelectedImageUrl) {
                editSelectedImageUrl.value = imageUrl;
              }
              if (previewImg) {
                previewImg.src = imageUrl;
                previewImg.style.display = 'block';
              }
              const editImageInput = document.getElementById('editProductImage2');
              if (editImageInput) {
                editImageInput.value = '';
              }
              imageSelectorModal.dataset.forEdit = 'false';
              closeModal('imageSelectorModal');
              showAlert('Фото выбрано');
              return;
            }
            
            // Original behavior for product creation
            const selectedImageUrlEl = document.getElementById('selectedImageUrl');
            const productImageEl = document.getElementById('productImage');
            if (selectedImageUrlEl) {
              selectedImageUrlEl.value = imageUrl;
            }
            if (productImageEl) {
              productImageEl.value = '';
            }
            closeModal('imageSelectorModal');
            const imageItem = document.querySelector(\`[onclick*="'\${productId}'"]\`);
            if (imageItem) {
              const titleElement = imageItem.querySelector('.image-item-title');
              if (titleElement) {
                showAlert('Фото выбрано: ' + titleElement.textContent);
              } else {
                showAlert('Фото выбрано');
              }
            } else {
              showAlert('Фото выбрано');
            }
          }

          function openMoveToSubcategoryModal(categoryId, categoryName) {
            document.getElementById('moveCategoryId').value = categoryId;
            document.getElementById('moveParentCategory').value = '';
            // Исключаем текущую категорию из списка родительских
            const select = document.getElementById('moveParentCategory');
            Array.from(select.options).forEach(option => {
              if (option.value === categoryId) {
                option.style.display = 'none';
              } else {
                option.style.display = 'block';
              }
            });
            openModal('moveToSubcategoryModal');
          }

          async function showCategoryProducts(categoryId, categoryName) {
            document.getElementById('categoryProductsTitle').textContent = \`📦 Товары категории: \${categoryName}\`;
            const listContainer = document.getElementById('categoryProductsList');
            const modal = document.getElementById('categoryProductsModal');
            if (modal) {
              modal.dataset.categoryId = categoryId;
              modal.dataset.categoryName = categoryName;
            }
            listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;"><div class="spinner" style="margin: 0 auto 20px;"></div><p>Загрузка товаров...</p></div>';
            openModal('categoryProductsModal');
            
            try {
              const res = await fetch(\`/admin/api/product2/category/\${categoryId}/products\`, {
                credentials: 'include'
              });
              
              const data = await res.json();
              if (data.success && data.products) {
                if (data.products.length === 0) {
                  listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #6c757d;"><p>В этой категории пока нет товаров</p></div>';
                } else {
                  listContainer.innerHTML = \`
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px;">
                      \${data.products.map(product => {
                        const rubPrice = (product.price * 100).toFixed(2);
                        const stock = product.stock || 0;
                        const hasCopiedImage = (product.description || '').indexOf('скопировано') !== -1;
                        return \`
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; position: relative;">
                          \${product.imageUrl ? \`<img src="\${product.imageUrl}" alt="\${product.title}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 10px;">\` : '<div style="width: 100%; height: 150px; background: #e9ecef; border-radius: 6px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: #6c757d;">📷 Нет фото</div>'}
                          <div style="font-weight: 600; color: #333; margin-bottom: 5px;">
                            \${product.title}
                            \${hasCopiedImage ? ' 📷' : ''}
                          </div>
                          \${product.sku ? \`<div style="font-size: 11px; color: #6b7280; margin-bottom: 5px;"><strong>ID товара (Item):</strong> <span style="color: #1f2937; font-weight: 600;">\${product.sku}</span></div>\` : ''}
                          \${hasCopiedImage ? '<div style="font-size: 10px; color: #f59e0b; background: #fef3c7; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 5px;"><strong>📷 Копия фото</strong></div>' : ''}
                          <div style="font-size: 12px; color: #6c757d; margin-bottom: 5px;">\${product.summary || 'Нет описания'}</div>
                          <div style="font-size: 14px; font-weight: 600; color: #28a745; margin-bottom: 5px;">
                            \${rubPrice} руб. / \${product.price.toFixed(2)} PZ
                          </div>
                          <div style="font-size: 12px; color: #6c757d; margin-bottom: 5px;">
                            Остаток: <strong style="color: \${stock > 0 ? stock <= 3 ? '#ffc107' : '#28a745' : '#dc3545'}">\${stock} шт.</strong>
                          </div>
                          <div style="font-size: 11px; color: #6c757d; margin-bottom: 10px;">
                            Статус: \${product.isActive ? '✅ Активен' : '❌ Неактивен'}
                          </div>
                          <button onclick="editProductFromList('\${product.id}', '\${product.title.replace(/'/g, "\\'")}', '\${(product.summary || '').replace(/'/g, "\\'")}', '\${(product.description || '').replace(/'/g, "\\'")}', \${product.price}, '\${product.categoryId}', \${product.isActive}, \${product.availableInRussia || false}, \${product.availableInBali || false}, '\${product.imageUrl || ''}', \${stock}, '\${(product.sku || '').replace(/'/g, "\\'")}')" 
                                  style="width: 100%; padding: 8px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px;">
                            ✏️ Редактировать
                          </button>
                        </div>
                      \`;
                      }).join('')}
                    </div>
                  \`;
                }
              } else {
                listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc3545;"><p>Ошибка загрузки товаров</p></div>';
              }
            } catch (error) {
              listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #dc3545;"><p>Ошибка: ' + error.message + '</p></div>';
            }
          }

          // Category Form
          document.getElementById('categoryForm').onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('categoryName').value;
            
            try {
              const res = await fetch('/admin/api/product2/category', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name })
              });
              
              const data = await res.json();
              if (data.success) {
                showAlert('✅ Категория успешно создана!');
                closeModal('categoryModal');
                setTimeout(() => location.reload(), 1000);
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              showAlert('❌ Ошибка: ' + error.message, 'error');
            }
          };

          // Subcategory Form
          document.getElementById('subcategoryForm').onsubmit = async (e) => {
            e.preventDefault();
            const categoryId = document.getElementById('parentCategory').value;
            const name = document.getElementById('subcategoryName').value;
            
            try {
              const res = await fetch('/admin/api/product2/subcategory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ categoryId, name })
              });
              
              const data = await res.json();
              if (data.success) {
                showAlert('✅ Подкатегория успешно создана!');
                closeModal('subcategoryModal');
                setTimeout(() => location.reload(), 1000);
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              showAlert('❌ Ошибка: ' + error.message, 'error');
            }
          };

          // Product Form
          document.getElementById('productForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('categoryId', document.getElementById('productCategory').value);
            formData.append('name', document.getElementById('productName').value);
            formData.append('summary', document.getElementById('productSummary').value);
            formData.append('price', document.getElementById('productPrice').value);
            
            const imageFile = document.getElementById('productImage').files[0];
            const selectedImageUrl = document.getElementById('selectedImageUrl').value;
            
            if (imageFile) {
              formData.append('image', imageFile);
            } else if (selectedImageUrl) {
              formData.append('imageUrl', selectedImageUrl);
            }
            
            try {
              const res = await fetch('/admin/api/product2/product', {
                method: 'POST',
                credentials: 'include',
                body: formData
              });
              
              const data = await res.json();
              if (data.success) {
                showAlert('✅ Товар успешно создан!');
                closeModal('productModal');
                setTimeout(() => location.reload(), 1000);
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              showAlert('❌ Ошибка: ' + error.message, 'error');
            }
          };

          // Move to Subcategory Form
          document.getElementById('moveToSubcategoryForm').onsubmit = async (e) => {
            e.preventDefault();
            const categoryId = document.getElementById('moveCategoryId').value;
            const parentCategoryId = document.getElementById('moveParentCategory').value;
            
            if (!parentCategoryId) {
              showAlert('❌ Выберите родительскую категорию', 'error');
              return;
            }
            
            try {
              const res = await fetch('/admin/api/product2/category/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ categoryId, parentCategoryId })
              });
              
              const data = await res.json();
              if (data.success) {
                showAlert('✅ Категория успешно перенесена в подкатегорию!');
                closeModal('moveToSubcategoryModal');
                setTimeout(() => location.reload(), 1000);
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              showAlert('❌ Ошибка: ' + error.message, 'error');
            }
          };

          // Edit product from list
          function editProductFromList(productId, title, summary, description, price, categoryId, isActive, availableInRussia, availableInBali, imageUrl, stock, sku) {
            console.log('🔵 editProductFromList called', { productId, title: title.substring(0, 30) });
            
            // Удаляем старое модальное окно если оно есть, чтобы пересоздать его заново
            let editModal = document.getElementById('editProductModal2');
            if (editModal) {
              console.log('🗑️ Removing existing modal');
              editModal.remove();
            }
            
            // Создаем новое модальное окно каждый раз
              editModal = document.createElement('div');
              editModal.id = 'editProductModal2';
              editModal.className = 'modal-overlay';
              editModal.innerHTML = \`
                <div class="modal-content" style="max-width: 800px;">
                  <div class="modal-header">
                    <h2>✏️ Редактировать товар</h2>
                    <button class="close-btn" onclick="closeEditProductModal2()">&times;</button>
                  </div>
                  <form id="editProductForm2" class="modal-body" enctype="multipart/form-data">
                    <input type="hidden" id="editProductId2" name="productId">
                    <div class="form-group">
                      <label>ID товара (Item/SKU)</label>
                      <input type="text" id="editProductSku2" placeholder="Например: FS1002-24">
                    </div>
                    <div class="form-group">
                      <label>Название товара *</label>
                      <input type="text" id="editProductName2" required>
                    </div>
                    <div class="form-group">
                      <label>Краткое описание *</label>
                      <textarea id="editProductSummary2" required></textarea>
                    </div>
                    <div class="form-group">
                      <label>Полное описание</label>
                      <textarea id="editProductDescription2" style="display:none;"></textarea>
                      <div id="editProductDescriptionEditor2" style="height: 250px; background: #fff; border-radius: 0 0 10px 10px;"></div>
                    </div>
                    <div class="form-group">
                      <label>Цена в PZ *</label>
                      <input type="number" id="editProductPrice2" step="0.01" required>
                    </div>
                    <div class="form-group">
                      <label>Цена в рублях</label>
                      <input type="number" id="editProductPriceRub2" step="0.01" readonly>
                    </div>
                    <div class="form-group">
                      <label>Остаток на складе *</label>
                      <input type="number" id="editProductStock2" required>
                    </div>
                    <div class="form-group">
                      <label>Категория *</label>
                      <select id="editProductCategory2" required>
                        <option value="">Загрузка категорий...</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Фото товара</label>
                      <div id="editProductImagePreview2" style="margin-bottom: 10px;">
                        <img id="editProductImagePreviewImg2" src="" style="max-width: 200px; max-height: 200px; display: none; border-radius: 8px;">
                      </div>
                      <input type="file" id="editProductImage2" accept="image/*">
                      <button type="button" onclick="openImageSelectorForEdit()" style="margin-top: 10px; padding: 8px 16px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">
                        📂 Выбрать из загруженных
                      </button>
                      <input type="hidden" id="editSelectedImageUrl2" value="">
                    </div>
                    <div class="form-group">
                      <label>
                        <input type="checkbox" id="editProductActive2"> Товар активен
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <input type="checkbox" id="editProductRussia2"> Доступен в России
                      </label>
                    </div>
                    <div class="form-group">
                      <label>
                        <input type="checkbox" id="editProductBali2"> Доступен на Бали
                      </label>
                    </div>
                    <div class="form-actions">
                      <button type="button" class="btn btn-secondary" onclick="closeEditProductModal2()">Отмена</button>
                      <button type="submit" class="btn btn-primary">Сохранить изменения</button>
                    </div>
                  </form>
                </div>
              \`;
              (document.querySelector('.admin-shell') || document.body).appendChild(editModal);
            }
            
            // ВАЖНО: Устанавливаем обработчик формы КАЖДЫЙ РАЗ при открытии модального окна
            // Удаляем старый обработчик если есть
            const editForm = document.getElementById('editProductForm2');
            if (editForm) {
              // Удаляем все старые обработчики
              const newForm = editForm.cloneNode(true);
              editForm.parentNode.replaceChild(newForm, editForm);
              
              // Устанавливаем новый обработчик формы
              document.getElementById('editProductForm2').onsubmit = async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('📤 Submitting edit form for product:', productId);
                
                const formData = new FormData();
                formData.append('productId', document.getElementById('editProductId2').value);
                formData.append('sku', document.getElementById('editProductSku2').value || '');
                formData.append('title', document.getElementById('editProductName2').value);
                formData.append('summary', document.getElementById('editProductSummary2').value);
                let descriptionHtml2 = document.getElementById('editProductDescription2').value;
                if (typeof window.editQuill2 !== 'undefined' && window.editQuill2) {
                  descriptionHtml2 = window.editQuill2.root.innerHTML;
                  if (descriptionHtml2 === '<p><br></p>') descriptionHtml2 = '';
                }
                formData.append('description', descriptionHtml2);
                formData.append('price', document.getElementById('editProductPrice2').value);
                formData.append('stock', document.getElementById('editProductStock2').value);
                formData.append('categoryId', document.getElementById('editProductCategory2').value);
                formData.append('isActive', document.getElementById('editProductActive2').checked ? 'true' : 'false');
                formData.append('availableInRussia', document.getElementById('editProductRussia2').checked ? 'true' : 'false');
                formData.append('availableInBali', document.getElementById('editProductBali2').checked ? 'true' : 'false');
                
                const imageFile = document.getElementById('editProductImage2').files[0];
                const selectedImageUrl = document.getElementById('editSelectedImageUrl2').value;
                
                if (imageFile) {
                  formData.append('image', imageFile);
                } else if (selectedImageUrl) {
                  formData.append('imageUrl', selectedImageUrl);
                }
                
                try {
                  const res = await fetch('/admin/api/product2/product/update', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                  });
                  
                  const data = await res.json();
                  if (data.success) {
                    showAlert('✅ Товар успешно обновлен!');
                    closeEditProductModal2();
                    // Reload category products if modal is open
                    const categoryModal = document.getElementById('categoryProductsModal');
                    if (categoryModal && categoryModal.classList.contains('active')) {
                      const currentCategoryId = categoryModal.dataset.categoryId;
                      const currentCategoryName = categoryModal.dataset.categoryName;
                      if (currentCategoryId) {
                        showCategoryProducts(currentCategoryId, currentCategoryName);
                      }
                    }
                  } else {
                    showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
                  }
                } catch (error) {
                  console.error('❌ Update error:', error);
                  showAlert('❌ Ошибка: ' + (error instanceof Error ? error.message : String(error)), 'error');
                }
              };
              
              // Price conversion - устанавливаем каждый раз
              const priceInput = document.getElementById('editProductPrice2');
              if (priceInput) {
                // Удаляем старые обработчики
                const newPriceInput = priceInput.cloneNode(true);
                priceInput.parentNode.replaceChild(newPriceInput, priceInput);
                
                // Устанавливаем новый обработчик
              document.getElementById('editProductPrice2').addEventListener('input', function() {
                const pzPrice = parseFloat(this.value) || 0;
                  const rubInput = document.getElementById('editProductPriceRub2');
                  if (rubInput) {
                    rubInput.value = (pzPrice * 100).toFixed(2);
                  }
              });
              }
            }
            
            // Fill form
            document.getElementById('editProductId2').value = productId;
            document.getElementById('editProductSku2').value = sku || '';
            document.getElementById('editProductName2').value = title;
            document.getElementById('editProductSummary2').value = summary;
            document.getElementById('editProductDescription2').value = description;
            
            // Initialize Quill for editProductModal2
            if (typeof window.editQuill2 !== 'undefined') {
              window.editQuill2 = undefined;
            }
            if (typeof Quill !== 'undefined' && document.getElementById('editProductDescriptionEditor2')) {
              window.editQuill2 = new Quill('#editProductDescriptionEditor2', {
                theme: 'snow',
                modules: {
                  toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'header': [1, 2, 3, false] }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                  ]
                }
              });
              window.editQuill2.clipboard.dangerouslyPasteHTML(description || '');
            }
            document.getElementById('editProductPrice2').value = price;
            document.getElementById('editProductPriceRub2').value = (price * 100).toFixed(2);
            document.getElementById('editProductStock2').value = stock;
            document.getElementById('editProductActive2').checked = isActive;
            document.getElementById('editProductRussia2').checked = availableInRussia;
            document.getElementById('editProductBali2').checked = availableInBali;
            
            if (imageUrl) {
              document.getElementById('editProductImagePreviewImg2').src = imageUrl;
              document.getElementById('editProductImagePreviewImg2').style.display = 'block';
            } else {
              document.getElementById('editProductImagePreviewImg2').style.display = 'none';
            }
            
            // Load categories
            fetch('/admin/api/categories', { credentials: 'include' })
              .then(res => res.json())
              .then(categories => {
                const select = document.getElementById('editProductCategory2');
                select.innerHTML = '<option value="">Выберите категорию</option>';
                categories.forEach(cat => {
                  const option = document.createElement('option');
                  option.value = cat.id;
                  option.textContent = cat.name;
                  if (cat.id === categoryId) option.selected = true;
                  select.appendChild(option);
                });
              });
            
            editModal.classList.add('active');
          }
          
          function closeEditProductModal2() {
            const modal = document.getElementById('editProductModal2');
            if (modal) {
              modal.classList.remove('active');
              // НЕ удаляем модальное окно, чтобы оно могло быть использовано снова
              // Но сбрасываем форму
              const form = document.getElementById('editProductForm2');
              if (form) {
                form.reset();
              }
            }
          }
          
          function openImageSelectorForEdit() {
            openModal('imageSelectorModal');
            // Store that we're selecting for edit
            document.getElementById('imageSelectorModal').dataset.forEdit = 'true';
          }
          
          // Fetch images from Siam Botanicals
          async function fetchSiamImages() {
            if (!confirm('Загрузить изображения товаров с сайта Siam Botanicals? Это может занять несколько минут.')) {
              return;
            }
            
            showAlert('🔄 Загрузка изображений начата... Это может занять несколько минут.', 'success');
            
            try {
              const res = await fetch('/admin/api/product2/fetch-siam-images', {
                method: 'POST',
                credentials: 'include'
              });
              
              const data = await res.json();
              if (data.success) {
                showAlert(\`✅ \${data.message || 'Загрузка запущена'}\`, 'success');
                setTimeout(() => location.reload(), 3000);
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              showAlert('❌ Ошибка: ' + error.message, 'error');
            }
          }
          
          // Update selectImage to handle edit mode
          const originalSelectImage = window.selectImage || selectImage;
          window.selectImage = function(imageUrl, productId) {
            // Check if selecting for edit modal
            const imageSelectorModal = document.getElementById('imageSelectorModal');
            if (imageSelectorModal && imageSelectorModal.dataset.forEdit === 'true') {
              document.getElementById('editSelectedImageUrl2').value = imageUrl;
              const previewImg = document.getElementById('editProductImagePreviewImg2');
              if (previewImg) {
                previewImg.src = imageUrl;
                previewImg.style.display = 'block';
              }
              document.getElementById('editProductImage2').value = '';
              imageSelectorModal.dataset.forEdit = 'false';
              closeModal('imageSelectorModal');
              showAlert('Фото выбрано');
              return;
            }
            
            // Original behavior for product creation
            if (document.getElementById('selectedImageUrl')) {
              document.getElementById('selectedImageUrl').value = imageUrl;
            }
            if (document.getElementById('productImage')) {
              document.getElementById('productImage').value = '';
            }
            closeModal('imageSelectorModal');
            const imageItem = document.querySelector(\`[onclick*="'\${productId}'"]\`);
            if (imageItem) {
              const titleElement = imageItem.querySelector('.image-item-title');
              if (titleElement) {
                showAlert('Фото выбрано: ' + titleElement.textContent);
              } else {
                showAlert('Фото выбрано');
              }
            } else {
              showAlert('Фото выбрано');
            }
          };
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Product2 page error:', error);
    res.status(500).send('Ошибка загрузки страницы Товар 2');
  }
});

// API routes for Product2
router.post('/api/product2/category', requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Название категории обязательно' });
    }

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || `category-${Date.now()}`;

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        isActive: true,
      },
    });

    res.json({ success: true, category });
  } catch (error: any) {
    console.error('Create category error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка создания категории' });
  }
});

router.post('/api/product2/subcategory', requireAdmin, async (req, res) => {
  try {
    const { categoryId, name } = req.body;
    if (!categoryId || !name) {
      return res.status(400).json({ success: false, error: 'Категория и название обязательны' });
    }

    const parentCategory = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!parentCategory) {
      return res.status(404).json({ success: false, error: 'Родительская категория не найдена' });
    }

    const slug = `${parentCategory.slug}-${name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30)}` || `subcategory-${Date.now()}`;

    const subcategory = await prisma.category.create({
      data: {
        name: `${parentCategory.name} > ${name}`,
        slug,
        isActive: true,
      },
    });

    res.json({ success: true, subcategory });
  } catch (error: any) {
    console.error('Create subcategory error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка создания подкатегории' });
  }
});

router.post('/api/product2/product', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { categoryId, name, summary, price, imageUrl } = req.body;

    if (!categoryId || !name || !summary || !price) {
      return res.status(400).json({ success: false, error: 'Все поля обязательны' });
    }

    let finalImageUrl = imageUrl || null;

    // Если загружено новое фото
    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, {
        folder: 'plazma/products',
        publicId: `product-${Date.now()}`,
        resourceType: 'image',
      });
      finalImageUrl = uploadResult.secureUrl;
    }

    const product = await prisma.product.create({
      data: {
        title: name,
        summary,
        price: parseFloat(price),
        imageUrl: finalImageUrl,
        categoryId,
        isActive: true,
        stock: 999,
        availableInRussia: true,
        availableInBali: true,
      },
    });

    res.json({ success: true, product });
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка создания товара' });
  }
});

// Update product for Product2
router.post('/api/product2/product/update', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { productId, title, summary, description, price, stock, categoryId, isActive, availableInRussia, availableInBali, imageUrl, sku } = req.body;

    if (!productId || !title || !summary || !price || !stock) {
      return res.status(400).json({ success: false, error: 'Все обязательные поля должны быть заполнены' });
    }

    let finalImageUrl = imageUrl || undefined;

    // Если загружено новое фото
    if (req.file) {
      const uploadResult = await uploadImage(req.file.buffer, {
        folder: 'plazma/products',
        publicId: `product-${Date.now()}`,
        resourceType: 'image',
      });
      finalImageUrl = uploadResult.secureUrl;
    }

    const updateData: any = {
      title,
      summary,
      description: description || null,
      price: parseFloat(price),
      stock: parseInt(stock),
      categoryId,
      isActive: isActive === 'true' || isActive === true,
      availableInRussia: availableInRussia === 'true' || availableInRussia === true,
      availableInBali: availableInBali === 'true' || availableInBali === true,
    };

    if (sku !== undefined) {
      updateData.sku = sku || null;
    }

    if (finalImageUrl !== undefined) {
      updateData.imageUrl = finalImageUrl;
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    res.json({ success: true, product });
  } catch (error: any) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка обновления товара' });
  }
});

// Get products by category
router.get('/api/product2/category/:categoryId/products', requireAdmin, async (req, res) => {
  try {
    const { categoryId } = req.params;

    const products = await prisma.product.findMany({
      where: { categoryId },
      select: {
        id: true,
        title: true,
        summary: true,
        description: true,
        price: true,
        stock: true,
        imageUrl: true,
        isActive: true,
        availableInRussia: true,
        availableInBali: true,
        categoryId: true,
        sku: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, products });
  } catch (error: any) {
    console.error('Get category products error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка загрузки товаров' });
  }
});

// Fetch images from Siam Botanicals
router.post('/api/product2/fetch-siam-images', requireAdmin, async (req, res) => {
  try {
    // Запускаем скрипт в фоне
    const { spawn } = await import('child_process');
    const scriptPath = process.cwd() + '/scripts/fetch-images-from-siam.ts';

    const child = spawn('npx', ['ts-node', '--esm', scriptPath], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    res.json({
      success: true,
      message: 'Загрузка изображений запущена в фоновом режиме. Проверьте логи через несколько минут.'
    });
  } catch (error: any) {
    console.error('Error starting image fetch:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка запуска загрузки изображений' });
  }
});

// Fetch images from Siam Botanicals
router.post('/api/product2/fetch-siam-images', requireAdmin, async (req, res) => {
  try {
    // Запускаем скрипт в фоне
    const { spawn } = await import('child_process');
    const scriptPath = process.cwd() + '/scripts/fetch-images-from-siam.ts';

    const child = spawn('npx', ['ts-node', '--esm', scriptPath], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore'
    });

    child.unref();

    res.json({
      success: true,
      message: 'Загрузка изображений запущена в фоновом режиме. Проверьте логи через несколько минут.'
    });
  } catch (error: any) {
    console.error('Error starting image fetch:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка запуска загрузки изображений' });
  }
});

// Move category to subcategory
router.post('/api/product2/category/move', requireAdmin, async (req, res) => {
  try {
    const { categoryId, parentCategoryId } = req.body;

    if (!categoryId || !parentCategoryId) {
      return res.status(400).json({ success: false, error: 'Категория и родительская категория обязательны' });
    }

    if (categoryId === parentCategoryId) {
      return res.status(400).json({ success: false, error: 'Нельзя перенести категорию в саму себя' });
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    const parentCategory = await prisma.category.findUnique({
      where: { id: parentCategoryId },
    });

    if (!category || !parentCategory) {
      return res.status(404).json({ success: false, error: 'Категория не найдена' });
    }

    // Обновляем название и slug категории, чтобы она стала подкатегорией
    const newSlug = `${parentCategory.slug}-${category.slug}`;
    const newName = `${parentCategory.name} > ${category.name}`;

    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        name: newName,
        slug: newSlug,
      },
    });

    res.json({ success: true, category: updatedCategory });
  } catch (error: any) {
    console.error('Move category error:', error);
    res.status(500).json({ success: false, error: error.message || 'Ошибка переноса категории' });
  }
});

// Handle product toggle active status
router.post('/products/:id/toggle-active', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return res.redirect('/admin/products?error=product_not_found');
    }

    // Ensure "Отключенные" category exists (slug: disabled)
    let disabledCategory = await prisma.category.findFirst({
      where: {
        OR: [{ name: 'Отключенные' }, { slug: 'disabled' }],
      },
    });

    if (!disabledCategory) {
      disabledCategory = await prisma.category.create({
        data: {
          name: 'Отключенные',
          slug: 'disabled',
          description: 'Автоматическая категория для отключенных товаров',
          isActive: true,
        },
      });
    }

    // Cosmetics category (for returning when enabling from disabled)
    const cosmeticsCategory = await prisma.category.findFirst({
      where: {
        OR: [{ name: 'Косметика' }, { slug: 'kosmetika' }],
      },
    });

    const willDisable = product.isActive === true;
    const willEnable = product.isActive === false;

    const updateData: any = { isActive: !product.isActive };
    if (willDisable) {
      // When disabling: move to "Отключенные"
      updateData.categoryId = disabledCategory.id;
    } else if (willEnable) {
      // When enabling: if currently in "Отключенные" — move back to cosmetics (if exists)
      if (String(product.categoryId) === String(disabledCategory.id) && cosmeticsCategory) {
        updateData.categoryId = cosmeticsCategory.id;
      }
    }

    await prisma.product.update({
      where: { id },
      data: updateData,
    });

    res.redirect('/admin/products?success=product_updated');
  } catch (error) {
    console.error('Product toggle error:', error);
    res.redirect('/admin/products?error=product_toggle');
  }
});

// Delete product
router.post('/products/:id/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });

    if (!product) {
      return res.redirect('/admin/products?error=product_not_found');
    }

    await prisma.product.delete({
      where: { id }
    });

    res.redirect('/admin/products?success=product_deleted');
  } catch (error) {
    console.error('Product delete error:', error);
    res.redirect('/admin/products?error=product_delete');
  }
});

// Update product
router.post('/products/:productId/update', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { productId } = req.params;

    // Правильно обрабатываем данные из FormData
    const title = String(req.body.title || '').trim();
    const price = parseFloat(String(req.body.price || '0'));
    const summary = String(req.body.summary || '').trim();
    const description = String(req.body.description || '').trim();
    const instruction = String(req.body.instruction || '').trim() || null;
    const categoryId = String(req.body.categoryId || '').trim();
    const stock = parseInt(String(req.body.stock || '999'), 10);
    const isActive = String(req.body.isActive || 'false').toLowerCase() === 'true';
    const availableInRussia = String(req.body.availableInRussia || 'false').toLowerCase() === 'true';
    const availableInBali = String(req.body.availableInBali || 'false').toLowerCase() === 'true';

    console.log('📥 Update product request:', {
      productId,
      title: title.substring(0, 50),
      price,
      categoryId,
      isActive,
      availableInRussia,
      availableInBali,
      stock,
      file: req.file ? 'file present' : 'no file'
    });

    // Валидация
    if (!title) {
      return res.status(400).json({ success: false, error: 'Название товара обязательно' });
    }
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, error: 'Цена должна быть больше 0' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, error: 'Категория обязательна' });
    }

    let imageUrl = undefined;
    if (req.file) {
      try {
        if (!isCloudinaryConfigured()) {
          return res.status(500).json({ success: false, error: 'Cloudinary не настроен' });
        }

        const result = await uploadImage(req.file.buffer, {
          folder: 'vital/products',
          publicId: `product-${productId}`,
          resourceType: 'image',
        });

        imageUrl = result.secureUrl;
        console.log('✅ Product image updated:', imageUrl);
      } catch (error: any) {
        console.error('Image upload error:', error);
        return res.status(500).json({ success: false, error: `Ошибка загрузки изображения: ${error.message || 'Неизвестная ошибка'}` });
      }
    }

    // Проверяем существование товара
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }

    // Проверяем существование категории
    if (categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: categoryId }
      });
      if (!category) {
        return res.status(400).json({ success: false, error: 'Категория не найдена' });
      }
    }

    const updateData: any = {
      title: title,
      price: price,
      summary: summary,
      description: description,
      instruction: instruction,
      categoryId: categoryId,
      stock: stock,
      isActive: isActive,
      availableInRussia: availableInRussia,
      availableInBali: availableInBali
    };

    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }

    console.log('💾 Updating product with data:', {
      productId,
      title: title.substring(0, 30),
      price,
      isActive,
      availableInRussia,
      availableInBali
    });

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    });

    console.log('✅ Product updated successfully:', product.id);
    res.json({ success: true, product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, error: 'Ошибка обновления товара' });
  }
});

// Upload product image
router.post('/products/:productId/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { productId } = req.params;

    if (!req.file) {
      return res.redirect(`/admin/products?error=no_image`);
    }

    if (!isCloudinaryConfigured()) {
      return res.redirect(`/admin/products?error=cloudinary_not_configured`);
    }

    try {
      const result = await uploadImage(req.file.buffer, {
        folder: 'vital/products',
        publicId: `product-${productId}`,
        resourceType: 'image',
      });

      await prisma.product.update({
        where: { id: productId },
        data: { imageUrl: result.secureUrl },
      });

      console.log('✅ Product image uploaded:', result.secureUrl);
      res.redirect(`/admin/products?success=image_updated`);
    } catch (error: any) {
      console.error('Image upload error:', error);
      res.redirect(`/admin/products?error=image_upload`);
    }
  } catch (error) {
    console.error('Upload product image error:', error);
    res.redirect(`/admin/products?error=image_upload`);
  }
});
// Import Siam Botanicals products endpoint
router.post('/api/import-siam-products', requireAdmin, async (req, res) => {
  try {
    console.log('🚀 Запрос на импорт продуктов из Siam Botanicals получен');
    console.log('📋 Request headers:', req.headers);
    console.log('📋 Request body:', req.body);

    // Запускаем импорт в фоне и возвращаем результат
    import('../services/siam-import-service.js')
      .then(({ importSiamProducts }) => {
        console.log('✅ Модуль импорта загружен, запускаю импорт...');
        return importSiamProducts();
      })
      .then(result => {
        console.log(`✅ Импорт завершён! Успешно: ${result.success}, Ошибок: ${result.errors}, Всего: ${result.total}`);
      })
      .catch(error => {
        console.error('❌ Ошибка импорта продуктов:', error);
        console.error('❌ Error stack:', error?.stack);
        console.error('❌ Error details:', {
          message: error?.message,
          name: error?.name,
          code: error?.code
        });
      });

    // Возвращаем ответ немедленно
    console.log('✅ Отправляю ответ клиенту об успешном запуске импорта');
    res.json({
      success: true,
      message: 'Импорт продуктов запущен. Проверьте логи сервера для прогресса.'
    });
  } catch (error: any) {
    console.error('❌ Import endpoint error:', error);
    console.error('❌ Error stack:', error?.stack);
    console.error('❌ Error details:', {
      message: error?.message,
      name: error?.name,
      code: error?.code
    });
    res.status(500).json({
      success: false,
      error: error.message || 'Ошибка запуска импорта'
    });
  }
});

// Endpoint для получения всех загруженных изображений товаров
router.get('/api/products/images', requireAdmin, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        imageUrl: {
          not: null
        }
      },
      select: {
        id: true,
        title: true,
        imageUrl: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Группируем по URL изображения (убираем дубликаты)
    const uniqueImages = new Map<string, { url: string; products: Array<{ id: string; title: string }> }>();

    products.forEach(product => {
      if (product.imageUrl) {
        if (!uniqueImages.has(product.imageUrl)) {
          uniqueImages.set(product.imageUrl, {
            url: product.imageUrl,
            products: []
          });
        }
        uniqueImages.get(product.imageUrl)!.products.push({
          id: product.id,
          title: product.title
        });
      }
    });

    const images = Array.from(uniqueImages.values());

    res.json({
      success: true,
      images: images
    });
  } catch (error: any) {
    console.error('❌ Error fetching product images:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Ошибка получения изображений'
    });
  }
});

// Endpoint для привязки существующего изображения к товару
router.post('/api/products/:productId/select-image', requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { imageUrl } = req.body as { imageUrl: string };

    if (!imageUrl || !imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: 'URL изображения не предоставлен'
      });
    }

    // Проверяем существование товара
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Товар не найден'
      });
    }

    // Обновляем товар
    await prisma.product.update({
      where: { id: productId },
      data: { imageUrl: imageUrl.trim() }
    });

    console.log(`✅ Изображение привязано к товару: ${product.title}`);

    return res.json({
      success: true,
      message: 'Изображение успешно привязано к товару',
      imageUrl: imageUrl.trim()
    });

  } catch (error: any) {
    console.error('❌ Error selecting product image:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Ошибка привязки изображения'
    });
  }
});

// Endpoint для загрузки изображения товара по URL
router.post('/api/products/:productId/upload-image-url', requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { imageUrl } = req.body as { imageUrl: string };

    if (!imageUrl || !imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        error: 'URL изображения не предоставлен'
      });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Cloudinary не настроен'
      });
    }

    // Проверяем существование товара
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Товар не найден'
      });
    }

    console.log(`📥 Загружаю изображение для товара: ${product.title}`);
    console.log(`   URL: ${imageUrl}`);

    // Скачиваем изображение
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`URL не является изображением: ${contentType}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    if (imageBuffer.length === 0) {
      throw new Error('Изображение пустое');
    }

    console.log(`   ✅ Изображение скачано (${(imageBuffer.length / 1024).toFixed(2)} KB)`);

    // Загружаем на Cloudinary
    console.log(`☁️  Загружаю на Cloudinary...`);
    const uploadResult = await uploadImage(imageBuffer, {
      folder: 'vital/products',
      publicId: `siam-${productId}`,
      resourceType: 'image'
    });

    console.log(`   ✅ Изображение загружено на Cloudinary: ${uploadResult.secureUrl}`);

    // Обновляем товар в базе данных
    await prisma.product.update({
      where: { id: productId },
      data: { imageUrl: uploadResult.secureUrl }
    });

    console.log(`   ✅ Товар обновлен: ${product.title}`);

    return res.json({
      success: true,
      message: 'Изображение успешно загружено и прикреплено к товару',
      imageUrl: uploadResult.secureUrl
    });

  } catch (error: any) {
    console.error('❌ Upload product image URL error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Ошибка загрузки изображения'
    });
  }
});

// AI Translation endpoint for products
router.post('/api/products/translate', requireAdmin, async (req, res) => {
  try {
    const { text, type, productName, productType } = req.body as {
      text: string;
      type: 'title' | 'summary' | 'description';
      productName?: string;
      productType?: string;
    };

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Текст для перевода не предоставлен'
      });
    }

    const { aiTranslationService } = await import('../services/ai-translation-service.js');

    if (!aiTranslationService.isEnabled()) {
      return res.status(503).json({
        success: false,
        error: 'AI Translation Service не настроен. Добавьте OPENAI_API_KEY в переменные окружения.'
      });
    }

    let translatedText: string;

    try {
      if (type === 'title') {
        translatedText = await aiTranslationService.translateTitle(text);
      } else if (type === 'summary') {
        translatedText = await aiTranslationService.translateSummary(text, productName || '');
      } else {
        // description
        translatedText = await aiTranslationService.translateProductDescription(
          text,
          productType || 'cosmetic',
          {
            preserveStyle: true,
            targetAudience: 'natural',
            enhanceDescription: true
          }
        );
      }

      return res.json({
        success: true,
        translated: translatedText
      });
    } catch (error: any) {
      console.error('AI Translation error:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Ошибка при переводе текста'
      });
    }
  } catch (error) {
    console.error('Translation endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Upload review image
router.post('/reviews/:reviewId/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!req.file) {
      return res.redirect(`/admin/reviews?error=no_image`);
    }

    if (!isCloudinaryConfigured()) {
      return res.redirect(`/admin/reviews?error=cloudinary_not_configured`);
    }

    try {
      const result = await uploadImage(req.file.buffer, {
        folder: 'vital/reviews',
        publicId: `review-${reviewId}`,
        resourceType: 'image',
      });

      await prisma.review.update({
        where: { id: reviewId },
        data: { photoUrl: result.secureUrl },
      });

      console.log('✅ Review image uploaded:', result.secureUrl);
      res.redirect(`/admin/reviews?success=image_updated`);
    } catch (error: any) {
      console.error('Image upload error:', error);
      res.redirect(`/admin/reviews?error=image_upload`);
    }
  } catch (error) {
    console.error('Upload review image error:', error);
    res.redirect(`/admin/reviews?error=image_upload`);
  }
});

router.get('/reviews', requireAdmin, async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    // Helper functions for escaping
    const escapeAttr = (str: string | null | undefined): string => {
      if (!str) return '';
      try {
        let result = String(str)
          .replace(/[\x00-\x1F\x7F-\u009F]/g, '')
          .replace(/\u2028/g, ' ')
          .replace(/\u2029/g, ' ')
          .replace(/[\r\n]+/g, ' ')
          .replace(/\t/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/[\u200B-\u200D\uFEFF]/g, '');
        result = result
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/`/g, '&#96;');
        if (result.length > 10000) {
          result = result.substring(0, 10000) + '...';
        }
        return result;
      } catch (error) {
        console.error('Error in escapeAttr:', error);
        return '';
      }
    };

    const escapeHtml = (str: string | null | undefined): string => {
      if (!str) return '';
      try {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/`/g, '&#96;');
      } catch (error) {
        console.error('Error in escapeHtml:', error);
        return '';
      }
    };

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Управление отзывами</title>
        <meta charset="utf-8">
        <style>
          ${ADMIN_UI_CSS}
          body { margin: 0; padding: 0; background: var(--admin-bg); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 6px; margin-bottom: 20px; }
          .btn:hover { background: #0056b3; }
          .review-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; margin-top: 20px; }
          .review-card { background: #fff; border-radius: 12px; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08); padding: 18px; display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s ease, box-shadow 0.2s ease; }
          .review-card:hover { transform: translateY(-4px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12); }
          .review-header { display: flex; justify-content: space-between; align-items: flex-start; }
          .review-name { font-size: 18px; font-weight: 600; color: #111827; margin: 0; }
          .review-badges { display: flex; gap: 8px; }
          .badge { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; display: inline-block; }
          .badge-pinned { background: #fef3c7; color: #92400e; }
          .badge-not-pinned { background: #f3f4f6; color: #374151; }
          .review-content { color: #4b5563; font-size: 14px; line-height: 1.5; margin: 0; }
          .review-meta { font-size: 12px; color: #6b7280; display: flex; justify-content: space-between; }
          .review-actions { display: flex; gap: 10px; flex-wrap: wrap; }
          .review-actions form { margin: 0; }
          .review-actions button { padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
          .review-actions .toggle-btn { background: #fbbf24; color: #92400e; }
          .review-actions .toggle-btn:hover { background: #f59e0b; }
          .review-actions .image-btn { background: #10b981; color: #064e3b; }
          .review-actions .image-btn:hover { background: #059669; }
          .review-actions .delete-btn { background: #f87171; color: #7f1d1d; }
          .review-actions .delete-btn:hover { background: #ef4444; }
          .status-btn { transition: all 0.2s ease; }
          .status-btn:hover { transform: scale(1.1); }
          .status-btn.active { color: #28a745; }
          .status-btn.inactive { color: #dc3545; }
          img.review-image { width: 100%; height: 200px; object-fit: cover; border-radius: 10px; }
          .review-image-placeholder { 
            width: 100%; 
            height: 200px; 
            border: 2px dashed #d1d5db; 
            border-radius: 10px; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            background: #f9fafb; 
            color: #6b7280; 
          }
          .placeholder-icon { font-size: 32px; margin-bottom: 8px; }
          .placeholder-text { font-size: 14px; font-weight: 500; }
          .alert { padding: 12px 16px; margin: 16px 0; border-radius: 8px; font-weight: 500; }
          .alert-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
          .alert-error { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Отзывы', activePath: '/admin/reviews', buildMarker })}
        
        ${req.query.success === 'image_updated' ? '<div class="alert alert-success">✅ Фото успешно обновлено!</div>' : ''}
        ${req.query.error === 'no_image' ? '<div class="alert alert-error">❌ Файл не выбран</div>' : ''}
        ${req.query.error === 'image_upload' ? '<div class="alert alert-error">❌ Ошибка загрузки фото</div>' : ''}
        ${req.query.error === 'cloudinary_not_configured' ? '<div class="alert alert-error">❌ Загрузка фото недоступна: Cloudinary не настроен (нужны CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET на Railway).</div>' : ''}
        ${req.query.error === 'review_not_found' ? '<div class="alert alert-error">❌ Отзыв не найден</div>' : ''}
        
        <div class="review-grid">
    `;

    reviews.forEach(review => {
      const safeId = escapeAttr(review.id);
      const safeName = escapeHtml(review.name || '');
      const safeContent = escapeHtml(review.content || '');
      const safePhotoUrl = escapeAttr(review.photoUrl || '');

      const imageSection = review.photoUrl
        ? `<img src="${safePhotoUrl}" alt="${safeName}" class="review-image" loading="lazy">`
        : `<div class="review-image-placeholder">
             <span class="placeholder-icon">👤</span>
             <span class="placeholder-text">Нет фото</span>
           </div>`;

      html += `
        <div class="review-card">
          ${imageSection}
          <div class="review-header">
            <h3 class="review-name">${safeName}</h3>
            <form method="post" action="/admin/reviews/${safeId}/toggle-active" style="display: inline;">
              <button type="submit" class="status-btn ${review.isActive ? 'active' : 'inactive'}" style="border: none; background: none; cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 4px;">
                ${review.isActive ? '✅ Активен' : '❌ Неактивен'}
              </button>
            </form>
          </div>
          <div class="review-badges">
            <span class="badge ${review.isPinned ? 'badge-pinned' : 'badge-not-pinned'}">${review.isPinned ? '📌 Закреплён' : '❌ Не закреплён'}</span>
          </div>
          <p class="review-content">${safeContent}</p>
          <div class="review-meta">
            <span>Создан: ${new Date(review.createdAt).toLocaleDateString()}</span>
            <span>ID: ${escapeHtml(review.id.slice(0, 8))}...</span>
          </div>
          <div class="review-actions">
            <form method="post" action="/admin/reviews/${safeId}/toggle-pinned">
              <button type="submit" class="toggle-btn">${review.isPinned ? 'Открепить' : 'Закрепить'}</button>
            </form>
            <form method="post" action="/admin/reviews/${safeId}/upload-image" enctype="multipart/form-data" style="display: inline;">
              <input type="file" name="image" accept="image/*" id="review-image-${safeId}" class="product-image-input" onchange="this.form.submit()">
              <label for="review-image-${safeId}" class="image-btn file-label-btn">📷 ${review.photoUrl ? 'Изменить фото' : 'Добавить фото'}</label>
            </form>
            <form method="post" action="/admin/reviews/${safeId}/delete" onsubmit="return confirm('Удалить отзыв от «${safeName}»?')">
              <button type="submit" class="delete-btn">Удалить</button>
            </form>
          </div>
        </div>
      `;
    });

    html += `
        </div>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Reviews page error:', error);
    res.status(500).send('Ошибка загрузки отзывов');
  }
});
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.orderRequest.findMany({
      include: {
        user: {
          include: {
            partner: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Управление заказами</title>
        <meta charset="utf-8">
        <style>
          ${ADMIN_UI_CSS}
          body { margin: 0; padding: 0; background: var(--admin-bg); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
          .btn:hover { background: #0056b3; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Заказы', activePath: '/admin/orders', buildMarker })}
        
        ${req.query.success === 'order_updated' ? '<div class="alert alert-success">✅ Статус заказа обновлен</div>' : ''}
        ${req.query.error === 'order_update' ? '<div class="alert alert-error">❌ Ошибка при обновлении статуса заказа</div>' : ''}
        ${req.query.success === 'balance_added' ? '<div class="alert alert-success">✅ Баланс пользователя пополнен</div>' : ''}
        ${req.query.success === 'order_paid' ? '<div class="alert alert-success">✅ Заказ оплачен, партнёрские вознаграждения начислены</div>' : ''}
        ${req.query.error === 'insufficient_balance' ? '<div class="alert alert-error">❌ Недостаточно средств на балансе пользователя</div>' : ''}
        ${req.query.error === 'invalid_amount' ? '<div class="alert alert-error">❌ Неверная сумма для пополнения</div>' : ''}
        ${req.query.error === 'payment_failed' ? '<div class="alert alert-error">❌ Ошибка при оплате заказа</div>' : ''}
        ${req.query.error === 'order_not_found' ? '<div class="alert alert-error">❌ Заказ не найден</div>' : ''}
        <style>
          .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
          .status-new { background: #fff3cd; color: #856404; }
          .status-processing { background: #d1ecf1; color: #0c5460; }
          .status-completed { background: #d4edda; color: #155724; }
          .status-cancelled { background: #f8d7da; color: #721c24; }
          .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
          .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        </style>
        <table>
          <tr><th>ID</th><th>Пользователь</th><th>Баланс</th><th>Статус</th><th>Контакт</th><th>Сообщение</th><th>Создан</th><th>Действия</th></tr>
    `;

    orders.forEach(order => {
      const items = typeof order.itemsJson === 'string'
        ? JSON.parse(order.itemsJson || '[]')
        : (order.itemsJson || []);

      // Handler for older format where items was array directly, or new format { items: [], total: 0 }
      const orderItems = Array.isArray(items) ? items : (items.items || []);
      const orderTotal = Array.isArray(items)
        ? items.reduce((sum: number, i: any) => sum + (i.price || 0) * (i.quantity || 1), 0)
        : (items.total || 0);

      const itemsHtml = orderItems.map((i: any) =>
        `<div>• ${escapeHtml(i.productTitle || i.productName || 'Товар')} x${i.quantity}</div>`
      ).join('');

      const user = order.user;
      const userHtml = user
        ? `<div>
             <a href="#" onclick="showUserDetails('${user.id}'); return false;" style="font-weight:600; text-decoration:none;">${escapeHtml(user.firstName || 'User')}</a>
             <div style="font-size:11px; color:#666;">@${escapeHtml(user.username || '')}</div>
             <div style="font-size:11px; color:#666;">${escapeHtml(user.phone || '')}</div>
           </div>`
        : `<div>${escapeHtml(order.contact || 'Не указан')}</div>`;

      const statusColors: Record<string, string> = {
        'NEW': '#007bff',
        'PROCESSING': '#fd7e14',
        'COMPLETED': '#28a745',
        'CANCELLED': '#dc3545'
      };

      const statusLabels: Record<string, string> = {
        'NEW': 'Новый',
        'PROCESSING': 'В работе',
        'COMPLETED': 'Выполнен',
        'CANCELLED': 'Отменен'
      };

      html += `
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 12px; font-size: 13px;">
            <div style="font-family:monospace; font-weight:bold;">#${order.id.slice(-6)}</div>
            <div style="font-size:11px; color:#999;">${new Date(order.createdAt).toLocaleDateString()}</div>
            <div style="font-size:11px; color:#999;">${new Date(order.createdAt).toLocaleTimeString().slice(0, 5)}</div>
          </td>
          <td style="padding: 12px;">${userHtml}</td>
          <td style="padding: 12px;">
            <div style="font-size:13px; margin-bottom:4px;">${itemsHtml || '<span style="color:#999">Нет товаров</span>'}</div>
            ${orderTotal > 0 ? `<div style="font-weight:bold; margin-top:4px;">Итого: ${orderTotal.toLocaleString('ru-RU')} ₽</div>` : ''}
            ${order.message ? `<div style="font-size:11px; color:#666; margin-top:4px; font-style:italic; max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(order.message)}">📝 ${escapeHtml(order.message)}</div>` : ''}
          </td>
          <td style="padding: 12px;">
             <span style="display:inline-block; padding:4px 8px; border-radius:4px; color:white; font-size:11px; font-weight:bold; background:${statusColors[order.status] || '#6c757d'}">
               ${statusLabels[order.status] || order.status}
             </span>
          </td>
          <td style="padding: 12px;">
            <div style="display: flex; gap: 5px; flex-direction: column;">
              <form method="post" action="/admin/orders/${order.id}/update-status" style="display: flex; gap: 4px;">
                <select name="status" style="padding: 2px; font-size: 11px; border:1px solid #ddd; border-radius:4px;">
                  <option value="NEW" ${order.status === 'NEW' ? 'selected' : ''}>Новый</option>
                  <option value="PROCESSING" ${order.status === 'PROCESSING' ? 'selected' : ''}>В работе</option>
                  <option value="COMPLETED" ${order.status === 'COMPLETED' ? 'selected' : ''}>Выполнен</option>
                  <option value="CANCELLED" ${order.status === 'CANCELLED' ? 'selected' : ''}>Отменен</option>
                </select>
                <button type="submit" style="background: #e9ecef; color: #333; border: 1px solid #ced4da; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 14px;" title="Обновить статус">💾</button>
              </form>
              
              ${(order.user as any)?.balance > 0 && order.status !== 'COMPLETED' ? `
              <form method="post" action="/admin/orders/${order.id}/pay">
                <button type="submit" 
                        style="width:100%; background: #28a745; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;" 
                        onclick="return confirm('Списать ${((order.user as any)?.balance || 0).toFixed(2)} PZ с баланса пользователя?')">
                  💳 Оплатить (${((order.user as any)?.balance || 0).toFixed(2)} PZ)
                </button>
              </form>` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    html += `
        </table>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Orders page error:', error);
    res.status(500).send('Ошибка загрузки заказов');
  }
});

// Certificates admin (types + issue codes)
router.get('/certificates', requireAdmin, async (req, res) => {
  try {
    const buildMarker = (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.BUILD_MARKER || '').toString().slice(0, 7);
    const p: any = prisma as any;
    const types = await p.certificateType.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    const templates = await p.certificateTemplate.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    const issued = await p.giftCertificate.findMany({ orderBy: [{ createdAt: 'desc' }], take: 50 });

    res.send(`
      <!doctype html>
      <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Сертификаты</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>${ADMIN_UI_CSS}
          .cert-page { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
          .cert-header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 50%, #3b82ab 100%); color: #fff; border-radius: 18px; padding: 28px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; box-shadow: 0 8px 32px rgba(30,58,95,0.25); }
          .cert-header-title { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
          .cert-header-sub { font-size: 14px; color: rgba(255,255,255,0.65); margin-top: 4px; }
          .cert-header-btns { display: flex; gap: 10px; }
          .cert-hbtn { border: none; border-radius: 12px; padding: 12px 22px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; transition: transform .15s, box-shadow .15s; }
          .cert-hbtn:hover { transform: translateY(-1px); }
          .cert-hbtn:active { transform: scale(0.97); }
          .cert-hbtn-primary { background: #fff; color: #1e3a5f; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          .cert-hbtn-secondary { background: rgba(255,255,255,0.15); color: #fff; backdrop-filter: blur(4px); }
          .cert-hbtn-secondary:hover { background: rgba(255,255,255,0.25); }

          /* Stats */
          .cert-stats { display: flex; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
          .cert-stat-chip { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 2px; min-width: 130px; }
          .cert-stat-label { font-size: 12px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
          .cert-stat-value { font-size: 24px; font-weight: 800; color: #1e3a5f; letter-spacing: -0.03em; }

          /* Section card */
          .cert-section { background: #fff; border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.06); margin-top: 22px; overflow: hidden; }
          .cert-section-head { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
          .cert-section-title { font-size: 17px; font-weight: 700; color: #0f172a; }

          /* Types grid */
          .cert-types-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 20px 24px; }
          .cert-type-card { background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; transition: box-shadow .2s, transform .2s; }
          .cert-type-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }
          .cert-type-img { width: 100%; height: auto; max-height: 200px; object-fit: contain; background: #f1f5f9; display: block; }
          .cert-type-placeholder { width: 100%; height: 100px; background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); display: flex; align-items: center; justify-content: center; font-size: 36px; opacity: 0.4; }
          .cert-type-body { padding: 14px 16px; }
          .cert-type-name { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
          .cert-type-meta { display: flex; gap: 14px; flex-wrap: wrap; }
          .cert-type-meta-item { font-size: 12px; color: #64748b; }
          .cert-type-meta-item b { color: #0f172a; }
          .cert-type-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; margin-top: 8px; }
          .cert-type-badge-active { background: #dcfce7; color: #166534; }
          .cert-type-badge-inactive { background: #fef2f2; color: #991b1b; }
          .cert-type-badge-dot { width: 5px; height: 5px; border-radius: 50%; }
          .cert-type-badge-active .cert-type-badge-dot { background: #22c55e; }
          .cert-type-badge-inactive .cert-type-badge-dot { background: #ef4444; }
          .cert-type-actions { display: flex; border-top: 1px solid #e2e8f0; }
          .cert-type-actions button { flex: 1; padding: 10px 0; border: none; background: none; font-size: 12px; font-weight: 600; color: #64748b; cursor: pointer; transition: background .15s, color .15s; }
          .cert-type-actions button:hover { background: #f1f5f9; color: #0f172a; }
          .cert-type-actions button:not(:last-child) { border-right: 1px solid #e2e8f0; }
          .cert-types-empty { padding: 32px; text-align: center; color: #94a3b8; font-size: 14px; }

          /* Issued codes table */
          .cert-table-wrap { padding: 0 24px 20px 24px; overflow-x: auto; }
          .cert-table { width: 100%; border-collapse: collapse; font-size: 13px; }
          .cert-table th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #f1f5f9; }
          .cert-table td { padding: 10px 12px; border-bottom: 1px solid #f8fafc; color: #334155; }
          .cert-table tr:hover td { background: #f8fafc; }
          .cert-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; color: #1e3a5f; }
          .cert-status { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
          .cert-status-active { background: #dcfce7; color: #166534; }
          .cert-status-used { background: #f1f5f9; color: #64748b; }
          .cert-status-gifted { background: #eff6ff; color: #1d4ed8; }
          .cert-hint { padding: 0 24px 16px 24px; font-size: 12px; color: #94a3b8; }

          /* ── Modal ── */
          .cert-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(8px); z-index: 10000; display: none; align-items: center; justify-content: center; padding: 16px; }
          .cert-overlay.open { display: flex; }
          .cert-modal { background: #fff; border-radius: 22px; width: min(620px, 96vw); box-shadow: 0 40px 80px rgba(15,23,42,0.3); animation: cert-modal-in .22s ease-out; overflow: hidden; }
          @keyframes cert-modal-in { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .cert-modal-head { padding: 22px 24px 0 24px; display: flex; justify-content: space-between; align-items: center; }
          .cert-modal-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          .cert-modal-close { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; color: #64748b; transition: background .15s; }
          .cert-modal-close:hover { background: #f1f5f9; color: #0f172a; }
          .cert-modal-body { padding: 20px 24px 24px 24px; }
          .cert-field { margin-bottom: 16px; }
          .cert-field-label { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block; }
          .cert-field-label .req { color: #dc2626; }
          .cert-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; transition: border-color .15s, box-shadow .15s; box-sizing: border-box; }
          .cert-input:focus { border-color: #1e3a5f; box-shadow: 0 0 0 3px rgba(30,58,95,0.08); outline: none; }
          .cert-input::placeholder { color: #cbd5e1; }
          .cert-textarea { resize: vertical; min-height: 70px; }
          .cert-fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .cert-fields-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

          /* Photo upload */
          .cert-photo-zone { border: 2px dashed #e2e8f0; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: border-color .15s, background .15s; min-height: 100px; position: relative; overflow: hidden; }
          .cert-photo-zone:hover { border-color: #94a3b8; background: #f8fafc; }
          .cert-photo-zone.has-image { border-style: solid; border-color: #e2e8f0; padding: 8px; }
          .cert-photo-zone img { width: 100%; height: auto; max-height: 280px; object-fit: contain; border-radius: 10px; }
          .cert-photo-zone .ph-icon { font-size: 28px; opacity: 0.4; }
          .cert-photo-zone .ph-text { font-size: 13px; color: #94a3b8; font-weight: 500; }
          .cert-photo-zone .ph-remove { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 8px; background: rgba(0,0,0,0.6); color: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; z-index: 2; }
          .cert-upload-spinner { display: none; position: absolute; inset: 0; background: rgba(255,255,255,0.85); align-items: center; justify-content: center; border-radius: 12px; z-index: 3; }
          .cert-upload-spinner.active { display: flex; }
          .cert-spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #1e3a5f; border-radius: 50%; animation: cert-spin .7s linear infinite; }
          @keyframes cert-spin { to { transform: rotate(360deg); } }

          /* Toggle */
          .cert-toggle { position: relative; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 500; color: #475569; }
          .cert-toggle input { display: none; }
          .cert-toggle-track { width: 42px; height: 24px; border-radius: 999px; background: #e2e8f0; transition: background .2s; position: relative; }
          .cert-toggle input:checked + .cert-toggle-track { background: #22c55e; }
          .cert-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); transition: left .2s; }
          .cert-toggle input:checked + .cert-toggle-track .cert-toggle-thumb { left: 20px; }

          .cert-modal-foot { padding: 16px 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
          .cert-modal-error { font-size: 13px; color: #dc2626; font-weight: 500; }
          .cert-modal-btns { display: flex; gap: 10px; }
          .cert-btn { padding: 11px 22px; border-radius: 10px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s, transform .1s; }
          .cert-btn:active { transform: scale(0.97); }
          .cert-btn-ghost { background: #f1f5f9; color: #475569; }
          .cert-btn-ghost:hover { background: #e2e8f0; }
          .cert-btn-primary { background: #1e3a5f; color: #fff; }
          .cert-btn-primary:hover { background: #2d5a87; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Сертификаты', activePath: '/admin/certificates', buildMarker })}
        <div class="cert-page">
          <!-- Header -->
          <div class="cert-header">
            <div>
              <div class="cert-header-title">🎟️ Сертификаты</div>
              <div class="cert-header-sub">Управляйте типами сертификатов и выданными кодами</div>
            </div>
            <div class="cert-header-btns">
              <button class="cert-hbtn cert-hbtn-secondary" onclick="openIssueModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                Выдать код
              </button>
              <button class="cert-hbtn cert-hbtn-primary" onclick="openTypeModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Добавить тип
              </button>
            </div>
          </div>

          <!-- Stats and Designs -->
          <div style="display: flex; gap: 24px; margin-top: 18px; align-items: stretch; overflow-x: auto; padding-bottom: 8px;">
            <div class="cert-stats" style="margin-top: 0; flex-shrink: 0;">
              <div class="cert-stat-chip"><span class="cert-stat-label">Типов</span><span class="cert-stat-value">${types.length}</span></div>
              <div class="cert-stat-chip"><span class="cert-stat-label">Выдано кодов</span><span class="cert-stat-value">${issued.length}</span></div>
              <div class="cert-stat-chip"><span class="cert-stat-label">Активных</span><span class="cert-stat-value">${issued.filter((c: any) => c.status === 'ACTIVE').length}</span></div>
            </div>

            <!-- Mini Designs -->
            <div style="display: flex; gap: 14px; flex-shrink: 0; padding-left: 10px; border-left: 2px dashed #cbd5e1;">
              ${types.map((t: any) => `
                <div onclick='editType(${JSON.stringify({ id: t.id, title: t.title, priceRub: t.priceRub, valueRub: t.valueRub, sortOrder: t.sortOrder, description: t.description || '', isActive: t.isActive, imageUrl: t.imageUrl || '' }).replace(/</g, '\\u003c')})' style="width: 140px; border-radius: 12px; background: #fff; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 2px 10px rgba(0,0,0,0.06); cursor: pointer; overflow: hidden; display: flex; flex-direction: column; transition: transform .2s, box-shadow .2s; position: relative;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.06)';">
                  <div style="position: absolute; top: 6px; right: 6px; width: 10px; height: 10px; border-radius: 50%; background: ${t.isActive ? '#22c55e' : '#ef4444'}; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
                  ${t.imageUrl ? `<img src="${escapeHtml(t.imageUrl)}" style="width: 100%; height: 80px; object-fit: cover; background: #f8fafc;" alt=""/>` : `<div style="width: 100%; height: 80px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); display: flex; align-items: center; justify-content: center; opacity: 0.7; font-size: 28px;">🎟️</div>`}
                  <div style="padding: 10px 12px; font-size: 11px; font-weight: 700; text-align: center; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-top: 1px solid #f1f5f9; background: #fff;">
                    ${escapeHtml(t.title)}
                  </div>
                </div>
              `).join('')}

              <!-- Add New Button as Card -->
              <div onclick="openTypeModal()" style="width: 140px; border-radius: 12px; border: 2px dashed #cbd5e1; background: rgba(255,255,255,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.2s;" onmouseover="this.style.borderColor='#3b82ab'; this.style.color='#1e3a5f'; this.style.backgroundColor='#fff';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#64748b'; this.style.backgroundColor='rgba(255,255,255,0.5)';">
                <div style="font-size: 28px; font-weight: 300; margin-bottom: 2px; line-height: 1;">+</div>
                <div style="font-size: 12px; font-weight: 600;">Добавить тип</div>
              </div>
            </div>
          </div>

          <!-- General Templates -->
          <div class="cert-section" style="background: transparent; box-shadow: none; border: none; margin-top: 10px;">
            <div class="cert-section-head" style="padding: 10px 0; border: none;">
              <span class="cert-section-title" style="font-size: 16px;">Общие шаблоны для WebApp</span>
            </div>
            <div style="display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px;">
              ${templates.map((t: any) => `
                <div onclick='editTemplate(${JSON.stringify({ id: t.id, sortOrder: t.sortOrder, isActive: t.isActive, imageUrl: t.imageUrl || '' }).replace(/</g, '\\u003c')})' style="width: 140px; flex-shrink: 0; border-radius: 12px; background: #fff; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 2px 10px rgba(0,0,0,0.06); cursor: pointer; overflow: hidden; display: flex; flex-direction: column; transition: transform .2s, box-shadow .2s; position: relative;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.06)';">
                  <div style="position: absolute; top: 6px; right: 6px; width: 10px; height: 10px; border-radius: 50%; background: ${t.isActive ? '#22c55e' : '#ef4444'}; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></div>
                  <img src="${escapeHtml(t.imageUrl)}" style="width: 100%; height: 80px; object-fit: cover; background: #f8fafc;" alt=""/>
                </div>
              `).join('')}

              <div onclick="openTemplateModal()" style="width: 140px; flex-shrink: 0; border-radius: 12px; border: 2px dashed #cbd5e1; background: rgba(255,255,255,0.5); display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.2s;" onmouseover="this.style.borderColor='#3b82ab'; this.style.color='#1e3a5f'; this.style.backgroundColor='#fff';" onmouseout="this.style.borderColor='#cbd5e1'; this.style.color='#64748b'; this.style.backgroundColor='rgba(255,255,255,0.5)';">
                <div style="font-size: 28px; font-weight: 300; margin-bottom: 2px; line-height: 1;">+</div>
                <div style="font-size: 12px; font-weight: 600;">Добавить шаблон</div>
              </div>
            </div>
          </div>

          <!-- Issued Codes -->
          <div class="cert-section">
            <div class="cert-section-head">
              <span class="cert-section-title">Выданные коды (последние 50)</span>
            </div>
            <div class="cert-table-wrap">
              <table class="cert-table">
                <thead><tr><th>Код</th><th>Остаток (PZ)</th><th>Статус</th><th>Пользователь</th><th>Дата</th></tr></thead>
                <tbody>
                  ${issued.map((c: any) => {
                    const st = c.status || '';
                    const stClass = st === 'ACTIVE' ? 'cert-status-active' : st === 'GIFTED' ? 'cert-status-gifted' : 'cert-status-used';
                    return `<tr>
                      <td><span class="cert-code">${escapeHtml(c.code)}</span></td>
                      <td>${Number(c.remainingPz || 0).toFixed(2)}</td>
                      <td><span class="cert-status ${stClass}">${escapeHtml(st)}</span></td>
                      <td>${c.userId ? escapeHtml(String(c.userId)) : '<span style="color:#cbd5e1;">—</span>'}</td>
                      <td style="white-space:nowrap;">${new Date(c.createdAt).toLocaleString('ru-RU')}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <div class="cert-hint">Для применения вводится код в форме оформления заказа.</div>
          </div>
        </div>

        <!-- ── Type Modal ── -->
        <div class="cert-overlay" id="typeOverlay">
          <div class="cert-modal">
            <div class="cert-modal-head">
              <span class="cert-modal-title" id="typeModalTitle">Новый тип сертификата</span>
              <button class="cert-modal-close" onclick="closeTypeModal()">×</button>
            </div>
            <div class="cert-modal-body">
              <div class="cert-field">
                <label class="cert-field-label">Шаблон / обложка сертификата</label>
                <div class="cert-photo-zone" id="certPhotoZone" onclick="document.getElementById('ct_image_file').click()">
                  <input type="file" id="ct_image_file" accept="image/*" style="display:none" onchange="handleCertPhoto(this)" />
                  <span class="ph-icon" id="certPhIcon">📷</span>
                  <span class="ph-text" id="certPhText">Нажмите или перетащите изображение шаблона</span>
                  <div class="cert-upload-spinner" id="certPhotoSpinner"><div class="cert-spinner"></div></div>
                </div>
              </div>
              <div class="cert-field">
                <label class="cert-field-label">Название <span class="req">*</span></label>
                <input class="cert-input" id="ct_title" placeholder="Подарочный сертификат" />
              </div>
              <div class="cert-fields-row3">
                <div class="cert-field"><label class="cert-field-label">Цена (₽) <span class="req">*</span></label><input class="cert-input" id="ct_priceRub" type="number" min="0" step="1" placeholder="1000" /></div>
                <div class="cert-field"><label class="cert-field-label">Номинал (₽) <span class="req">*</span></label><input class="cert-input" id="ct_valueRub" type="number" min="0" step="1" placeholder="1000" /></div>
                <div class="cert-field"><label class="cert-field-label">Сортировка</label><input class="cert-input" id="ct_sortOrder" type="number" step="1" value="0" /></div>
              </div>
              <div class="cert-field">
                <label class="cert-field-label">Описание</label>
                <textarea class="cert-input cert-textarea" id="ct_description" placeholder="Короткое описание сертификата..."></textarea>
              </div>
              <div class="cert-field" style="display:flex;align-items:center;padding-top:4px;">
                <label class="cert-toggle"><input type="checkbox" id="ct_isActive" checked /><span class="cert-toggle-track"><span class="cert-toggle-thumb"></span></span>Активен</label>
              </div>
            </div>
            <div class="cert-modal-foot">
              <span class="cert-modal-error" id="ct_error"></span>
              <div class="cert-modal-btns">
                <button class="cert-btn cert-btn-ghost" onclick="closeTypeModal()">Отмена</button>
                <button class="cert-btn cert-btn-primary" onclick="saveType()">Сохранить</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Template Modal ── -->
        <div class="cert-overlay" id="templateOverlay">
          <div class="cert-modal">
            <div class="cert-modal-head">
              <span class="cert-modal-title" id="templateModalTitle">Новый шаблон</span>
              <button class="cert-modal-close" onclick="closeTemplateModal()">×</button>
            </div>
            <div class="cert-modal-body">
              <div class="cert-field">
                <label class="cert-field-label">Изображение шаблона <span class="req">*</span></label>
                <div class="cert-photo-zone" id="templatePhotoZone" onclick="document.getElementById('tmpl_image_file').click()">
                  <input type="file" id="tmpl_image_file" accept="image/*" style="display:none" onchange="handleTmplPhoto(this)" />
                  <span class="ph-icon">📷</span>
                  <span class="ph-text">Нажмите или перетащите изображение</span>
                  <div class="cert-upload-spinner" id="templatePhotoSpinner"><div class="cert-spinner"></div></div>
                </div>
              </div>
              <div class="cert-fields-row">
                <div class="cert-field"><label class="cert-field-label">Сортировка</label><input class="cert-input" id="tmpl_sortOrder" type="number" step="1" value="0" /></div>
              </div>
              <div class="cert-field" style="display:flex;align-items:center;padding-top:4px;">
                <label class="cert-toggle"><input type="checkbox" id="tmpl_isActive" checked /><span class="cert-toggle-track"><span class="cert-toggle-thumb"></span></span>Активен</label>
              </div>
            </div>
            <div class="cert-modal-foot">
              <span class="cert-modal-error" id="tmpl_error"></span>
              <div class="cert-modal-btns">
                <button class="cert-btn cert-btn-ghost" id="tmpl-del-btn" style="display:none; color: #dc2626;" onclick="deleteTemplate()">Удалить</button>
                <button class="cert-btn cert-btn-ghost" onclick="closeTemplateModal()">Отмена</button>
                <button class="cert-btn cert-btn-primary" onclick="saveTemplate()">Сохранить</button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Issue Modal ── -->
        <div class="cert-overlay" id="issueOverlay">
          <div class="cert-modal" style="width:min(480px,96vw);">
            <div class="cert-modal-head">
              <span class="cert-modal-title">Выдать код сертификата</span>
              <button class="cert-modal-close" onclick="closeIssueModal()">×</button>
            </div>
            <div class="cert-modal-body">
              <div class="cert-fields-row">
                <div class="cert-field"><label class="cert-field-label">Номинал (₽) <span class="req">*</span></label><input class="cert-input" id="ci_valueRub" type="number" min="0" step="1" placeholder="1000" /></div>
                <div class="cert-field"><label class="cert-field-label">Telegram ID (опционально)</label><input class="cert-input" id="ci_telegramId" placeholder="123456789" /></div>
              </div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Если Telegram ID не указан — код привяжется при первом использовании.</div>
            </div>
            <div class="cert-modal-foot">
              <span class="cert-modal-error" id="ci_error"></span>
              <div class="cert-modal-btns">
                <button class="cert-btn cert-btn-ghost" onclick="closeIssueModal()">Отмена</button>
                <button class="cert-btn cert-btn-primary" onclick="issueCode()">Выдать</button>
              </div>
            </div>
          </div>
        </div>

        <script>
          function qs(id){return document.getElementById(id);}
          function showTypeErr(msg){var el=qs('ct_error');if(el)el.textContent=msg||'';}
          function showTmplErr(msg){var el=qs('tmpl_error');if(el)el.textContent=msg||'';}
          function showIssueErr(msg){var el=qs('ci_error');if(el)el.textContent=msg||'';}

          var editingTypeId=null, certImageFile=null;
          var editingTmplId=null, tmplImageFile=null;

          function openTemplateModal(){editingTmplId=null;tmplImageFile=null;qs('templateModalTitle').textContent='Новый шаблон';qs('tmpl_sortOrder').value='0';qs('tmpl_isActive').checked=true;resetTmplPhoto();showTmplErr('');qs('tmpl-del-btn').style.display='none';qs('templateOverlay').classList.add('open');}
          function closeTemplateModal(){qs('templateOverlay').classList.remove('open');showTmplErr('');tmplImageFile=null;}
          function editTemplate(t){editingTmplId=t.id;tmplImageFile=null;qs('templateModalTitle').textContent='Редактировать шаблон';qs('tmpl_sortOrder').value=t.sortOrder||0;qs('tmpl_isActive').checked=!!t.isActive;qs('tmpl-del-btn').style.display='block';if(t.imageUrl)showTmplPhotoPreview(t.imageUrl);else resetTmplPhoto();showTmplErr('');qs('templateOverlay').classList.add('open');}

          /* Tmpl Photo */
          function resetTmplPhoto(){var z=qs('templatePhotoZone');if(z){z.classList.remove('has-image');z.innerHTML='<input type="file" id="tmpl_image_file" accept="image/*" style="display:none" onchange="handleTmplPhoto(this)" /><span class="ph-icon">📷</span><span class="ph-text">Нажмите или перетащите изображение</span><div class="cert-upload-spinner" id="templatePhotoSpinner"><div class="cert-spinner"></div></div>';}tmplImageFile=null;}
          function showTmplPhotoPreview(url){var z=qs('templatePhotoZone');if(z){z.classList.add('has-image');z.innerHTML='<input type="file" id="tmpl_image_file" accept="image/*" style="display:none" onchange="handleTmplPhoto(this)" /><img src="'+url+'" alt="" /><button class="ph-remove" onclick="event.stopPropagation();resetTmplPhoto();">×</button><div class="cert-upload-spinner" id="templatePhotoSpinner"><div class="cert-spinner"></div></div>';}}
          function handleTmplPhoto(input){var file=input.files&&input.files[0];if(!file)return;if(file.size>5*1024*1024){showTmplErr('Макс 5 МБ');return;}tmplImageFile=file;var reader=new FileReader();reader.onload=function(e){showTmplPhotoPreview(e.target.result);};reader.readAsDataURL(file);}

          async function saveTemplate(){
            showTmplErr('');
            var sortOrder=qs('tmpl_sortOrder').value||'0';
            var isActive=qs('tmpl_isActive').checked?'1':'0';
            if(!editingTmplId && !tmplImageFile) {showTmplErr('Загрузите изображение');return;}
            var fd=new FormData();
            fd.set('sortOrder',sortOrder);fd.set('isActive',isActive);
            if(tmplImageFile)fd.set('image',tmplImageFile);
            var url=editingTmplId?('/admin/api/certificate-templates/'+editingTmplId):'/admin/api/certificate-templates';
            var method=editingTmplId?'PUT':'POST';
            var res=await fetch(url,{method:method,body:fd});
            var data=await res.json().catch(function(){return{};});
            if(!res.ok){showTmplErr(data.error||data.message||'HTTP '+res.status);return;}
            location.reload();
          }

          async function deleteTemplate(){
            if(!editingTmplId) return;
            if(!confirm('Удалить шаблон?')) return;
            var res = await fetch('/admin/api/certificate-templates/'+editingTmplId, {method:'DELETE'});
            location.reload();
          }

          function openTypeModal(){editingTypeId=null;certImageFile=null;qs('typeModalTitle').textContent='Новый тип сертификата';qs('ct_title').value='';qs('ct_priceRub').value='';qs('ct_valueRub').value='';qs('ct_sortOrder').value='0';qs('ct_description').value='';qs('ct_isActive').checked=true;resetCertPhoto();showTypeErr('');qs('typeOverlay').classList.add('open');}
          function closeTypeModal(){qs('typeOverlay').classList.remove('open');showTypeErr('');certImageFile=null;}
          function editType(t){editingTypeId=t.id;certImageFile=null;qs('typeModalTitle').textContent='Редактировать тип';qs('ct_title').value=t.title||'';qs('ct_priceRub').value=t.priceRub||'';qs('ct_valueRub').value=t.valueRub||'';qs('ct_sortOrder').value=t.sortOrder||0;qs('ct_description').value=t.description||'';qs('ct_isActive').checked=!!t.isActive;if(t.imageUrl)showCertPhotoPreview(t.imageUrl);else resetCertPhoto();showTypeErr('');qs('typeOverlay').classList.add('open');}

          /* Photo */
          function resetCertPhoto(){var z=qs('certPhotoZone');z.classList.remove('has-image');z.innerHTML='<input type="file" id="ct_image_file" accept="image/*" style="display:none" onchange="handleCertPhoto(this)" /><span class="ph-icon">📷</span><span class="ph-text">Нажмите или перетащите шаблон</span><div class="cert-upload-spinner" id="certPhotoSpinner"><div class="cert-spinner"></div></div>';certImageFile=null;}
          function showCertPhotoPreview(url){var z=qs('certPhotoZone');z.classList.add('has-image');z.innerHTML='<input type="file" id="ct_image_file" accept="image/*" style="display:none" onchange="handleCertPhoto(this)" /><img src="'+url+'" alt="" /><button class="ph-remove" onclick="event.stopPropagation();resetCertPhoto();">×</button><div class="cert-upload-spinner" id="certPhotoSpinner"><div class="cert-spinner"></div></div>';}
          function handleCertPhoto(input){var file=input.files&&input.files[0];if(!file)return;if(file.size>5*1024*1024){showTypeErr('Макс 5 МБ');return;}certImageFile=file;var reader=new FileReader();reader.onload=function(e){showCertPhotoPreview(e.target.result);};reader.readAsDataURL(file);}

          // Drag & drop
          var czEl=qs('certPhotoZone');
          czEl.addEventListener('dragover',function(e){e.preventDefault();czEl.style.borderColor='#1e3a5f';});
          czEl.addEventListener('dragleave',function(){czEl.style.borderColor='';});
          czEl.addEventListener('drop',function(e){e.preventDefault();czEl.style.borderColor='';if(e.dataTransfer.files.length){qs('ct_image_file').files=e.dataTransfer.files;handleCertPhoto(qs('ct_image_file'));}});

          async function saveType(){
            showTypeErr('');
            var title=qs('ct_title').value.trim();
            var priceRub=qs('ct_priceRub').value;
            var valueRub=qs('ct_valueRub').value;
            var sortOrder=qs('ct_sortOrder').value||'0';
            var description=qs('ct_description').value||'';
            var isActive=qs('ct_isActive').checked?'1':'0';
            if(!title){showTypeErr('Укажите название');return;}
            if(Number(priceRub)<=0){showTypeErr('Укажите цену');return;}
            if(Number(valueRub)<=0){showTypeErr('Укажите номинал');return;}
            var fd=new FormData();
            fd.set('title',title);fd.set('priceRub',priceRub);fd.set('valueRub',valueRub);
            fd.set('sortOrder',sortOrder);fd.set('description',description);fd.set('isActive',isActive);
            if(certImageFile)fd.set('image',certImageFile);
            var url=editingTypeId?('/admin/api/certificate-types/'+editingTypeId):'/admin/api/certificate-types';
            var method=editingTypeId?'PUT':'POST';
            var res=await fetch(url,{method:method,body:fd});
            var data=await res.json().catch(function(){return{};});
            if(!res.ok){showTypeErr(data.error||data.message||'HTTP '+res.status);return;}
            location.reload();
          }
          async function toggleType(id,next){await fetch('/admin/api/certificate-types/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:next})});location.reload();}

          function openIssueModal(){showIssueErr('');qs('ci_valueRub').value='';qs('ci_telegramId').value='';qs('issueOverlay').classList.add('open');}
          function closeIssueModal(){qs('issueOverlay').classList.remove('open');showIssueErr('');}
          async function issueCode(){
            showIssueErr('');
            var v=Number(qs('ci_valueRub').value||0);
            if(!v){showIssueErr('Укажите номинал');return;}
            var tid=qs('ci_telegramId').value.trim();
            var res=await fetch('/admin/api/certificates/issue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({valueRub:v,telegramId:tid||null})});
            var data=await res.json().catch(function(){return{};});
            if(!res.ok){showIssueErr(data.error||'HTTP '+res.status);return;}
            alert('Код: '+data.code);
            location.reload();
          }
        </script>

        ${renderAdminShellEnd()}
      </body>
      </html>
    `);
  } catch (e: any) {
    console.error('Certificates admin page error:', e);
    res.status(500).send('Ошибка загрузки страницы сертификатов');
  }
});


router.post('/api/certificate-types', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const title = String(req.body?.title || '').trim();
    const priceRub = Number(req.body?.priceRub || 0) || 0;
    const valueRub = Number(req.body?.valueRub || 0) || 0;
    const sortOrder = Number(req.body?.sortOrder || 0) || 0;
    const description = String(req.body?.description || '').trim() || null;
    const isActive = String(req.body?.isActive || '1') === '1';
    if (!title) return res.status(400).json({ error: 'Название обязательно' });
    if (priceRub <= 0 || valueRub <= 0) return res.status(400).json({ error: 'Цена и номинал должны быть больше 0' });

    let imageUrl: string | null = null;
    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(400).json({ error: 'Cloudinary не настроен — загрузка обложки недоступна' });
      }
      const up = await uploadImage(req.file.buffer, { folder: 'certificates' });
      imageUrl = up.secureUrl;
    }

    const created = await (prisma as any).certificateType.create({
      data: { title, priceRub, valueRub, sortOrder, description, isActive, imageUrl }
    });
    res.json({ success: true, type: created });
  } catch (e: any) {
    console.error('Create certificate type error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка создания' });
  }
});

router.put('/api/certificate-types/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const data: any = {};
    if (req.body?.title !== undefined) data.title = String(req.body.title || '').trim();
    if (req.body?.priceRub !== undefined) data.priceRub = Number(req.body.priceRub || 0) || 0;
    if (req.body?.valueRub !== undefined) data.valueRub = Number(req.body.valueRub || 0) || 0;
    if (req.body?.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder || 0) || 0;
    if (req.body?.description !== undefined) data.description = String(req.body.description || '').trim() || null;
    if (req.body?.isActive !== undefined) data.isActive = String(req.body.isActive) === '1' || String(req.body.isActive) === 'true';

    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(400).json({ error: 'Cloudinary не настроен — загрузка обложки недоступна' });
      }
      const up = await uploadImage(req.file.buffer, { folder: 'certificates' });
      data.imageUrl = up.secureUrl;
    }

    const updated = await (prisma as any).certificateType.update({ where: { id }, data });
    res.json({ success: true, type: updated });
  } catch (e: any) {
    console.error('Update certificate type error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка обновления' });
  }
});

router.post('/api/certificate-templates', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const sortOrder = Number(req.body?.sortOrder || 0) || 0;
    const isActive = String(req.body?.isActive || '1') === '1';

    let imageUrl: string | null = null;
    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(400).json({ error: 'Cloudinary не настроен — загрузка обложки недоступна' });
      }
      const { uploadImage } = await import('../services/cloudinary-service.js');
      const up = await uploadImage(req.file.buffer, { folder: 'certificates/templates' });
      imageUrl = up.secureUrl;
    }

    if (!imageUrl) return res.status(400).json({ error: 'Изображение обязательно' });

    const created = await (prisma as any).certificateTemplate.create({
      data: { sortOrder, isActive, imageUrl }
    });
    res.json({ success: true, template: created });
  } catch (e: any) {
    console.error('Create template error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка создания шаблона' });
  }
});

router.put('/api/certificate-templates/:id', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });

    const data: any = {};
    if (req.body?.sortOrder !== undefined) data.sortOrder = Number(req.body.sortOrder || 0) || 0;
    if (req.body?.isActive !== undefined) data.isActive = String(req.body.isActive) === '1' || String(req.body.isActive) === 'true';

    if (req.file) {
      if (!isCloudinaryConfigured()) {
        return res.status(400).json({ error: 'Cloudinary не настроен — загрузка обложки недоступна' });
      }
      const { uploadImage } = await import('../services/cloudinary-service.js');
      const up = await uploadImage(req.file.buffer, { folder: 'certificates/templates' });
      data.imageUrl = up.secureUrl;
    }

    const updated = await (prisma as any).certificateTemplate.update({ where: { id }, data });
    res.json({ success: true, template: updated });
  } catch (e: any) {
    console.error('Update template error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка обновления шаблона' });
  }
});

router.delete('/api/certificate-templates/:id', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    await (prisma as any).certificateTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Ошибка удаления шаблона' });
  }
});

function genCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `VTL-${part(4)}-${part(4)}`;
}

router.post('/api/certificates/issue', requireAdmin, async (req, res) => {
  try {
    const valueRub = Number(req.body?.valueRub || 0) || 0;
    const telegramId = String(req.body?.telegramId || '').trim();
    if (valueRub <= 0) return res.status(400).json({ error: 'Номинал должен быть больше 0' });

    let userId: string | null = null;
    if (telegramId) {
      const u = await prisma.user.findUnique({ where: { telegramId } });
      if (!u) return res.status(404).json({ error: 'Пользователь с таким Telegram ID не найден' });
      userId = u.id;
    }

    const valuePz = valueRub / 100;
    let created: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = genCode();
      try {
        created = await (prisma as any).giftCertificate.create({
          data: { code, userId: userId || null, initialPz: valuePz, remainingPz: valuePz, status: 'ACTIVE' }
        });
        break;
      } catch (e: any) {
        if (e?.code === 'P2002') continue;
        throw e;
      }
    }
    if (!created) return res.status(500).json({ error: 'Не удалось сгенерировать код' });
    res.json({ success: true, code: created.code, id: created.id });
  } catch (e: any) {
    console.error('Issue certificate error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка выдачи' });
  }
});

// ─── B2B Partners ────────────────────────────────────────────────────────────

function genB2BCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `${part(3)}${part(3)}`;
}

router.get('/b2b-partners', requireAdmin, async (req, res) => {
  try {
    const buildMarker = (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.BUILD_MARKER || '').toString().slice(0, 7);
    const p: any = prisma as any;
    const partners = await p.b2BPartner.findMany({ orderBy: [{ createdAt: 'desc' }] });
    const botUsername = process.env.BOT_USERNAME || 'iplazmabot';

    res.send(`
      <!doctype html>
      <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Партнёры B2B</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>${ADMIN_UI_CSS}
          .b2b-page { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
          .b2b-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); color: #fff; border-radius: 18px; padding: 28px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; box-shadow: 0 8px 32px rgba(15,23,42,0.25); }
          .b2b-header-title { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; }
          .b2b-header-sub { font-size: 14px; color: rgba(255,255,255,0.65); margin-top: 4px; }
          .b2b-add-btn { background: #fff; color: #0f172a; border: none; border-radius: 12px; padding: 12px 22px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: transform .15s, box-shadow .15s; }
          .b2b-add-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }
          .b2b-stats-strip { display: flex; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
          .b2b-stat-chip { background: #fff; border-radius: 12px; padding: 14px 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 2px; min-width: 140px; }
          .b2b-stat-chip-label { font-size: 12px; color: #64748b; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
          .b2b-stat-chip-value { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; }
          .b2b-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 18px; margin-top: 22px; }
          .b2b-card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.06); transition: box-shadow .2s, transform .2s; }
          .b2b-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.1); transform: translateY(-2px); }
          .b2b-card-top { display: flex; align-items: center; gap: 14px; padding: 18px 20px 0 20px; }
          .b2b-card-avatar { width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0; background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #64748b; overflow: hidden; border: 2px solid rgba(0,0,0,0.05); }
          .b2b-card-avatar img { width: 100%; height: 100%; object-fit: cover; }
          .b2b-card-info { flex: 1; min-width: 0; }
          .b2b-card-name { font-size: 16px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .b2b-card-date { font-size: 12px; color: #94a3b8; margin-top: 2px; }
          .b2b-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
          .b2b-badge-active { background: #dcfce7; color: #166534; }
          .b2b-badge-inactive { background: #fef2f2; color: #991b1b; }
          .b2b-badge-dot { width: 6px; height: 6px; border-radius: 50%; }
          .b2b-badge-active .b2b-badge-dot { background: #22c55e; }
          .b2b-badge-inactive .b2b-badge-dot { background: #ef4444; }
          .b2b-card-body { padding: 14px 20px 0 20px; }
          .b2b-card-metrics { display: flex; gap: 20px; }
          .b2b-metric { display: flex; flex-direction: column; }
          .b2b-metric-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
          .b2b-metric-value { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; margin-top: 1px; }
          .b2b-progress-wrap { margin-top: 12px; }
          .b2b-progress-info { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
          .b2b-progress { height: 6px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
          .b2b-progress-bar { height: 100%; border-radius: 999px; transition: width .4s ease; background: linear-gradient(90deg, #0f172a 0%, #334155 100%); }
          .b2b-progress-bar.full { background: linear-gradient(90deg, #dc2626 0%, #ef4444 100%); }
          .b2b-link-box { margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: background .15s; }
          .b2b-link-box:hover { background: #f1f5f9; }
          .b2b-link-url { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .b2b-link-copy-ico { width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; transition: color .15s; }
          .b2b-link-box:hover .b2b-link-copy-ico { color: #0f172a; }
          .b2b-link-toast { font-size: 11px; color: #059669; font-weight: 600; display: none; white-space: nowrap; }
          .b2b-card-actions { display: flex; gap: 0; border-top: 1px solid #f1f5f9; margin-top: 16px; }
          .b2b-card-actions button { flex: 1; padding: 11px 0; border: none; background: none; font-size: 13px; font-weight: 600; color: #64748b; cursor: pointer; transition: background .15s, color .15s; }
          .b2b-card-actions button:hover { background: #f8fafc; color: #0f172a; }
          .b2b-card-actions button:not(:last-child) { border-right: 1px solid #f1f5f9; }
          .b2b-card-actions .b2b-act-danger:hover { color: #dc2626; }
          .b2b-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(8px); z-index: 10000; display: none; align-items: center; justify-content: center; padding: 16px; }
          .b2b-overlay.open { display: flex; }
          .b2b-modal { background: #fff; border-radius: 22px; width: min(580px, 96vw); box-shadow: 0 40px 80px rgba(15,23,42,0.3); animation: b2b-modal-in .22s ease-out; overflow: hidden; }
          @keyframes b2b-modal-in { from { opacity: 0; transform: translateY(16px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
          .b2b-modal-head { padding: 22px 24px 0 24px; display: flex; justify-content: space-between; align-items: center; }
          .b2b-modal-title { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          .b2b-modal-close { width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 18px; color: #64748b; transition: background .15s; }
          .b2b-modal-close:hover { background: #f1f5f9; color: #0f172a; }
          .b2b-modal-body { padding: 20px 24px 24px 24px; }
          .b2b-field { margin-bottom: 16px; }
          .b2b-field-label { font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block; }
          .b2b-field-label .req { color: #dc2626; }
          .b2b-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; font-size: 14px; font-family: inherit; transition: border-color .15s, box-shadow .15s; box-sizing: border-box; background: #fff; }
          .b2b-input:focus { border-color: #0f172a; box-shadow: 0 0 0 3px rgba(15,23,42,0.08); outline: none; }
          .b2b-input::placeholder { color: #cbd5e1; }
          .b2b-fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .b2b-photo-zone { border: 2px dashed #e2e8f0; border-radius: 14px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: border-color .15s, background .15s; min-height: 100px; position: relative; overflow: hidden; }
          .b2b-photo-zone:hover { border-color: #94a3b8; background: #f8fafc; }
          .b2b-photo-zone.has-image { border-style: solid; border-color: #e2e8f0; padding: 0; }
          .b2b-photo-zone img { width: 100%; height: auto; max-height: 300px; object-fit: contain; border-radius: 12px; }
          .b2b-photo-zone .ph-icon { font-size: 28px; opacity: 0.4; }
          .b2b-photo-zone .ph-text { font-size: 13px; color: #94a3b8; font-weight: 500; }
          .b2b-photo-zone .ph-remove { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 8px; background: rgba(0,0,0,0.6); color: #fff; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; z-index: 2; }
          .b2b-upload-spinner { display: none; position: absolute; inset: 0; background: rgba(255,255,255,0.85); align-items: center; justify-content: center; border-radius: 12px; z-index: 3; }
          .b2b-upload-spinner.active { display: flex; }
          .b2b-spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #0f172a; border-radius: 50%; animation: b2b-spin .7s linear infinite; }
          @keyframes b2b-spin { to { transform: rotate(360deg); } }
          .b2b-toggle { position: relative; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; font-size: 14px; font-weight: 500; color: #475569; }
          .b2b-toggle input { display: none; }
          .b2b-toggle-track { width: 42px; height: 24px; border-radius: 999px; background: #e2e8f0; transition: background .2s; position: relative; }
          .b2b-toggle input:checked + .b2b-toggle-track { background: #22c55e; }
          .b2b-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.15); transition: left .2s; }
          .b2b-toggle input:checked + .b2b-toggle-track .b2b-toggle-thumb { left: 20px; }
          .b2b-modal-foot { padding: 16px 24px; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
          .b2b-modal-error { font-size: 13px; color: #dc2626; font-weight: 500; }
          .b2b-modal-btns { display: flex; gap: 10px; }
          .b2b-btn { padding: 11px 22px; border-radius: 10px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: background .15s, transform .1s; }
          .b2b-btn:active { transform: scale(0.97); }
          .b2b-btn-ghost { background: #f1f5f9; color: #475569; }
          .b2b-btn-ghost:hover { background: #e2e8f0; }
          .b2b-btn-primary { background: #0f172a; color: #fff; }
          .b2b-btn-primary:hover { background: #1e293b; }
          .b2b-empty { text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 15px; }
          .b2b-empty-icon { font-size: 48px; margin-bottom: 12px; opacity: 0.4; }
          .b2b-empty-text { font-weight: 500; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Партнёры B2B', activePath: '/admin/b2b-partners', buildMarker })}
        <div class="b2b-page">
          <div class="b2b-header">
            <div>
              <div class="b2b-header-title">🤝 Партнёры B2B</div>
              <div class="b2b-header-sub">Создайте партнёра, отправьте ему ссылку — пользователи получат сертификат</div>
            </div>
            <button class="b2b-add-btn" onclick="openModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Добавить партнёра
            </button>
          </div>
          <div class="b2b-stats-strip">
            <div class="b2b-stat-chip"><span class="b2b-stat-chip-label">Партнёров</span><span class="b2b-stat-chip-value">${partners.length}</span></div>
            <div class="b2b-stat-chip"><span class="b2b-stat-chip-label">Активных</span><span class="b2b-stat-chip-value">${partners.filter((x: any) => x.isActive).length}</span></div>
            <div class="b2b-stat-chip"><span class="b2b-stat-chip-label">Сертификатов выдано</span><span class="b2b-stat-chip-value">${partners.reduce((s: number, x: any) => s + (x.issuedCount || 0), 0)}</span></div>
          </div>
          ${partners.length === 0 ? '<div class="b2b-empty"><div class="b2b-empty-icon">📦</div><div class="b2b-empty-text">Нет партнёров. Создайте первого!</div></div>' : `
          <div class="b2b-grid">
            ${partners.map((pt: any) => {
              const pct = pt.maxCertificates > 0 ? Math.min(100, Math.round(pt.issuedCount / pt.maxCertificates * 100)) : 0;
              const link = `https://t.me/${botUsername}?start=b2b_${pt.linkCode}`;
              const initials = (pt.name || '??').split(/\\s+/).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
              return `
              <div class="b2b-card">
                <div class="b2b-card-top">
                  <div class="b2b-card-avatar">${pt.imageUrl ? `<img src="${escapeHtml(pt.imageUrl)}" alt="" />` : initials}</div>
                  <div class="b2b-card-info">
                    <div class="b2b-card-name">${escapeHtml(pt.name)}</div>
                    <div class="b2b-card-date">${new Date(pt.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <span class="b2b-badge ${pt.isActive ? 'b2b-badge-active' : 'b2b-badge-inactive'}"><span class="b2b-badge-dot"></span>${pt.isActive ? 'Активен' : 'Неактивен'}</span>
                </div>
                <div class="b2b-card-body">
                  <div class="b2b-card-metrics">
                    <div class="b2b-metric"><span class="b2b-metric-label">Номинал</span><span class="b2b-metric-value">${Number(pt.certificateValueRub).toLocaleString('ru-RU')} ₽</span></div>
                    <div class="b2b-metric"><span class="b2b-metric-label">Выдано</span><span class="b2b-metric-value">${pt.issuedCount}${pt.maxCertificates > 0 ? ' / ' + pt.maxCertificates : ''}</span></div>
                    ${pt.maxCertificates === 0 ? '<div class="b2b-metric"><span class="b2b-metric-label">Лимит</span><span class="b2b-metric-value">∞</span></div>' : ''}
                  </div>
                  ${pt.maxCertificates > 0 ? `<div class="b2b-progress-wrap"><div class="b2b-progress-info"><span>${pt.issuedCount} из ${pt.maxCertificates}</span><span>${pct}%</span></div><div class="b2b-progress"><div class="b2b-progress-bar ${pct >= 100 ? 'full' : ''}" style="width:${pct}%"></div></div></div>` : ''}
                  <div class="b2b-link-box" onclick="copyLink(this, '${link}')">
                    <span class="b2b-link-url">${link}</span>
                    <svg class="b2b-link-copy-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    <span class="b2b-link-toast">Скопировано ✓</span>
                  </div>
                </div>
                <div class="b2b-card-actions">
                  <button onclick='editPartner(${JSON.stringify({ id: pt.id, name: pt.name, certificateValueRub: pt.certificateValueRub, maxCertificates: pt.maxCertificates, isActive: pt.isActive, imageUrl: pt.imageUrl || '' }).replace(/</g, '\\\\u003c')})'>✏️ Изменить</button>
                  <button onclick='togglePartner("${pt.id}", ${!pt.isActive})'>${pt.isActive ? '⏸ Выключить' : '▶️ Включить'}</button>
                  <button class="b2b-act-danger" onclick='deletePartner("${pt.id}", "${escapeHtml(pt.name)}")'>🗑 Удалить</button>
                </div>
              </div>`;
            }).join('')}
          </div>`}
        </div>
        <div class="b2b-overlay" id="b2bOverlay">
          <div class="b2b-modal">
            <div class="b2b-modal-head">
              <span class="b2b-modal-title" id="modalTitle">Новый партнёр</span>
              <button class="b2b-modal-close" onclick="closeModal()">×</button>
            </div>
            <div class="b2b-modal-body">
              <div class="b2b-field">
                <label class="b2b-field-label">Фото / логотип</label>
                <div class="b2b-photo-zone" id="photoZone" onclick="qs('photoInput').click()">
                  <input type="file" id="photoInput" accept="image/*" style="display:none" onchange="handlePhoto(this)" />
                  <span class="ph-icon" id="phIcon">📷</span>
                  <span class="ph-text" id="phText">Нажмите или перетащите изображение</span>
                  <div class="b2b-upload-spinner" id="photoSpinner"><div class="b2b-spinner"></div></div>
                </div>
              </div>
              <div class="b2b-fields-row">
                <div class="b2b-field"><label class="b2b-field-label">Название <span class="req">*</span></label><input class="b2b-input" id="p_name" placeholder="Форум, Конференция..." /></div>
                <div class="b2b-field"><label class="b2b-field-label">Номинал сертификата (₽) <span class="req">*</span></label><input class="b2b-input" id="p_valueRub" type="number" min="1" step="1" placeholder="1000" /></div>
              </div>
              <div class="b2b-fields-row">
                <div class="b2b-field"><label class="b2b-field-label">Лимит сертификатов</label><input class="b2b-input" id="p_maxCerts" type="number" min="0" step="1" value="0" placeholder="0 = без лимита" /></div>
                <div class="b2b-field" style="display:flex;align-items:flex-end;padding-bottom:4px;">
                  <label class="b2b-toggle"><input type="checkbox" id="p_isActive" checked /><span class="b2b-toggle-track"><span class="b2b-toggle-thumb"></span></span>Активен</label>
                </div>
              </div>
            </div>
            <div class="b2b-modal-foot">
              <span class="b2b-modal-error" id="p_error"></span>
              <div class="b2b-modal-btns">
                <button class="b2b-btn b2b-btn-ghost" onclick="closeModal()">Отмена</button>
                <button class="b2b-btn b2b-btn-primary" onclick="savePartner()">Сохранить</button>
              </div>
            </div>
          </div>
        </div>
        <script>
          function qs(id){return document.getElementById(id);}
          function showErr(msg){var el=qs('p_error');if(!el)return;el.textContent=msg||'';}
          var editingId=null,uploadedImageUrl='';
          function openModal(){editingId=null;uploadedImageUrl='';qs('modalTitle').textContent='Новый партнёр';qs('p_name').value='';qs('p_valueRub').value='';qs('p_maxCerts').value='0';qs('p_isActive').checked=true;resetPhoto();showErr('');qs('b2bOverlay').classList.add('open');}
          function closeModal(){qs('b2bOverlay').classList.remove('open');showErr('');}
          function editPartner(p){editingId=p.id;uploadedImageUrl=p.imageUrl||'';qs('modalTitle').textContent='Редактировать';qs('p_name').value=p.name||'';qs('p_valueRub').value=p.certificateValueRub||'';qs('p_maxCerts').value=p.maxCertificates||0;qs('p_isActive').checked=!!p.isActive;if(p.imageUrl)showPhotoPreview(p.imageUrl);else resetPhoto();showErr('');qs('b2bOverlay').classList.add('open');}
          function resetPhoto(){var z=qs('photoZone');z.classList.remove('has-image');z.innerHTML='<input type="file" id="photoInput" accept="image/*" style="display:none" onchange="handlePhoto(this)" /><span class="ph-icon">📷</span><span class="ph-text">Нажмите или перетащите</span><div class="b2b-upload-spinner" id="photoSpinner"><div class="b2b-spinner"></div></div>';uploadedImageUrl='';}
          function showPhotoPreview(url){var z=qs('photoZone');z.classList.add('has-image');z.innerHTML='<input type="file" id="photoInput" accept="image/*" style="display:none" onchange="handlePhoto(this)" /><img src="'+url+'" alt="" /><button class="ph-remove" onclick="event.stopPropagation();resetPhoto();">×</button><div class="b2b-upload-spinner" id="photoSpinner"><div class="b2b-spinner"></div></div>';}
          async function handlePhoto(input){var file=input.files&&input.files[0];if(!file)return;if(file.size>5*1024*1024){showErr('Макс 5 МБ');return;}qs('photoSpinner').classList.add('active');showErr('');try{var fd=new FormData();fd.append('image',file);var res=await fetch('/admin/api/b2b-partners/upload-image',{method:'POST',body:fd});var data=await res.json();if(!res.ok)throw new Error(data.error||'Upload failed');uploadedImageUrl=data.url;showPhotoPreview(data.url);}catch(e){showErr('Ошибка: '+e.message);}finally{qs('photoSpinner').classList.remove('active');}}
          var zoneEl=qs('photoZone');
          zoneEl.addEventListener('dragover',function(e){e.preventDefault();zoneEl.style.borderColor='#0f172a';});
          zoneEl.addEventListener('dragleave',function(){zoneEl.style.borderColor='';});
          zoneEl.addEventListener('drop',function(e){e.preventDefault();zoneEl.style.borderColor='';if(e.dataTransfer.files.length){qs('photoInput').files=e.dataTransfer.files;handlePhoto(qs('photoInput'));}});
          async function savePartner(){showErr('');var name=qs('p_name').value.trim();var v=Number(qs('p_valueRub').value||0);var m=Number(qs('p_maxCerts').value||0);var a=qs('p_isActive').checked;if(!name){showErr('Укажите название');return;}if(v<=0){showErr('Укажите номинал');return;}var url=editingId?'/admin/api/b2b-partners/'+editingId:'/admin/api/b2b-partners';var method=editingId?'PUT':'POST';var res=await fetch(url,{method:method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name,certificateValueRub:v,maxCertificates:m,isActive:a,imageUrl:uploadedImageUrl||null})});var data=await res.json().catch(function(){return{};});if(!res.ok){showErr(data.error||'HTTP '+res.status);return;}location.reload();}
          async function togglePartner(id,next){await fetch('/admin/api/b2b-partners/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:!!next})});location.reload();}
          async function deletePartner(id,name){if(!confirm('Удалить «'+name+'»?'))return;await fetch('/admin/api/b2b-partners/'+id,{method:'DELETE'});location.reload();}
          function copyLink(el,link){navigator.clipboard.writeText(link).then(function(){var t=el.querySelector('.b2b-link-toast');if(t){t.style.display='inline';setTimeout(function(){t.style.display='none';},1500);}});}
        </script>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `);
  } catch (e: any) {
    console.error('B2B partners admin page error:', e);
    res.status(500).send('Ошибка загрузки страницы B2B партнёров');
  }
});

// Upload partner image to Cloudinary
router.post('/api/b2b-partners/upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
    if (!isCloudinaryConfigured()) return res.status(500).json({ error: 'Cloudinary не настроен' });
    const result = await uploadImage(req.file.buffer, { folder: 'plazma/b2b-partners', resourceType: 'image' });
    res.json({ success: true, url: result.secureUrl });
  } catch (e: any) {
    console.error('Upload B2B partner image error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка загрузки' });
  }
});

router.post('/api/b2b-partners', requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const certificateValueRub = Number(req.body?.certificateValueRub || 0) || 0;
    const maxCertificates = Number(req.body?.maxCertificates || 0) || 0;
    const isActive = req.body?.isActive !== false && req.body?.isActive !== 'false';
    const imageUrl = req.body?.imageUrl || null;
    if (!name) return res.status(400).json({ error: 'Название обязательно' });
    if (certificateValueRub <= 0) return res.status(400).json({ error: 'Номинал должен быть больше 0' });
    let created: any = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const linkCode = genB2BCode();
      try {
        created = await (prisma as any).b2BPartner.create({ data: { name, linkCode, certificateValueRub, maxCertificates, isActive, imageUrl } });
        break;
      } catch (e: any) { if (e?.code === 'P2002') continue; throw e; }
    }
    if (!created) return res.status(500).json({ error: 'Не удалось сгенерировать уникальный код' });
    res.json({ success: true, partner: created });
  } catch (e: any) {
    console.error('Create B2B partner error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка создания' });
  }
});

router.put('/api/b2b-partners/:id', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });
    const data: any = {};
    if (req.body?.name !== undefined) data.name = String(req.body.name).trim();
    if (req.body?.certificateValueRub !== undefined) data.certificateValueRub = Number(req.body.certificateValueRub) || 0;
    if (req.body?.maxCertificates !== undefined) data.maxCertificates = Number(req.body.maxCertificates) || 0;
    if (req.body?.isActive !== undefined) data.isActive = req.body.isActive === true || req.body.isActive === 'true';
    if (req.body?.imageUrl !== undefined) data.imageUrl = req.body.imageUrl || null;
    const updated = await (prisma as any).b2BPartner.update({ where: { id }, data });
    res.json({ success: true, partner: updated });
  } catch (e: any) {
    console.error('Update B2B partner error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка обновления' });
  }
});

router.delete('/api/b2b-partners/:id', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id is required' });
    await (prisma as any).b2BPartner.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    console.error('Delete B2B partner error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка удаления' });
  }
});

// Support chats (WebApp) - view all user dialogs and reply
router.get('/chats', requireAdmin, async (req, res) => {
  try {
    const escapeHtml = (str: any) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const histories = await prisma.userHistory.findMany({
      where: { action: 'support:webapp' },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 2000
    });

    type ChatRow = {
      userId: string;
      telegramId: string;
      name: string;
      username: string;
      lastText: string;
      lastAt: Date;
      count: number;
    };

    const map = new Map<string, ChatRow>();
    for (const h of histories as any[]) {
      const user = h.user;
      if (!user?.telegramId) continue;
      const key = String(user.telegramId);
      const payload = (h.payload || {}) as any;
      const text = (payload.text || '').toString();

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          userId: user.id,
          telegramId: String(user.telegramId),
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Пользователь',
          username: user.username ? `@${user.username}` : '',
          lastText: text,
          lastAt: h.createdAt,
          count: 1,
        });
      } else {
        existing.count += 1;
      }
    }

    const chats = Array.from(map.values()).sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    let html = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Чаты поддержки</title>
        <style>
          ${ADMIN_UI_CSS}
          body { margin: 0; padding: 0; background: var(--admin-bg); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .btn { display: inline-block; padding: 10px 16px; background: #111827; color: white; text-decoration: none; border-radius: 10px; margin-bottom: 14px; }
          .card { background: white; border-radius: 14px; box-shadow: 0 8px 22px rgba(0,0,0,0.08); overflow: hidden; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 12px 14px; border-bottom: 1px solid #eef2f7; text-align: left; vertical-align: top; }
          th { background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; }
          tr:hover td { background: #fafafa; }
          .muted { color: #6b7280; font-size: 12px; }
          .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; background: #eef2ff; color: #3730a3; }
          .link { color: #111827; text-decoration: none; font-weight: 600; }
          .link:hover { text-decoration: underline; }
          .snippet { color: #111827; opacity: .85; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Чаты', activePath: '/admin/chats', buildMarker })}
        <h2 style="margin: 0 0 10px 0;">Чаты поддержки</h2>
        <p class="muted" style="margin: 0 0 16px 0;">Диалоги собираются из событий <code>support:webapp</code> в истории пользователя.</p>

        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Telegram</th>
                <th>Последнее</th>
                <th>Сообщений</th>
              </tr>
            </thead>
            <tbody>
    `;

    if (chats.length === 0) {
      html += `
        <tr>
          <td colspan="4" class="muted" style="padding: 22px;">Пока нет сообщений в поддержку из WebApp.</td>
        </tr>
      `;
    } else {
      for (const c of chats) {
        const when = new Date(c.lastAt).toLocaleString('ru-RU');
        const snippet = (c.lastText || '').slice(0, 160);
        html += `
          <tr>
            <td>
              <a class="link" href="/admin/chats/${encodeURIComponent(c.telegramId)}">${escapeHtml(c.name)}</a>
              ${c.username ? `<div class="muted">${escapeHtml(c.username)}</div>` : ''}
            </td>
            <td class="muted">${escapeHtml(c.telegramId)}</td>
            <td>
              <div class="snippet">${escapeHtml(snippet)}${c.lastText && c.lastText.length > 160 ? '…' : ''}</div>
              <div class="muted">${escapeHtml(when)}</div>
            </td>
            <td><span class="badge">${c.count}</span></td>
          </tr>
        `;
      }
    }

    html += `
            </tbody>
          </table>
        </div>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Chats page error:', error);
    res.status(500).send('Ошибка загрузки чатов');
  }
});

router.get('/chats/:telegramId', requireAdmin, async (req, res) => {
  try {
    const escapeHtml = (str: any) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };

    const telegramId = String(req.params.telegramId || '').trim();
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return res.status(404).send('Пользователь не найден');
    }

    const histories = await prisma.userHistory.findMany({
      where: { userId: user.id, action: 'support:webapp' },
      orderBy: { createdAt: 'asc' },
      take: 2000
    });
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    let html = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Чат: ${escapeHtml(user.firstName || '')}</title>
        <style>
          ${ADMIN_UI_CSS}
          body { margin: 0; padding: 0; background: var(--admin-bg); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .top { display:flex; justify-content: space-between; align-items:center; gap: 12px; margin-bottom: 12px; }
          .btn { display: inline-block; padding: 10px 16px; background: #111827; color: white; text-decoration: none; border-radius: 10px; }
          .card { background: white; border-radius: 14px; box-shadow: 0 8px 22px rgba(0,0,0,0.08); overflow: hidden; }
          .meta { padding: 14px 16px; border-bottom: 1px solid #eef2f7; }
          .muted { color: #6b7280; font-size: 12px; }
          .chat { padding: 16px; display:flex; flex-direction:column; gap: 10px; background: #fbfbfb; max-height: 65vh; overflow-y:auto; }
          .msg-row { display:flex; }
          .msg { max-width: 78%; padding: 10px 12px; border-radius: 14px; line-height: 1.35; white-space: pre-wrap; word-break: break-word; }
          .user { justify-content:flex-end; }
          .user .msg { background:#111827; color:#fff; border-top-right-radius: 8px; }
          .admin { justify-content:flex-start; }
          .admin .msg { background:#f3f4f6; color:#111827; border-top-left-radius: 8px; }
          .time { margin-top: 6px; font-size: 11px; opacity: .7; text-align:right; }
          form { padding: 14px 16px; border-top: 1px solid #eef2f7; background: white; display:grid; gap: 10px; }
          textarea { width: 100%; min-height: 90px; padding: 12px 14px; border: 1px solid #e5e7eb; border-radius: 12px; font-family: inherit; resize: vertical; }
          button { width: 100%; padding: 12px 14px; border: none; border-radius: 12px; background: #111827; color:#fff; font-weight: 700; cursor:pointer; }
          button:hover { filter: brightness(1.05); }
          .alert { padding: 10px 12px; border-radius: 12px; background:#dcfce7; color:#166534; margin-top: 10px; border: 1px solid #bbf7d0; }
        </style>
      </head>
      <body>
        ${renderAdminShellStart({ title: 'Чат', activePath: '/admin/chats', buildMarker })}
        <div class="top">
          <a class="btn" href="/admin/chats">Все чаты</a>
          <div class="muted">Telegram ID: <code>${escapeHtml(telegramId)}</code></div>
        </div>

        <div class="card">
          <div class="meta">
            <div style="font-weight:700;">${escapeHtml(`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Пользователь')}</div>
            ${user.username ? `<div class="muted">@${escapeHtml(user.username)}</div>` : ''}
            ${req.query.success === 'sent' ? `<div class="alert">✅ Ответ отправлен</div>` : ''}
          </div>
          <div class="chat" id="chatBox">
    `;

    if (histories.length === 0) {
      html += `<div class="muted">Сообщений пока нет.</div>`;
    } else {
      for (const h of histories as any[]) {
        const payload = (h.payload || {}) as any;
        const direction = payload.direction === 'admin' ? 'admin' : 'user';
        const text = (payload.text || '').toString();
        const when = new Date(h.createdAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        html += `
          <div class="msg-row ${direction}">
            <div class="msg">
              ${escapeHtml(text)}
              <div class="time">${escapeHtml(when)}</div>
            </div>
          </div>
        `;
      }
    }

    html += `
          </div>
          <form method="post" action="/admin/chats/${encodeURIComponent(telegramId)}/reply">
            <textarea name="text" placeholder="Написать пользователю..." required></textarea>
            <button type="submit">Отправить</button>
            <div class="muted">Сообщение уйдёт пользователю в Telegram и запишется в историю (для WebApp-чата).</div>
          </form>
        </div>

        <script>
          // scroll to bottom
          try {
            const el = document.getElementById('chatBox');
            if (el) el.scrollTop = el.scrollHeight;
          } catch (e) {}
        </script>
        ${renderAdminShellEnd()}
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Chat thread error:', error);
    res.status(500).send('Ошибка загрузки чата');
  }
});

router.post('/chats/:telegramId/reply', requireAdmin, express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const telegramId = String(req.params.telegramId || '').trim();
    const textRaw = (req.body?.text ?? '').toString();
    const text = textRaw.trim();
    if (!text) {
      return res.redirect(`/admin/chats/${encodeURIComponent(telegramId)}`);
    }

    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      return res.status(404).send('Пользователь не найден');
    }

    // Send via bot
    try {
      const { getBotInstance } = await import('../lib/bot-instance.js');
      const bot = await getBotInstance();
      if (bot) {
        const escapeTelegramHtml = (s: string) => s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        await bot.telegram.sendMessage(
          telegramId,
          `💬 <b>Ответ службы поддержки:</b>\n\n${escapeTelegramHtml(text)}`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (sendErr) {
      console.error('Failed to send admin chat reply:', sendErr);
      // Continue to log anyway
    }

    // Log to history for WebApp chat UI
    await prisma.userHistory.create({
      data: {
        userId: user.id,
        action: 'support:webapp',
        payload: JSON.stringify({ direction: 'admin', text })
      }
    });

    res.redirect(`/admin/chats/${encodeURIComponent(telegramId)}?success=sent`);
  } catch (error) {
    console.error('Chat reply error:', error);
    res.status(500).send('Ошибка отправки сообщения');
  }
});

// Siam PDF sync (run on server where DB + Cloudinary are available)
router.get('/sync-siam-pdf', requireAdmin, async (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Синхронизация Siam из PDF</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 20px auto; padding: 20px; background:#f5f5f5; }
        .card { background:white; border-radius:14px; padding:18px; box-shadow:0 8px 22px rgba(0,0,0,.08); }
        .btn { display:inline-block; padding:12px 16px; border-radius:12px; border:none; cursor:pointer; font-weight:800; }
        .btn-primary { background:#111827; color:white; }
        .btn-secondary { background:#e5e7eb; color:#111827; }
        .row { display:flex; gap:12px; flex-wrap:wrap; margin-top:14px; }
        pre { white-space: pre-wrap; background:#0b1020; color:#e5e7eb; padding:14px; border-radius:12px; overflow:auto; }
        .muted { color:#6b7280; font-size:12px; }
        label { display:flex; align-items:center; gap:10px; margin-top:12px; }
      </style>
    </head>
    <body>
      <a class="btn btn-secondary" href="/admin">← Назад</a>
      <div class="card">
        <h2 style="margin:0 0 8px 0;">📄 Синхронизация товаров Siam из PDF</h2>
        <div class="muted" style="margin:0 0 10px 0;">build: ${String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local'}</div>
        <p class="muted" style="margin:0 0 14px 0;">
          Обновляет товары строго по SKU из PDF: <b>title/summary/description</b>. Товары, которых нет в PDF — не трогаем.
          Опционально обновляет <b>фото</b> из встроенных картинок PDF (нужно Cloudinary).
        </p>

        <label>
          <input type="checkbox" id="withImages" />
          Обновить фото 1:1 из PDF (Cloudinary)
        </label>

        <div style="margin-top:12px;">
          <div class="muted" style="margin-bottom:6px;">PDF по ссылке (если на сервере нет файла):</div>
          <input id="pdfUrl" placeholder="Вставь прямую ссылку на PDF (https://...)"
                 style="width:100%; border-radius:12px; border:1px solid #e5e7eb; padding:12px; font-size:13px;" />
          <div class="muted" style="margin-top:6px;">
            Если заполнено — сервер скачает PDF и выполнит синхронизацию.
          </div>
        </div>

        <label>
          <input type="checkbox" id="translateTitles" checked />
          Перевести оставшиеся английские названия на русский
        </label>

        <div class="row">
          <button class="btn btn-primary" onclick="runSync()">Запустить синхронизацию</button>
        </div>

        <div style="margin-top:14px;">
          <pre id="out">Готово к запуску.</pre>
        </div>
      </div>

      <script>
        async function runSync() {
          const out = document.getElementById('out');
          out.textContent = '⏳ Запуск...';
          const withImages = document.getElementById('withImages').checked;
          const pdfUrl = (document.getElementById('pdfUrl').value || '').trim();
          const translateTitles = document.getElementById('translateTitles').checked;
          try {
            const res = await fetch('/admin/api/sync-siam-pdf', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ withImages, translateTitles, pdfUrl })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              out.textContent = '❌ Ошибка: ' + (data.error || ('HTTP ' + res.status));
              return;
            }
            out.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            out.textContent = '❌ Ошибка запуска: ' + (e && e.message ? e.message : String(e));
          }
        }
      </script>
    </body>
    </html>
  `);
});

router.post('/api/sync-siam-pdf', requireAdmin, express.json(), async (req, res) => {
  try {
    const withImages = !!req.body?.withImages;
    const translateTitles = req.body?.translateTitles !== false; // default true
    const pdfUrl = String(req.body?.pdfUrl || '').trim();
    const { syncSiamFromPdfOnServer, translateRemainingTitlesToRussianOnServer } = await import('../services/siam-pdf-sync-service.js');
    const result = await syncSiamFromPdfOnServer({ updateImages: withImages, pdfUrl });

    let translation = null;
    if (translateTitles) {
      translation = await translateRemainingTitlesToRussianOnServer({ limit: 2000 });
    }

    res.json({ success: true, ...result, translation });
  } catch (error) {
    console.error('sync-siam-pdf error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// Siam JSON sync (paste JSON extracted from PDF / tools; prices stay untouched)
router.get('/sync-siam-json', requireAdmin, async (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="ru">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Siam: синк из JSON</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 20px auto; padding: 20px; background:#f5f5f5; }
        .card { background:white; border-radius:14px; padding:18px; box-shadow:0 8px 22px rgba(0,0,0,.08); }
        .btn { display:inline-block; padding:12px 16px; border-radius:12px; border:none; cursor:pointer; font-weight:800; }
        .btn-primary { background:#111827; color:white; }
        .btn-secondary { background:#e5e7eb; color:#111827; }
        .btn-danger { background:#b91c1c; color:white; }
        .row { display:flex; gap:12px; flex-wrap:wrap; margin-top:14px; align-items:center; }
        pre { white-space: pre-wrap; background:#0b1020; color:#e5e7eb; padding:14px; border-radius:12px; overflow:auto; }
        .muted { color:#6b7280; font-size:12px; }
        label { display:flex; align-items:center; gap:10px; margin-top:12px; }
        textarea { width:100%; min-height: 260px; border-radius:12px; border:1px solid #e5e7eb; padding:12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
      </style>
    </head>
    <body>
      <a class="btn btn-secondary" href="/admin">← Назад</a>
      <div class="card" style="margin-top:12px;">
        <h2 style="margin:0 0 8px 0;">🧾 Siam: синхронизация из JSON</h2>
        <div class="muted" style="margin:0 0 10px 0;">build: ${String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local'}</div>
        <p class="muted" style="margin:0 0 14px 0;">
          Вставь массив объектов JSON (как ты прислал). Мы обновим <b>title/summary/description</b> строго по SKU.
          <b>Цены не трогаем.</b> Поля <b>ingredients/volume</b> при желании добавим в конец description.
        </p>

        <label>
          <input type="checkbox" id="includeMeta" checked />
          Добавлять ingredients/volume в description
        </label>

        <div style="margin-top:12px;">
          <div class="muted" style="margin-bottom:6px;">Ссылка на JSON (опционально, удобнее чем вставлять большой массив):</div>
          <input id="jsonUrl" placeholder="Напр.: https://raw.githubusercontent.com/.../siam.json"
                 style="width:100%; border-radius:12px; border:1px solid #e5e7eb; padding:12px; font-size:13px;" />
          <div class="muted" style="margin-top:6px;">
            Если заполнено — сервер скачает JSON по ссылке. Иначе используем поле ниже.
          </div>
        </div>

        <label>
          <input type="checkbox" id="apply" />
          Применить изменения (иначе — только отчёт)
        </label>

        <div style="margin-top:12px;">
          <textarea id="jsonInput" placeholder='Вставь сюда JSON-массив: [ { \"title\": \"...\", \"sku\": \"...\" }, ... ]'></textarea>
        </div>

        <div class="row">
          <button class="btn btn-primary" onclick="run(false)">Проверить (dry-run)</button>
          <button class="btn btn-danger" onclick="run(true)">Применить</button>
        </div>

        <div class="row" style="margin-top:10px;">
          <button class="btn btn-secondary" onclick="runBundled(false)">Проверить встроенный JSON</button>
          <button class="btn btn-secondary" style="background:#d1d5db; color:#111827;" onclick="runBundled(true)">Применить встроенный JSON</button>
        </div>

        <div class="row" style="margin-top:10px;">
          <button class="btn btn-secondary" onclick="translateTitles()">Перевести оставшиеся английские названия</button>
          <button class="btn btn-secondary" onclick="normalizeTitles(false)">Проверить нормализацию названий</button>
          <button class="btn btn-secondary" style="background:#111827; color:white;" onclick="normalizeTitles(true)">Применить нормализацию названий</button>
        </div>

        <div style="margin-top:14px;">
          <pre id="out">Готово. Вставь JSON и нажми «Проверить».</pre>
        </div>
      </div>

      <script>
        async function run(forceApply) {
          const out = document.getElementById('out');
          const text = document.getElementById('jsonInput').value || '';
          const jsonUrl = (document.getElementById('jsonUrl').value || '').trim();
          const includeMeta = document.getElementById('includeMeta').checked;
          const applyChecked = document.getElementById('apply').checked;
          const apply = !!forceApply || !!applyChecked;

          if (!jsonUrl && !text.trim()) {
            out.textContent = '❌ Вставь JSON в поле или укажи ссылку на JSON.';
            return;
          }

          out.textContent = '⏳ Запуск...';
          try {
            const res = await fetch('/admin/api/sync-siam-json', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonText: text, jsonUrl, includeMeta, apply })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              out.textContent = '❌ Ошибка: ' + (data.error || ('HTTP ' + res.status));
              return;
            }
            out.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            out.textContent = '❌ Ошибка запуска: ' + (e && e.message ? e.message : String(e));
          }
        }

        async function runBundled(forceApply) {
          const out = document.getElementById('out');
          const includeMeta = document.getElementById('includeMeta').checked;
          const applyChecked = document.getElementById('apply').checked;
          const apply = !!forceApply || !!applyChecked;
          out.textContent = '⏳ Запуск встроенного JSON...';
          try {
            const res = await fetch('/admin/api/sync-siam-json-bundled', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ includeMeta, apply })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              out.textContent = '❌ Ошибка: ' + (data.error || ('HTTP ' + res.status));
              return;
            }
            out.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            out.textContent = '❌ Ошибка запуска: ' + (e && e.message ? e.message : String(e));
          }
        }

        async function translateTitles() {
          const out = document.getElementById('out');
          out.textContent = '⏳ Перевод оставшихся английских названий...';
          try {
            const res = await fetch('/admin/api/translate-titles-ru', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ limit: 2000 })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              out.textContent = '❌ Ошибка: ' + (data.error || ('HTTP ' + res.status));
              return;
            }
            out.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            out.textContent = '❌ Ошибка запуска: ' + (e && e.message ? e.message : String(e));
          }
        }

        async function normalizeTitles(apply) {
          const out = document.getElementById('out');
          out.textContent = (apply ? '⏳ Применение нормализации...' : '⏳ Проверка нормализации...');
          try {
            const res = await fetch('/admin/api/normalize-titles-ru', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apply: !!apply, limit: 3000 })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              out.textContent = '❌ Ошибка: ' + (data.error || ('HTTP ' + res.status));
              return;
            }
            out.textContent = JSON.stringify(data, null, 2);
          } catch (e) {
            out.textContent = '❌ Ошибка запуска: ' + (e && e.message ? e.message : String(e));
          }
        }
      </script>
    </body>
    </html>
  `);
});

router.post('/api/sync-siam-json', requireAdmin, express.json({ limit: '6mb' }), async (req, res) => {
  try {
    const jsonText = String(req.body?.jsonText || '');
    const jsonUrl = String(req.body?.jsonUrl || '').trim();
    const includeMeta = req.body?.includeMeta !== false; // default true
    const apply = !!req.body?.apply;

    let parsed: any;
    if (jsonUrl) {
      if (!/^https?:\/\//i.test(jsonUrl)) {
        res.status(400).json({ success: false, error: 'jsonUrl must start with http(s)://' });
        return;
      }
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15000);
      try {
        const r = await fetch(jsonUrl, { signal: controller.signal });
        const body = await r.text().catch(() => '');
        if (!r.ok) {
          res.status(400).json({ success: false, error: `Failed to fetch jsonUrl: HTTP ${r.status}` });
          return;
        }
        if (body.length > 6_000_000) {
          res.status(400).json({ success: false, error: 'JSON слишком большой (> ~6MB). Разбей файл или сожми поля.' });
          return;
        }
        parsed = JSON.parse(body);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(400).json({ success: false, error: 'Failed to fetch/parse jsonUrl: ' + msg });
        return;
      } finally {
        clearTimeout(t);
      }
    } else {
      if (!jsonText.trim()) {
        res.status(400).json({ success: false, error: 'jsonText is empty (or provide jsonUrl)' });
        return;
      }
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(400).json({ success: false, error: 'Invalid JSON: ' + msg });
        return;
      }
    }

    if (!Array.isArray(parsed)) {
      res.status(400).json({ success: false, error: 'JSON must be an array of entries' });
      return;
    }

    const { syncProductsFromSiamJsonOnServer } = await import('../services/siam-json-sync-service.js');
    const report = await syncProductsFromSiamJsonOnServer({
      entries: parsed,
      apply,
      includeMetaInDescription: includeMeta,
      limit: 20000,
    });
    res.json({ success: true, source: jsonUrl ? { type: 'url', url: jsonUrl } : { type: 'text' }, ...report });
  } catch (error) {
    console.error('sync-siam-json error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/api/sync-siam-json-bundled', requireAdmin, express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const includeMeta = req.body?.includeMeta !== false; // default true
    const apply = !!req.body?.apply;
    const { SIAM_JSON_ENTRIES } = await import('../services/siam-json-dataset.js');
    const { syncProductsFromSiamJsonOnServer } = await import('../services/siam-json-sync-service.js');
    const report = await syncProductsFromSiamJsonOnServer({
      entries: SIAM_JSON_ENTRIES,
      apply,
      includeMetaInDescription: includeMeta,
      limit: 20000,
    });
    res.json({ success: true, source: { type: 'bundled' }, ...report });
  } catch (error) {
    console.error('sync-siam-json-bundled error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// Translate remaining English titles to Russian (no PDF needed)
router.post('/api/translate-titles-ru', requireAdmin, express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const limit = Number(req.body?.limit || 2000);
    const { translateRemainingTitlesToRussianOnServer } = await import('../services/siam-pdf-sync-service.js');
    const result = await translateRemainingTitlesToRussianOnServer({ limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('translate-titles-ru error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// Normalize product titles to a consistent Russian style (no quotes)
router.post('/api/normalize-titles-ru', requireAdmin, express.json({ limit: '256kb' }), async (req, res) => {
  try {
    const apply = !!req.body?.apply;
    const limit = Number(req.body?.limit || 3000);
    const { normalizeProductTitlesOnServer } = await import('../services/siam-title-normalizer.js');
    const result = await normalizeProductTitlesOnServer({ apply, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('normalize-titles-ru error:', error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : String(error) });
  }
});

// Logout
// Страница с инструкциями
router.get('/instructions', requireAdmin, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Инструкции - Vital Admin</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
        .back-btn { background: rgba(255,255,255,0.2); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); transition: all 0.3s ease; display: inline-block; margin-top: 15px; }
        .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #667eea; font-size: 24px; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 10px; }
        .section h3 { color: #495057; font-size: 18px; margin-bottom: 10px; }
        .section p { color: #6c757d; line-height: 1.6; margin-bottom: 10px; }
        .section ul { color: #6c757d; line-height: 1.6; }
        .section li { margin-bottom: 5px; }
        .code { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; font-family: 'Courier New', monospace; margin: 10px 0; }
        .highlight { background: #fff3cd; padding: 10px; border-radius: 6px; border-left: 4px solid #ffc107; margin: 10px 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef; }
        .card h4 { color: #667eea; margin-top: 0; }
        .btn { background: #667eea; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 5px; transition: all 0.3s ease; }
        .btn:hover { background: #5a6fd8; transform: translateY(-2px); }
        .btn-secondary { background: #6c757d; }
        .btn-secondary:hover { background: #5a6268; }

        /* Shared admin UI baseline */
        ${ADMIN_UI_CSS}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📋 Инструкции по работе с админ панелью</h1>
          <p>Полное руководство по управлению Vital</p>
          <a href="/admin" class="back-btn">← Назад к панели</a>
        </div>
        
        <div class="content">
          <div class="section">
            <h2>🚀 Быстрый старт</h2>
            <div class="grid">
              <div class="card">
                <h4>🔐 Доступ к админ панели</h4>
                <p><strong>URL:</strong> <code>/admin</code></p>
                <p>Пароль задаётся через переменную окружения <code>ADMIN_PASSWORD</code></p>
              </div>
              <div class="card">
                <h4>📱 Основные разделы</h4>
                <ul>
                  <li>👥 Пользователи</li>
                  <li>🛍️ Товары</li>
                  <li>📦 Заказы</li>
                  <li>🤝 Партнеры</li>
                  <li>📝 Контент бота</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>👥 Управление пользователями</h2>
            <div class="grid">
              <div class="card">
                <h4>📊 Список пользователей</h4>
                <p>Просмотр всех пользователей с возможностью фильтрации и сортировки</p>
                <a href="/admin/users" class="btn">Перейти к пользователям</a>
              </div>
              <div class="card">
                <h4>🔍 Детальная информация</h4>
                <p>Полная статистика по каждому пользователю: заказы, партнеры, баланс</p>
                <a href="/admin/users-detailed" class="btn">Детальная информация</a>
              </div>
            </div>
            <h3>Основные функции:</h3>
            <ul>
              <li><strong>Редактирование данных:</strong> Телефон, адрес, баланс</li>
              <li><strong>Партнерская программа:</strong> Активация и настройка</li>
              <li><strong>История заказов:</strong> Просмотр всех заказов пользователя</li>
              <li><strong>Финансовые операции:</strong> Управление балансом</li>
            </ul>
          </div>

          <div class="section">
            <h2>🛍️ Управление товарами</h2>
            <div class="grid">
              <div class="card">
                <h4>📦 Каталог товаров</h4>
                <p>Управление всеми товарами в системе</p>
                <a href="/admin/products" class="btn">Перейти к товарам</a>
              </div>
              <div class="card">
                <h4>📂 Категории</h4>
                <p>Организация товаров по категориям</p>
                <a href="/admin/categories" class="btn">Управление категориями</a>
              </div>
            </div>
            <h3>Возможности:</h3>
            <ul>
              <li><strong>Добавление товаров:</strong> Название, цена, описание, изображение</li>
              <li><strong>Настройки:</strong> Активность, доступность в регионах</li>
              <li><strong>Сток:</strong> Управление количеством товаров</li>
              <li><strong>Цены:</strong> Гибкая система ценообразования</li>
            </ul>
          </div>

          <div class="section">
            <h2>📦 Управление заказами</h2>
            <div class="grid">
              <div class="card">
                <h4>📋 Список заказов</h4>
                <p>Все заказы с фильтрацией по статусу</p>
                <a href="/admin/orders" class="btn">Перейти к заказам</a>
              </div>
              <div class="card">
                <h4>📊 Статусы заказов</h4>
                <p>NEW → PROCESSING → COMPLETED → CANCELLED</p>
              </div>
            </div>
            <h3>Управление заказами:</h3>
            <ul>
              <li><strong>Изменение статусов:</strong> NEW → PROCESSING → COMPLETED</li>
              <li><strong>Контактная информация:</strong> Телефон и адрес доставки</li>
              <li><strong>Уведомления:</strong> Отправка сообщений пользователям</li>
              <li><strong>Финансы:</strong> Отслеживание платежей</li>
            </ul>
          </div>

          <div class="section">
            <h2>🤝 Партнерская программа</h2>
            <div class="grid">
              <div class="card">
                <h4>👥 Управление партнерами</h4>
                <p>Активация и настройка партнеров</p>
                <a href="/admin/partners" class="btn">Перейти к партнерам</a>
              </div>
              <div class="card">
                <h4>🔗 Реферальные ссылки</h4>
                <p>Генерация и управление реферальными ссылками</p>
              </div>
            </div>
            <h3>Партнерская система:</h3>
            <ul>
              <li><strong>Активация партнеров:</strong> Создание партнерских профилей</li>
              <li><strong>Реферальные ссылки:</strong> Генерация уникальных ссылок</li>
              <li><strong>Бонусы:</strong> Расчет и выплата комиссий</li>
              <li><strong>Иерархия:</strong> Многоуровневая система (3 уровня)</li>
            </ul>
          </div>

          <div class="section">
            <h2>📝 Контент и каталог</h2>
            <div class="grid">
              <div class="card">
                <h4>📦 Управление контентом</h4>
                <p>Категории, товары, чаты поддержки, отзывы и заказы</p>
                <a href="/admin?tab=content" class="btn">Открыть вкладку «Контент»</a>
              </div>
              <div class="card">
                <h4>🌍 Многоязычность</h4>
                <p>Поддержка русского и английского языков</p>
              </div>
            </div>
            <h3>Управление контентом:</h3>
            <ul>
              <li><strong>Сообщения бота:</strong> Приветствие, помощь, ошибки</li>
              <li><strong>Кнопки и описания:</strong> Настройка интерфейса</li>
              <li><strong>Категории контента:</strong> Сообщения, описания, кнопки</li>
              <li><strong>Активация:</strong> Включение/отключение контента</li>
            </ul>
          </div>

          <div class="section">
            <h2>📊 Статистика и аналитика</h2>
            <div class="highlight">
              <h3>📈 Основные метрики</h3>
              <ul>
                <li><strong>Общее количество пользователей</strong></li>
                <li><strong>Активные партнеры</strong></li>
                <li><strong>Общая сумма заказов</strong></li>
                <li><strong>Баланс партнеров</strong></li>
              </ul>
            </div>
            <h3>Детальная аналитика:</h3>
            <ul>
              <li><strong>Заказы по статусам:</strong> NEW, PROCESSING, COMPLETED, CANCELLED</li>
              <li><strong>Партнерская статистика:</strong> Уровни, рефералы, бонусы</li>
              <li><strong>Финансовая отчетность:</strong> Доходы, выплаты, остатки</li>
            </ul>
          </div>

          <div class="section">
            <h2>🚨 Устранение неполадок</h2>
            <div class="grid">
              <div class="card">
                <h4>❓ Частые проблемы</h4>
                <ul>
                  <li>Не загружается страница</li>
                  <li>Ошибка авторизации</li>
                  <li>Не сохраняются изменения</li>
                  <li>Медленная работа</li>
                </ul>
              </div>
              <div class="card">
                <h4>📞 Контакты поддержки</h4>
                <p><strong>Telegram:</strong> @diglukhov</p>
                <p><strong>Email:</strong> support@vital.com</p>
                <p><strong>Документация:</strong> Этот файл</p>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>🔐 Безопасность</h2>
            <div class="code">
              <strong>Доступ к админ панели:</strong><br>
              • Аутентификация: Логин и пароль<br>
              • Сессии: Автоматический выход при неактивности<br>
              • Логирование: Все действия записываются
            </div>
            <div class="code">
              <strong>Управление данными:</strong><br>
              • Резервное копирование: Автоматические бэкапы<br>
              • Валидация: Проверка всех входящих данных<br>
              • Аудит: История изменений
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

router.get('/logout', (req, res) => {
  const session = req.session as any;
  session.isAdmin = false;
  res.redirect('/admin/login');
});

// Recalculate bonuses endpoint
router.post('/recalculate-bonuses', requireAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting bonus recalculation...');

    // Get all partner profiles
    const profiles = await prisma.partnerProfile.findMany();

    for (const profile of profiles) {
      console.log(`📊 Processing profile ${profile.id}...`);

      // Calculate total bonus from transactions
      const transactions = await prisma.partnerTransaction.findMany({
        where: { profileId: profile.id }
      });

      const totalBonus = transactions.reduce((sum, tx) => {
        return sum + (tx.type === 'CREDIT' ? tx.amount : -tx.amount);
      }, 0);

      // Update profile bonus
      await prisma.partnerProfile.update({
        where: { id: profile.id },
        data: { bonus: totalBonus }
      });

      console.log(`✅ Updated profile ${profile.id}: ${totalBonus} PZ bonus`);
    }

    console.log('🎉 Bonus recalculation completed!');
    res.redirect('/admin/partners?success=bonuses_recalculated');
  } catch (error) {
    console.error('❌ Bonus recalculation error:', error);
    res.redirect('/admin/partners?error=bonus_recalculation');
  }
});
// Cleanup duplicates endpoint
router.post('/cleanup-duplicates', requireAdmin, async (req, res) => {
  try {
    console.log('🧹 Starting cleanup of duplicate data...');

    // Find all partner profiles
    const profiles = await prisma.partnerProfile.findMany({
      include: {
        referrals: true,
        transactions: true
      }
    });

    let totalReferralsDeleted = 0;
    let totalTransactionsDeleted = 0;

    for (const profile of profiles) {
      console.log(`\n📊 Processing profile ${profile.id}...`);

      // Group referrals by referredId to find duplicates
      const referralGroups = new Map();
      profile.referrals.forEach(ref => {
        if (ref.referredId) {
          if (!referralGroups.has(ref.referredId)) {
            referralGroups.set(ref.referredId, []);
          }
          referralGroups.get(ref.referredId).push(ref);
        }
      });

      // Remove duplicate referrals, keeping only the first one
      for (const [referredId, referrals] of referralGroups) {
        if (referrals.length > 1) {
          console.log(`  🔄 Found ${referrals.length} duplicates for user ${referredId}`);

          // Sort by createdAt to keep the earliest
          referrals.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());

          // Keep the first one, delete the rest
          const toDelete = referrals.slice(1);
          for (const duplicate of toDelete) {
            await prisma.partnerReferral.delete({
              where: { id: duplicate.id }
            });
            totalReferralsDeleted++;
            console.log(`    ❌ Deleted duplicate referral ${duplicate.id}`);
          }
        }
      }

      // Group transactions by description to find duplicates
      const transactionGroups = new Map();
      profile.transactions.forEach(tx => {
        const key = `${tx.description}-${tx.amount}-${tx.type}`;
        if (!transactionGroups.has(key)) {
          transactionGroups.set(key, []);
        }
        transactionGroups.get(key).push(tx);
      });

      // Remove duplicate transactions, keeping only the first one
      for (const [key, transactions] of transactionGroups) {
        if (transactions.length > 1) {
          console.log(`  🔄 Found ${transactions.length} duplicate transactions: ${key}`);

          // Sort by createdAt to keep the earliest
          transactions.sort((a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime());

          // Keep the first one, delete the rest
          const toDelete = transactions.slice(1);
          for (const duplicate of toDelete) {
            await prisma.partnerTransaction.delete({
              where: { id: duplicate.id }
            });
            totalTransactionsDeleted++;
            console.log(`    ❌ Deleted duplicate transaction ${duplicate.id}`);
          }
        }
      }

      // Recalculate bonus from remaining transactions
      const remainingTransactions = await prisma.partnerTransaction.findMany({
        where: { profileId: profile.id }
      });

      const totalBonus = remainingTransactions.reduce((sum, tx) => {
        return sum + (tx.type === 'CREDIT' ? tx.amount : -tx.amount);
      }, 0);

      // Update profile bonus
      await prisma.partnerProfile.update({
        where: { id: profile.id },
        data: { bonus: totalBonus }
      });

      console.log(`  ✅ Updated profile ${profile.id}: ${totalBonus} PZ bonus`);
    }

    console.log(`\n🎉 Cleanup completed! Deleted ${totalReferralsDeleted} duplicate referrals and ${totalTransactionsDeleted} duplicate transactions.`);
    res.redirect(`/admin/partners?success=duplicates_cleaned&referrals=${totalReferralsDeleted}&transactions=${totalTransactionsDeleted}`);
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.redirect('/admin/partners?error=cleanup_failed');
  }
});

// Test referral links endpoint
router.get('/test-referral-links', requireAdmin, async (req, res) => {
  try {
    const { buildReferralLink } = await import('../services/partner-service.js');

    // Get a sample partner profile
    const profile = await prisma.partnerProfile.findFirst({
      include: { user: true }
    });

    if (!profile) {
      return res.send('❌ No partner profiles found for testing');
    }

    const directLink = buildReferralLink(profile.referralCode, 'DIRECT').main;
    const multiLink = buildReferralLink(profile.referralCode, 'MULTI_LEVEL').main;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Referral Links</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
          .test-section { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; }
          .link { background: #e3f2fd; padding: 10px; margin: 5px 0; border-radius: 4px; word-break: break-all; }
          .btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 5px; }
        </style>
      </head>
      <body>
        <h2>🧪 Test Referral Links</h2>
        <a href="/admin/partners" class="btn">← Back to Partners</a>
        
        <div class="test-section">
          <h3>📊 Test Partner Profile</h3>
          <p><strong>Name:</strong> ${profile.user.firstName || 'Unknown'}</p>
          <p><strong>Username:</strong> @${profile.user.username || 'no-username'}</p>
          <p><strong>Program Type:</strong> ${profile.programType}</p>
          <p><strong>Referral Code:</strong> ${profile.referralCode}</p>
        </div>
        
        <div class="test-section">
          <h3>🔗 Generated Links</h3>
          
          <h4>Direct Link (15% commission):</h4>
          <div class="link">${directLink}</div>
          <p><strong>Payload:</strong> ${directLink.split('?start=')[1]}</p>
          
          <h4>Multi-level Link (15% + 5% + 5% commission):</h4>
          <div class="link">${multiLink}</div>
          <p><strong>Payload:</strong> ${multiLink.split('?start=')[1]}</p>
        </div>
        
        <div class="test-section">
          <h3>🧪 Link Parsing Test</h3>
          <p>Both links should be parsed correctly by the bot:</p>
          <ul>
            <li><strong>Direct link payload:</strong> Should start with "ref_direct_"</li>
            <li><strong>Multi link payload:</strong> Should start with "ref_multi_"</li>
            <li><strong>Both should:</strong> Award 3 PZ bonus to the inviter</li>
            <li><strong>Both should:</strong> Create a referral record with level 1</li>
          </ul>
        </div>
        
        <div class="test-section">
          <h3>📱 Test Instructions</h3>
          <ol>
            <li>Copy one of the links above</li>
            <li>Open it in Telegram</li>
            <li>Start the bot</li>
            <li>Check that you receive a welcome message</li>
            <li>Check that the inviter gets 3 PZ bonus</li>
            <li>Check that a referral record is created</li>
          </ol>
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Test referral links error:', error);
    res.send('❌ Error testing referral links: ' + (error instanceof Error ? error.message : String(error)));
  }
});

// Force recalculate all partner balances
router.post('/recalculate-all-balances', requireAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting full balance recalculation...');

    // Get all partner profiles
    const profiles = await prisma.partnerProfile.findMany();

    for (const profile of profiles) {
      console.log(`📊 Processing profile ${profile.id}...`);

      // Use the centralized bonus recalculation function
      const totalBonus = await recalculatePartnerBonuses(profile.id);

      console.log(`✅ Updated profile ${profile.id}: ${totalBonus} PZ bonus`);
    }

    console.log('🎉 Full balance recalculation completed!');
    res.redirect('/admin/partners?success=all_balances_recalculated');
  } catch (error) {
    console.error('❌ Full balance recalculation error:', error);
    res.redirect('/admin/partners?error=balance_recalculation_failed');
  }
});
// Debug partners page
router.get('/debug-partners', requireAdmin, async (req, res) => {
  try {
    const partners = await prisma.partnerProfile.findMany({
      include: {
        user: true,
        referrals: true,
        transactions: true
      },
      orderBy: { createdAt: 'desc' }
    });

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>🔍 Отладка партнёров</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .partner-card { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 8px; background: #f9f9f9; }
          .partner-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
          .partner-name { font-weight: bold; font-size: 16px; }
          .partner-id { color: #666; font-size: 12px; }
          .stats { display: flex; gap: 20px; margin: 10px 0; }
          .stat { background: #e3f2fd; padding: 8px 12px; border-radius: 4px; }
          .referrals { margin-top: 10px; }
          .referral { background: #f0f0f0; padding: 8px; margin: 5px 0; border-radius: 4px; font-size: 14px; }
          .transactions { margin-top: 10px; }
          .transaction { background: #fff3cd; padding: 6px; margin: 3px 0; border-radius: 4px; font-size: 13px; }
          .btn { background: #007bff; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 5px; }
          .btn:hover { background: #0056b3; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Отладка партнёров</h1>
          <a href="/admin/partners" class="btn">← Назад к партнёрам</a>
          <p>Всего партнёров: ${partners.length}</p>
    `;

    for (const partner of partners) {
      const totalBalance = Number(partner.balance) + Number(partner.bonus);
      const referralsCount = partner.referrals.length;
      const directReferrals = partner.referrals.filter(r => r.level === 1).length;
      const multiReferrals = partner.referrals.filter(r => r.level === 2).length;

      html += `
        <div class="partner-card">
          <div class="partner-header">
            <div>
              <div class="partner-name">${partner.user.firstName} ${partner.user.lastName || ''}</div>
              <div class="partner-id">ID: ${partner.id} | User: ${partner.userId}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 18px; font-weight: bold; color: #28a745;">${totalBalance.toFixed(2)} PZ</div>
              <div style="font-size: 12px; color: #666;">Баланс = Всего бонусов</div>
            </div>
          </div>
          
          <div class="stats">
            <div class="stat">💰 Баланс: ${Number(partner.balance).toFixed(2)} PZ</div>
            <div class="stat">🎁 Всего бонусов: ${Number(partner.bonus).toFixed(2)} PZ</div>
            <div class="stat">👥 Всего рефералов: ${referralsCount}</div>
            <div class="stat">📊 Прямых: ${directReferrals}</div>
            <div class="stat">🌐 Мульти: ${multiReferrals}</div>
          </div>
          
          ${referralsCount > 0 ? `
            <div class="referrals">
              <h4>👥 Рефералы:</h4>
              ${partner.referrals.map((ref: any) => `
                <div class="referral">
                  Реферал ID: ${ref.referredId || 'N/A'} 
                  (Уровень ${ref.level}, Контакт: ${ref.contact || 'N/A'})
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${partner.transactions.length > 0 ? `
            <div class="transactions">
              <h4>💰 Последние транзакции:</h4>
              ${partner.transactions.slice(0, 5).map((tx: any) => `
                <div class="transaction">
                  ${tx.type === 'CREDIT' ? '+' : '-'}${Number(tx.amount).toFixed(2)} PZ — ${tx.description}
                  <span style="color: #666; font-size: 11px;">(${new Date(tx.createdAt).toLocaleString()})</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }

    html += `
        </div>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Debug partners error:', error);
    res.send('❌ Ошибка отладки партнёров: ' + (error instanceof Error ? error.message : String(error)));
  }
});

// Cleanup referral duplicates
router.post('/cleanup-referral-duplicates', requireAdmin, async (req, res) => {
  try {
    console.log('🧹 Starting referral duplicates cleanup...');

    // Find all referrals
    const allReferrals = await prisma.partnerReferral.findMany({
      where: { referredId: { not: null } },
      orderBy: { createdAt: 'asc' }
    });

    // Group by profileId + referredId combination
    const grouped = new Map<string, any[]>();
    for (const ref of allReferrals) {
      const key = `${ref.profileId}-${ref.referredId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(ref);
    }

    let deletedCount = 0;

    // Process duplicates
    for (const [key, referrals] of grouped) {
      if (referrals.length > 1) {
        // Keep the first one, delete the rest
        const toDelete = referrals.slice(1);
        for (const ref of toDelete) {
          await prisma.partnerReferral.delete({
            where: { id: ref.id }
          });
          deletedCount++;
        }
      }
    }

    console.log(`✅ Cleaned up ${deletedCount} duplicate referrals`);

    // Recalculate all bonuses after cleanup
    console.log('🔄 Recalculating all bonuses after referral cleanup...');
    const profiles = await prisma.partnerProfile.findMany();
    for (const profile of profiles) {
      await recalculatePartnerBonuses(profile.id);
    }

    res.redirect('/admin/partners?success=referral_duplicates_cleaned&count=' + deletedCount);
  } catch (error) {
    console.error('❌ Referral duplicates cleanup error:', error);
    res.redirect('/admin/partners?error=referral_cleanup_failed');
  }
});

// Force recalculate all bonuses
router.post('/force-recalculate-bonuses', requireAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting forced bonus recalculation...');

    // Get all partner profiles
    const profiles = await prisma.partnerProfile.findMany();

    for (const profile of profiles) {
      console.log(`📊 Recalculating bonuses for profile ${profile.id}...`);

      // Use the centralized bonus recalculation function
      const totalBonus = await recalculatePartnerBonuses(profile.id);

      console.log(`✅ Updated profile ${profile.id}: ${totalBonus} PZ bonus`);
    }

    console.log('🎉 Forced bonus recalculation completed!');
    res.redirect('/admin/partners?success=bonuses_force_recalculated');
  } catch (error) {
    console.error('❌ Forced bonus recalculation error:', error);
    res.redirect('/admin/partners?error=bonus_force_recalculation_failed');
  }
});

// Force recalculate specific partner bonuses
router.post('/recalculate-partner-bonuses/:profileId', requireAdmin, async (req, res) => {
  try {
    const { profileId } = req.params;
    console.log(`🔄 Force recalculating bonuses for profile ${profileId}...`);

    const totalBonus = await recalculatePartnerBonuses(profileId);

    console.log(`✅ Force recalculated bonuses for profile ${profileId}: ${totalBonus} PZ`);
    res.redirect(`/admin/partners?success=partner_bonuses_recalculated&bonus=${totalBonus}`);
  } catch (error) {
    console.error('❌ Force recalculate partner bonuses error:', error);
    res.redirect('/admin/partners?error=partner_bonus_recalculation_failed');
  }
});

// Cleanup duplicate bonuses
router.post('/cleanup-duplicate-bonuses', requireAdmin, async (req, res) => {
  try {
    console.log('🧹 Starting duplicate bonuses cleanup...');

    // Get all partner profiles
    const profiles = await prisma.partnerProfile.findMany();
    let totalDeleted = 0;

    for (const profile of profiles) {
      console.log(`📊 Processing profile ${profile.id}...`);

      // Get all transactions for this profile
      const transactions = await prisma.partnerTransaction.findMany({
        where: {
          profileId: profile.id,
          description: { contains: 'Бонус за приглашение друга' }
        },
        orderBy: { createdAt: 'asc' }
      });

      // Group by user ID (extract from description) or by amount+description for old format
      const bonusGroups = new Map<string, any[]>();

      for (const tx of transactions) {
        // Extract user ID from description like "Бонус за приглашение друга (user_id)"
        const match = tx.description.match(/Бонус за приглашение друга \((.+?)\)/);
        if (match) {
          const userId = match[1];
          if (!bonusGroups.has(userId)) {
            bonusGroups.set(userId, []);
          }
          bonusGroups.get(userId)!.push(tx);
        } else if (tx.description === 'Бонус за приглашение друга') {
          // Old format without user ID - group by amount and description
          const key = `${tx.amount}-${tx.description}`;
          if (!bonusGroups.has(key)) {
            bonusGroups.set(key, []);
          }
          bonusGroups.get(key)!.push(tx);
        }
      }

      // Delete duplicates (keep only the first one)
      for (const [key, group] of bonusGroups) {
        if (group.length > 1) {
          console.log(`  - Found ${group.length} duplicate bonuses for ${key}, keeping first one`);
          const toDelete = group.slice(1);
          for (const tx of toDelete) {
            await prisma.partnerTransaction.delete({
              where: { id: tx.id }
            });
            totalDeleted++;
          }
        }
      }
    }

    console.log(`✅ Cleaned up ${totalDeleted} duplicate bonus transactions`);

    // Recalculate all bonuses after cleanup
    console.log('🔄 Recalculating all bonuses after cleanup...');
    for (const profile of profiles) {
      await recalculatePartnerBonuses(profile.id);
    }

    res.redirect(`/admin/partners?success=duplicate_bonuses_cleaned&count=${totalDeleted}`);
  } catch (error) {
    console.error('❌ Duplicate bonuses cleanup error:', error);
    res.redirect('/admin/partners?error=duplicate_bonuses_cleanup_failed');
  }
});

// Reset all partners - удалить все партнерские профили
router.post('/reset-all-partners', requireAdmin, async (req, res) => {
  try {
    console.log('🗑️ Starting reset all partners...');

    // Сначала посчитаем количество партнеров
    const partnerCount = await prisma.partnerProfile.count();
    console.log(`📊 Found ${partnerCount} partner profiles to delete`);

    if (partnerCount === 0) {
      return res.redirect('/admin/partners?success=all_partners_reset&count=0');
    }

    // Удаляем все PartnerTransaction (они каскадно удалятся при удалении PartnerProfile, но для ясности удаляем явно)
    const transactionCount = await prisma.partnerTransaction.count();
    console.log(`📊 Found ${transactionCount} transactions to delete`);
    await prisma.partnerTransaction.deleteMany({});
    console.log(`✅ Deleted ${transactionCount} partner transactions`);

    // Удаляем все PartnerReferral (они каскадно удалятся при удалении PartnerProfile, но для ясности удаляем явно)
    const referralCount = await prisma.partnerReferral.count();
    console.log(`📊 Found ${referralCount} referrals to delete`);
    await prisma.partnerReferral.deleteMany({});
    console.log(`✅ Deleted ${referralCount} partner referrals`);

    // Удаляем все PartnerProfile
    await prisma.partnerProfile.deleteMany({});
    console.log(`✅ Deleted ${partnerCount} partner profiles`);

    console.log(`\n🎉 Reset all partners completed! Deleted ${partnerCount} profiles, ${referralCount} referrals, ${transactionCount} transactions.`);

    res.redirect(`/admin/partners?success=all_partners_reset&count=${partnerCount}`);
  } catch (error: any) {
    console.error('❌ Reset all partners error:', error);
    console.error('❌ Error stack:', error?.stack);
    res.redirect('/admin/partners?error=reset_partners_failed');
  }
});

// Fix Roman Arctur bonuses specifically
router.post('/fix-roman-bonuses', requireAdmin, async (req, res) => {
  try {
    console.log('🔧 Fixing Roman Arctur bonuses...');

    // Find Roman Arctur's profile
    const romanProfile = await prisma.partnerProfile.findFirst({
      where: {
        user: {
          username: 'roman_arctur'
        }
      }
    });

    if (!romanProfile) {
      console.log('❌ Roman Arctur profile not found');
      res.redirect('/admin/partners?error=roman_profile_not_found');
      return;
    }

    console.log(`📊 Found Roman Arctur profile: ${romanProfile.id}`);

    // Get all transactions for Roman
    const transactions = await prisma.partnerTransaction.findMany({
      where: { profileId: romanProfile.id }
    });

    console.log(`📊 Roman has ${transactions.length} transactions:`);
    transactions.forEach(tx => {
      console.log(`  - ${tx.type} ${tx.amount} PZ: ${tx.description} (${tx.createdAt})`);
    });

    // Check current bonus before recalculation
    const currentProfile = await prisma.partnerProfile.findUnique({
      where: { id: romanProfile.id }
    });
    console.log(`💰 Current bonus before recalculation: ${currentProfile?.bonus} PZ`);

    // Recalculate bonuses
    const totalBonus = await recalculatePartnerBonuses(romanProfile.id);

    // Check bonus after recalculation
    const updatedProfile = await prisma.partnerProfile.findUnique({
      where: { id: romanProfile.id }
    });
    console.log(`💰 Bonus after recalculation: ${updatedProfile?.bonus} PZ`);

    console.log(`✅ Roman Arctur bonuses fixed: ${totalBonus} PZ`);
    res.redirect(`/admin/partners?success=roman_bonuses_fixed&bonus=${totalBonus}`);
  } catch (error) {
    console.error('❌ Fix Roman bonuses error:', error);
    res.redirect('/admin/partners?error=roman_bonuses_fix_failed');
  }
});
// Show user partners page
router.get('/users/:userId/partners-page', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { partner: true }
    });

    if (!user) {
      return res.status(404).send('Пользователь не найден');
    }

    // Get user's partner profile
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId },
      include: {
        referrals: {
          include: {
            profile: {
              include: {
                user: { select: { firstName: true, lastName: true, username: true, telegramId: true } }
              }
            }
          },
          where: { referredId: { not: null } }
        }
      }
    });

    if (!partnerProfile) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Партнеры пользователя</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .back-btn { background: #6c757d; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; margin-bottom: 20px; }
            .empty-state { text-align: center; padding: 40px; color: #6c757d; }
          </style>
        </head>
        <body>
          <div class="container">
            <a href="/admin" class="back-btn">← Назад к админ-панели</a>
            <div class="empty-state">
              <h2>👤 ${user.firstName || 'Пользователь'} ${user.lastName || ''}</h2>
              <p>У этого пользователя нет партнерского профиля</p>
            </div>
          </div>
        </body>
        </html>
      `);
    }

    // Get actual referred users
    const referredUserIds = partnerProfile.referrals.map(ref => ref.referredId).filter((id): id is string => Boolean(id));
    const referredUsers = await prisma.user.findMany({
      where: { id: { in: referredUserIds } },
      select: { id: true, firstName: true, lastName: true, username: true, telegramId: true, createdAt: true }
    });

    // Group referrals by level
    const directPartners = partnerProfile.referrals.filter(ref => ref.level === 1);
    const multiPartners = partnerProfile.referrals.filter(ref => ref.level > 1);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Партнеры ${user.firstName || 'пользователя'}</title>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .back-btn { background: #6c757d; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block; margin-bottom: 20px; }
          .back-btn:hover { background: #5a6268; }
          .content { padding: 30px; }
          .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
          .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #667eea; }
          .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
          .stat-label { color: #6c757d; margin-top: 5px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 20px; font-weight: bold; color: #212529; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef; }
          .partners-list { display: grid; gap: 15px; }
          .partner-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #e9ecef; }
          .partner-info { display: flex; align-items: center; gap: 12px; }
          .partner-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
          .partner-details h4 { margin: 0; font-size: 16px; color: #212529; }
          .partner-details p { margin: 2px 0 0 0; font-size: 13px; color: #6c757d; }
          .partner-level { background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
          .partner-date { font-size: 12px; color: #6c757d; margin-top: 5px; }
          .empty-state { text-align: center; padding: 40px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👥 Партнеры пользователя</h1>
            <p>${user.firstName || 'Пользователь'} ${user.lastName || ''} (@${user.username || 'без username'})</p>
          </div>
          
          <div class="content">
            <a href="/admin" class="back-btn">← Назад к админ-панели</a>
            
            ${req.query && req.query.success === 'order_created' ? `
              <div class="alert alert-success">✅ Заказ успешно создан</div>
            ` : ''}
            ${req.query && req.query.error === 'order_no_items' ? `
              <div class="alert alert-error">❌ Добавьте хотя бы один товар в заказ</div>
            ` : ''}
            ${req.query && req.query.error === 'order_create_failed' ? `
              <div class="alert alert-error">❌ Не удалось создать заказ. Попробуйте позже.</div>
            ` : ''}
            
            <div class="actions-bar">
              <button class="add-order-btn" onclick="openAddOrderModal()">➕ Добавить заказ</button>
            </div>
            
            <div class="stats">
              <div class="stat-card">
                <div class="stat-number">${directPartners.length}</div>
                <div class="stat-label">Прямых партнеров</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${multiPartners.length}</div>
                <div class="stat-label">Мульти-партнеров</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${partnerProfile.referrals.length}</div>
                <div class="stat-label">Всего партнеров</div>
              </div>
            </div>
            
            ${directPartners.length > 0 ? `
              <div class="section">
                <h3 class="section-title">🎯 Прямые партнеры (уровень 1)</h3>
                <div class="partners-list">
                  ${directPartners.map(ref => {
      const referredUser = referredUsers.find(u => u.id === ref.referredId);
      return referredUser ? `
                      <div class="partner-card">
                        <div class="partner-info">
                          <div class="partner-avatar">${(referredUser.firstName || 'U')[0].toUpperCase()}</div>
                          <div class="partner-details">
                            <h4>${referredUser.firstName || 'Без имени'} ${referredUser.lastName || ''}</h4>
                            <p>@${referredUser.username || 'без username'}</p>
                            <div class="partner-level">Уровень 1</div>
                          </div>
                        </div>
                        <div class="partner-date">
                          Присоединился: ${referredUser.createdAt.toLocaleString('ru-RU')}
                        </div>
                      </div>
                    ` : '';
    }).join('')}
                </div>
              </div>
            ` : ''}
            
            ${multiPartners.length > 0 ? `
              <div class="section">
                <h3 class="section-title">🌐 Мульти-партнеры (уровень 2+)</h3>
                <div class="partners-list">
                  ${multiPartners.map(ref => {
      const referredUser = referredUsers.find(u => u.id === ref.referredId);
      return referredUser ? `
                      <div class="partner-card">
                        <div class="partner-info">
                          <div class="partner-avatar">${(referredUser.firstName || 'U')[0].toUpperCase()}</div>
                          <div class="partner-details">
                            <h4>${referredUser.firstName || 'Без имени'} ${referredUser.lastName || ''}</h4>
                            <p>@${referredUser.username || 'без username'}</p>
                            <div class="partner-level">Уровень ${ref.level}</div>
                          </div>
                        </div>
                        <div class="partner-date">
                          Присоединился: ${referredUser.createdAt.toLocaleString('ru-RU')}
                        </div>
                      </div>
                    ` : '';
    }).join('')}
                </div>
              </div>
            ` : ''}
            
            ${partnerProfile.referrals.length === 0 ? `
              <div class="empty-state">
                <h3>📭 Нет партнеров</h3>
                <p>У этого пользователя пока нет приглашенных партнеров</p>
              </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ User partners page error:', error);
    res.status(500).send('Ошибка загрузки партнеров пользователя');
  }
});

// Update user delivery address
router.post('/users/:userId/delivery-address', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { addressType, address } = req.body;

    if (!addressType || !address) {
      return res.status(400).json({ error: 'Тип адреса и адрес обязательны' });
    }

    const fullAddress = `${addressType}: ${address}`;

    await prisma.user.update({
      where: { id: userId },
      data: { deliveryAddress: fullAddress } as any
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating delivery address:', error);
    res.status(500).json({ error: 'Ошибка сохранения адреса' });
  }
});

// Update user balance
// Update partner program status and duration
router.post('/users/:userId/update-partner-program', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, months, date } = req.body;

    console.log('🔄 Update partner program request:', { userId, isActive, months, date });

    if (typeof isActive !== 'boolean') {
      return res.json({ success: false, error: 'Неверный параметр isActive' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { partner: true }
    });

    if (!user) {
      return res.json({ success: false, error: 'Пользователь не найден' });
    }

    let expiresAt: Date | null | undefined = user.partner?.expiresAt;

    // Calculate new expiration date if activating
    if (isActive) {
      if (months) {
        const d = new Date();
        d.setDate(d.getDate() + (parseInt(months) * 30));
        expiresAt = d;
      } else if (date) {
        expiresAt = new Date(date);
        // Set to end of day
        expiresAt.setHours(23, 59, 59, 999);
      } else if (!user.partner?.isActive) {
        // Default to 30 days if activating for the first time without params
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiresAt = d;
      }
    }

    // Create or Update
    if (!user.partner) {
      // Generate referral code
      let referralCode = '';
      let isUnique = false;
      while (!isUnique) {
        referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const existing = await prisma.partnerProfile.findUnique({ where: { referralCode } });
        if (!existing) isUnique = true;
      }

      await prisma.partnerProfile.create({
        data: {
          userId: user.id,
          isActive,
          expiresAt: expiresAt || null,
          activatedAt: isActive ? new Date() : null,
          activationType: 'ADMIN',
          referralCode,
          programType: 'DIRECT'
        }
      });
    } else {
      await prisma.partnerProfile.update({
        where: { userId: user.id },
        data: {
          isActive,
          expiresAt: expiresAt || null,
          activatedAt: isActive && !user.partner.isActive ? new Date() : user.partner.activatedAt,
          activationType: 'ADMIN'
        }
      });
    }

    console.log(`✅ Partner program updated for ${userId}: active=${isActive}, expires=${expiresAt}`);
    res.json({ success: true, expiresAt });

  } catch (error) {
    console.error('Error updating partner program:', error);
    res.status(500).json({ error: 'Ошибка обновления статуса' });
  }
});



router.post('/users/:userId/update-balance', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { operation, amount, comment } = req.body;

    console.log('💰 Balance update request:', { userId, operation, amount, comment });

    if (!operation || !amount || amount <= 0) {
      return res.json({ success: false, error: 'Неверные параметры' });
    }

    if (!comment || comment.trim().length === 0) {
      return res.json({ success: false, error: 'Комментарий обязателен' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { partner: true }
    });

    if (!user) {
      return res.json({ success: false, error: 'Пользователь не найден' });
    }

    const currentBalance = user.balance;
    let newBalance;

    if (operation === 'add') {
      newBalance = currentBalance + amount;
    } else if (operation === 'subtract') {
      if (currentBalance < amount) {
        return res.json({ success: false, error: 'Недостаточно средств на балансе' });
      }
      newBalance = currentBalance - amount;
    } else {
      return res.json({ success: false, error: 'Неверная операция' });
    }

    // Update user balance
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance }
    });

    console.log(`✅ User balance updated: ${userId} from ${currentBalance} to ${updatedUser.balance}`);

    // User.balance is the single source of truth — PartnerProfile.balance no longer used

    // Log the transaction
    await prisma.userHistory.create({
      data: {
        userId,
        action: 'balance_updated',
        payload: {
          operation,
          amount,
          oldBalance: currentBalance,
          newBalance,
          comment: comment || 'Ручное изменение баланса администратором'
        }
      }
    });

    console.log(`✅ Balance updated: ${userId} ${operation} ${amount} PZ (${currentBalance} -> ${newBalance})`);

    res.json({
      success: true,
      newBalance,
      message: `Баланс успешно ${operation === 'add' ? 'пополнен' : 'списан'} на ${amount} PZ`
    });

  } catch (error) {
    console.error('❌ Balance update error:', error);
    res.json({ success: false, error: 'Ошибка обновления баланса' });
  }
});
// Helper functions for user orders page
function createUserOrderCard(order: any, user: any) {
  // Handle both string and object types for itemsJson
  const items = typeof order.itemsJson === 'string'
    ? JSON.parse(order.itemsJson || '[]')
    : (order.itemsJson || []);
  const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);

  return `
    <div class="order-card ${order.status.toLowerCase()}">
      <div class="order-header">
        <div class="order-info">
          <h4>Заказ #${order.id.slice(-8)}</h4>
          <p>Дата: ${new Date(order.createdAt).toLocaleString('ru-RU')}</p>
        </div>
        <div class="order-status ${order.status.toLowerCase()}">
          ${getStatusDisplayName(order.status)}
        </div>
      </div>
      
      <div class="order-details">
        <div class="order-items">
          ${items.map((item: any) => `
            <div class="order-item">
              <span>${item.title} x${item.quantity}</span>
              <span>${(item.price * item.quantity).toFixed(2)} PZ</span>
            </div>
          `).join('')}
        </div>
        
        ${user.deliveryAddress ? `
          <div class="order-info-section">
            <div class="info-label">📍 Адрес доставки:</div>
            <div class="info-value">${user.deliveryAddress}</div>
          </div>
        ` : ''}
        
        ${order.message ? `
          <div class="order-info-section">
            <div class="info-label">💬 Комментарии:</div>
            <div class="info-value">${order.message}</div>
          </div>
        ` : ''}
        
        <div class="order-total">
          Итого: ${totalAmount.toFixed(2)} PZ
        </div>
      </div>
      
      <div class="order-actions">
        <div class="status-buttons">
          <button class="status-btn ${order.status === 'NEW' ? 'active' : ''}" 
                  onclick="updateOrderStatus('${order.id}', 'NEW')" 
                  ${order.status === 'NEW' ? 'disabled' : ''}>
            🔴 Новый
          </button>
          <button class="status-btn ${order.status === 'PROCESSING' ? 'active' : ''}" 
                  onclick="updateOrderStatus('${order.id}', 'PROCESSING')" 
                  ${order.status === 'PROCESSING' ? 'disabled' : ''}>
            🟡 В обработке
          </button>
          <button class="status-btn ${order.status === 'COMPLETED' ? 'active' : ''}" 
                  onclick="updateOrderStatus('${order.id}', 'COMPLETED')" 
                  ${order.status === 'COMPLETED' ? 'disabled' : ''}>
            🟢 Готово
          </button>
          <button class="status-btn ${order.status === 'CANCELLED' ? 'active' : ''}" 
                  onclick="updateOrderStatus('${order.id}', 'CANCELLED')" 
                  ${order.status === 'CANCELLED' ? 'disabled' : ''}>
            ⚫ Отмена
          </button>
        </div>
        
        <div class="order-edit-actions">
          ${order.status !== 'COMPLETED' && order.status !== 'CANCELLED' ?
      '<button class="edit-btn" onclick="openEditOrderModal(\'' + order.id + '\')">✏️ Редактировать</button>'
      : ''}
          ${order.status !== 'COMPLETED' && order.status !== 'CANCELLED' ?
      '<button class="pay-btn" onclick="payFromBalance(\'' + order.id + '\', ' + totalAmount + ')">💳 Оплатить с баланса</button>'
      : ''}
        </div>
      </div>
    </div>
  `;
}

function getStatusDisplayName(status: string) {
  const names = {
    'NEW': '🔴 Новый',
    'PROCESSING': '🟡 В обработке',
    'COMPLETED': '🟢 Готово',
    'CANCELLED': '⚫ Отмена'
  };
  return names[status as keyof typeof names] || status;
}
// Show user orders page
// Test route for debugging
router.get('/debug-user/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 DEBUG: Testing user ID: ${userId}`);

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    console.log(`🔍 DEBUG: User found:`, user ? 'YES' : 'NO');

    res.json({
      success: true,
      userId,
      userExists: !!user,
      userData: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      } : null
    });
  } catch (error) {
    console.error('🔍 DEBUG Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Detailed test route for debugging card issues
router.get('/debug-user-full/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 DEBUG FULL: Testing user ID: ${userId}`);

    // Test basic user query
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    console.log(`🔍 DEBUG FULL: Basic user query - success`);

    // Test user with orders
    const userWithOrders = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' }
        }
      }
    }) as any;
    console.log(`🔍 DEBUG FULL: User with orders query - success`);
    console.log(`🔍 DEBUG FULL: Orders count:`, userWithOrders?.orders?.length || 0);

    // Test partner profile
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId }
    });
    console.log(`🔍 DEBUG FULL: Partner profile query - success`);

    // Test user history
    const userHistory = await prisma.userHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    console.log(`🔍 DEBUG FULL: User history query - success`);
    console.log(`🔍 DEBUG FULL: History count:`, userHistory?.length || 0);

    // Test calculations
    const totalOrders = userWithOrders?.orders?.length || 0;
    const completedOrders = userWithOrders?.orders?.filter((o: any) => o.status === 'COMPLETED').length || 0;
    const totalSpent = userWithOrders?.orders
      ?.filter((o: any) => o.status === 'COMPLETED')
      .reduce((sum: number, order: any) => sum + (order.totalAmount || 0), 0) || 0;

    console.log(`🔍 DEBUG FULL: Calculations - success`);
    console.log(`🔍 DEBUG FULL: Total orders: ${totalOrders}, Completed: ${completedOrders}, Spent: ${totalSpent}`);

    res.json({
      success: true,
      userId,
      userExists: !!user,
      userData: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      } : null,
      ordersCount: totalOrders,
      completedOrdersCount: completedOrders,
      totalSpent: totalSpent,
      partnerProfileExists: !!partnerProfile,
      historyCount: userHistory?.length || 0,
      allQueriesSuccessful: true
    });
  } catch (error) {
    console.error('🔍 DEBUG FULL Error:', error);
    console.error('🔍 DEBUG FULL Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.params.userId
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      userId: req.params.userId
    });
  }
});

// Get user card with transaction history (simplified version)
router.get('/users/:userId/card', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔍 Loading user card for ID: ${userId}`);

    // Get user with basic data only (no include to avoid complex queries)
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    console.log(`👤 User found:`, user ? `${user.firstName} ${user.lastName}` : 'null');

    if (!user) {
      return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Пользователь не найден</title>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
              .back-btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <a href="/admin" class="back-btn">← Назад к админ-панели</a>
              <h2>❌ Пользователь не найден</h2>
              <p>Пользователь с ID ${userId} не существует</p>
            </div>
          </body>
          </html>
        `);
    }

    // User.balance is the single source of truth — no sync needed
    const partnerProfile = await prisma.partnerProfile.findUnique({ where: { userId } });

    // Get data separately to avoid complex queries
    console.log(`📦 Getting orders for user: ${userId}`);
    const orders = await prisma.orderRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    console.log(`📦 Orders count:`, orders?.length || 0);

    console.log(`🤝 Partner profile found:`, partnerProfile ? 'yes' : 'no');

    // Проверяем статус активации
    const isActive = partnerProfile ? await checkPartnerActivation(userId) : false;
    console.log(`🤝 Partner profile is active:`, isActive);

    console.log(`📊 Getting user history for user: ${userId}`);
    const userHistory = await prisma.userHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20 // Limit to 20 records to avoid issues
    });
    console.log(`📊 User history count:`, userHistory?.length || 0);

    if (!user) {
      return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Пользователь не найден</title>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
              .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
              .back-btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <a href="/admin" class="back-btn">← Назад к админ-панели</a>
              <h2>❌ Пользователь не найден</h2>
              <p>Пользователь с ID ${userId} не существует</p>
            </div>
          </body>
          </html>
        `);
    }

    // Calculate statistics with safe handling
    const totalOrders = orders?.length || 0;
    const completedOrders = orders?.filter((o: any) => o && o.status === 'COMPLETED').length || 0;
    const totalSpent = orders
      ?.filter((o: any) => o && o.status === 'COMPLETED')
      .reduce((sum: number, order: any) => {
        const amount = order?.totalAmount || 0;
        return sum + (typeof amount === 'number' ? amount : 0);
      }, 0) || 0;

    const totalPartners = 0; // Simplified for now
    const activePartners = 0; // Simplified for now

    // Group transactions by date with safe handling
    const transactionsByDate: { [key: string]: any[] } = {};
    userHistory?.forEach((tx: any) => {
      if (tx && tx.createdAt) {
        try {
          const date = tx.createdAt.toISOString().split('T')[0];
          if (!transactionsByDate[date]) {
            transactionsByDate[date] = [];
          }
          transactionsByDate[date].push(tx);
        } catch (error) {
          console.error('Error processing transaction date:', error, tx);
        }
      }
    });

    // Серверные функции для преобразования названий операций
    function getBalanceActionNameServer(action: string): string {
      const actionNames: { [key: string]: string } = {
        'balance_updated': '💰 Изменение баланса',
        'REFERRAL_BONUS': '🎯 Реферальный бонус',
        'ORDER_PAYMENT': '💳 Оплата заказа',
        'BALANCE_ADD': '➕ Пополнение баланса',
        'BALANCE_SUBTRACT': '➖ Списание с баланса'
      };
      return actionNames[action] || action;
    }

    function getExpirationStatusColorServer(expiresAt: Date): string {
      const now = new Date();
      const expiration = new Date(expiresAt);
      const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        return '#dc3545'; // Красный - истекла
      } else if (daysLeft <= 3) {
        return '#ffc107'; // Желтый - скоро истекает
      } else if (daysLeft <= 7) {
        return '#fd7e14'; // Оранжевый - неделя
      } else {
        return '#28a745'; // Зеленый - много времени
      }
    }

    function getExpirationStatusTextServer(expiresAt: Date): string {
      const now = new Date();
      const expiration = new Date(expiresAt);
      const daysLeft = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        return '❌ Активация истекла';
      } else if (daysLeft === 0) {
        return '⚠️ Истекает сегодня';
      } else if (daysLeft === 1) {
        return '⚠️ Истекает завтра';
      } else if (daysLeft <= 3) {
        return `⚠️ Истекает через ${daysLeft} дня`;
      } else if (daysLeft <= 7) {
        return `🟡 Истекает через ${daysLeft} дней`;
      } else {
        return `✅ Действует еще ${daysLeft} дней`;
      }
    }
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Карточка клиента - ${user.firstName || 'Без имени'}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .back-btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-bottom: 20px; }
            .header { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .user-avatar { width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 32px; margin-bottom: 15px; }
            .user-info h1 { margin: 0 0 10px 0; color: #212529; }
            .user-meta { color: #6c757d; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
            .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 5px; }
            .stat-label { color: #6c757d; font-size: 14px; }
            .section { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
            .section h2 { margin: 0 0 20px 0; color: #212529; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
            .transaction-item { padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            .transaction-item:last-child { border-bottom: none; }
            .transaction-amount { font-weight: bold; }
            .transaction-amount.positive { color: #28a745; }
            .transaction-amount.negative { color: #dc3545; }
            .transaction-details { flex: 1; margin-left: 15px; }
            .transaction-date { color: #6c757d; font-size: 12px; }
            .referral-activation { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-top: 20px; }
            .activation-form { display: flex; gap: 10px; align-items: end; }
            .activation-form input, .activation-form select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 5px; }
            .activation-btn { padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; }
            .activation-btn:hover { background: #218838; }
            .partners-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
            .partner-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
            .partner-name { font-weight: bold; margin-bottom: 5px; }
            .partner-balance { color: #28a745; font-size: 14px; }
            .tabs { display: flex; border-bottom: 2px solid #eee; margin-bottom: 20px; }
            .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; }
            .tab.active { border-bottom-color: #007bff; color: #007bff; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            .alert { padding: 15px 20px; margin: 20px 0; border-radius: 8px; font-weight: 500; border: 1px solid; }
            .alert-success { background: #d4edda; color: #155724; border-color: #c3e6cb; }
            .alert-error { background: #f8d7da; color: #721c24; border-color: #f5c6cb; }
            .balance-item { cursor: pointer; transition: background-color 0.2s; }
            .balance-item:hover { background-color: #f8f9fa; }
            .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); }
            .modal-content { background-color: white; margin: 10% auto; padding: 30px; border-radius: 10px; width: 80%; max-width: 500px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
            .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
            .modal-title { margin: 0; color: #212529; font-size: 24px; }
            .close { color: #aaa; font-size: 28px; font-weight: bold; cursor: pointer; }
            .close:hover { color: #000; }
            .modal-body { line-height: 1.6; }
            .balance-detail { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
            .balance-detail strong { color: #007bff; }
            .amount-large { font-size: 24px; font-weight: bold; margin: 10px 0; }
            .amount-positive { color: #28a745; }
            .amount-negative { color: #dc3545; }
          </style>
        </head>
        <body>
          <div class="container">
            <a href="/admin" class="back-btn">← Назад к админ-панели</a>
            
            ${req.query.success === 'referral_activated' ? '<div class="alert alert-success">🎉 Реферальная программа успешно активирована! Пользователь может теперь приглашать партнёров и получать бонусы.</div>' : ''}
            
            <div class="header">
              <div style="display: flex; align-items: center; gap: 20px;">
                <div class="user-avatar">${(user.firstName || 'U')[0].toUpperCase()}</div>
                <div>
                  <h1>${user.firstName || 'Без имени'} ${user.lastName || ''}</h1>
                  <div class="user-meta">
                    <p><strong>@${user.username || 'без username'}</strong></p>
                    <p>ID: ${user.id}</p>
                    <p>Регистрация: ${user.createdAt.toLocaleString('ru-RU')}</p>
                    <p>Баланс: <strong>${user.balance.toFixed(2)} PZ</strong></p>
                    <p>Пригласитель: Не указан</p>
                  </div>
                </div>
              </div>
              
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">${totalOrders}</div>
                  <div class="stat-label">Всего заказов</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${completedOrders}</div>
                  <div class="stat-label">Выполненных</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${totalSpent.toFixed(2)} PZ</div>
                  <div class="stat-label">Потрачено</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${totalPartners}</div>
                  <div class="stat-label">Партнеров</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${activePartners}</div>
                  <div class="stat-label">Активных партнеров</div>
                </div>
              </div>
            </div>

            <div class="section">
              <h2>🔄 Активация рефералки</h2>
              <div class="referral-activation">
                <p><strong>Активировать реферальную программу для пользователя на срок:</strong></p>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                  <p style="margin: 0; color: #2d5a2d; font-weight: bold;">🎯 Двойная система бонусов:</p>
                  <ul style="margin: 10px 0; color: #2d5a2d;">
                    <li><strong>Прямой реферал:</strong> 15% <strong>либо</strong> 25% (Супер партнёр)</li>
                    <li><strong>2-й уровень:</strong> <strong>5%</strong></li>
                    <li><strong>3-й уровень:</strong> <strong>5%</strong></li>
                  </ul>
                </div>
                <form class="activation-form" method="post" action="/admin/users/${user.id}/activate-referral">
                  <div>
                    <label>Период:</label><br>
                    <select name="months" required>
                      <option value="1">1 месяц</option>
                      <option value="3">3 месяца</option>
                      <option value="6">6 месяцев</option>
                      <option value="12">12 месяцев</option>
                    </select>
                  </div>
                  <div>
                    <label>Тип активации:</label><br>
                    <select name="programType" required>
                      <option value="DUAL">Партнёрская система (15% прямая + 10% супер-партнёр 2-й уровень)</option>
                    </select>
                  </div>
                  <button type="submit" class="activation-btn">Активировать</button>
                </form>
              </div>
            </div>

            <div class="section">
              <div class="tabs">
                <div class="tab active" onclick="showTab('balance')">💰 История баланса</div>
                <div class="tab" onclick="showTab('transactions')">📊 История транзакций</div>
                <div class="tab" onclick="showTab('partners')">👥 Партнеры</div>
                <div class="tab" onclick="showTab('orders')">📦 Заказы</div>
              </div>

              <div id="balance" class="tab-content active">
                <h2>💰 История изменений баланса</h2>
                <p style="color: #6c757d; margin-bottom: 20px;">Кликните на изменение баланса для просмотра деталей</p>
                ${Object.keys(transactionsByDate).length === 0 ?
        '<p style="text-align: center; color: #6c757d; padding: 40px;">Нет изменений баланса</p>' :
        Object.keys(transactionsByDate).map(date => `
                    <h3 style="color: #6c757d; margin: 20px 0 10px 0; font-size: 16px;">${new Date(date).toLocaleDateString('ru-RU')}</h3>
                    ${transactionsByDate[date]
            .filter(tx => {
              // Показываем только финансовые операции
              const financialActions = ['balance_updated', 'REFERRAL_BONUS', 'ORDER_PAYMENT', 'BALANCE_ADD', 'BALANCE_SUBTRACT'];
              return financialActions.includes(tx.action) && tx.amount !== 0;
            })
            .map(tx => `
                      <div class="transaction-item balance-item" onclick="showBalanceDetails('${tx.id}', '${tx.action}', ${tx.amount || 0}, '${tx.createdAt.toLocaleString('ru-RU')}')">
                        <div class="transaction-details">
                          <div><strong>${getBalanceActionNameServer(tx.action)}</strong></div>
                          <div class="transaction-date">${tx.createdAt.toLocaleTimeString('ru-RU')}</div>
                        </div>
                        <div class="transaction-amount ${tx.amount && tx.amount > 0 ? 'positive' : 'negative'}">
                          ${tx.amount ? (tx.amount > 0 ? '+' : '') + tx.amount.toFixed(2) + ' PZ' : '0.00 PZ'}
                        </div>
                      </div>
                    `).join('')}
                  `).join('')
      }
              </div>

              <div id="transactions" class="tab-content">
                <h2>📊 История транзакций</h2>
                ${Object.keys(transactionsByDate).length === 0 ?
        '<p style="text-align: center; color: #6c757d; padding: 40px;">Нет транзакций</p>' :
        Object.keys(transactionsByDate).map(date => `
                    <h3 style="color: #6c757d; margin: 20px 0 10px 0; font-size: 16px;">${new Date(date).toLocaleDateString('ru-RU')}</h3>
                    ${transactionsByDate[date].map(tx => `
                      <div class="transaction-item">
                        <div class="transaction-details">
                          <div><strong>${tx.action}</strong></div>
                          <div class="transaction-date">${tx.createdAt.toLocaleTimeString('ru-RU')}</div>
                        </div>
                        <div class="transaction-amount">
                          ${tx.amount ? (tx.amount > 0 ? '+' : '') + tx.amount.toFixed(2) + ' PZ' : '0.00 PZ'}
                        </div>
                      </div>
                    `).join('')}
                  `).join('')
      }
              </div>

              <div id="partners" class="tab-content">
                <h2>🤝 Партнерский профиль</h2>
                <p><strong>Статус:</strong> ${isActive ? '🟢 Активен' : '🔴 Неактивен'}</p>
                ${partnerProfile ? `
                  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Код реферала:</strong> ${partnerProfile.referralCode}</p>
                    <p><strong>Тип программы:</strong> ${partnerProfile.programType}</p>
                    <p><strong>Баланс:</strong> ${user.balance || 0} PZ (${Math.round((user.balance || 0) * 100)} ₽)</p>
                    ${(partnerProfile as any).activatedAt ? `<p><strong>Активирован:</strong> ${(partnerProfile as any).activatedAt.toLocaleString('ru-RU')}</p>` : ''}
                    ${(partnerProfile as any).expiresAt ? `
                      <p><strong>Истекает:</strong> ${(partnerProfile as any).expiresAt.toLocaleString('ru-RU')}</p>
                      <div style="background: ${getExpirationStatusColorServer((partnerProfile as any).expiresAt)}; padding: 10px; border-radius: 6px; margin: 10px 0;">
                        <p style="margin: 0; color: white; font-weight: bold;">
                          ${getExpirationStatusTextServer((partnerProfile as any).expiresAt)}
                        </p>
                      </div>
                    ` : ''}
                    <p><strong>Тип активации:</strong> ${(partnerProfile as any).activationType || 'Не указан'}</p>
                  </div>
                ` : '<p>Партнерский профиль не создан</p>'}
              </div>

              <div id="orders" class="tab-content">
                <h2>📦 Заказы</h2>
                ${(orders?.length || 0) === 0 ?
        '<p style="text-align: center; color: #6c757d; padding: 40px;">Нет заказов</p>' :
        orders?.map((order: any) => `
                    <div class="transaction-item">
                      <div class="transaction-details">
                        <div><strong>Заказ #${order.id}</strong></div>
                        <div class="transaction-date">${order.createdAt.toLocaleString('ru-RU')}</div>
                        <div style="font-size: 12px; color: #6c757d;">
                          Статус: <span style="color: ${order.status === 'NEW' ? '#dc3545' : order.status === 'PROCESSING' ? '#ffc107' : order.status === 'COMPLETED' ? '#28a745' : '#6c757d'}">
                            ${order.status === 'NEW' ? 'Новый' : order.status === 'PROCESSING' ? 'В обработке' : order.status === 'COMPLETED' ? 'Выполнен' : 'Отменен'}
                          </span>
                        </div>
                      </div>
                      <div class="transaction-amount ${order.status === 'COMPLETED' ? 'positive' : ''}">
                        ${(order.totalAmount || 0).toFixed(2)} PZ
                      </div>
                    </div>
                  `).join('')
      }
              </div>
            </div>
          </div>

          <!-- Модальное окно для деталей баланса -->
          <div id="balanceModal" class="modal">
            <div class="modal-content">
              <div class="modal-header">
                <h2 id="balanceModalTitle" class="modal-title">💰 Детали изменения баланса</h2>
                <span class="close" onclick="closeBalanceModal()">&times;</span>
              </div>
              <div id="balanceModalBody" class="modal-body">
                <!-- Содержимое будет заполнено JavaScript -->
              </div>
            </div>
          </div>

          <script>
            // Функции для определения статуса истечения активации
            function getExpirationStatusColor(expiresAt) {
              const now = new Date();
              const expiration = new Date(expiresAt);
              const daysLeft = Math.ceil((expiration - now) / (1000 * 60 * 60 * 24));
              
              if (daysLeft < 0) {
                return '#dc3545'; // Красный - истекла
              } else if (daysLeft <= 3) {
                return '#ffc107'; // Желтый - скоро истекает
              } else if (daysLeft <= 7) {
                return '#fd7e14'; // Оранжевый - неделя
              } else {
                return '#28a745'; // Зеленый - много времени
              }
            }
            
            function getExpirationStatusText(expiresAt) {
              const now = new Date();
              const expiration = new Date(expiresAt);
              const daysLeft = Math.ceil((expiration - now) / (1000 * 60 * 60 * 24));
              
              if (daysLeft < 0) {
                return '❌ Активация истекла';
              } else if (daysLeft === 0) {
                return '⚠️ Истекает сегодня';
              } else if (daysLeft === 1) {
                return '⚠️ Истекает завтра';
              } else if (daysLeft <= 3) {
                return \`⚠️ Истекает через \${daysLeft} дня\`;
              } else if (daysLeft <= 7) {
                return \`🟡 Истекает через \${daysLeft} дней\`;
              } else {
                return \`✅ Действует еще \${daysLeft} дней\`;
              }
            }
            
            // Функция для преобразования технических названий операций в понятные
            function getBalanceActionName(action) {
              const actionNames = {
                'balance_updated': '💰 Изменение баланса',
                'REFERRAL_BONUS': '🎯 Реферальный бонус',
                'ORDER_PAYMENT': '💳 Оплата заказа',
                'BALANCE_ADD': '➕ Пополнение баланса',
                'BALANCE_SUBTRACT': '➖ Списание с баланса'
              };
              return actionNames[action] || action;
            }
            
            function showTab(tabName) {
              // Hide all tab contents
              document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
              });
              
              // Remove active class from all tabs
              document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
              });
              
              // Show selected tab content
              document.getElementById(tabName).classList.add('active');
              
              // Add active class to clicked tab
              event.target.classList.add('active');
            }
            
            // Функция для показа деталей изменения баланса
            function showBalanceDetails(id, action, amount, date) {
              const modal = document.getElementById('balanceModal');
              const modalTitle = document.getElementById('balanceModalTitle');
              const modalBody = document.getElementById('balanceModalBody');
              
              modalTitle.textContent = '💰 Детали изменения баланса';
              
              const amountClass = amount > 0 ? 'amount-positive' : 'amount-negative';
              const amountSign = amount > 0 ? '+' : '';
              
              modalBody.innerHTML = \`
                <div class="balance-detail">
                  <strong>Операция:</strong> \${getBalanceActionName(action)}
                </div>
                <div class="balance-detail">
                  <strong>Дата и время:</strong> \${date}
                </div>
                <div class="balance-detail">
                  <strong>Изменение баланса:</strong>
                  <div class="amount-large \${amountClass}">\${amountSign}\${amount.toFixed(2)} PZ</div>
                </div>
                <div class="balance-detail">
                  <strong>ID транзакции:</strong> \${id}
                </div>
              \`;
              
              modal.style.display = 'block';
            }
            
            // Закрытие модального окна
            function closeBalanceModal() {
              document.getElementById('balanceModal').style.display = 'none';
            }
            
            // Закрытие модального окна при клике вне его
            window.onclick = function(event) {
              const modal = document.getElementById('balanceModal');
              if (event.target === modal) {
                modal.style.display = 'none';
              }
            }
          </script>
        </body>
        </html>
      `;

    res.send(html);
  } catch (error) {
    console.error('❌ Error loading user card:', error);
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.params.userId
    });
    res.status(500).send('Ошибка загрузки карточки пользователя');
  }
});

// Activate referral program for user
router.post('/users/:userId/activate-referral', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { months, programType } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).send('Пользователь не найден');
    }

    // Check if user already has partner profile
    const existingProfile = await prisma.partnerProfile.findUnique({
      where: { userId }
    });

    if (existingProfile) {
      // Update existing profile
      await prisma.partnerProfile.update({
        where: { userId },
        data: {
          programType: 'MULTI_LEVEL' // Always use MULTI_LEVEL for dual system
        }
      });
    } else {
      // Create new partner profile
      const referralCode = `REF${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      await prisma.partnerProfile.create({
        data: {
          userId,
          programType: 'MULTI_LEVEL', // Always use MULTI_LEVEL for dual system
          referralCode,
          balance: 0,
          bonus: 0
        }
      });
    }

    // Активируем партнерский профиль через админку
    await activatePartnerProfile(userId, 'ADMIN', parseInt(months));

    console.log(`✅ Referral program activated for user ${userId} for ${months} months`);

    res.redirect(`/admin/users/${userId}/card?success=referral_activated`);
  } catch (error) {
    console.error('❌ Error activating referral program:', error);
    res.status(500).send('Ошибка активации реферальной программы');
  }
});
// Get user orders
router.get('/users/:userId/orders', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, username: true, balance: true, deliveryAddress: true }
    });

    if (!user) {
      return res.status(404).send('Пользователь не найден');
    }

    // Get user's orders
    const orders = await prisma.orderRequest.findMany({
      where: { userId },
      orderBy: [
        { status: 'asc' }, // NEW заказы сначала
        { createdAt: 'desc' }
      ]
    });

    // Group orders by status
    const ordersByStatus = {
      NEW: orders.filter(order => order.status === 'NEW'),
      PROCESSING: orders.filter(order => order.status === 'PROCESSING'),
      COMPLETED: orders.filter(order => order.status === 'COMPLETED'),
      CANCELLED: orders.filter(order => order.status === 'CANCELLED')
    };

    const escapeHtmlAttr = (value = '') => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const defaultContact = user.deliveryAddress || (user.username ? `@${user.username}` : user.firstName || '');
    const defaultMessage = 'Заказ создан администратором';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Заказы ${user.firstName || 'пользователя'}</title>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; padding: 20px; background: #f5f5f5; 
          }
          .container { 
            max-width: 1200px; margin: 0 auto; background: white; 
            border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            overflow: hidden; 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 30px; text-align: center; 
          }
          
          .user-balance {
            margin-top: 15px; padding: 10px 20px; 
            background: rgba(255, 255, 255, 0.1); 
            border-radius: 8px; display: inline-flex;
            align-items: center; gap: 10px;
            backdrop-filter: blur(10px);
          }
          
          .balance-manage-btn {
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: bold;
            transition: all 0.2s ease;
          }
          
          .balance-manage-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: scale(1.1);
          }
          
          .balance-label {
            font-size: 16px; font-weight: 600; margin-right: 10px;
          }
          
          .balance-amount {
            font-size: 18px; font-weight: 700; 
            color: #ffd700; text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          }
          .back-btn { 
            background: #6c757d; color: white; text-decoration: none; 
            padding: 10px 20px; border-radius: 6px; 
            display: inline-block; margin-bottom: 20px; 
          }
          .back-btn:hover { background: #5a6268; }
          .actions-bar {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
          }
          .add-order-btn {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(32, 201, 151, 0.3);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .add-order-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 14px rgba(32, 201, 151, 0.4);
          }
          .add-order-btn.ghost {
            background: transparent;
            border: 2px dashed #764ba2;
            color: #764ba2;
            box-shadow: none;
          }
          .add-order-btn.ghost:hover {
            border-style: solid;
          }
          .content { padding: 30px; }
          
          .status-section { margin-bottom: 30px; }
          .status-header { 
            font-size: 20px; font-weight: bold; margin-bottom: 15px; 
            padding: 10px 15px; border-radius: 8px; display: flex; 
            align-items: center; gap: 10px; 
          }
          .status-header.new { background: #f8d7da; color: #721c24; border-left: 4px solid #dc3545; }
          .status-header.processing { background: #fff3cd; color: #856404; border-left: 4px solid #ffc107; }
          .status-header.completed { background: #d4edda; color: #155724; border-left: 4px solid #28a745; }
          .status-header.cancelled { background: #e2e3e5; color: #383d41; border-left: 4px solid #6c757d; }
          
          .orders-grid { display: grid; gap: 15px; }
          .order-card { 
            background: #f8f9fa; border: 1px solid #dee2e6; 
            border-radius: 8px; padding: 20px; transition: all 0.2s ease; 
          }
          .order-card.new { 
            border-left: 4px solid #dc3545; 
            background: linear-gradient(135deg, #fff5f5 0%, #f8f9fa 100%); 
          }
          .order-card.processing { border-left: 4px solid #ffc107; }
          .order-card.completed { border-left: 4px solid #28a745; }
          .order-card.cancelled { border-left: 4px solid #6c757d; }
          
          .order-header { 
            display: flex; justify-content: space-between; 
            align-items: flex-start; margin-bottom: 15px; 
          }
          .order-info h4 { margin: 0; font-size: 18px; color: #212529; }
          .order-info p { margin: 5px 0 0 0; color: #6c757d; font-size: 14px; }
          .order-status { 
            padding: 4px 12px; border-radius: 12px; 
            font-size: 12px; font-weight: 600; 
          }
          .order-status.new { background: #dc3545; color: white; }
          .order-status.processing { background: #ffc107; color: #212529; }
          .order-status.completed { background: #28a745; color: white; }
          .order-status.cancelled { background: #6c757d; color: white; }
          
          .order-details { margin-bottom: 15px; }
          .order-items { margin-bottom: 10px; }
          .order-item { 
            display: flex; justify-content: space-between; 
            padding: 5px 0; border-bottom: 1px solid #e9ecef; 
          }
          .order-total { 
            font-weight: bold; font-size: 16px; 
            color: #28a745; text-align: right; 
          }
          
          .order-info-section {
            margin: 15px 0; padding: 12px; 
            background: #f8f9fa; border-radius: 6px; 
            border-left: 3px solid #007bff;
          }
          
          .info-label {
            font-weight: 600; color: #495057; 
            margin-bottom: 5px; font-size: 14px;
          }
          
          .info-value {
            color: #6c757d; font-size: 13px; 
            line-height: 1.4; word-break: break-word;
          }
          
          .order-actions {
            margin-top: 20px; padding-top: 20px; 
            border-top: 1px solid #e9ecef; 
          }
          .alert {
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: 500;
          }
          .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .alert-error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          
          .status-buttons {
            display: flex; gap: 8px; margin-bottom: 15px; 
            flex-wrap: wrap; 
          }
          
          .status-btn {
            padding: 8px 16px; border: none; 
            border-radius: 8px; cursor: pointer; 
            font-size: 12px; font-weight: 600; transition: all 0.2s ease; 
            color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2);
          }
          
          .status-btn:hover:not(:disabled) {
            transform: translateY(-1px); 
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
          }
          
          .status-btn.active {
            transform: scale(1.05);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          }
          
          .status-btn:disabled {
            opacity: 0.7; cursor: not-allowed; 
            transform: none !important;
          }
          
          /* Цвета статусов */
          .status-btn[onclick*="NEW"] {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          }
          
          .status-btn[onclick*="PROCESSING"] {
            background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%);
          }
          
          .status-btn[onclick*="COMPLETED"] {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          }
          
          .status-btn[onclick*="CANCELLED"] {
            background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          }
          
          .order-edit-actions {
            display: flex; gap: 10px; margin-top: 10px; 
          }
          
          .edit-btn {
            background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
            color: white; border: none; padding: 12px 20px; 
            border-radius: 8px; cursor: pointer; font-size: 14px; 
            font-weight: 600; transition: all 0.2s ease; 
            text-shadow: 0 1px 2px rgba(0,0,0,0.2); flex: 1;
          }
          
          .edit-btn:hover {
            transform: translateY(-1px); 
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
          }
          
          .pay-btn {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
            color: white; border: none; padding: 12px 24px; 
            border-radius: 8px; font-weight: 600; cursor: pointer; 
            font-size: 14px; transition: all 0.2s ease; 
            box-shadow: 0 2px 4px rgba(40, 167, 69, 0.2); flex: 1;
          }
          
          .pay-btn:hover {
            transform: translateY(-1px); 
            box-shadow: 0 4px 8px rgba(40, 167, 69, 0.3); 
          }
          
          .empty-state { text-align: center; padding: 40px; color: #6c757d; }
          
          /* Модальное окно редактирования заказа */
          .edit-order-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
          }
          
          .edit-order-modal-content {
            background-color: white;
            margin: 5% auto;
            padding: 20px;
            border-radius: 10px;
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }
          
          .edit-order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e9ecef;
          }
          
          .edit-order-close {
            color: #aaa;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
          }
          
          .edit-order-close:hover {
            color: #000;
          }
          
          .order-items-edit {
            margin-bottom: 20px;
          }
          .new-order-summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: #f1f3f5;
            border-radius: 8px;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .order-item-edit {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            margin-bottom: 10px;
            background: #f8f9fa;
          }
          
          .order-item-info {
            flex: 1;
          }
          
          .order-item-price {
            font-weight: bold;
            color: #28a745;
            margin: 0 15px;
          }
          
          .remove-item-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          }
          
          .remove-item-btn:hover {
            background: #c82333;
          }
          
          .add-product-section {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #dee2e6;
            border-radius: 5px;
            background: #f8f9fa;
          }
          
          .add-product-form {
            display: flex;
            gap: 10px;
            align-items: end;
            flex-wrap: wrap;
          }
          .custom-product-form {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: flex-end;
            margin-top: 10px;
          }
          .custom-product-form input {
            min-width: 160px;
          }
          
          .form-group {
            flex: 1;
            min-width: 200px;
          }
          
          .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #495057;
          }
          
          .form-group input, .form-group select {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 14px;
          }
          
          .add-product-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          }
          
          .add-product-btn:hover {
            background: #218838;
          }
          
          .edit-order-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #e9ecef;
          }
          
          .save-order-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          }
          
          .save-order-btn:hover {
            background: #0056b3;
          }
          
          .cancel-edit-btn {
            background: #6c757d;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
          }
          
          .cancel-edit-btn:hover {
            background: #545b62;
          }
          
          /* Стили для модального окна управления балансом */
          .balance-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
          }
          
          .balance-modal-content {
            background-color: white;
            margin: 15% auto;
            padding: 0;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            overflow: hidden;
          }
          
          .balance-modal-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .balance-modal-header h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
          }
          
          .balance-modal-close {
            color: white;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
            line-height: 1;
          }
          
          .balance-modal-close:hover {
            opacity: 0.7;
          }
          
          .balance-modal-body {
            padding: 20px;
          }
          
          .balance-form-group {
            margin-bottom: 15px;
          }
          
          .balance-form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #495057;
          }
          
          .balance-select, .balance-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            font-size: 14px;
            transition: border-color 0.2s ease;
          }
          
          .balance-select:focus, .balance-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
          }
          
          .balance-error {
            background: #f8d7da;
            color: #721c24;
            padding: 10px;
            border-radius: 6px;
            font-size: 14px;
            margin-top: 10px;
          }
          
          .balance-modal-footer {
            padding: 20px;
            background: #f8f9fa;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
          }
          
          .balance-cancel-btn, .balance-apply-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.2s ease;
          }
          
          .balance-cancel-btn {
            background: #6c757d;
            color: white;
          }
          
          .balance-cancel-btn:hover {
            background: #545b62;
          }
          
          .balance-apply-btn {
            background: #28a745;
            color: white;
          }
          
          .balance-apply-btn:hover {
            background: #218838;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Заказы пользователя</h1>
            <p>${user.firstName || 'Пользователь'} ${user.lastName || ''} (@${user.username || 'без username'})</p>
            <div class="user-balance">
              <span class="balance-label">💰 Баланс:</span>
              <span class="balance-amount">${Number(user.balance || 0).toFixed(2)} PZ</span>
              <button class="balance-manage-btn" onclick="openBalanceModal('${userId}')" title="Управление балансом">
                <span>+</span>
              </button>
            </div>
          </div>
          
          <div class="content">
            <a href="/admin" class="back-btn">← Назад к админ-панели</a>
            
            ${ordersByStatus.NEW.length > 0 ? `
              <div class="status-section">
                <div class="status-header new">
                  🔴 Новые заказы (${ordersByStatus.NEW.length})
                </div>
                <div class="orders-grid">
                  ${ordersByStatus.NEW.map(order => createUserOrderCard(order, user)).join('')}
                </div>
              </div>
            ` : ''}
            
            ${ordersByStatus.PROCESSING.length > 0 ? `
              <div class="status-section">
                <div class="status-header processing">
                  🟡 Заказы в обработке (${ordersByStatus.PROCESSING.length})
                </div>
                <div class="orders-grid">
                  ${ordersByStatus.PROCESSING.map(order => createUserOrderCard(order, user)).join('')}
                </div>
              </div>
            ` : ''}
            
            ${ordersByStatus.COMPLETED.length > 0 ? `
              <div class="status-section">
                <div class="status-header completed">
                  🟢 Завершенные заказы (${ordersByStatus.COMPLETED.length})
                </div>
                <div class="orders-grid">
                  ${ordersByStatus.COMPLETED.map(order => createUserOrderCard(order, user)).join('')}
                </div>
              </div>
            ` : ''}
            
            ${ordersByStatus.CANCELLED.length > 0 ? `
              <div class="status-section">
                <div class="status-header cancelled">
                  ⚫ Отмененные заказы (${ordersByStatus.CANCELLED.length})
                </div>
                <div class="orders-grid">
                  ${ordersByStatus.CANCELLED.map(order => createUserOrderCard(order, user)).join('')}
                </div>
              </div>
            ` : ''}
            
            ${orders.length === 0 ? `
              <div class="empty-state">
                <h3>📭 Нет заказов</h3>
                <p>У этого пользователя пока нет заказов</p>
                <button class="add-order-btn ghost" onclick="openAddOrderModal()">➕ Добавить заказ</button>
              </div>
            ` : ''}
          </div>
        </div>
        
        <script>
          // Update order status
          async function updateOrderStatus(orderId, newStatus) {
            try {
              const response = await fetch(\`/admin/orders/\${orderId}/status\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
              });
              
              if (response.ok) {
                location.reload();
              } else {
                alert('Ошибка обновления статуса заказа');
              }
            } catch (error) {
              console.error('Error updating order status:', error);
              alert('Ошибка обновления статуса заказа');
            }
          }
          
          // Pay from balance
          async function payFromBalance(orderId, amount) {
            if (!confirm(\`Оплатить заказ на сумму \${amount.toFixed(2)} PZ с баланса пользователя?\`)) {
              return;
            }
            
            try {
              const response = await fetch(\`/admin/orders/\${orderId}/pay\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('Заказ успешно оплачен! Статус изменен на "Готово".');
                location.reload();
              } else {
                alert(\`Ошибка оплаты: \${result.error || 'Недостаточно средств на балансе'}\`);
              }
            } catch (error) {
              console.error('Error paying order:', error);
              alert('Ошибка оплаты заказа');
            }
          }
          
          // Переменные для редактирования заказа
          let currentEditOrderId = null;
          let currentEditItems = [];
          let newOrderItems = [];
          
          function openAddOrderModal() {
            newOrderItems = [];
            renderNewOrderItems();
            const form = document.getElementById('addOrderForm');
            if (form) {
              form.reset();
              const defaultMessage = form.dataset.defaultMessage;
              if (defaultMessage) {
                const messageField = document.getElementById('addOrderMessage');
                if (messageField) {
                  messageField.value = defaultMessage;
                }
              }
            }
            const modal = document.getElementById('addOrderModal');
            if (modal) {
              modal.style.display = 'block';
            }
            loadProducts('addProductSelect');
          }
          
          function closeAddOrderModal() {
            const modal = document.getElementById('addOrderModal');
            if (modal) {
              modal.style.display = 'none';
            }
            newOrderItems = [];
          }
          
          // Открыть модальное окно редактирования заказа
          async function openEditOrderModal(orderId) {
            currentEditOrderId = orderId;
            
            try {
              // Загружаем данные заказа
              const orderResponse = await fetch(\`/admin/orders/\${orderId}\`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
              });
              
              const order = await orderResponse.json();
              
              if (order.success) {
                currentEditItems = order.data.items || [];
                renderEditItems();
                
                // Загружаем список товаров
                await loadProducts();
                
                // Показываем модальное окно
                document.getElementById('editOrderModal').style.display = 'block';
              } else {
                alert('Ошибка загрузки данных заказа');
              }
            } catch (error) {
              console.error('Error loading order:', error);
              alert('Ошибка загрузки заказа');
            }
          }
          
          // Загрузить список товаров в выпадающий список
          async function loadProducts(selectId = 'productSelect') {
            try {
              const response = await fetch('/admin/api/products', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
              });
              
              const result = await response.json();
              
              if (result.success) {
                const productSelect = document.getElementById(selectId);
                if (!productSelect) return;
                productSelect.innerHTML = '<option value="">-- Выберите товар --</option>';
                
                result.data.forEach(product => {
                  const option = document.createElement('option');
                  option.value = product.id;
                  option.textContent = \`\${product.title} (\${product.category?.name || 'Без категории'}) - \${product.price.toFixed(2)} PZ\`;
                  option.dataset.title = product.title;
                  option.dataset.price = product.price;
                  productSelect.appendChild(option);
                });
              } else {
                console.error('Error loading products:', result.error);
              }
            } catch (error) {
              console.error('Error loading products:', error);
            }
          }
          
          function addProductFromSelect() {
            const select = document.getElementById('addProductSelect');
            const quantityInput = document.getElementById('addProductQuantity');
            if (!select || !quantityInput) return;
            
            const selectedOption = select.options[select.selectedIndex];
            if (!selectedOption || !selectedOption.value) {
              alert('Выберите товар');
              return;
            }
            
            const title = selectedOption.textContent || 'Товар';
            const price = parseFloat(selectedOption.dataset.price || '0');
            const productId = selectedOption.value;
            const quantity = Math.max(1, parseInt(quantityInput.value, 10) || 1);
            
            newOrderItems.push({
              productId,
              title,
              price,
              quantity
            });
            
            renderNewOrderItems();
            select.selectedIndex = 0;
            quantityInput.value = 1;
          }
          
          function addCustomProduct() {
            const nameInput = document.getElementById('customProductName');
            const priceInput = document.getElementById('customProductPrice');
            const quantityInput = document.getElementById('customProductQuantity');
            
            if (!nameInput || !priceInput || !quantityInput) return;
            
            const title = nameInput.value.trim();
            if (!title) {
              alert('Введите название товара');
              return;
            }
            
            const price = parseFloat(priceInput.value);
            if (isNaN(price)) {
              alert('Введите корректную цену');
              return;
            }
            
            const quantity = Math.max(1, parseInt(quantityInput.value, 10) || 1);
            
            newOrderItems.push({
              productId: null,
              title,
              price,
              quantity
            });
            
            renderNewOrderItems();
            nameInput.value = '';
            priceInput.value = '';
            quantityInput.value = 1;
          }
          
          function renderNewOrderItems() {
            const container = document.getElementById('newOrderItemsList');
            const totalElement = document.getElementById('newOrderTotal');
            
            if (!container) return;
            
            if (newOrderItems.length === 0) {
              container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">Товары не добавлены</p>';
              if (totalElement) {
                totalElement.textContent = '0.00';
              }
              return;
            }
            
            container.innerHTML = newOrderItems.map((item, index) => \`
              <div class="order-item-edit">
                <div class="order-item-info">
                  <strong>\${item.title}</strong>
                  <div style="font-size: 12px; color: #6c757d;">
                    \${item.quantity} шт. × \${item.price.toFixed(2)} PZ
                  </div>
                </div>
                <div class="order-item-price">
                  \${(item.price * item.quantity).toFixed(2)} PZ
                </div>
                <button type="button" class="remove-item-btn" onclick="removeNewOrderItem(\${index})">Удалить</button>
              </div>
            \`).join('');
            
            if (totalElement) {
              const total = newOrderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
              totalElement.textContent = total.toFixed(2);
            }
          }
          
          function removeNewOrderItem(index) {
            newOrderItems.splice(index, 1);
            renderNewOrderItems();
          }
          
          function submitAddOrderForm(event) {
            if (newOrderItems.length === 0) {
              event.preventDefault();
              alert('Добавьте хотя бы один товар в заказ');
              return false;
            }
            
            const hiddenInput = document.getElementById('newOrderItemsInput');
            if (hiddenInput) {
              hiddenInput.value = JSON.stringify(newOrderItems);
            }
            
            return true;
          }
          
          // Закрыть модальное окно редактирования заказа
          function closeEditOrderModal() {
            document.getElementById('editOrderModal').style.display = 'none';
            currentEditOrderId = null;
            currentEditItems = [];
          }
          
          // Отобразить товары для редактирования
          function renderEditItems() {
            const container = document.getElementById('orderItemsEdit');
            
            if (currentEditItems.length === 0) {
              container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">В заказе пока нет товаров</p>';
              return;
            }
            
            container.innerHTML = currentEditItems.map((item, index) => \`
              <div class="order-item-edit">
                <div class="order-item-info">
                  <strong>\${item.title}</strong>
                  <div style="font-size: 12px; color: #6c757d;">
                    \${item.quantity} шт. × \${item.price.toFixed(2)} PZ
                  </div>
                </div>
                <div class="order-item-price">
                  \${(item.price * item.quantity).toFixed(2)} PZ
                </div>
                <button class="remove-item-btn" onclick="removeEditItem(\${index})">
                  🗑️ Удалить
                </button>
              </div>
            \`).join('');
          }
          
          // Удалить товар из редактируемого заказа
          function removeEditItem(index) {
            if (confirm('Удалить этот товар из заказа?')) {
              currentEditItems.splice(index, 1);
              renderEditItems();
            }
          }
          
          // Добавить товар в редактируемый заказ
          document.getElementById('addProductForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const productSelect = document.getElementById('productSelect');
            const selectedOption = productSelect.options[productSelect.selectedIndex];
            const quantity = parseInt(document.getElementById('productQuantity').value);
            
            if (!selectedOption.value || !quantity) {
              alert('Выберите товар и укажите количество');
              return;
            }
            
            const title = selectedOption.dataset.title;
            const price = parseFloat(selectedOption.dataset.price);
            
            currentEditItems.push({
              title: title,
              price: price,
              quantity: quantity
            });
            
            renderEditItems();
            
            // Очищаем форму
            document.getElementById('addProductForm').reset();
            document.getElementById('productQuantity').value = 1;
          });
          
          // Сохранить изменения заказа
          async function saveOrderChanges() {
            if (!currentEditOrderId) {
              alert('Ошибка: не выбран заказ для редактирования');
              return;
            }
            
            try {
              const response = await fetch(\`/admin/orders/\${currentEditOrderId}/items\`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  items: currentEditItems
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                alert('Заказ успешно обновлен!');
                closeEditOrderModal();
                location.reload();
              } else {
                alert(\`Ошибка обновления заказа: \${result.error}\`);
              }
            } catch (error) {
              console.error('Error saving order:', error);
              alert('Ошибка сохранения заказа');
            }
          }
          
          // Закрытие модального окна при клике вне его
          window.onclick = function(event) {
            const modal = document.getElementById('editOrderModal');
            const balanceModal = document.getElementById('balanceModal');
            if (event.target === modal) {
              closeEditOrderModal();
            }
            if (event.target === balanceModal) {
              closeBalanceModal();
            }
          }
          
          // Открыть модальное окно управления балансом
          function openBalanceModal(userId) {
            const modal = document.getElementById('balanceModal');
            modal.style.display = 'block';
            document.getElementById('balanceUserId').value = userId;
            document.getElementById('balanceAmount').value = '';
            document.getElementById('balanceOperation').value = 'add';
            document.getElementById('balanceError').style.display = 'none';
          }
          
          // Закрыть модальное окно управления балансом
          function closeBalanceModal() {
            document.getElementById('balanceModal').style.display = 'none';
          }
          
          // Применить изменение баланса
          async function applyBalanceChange() {
            const userId = document.getElementById('balanceUserId').value;
            const amount = parseFloat(document.getElementById('balanceAmount').value);
            const operation = document.getElementById('balanceOperation').value;
            const errorDiv = document.getElementById('balanceError');
            
            if (!userId || !amount || amount <= 0) {
              errorDiv.textContent = 'Введите корректную сумму';
              errorDiv.style.display = 'block';
              return;
            }
            
            try {
              const response = await fetch('/admin/users/' + userId + '/balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  amount: amount,
                  operation: operation
                })
              });
              
              const result = await response.json();
              
              if (result.success) {
                closeBalanceModal();
                location.reload();
              } else {
                errorDiv.textContent = result.error || 'Ошибка изменения баланса';
                errorDiv.style.display = 'block';
              }
            } catch (error) {
              console.error('Error updating balance:', error);
              errorDiv.textContent = 'Ошибка соединения';
              errorDiv.style.display = 'block';
            }
          }
        </script>
        
        <!-- Модальное окно добавления заказа -->
        <div id="addOrderModal" class="edit-order-modal">
          <div class="edit-order-modal-content">
            <div class="edit-order-header">
              <h2>➕ Новый заказ</h2>
              <span class="edit-order-close" onclick="closeAddOrderModal()">&times;</span>
            </div>
            
            <form id="addOrderForm" method="POST" action="/admin/users/${userId}/orders" data-default-message="${escapeHtmlAttr(defaultMessage)}" onsubmit="return submitAddOrderForm(event)">
              <div class="form-group">
                <label for="addOrderContact">Контакт пользователя</label>
                <input type="text" id="addOrderContact" name="contact" placeholder="Телефон или @username" value="${escapeHtmlAttr(defaultContact)}">
              </div>
              
              <div class="form-group">
                <label for="addOrderMessage">Комментарий</label>
                <textarea id="addOrderMessage" name="message" rows="3" placeholder="Комментарий к заказу">${defaultMessage}</textarea>
              </div>
              
              <div class="form-group">
                <label for="addOrderStatus">Статус заказа</label>
                <select id="addOrderStatus" name="status">
                  <option value="NEW">🔴 Новый</option>
                  <option value="PROCESSING">🟡 В обработке</option>
                  <option value="COMPLETED">🟢 Завершен</option>
                  <option value="CANCELLED">⚫ Отменен</option>
                </select>
              </div>
              
              <div class="order-items-edit" id="newOrderItemsList">
                <p style="text-align: center; color: #6c757d; padding: 20px;">Товары не добавлены</p>
              </div>
              
              <div class="new-order-summary">
                <span>Итого:</span>
                <span><strong id="newOrderTotal">0.00</strong> PZ</span>
              </div>
              
              <div class="add-product-section">
                <h3>➕ Добавить товар из каталога</h3>
                <div class="add-product-form">
                  <div class="form-group">
                    <label for="addProductSelect">Выберите товар:</label>
                    <select id="addProductSelect">
                      <option value="">-- Выберите товар --</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label for="addProductQuantity">Количество:</label>
                    <input type="number" id="addProductQuantity" value="1" min="1">
                  </div>
                  <button type="button" class="add-product-btn" onclick="addProductFromSelect()">Добавить</button>
                </div>
              </div>
              
              <div class="add-product-section">
                <h3>✏️ Добавить товар вручную</h3>
                <div class="custom-product-form">
                  <div class="form-group">
                    <label for="customProductName">Название</label>
                    <input type="text" id="customProductName" placeholder="Например: Набор №1">
                  </div>
                  <div class="form-group">
                    <label for="customProductPrice">Цена (PZ)</label>
                    <input type="number" id="customProductPrice" placeholder="0.00" step="0.01" min="0">
                  </div>
                  <div class="form-group">
                    <label for="customProductQuantity">Количество</label>
                    <input type="number" id="customProductQuantity" value="1" min="1">
                  </div>
                  <button type="button" class="add-product-btn" onclick="addCustomProduct()">Добавить вручную</button>
                </div>
              </div>
              
              <input type="hidden" name="items" id="newOrderItemsInput">
              
              <div class="edit-order-actions">
                <button type="button" class="cancel-edit-btn" onclick="closeAddOrderModal()">❌ Отмена</button>
                <button type="submit" class="save-order-btn">💾 Создать заказ</button>
              </div>
            </form>
          </div>
        </div>
        
        <!-- Модальное окно редактирования заказа -->
        <div id="editOrderModal" class="edit-order-modal">
          <div class="edit-order-modal-content">
            <div class="edit-order-header">
              <h2>✏️ Редактировать заказ</h2>
              <span class="edit-order-close" onclick="closeEditOrderModal()">&times;</span>
            </div>
            
            <div id="orderItemsEdit" class="order-items-edit">
              <!-- Товары заказа будут загружены динамически -->
            </div>
            
            <div class="add-product-section">
              <h3>➕ Добавить товар</h3>
              <form id="addProductForm" class="add-product-form">
                <div class="form-group">
                  <label for="productSelect">Выберите товар:</label>
                  <select id="productSelect" name="productId" required>
                    <option value="">-- Выберите товар --</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="productQuantity">Количество:</label>
                  <input type="number" id="productQuantity" name="quantity" min="1" value="1" required>
                </div>
                <button type="submit" class="add-product-btn">➕ Добавить</button>
              </form>
            </div>
            
            <div class="edit-order-actions">
              <button class="cancel-edit-btn" onclick="closeEditOrderModal()">❌ Отмена</button>
              <button class="save-order-btn" onclick="saveOrderChanges()">💾 Сохранить изменения</button>
            </div>
          </div>
        </div>
        
        <!-- Модальное окно управления балансом -->
        <div id="balanceModal" class="balance-modal">
          <div class="balance-modal-content">
            <div class="balance-modal-header">
              <h2>💰 Управление балансом</h2>
              <span class="balance-modal-close" onclick="closeBalanceModal()">&times;</span>
            </div>
            
            <div class="balance-modal-body">
              <input type="hidden" id="balanceUserId" value="">
              
              <div class="balance-form-group">
                <label for="balanceOperation">Операция:</label>
                <select id="balanceOperation" class="balance-select">
                  <option value="add">➕ Пополнить баланс</option>
                  <option value="subtract">➖ Списать с баланса</option>
                </select>
              </div>
              
              <div class="balance-form-group">
                <label for="balanceAmount">Сумма (PZ):</label>
                <input type="number" id="balanceAmount" class="balance-input" placeholder="0.00" step="0.01" min="0.01">
              </div>
              
              <div id="balanceError" class="balance-error" style="display: none;"></div>
            </div>
            
            <div class="balance-modal-footer">
              <button class="balance-cancel-btn" onclick="closeBalanceModal()">Отмена</button>
              <button class="balance-apply-btn" onclick="applyBalanceChange()">Применить</button>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('❌ User orders page error:', error);
    res.status(500).send('Ошибка загрузки заказов пользователя');
  }
});

router.post('/users/:userId/orders', requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const { contact, message, status, items } = req.body;

  const allowedStatuses = ['NEW', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
  const targetStatus = allowedStatuses.includes((status || '').toUpperCase()) ? status.toUpperCase() : 'NEW';

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.redirect(`/admin/users/${userId}/orders?error=order_create_failed`);
    }

    let parsedItems: any[] = [];
    try {
      parsedItems = JSON.parse(items || '[]');
    } catch (error) {
      console.error('❌ Failed to parse items JSON:', error);
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.redirect(`/admin/users/${userId}/orders?error=order_no_items`);
    }

    const sanitizedItems = parsedItems.map((item) => {
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const price = Math.max(0, parseFloat(item.price) || 0);
      return {
        productId: item.productId || null,
        title: (item.title || 'Товар').toString().trim() || 'Товар',
        quantity,
        price,
        total: Number((price * quantity).toFixed(2))
      };
    });

    await prisma.orderRequest.create({
      data: {
        userId,
        contact: contact?.toString().trim() || null,
        message: message?.toString().trim() || 'Заказ создан администратором',
        itemsJson: JSON.stringify(sanitizedItems),
        status: targetStatus
      }
    });

    res.redirect(`/admin/users/${userId}/orders?success=order_created`);
  } catch (error) {
    console.error('❌ Error creating manual order:', error);
    res.redirect(`/admin/users/${userId}/orders?error=order_create_failed`);
  }
});

// Маршрут для получения списка партнеров пользователя
router.get('/users/:userId/partners', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { level } = req.query;
    const targetLevel = parseInt(level as string) || 1;

    // 1. Находим профиль партнера
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        partner: {
          select: { id: true }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    if (!user.partner) {
      return res.json([]);
    }

    // 2. Находим рефералов этого уровня
    const referrals = await prisma.partnerReferral.findMany({
      where: {
        profileId: user.partner.id,
        level: targetLevel
      },
      include: {
        referred: true // Включаем информацию о приглашенном пользователе
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Формируем ответ, извлекая пользователей
    const partners = referrals
      .filter(ref => ref.referred)
      .map(ref => ref.referred);

    res.json(partners);

  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({ error: 'Ошибка получения списка партнеров' });
  }
});

// Маршрут для отправки сообщений пользователям
router.post('/messages/send', requireAdmin, async (req, res) => {
  try {
    const { userIds, subject, text, saveAsTemplate } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Не указаны получатели' });
    }

    if (!subject || !text) {
      return res.status(400).json({ error: 'Не указаны тема или текст сообщения' });
    }

    let successCount = 0;
    const errors = [];

    // Отправляем сообщения каждому пользователю
    console.log(`📤 Начинаем отправку сообщений ${userIds.length} пользователям:`, userIds);

    for (const userId of userIds) {
      try {
        console.log(`📤 Обрабатываем пользователя: ${userId}`);

        // Получаем пользователя
        const user = await prisma.user.findUnique({
          where: { id: userId }
        });

        if (!user) {
          console.log(`❌ Пользователь ${userId} не найден в базе данных`);
          errors.push(`Пользователь ${userId} не найден`);
          continue;
        }

        console.log(`✅ Пользователь найден: ${user.firstName} (telegramId: ${user.telegramId})`);

        // Проверяем, есть ли telegramId у пользователя
        if (!user.telegramId || user.telegramId === 'null' || user.telegramId === 'undefined') {
          console.log(`❌ У пользователя ${user.firstName} отсутствует или неверный telegramId: ${user.telegramId}`);
          errors.push(`${user.firstName} (@${user.username || 'без username'}): отсутствует telegramId`);
          continue;
        }

        // Отправляем сообщение через Telegram Bot API
        try {
          const { getBotInstance } = await import('../lib/bot-instance.js');
          const bot = await getBotInstance();

          // Формируем сообщение с экранированием Markdown символов
          const escapeMarkdown = (text: string) => {
            return text.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
          };

          const messageText = `📧 ${escapeMarkdown(subject)}\n\n${escapeMarkdown(text)}`;

          console.log(`📤 Отправка сообщения пользователю ${user.firstName} (ID: ${user.telegramId}):`, messageText);

          // Отправляем сообщение
          let result;
          try {
            result = await bot.telegram.sendMessage(user.telegramId, messageText, {
              parse_mode: 'Markdown'
            });
          } catch (markdownError) {
            console.log(`⚠️ Markdown отправка не удалась, пробуем без Markdown: ${markdownError instanceof Error ? markdownError.message : String(markdownError)}`);
            // Если Markdown не работает, отправляем без форматирования
            const plainText = `📧 ${subject}\n\n${text}`;
            result = await bot.telegram.sendMessage(user.telegramId, plainText);
          }

          console.log(`✅ Сообщение успешно отправлено пользователю ${user.firstName} (@${user.username || 'без username'}), message_id: ${result.message_id}`);
          successCount++;

        } catch (telegramError) {
          console.error(`❌ Ошибка отправки сообщения пользователю ${user.firstName} (@${user.username || 'без username'}) (ID: ${user.telegramId}):`, telegramError);

          // Добавляем ошибку в список для отчета
          const errorMessage = telegramError instanceof Error ? telegramError.message : String(telegramError);
          errors.push(`${user.firstName} (@${user.username || 'без username'}): ${errorMessage}`);

          // Продолжаем обработку других пользователей даже при ошибке
        }

        // Сохраняем в историю
        await prisma.userHistory.create({
          data: {
            userId: userId,
            action: 'MESSAGE_SENT',
            payload: {
              subject,
              text,
              sentBy: 'admin'
            }
          }
        });

      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        errors.push(`Ошибка отправки пользователю ${userId}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    }

    // Сохраняем шаблон если нужно
    if (saveAsTemplate) {
      try {
        await prisma.userHistory.create({
          data: {
            userId: userIds[0], // Используем первого пользователя для шаблона
            action: 'MESSAGE_TEMPLATE_SAVED',
            payload: {
              subject,
              text,
              savedBy: 'admin'
            }
          }
        });
      } catch (error) {
        console.error('Error saving template:', error);
      }
    }

    console.log(`📊 Итоговые результаты отправки: успешно ${successCount}/${userIds.length}, ошибок: ${errors.length}`);

    res.json({
      successCount,
      totalCount: userIds.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ error: 'Ошибка отправки сообщений' });
  }
});

// Update user balance
router.post('/users/:userId/balance', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, operation } = req.body;

    if (!amount || amount <= 0) {
      return res.json({ success: false, error: 'Некорректная сумма' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.json({ success: false, error: 'Пользователь не найден' });
    }

    const currentBalance = user.balance || 0;
    let newBalance;

    if (operation === 'add') {
      newBalance = currentBalance + amount;
    } else if (operation === 'subtract') {
      if (currentBalance < amount) {
        return res.json({ success: false, error: 'Недостаточно средств на балансе' });
      }
      newBalance = currentBalance - amount;
    } else {
      return res.json({ success: false, error: 'Некорректная операция' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance }
    });

    // Записываем в историю пользователя
    await prisma.userHistory.create({
      data: {
        userId: userId,
        action: operation === 'add' ? 'BALANCE_ADDED' : 'BALANCE_SUBTRACTED',
        payload: {
          amount: amount,
          operation: operation,
          previousBalance: currentBalance,
          newBalance: newBalance
        }
      }
    });

    res.json({
      success: true,
      message: `Баланс успешно ${operation === 'add' ? 'пополнен' : 'списан'}`,
      newBalance: newBalance
    });

  } catch (error) {
    console.error('❌ Balance update error:', error);
    res.json({ success: false, error: 'Ошибка обновления баланса' });
  }
});

// Update order status
router.post('/orders/:orderId/status', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['NEW', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Неверный статус заказа' });
    }

    // Update order status
    await prisma.orderRequest.update({
      where: { id: orderId },
      data: { status }
    });

    res.json({ success: true, message: 'Статус заказа обновлен' });
  } catch (error) {
    console.error('❌ Update order status error:', error);
    res.status(500).json({ success: false, error: 'Ошибка обновления статуса заказа' });
  }
});
// Pay order from user balance
router.post('/orders/:orderId/pay', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order with user info
    const order = await prisma.orderRequest.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, balance: true, firstName: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }

    if (!order.user) {
      return res.status(400).json({ success: false, error: 'Пользователь не найден' });
    }

    if (order.status === 'COMPLETED') {
      return res.status(400).json({ success: false, error: 'Заказ уже оплачен' });
    }

    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Нельзя оплатить отмененный заказ' });
    }

    // Calculate order total
    const items = typeof order.itemsJson === 'string'
      ? JSON.parse(order.itemsJson || '[]')
      : (order.itemsJson || []);
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0);

    // Check if user has enough balance
    if (order.user.balance < totalAmount) {
      return res.status(400).json({
        success: false,
        error: `Недостаточно средств. Требуется: ${totalAmount.toFixed(2)} PZ, доступно: ${order.user.balance.toFixed(2)} PZ`
      });
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Deduct amount from user balance
      await tx.user.update({
        where: { id: order.user!.id },
        data: { balance: { decrement: totalAmount } }
      });

      // Update order status to COMPLETED
      await tx.orderRequest.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' }
      });

      // Create transaction record
      await tx.userHistory.create({
        data: {
          userId: order.user!.id,
          action: 'ORDER_PAYMENT',
          payload: {
            orderId: orderId,
            amount: -totalAmount,
            description: `Оплата заказа #${orderId.slice(-8)}`
          }
        }
      });
    });

    // Check if this purchase qualifies for referral program activation (120 PZ)
    if (totalAmount >= 120) {
      try {
        console.log(`🎯 Purchase of ${totalAmount} PZ qualifies for referral program activation`);
        await activatePartnerProfile(order.user.id, 'PURCHASE', 1); // 1 month activation
        console.log(`✅ Referral program activated for user ${order.user.id} via purchase`);
      } catch (activationError) {
        console.error('❌ Referral program activation error:', activationError);
        // Don't fail the payment if activation fails
      }
    }

    // Distribute referral bonuses after successful payment using dual system
    // NOTE: Бонусы уже распределяются в orders-module.ts, поэтому здесь закомментировано
    // чтобы избежать дублирования уведомлений
    /*
    try {
      await calculateDualSystemBonuses(order.user.id, totalAmount);
    } catch (bonusError) {
      console.error('❌ Referral bonus distribution error:', bonusError);
      // Don't fail the payment if bonus distribution fails
    }
    */

    res.json({
      success: true,
      message: `Заказ оплачен на сумму ${totalAmount.toFixed(2)} PZ. Статус изменен на "Готово".`
    });
  } catch (error) {
    console.error('❌ Pay order error:', error);
    res.status(500).json({ success: false, error: 'Ошибка оплаты заказа' });
  }
});
// Get order details for editing
router.get('/orders/:orderId', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await prisma.orderRequest.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true, firstName: true, username: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }

    // Parse items from JSON
    const items = typeof order.itemsJson === 'string'
      ? JSON.parse(order.itemsJson || '[]')
      : (order.itemsJson || []);

    res.json({
      success: true,
      data: {
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        items: items,
        user: order.user
      }
    });
  } catch (error) {
    console.error('❌ Get order error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Update order items
router.put('/orders/:orderId/items', requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Неверный формат товаров' });
    }

    // Validate items
    for (const item of items) {
      if (!item.title || !item.price || !item.quantity) {
        return res.status(400).json({ success: false, error: 'Неверный формат товара' });
      }
      if (item.price < 0 || item.quantity < 1) {
        return res.status(400).json({ success: false, error: 'Неверные значения цены или количества' });
      }
    }

    // Check if order exists
    const existingOrder = await prisma.orderRequest.findUnique({
      where: { id: orderId }
    });

    if (!existingOrder) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }

    // Update order items
    await prisma.orderRequest.update({
      where: { id: orderId },
      data: {
        itemsJson: items,
      }
    });

    console.log(`✅ Order ${orderId} items updated: ${items.length} items`);

    res.json({
      success: true,
      message: 'Товары заказа обновлены'
    });
  } catch (error) {
    console.error('❌ Update order items error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// API endpoint to scrape all missing images
router.post('/api/scrape-all-images', requireAdmin, async (req, res) => {
  // Возвращаем ответ сразу и запускаем в фоне
  res.json({
    success: true,
    message: 'Сбор фотографий запущен. Проверьте логи сервера для деталей.'
  });

  // Запускаем в фоне
  (async () => {
    try {
      console.log('🚀 Запуск сбора недостающих фотографий продуктов...');

      const { scrapeAllMissingImages } = await import('../services/scrape-images-service.js');
      const result = await scrapeAllMissingImages();

      console.log('\n✅ Сбор фотографий завершен!');
      console.log(`   ✅ Обновлено: ${result.updated}`);
      console.log(`   ⏭️  Пропущено (уже есть): ${result.skipped}`);
      console.log(`   ❌ Не удалось: ${result.failed}`);
      console.log(`   🔍 Не найдено в БД: ${result.notFound}`);
      console.log(`   📦 Всего обработано: ${result.total}`);
    } catch (error: any) {
      console.error('❌ Ошибка сбора фотографий:', error.message || error);
      console.error('Stack:', error.stack);
    }
  })();
});

// Get all products for dropdown
router.get('/api/products', requireAdmin, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        category: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { category: { name: 'asc' } },
        { title: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Helper function to distribute referral bonuses
async function distributeReferralBonuses(userId: string, orderAmount: number) {
  try {
    // Find inviter
    const referralRecord = await prisma.partnerReferral.findFirst({
      where: { referredId: userId },
      include: {
        profile: {
          include: {
            user: { select: { id: true, balance: true } }
          }
        }
      }
    });

    if (!referralRecord?.profile) {
      return; // No inviter found
    }

    const inviterProfile = referralRecord.profile;
    const bonusRate = 0.1; // 10% bonus
    const bonusAmount = orderAmount * bonusRate;

    // Create bonus transaction
    await prisma.partnerTransaction.create({
      data: {
        profileId: inviterProfile.id,
        type: 'CREDIT',
        amount: bonusAmount,
        description: `Бонус за заказ реферала (${orderAmount.toFixed(2)} PZ)`
      }
    });

    // Update inviter's balance
    await prisma.user.update({
      where: { id: inviterProfile.userId },
      data: { balance: { increment: bonusAmount } }
    });

    // Update partner profile balance
    await prisma.partnerProfile.update({
      where: { id: inviterProfile.id },
      data: {
        balance: { increment: bonusAmount },
        bonus: { increment: bonusAmount }
      }
    });

    console.log(`✅ Referral bonus distributed: ${bonusAmount.toFixed(2)} PZ to user ${inviterProfile.userId}`);
  } catch (error) {
    console.error('❌ Error distributing referral bonuses:', error);
    throw error;
  }
}
// Audio files management routes
router.get('/audio', requireAdmin, async (req, res) => {
  try {
    const audioFiles = await prisma.audioFile.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const audioFilesHtml = audioFiles.map(file => `
      <div class="audio-file-card">
        <div class="audio-file-header">
          <h3>🎵 ${file.title}</h3>
          <div class="audio-file-status ${file.isActive ? 'active' : 'inactive'}">
            ${file.isActive ? '✅ Активен' : '❌ Неактивен'}
          </div>
        </div>
        <div class="audio-file-info">
          <p><strong>Описание:</strong> ${file.description || 'Не указано'}</p>
          <p><strong>Категория:</strong> ${file.category || 'Не указана'}</p>
          <p><strong>Длительность:</strong> ${file.duration ? Math.floor(file.duration / 60) + ':' + (file.duration % 60).toString().padStart(2, '0') : 'Неизвестно'}</p>
          <p><strong>Размер:</strong> ${file.fileSize ? Math.round(file.fileSize / 1024) + ' KB' : 'Неизвестно'}</p>
          <p><strong>Загружен:</strong> ${file.createdAt.toLocaleDateString('ru-RU')}</p>
        </div>
        <div class="audio-file-actions">
          <button onclick="toggleAudioStatus('${file.id}')" class="toggle-btn ${file.isActive ? 'deactivate' : 'activate'}">
            ${file.isActive ? '❌ Деактивировать' : '✅ Активировать'}
          </button>
          <button onclick="deleteAudioFile('${file.id}')" class="delete-btn">🗑️ Удалить</button>
        </div>
      </div>
    `).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Управление аудиофайлами - Vital Bot Admin Panel</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .audio-file-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .audio-file-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
          .audio-file-header h3 { margin: 0; color: #333; }
          .audio-file-status.active { color: #28a745; font-weight: bold; }
          .audio-file-status.inactive { color: #dc3545; font-weight: bold; }
          .audio-file-info p { margin: 5px 0; color: #666; }
          .audio-file-actions { display: flex; gap: 10px; margin-top: 15px; }
          .toggle-btn, .delete-btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
          .toggle-btn.activate { background: #28a745; color: white; }
          .toggle-btn.deactivate { background: #ffc107; color: black; }
          .delete-btn { background: #dc3545; color: white; }
          .toggle-btn:hover, .delete-btn:hover { opacity: 0.8; }
          .back-btn { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <a href="/admin" class="back-btn">← Назад в админ-панель</a>
        <div class="header">
          <h1>🎵 Управление аудиофайлами</h1>
          <p>Здесь вы можете управлять загруженными аудиофайлами для раздела "Звуковые матрицы Гаряева"</p>
        </div>
        ${audioFilesHtml || '<p>Пока нет загруженных аудиофайлов.</p>'}
        
        <script>
          async function toggleAudioStatus(fileId) {
            if (confirm('Вы уверены, что хотите изменить статус файла?')) {
              try {
                const response = await fetch('/admin/audio/toggle', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileId })
                });
                if (response.ok) {
                  location.reload();
                } else {
                  alert('Ошибка при изменении статуса файла');
                }
              } catch (error) {
                alert('Ошибка при изменении статуса файла');
              }
            }
          }

          async function deleteAudioFile(fileId) {
            if (confirm('Вы уверены, что хотите удалить этот аудиофайл? Это действие нельзя отменить.')) {
              try {
                const response = await fetch('/admin/audio/delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ fileId })
                });
                if (response.ok) {
                  location.reload();
                } else {
                  alert('Ошибка при удалении файла');
                }
              } catch (error) {
                alert('Ошибка при удалении файла');
              }
            }
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading audio files:', error);
    res.status(500).send('Ошибка загрузки аудиофайлов');
  }
});

// Toggle audio file status
router.post('/admin/audio/toggle', requireAdmin, async (req, res) => {
  try {
    const { fileId } = req.body;

    const audioFile = await prisma.audioFile.findUnique({
      where: { id: fileId }
    });

    if (!audioFile) {
      return res.status(404).json({ error: 'Аудиофайл не найден' });
    }

    await prisma.audioFile.update({
      where: { id: fileId },
      data: { isActive: !audioFile.isActive }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling audio file status:', error);
    res.status(500).json({ error: 'Ошибка изменения статуса файла' });
  }
});

// Delete audio file
router.post('/admin/audio/delete', requireAdmin, async (req, res) => {
  try {
    const { fileId } = req.body;

    await prisma.audioFile.delete({
      where: { id: fileId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting audio file:', error);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
});

// Mount orders module
// router.use('/', ordersModule);

// Delete instruction endpoint
router.post('/products/:productId/delete-instruction', requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }

    await prisma.product.update({
      where: { id: productId },
      data: { instruction: null }
    });

    res.json({ success: true, message: 'Инструкция успешно удалена' });
  } catch (error) {
    console.error('Delete instruction error:', error);
    res.status(500).json({ success: false, error: 'Ошибка удаления инструкции' });
  }
});

// Save instruction endpoint
router.post('/products/:productId/save-instruction', requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const { instruction } = req.body;

    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ success: false, error: 'Инструкция не может быть пустой' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }

    await prisma.product.update({
      where: { id: productId },
      data: { instruction: instruction.trim() }
    });

    res.json({ success: true, message: 'Инструкция успешно сохранена' });
  } catch (error) {
    console.error('Save instruction error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сохранения инструкции' });
  }
});

// ========== Invoice Import Routes ==========
// Import invoice import routes from separate module
import invoiceImportRouter from './invoice-import.js';
// adminWebRouter already mounted at /admin in src/server.ts,
// so we mount invoice routes at the root here to get /admin/api/...
router.use('/', invoiceImportRouter);

// GET: Settings page
router.get('/invoice-settings', requireAdmin, async (req, res) => {
  try {
    const { getImportSettings } = await import('../services/invoice-import-service.js');
    const settings = await getImportSettings();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Настройки импорта инвойса - Админ панель</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
          .header h1 { font-size: 24px; margin-bottom: 10px; }
          .content { padding: 30px; }
          .form-group { margin-bottom: 20px; }
          .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
          .form-group input { width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; }
          .form-group input:focus { outline: none; border-color: #667eea; }
          .form-help { margin-top: 5px; font-size: 14px; color: #666; }
          .btn { background: #667eea; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; }
          .btn:hover { background: #5568d3; }
          .btn-secondary { background: #6c757d; }
          .btn-secondary:hover { background: #5a6268; }
          .back-link { display: inline-block; margin-bottom: 20px; color: #667eea; text-decoration: none; }
          .alert { padding: 12px; border-radius: 6px; margin-bottom: 20px; }
          .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          .price-preview { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 15px; }
          .price-preview h4 { margin-bottom: 10px; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚙️ Настройки импорта инвойса</h1>
            <p>Настройте курс валюты и мультипликатор для расчета продажных цен</p>
          </div>
          <div class="content">
            <a href="/admin" class="back-link">← Вернуться в админ панель</a>
            
            <div id="alertContainer"></div>
            
            <form id="settingsForm">
              <div class="form-group">
                <label for="exchangeRate">Курс обмена (БАТ → Рубль)</label>
                <input type="number" id="exchangeRate" name="exchangeRate" step="0.01" value="${settings.exchangeRate}" required>
                <div class="form-help">Текущий курс обмена тайского бата в российские рубли</div>
              </div>
              
              <div class="form-group">
                <label for="priceMultiplier">Мультипликатор цены</label>
                <input type="number" id="priceMultiplier" name="priceMultiplier" step="0.01" value="${settings.priceMultiplier}" required>
                <div class="form-help">Мультипликатор для расчета продажной цены из закупочной</div>
              </div>
              
              <div class="price-preview" id="pricePreview" style="display: none;">
                <h4>Пример расчета:</h4>
                <div id="previewContent"></div>
              </div>
              
              <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="submit" class="btn">💾 Сохранить настройки</button>
                <a href="/admin/invoice-import" class="btn btn-secondary">📥 Импорт инвойса</a>
              </div>
            </form>
          </div>
        </div>
        
        <script>
          const form = document.getElementById('settingsForm');
          const alertContainer = document.getElementById('alertContainer');
          const exchangeRateInput = document.getElementById('exchangeRate');
          const multiplierInput = document.getElementById('priceMultiplier');
          const pricePreview = document.getElementById('pricePreview');
          const previewContent = document.getElementById('previewContent');
          
          function showAlert(message, type = 'success') {
            alertContainer.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
            setTimeout(() => {
              alertContainer.innerHTML = '';
            }, 5000);
          }
          
          function updatePreview() {
            const rate = parseFloat(exchangeRateInput.value) || 0;
            const mult = parseFloat(multiplierInput.value) || 0;
            const testPrice = 100; // Тестовая цена 100 БАТ
            
            if (rate > 0 && mult > 0) {
              // Формула: цена_закупки * 2.45 * 8 = цена в рублях, округляем до 10, затем / 100 для PZ
              const priceInRubles = testPrice * rate * mult;
              const roundedPriceRub = Math.round(priceInRubles / 10) * 10;
              const sellingPrice = roundedPriceRub / 100; // Конвертируем в PZ (1 PZ = 100 руб)
              previewContent.innerHTML = \`
                <p><strong>Закупочная цена:</strong> \${testPrice} БАТ</p>
                <p><strong>Продажная цена:</strong> \${sellingPrice.toFixed(2)} PZ (\${roundedPriceRub} руб.)</p>
                <p><small>Формула: \${testPrice} × \${rate} × \${mult} = \${priceInRubles.toFixed(2)} руб. → округлено до \${roundedPriceRub} руб. = \${sellingPrice.toFixed(2)} PZ</small></p>
              \`;
              pricePreview.style.display = 'block';
            } else {
              pricePreview.style.display = 'none';
            }
          }
          
          exchangeRateInput.addEventListener('input', updatePreview);
          multiplierInput.addEventListener('input', updatePreview);
          updatePreview();
          
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
              exchangeRate: parseFloat(exchangeRateInput.value),
              priceMultiplier: parseFloat(multiplierInput.value)
            };
            
            if (formData.exchangeRate <= 0 || formData.priceMultiplier <= 0) {
              showAlert('Курс и мультипликатор должны быть положительными числами', 'error');
              return;
            }
            
            try {
              const response = await fetch('/admin/api/import-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
              });
              
              const data = await response.json();
              
              if (data.success) {
                showAlert('✅ Настройки успешно сохранены!', 'success');
                updatePreview();
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              showAlert('❌ Ошибка при сохранении настроек', 'error');
              console.error(error);
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error loading invoice settings page:', error);
    res.status(500).send('Ошибка загрузки страницы настроек');
  }
});

// ========== Delivery Settings (Admin) ==========
async function getSettingOrDefault(key: string, defaultValue: string): Promise<string> {
  const s = await prisma.settings.findUnique({ where: { key } });
  return s?.value ?? defaultValue;
}

async function upsertSetting(key: string, value: string, description: string) {
  // REFACTOR: Avoid upsert on standalone
  const existing = await prisma.settings.findUnique({ where: { key } });
  if (existing) {
    await prisma.settings.update({
      where: { key },
      data: { value, description }
    });
  } else {
    await prisma.settings.create({
      data: { key, value, description }
    });
  }
}

router.get('/api/delivery-settings', requireAdmin, async (_req, res) => {
  try {
    const pickupEnabled = (await getSettingOrDefault('delivery_pickup_enabled', '1')) === '1';
    const courierEnabled = (await getSettingOrDefault('delivery_courier_enabled', '1')) === '1';
    const pickupPriceRub = Number(await getSettingOrDefault('delivery_pickup_price_rub', '620')) || 620;
    const courierPriceRub = Number(await getSettingOrDefault('delivery_courier_price_rub', '875')) || 875;
    const provider = await getSettingOrDefault('delivery_provider', 'stub'); // stub | cdek | yandex

    const cdekClientId = await getSettingOrDefault('delivery_cdek_client_id', '');
    const cdekClientSecret = await getSettingOrDefault('delivery_cdek_client_secret', '');
    const yandexToken = await getSettingOrDefault('delivery_yandex_token', '');

    const originCity = await getSettingOrDefault('delivery_origin_city', 'Москва');
    const defaultWeightGrams = Number(await getSettingOrDefault('delivery_default_weight_g', '500')) || 500;

    res.json({
      success: true,
      settings: {
        pickupEnabled,
        courierEnabled,
        pickupPriceRub,
        courierPriceRub,
        provider,
        cdekClientId,
        cdekClientSecret,
        yandexToken,
        originCity,
        defaultWeightGrams
      }
    });
  } catch (error: any) {
    console.error('Delivery settings get error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка получения настроек доставки' });
  }
});

router.post('/api/delivery-settings', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const pickupEnabled = body.pickupEnabled ? '1' : '0';
    const courierEnabled = body.courierEnabled ? '1' : '0';
    const pickupPriceRub = String(Math.max(0, Number(body.pickupPriceRub || 0) || 0));
    const courierPriceRub = String(Math.max(0, Number(body.courierPriceRub || 0) || 0));
    const provider = String(body.provider || 'stub').trim();

    const cdekClientId = String(body.cdekClientId || '').trim();
    const cdekClientSecret = String(body.cdekClientSecret || '').trim();
    const yandexToken = String(body.yandexToken || '').trim();
    const originCity = String(body.originCity || 'Москва').trim();
    const defaultWeightGrams = String(Math.max(1, Number(body.defaultWeightGrams || 500) || 500));

    await upsertSetting('delivery_pickup_enabled', pickupEnabled, 'Доставка: включить ПВЗ');
    await upsertSetting('delivery_courier_enabled', courierEnabled, 'Доставка: включить курьера');
    await upsertSetting('delivery_pickup_price_rub', pickupPriceRub, 'Доставка: базовая цена ПВЗ (₽) для режима stub');
    await upsertSetting('delivery_courier_price_rub', courierPriceRub, 'Доставка: базовая цена курьер (₽) для режима stub');
    await upsertSetting('delivery_provider', provider, 'Доставка: провайдер тарифов (stub/cdek/yandex)');

    await upsertSetting('delivery_cdek_client_id', cdekClientId, 'CDEK: client_id (OAuth)');
    await upsertSetting('delivery_cdek_client_secret', cdekClientSecret, 'CDEK: client_secret (OAuth)');
    await upsertSetting('delivery_yandex_token', yandexToken, 'Yandex: API token');

    await upsertSetting('delivery_origin_city', originCity, 'Доставка: город отправления (склад)');
    await upsertSetting('delivery_default_weight_g', defaultWeightGrams, 'Доставка: вес посылки по умолчанию (г)');

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delivery settings save error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка сохранения настроек доставки' });
  }
});

router.get('/delivery-settings', requireAdmin, async (_req, res) => {
  try {
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';
    res.send(`
      ${renderAdminShellStart({ title: 'Доставка', activePath: '/admin/delivery-settings', buildMarker })}
        <div class="card" style="padding:16px;">
          <h2 style="margin:0 0 6px 0;">Настройки доставки</h2>
          <div class="muted" style="margin-bottom: 14px;">
            Сейчас доставка в webapp берётся из настроек ниже. Режим <b>stub</b> — фиксированные тарифы.
            CDEK/Яндекс подключим через API по этим ключам (если ключи пустые — будет использоваться stub).
          </div>

          <div id="deliveryAlert" style="margin-bottom: 12px;"></div>

          <form id="deliverySettingsForm" style="display:grid; gap: 12px; max-width: 720px;">
            <div style="display:flex; gap: 16px; flex-wrap:wrap;">
              <label style="display:flex; align-items:center; gap: 8px;">
                <input type="checkbox" id="pickupEnabled" />
                <span>ПВЗ доступен</span>
              </label>
              <label style="display:flex; align-items:center; gap: 8px;">
                <input type="checkbox" id="courierEnabled" />
                <span>Курьер доступен</span>
              </label>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label class="muted">Цена ПВЗ (₽) — для режима stub</label>
                <input class="input" type="number" id="pickupPriceRub" min="0" step="1" />
              </div>
              <div>
                <label class="muted">Цена Курьер (₽) — для режима stub</label>
                <input class="input" type="number" id="courierPriceRub" min="0" step="1" />
              </div>
            </div>

            <div>
              <label class="muted">Провайдер тарифов</label>
              <select class="input" id="provider">
                <option value="stub">stub (фиксированные тарифы)</option>
                <option value="cdek">CDEK (API)</option>
                <option value="yandex">Yandex Delivery (API)</option>
              </select>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label class="muted">Город отправления (склад)</label>
                <input class="input" type="text" id="originCity" />
              </div>
              <div>
                <label class="muted">Вес по умолчанию (г)</label>
                <input class="input" type="number" id="defaultWeightGrams" min="1" step="1" />
              </div>
            </div>

            <details style="border:1px solid var(--admin-border); border-radius: 12px; padding: 10px;">
              <summary style="cursor:pointer; font-weight:600;">Ключи API (опционально)</summary>
              <div style="margin-top: 10px; display:grid; gap: 10px;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label class="muted">CDEK client_id</label>
                    <input class="input" type="text" id="cdekClientId" />
                  </div>
                  <div>
                    <label class="muted">CDEK client_secret</label>
                    <input class="input" type="password" id="cdekClientSecret" />
                  </div>
                </div>
                <div>
                  <label class="muted">Yandex token</label>
                  <input class="input" type="password" id="yandexToken" />
                </div>
              </div>
            </details>

            <div style="display:flex; gap: 10px; justify-content:flex-end; margin-top: 6px;">
              <button type="button" class="btn" onclick="window.location.href='/admin'">Назад</button>
              <button type="submit" class="btn btn-primary">Сохранить</button>
            </div>
          </form>
        </div>

        <script>
          const alertEl = document.getElementById('deliveryAlert');
          function showAlert(msg, type) {
            const bg = type === 'error' ? '#fef2f2' : '#ecfdf5';
            const border = type === 'error' ? '#fecaca' : '#a7f3d0';
            const color = type === 'error' ? '#991b1b' : '#065f46';
            alertEl.innerHTML = '<div style="padding:10px 12px; border-radius: 10px; border:1px solid ' + border + '; background:' + bg + '; color:' + color + ';">' + msg + '</div>';
          }

          async function loadSettings() {
            const resp = await fetch('/admin/api/delivery-settings');
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.success) throw new Error(data.error || 'Не удалось загрузить настройки');
            const s = data.settings || {};
            document.getElementById('pickupEnabled').checked = !!s.pickupEnabled;
            document.getElementById('courierEnabled').checked = !!s.courierEnabled;
            document.getElementById('pickupPriceRub').value = String(s.pickupPriceRub ?? 0);
            document.getElementById('courierPriceRub').value = String(s.courierPriceRub ?? 0);
            document.getElementById('provider').value = String(s.provider || 'stub');
            document.getElementById('cdekClientId').value = String(s.cdekClientId || '');
            document.getElementById('cdekClientSecret').value = String(s.cdekClientSecret || '');
            document.getElementById('yandexToken').value = String(s.yandexToken || '');
            document.getElementById('originCity').value = String(s.originCity || 'Москва');
            document.getElementById('defaultWeightGrams').value = String(s.defaultWeightGrams || 500);
          }

          document.getElementById('deliverySettingsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
              const payload = {
                pickupEnabled: document.getElementById('pickupEnabled').checked,
                courierEnabled: document.getElementById('courierEnabled').checked,
                pickupPriceRub: Number(document.getElementById('pickupPriceRub').value || 0),
                courierPriceRub: Number(document.getElementById('courierPriceRub').value || 0),
                provider: document.getElementById('provider').value,
                cdekClientId: document.getElementById('cdekClientId').value,
                cdekClientSecret: document.getElementById('cdekClientSecret').value,
                yandexToken: document.getElementById('yandexToken').value,
                originCity: document.getElementById('originCity').value,
                defaultWeightGrams: Number(document.getElementById('defaultWeightGrams').value || 500),
              };
              const resp = await fetch('/admin/api/delivery-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
              const data = await resp.json().catch(() => ({}));
              if (!resp.ok || !data.success) throw new Error(data.error || 'Не удалось сохранить');
              showAlert('✅ Сохранено', 'success');
            } catch (err) {
              showAlert('❌ ' + (err && err.message ? err.message : String(err)), 'error');
            }
          });

          loadSettings().catch(err => showAlert('❌ ' + (err && err.message ? err.message : String(err)), 'error'));
        </script>
      ${renderAdminShellEnd()}
    `);
  } catch (error: any) {
    console.error('Delivery settings page error:', error);
    res.status(500).send('Ошибка страницы настроек доставки');
  }
});

// ========== Balance Top-ups (Admin) ==========
router.post('/api/balance-topup-text', requireAdmin, async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    await upsertSetting('balance_topup_text', text, 'Текст реквизитов пополнения (webapp)');
    res.json({ success: true });
  } catch (error: any) {
    console.error('Balance topup text save error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка сохранения текста' });
  }
});

router.post('/api/balance-topups/:id/approve', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const amountRub = Math.round(Number(req.body?.amountRub || 0));
    if (!id) return res.status(400).json({ success: false, error: 'id_required' });
    if (!Number.isFinite(amountRub) || amountRub <= 0) {
      return res.status(400).json({ success: false, error: 'Некорректная сумма' });
    }

    const request = await (prisma as any).balanceTopUpRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ success: false, error: 'Запрос не найден' });
    if (String(request.status) !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Запрос уже обработан' });
    }

    await (prisma as any).balanceTopUpRequest.update({
      where: { id },
      data: { status: 'APPROVED', amountRub }
    });

    await prisma.user.update({
      where: { id: request.userId },
      data: { balance: { increment: amountRub } }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Approve topup error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка подтверждения' });
  }
});

router.post('/api/balance-topups/:id/reject', requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id_required' });
    const request = await (prisma as any).balanceTopUpRequest.findUnique({ where: { id } });
    if (!request) return res.status(404).json({ success: false, error: 'Запрос не найден' });
    if (String(request.status) !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'Запрос уже обработан' });
    }
    await (prisma as any).balanceTopUpRequest.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Reject topup error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка отклонения' });
  }
});

router.get('/balance-topups', requireAdmin, async (_req, res) => {
  try {
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';
    const text = await getSettingOrDefault('balance_topup_text', '');
    const requests = await (prisma as any).balanceTopUpRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    const escapeHtml = (str: any) => String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const escapeAttr = (str: any) => escapeHtml(str).replace(/'/g, '&#39;');

    res.send(`
      ${renderAdminShellStart({ title: 'Пополнения баланса', activePath: '/admin/balance-topups', buildMarker })}
        <div class="card" style="padding:16px; margin-bottom: 16px;">
          <h2 style="margin:0 0 8px 0;">Текст страницы пополнения</h2>
          <div class="muted" style="margin-bottom: 10px;">Этот текст виден на странице баланса в клиенте.</div>
          <form id="topupTextForm" style="display:grid; gap: 10px; max-width: 720px;">
            <textarea id="topupText" rows="6" style="width:100%; padding:10px; border:1px solid var(--admin-border); border-radius:12px;">${escapeHtml(text)}</textarea>
            <button class="btn" type="submit" style="width: 200px;">Сохранить</button>
          </form>
          <div id="topupTextAlert" style="margin-top: 10px;"></div>
        </div>

        <div class="card" style="padding:16px;">
          <h2 style="margin:0 0 10px 0;">Чеки на пополнение</h2>
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Сумма (₽)</th>
                <th>Чек</th>
                <th>Статус</th>
                <th>Дата</th>
                <th style="text-align:right;">Действия</th>
              </tr>
            </thead>
            <tbody>
              ${requests.map((r: any) => `
                <tr>
                  <td>${escapeHtml(r.user?.firstName || '')} ${escapeHtml(r.user?.lastName || '')}<div class="muted">${escapeHtml(r.user?.telegramId || '')}</div></td>
                  <td>
                    <input type="number" min="1" step="1" class="topup-amount" data-id="${escapeAttr(r.id)}" value="${Number(r.amountRub || 0)}" style="width:120px; padding:6px 8px; border:1px solid var(--admin-border); border-radius:10px;">
                  </td>
                  <td>${r.receiptUrl ? `<a href="${escapeAttr(r.receiptUrl)}" target="_blank">Открыть</a>` : '—'}</td>
                  <td>${escapeHtml(r.status)}</td>
                  <td>${new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                  <td style="text-align:right;">
                    ${String(r.status) === 'PENDING' ? `
                      <button class="btn-mini approve-topup" data-id="${escapeAttr(r.id)}">Подтвердить</button>
                      <button class="btn-mini danger reject-topup" data-id="${escapeAttr(r.id)}">Отклонить</button>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <script>
          const alertBox = (msg, ok) => {
            const el = document.getElementById('topupTextAlert');
            if (!el) return;
            el.innerHTML = '<div class="alert ' + (ok ? 'alert-success' : 'alert-error') + '">' + msg + '</div>';
          };
          document.getElementById('topupTextForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = document.getElementById('topupText').value || '';
            const resp = await fetch('/admin/api/balance-topup-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ text })
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) return alertBox('Ошибка: ' + (data.error || 'HTTP ' + resp.status), false);
            alertBox('Сохранено', true);
          });

          document.addEventListener('click', async (e) => {
            const t = e.target;
            const el = (t && t.nodeType === 1) ? t : (t && t.parentElement ? t.parentElement : null);
            if (!el) return;
            const approve = el.closest('.approve-topup');
            const reject = el.closest('.reject-topup');
            if (approve) {
              const id = approve.getAttribute('data-id');
              const amountInput = document.querySelector('.topup-amount[data-id="' + id + '"]');
              const amountRub = amountInput ? Number(amountInput.value || 0) : 0;
              const resp = await fetch('/admin/api/balance-topups/' + encodeURIComponent(id) + '/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amountRub })
              });
              const data = await resp.json().catch(() => ({}));
              if (!resp.ok) return alert('Ошибка: ' + (data.error || 'HTTP ' + resp.status));
              window.location.reload();
              return;
            }
            if (reject) {
              const id = reject.getAttribute('data-id');
              const resp = await fetch('/admin/api/balance-topups/' + encodeURIComponent(id) + '/reject', {
                method: 'POST',
                credentials: 'include'
              });
              const data = await resp.json().catch(() => ({}));
              if (!resp.ok) return alert('Ошибка: ' + (data.error || 'HTTP ' + resp.status));
              window.location.reload();
              return;
            }
          }, true);
        </script>

      ${renderAdminShellEnd()}
    `);
  } catch (error: any) {
    console.error('Balance topups page error:', error);
    res.status(500).send('Ошибка загрузки страницы пополнений');
  }
});

// GET: Invoice import page
router.get('/invoice-import', requireAdmin, async (req, res) => {
  try {
    const { getImportSettings } = await import('../services/invoice-import-service.js');
    const settings = await getImportSettings();

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Импорт инвойса - Админ панель</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
          .header h1 { font-size: 24px; margin-bottom: 10px; }
          .content { padding: 30px; }
          .form-group { margin-bottom: 20px; }
          .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; }
          .form-group textarea { width: 100%; min-height: 400px; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 14px; font-family: monospace; }
          .form-group textarea:focus { outline: none; border-color: #667eea; }
          .form-help { margin-top: 5px; font-size: 14px; color: #666; }
          .btn { background: #667eea; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 600; margin-right: 10px; }
          .btn:hover { background: #5568d3; }
          .btn-secondary { background: #6c757d; }
          .btn-secondary:hover { background: #5a6268; }
          .btn-success { background: #28a745; }
          .btn-success:hover { background: #218838; }
          .back-link { display: inline-block; margin-bottom: 20px; color: #667eea; text-decoration: none; }
          .alert { padding: 12px; border-radius: 6px; margin-bottom: 20px; }
          .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
          .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
          .alert-info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
          .settings-info { background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
          .settings-info h4 { margin-bottom: 10px; color: #333; }
          #resultContainer { margin-top: 20px; }
          .result-item { padding: 10px; margin: 5px 0; border-radius: 4px; }
          .result-item.success { background: #d4edda; color: #155724; }
          .result-item.error { background: #f8d7da; color: #721c24; }
          .result-item.warning { background: #fff3cd; color: #856404; }
          .loading { display: none; text-align: center; padding: 20px; }
          .loading.active { display: block; }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📥 Импорт инвойса</h1>
            <p>Импортируйте данные товаров из инвойса. Формат: SKU|Description|Qty|Rate|Amount</p>
          </div>
          <div class="content">
            <div style="margin-bottom: 20px;">
              <a href="/admin" class="back-link">← Вернуться в админ панель</a>
              <a href="/admin/invoice-settings" class="back-link" style="margin-left: 10px;">⚙️ Настройки импорта</a>
            </div>
            
            <div class="settings-info">
              <h4>Текущие настройки:</h4>
              <p>Курс обмена: <strong>${settings.exchangeRate}</strong> БАТ/Рубль</p>
              <p>Мультипликатор: <strong>${settings.priceMultiplier}</strong></p>
              <p><small>Формула расчета цены: Цена в БАТ × ${settings.exchangeRate} × ${settings.priceMultiplier} = цена в рублях → округление до 10 → ÷ 100 = Цена в PZ</small></p>
              <p><small>Пример: 100 БАТ × ${settings.exchangeRate} × ${settings.priceMultiplier} = ${(100 * settings.exchangeRate * settings.priceMultiplier).toFixed(2)} руб. → округлено до ${(Math.round((100 * settings.exchangeRate * settings.priceMultiplier) / 10) * 10)} руб. = ${((Math.round((100 * settings.exchangeRate * settings.priceMultiplier) / 10) * 10) / 100).toFixed(2)} PZ</small></p>
            </div>

            <div class="settings-info">
              <h4>✅ Рекомендуемый способ (CSV):</h4>
              <ol style="margin-left: 18px; color:#333;">
                <li>Скачайте шаблон CSV</li>
                <li>Заполните по инвойсу колонки <code>invoiceRateTHB</code> и <code>invoiceQty</code> (только для нужных строк)</li>
                <li>Сначала нажмите “Проверить CSV” (dry-run), затем “Применить CSV”</li>
              </ol>
              <div style="margin-top: 12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                <a class="btn" href="/admin/api/invoice-csv-template" target="_blank">⬇️ Скачать CSV шаблон</a>
                <input type="file" id="csvFile" accept=".csv,text/csv" />
                <button type="button" class="btn" id="csvDryRunBtn">🔎 Проверить CSV</button>
                <button type="button" class="btn btn-success" id="csvApplyBtn">✅ Применить CSV</button>
              </div>
              <div class="form-help" style="margin-top:8px;">
                Импорт CSV работает строго: если найдена любая ошибка — ничего не обновится.
              </div>
            </div>
            
            <div id="alertContainer"></div>
            
            <form id="importForm">
              <div class="form-group">
                <label for="invoiceText">Текст инвойса</label>
                <textarea id="invoiceText" name="invoiceText" placeholder="FS1002-24|Rudis Oleum Botanical Face Care Night Formula 24 G -COSMOS Organic|20|453.86|9077.20
FS0001-24|Natural Balance Face Serum 24 G -COSMOS Natural|6|348.72|2092.32
..."></textarea>
                <div class="form-help">
                  Вставьте данные из инвойса. Формат: SKU|Описание|Количество|Цена в БАТ|Сумма<br>
                  Каждый товар на новой строке. Товары с одинаковым SKU будут объединены.
                </div>
              </div>
              
              <div style="display: flex; gap: 10px; margin-top: 20px;">
                <button type="submit" class="btn btn-success">📥 Импортировать (синхронно)</button>
                <button type="button" id="asyncImportBtn" class="btn">🚀 Импортировать (фоновый режим)</button>
                <button type="button" id="clearBtn" class="btn btn-secondary">🗑️ Очистить</button>
              </div>
            </form>
            
            <div class="loading" id="loadingIndicator">
              <div class="spinner"></div>
              <p style="margin-top: 10px;">Импорт в процессе...</p>
            </div>
            
            <div id="resultContainer"></div>
          </div>
        </div>
        
        <script>
          const form = document.getElementById('importForm');
          const alertContainer = document.getElementById('alertContainer');
          const invoiceTextArea = document.getElementById('invoiceText');
          const resultContainer = document.getElementById('resultContainer');
          const loadingIndicator = document.getElementById('loadingIndicator');
          const asyncImportBtn = document.getElementById('asyncImportBtn');
          const clearBtn = document.getElementById('clearBtn');
          const csvFileInput = document.getElementById('csvFile');
          const csvDryRunBtn = document.getElementById('csvDryRunBtn');
          const csvApplyBtn = document.getElementById('csvApplyBtn');
          
          function showAlert(message, type = 'success') {
            alertContainer.innerHTML = '<div class="alert alert-' + type + '">' + message + '</div>';
          }
          
          function showResult(result) {
            let html = '<h3>Результаты импорта:</h3>';
            html += '<p><strong>Всего товаров:</strong> ' + result.total + '</p>';
            html += '<p><strong>Обновлено:</strong> ' + result.updated + '</p>';
            html += '<p><strong>Создано:</strong> ' + result.created + '</p>';
            html += '<p><strong>Ошибок:</strong> ' + result.failed + '</p>';
            
            if (result.lowStockWarnings && result.lowStockWarnings.length > 0) {
              html += '<div class="result-item warning"><strong>⚠️ Низкий остаток:</strong><ul>';
              result.lowStockWarnings.slice(0, 10).forEach(w => {
                html += '<li>' + w + '</li>';
              });
              if (result.lowStockWarnings.length > 10) {
                html += '<li>... и еще ' + (result.lowStockWarnings.length - 10) + ' товаров</li>';
              }
              html += '</ul></div>';
            }
            
            if (result.outOfStock && result.outOfStock.length > 0) {
              html += '<div class="result-item error"><strong>🛑 Товары закончились:</strong><ul>';
              result.outOfStock.slice(0, 10).forEach(w => {
                html += '<li>' + w + '</li>';
              });
              if (result.outOfStock.length > 10) {
                html += '<li>... и еще ' + (result.outOfStock.length - 10) + ' товаров</li>';
              }
              html += '</ul></div>';
            }
            
            if (result.errors && result.errors.length > 0) {
              html += '<div class="result-item error"><strong>❌ Ошибки:</strong><ul>';
              result.errors.slice(0, 10).forEach(e => {
                html += '<li>' + e + '</li>';
              });
              if (result.errors.length > 10) {
                html += '<li>... и еще ' + (result.errors.length - 10) + ' ошибок</li>';
              }
              html += '</ul></div>';
            }
            
            resultContainer.innerHTML = html;
          }

          function showCsvResult(payload) {
            let html = '<h3>Результаты CSV:</h3>';
            html += '<p><strong>Режим:</strong> ' + (payload.applied ? 'ПРИМЕНЕНО' : 'ПРОВЕРКА (dry-run)') + '</p>';
            html += '<p><strong>Строк в файле:</strong> ' + (payload.summary?.rowsTotal ?? '-') + '</p>';
            html += '<p><strong>К обновлению:</strong> ' + (payload.summary?.rowsToUpdate ?? '-') + '</p>';
            if (Array.isArray(payload.updates) && payload.updates.length) {
              html += '<div class="result-item success"><strong>Первые изменения:</strong><ul>';
              payload.updates.slice(0, 10).forEach(u => {
                const oldRub = Math.round((u.oldPricePz || 0) * 100);
                const newRub = Math.round((u.newPricePz || 0) * 100);
                html += '<li>' + (u.sku || '') + ' — ' + (u.title || '') +
                  ' | цена: ' + oldRub + '→' + newRub + ' ₽' +
                  ' | остаток: ' + (u.oldStock ?? '-') + '→' + (u.newStock ?? '-') + '</li>';
              });
              if (payload.updates.length > 10) html += '<li>... и еще ' + (payload.updates.length - 10) + '</li>';
              html += '</ul></div>';
            }
            resultContainer.innerHTML = html;
          }

          async function runCsvImport(apply) {
            const file = csvFileInput && csvFileInput.files ? csvFileInput.files[0] : null;
            if (!file) {
              showAlert('Выберите CSV файл', 'error');
              return;
            }
            loadingIndicator.classList.add('active');
            resultContainer.innerHTML = '';
            try {
              const fd = new FormData();
              fd.append('file', file);
              fd.append('apply', apply ? '1' : '0');
              const resp = await fetch('/admin/api/import-invoice-csv-sync', { method: 'POST', body: fd });
              const data = await resp.json().catch(() => ({}));
              loadingIndicator.classList.remove('active');
              if (!resp.ok || !data.success) {
                const errs = Array.isArray(data.errors) ? data.errors.join('<br>') : (data.error || 'Неизвестная ошибка');
                showAlert('❌ Ошибка CSV: ' + errs, 'error');
                return;
              }
              showAlert(apply ? '✅ CSV применён!' : '✅ CSV проверен (dry-run)!', 'success');
              showCsvResult(data);
            } catch (e) {
              loadingIndicator.classList.remove('active');
              showAlert('❌ Ошибка при импорте CSV', 'error');
              console.error(e);
            }
          }

          csvDryRunBtn.addEventListener('click', () => runCsvImport(false));
          csvApplyBtn.addEventListener('click', () => runCsvImport(true));
          
          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const invoiceText = invoiceTextArea.value.trim();
            if (!invoiceText) {
              showAlert('Введите текст инвойса', 'error');
              return;
            }
            
            loadingIndicator.classList.add('active');
            resultContainer.innerHTML = '';
            
            try {
              const response = await fetch('/admin/api/import-invoice-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceText })
              });
              
              const data = await response.json();
              loadingIndicator.classList.remove('active');
              
              if (data.success) {
                showAlert('✅ Импорт завершен!', 'success');
                showResult(data.result);
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              loadingIndicator.classList.remove('active');
              showAlert('❌ Ошибка при импорте', 'error');
              console.error(error);
            }
          });
          
          asyncImportBtn.addEventListener('click', async () => {
            const invoiceText = invoiceTextArea.value.trim();
            if (!invoiceText) {
              showAlert('Введите текст инвойса', 'error');
              return;
            }
            
            showAlert('🚀 Импорт запущен в фоновом режиме. Результат будет отправлен в Telegram.', 'info');
            
            try {
              const response = await fetch('/admin/api/import-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceText })
              });
              
              const data = await response.json();
              
              if (data.success) {
                showAlert('✅ Импорт запущен! Обрабатывается ' + data.itemsCount + ' товаров.', 'success');
              } else {
                showAlert('❌ Ошибка: ' + (data.error || 'Неизвестная ошибка'), 'error');
              }
            } catch (error) {
              showAlert('❌ Ошибка при запуске импорта', 'error');
              console.error(error);
            }
          });
          
          clearBtn.addEventListener('click', () => {
            invoiceTextArea.value = '';
            resultContainer.innerHTML = '';
            alertContainer.innerHTML = '';
          });
        </script>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Error loading invoice import page:', error);
    res.status(500).send('Ошибка загрузки страницы импорта');
  }
});

// ========== Specialists (Admin) ==========
router.get('/specialists', requireAdmin, async (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Специалисты - Админ панель</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        *{ box-sizing:border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f5f5f5; padding: 20px; }
        body.modal-open { overflow: hidden; }
        .container { max-width: 1100px; margin: 0 auto; background:#fff; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.08); overflow:hidden; }
        .header { background: linear-gradient(135deg, #111827 0%, #374151 100%); color:#fff; padding: 26px; }
        .header h1 { margin:0; font-size: 22px; }
        .content { padding: 22px; }
        .btn { background:#111827; color:#fff; padding: 10px 14px; border:none; border-radius: 10px; cursor:pointer; font-weight:700; text-decoration:none; display:inline-block; }
        .btn.secondary { background:#6b7280; }
        .btn.danger { background:#b91c1c; }
        .row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        input, textarea, select { width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; }
        textarea { min-height: 100px; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; background:#fff; }
        .table { width: 100%; border-collapse: collapse; }
        .table th, .table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 14px; vertical-align: top; }
        .muted { color:#6b7280; font-size: 12px; }
        .pill { display:inline-block; padding: 4px 10px; border-radius: 999px; background:#f3f4f6; font-size: 12px; }
        .modal { position: fixed; inset: 0; display:none; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 6vh 16px; }
        .modal.open { display:block; }
        .overlay { position: fixed; inset:0; background: rgba(0,0,0,0.35); }
        .modal-body { position: relative; z-index: 1; max-width: 920px; margin: 0 auto; background:#fff; border-radius: 14px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
        @media (max-width: 640px) {
          body { padding: 12px; }
          .container { border-radius: 12px; }
          .modal { padding: 12px; }
          .modal-body { padding: 14px; border-radius: 12px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👩‍⚕️ Специалисты</h1>
          <div class="muted" style="margin-top:6px;">Каталог специалистов для раздела WebApp “Специалисты”.</div>
        </div>
        <div class="content">
          <div class="row" style="justify-content: space-between; margin-bottom: 14px;">
            <a href="/admin" class="btn secondary">← Назад</a>
            <div class="row">
              <button class="btn secondary" onclick="openTaxonomyModal('categories')">Категории</button>
              <button class="btn secondary" onclick="openTaxonomyModal('specialties')">Специальности</button>
              <button class="btn" onclick="openModal()">+ Добавить специалиста</button>
            </div>
          </div>

          <div id="alert"></div>
          <div class="card">
            <table class="table" id="specTable">
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Категория</th>
                  <th>Специальность</th>
                  <th>Активен</th>
                  <th>Сортировка</th>
                  <th></th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="modal" id="modal">
        <div class="overlay" onclick="closeModal()"></div>
        <div class="modal-body">
          <div class="row" style="justify-content: space-between; margin-bottom: 10px;">
            <div style="font-weight:900;">Редактор специалиста</div>
            <button class="btn secondary" onclick="closeModal()">Закрыть</button>
          </div>

          <div class="grid">
            <div>
              <div class="muted">Имя *</div>
              <input id="f_name" placeholder="Имя Фамилия" />
            </div>
            <div>
              <div class="muted">Категория *</div>
              <select id="f_categoryId"></select>
            </div>
            <div>
              <div class="muted">Фото</div>
              <input id="f_photoFile" type="file" accept="image/*" />
              <div class="muted" id="photoHelp" style="margin-top:6px;">Загрузите файл (ссылка не нужна).</div>
              <div id="photoPreviewWrap" style="margin-top:10px; display:none;">
                <img id="photoPreview" src="" alt="" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; border:1px solid #e5e7eb;">
              </div>
            </div>
            <div>
              <div class="muted">Профиль (коротко)</div>
              <input id="f_profile" placeholder="Опыт, регалии, роль..." />
            </div>
          </div>

          <div style="margin-top: 12px;">
            <div class="grid">
              <div>
                <div class="muted">Специальность *</div>
                <select id="f_specialtyId"></select>
              </div>
              <div>
                <div class="muted">Ссылка для записи (мессенджер)</div>
                <input id="f_messengerUrl" placeholder="https://t.me/username или ссылка WhatsApp/Instagram" />
              </div>
            </div>
          </div>

          <div style="margin-top: 12px;">
            <div class="muted">Описание</div>
            <textarea id="f_about" placeholder="Текст о специалисте"></textarea>
          </div>

          <div class="card" style="margin-top: 12px;">
            <div class="row" style="justify-content: space-between; margin-bottom: 10px;">
              <div style="font-weight:900;">Услуги</div>
              <button class="btn secondary" type="button" onclick="addServiceRow()">+ Добавить услугу</button>
            </div>
            <div class="muted" style="margin-bottom: 10px;">Добавляй услуги кнопками (без JSON).</div>
            <div id="servicesList" style="display:grid; gap:10px;"></div>
          </div>

          <div class="grid" style="margin-top: 12px;">
            <div>
              <div class="muted">Сортировка (sortOrder)</div>
              <input id="f_sortOrder" type="number" value="0" />
            </div>
            <div></div>
          </div>

          <div class="row" style="margin-top: 12px; align-items:center;">
            <label style="display:flex; gap:8px; align-items:center;">
              <input type="checkbox" id="f_isActive" checked />
              <span>Активен</span>
            </label>
          </div>

          <div class="row" style="margin-top: 14px; justify-content: flex-end;">
            <button class="btn danger" id="deleteBtn" style="display:none;" onclick="deleteSpec()">Удалить</button>
            <button class="btn" onclick="saveSpec()">Сохранить</button>
          </div>
        </div>
      </div>

      <script>
        let currentId = null;

        function showAlert(msg, type='ok') {
          const el = document.getElementById('alert');
          el.innerHTML = '<div class="card" style="border-color:' + (type==='err' ? '#fecaca' : '#d1fae5') + '; background:' + (type==='err' ? '#fef2f2' : '#ecfdf5') + '">' + msg + '</div>';
          setTimeout(() => { el.innerHTML = ''; }, 4500);
        }

        function escapeHtml(str) {
          return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
        }

        let categories = [];
        let specialtiesByCategory = new Map();
        let taxonomyMode = null; // 'categories' | 'specialties'
        let taxonomyEditing = null; // { type, id }

        async function loadTaxonomy() {
          const c = await fetch('/admin/api/specialist-categories').then(r => r.json()).catch(() => ({}));
          categories = Array.isArray(c.categories) ? c.categories : [];
          const select = document.getElementById('f_categoryId');
          if (select) {
            select.innerHTML = categories.filter(x => x.isActive !== false).map(cat => '<option value="' + cat.id + '">' + escapeHtml(cat.name) + '</option>').join('');
          }
          await refreshSpecialtiesForSelectedCategory();
        }

        async function refreshSpecialtiesForSelectedCategory() {
          const catId = document.getElementById('f_categoryId')?.value || '';
          if (!catId) return;
          const s = await fetch('/admin/api/specialist-specialties?categoryId=' + encodeURIComponent(catId)).then(r => r.json()).catch(() => ({}));
          const list = Array.isArray(s.specialties) ? s.specialties : [];
          specialtiesByCategory.set(catId, list);
          const select = document.getElementById('f_specialtyId');
          if (select) {
            select.innerHTML = list.filter(x => x.isActive !== false).map(sp => '<option value="' + sp.id + '">' + escapeHtml(sp.name) + '</option>').join('');
          }
        }

        async function load() {
          const resp = await fetch('/admin/api/specialists');
          const data = await resp.json().catch(() => ({}));
          const tbody = document.querySelector('#specTable tbody');
          tbody.innerHTML = '';
          (data.specialists || []).forEach(s => {
            const tr = document.createElement('tr');
            const cat = s.category?.name || '';
            const spName = s.specialtyRef?.name || s.specialty || '';
            tr.innerHTML = \`
              <td><strong>\${escapeHtml(s.name || '')}</strong><div class="muted">\${escapeHtml(s.profile || '')}</div></td>
              <td><span class="pill">\${escapeHtml(cat)}</span></td>
              <td><span class="pill">\${escapeHtml(spName)}</span></td>
              <td>\${s.isActive ? '✅' : '—'}</td>
              <td>\${Number(s.sortOrder || 0)}</td>
              <td><button class="btn secondary" onclick="edit('\${s.id}')">Редактировать</button></td>
            \`;
            tbody.appendChild(tr);
          });
        }

        function openModal() {
          currentId = null;
          document.getElementById('deleteBtn').style.display = 'none';
          setForm({ name:'', categoryId:'', specialtyId:'', photoUrl:'', profile:'', about:'', messengerUrl:'', isActive:true, sortOrder:0, services: [] });
          document.getElementById('modal').classList.add('open');
          try { document.body.classList.add('modal-open'); } catch (_) {}
        }
        function closeModal() {
          document.getElementById('modal').classList.remove('open');
          try { document.body.classList.remove('modal-open'); } catch (_) {}
        }

        function setForm(s) {
          document.getElementById('f_name').value = s.name || '';
          // Reset file input and preview
          const fileInput = document.getElementById('f_photoFile');
          if (fileInput) fileInput.value = '';
          const previewWrap = document.getElementById('photoPreviewWrap');
          const preview = document.getElementById('photoPreview');
          if (previewWrap && preview) {
            if (s.photoUrl) {
              preview.src = s.photoUrl;
              previewWrap.style.display = 'block';
            } else {
              preview.src = '';
              previewWrap.style.display = 'none';
            }
          }
          document.getElementById('f_profile').value = s.profile || '';
          document.getElementById('f_about').value = s.about || '';
          document.getElementById('f_messengerUrl').value = s.messengerUrl || '';
          document.getElementById('f_isActive').checked = !!s.isActive;
          document.getElementById('f_sortOrder').value = Number(s.sortOrder || 0);

          // Category & specialty
          if (s.categoryId && document.getElementById('f_categoryId')) {
            document.getElementById('f_categoryId').value = s.categoryId;
          }
          // rebuild specialties for category then set selected
          refreshSpecialtiesForSelectedCategory().then(() => {
            if (s.specialtyId && document.getElementById('f_specialtyId')) {
              document.getElementById('f_specialtyId').value = s.specialtyId;
            }
          });

          // Services UI
          const list = document.getElementById('servicesList');
          if (list) list.innerHTML = '';
          const services = Array.isArray(s.services) ? s.services : [];
          services.forEach(svc => addServiceRow(svc));
        }

        async function edit(id) {
          const resp = await fetch('/admin/api/specialists/' + encodeURIComponent(id));
          const data = await resp.json().catch(() => ({}));
          if (!data.success) return showAlert(data.error || 'Ошибка', 'err');
          currentId = id;
          document.getElementById('deleteBtn').style.display = 'inline-block';
          setForm(data.specialist);
          document.getElementById('modal').classList.add('open');
          try { document.body.classList.add('modal-open'); } catch (_) {}
        }

        function getServicesFromUi() {
          const rows = Array.from(document.querySelectorAll('[data-service-row="1"]'));
          const out = [];
          rows.forEach((row, idx) => {
            const title = row.querySelector('[data-service-title]')?.value?.trim() || '';
            const desc = row.querySelector('[data-service-desc]')?.value?.trim() || '';
            const format = row.querySelector('[data-service-format]')?.value?.trim() || '';
            const durationMin = Number(row.querySelector('[data-service-duration]')?.value || 0);
            const detailsUrl = row.querySelector('[data-service-details]')?.value?.trim() || '';
            const price = Number(row.querySelector('[data-service-price]')?.value || 0);
            if (!title) return;
            out.push({
              title,
              description: desc || null,
              format: format || null,
              durationMin: durationMin > 0 ? Math.round(durationMin) : null,
              detailsUrl: detailsUrl || null,
              priceRub: Math.round(price),
              sortOrder: idx
            });
          });
          return out;
        }

        function getPayload() {
          const name = document.getElementById('f_name').value.trim();
          const categoryId = document.getElementById('f_categoryId')?.value || '';
          const specialtyId = document.getElementById('f_specialtyId')?.value || '';
          const profile = document.getElementById('f_profile').value.trim();
          const about = document.getElementById('f_about').value.trim();
          const messengerUrl = document.getElementById('f_messengerUrl').value.trim();
          const isActive = document.getElementById('f_isActive').checked;
          const sortOrder = Number(document.getElementById('f_sortOrder').value || 0);
          if (!name) throw new Error('Укажите имя');
          if (!categoryId) throw new Error('Выберите категорию');
          if (!specialtyId) throw new Error('Выберите специальность');
          const services = getServicesFromUi();
          return { name, categoryId, specialtyId, profile: profile || null, about: about || null, messengerUrl: messengerUrl || null, isActive, sortOrder, services };
        }

        async function saveSpec() {
          try {
            const payload = getPayload();
            const resp = await fetch(currentId ? ('/admin/api/specialists/' + encodeURIComponent(currentId)) : '/admin/api/specialists', {
              method: currentId ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const rawText = await resp.text().catch(() => '');
            let data = {};
            try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) {}
            if (!resp.ok || !data.success) {
              console.error('Specialist save failed:', { status: resp.status, rawText, data });
              const errMsg = (data && data.error) ? String(data.error) : (rawText || 'Ошибка сохранения');
              return showAlert('HTTP ' + resp.status + ': ' + errMsg, 'err');
            }
            // Upload photo if provided
            const savedId = (data && data.specialist && data.specialist.id) ? String(data.specialist.id) : (currentId ? String(currentId) : '');
            const photoFile = document.getElementById('f_photoFile')?.files?.[0] || null;
            if (photoFile && savedId) {
              try {
                showAlert('⏳ Загружаю фото...', 'ok');
                const fd = new FormData();
                fd.append('photo', photoFile);
                const upResp = await fetch('/admin/api/specialists/' + encodeURIComponent(savedId) + '/upload-photo', { method: 'POST', body: fd });
                const upText = await upResp.text().catch(() => '');
                let upData = {};
                try { upData = upText ? JSON.parse(upText) : {}; } catch (_) {}
                if (!upResp.ok || !upData.success) {
                  const msg = (upData && upData.error) ? String(upData.error) : (upText || 'Ошибка загрузки фото');
                  return showAlert('HTTP ' + upResp.status + ': ' + msg, 'err');
                }
              } catch (e) {
                console.error('Photo upload exception:', e);
                return showAlert('❌ ' + (e.message || e), 'err');
              }
            }

            showAlert('✅ Сохранено');
            closeModal();
            await load();
          } catch (e) {
            console.error('Specialist save exception:', e);
            showAlert('❌ ' + (e.message || e), 'err');
          }
        }

        async function deleteSpec() {
          if (!currentId) return;
          if (!confirm('Удалить специалиста?')) return;
          const resp = await fetch('/admin/api/specialists/' + encodeURIComponent(currentId), { method: 'DELETE' });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok || !data.success) return showAlert(data.error || 'Ошибка удаления', 'err');
          showAlert('✅ Удалено');
          closeModal();
          await load();
        }

        function addServiceRow(svc) {
          const list = document.getElementById('servicesList');
          if (!list) return;
          const row = document.createElement('div');
          row.setAttribute('data-service-row', '1');
          row.className = 'row';
          row.style.alignItems = 'stretch';
          row.innerHTML =
            '<div style="flex:1; min-width: 260px;">' +
              '<div class="muted">Название услуги</div>' +
              '<input data-service-title placeholder="Например: Определение типажа и цветотипирование">' +
              '<div class="muted" style="margin-top:10px;">Описание</div>' +
              '<textarea data-service-desc placeholder="Коротко о том, что входит в услугу" style="min-height: 84px;"></textarea>' +
            '</div>' +
            '<div style="width: 220px;">' +
              '<div class="muted">Формат</div>' +
              '<select data-service-format>' +
                '<option value=""></option>' +
                '<option value="офлайн/онлайн">офлайн/онлайн</option>' +
                '<option value="офлайн">офлайн</option>' +
                '<option value="онлайн">онлайн</option>' +
              '</select>' +
              '<div class="muted" style="margin-top:10px;">Стоимость (₽)</div>' +
              '<input data-service-price type="number" min="0" step="1" value="0">' +
              '<div class="muted" style="margin-top:10px;">Длительность (мин)</div>' +
              '<input data-service-duration type="number" min="0" step="5" value="0">' +
              '<div class="muted" style="margin-top:10px;">Ссылка “Подробнее” (опционально)</div>' +
              '<input data-service-details placeholder="https://..." />' +
            '</div>' +
            '<div style="width: 120px; display:flex; align-items:flex-end;">' +
              '<button type="button" class="btn danger" onclick="this.closest(\\'[data-service-row=\"1\"]\\').remove()">Удалить</button>' +
            '</div>';
          try {
            const titleEl = row.querySelector('[data-service-title]');
            const priceEl = row.querySelector('[data-service-price]');
            const descEl = row.querySelector('[data-service-desc]');
            const formatEl = row.querySelector('[data-service-format]');
            const durEl = row.querySelector('[data-service-duration]');
            const detailsEl = row.querySelector('[data-service-details]');
            if (titleEl) titleEl.value = String(svc?.title || '');
            if (priceEl) priceEl.value = String(Number(svc?.priceRub || 0));
            if (descEl) descEl.value = String(svc?.description || '');
            if (formatEl) formatEl.value = String(svc?.format || '');
            if (durEl) durEl.value = String(Number(svc?.durationMin || 0));
            if (detailsEl) detailsEl.value = String(svc?.detailsUrl || '');
          } catch (_) {}
          list.appendChild(row);
        }

        // taxonomy modals (simple prompt-based edit for speed)
        async function openTaxonomyModal(mode) {
          taxonomyMode = mode;
          if (mode === 'categories') {
            const data = await fetch('/admin/api/specialist-categories').then(r=>r.json()).catch(()=>({}));
            const names = (data.categories||[]).map(c => (String(c.id) + ' | ' + (c.isActive ? 'ON' : 'OFF') + ' | ' + (c.sortOrder||0) + ' | ' + String(c.name||''))).join('\\n');
            alert('Категории (id | status | sort | name)\\n\\n' + (names || '(пусто)') + '\\n\\nДобавление/редактирование сделаю отдельным окном следующим патчем — сейчас важнее стабилизировать специалистов.');
          } else {
            const catId = prompt('Введите categoryId чтобы показать специальности этой категории (или оставьте пусто):', '');
            const data = await fetch('/admin/api/specialist-specialties' + (catId ? ('?categoryId=' + encodeURIComponent(catId)) : '')).then(r=>r.json()).catch(()=>({}));
            const names = (data.specialties||[]).map(s => (String(s.id) + ' | ' + (s.isActive ? 'ON' : 'OFF') + ' | ' + (s.sortOrder||0) + ' | ' + String(s.name||'') + ' | cat:' + String(s.categoryId||''))).join('\\n');
            alert('Специальности (id | status | sort | name | categoryId)\\n\\n' + (names || '(пусто)') + '\\n\\nUI управления добавлю в следующем шаге.');
          }
        }

        document.getElementById('f_categoryId')?.addEventListener('change', () => refreshSpecialtiesForSelectedCategory());
        document.getElementById('f_photoFile')?.addEventListener('change', () => {
          try {
            const file = document.getElementById('f_photoFile')?.files?.[0];
            const wrap = document.getElementById('photoPreviewWrap');
            const img = document.getElementById('photoPreview');
            if (!wrap || !img) return;
            if (!file) {
              img.src = '';
              wrap.style.display = 'none';
              return;
            }
            img.src = URL.createObjectURL(file);
            wrap.style.display = 'block';
          } catch (_) {}
        });
        loadTaxonomy().then(load);
      </script>
    </body>
    </html>
  `);
});

router.get('/api/specialist-categories', requireAdmin, async (_req, res) => {
  try {
    const categories = await prisma.specialistCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    res.json({ success: true, categories });
  } catch (error: any) {
    console.error('Admin specialist categories list error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка загрузки категорий' });
  }
});

router.post('/api/specialist-categories', requireAdmin, async (req, res) => {
  try {
    const { name, sortOrder, isActive } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'name обязателен' });

    // REFACTOR: Check existence first to avoid P2031 (Replica Set required for unique constraints in some contexts)
    const existing = await prisma.specialistCategory.findUnique({ where: { name: String(name).trim() } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Категория с таким именем уже существует' });
    }

    const created = await prisma.specialistCategory.create({
      data: {
        name: String(name).trim(),
        sortOrder: Number(sortOrder || 0),
        isActive: typeof isActive === 'boolean' ? isActive : true
      }
    });
    res.json({ success: true, category: created });
  } catch (error: any) {
    console.error('Admin specialist category create error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка создания категории' });
  }
});

router.put('/api/specialist-categories/:id', requireAdmin, async (req, res) => {
  try {
    const { name, sortOrder, isActive } = req.body || {};
    const updated = await prisma.specialistCategory.update({
      where: { id: req.params.id },
      data: {
        ...(name != null ? { name: String(name).trim() } : {}),
        ...(sortOrder != null ? { sortOrder: Number(sortOrder || 0) } : {}),
        ...(isActive != null ? { isActive: Boolean(isActive) } : {})
      }
    });
    res.json({ success: true, category: updated });
  } catch (error: any) {
    console.error('Admin specialist category update error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка обновления категории' });
  }
});

router.delete('/api/specialist-categories/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.specialistCategory.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Admin specialist category delete error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка удаления категории' });
  }
});

router.get('/api/specialist-specialties', requireAdmin, async (req, res) => {
  try {
    const categoryId = String(req.query?.categoryId || '').trim();
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    const specialties = await prisma.specialistSpecialty.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    res.json({ success: true, specialties });
  } catch (error: any) {
    console.error('Admin specialist specialties list error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка загрузки специальностей' });
  }
});

router.post('/api/specialist-specialties', requireAdmin, async (req, res) => {
  try {
    const { categoryId, name, sortOrder, isActive } = req.body || {};
    if (!categoryId) return res.status(400).json({ success: false, error: 'categoryId обязателен' });
    if (!name) return res.status(400).json({ success: false, error: 'name обязателен' });
    const created = await prisma.specialistSpecialty.create({
      data: {
        categoryId: String(categoryId),
        name: String(name).trim(),
        sortOrder: Number(sortOrder || 0),
        isActive: typeof isActive === 'boolean' ? isActive : true
      }
    });
    res.json({ success: true, specialty: created });
  } catch (error: any) {
    console.error('Admin specialist specialty create error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка создания специальности' });
  }
});

router.put('/api/specialist-specialties/:id', requireAdmin, async (req, res) => {
  try {
    const { categoryId, name, sortOrder, isActive } = req.body || {};
    const updated = await prisma.specialistSpecialty.update({
      where: { id: req.params.id },
      data: {
        ...(categoryId != null ? { categoryId: String(categoryId) } : {}),
        ...(name != null ? { name: String(name).trim() } : {}),
        ...(sortOrder != null ? { sortOrder: Number(sortOrder || 0) } : {}),
        ...(isActive != null ? { isActive: Boolean(isActive) } : {})
      }
    });
    res.json({ success: true, specialty: updated });
  } catch (error: any) {
    console.error('Admin specialist specialty update error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка обновления специальности' });
  }
});

router.delete('/api/specialist-specialties/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.specialistSpecialty.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Admin specialist specialty delete error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка удаления специальности' });
  }
});

router.get('/api/specialists', requireAdmin, async (_req, res) => {
  try {
    const specialists = await prisma.specialist.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: { category: true, specialtyRef: true }
    });
    res.json({ success: true, specialists });
  } catch (error: any) {
    console.error('Admin specialists list error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка загрузки' });
  }
});

router.get('/api/specialists/:id', requireAdmin, async (req, res) => {
  try {
    const specialist = await prisma.specialist.findUnique({
      where: { id: req.params.id },
      include: { services: { where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } }
    });
    if (!specialist) return res.status(404).json({ success: false, error: 'Не найден' });
    res.json({ success: true, specialist });
  } catch (error: any) {
    console.error('Admin specialist get error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка загрузки' });
  }
});

router.post('/api/specialists', requireAdmin, async (req, res) => {
  try {
    const { name, categoryId, specialtyId, photoUrl, profile, about, messengerUrl, isActive, sortOrder, services } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'name обязателен' });
    if (!categoryId) return res.status(400).json({ success: false, error: 'categoryId обязателен' });
    if (!specialtyId) return res.status(400).json({ success: false, error: 'specialtyId обязателен' });

    const specialty = await prisma.specialistSpecialty.findUnique({ where: { id: String(specialtyId) } });
    if (!specialty) return res.status(400).json({ success: false, error: 'Специальность не найдена' });

    const created = await prisma.specialist.create({
      data: {
        name: String(name).trim(),
        specialty: String(specialty.name).trim(), // legacy mirror
        categoryId: String(categoryId),
        specialtyId: String(specialtyId),
        photoUrl: photoUrl ? String(photoUrl).trim() : null,
        profile: profile ? String(profile).trim() : null,
        about: about ? String(about).trim() : null,
        messengerUrl: messengerUrl ? String(messengerUrl).trim() : null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        sortOrder: Number(sortOrder || 0)
      }
    });

    const svc = Array.isArray(services) ? services : [];
    for (const [idx, s] of svc.entries()) {
      const title = String(s?.title || '').trim();
      const priceRub = Number(s?.priceRub || 0);
      if (!title) continue;
      await prisma.specialistService.create({
        data: {
          specialistId: created.id,
          title,
          description: s?.description ? String(s.description) : null,
          format: s?.format ? String(s.format) : null,
          durationMin: s?.durationMin != null ? Number(s.durationMin) : null,
          detailsUrl: s?.detailsUrl ? String(s.detailsUrl) : null,
          priceRub: Math.max(0, Math.round(priceRub)),
          sortOrder: Number(s?.sortOrder ?? idx) || idx,
          isActive: true
        }
      });
    }

    res.json({ success: true, specialist: created });
  } catch (error: any) {
    console.error('Admin specialist create error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка создания', details: error?.code || error?.name });
  }
});

router.put('/api/specialists/:id', requireAdmin, async (req, res) => {
  try {
    const { name, categoryId, specialtyId, photoUrl, profile, about, messengerUrl, isActive, sortOrder, services } = req.body || {};

    let legacySpecialty = undefined as any;
    if (specialtyId) {
      const sp = await prisma.specialistSpecialty.findUnique({ where: { id: String(specialtyId) } });
      legacySpecialty = sp ? String(sp.name).trim() : undefined;
    }

    const updated = await prisma.specialist.update({
      where: { id: req.params.id },
      data: {
        ...(name != null ? { name: String(name).trim() } : {}),
        ...(categoryId != null ? { categoryId: String(categoryId) } : {}),
        ...(specialtyId != null ? { specialtyId: String(specialtyId) } : {}),
        ...(legacySpecialty ? { specialty: legacySpecialty } : {}),
        ...(photoUrl !== undefined ? { photoUrl: photoUrl ? String(photoUrl).trim() : null } : {}),
        ...(profile !== undefined ? { profile: profile ? String(profile).trim() : null } : {}),
        ...(about !== undefined ? { about: about ? String(about).trim() : null } : {}),
        ...(messengerUrl !== undefined ? { messengerUrl: messengerUrl ? String(messengerUrl).trim() : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder || 0) } : {})
      }
    });

    // replace services (non-transactional)
    await prisma.specialistService.deleteMany({ where: { specialistId: updated.id } });
    const svc = Array.isArray(services) ? services : [];
    for (const [idx, s] of svc.entries()) {
      const title = String(s?.title || '').trim();
      const priceRub = Number(s?.priceRub || 0);
      if (!title) continue;
      await prisma.specialistService.create({
        data: {
          specialistId: updated.id,
          title,
          description: s?.description ? String(s.description) : null,
          format: s?.format ? String(s.format) : null,
          durationMin: s?.durationMin != null ? Number(s.durationMin) : null,
          detailsUrl: s?.detailsUrl ? String(s.detailsUrl) : null,
          priceRub: Math.max(0, Math.round(priceRub)),
          sortOrder: Number(s?.sortOrder ?? idx) || idx,
          isActive: true
        }
      });
    }

    res.json({ success: true, specialist: updated });
  } catch (error: any) {
    console.error('Admin specialist update error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка обновления' });
  }
});

// Upload specialist photo (file -> Cloudinary -> specialist.photoUrl)
router.post('/api/specialists/:id/upload-photo', requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, error: 'id обязателен' });

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не передан (photo)' });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ success: false, error: 'Cloudinary не настроен' });
    }

    const exists = await prisma.specialist.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ success: false, error: 'Специалист не найден' });

    const result = await uploadImage(req.file.buffer, {
      folder: 'vital/specialists',
      publicId: `specialist-${id}`,
      resourceType: 'image'
    });

    const updated = await prisma.specialist.update({
      where: { id },
      data: { photoUrl: result.secureUrl }
    });

    res.json({ success: true, photoUrl: result.secureUrl, specialist: updated });
  } catch (error: any) {
    console.error('Admin specialist photo upload error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка загрузки фото' });
  }
});

router.delete('/api/specialists/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.specialist.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Admin specialist delete error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Ошибка удаления' });
  }
});

// ------------------------------------------------------------------
// Regions Management
// ------------------------------------------------------------------

router.get('/regions', requireAdmin, async (req, res) => {
  try {
    const regions = await prisma.region.findMany({
      orderBy: { sortOrder: 'asc' }
    });

    const error = req.query.error;
    const success = req.query.success;

    let messageHtml = '';
    if (error) {
      const messages: Record<string, string> = {
        create_failed: 'Ошибка создания региона',
        delete_failed: 'Ошибка удаления региона',
        update_failed: 'Ошибка обновления региона',
        not_found: 'Регион не найден',
        default_region: 'Нельзя удалить регион по умолчанию'
      };
      messageHtml = `<div style="padding: 15px; margin-bottom: 20px; border-radius: 8px; background: #fee2e2; color: #991b1b;">${messages[String(error)] || 'Произошла ошибка'}</div>`;
    }
    if (success) {
      const messages: Record<string, string> = {
        created: 'Регион успешно создан',
        deleted: 'Регион успешно удален',
        updated: 'Регион успешно обновлен',
      };
      messageHtml = `<div style="padding: 15px; margin-bottom: 20px; border-radius: 8px; background: #dcfce7; color: #166534;">${messages[String(success)] || 'Успешно'}</div>`;
    }

    res.send(`
      ${renderAdminShellStart({ title: 'Управление регионами', activePath: '/admin/regions' })}
        
        <div class="section-header">
           <h2 class="section-title">🌍 Регионы</h2>
        </div>

        ${messageHtml}

        <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 30px;">
           <h3 style="margin-top: 0; margin-bottom: 20px;">Добавить новый регион</h3>
           <form action="/admin/regions" method="post" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; align-items: end;">
              <div class="form-group" style="margin-bottom: 0;">
                 <label style="display: block; margin-bottom: 6px; font-weight: 500;">Код (например: TURKEY)</label>
                 <input type="text" name="code" required placeholder="UPPERCASE_CODE" style="width: 100%; padding: 10px;">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                 <label style="display: block; margin-bottom: 6px; font-weight: 500;">Название (например: Турция)</label>
                 <input type="text" name="name" required style="width: 100%; padding: 10px;">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                 <label style="display: block; margin-bottom: 6px; font-weight: 500;">Валюта (например: TRY)</label>
                 <input type="text" name="currency" required value="RUB" style="width: 100%; padding: 10px;">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                 <label style="display: block; margin-bottom: 6px; font-weight: 500;">Сортировка</label>
                 <input type="number" name="sortOrder" value="0" style="width: 100%; padding: 10px;">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                 <button type="submit" class="btn btn-success" style="width: 100%; height: 42px;">Добавить</button>
              </div>
           </form>
        </div>

        <div style="background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
           <table style="width: 100%; border-collapse: collapse;">
              <thead>
                 <tr style="background: #f8f9fa; text-align: left; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
                    <th style="padding: 15px 20px;">Сорт.</th>
                    <th style="padding: 15px 20px;">Код</th>
                    <th style="padding: 15px 20px;">Название</th>
                    <th style="padding: 15px 20px;">Валюта</th>
                    <th style="padding: 15px 20px;">Статус</th>
                    <th style="padding: 15px 20px;">Действия</th>
                 </tr>
              </thead>
              <tbody>
                 ${regions.map(region => `
                    <tr style="border-top: 1px solid #e5e7eb;">
                       <td style="padding: 15px 20px;">${region.sortOrder}</td>
                       <td style="padding: 15px 20px; font-family: monospace; font-weight: 600;">${region.code}</td>
                       <td style="padding: 15px 20px; font-weight: 500;">${region.name}</td>
                       <td style="padding: 15px 20px;">${region.currency}</td>
                       <td style="padding: 15px 20px;">
                          <span style="display: inline-block; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; ${region.isActive ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;'}">
                             ${region.isActive ? 'Активен' : 'Скрыт'}
                          </span>
                       </td>
                       <td style="padding: 15px 20px;">
                          <div style="display: flex; gap: 8px;">
                             <form action="/admin/regions/${region.id}/toggle-active" method="post" style="margin: 0;">
                                <button type="submit" class="action-btn" title="${region.isActive ? 'Скрыть' : 'Показать'}">
                                   ${region.isActive ? '👁️' : '🙈'}
                                </button>
                             </form>
                             ${!region.isDefault ? `
                             <form action="/admin/regions/${region.id}/delete" method="post" style="margin: 0;" onsubmit="return confirm('Вы уверены, что хотите удалить этот регион?');">
                                <button type="submit" class="action-btn" style="color: #dc2626; border-color: #fee2e2; background: #fef2f2;" title="Удалить">
                                   🗑️
                                </button>
                             </form>
                             ` : '<span style="font-size: 11px; color: #9ca3af; padding: 6px;">DEFAULT</span>'}
                          </div>
                       </td>
                    </tr>
                 `).join('')}
              </tbody>
           </table>
        </div>
        
    </main></div></div></body></html>
    `);
  } catch (error) {
    console.error('Error rendering regions page:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/regions', requireAdmin, async (req, res) => {
  try {
    const { code, name, currency, sortOrder } = req.body;
    await prisma.region.create({
      data: {
        code: String(code).toUpperCase().trim(),
        name: String(name).trim(),
        currency: String(currency).toUpperCase().trim(),
        sortOrder: Number(sortOrder) || 0,
        isActive: true
      }
    });
    res.redirect('/admin/regions?success=created');
  } catch (error) {
    console.error('Error creating region:', error);
    res.redirect('/admin/regions?error=create_failed');
  }
});

router.post('/regions/:id/toggle-active', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const region = await prisma.region.findUnique({ where: { id } });
    if (!region) return res.redirect('/admin/regions?error=not_found');

    await prisma.region.update({
      where: { id },
      data: { isActive: !region.isActive }
    });
    res.redirect('/admin/regions?success=updated');
  } catch (error) {
    console.error('Error toggling region:', error);
    res.redirect('/admin/regions?error=update_failed');
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const buildMarker = String(process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT || '').slice(0, 8) || 'local';

    // Fetch all completed orders for stats
    const orders = await prisma.orderRequest.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate basic stats
    const totalOrders = orders.length;
    let totalRevenue = 0;

    // Stats by day (last 30 days)
    const salesByDay: Record<string, number> = {};
    const today = new Date().toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Product stats
    const productStats: Record<string, { quantity: number, revenue: number }> = {};

    for (const order of orders) {
      // Parse items
      const items = typeof order.itemsJson === 'string'
        ? JSON.parse(order.itemsJson || '[]')
        : (order.itemsJson || []);

      const orderItems = Array.isArray(items) ? items : (items.items || []);
      const orderTotal = Array.isArray(items)
        ? items.reduce((sum: number, i: any) => sum + (i.price || 0) * (i.quantity || 1), 0)
        : (items.total || 0);

      totalRevenue += orderTotal;

      // By Day
      const date = order.createdAt.toISOString().slice(0, 10);
      if (new Date(date) >= thirtyDaysAgo) {
        salesByDay[date] = (salesByDay[date] || 0) + orderTotal;
      }

      // Products
      for (const item of orderItems) {
        const name = item.productTitle || item.productName || 'Unknown';
        if (!productStats[name]) productStats[name] = { quantity: 0, revenue: 0 };
        productStats[name].quantity += (item.quantity || 0);
        productStats[name].revenue += (item.price || 0) * (item.quantity || 1);
      }
    }

    const revenueToday = salesByDay[today] || 0;

    // Sort products by revenue
    const topProducts = Object.entries(productStats)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Prepare chart data (last 30 days filled)
    const chartLabels: string[] = [];
    const chartData: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      chartLabels.push(dateStr.slice(5)); // MM-DD
      chartData.push(salesByDay[dateStr] || 0);
    }

    res.send(`
      ${renderAdminShellStart({ title: 'Статистика продаж', activePath: '/admin/stats', buildMarker })}
        
        <div class="section-header">
           <h2 class="section-title">📊 Статистика продаж</h2>
        </div>

        <div class="stats-bar" style="margin-bottom: 30px;">
          <div class="stat-item">
            <div class="stat-number" style="color: #28a745;">${totalRevenue.toLocaleString('ru-RU')} ₽</div>
            <div class="stat-label">Выручка (всего)</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${revenueToday.toLocaleString('ru-RU')} ₽</div>
            <div class="stat-label">Выручка (сегодня)</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${totalOrders}</div>
            <div class="stat-label">Заказов выполнено</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${(totalRevenue / (totalOrders || 1)).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</div>
            <div class="stat-label">Средний чек</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
          
          <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="margin-top:0;">Продажи за 30 дней</h3>
            <div style="height: 200px; display: flex; align-items: flex-end; gap: 10px; padding-top: 20px;">
              ${chartData.map((val, idx) => {
      const max = Math.max(...chartData, 1);
      const height = (val / max) * 100;
      return `
                  <div style="flex: 1; display: flex; flex-direction: column; align-items: center; group;">
                    <div style="width: 100%; background: #e9ecef; border-radius: 4px; position: relative; height: 100%;">
                      <div style="position: absolute; bottom: 0; width: 100%; background: #007bff; height: ${height}%; border-radius: 4px; transition: height 0.3s;" title="${chartLabels[idx]}: ${val} ₽"></div>
                    </div>
                    <div style="font-size: 10px; color: #6c757d; margin-top: 5px; transform: rotate(-45deg); white-space: nowrap;">${chartLabels[idx]}</div>
                  </div>
                `;
    }).join('')}
            </div>
          </div>

          <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <h3 style="margin-top:0;">Топ товаров</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${topProducts.map((p, i) => `
                <tr style="border-bottom: 1px solid #f1f3f4;">
                  <td style="padding: 10px 0; width: 20px; color: #adb5bd; font-size: 12px;">${i + 1}</td>
                  <td style="padding: 10px 0; font-size: 14px;">
                    <div>${escapeHtml(p.name)}</div>
                    <div style="font-size: 11px; color: #6c757d;">${p.quantity} шт.</div>
                  </td>
                  <td style="padding: 10px 0; text-align: right; font-weight: 600;">${p.revenue.toLocaleString('ru-RU')} ₽</td>
                </tr>
              `).join('')}
            </table>
          </div>

        </div>
        
    </main></div></div></body></html>
    `);
  } catch (error) {
    console.error('Stats page error:', error);
    res.status(500).send('Ошибка загрузки статистики');
  }
});
router.post('/regions/:id/delete', requireAdmin, async (req, res) => {
  try {
    const p: any = prisma;
    const { id } = req.params;
    const region = await p.region.findUnique({ where: { id } });
    if (!region) return res.redirect('/admin/regions?error=not_found');
    if (region.isDefault) return res.redirect('/admin/regions?error=default_region');

    await p.region.delete({ where: { id } });
    res.redirect('/admin/regions?success=deleted');
  } catch (error) {
    console.error('Error deleting region:', error);
    res.redirect('/admin/regions?error=delete_failed');
  }
});

// Broadcasts
router.use('/broadcasts', broadcastRouter);

// ===== Backup API =====
import { createBackup, listBackups, cleanupOldBackups } from '../services/backup-service.js';

// Manual backup trigger
router.post('/api/backups/create', requireAdmin, async (req, res) => {
  try {
    const result = await createBackup();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List backups
router.get('/api/backups', requireAdmin, async (req, res) => {
  try {
    const backups = await listBackups();
    res.json(backups);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old backups (keep last 7)
router.post('/api/backups/cleanup', requireAdmin, async (req, res) => {
  try {
    const deleted = await cleanupOldBackups(7);
    res.json({ deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


export { router as adminWebRouter };

