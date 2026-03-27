/**
 * User Service
 * Сервис для работы с пользователями
 */

import { UserService, UserApiResponse, UserWithStats } from '../../interfaces/services.js';
import { UserRepositoryImpl } from '../../repositories/user-repository.js';
import { ValidationResult, FilterOptions, SortOptions, PaginationOptions } from '../../types/admin.js';
import { ValidationError } from '../../types/validation.js';

export class UserServiceImpl implements UserService {
  private userRepository: UserRepositoryImpl;

  constructor(userRepository: UserRepositoryImpl) {
    this.userRepository = userRepository;
  }

  async findById(id: string): Promise<UserApiResponse | null> {
    return await this.userRepository.findById(id);
  }

  async findAll(options?: FilterOptions): Promise<{ items: UserApiResponse[]; total: number }> {
    return await this.userRepository.findAll(options);
  }

  async create(data: Partial<UserApiResponse>): Promise<UserApiResponse> {
    const validation = this.validateUserData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.userRepository.create(data);
  }

  async update(id: string, data: Partial<UserApiResponse>): Promise<UserApiResponse> {
    const validation = this.validateUserData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.userRepository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.userRepository.delete(id);
  }

  async findByTelegramId(telegramId: string): Promise<UserApiResponse | null> {
    return await this.userRepository.findByTelegramId(telegramId);
  }

  async findByUsername(username: string): Promise<UserApiResponse | null> {
    return await this.userRepository.findByUsername(username);
  }

  async getUsersWithStats(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: UserWithStats[]; total: number }> {
    return await this.userRepository.findWithStats(filters, sort, pagination);
  }

  async updateBalance(userId: string, amount: number, operation: 'add' | 'subtract'): Promise<UserApiResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const finalAmount = operation === 'add' ? amount : -amount;
    return await this.userRepository.updateBalance(userId, finalAmount);
  }

  async getReferralChain(userId: string, level: number): Promise<UserApiResponse[]> {
    return await this.userRepository.findReferrals(userId, level);
  }

  validateUserData(data: Partial<UserApiResponse>): ValidationResult {
    const errors: ValidationError[] = [];

    if (data.telegramId && typeof data.telegramId !== 'string') {
      errors.push({
        field: 'telegramId',
        message: 'Telegram ID must be a string',
        value: data.telegramId
      });
    }

    if (data.firstName && typeof data.firstName !== 'string') {
      errors.push({
        field: 'firstName',
        message: 'First name must be a string',
        value: data.firstName
      });
    }

    if (data.lastName && typeof data.lastName !== 'string') {
      errors.push({
        field: 'lastName',
        message: 'Last name must be a string',
        value: data.lastName
      });
    }

    if (data.username && typeof data.username !== 'string') {
      errors.push({
        field: 'username',
        message: 'Username must be a string',
        value: data.username
      });
    }

    if (data.balance !== undefined && (typeof data.balance !== 'number' || data.balance < 0)) {
      errors.push({
        field: 'balance',
        message: 'Balance must be a non-negative number',
        value: data.balance
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Дополнительные методы для контроллера
  async getUsersCount(): Promise<number> {
    return await this.userRepository.getUsersCount();
  }

  async getUsersWithBalance(): Promise<number> {
    return await this.userRepository.getUsersWithBalance();
  }

  async getTotalBalance(): Promise<number> {
    return await this.userRepository.getTotalBalance();
  }

  async getTotalOrderSum(): Promise<number> {
    return await this.userRepository.getTotalOrderSum();
  }

  async searchUsers(query: string): Promise<UserApiResponse[]> {
    return await this.userRepository.searchUsers(query);
  }

  async getUserOrders(userId: string): Promise<any[]> {
    // Заглушка - в реальном проекте нужно получить заказы пользователя
    return [];
  }
}
