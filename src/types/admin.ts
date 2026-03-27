/**
 * Admin Panel Types
 * Типы для админ-панели
 */

import { Request } from 'express';
import { UserApiResponse, OrderApiResponse, PartnerApiResponse, ProductApiResponse, CategoryApiResponse, ReviewApiResponse, AudioFileApiResponse } from './api.js';

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

// Расширенный Request с пользователем
export interface AuthenticatedRequest extends Request {
  user?: AdminUser;
  session: any; // Используем any для совместимости с express-session
}

export interface AdminUser {
  id: string;
  email: string;
  isAuthenticated: boolean;
}

export interface AdminSession {
  isAdmin?: boolean;
  userId?: string;
  email?: string;
}

// Типы для форм
export interface LoginFormData {
  password: string;
}

export interface UserFormData {
  firstName?: string;
  lastName?: string;
  username?: string;
  balance?: number;
}

export interface OrderFormData {
  status: string;
  message?: string;
}

export interface ProductFormData {
  title: string;
  description?: string;
  price: number;
  categoryId?: string;
  isActive: boolean;
  image?: File;
}

export interface CategoryFormData {
  name: string;
  description?: string;
  isActive: boolean;
}

export interface PartnerFormData {
  isActive: boolean;
  programType: 'DIRECT' | 'MULTI_LEVEL';
}

export interface MessageFormData {
  userIds: string[];
  subject: string;
  text: string;
  saveAsTemplate?: boolean;
}

// Типы для UI компонентов
export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface ModalConfig {
  id: string;
  title: string;
  size?: 'small' | 'medium' | 'large';
  closable?: boolean;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'checkbox' | 'file';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

// Типы для статистики
export interface AdminDashboardData {
  stats: {
    totalUsers: number;
    usersWithBalance: number;
    totalPartners: number;
    totalOrderSum: number;
  };
  recentOrders: OrderApiResponse[];
  topPartners: PartnerApiResponse[];
  userGrowth: {
    date: string;
    count: number;
  }[];
}

// Типы для экспорта данных
export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  fields: string[];
  filters?: Record<string, any>;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

// Типы для уведомлений
export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  closable?: boolean;
}

// Типы для поиска
export interface SearchResult<T> {
  items: T[];
  total: number;
  query: string;
  filters: Record<string, any>;
}

export interface SearchOptions {
  query?: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

// Типы для валидации
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Типы для файлов
export interface FileUploadConfig {
  maxSize: number;
  allowedTypes: string[];
  uploadPath: string;
}

export interface UploadedFile {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  url?: string;
}

// Типы для логов
export interface AdminLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

// Типы для настроек
export interface AdminSettings {
  general: {
    siteName: string;
    siteDescription: string;
    defaultLanguage: string;
  };
  bot: {
    welcomeMessage: string;
    helpMessage: string;
    supportContact: string;
  };
  partner: {
    defaultBonusRate: number;
    activationThreshold: number;
    maxLevels: number;
  };
  notifications: {
    emailEnabled: boolean;
    telegramEnabled: boolean;
    adminEmail: string;
  };
}
