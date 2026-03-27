/**
 * Controller Interfaces
 * Интерфейсы для всех контроллеров
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/admin.js';
import { UserApiResponse, UserWithStats, OrderApiResponse, PartnerApiResponse, ProductApiResponse, CategoryApiResponse, ReviewApiResponse, AudioFileApiResponse } from '../types/api.js';

// Базовый интерфейс для всех контроллеров
export interface BaseController {
  // Стандартные CRUD операции
  index(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  show(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер аутентификации
export interface AuthController {
  loginPage(req: Request, res: Response, next: NextFunction): Promise<void>;
  login(req: Request, res: Response, next: NextFunction): Promise<void>;
  logout(req: Request, res: Response, next: NextFunction): Promise<void>;
  checkAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер пользователей
export interface UserController extends BaseController {
  dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  detailed(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  search(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  showDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  getPartners(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  changeInviter(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  exportUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер заказов
export interface OrderController extends BaseController {
  pending(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  completed(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  cancelled(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  showDetails(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  exportOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер партнеров
export interface PartnerController extends BaseController {
  hierarchy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  activate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  deactivate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  recalculateBonuses(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  exportPartners(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер товаров
export interface ProductController extends BaseController {
  byCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  toggleActive(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  uploadImage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  exportProducts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер категорий
export interface CategoryController extends BaseController {
  toggleActive(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  exportCategories(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер отзывов
export interface ReviewController extends BaseController {
  pending(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  approve(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  reject(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  exportReviews(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер аудио
export interface AudioController extends BaseController {
  byCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  toggleActive(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  uploadAudio(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  exportAudio(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер сообщений
export interface MessageController {
  send(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  templates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  saveTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  deleteTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер статистики
export interface StatsController {
  dashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  users(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  partners(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  orders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  revenue(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  export(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер настроек
export interface SettingsController {
  index(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  reset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер файлов
export interface FileController {
  upload(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  download(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Контроллер логов
export interface LogController {
  index(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  show(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  export(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
  clear(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}

// Базовые типы для ответов контроллеров
export interface ControllerResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  redirect?: string;
}

// Типы для пагинации в контроллерах
export interface PaginatedControllerResponse<T> extends ControllerResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Типы для поиска в контроллерах
export interface SearchControllerResponse<T> extends ControllerResponse<T[]> {
  query: string;
  filters: Record<string, any>;
  total: number;
}

// Типы для экспорта в контроллерах
export interface ExportControllerResponse {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  error?: string;
}

// Типы для загрузки файлов в контроллерах
export interface UploadControllerResponse {
  success: boolean;
  file?: {
    id: string;
    filename: string;
    url: string;
    size: number;
  };
  error?: string;
}

// Базовый класс для всех контроллеров
export abstract class BaseControllerClass {
  protected handleError(error: Error, req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    console.error(`Controller Error [${req.method} ${req.path}]:`, error);
    
    if (req.accepts('json')) {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    } else {
      res.status(500).render('error', {
        error: {
          message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });
    }
  }

  protected handleSuccess(data: any, req: AuthenticatedRequest, res: Response, message?: string): void {
    if (req.accepts('json')) {
      res.json({
        success: true,
        data,
        message
      });
    } else {
      res.render('success', { data, message });
    }
  }

  protected handleValidationError(errors: any[], req: AuthenticatedRequest, res: Response): void {
    if (req.accepts('json')) {
      res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: errors
      });
    } else {
      res.status(400).render('validation-error', { errors });
    }
  }
}
