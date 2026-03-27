/**
 * Refactored Admin Panel
 * Новая архитектура админ-панели с разделением ответственности
 */

import express from 'express';
import session from 'express-session';
import { prisma } from '../lib/prisma.js';
import { RepositoryFactory } from '../repositories/index.js';
import { AdminControllerFactory } from '../controllers/admin/index.js';

const router = express.Router();

// Инициализация фабрик
RepositoryFactory.initialize(prisma);

// Middleware для проверки админского доступа
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const session = req.session as any;
  if (!session.isAdmin) {
    return res.redirect('/admin/login');
  }
  next();
};

// Получение контроллеров
const authController = AdminControllerFactory.getAuthController();
const userController = AdminControllerFactory.getUserController();

// Маршруты аутентификации
router.get('/login', (req, res, next) => authController.loginPage(req, res, next));
router.post('/login', (req, res, next) => authController.login(req, res, next));
router.get('/logout', (req, res, next) => authController.logout(req, res, next));

// Главная страница админ-панели
router.get('/', requireAdmin, (req, res, next) => userController.dashboard(req, res, next));

// Маршруты пользователей
router.get('/users-detailed', requireAdmin, (req, res, next) => userController.detailed(req, res, next));
router.get('/users/search', requireAdmin, (req, res, next) => userController.search(req, res, next));
router.get('/users/:userId', requireAdmin, (req, res, next) => userController.showDetails(req, res, next));
router.post('/users/:userId/balance', requireAdmin, (req, res, next) => userController.updateBalance(req, res, next));
router.get('/users/:userId/partners', requireAdmin, (req, res, next) => userController.getPartners(req, res, next));
router.post('/users/:id/change-inviter', requireAdmin, (req, res, next) => userController.changeInviter(req, res, next));

// API маршруты
router.get('/api/users', requireAdmin, (req, res, next) => userController.index(req, res, next));
router.get('/api/users/:id', requireAdmin, (req, res, next) => userController.show(req, res, next));
router.post('/api/users', requireAdmin, (req, res, next) => userController.create(req, res, next));
router.put('/api/users/:id', requireAdmin, (req, res, next) => userController.update(req, res, next));
router.delete('/api/users/:id', requireAdmin, (req, res, next) => userController.delete(req, res, next));

export { router as adminRouter };
