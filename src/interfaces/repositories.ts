/**
 * Repository Interfaces
 * Интерфейсы для всех репозиториев (слой доступа к данным)
 */

import { UserApiResponse, UserWithStats, OrderApiResponse, PartnerApiResponse, ProductApiResponse, CategoryApiResponse, ReviewApiResponse, AudioFileApiResponse } from '../types/api.js';
import { FilterOptions, SortOptions, PaginationOptions } from '../types/admin.js';

// Экспортируем типы для использования в других модулях
export type { UserApiResponse, UserWithStats, OrderApiResponse, PartnerApiResponse, ProductApiResponse, CategoryApiResponse, ReviewApiResponse, AudioFileApiResponse } from '../types/api.js';
export type { FilterOptions, SortOptions, PaginationOptions } from '../types/admin.js';

// Базовый интерфейс для всех репозиториев
export interface BaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: T[]; total: number }>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}

// Репозиторий пользователей
export interface UserRepository extends BaseRepository<UserApiResponse> {
  findByTelegramId(telegramId: string): Promise<UserApiResponse | null>;
  findByUsername(username: string): Promise<UserApiResponse | null>;
  findByEmail(email: string): Promise<UserApiResponse | null>;
  findWithStats(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: UserWithStats[]; total: number }>;
  updateBalance(userId: string, amount: number): Promise<UserApiResponse>;
  findReferrals(userId: string, level: number): Promise<UserApiResponse[]>;
  findInviter(userId: string): Promise<UserApiResponse | null>;
  searchUsers(query: string): Promise<UserApiResponse[]>;
  getUsersCount(): Promise<number>;
  getUsersWithBalance(): Promise<number>;
  getTotalBalance(): Promise<number>;
  getTotalOrderSum(): Promise<number>;
}

// Репозиторий заказов
export interface OrderRepository extends BaseRepository<OrderApiResponse> {
  findByUserId(userId: string): Promise<OrderApiResponse[]>;
  findByStatus(status: string): Promise<OrderApiResponse[]>;
  findByDateRange(from: Date, to: Date): Promise<OrderApiResponse[]>;
  updateStatus(orderId: string, status: string): Promise<OrderApiResponse>;
  calculateTotal(orderId: string): Promise<number>;
  getOrdersCount(): Promise<number>;
  getPendingOrdersCount(): Promise<number>;
  getCompletedOrdersCount(): Promise<number>;
  getTotalRevenue(): Promise<number>;
  getOrdersWithUsers(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: OrderApiResponse[]; total: number }>;
}

// Репозиторий партнеров
export interface PartnerRepository extends BaseRepository<PartnerApiResponse> {
  findByUserId(userId: string): Promise<PartnerApiResponse | null>;
  findByReferralCode(code: string): Promise<PartnerApiResponse | null>;
  findActivePartners(): Promise<PartnerApiResponse[]>;
  findInactivePartners(): Promise<PartnerApiResponse[]>;
  activatePartner(userId: string): Promise<PartnerApiResponse>;
  deactivatePartner(userId: string): Promise<PartnerApiResponse>;
  updateBalance(profileId: string, amount: number): Promise<PartnerApiResponse>;
  findReferrals(userId: string, level: number): Promise<PartnerApiResponse[]>;
  getReferralHierarchy(userId: string): Promise<PartnerApiResponse[]>;
  recalculateBonuses(profileId: string): Promise<number>;
  getPartnersCount(): Promise<number>;
  getActivePartnersCount(): Promise<number>;
  getTotalBonuses(): Promise<number>;
  getPartnersWithUsers(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: PartnerApiResponse[]; total: number }>;
}

// Репозиторий товаров
export interface ProductRepository extends BaseRepository<ProductApiResponse> {
  findByCategory(categoryId: string): Promise<ProductApiResponse[]>;
  findByStatus(isActive: boolean): Promise<ProductApiResponse[]>;
  findByPriceRange(min: number, max: number): Promise<ProductApiResponse[]>;
  toggleActive(productId: string): Promise<ProductApiResponse>;
  updateImage(productId: string, imageUrl: string): Promise<ProductApiResponse>;
  getProductsCount(): Promise<number>;
  getActiveProductsCount(): Promise<number>;
  searchProducts(query: string): Promise<ProductApiResponse[]>;
  getProductsWithCategories(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: ProductApiResponse[]; total: number }>;
}

