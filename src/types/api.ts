/**
 * API Response Types
 * Строгие типы для всех API ответов
 */

// Базовые типы ответов
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Типы для пользователей
export interface UserApiResponse {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  balance: number;
  bonus: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithStats extends UserApiResponse {
  ordersCount: number;
  totalOrderSum: number;
  directPartners: number;
  level2Partners: number;
  level3Partners: number;
  inviter?: {
    id: string;
    firstName: string | null;
    username: string | null;
  };
}

// Типы для заказов
export interface OrderApiResponse {
  id: string;
  userId: string | null;
  contact: string | null;
  message: string;
  status: OrderStatus;
  itemsJson: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
  user?: UserApiResponse;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
}

export type OrderStatus = 'NEW' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

// Типы для партнеров
export interface PartnerApiResponse {
  id: string;
  userId: string;
  isActive: boolean;
  activatedAt: Date | null;
  expiresAt: Date | null;
  activationType: string | null;
  programType: 'DIRECT' | 'MULTI_LEVEL';
  referralCode: string;
  balance: number;
  bonus: number;
  totalPartners: number;
  directPartners: number;
  multiPartners: number;
  createdAt: Date;
  updatedAt: Date;
  user: UserApiResponse;
}

export interface PartnerTransaction {
  id: string;
  profileId: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
  createdAt: Date;
}

// Типы для товаров
export interface ProductApiResponse {
  id: string;
  title: string;
  description: string | null;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  category?: CategoryApiResponse;
}

export interface CategoryApiResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Типы для отзывов
export interface ReviewApiResponse {
  id: string;
  userId: string;
  rating: number;
  text: string | null;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: UserApiResponse;
}

// Типы для аудио
export interface AudioFileApiResponse {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  duration: number | null;
  fileSize: number | null;
  fileUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Типы для статистики
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

// Типы для фильтрации и сортировки
export interface FilterOptions {
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  isActive?: boolean;
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}
