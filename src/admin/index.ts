import { Router, Application } from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import * as AdminJSPrisma from '@adminjs/prisma';
import type { ActionRequest } from 'adminjs';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

AdminJS.registerAdapter({
  Resource: AdminJSPrisma.Resource,
  Database: AdminJSPrisma.Database,
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function setupAdminPanel(app: Application) {
  const admin = new AdminJS({
    rootPath: '/admin',
    branding: {
      companyName: 'Plazma',
    },
    assets: {
      styles: [
        '/admin/assets/styles.css'
      ],
      scripts: [
        '/admin/assets/no-redirect.js',
        '/admin/assets/ultra-blocker.js',
        '/admin/assets/scripts.js'
      ]
    },
    dashboard: {
      component: 'Dashboard'
    },
    pages: {
      dashboard: {
        component: 'Dashboard'
      }
    },
    settings: {
      defaultPerPage: 10,
    },
    resources: [
      {
        resource: { model: prisma.category, client: prisma },
        options: {
          properties: {
            slug: {
              isVisible: {
                list: true,
                edit: false,
                show: true,
                filter: true,
              },
            },
          },
          actions: {
            new: {
              before: async (request: ActionRequest) => {
                const payload = request.payload ?? {};
                if (payload.name && !payload.slug) {
                  return {
                    ...request,
                    payload: {
                      ...payload,
                      slug: slugify(String(payload.name)),
                    },
                  };
                }
                return request;
              },
            },
            edit: {
              before: async (request: ActionRequest) => {
                const payload = request.payload ?? {};
                if (payload.name) {
                  return {
                    ...request,
                    payload: {
                      ...payload,
                      slug: slugify(String(payload.name)),
                    },
                  };
                }
                return request;
              },
            },
          },
        },
      },
      {
        resource: { model: prisma.product, client: prisma },
        options: {
          navigation: {
            name: 'Товары',
            icon: 'Package',
          },
          listProperties: ['title', 'categoryId', 'price', 'isActive'],
          showProperties: ['title', 'summary', 'description', 'instruction', 'imageUrl', 'price', 'stock', 'isActive', 'availableInRussia', 'availableInBali', 'categoryId', 'createdAt', 'updatedAt'],
          editProperties: ['title', 'summary', 'description', 'instruction', 'imageUrl', 'price', 'stock', 'isActive', 'availableInRussia', 'availableInBali', 'categoryId'],
          filterProperties: ['title', 'isActive', 'availableInRussia', 'availableInBali'],
          sort: {
            sortBy: 'title',
            direction: 'asc',
          },
          properties: {
            title: {
              isTitle: true,
            },
            description: {
              type: 'richtext',
            },
            instruction: {
              type: 'textarea',
              props: {
                rows: 6,
                placeholder: 'Введите инструкцию по применению товара...',
              },
              isVisible: {
                list: false,
                edit: true,
                show: true,
                filter: false,
              },
              isRequired: false,
              position: 4, // Позиция после description
              label: '📋 Инструкция по применению',
              isSortable: false,
              isArray: false,
            },
            price: {
              type: 'number',
            },
            isActive: {
              type: 'boolean',
              isVisible: {
                list: true,
                edit: true,
                show: true,
                filter: true,
              },
            },
            availableInRussia: {
              type: 'boolean',
              isVisible: {
                list: true,
                edit: true,
                show: true,
                filter: true,
              },
            },
            availableInBali: {
              type: 'boolean',
              isVisible: {
                list: true,
                edit: true,
                show: true,
                filter: true,
              },
            },
          },
          actions: {
            list: {
              isAccessible: true,
              isVisible: true,
            },
            show: {
              isAccessible: true,
              isVisible: true,
            },
            edit: {
              isAccessible: true,
              isVisible: true,
            },
            delete: {
              isAccessible: true,
              isVisible: true,
            },
            new: {
              isAccessible: true,
              isVisible: true,
            },
            instruction: {
              isAccessible: true,
              isVisible: true,
              component: false,
              handler: async (request: any, response: any, context: any) => {
                const { record } = context;
                const product = await prisma.product.findUnique({
                  where: { id: record.params.id }
                });

                if (product && product.instruction) {
                  return response.send(`
                    <!DOCTYPE html>
                    <html lang="ru">
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <title>Инструкция - ${product.title}</title>
                      <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
                        .back-btn { background: rgba(255,255,255,0.2); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); transition: all 0.3s ease; display: inline-block; margin-top: 15px; }
                        .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
                        .content { padding: 30px; }
                        .instruction-text { color: #333; line-height: 1.6; font-size: 14px; white-space: pre-wrap; }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <div class="header">
                          <h1>📋 Инструкция по применению</h1>
                          <p>${product.title}</p>
                          <a href="/admin/resources/products" class="back-btn">← Назад к товарам</a>
                        </div>
                        <div class="content">
                          <div class="instruction-text">${product.instruction}</div>
                        </div>
                      </div>
                    </body>
                    </html>
                  `);
                } else {
                  return response.send(`
                    <!DOCTYPE html>
                    <html lang="ru">
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <title>Инструкция не найдена</title>
                      <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
                        .back-btn { background: rgba(255,255,255,0.2); color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; border: 1px solid rgba(255,255,255,0.3); transition: all 0.3s ease; display: inline-block; margin-top: 15px; }
                        .back-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
                        .content { padding: 30px; text-align: center; }
                        .empty-state { color: #666; font-size: 16px; }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <div class="header">
                          <h1>📋 Инструкция не найдена</h1>
                          <p>${product?.title || 'Неизвестный товар'}</p>
                          <a href="/admin/resources/products" class="back-btn">← Назад к товарам</a>
                        </div>
                        <div class="content">
                          <div class="empty-state">
                            <h3>Инструкция не добавлена</h3>
                            <p>Для этого товара еще не добавлена инструкция по применению.</p>
                            <p>Вы можете добавить инструкцию, отредактировав товар.</p>
                          </div>
                        </div>
                      </div>
                    </body>
                    </html>
                  `);
                }
              }
            },
          },
        },
      },
      {
        resource: { model: prisma.review, client: prisma },
        options: {
          navigation: {
            name: 'Отзывы',
            icon: 'Star',
          },
          listProperties: ['name', 'isActive', 'isPinned', 'createdAt'],
          showProperties: ['name', 'photoUrl', 'content', 'link', 'isPinned', 'isActive', 'createdAt', 'updatedAt'],
          editProperties: ['name', 'photoUrl', 'content', 'link', 'isPinned', 'isActive'],
          filterProperties: ['name', 'isActive', 'isPinned'],
          sort: {
            sortBy: 'createdAt',
            direction: 'desc',
          },
          properties: {
            name: {
              isTitle: true,
            },
          },
        },
      },
      {
        resource: { model: prisma.partnerProfile, client: prisma },
        options: {
          navigation: {
            name: 'Партнёры',
            icon: 'Star',
          },
          listProperties: ['userId', 'programType', 'isActive', 'isSuperPartner', 'balance', 'expiresAt'],
          showProperties: ['userId', 'programType', 'isActive', 'isSuperPartner', 'balance', 'bonus', 'expiresAt', 'activatedAt', 'activationType', 'createdAt'],
          editProperties: ['isActive', 'isSuperPartner', 'expiresAt', 'activationType', 'balance'],
          filterProperties: ['isActive', 'isSuperPartner', 'programType'],
          properties: {
            isSuperPartner: {
              type: 'boolean',
              label: '⭐ Супер партнёр (15% + 10% уровень 2)',
              isVisible: {
                list: true, edit: true, show: true, filter: true,
              },
            },
            isActive: {
              type: 'boolean',
              label: 'Активен',
              isVisible: {
                list: true, edit: true, show: true, filter: true,
              },
            },
          },
        },
      },
      {
        resource: { model: prisma.partnerTransaction, client: prisma },
        options: {
          listProperties: ['profileId', 'amount', 'type', 'createdAt'],
        },
      },
      {
        resource: { model: prisma.user, client: prisma },
        options: {
          navigation: {
            name: 'Пользователи',
            icon: 'User',
          },
          listProperties: ['telegramId', 'firstName', 'username', 'phone', 'deliveryAddress', 'createdAt'],
          showProperties: ['telegramId', 'firstName', 'lastName', 'username', 'phone', 'deliveryAddress', 'balance', 'selectedRegion', 'createdAt', 'updatedAt'],
          editProperties: ['firstName', 'lastName', 'username', 'phone', 'deliveryAddress', 'balance', 'selectedRegion'],
          filterProperties: ['telegramId', 'firstName', 'username', 'phone'],
          sort: {
            sortBy: 'createdAt',
            direction: 'desc',
          },
          actions: {
            list: {
              isAccessible: true,
              isVisible: true,
            },
            show: {
              isAccessible: false,
              isVisible: false,
            },
            edit: {
              isAccessible: true,
              isVisible: true,
            },
            delete: {
              isAccessible: true,
              isVisible: true,
            },
            new: {
              isAccessible: true,
              isVisible: true,
            },
          },
          properties: {
            telegramId: {
              isTitle: true, // Делаем telegramId заголовком
            },
            phone: {
              isVisible: {
                list: true,
                edit: true,
                show: true,
                filter: true,
              },
            },
            deliveryAddress: {
              isVisible: {
                list: true,
                edit: true,
                show: true,
                filter: true,
              },
            },
          },
        },
      },
      {
        resource: { model: prisma.userHistory, client: prisma },
        options: {
          listProperties: ['userId', 'action', 'createdAt'],
        },
      },
      {
        resource: { model: prisma.orderRequest, client: prisma },
        options: {
          navigation: {
            name: 'Заказы',
            icon: 'ShoppingCart',
          },
          listProperties: ['id', 'userId', 'status', 'contact', 'createdAt'],
          showProperties: ['id', 'userId', 'status', 'contact', 'message', 'itemsJson', 'createdAt'],
          editProperties: ['status', 'contact', 'message'],
          filterProperties: ['status', 'contact'],
          sort: {
            sortBy: 'createdAt',
            direction: 'desc',
          },
          properties: {
            id: {
              isTitle: true, // Делаем id заголовком
            },
            itemsJson: {
              type: 'textarea',
              isVisible: {
                list: false,
                edit: true,
                show: true,
                filter: false,
              },
              props: {
                rows: 4,
              },
            },
            message: {
              type: 'textarea',
              isVisible: {
                list: false,
                edit: true,
                show: true,
                filter: false,
              },
              props: {
                rows: 3,
              },
            },
          },
        },
      },
      {
        resource: { model: prisma.botContent, client: prisma },
        options: {
          navigation: {
            name: 'Контент бота',
            icon: 'Text',
          },
          listProperties: ['key', 'title', 'category', 'language', 'isActive', 'updatedAt'],
          showProperties: ['key', 'title', 'content', 'description', 'category', 'language', 'isActive', 'createdAt', 'updatedAt'],
          editProperties: ['key', 'title', 'content', 'description', 'category', 'language', 'isActive'],
          filterProperties: ['key', 'title', 'category', 'language', 'isActive'],
          sort: {
            sortBy: 'updatedAt',
            direction: 'desc',
          },
          actions: {
            list: {
              isAccessible: true,
              isVisible: true,
            },
            show: {
              isAccessible: false,
              isVisible: false,
            },
            edit: {
              isAccessible: true,
              isVisible: true,
            },
            delete: {
              isAccessible: true,
              isVisible: true,
            },
            new: {
              isAccessible: true,
              isVisible: true,
            },
          },
          parent: {
            name: 'Контент бота',
            icon: 'Text',
          },
          properties: {
            key: {
              isVisible: {
                list: true, edit: true, show: true, filter: true,
              },
              isTitle: true, // Делаем key заголовком для лучшей навигации
            },
            title: {
              isVisible: {
                list: true, edit: true, show: true, filter: true,
              },
            },
            content: {
              type: 'textarea',
              isVisible: {
                list: false, edit: true, show: true, filter: false,
              },
              props: {
                rows: 8,
              },
            },
            description: {
              type: 'textarea',
              isVisible: {
                list: false, edit: true, show: true, filter: false,
              },
              props: {
                rows: 3,
              },
            },
            category: {
              isVisible: {
                list: true, edit: true, show: true, filter: true,
              },
              availableValues: [
                { value: 'messages', label: 'Сообщения' },
                { value: 'descriptions', label: 'Описания' },
                { value: 'buttons', label: 'Кнопки' },
              ],
            },
            language: {
              isVisible: {
                list: true, edit: true, show: true, filter: true,
              },
              availableValues: [
                { value: 'ru', label: 'Русский' },
                { value: 'en', label: 'English' },
              ],
            },
            isActive: {
              isVisible: {
                list: true, edit: true, show: true, filter: true,
              },
            },
            createdAt: {
              isVisible: {
                list: false, edit: false, show: true, filter: false,
              },
            },
            updatedAt: {
              isVisible: {
                list: true, edit: false, show: true, filter: false,
              },
            },
          },
        },
      },
    ],
  });

  const router = Router();
  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email, password) => {
        if (email === env.adminEmail && password === env.adminPassword) {
          return { email };
        }
        return null;
      },
      cookiePassword: env.botWebhookSecret ?? env.adminPassword,
    },
    null,
    {
      secret: env.botWebhookSecret ?? env.adminPassword,
      resave: false,
      saveUninitialized: false,
    },
  );

  // ПОЛНОЕ ОТКЛЮЧЕНИЕ редиректа - просто блокируем без редиректа
  adminRouter.use((req, res, next) => {
    console.log('🚫 AdminJS Request:', req.method, req.path, req.query);

    // Блокируем ВСЕ переходы на детальные страницы - БЕЗ РЕДИРЕКТА
    if (req.path.includes('/show/') ||
      req.path.includes('/edit/') ||
      req.path.includes('/users-detailed') ||
      req.path.includes('/detailed') ||
      req.path.includes('/show') ||
      req.path.includes('/edit')) {
      console.log('🚫 BLOCKED DETAIL PAGE:', req.path);
      return res.status(404).send('Detail pages disabled');
    }

    // Специальная блокировка для users-detailed с параметрами - ОТКЛЮЧЕНА
    // if (req.path === '/users-detailed' || req.path.includes('users-detailed')) {
    //   console.log('🚫 BLOCKED USERS-DETAILED:', req.path, req.query);
    //   return res.status(404).send('Users detailed page disabled');
    // }

    // Блокируем все запросы с параметрами сортировки к users-detailed - ОТКЛЮЧЕНА
    // if (req.path.includes('users-detailed') && (req.query.sort || req.query.order)) {
    //   console.log('🚫 BLOCKED USERS-DETAILED SORT:', req.path, req.query);
    //   return res.status(404).send('Users detailed page disabled');
    // }

    // Блокируем все запросы с параметрами сортировки - БЕЗ РЕДИРЕКТА - ОТКЛЮЧЕНА
    // if (req.query.sort || req.query.order) {
    //   console.log('🚫 BLOCKED SORT REQUEST:', req.path, req.query);
    //   return res.status(404).send('Sort requests disabled');
    // }

    // Блокируем все запросы к детальным страницам пользователей - БЕЗ РЕДИРЕКТА
    if (req.path.includes('users') && (req.path.includes('show') || req.path.includes('edit'))) {
      console.log('🚫 BLOCKED USER DETAIL:', req.path);
      return res.status(404).send('User detail pages disabled');
    }

    // Блокируем все AJAX запросы к детальным страницам
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' &&
      (req.path.includes('/show/') || req.path.includes('/edit/'))) {
      console.log('🚫 BLOCKED AJAX DETAIL:', req.path);
      return res.status(403).json({ error: 'Detail pages disabled' });
    }

    next();
  });

  router.use(admin.options.rootPath, adminRouter);
  app.use(router);
}