// Репозиторий категорий
export interface CategoryRepository extends BaseRepository<CategoryApiResponse> {
  findBySlug(slug: string): Promise<CategoryApiResponse | null>;
  findByStatus(isActive: boolean): Promise<CategoryApiResponse[]>;
  toggleActive(categoryId: string): Promise<CategoryApiResponse>;
  generateSlug(name: string): Promise<string>;
  getCategoriesCount(): Promise<number>;
  getActiveCategoriesCount(): Promise<number>;
  searchCategories(query: string): Promise<CategoryApiResponse[]>;
}

// Репозиторий отзывов
export interface ReviewRepository extends BaseRepository<ReviewApiResponse> {
  findByUserId(userId: string): Promise<ReviewApiResponse[]>;
  findByStatus(isApproved: boolean): Promise<ReviewApiResponse[]>;
  findByRating(rating: number): Promise<ReviewApiResponse[]>;
  approveReview(reviewId: string): Promise<ReviewApiResponse>;
  rejectReview(reviewId: string): Promise<ReviewApiResponse>;
  getAverageRating(): Promise<number>;
  getReviewsCount(): Promise<number>;
  getApprovedReviewsCount(): Promise<number>;
  getPendingReviewsCount(): Promise<number>;
  getReviewsWithUsers(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: ReviewApiResponse[]; total: number }>;
}

// Репозиторий аудио
export interface AudioRepository extends BaseRepository<AudioFileApiResponse> {
  findByCategory(category: string): Promise<AudioFileApiResponse[]>;
  findByStatus(isActive: boolean): Promise<AudioFileApiResponse[]>;
  toggleActive(audioId: string): Promise<AudioFileApiResponse>;
  updateFile(audioId: string, fileUrl: string): Promise<AudioFileApiResponse>;
  getAudioCount(): Promise<number>;
  getActiveAudioCount(): Promise<number>;
  searchAudio(query: string): Promise<AudioFileApiResponse[]>;
}

// Репозиторий истории пользователей
export interface UserHistoryRepository {
  create(userId: string, action: string, payload: any): Promise<any>;
  findByUserId(userId: string): Promise<any[]>;
  findByAction(action: string): Promise<any[]>;
  findByDateRange(from: Date, to: Date): Promise<any[]>;
  getHistoryCount(): Promise<number>;
  getHistoryWithUsers(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: any[]; total: number }>;
}

// Репозиторий транзакций партнеров
export interface PartnerTransactionRepository {
  create(profileId: string, type: string, amount: number, description: string): Promise<any>;
  findByProfileId(profileId: string): Promise<any[]>;
  findByType(type: string): Promise<any[]>;
  findByDateRange(from: Date, to: Date): Promise<any[]>;
  getTransactionCount(): Promise<number>;
  getTotalCredits(): Promise<number>;
  getTotalDebits(): Promise<number>;
  getTransactionsWithProfiles(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: any[]; total: number }>;
}

// Базовый класс для всех репозиториев
export abstract class BaseRepositoryClass<T> {
  protected prisma: any; // PrismaClient

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  protected handleError(error: Error, operation: string): never {
    console.error(`Repository Error [${operation}]:`, error);
    throw new Error(`Database operation failed: ${operation}`);
  }

  protected async executeTransaction<R>(operation: () => Promise<R>): Promise<R> {
    try {
      return await this.prisma.$transaction(operation);
    } catch (error) {
      this.handleError(error as Error, 'transaction');
    }
  }

  protected buildWhereClause(filters?: FilterOptions): any {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.dateFrom) {
      where.createdAt = { ...where.createdAt, gte: filters.dateFrom };
    }

    if (filters?.dateTo) {
      where.createdAt = { ...where.createdAt, lte: filters.dateTo };
    }

    return where;
  }

  protected buildOrderBy(sort?: SortOptions): any {
    if (!sort) return { createdAt: 'desc' };

    return {
      [sort.field]: sort.direction
    };
  }

  protected buildPagination(pagination?: PaginationOptions): { skip: number; take: number } {
    if (!pagination) return { skip: 0, take: 50 };

    const skip = (pagination.page - 1) * pagination.limit;
    const take = pagination.limit;

    return { skip, take };
  }
}

// Типы для запросов к базе данных
export interface DatabaseQuery<T> {
  where?: any;
  include?: any;
  orderBy?: any;
  skip?: number;
  take?: number;
}

export interface DatabaseResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Типы для агрегации данных
export interface AggregationResult {
  count: number;
  sum?: number;
  avg?: number;
  min?: number;
  max?: number;
}

// Типы для связей между таблицами
export interface RelationOptions {
  include?: string[];
  select?: string[];
  where?: any;
}

// Типы для индексов и оптимизации
export interface IndexOptions {
  fields: string[];
  unique?: boolean;
  sparse?: boolean;
  background?: boolean;
}

// Типы для миграций
export interface MigrationOptions {
  version: string;
  description: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}
