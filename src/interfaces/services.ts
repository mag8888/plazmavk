/**
 * Service Interfaces
 * Интерфейсы для всех сервисов приложения
 */

import { UserApiResponse, UserWithStats, OrderApiResponse, PartnerApiResponse, ProductApiResponse, CategoryApiResponse, ReviewApiResponse, AudioFileApiResponse } from '../types/api.js';
import { ValidationResult, SearchOptions, SearchResult, FilterOptions, SortOptions, PaginationOptions } from '../types/admin.js';

// Экспортируем типы для использования в других модулях
export type { UserApiResponse, UserWithStats, OrderApiResponse, PartnerApiResponse, ProductApiResponse, CategoryApiResponse, ReviewApiResponse, AudioFileApiResponse } from '../types/api.js';

// Базовый интерфейс для всех сервисов
export interface BaseService<T> {
  findById(id: string): Promise<T | null>;
  findAll(options?: SearchOptions): Promise<SearchResult<T>>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

// Сервис пользователей
export interface UserService extends BaseService<UserApiResponse> {
  findByTelegramId(telegramId: string): Promise<UserApiResponse | null>;
  findByUsername(username: string): Promise<UserApiResponse | null>;
  getUsersWithStats(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<SearchResult<UserWithStats>>;
  updateBalance(userId: string, amount: number, operation: 'add' | 'subtract'): Promise<UserApiResponse>;
  getReferralChain(userId: string, level: number): Promise<UserApiResponse[]>;
  validateUserData(data: Partial<UserApiResponse>): ValidationResult;
}

// Сервис заказов
export interface OrderService extends BaseService<OrderApiResponse> {
  findByUserId(userId: string): Promise<OrderApiResponse[]>;
  findByStatus(status: string): Promise<OrderApiResponse[]>;
  updateStatus(orderId: string, status: string): Promise<OrderApiResponse>;
  calculateTotal(orderId: string): Promise<number>;
  distributeReferralBonuses(orderId: string): Promise<void>;
  validateOrderData(data: Partial<OrderApiResponse>): ValidationResult;
}

// Сервис партнеров
export interface PartnerService extends BaseService<PartnerApiResponse> {
  findByUserId(userId: string): Promise<PartnerApiResponse | null>;
  findByReferralCode(code: string): Promise<PartnerApiResponse | null>;
  activatePartner(userId: string): Promise<PartnerApiResponse>;
  deactivatePartner(userId: string): Promise<PartnerApiResponse>;
  calculateBonuses(userId: string, orderAmount: number, orderId?: string): Promise<void>;
  getReferralHierarchy(userId: string): Promise<PartnerApiResponse[]>;
  recalculateBonuses(profileId: string): Promise<number>;
  validatePartnerData(data: Partial<PartnerApiResponse>): ValidationResult;
}

// Сервис товаров
export interface ProductService extends BaseService<ProductApiResponse> {
  findByCategory(categoryId: string): Promise<ProductApiResponse[]>;
  findByStatus(isActive: boolean): Promise<ProductApiResponse[]>;
  toggleActive(productId: string): Promise<ProductApiResponse>;
  uploadImage(productId: string, imageFile: Buffer): Promise<string>;
  validateProductData(data: Partial<ProductApiResponse>): ValidationResult;
}

// Сервис категорий
export interface CategoryService extends BaseService<CategoryApiResponse> {
  findBySlug(slug: string): Promise<CategoryApiResponse | null>;
  findByStatus(isActive: boolean): Promise<CategoryApiResponse[]>;
  toggleActive(categoryId: string): Promise<CategoryApiResponse>;
  generateSlug(name: string): Promise<string>;
  validateCategoryData(data: Partial<CategoryApiResponse>): ValidationResult;
}

// Сервис отзывов
export interface ReviewService extends BaseService<ReviewApiResponse> {
  findByUserId(userId: string): Promise<ReviewApiResponse[]>;
  findByStatus(isApproved: boolean): Promise<ReviewApiResponse[]>;
  approveReview(reviewId: string): Promise<ReviewApiResponse>;
  rejectReview(reviewId: string): Promise<ReviewApiResponse>;
  getAverageRating(): Promise<number>;
  validateReviewData(data: Partial<ReviewApiResponse>): ValidationResult;
}

// Сервис аудио
export interface AudioService extends BaseService<AudioFileApiResponse> {
  findByCategory(category: string): Promise<AudioFileApiResponse[]>;
  findByStatus(isActive: boolean): Promise<AudioFileApiResponse[]>;
  toggleActive(audioId: string): Promise<AudioFileApiResponse>;
  uploadAudio(audioId: string, audioFile: Buffer): Promise<string>;
  validateAudioData(data: Partial<AudioFileApiResponse>): ValidationResult;
}

// Сервис уведомлений
export interface NotificationService {
  sendToUser(userId: string, message: string): Promise<boolean>;
  sendToUsers(userIds: string[], message: string): Promise<{ success: number; failed: number }>;
  sendToAdmins(message: string): Promise<boolean>;
  sendTemplate(templateId: string, userIds: string[], variables?: Record<string, any>): Promise<{ success: number; failed: number }>;
  saveTemplate(template: MessageTemplate): Promise<MessageTemplate>;
  getTemplates(): Promise<MessageTemplate[]>;
}

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Сервис статистики
export interface StatsService {
  getDashboardStats(): Promise<DashboardStats>;
  getUserStats(): Promise<UserStats>;
  getPartnerStats(): Promise<PartnerStats>;
  getOrderStats(): Promise<OrderStats>;
  getRevenueStats(dateRange?: { from: Date; to: Date }): Promise<RevenueStats>;
}

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalPartners: number;
  activePartners: number;
  pendingOrders: number;
  completedOrders: number;
}

export interface UserStats {
  totalUsers: number;
  usersWithBalance: number;
  usersWithOrders: number;
  totalBalance: number;
  totalOrderSum: number;
}

export interface PartnerStats {
  totalPartners: number;
  activePartners: number;
  totalReferrals: number;
  totalBonuses: number;
  averageBonusPerPartner: number;
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  totalRevenue: number;
}

export interface RevenueStats {
  totalRevenue: number;
  monthlyRevenue: number;
  dailyRevenue: number;
  revenueByMonth: { month: string; revenue: number }[];
  revenueByDay: { day: string; revenue: number }[];
}

// Сервис файлов
export interface FileService {
  uploadFile(file: Buffer, filename: string, mimeType: string): Promise<UploadedFile>;
  deleteFile(fileId: string): Promise<boolean>;
  getFileUrl(fileId: string): Promise<string>;
  validateFile(file: Buffer, mimeType: string): ValidationResult;
}

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt: Date;
}

// Сервис логирования
export interface LoggingService {
  logInfo(message: string, data?: any): Promise<void>;
  logError(message: string, error: Error, data?: any): Promise<void>;
  logWarning(message: string, data?: any): Promise<void>;
  logDebug(message: string, data?: any): Promise<void>;
  getLogs(filters?: LogFilters): Promise<LogEntry[]>;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'error' | 'warning' | 'debug';
  message: string;
  data?: any;
  timestamp: Date;
  source: string;
}

export interface LogFilters {
  level?: string;
  source?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
}

// Сервис кэширования
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

// Сервис валидации
export interface ValidationService {
  validateEmail(email: string): boolean;
  validatePhone(phone: string): boolean;
  validateUrl(url: string): boolean;
  validatePassword(password: string): ValidationResult;
  sanitizeInput(input: string): string;
  validateFile(file: File, rules: FileValidationRules): ValidationResult;
}

export interface FileValidationRules {
  maxSize: number;
  allowedTypes: string[];
  allowedExtensions: string[];
}
