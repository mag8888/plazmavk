/**
 * Order Service
 * Сервис для работы с заказами
 */

import { OrderService, OrderApiResponse } from '../../interfaces/services.js';
import { OrderRepositoryImpl } from '../../repositories/order-repository.js';
import { ValidationResult, FilterOptions, SortOptions, PaginationOptions } from '../../types/admin.js';
import { ValidationError } from '../../types/validation.js';
import { calculateDualSystemBonuses } from '../partner-service.js';

export class OrderServiceImpl implements OrderService {
  private orderRepository: OrderRepositoryImpl;

  constructor(orderRepository: OrderRepositoryImpl) {
    this.orderRepository = orderRepository;
  }

  async findById(id: string): Promise<OrderApiResponse | null> {
    return await this.orderRepository.findById(id);
  }

  async findAll(options?: FilterOptions): Promise<{ items: OrderApiResponse[]; total: number }> {
    return await this.orderRepository.findAll(options);
  }

  async create(data: Partial<OrderApiResponse>): Promise<OrderApiResponse> {
    const validation = this.validateOrderData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.orderRepository.create(data);
  }

  async update(id: string, data: Partial<OrderApiResponse>): Promise<OrderApiResponse> {
    const validation = this.validateOrderData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.orderRepository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.orderRepository.delete(id);
  }

  async findByUserId(userId: string): Promise<OrderApiResponse[]> {
    return await this.orderRepository.findByUserId(userId);
  }

  async findByStatus(status: string): Promise<OrderApiResponse[]> {
    return await this.orderRepository.findByStatus(status);
  }

  async updateStatus(orderId: string, status: string): Promise<OrderApiResponse> {
    const validStatuses = ['NEW', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    const order = await this.orderRepository.updateStatus(orderId, status);

    // Если заказ завершен, распределяем бонусы
    if (status === 'COMPLETED' && order.userId) {
      try {
        const totalAmount = await this.calculateTotal(orderId);
        await this.distributeReferralBonuses(orderId);
      } catch (error) {
        console.error('Error distributing referral bonuses:', error);
        // Не прерываем выполнение, только логируем ошибку
      }
    }

    return order;
  }

  async calculateTotal(orderId: string): Promise<number> {
    return await this.orderRepository.calculateTotal(orderId);
  }

  async distributeReferralBonuses(orderId: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);
    if (!order || !order.userId) {
      throw new Error('Order not found or has no user');
    }

    const totalAmount = await this.calculateTotal(orderId);
    if (totalAmount <= 0) {
      return; // Нет смысла распределять бонусы для пустого заказа
    }

    await calculateDualSystemBonuses(order.userId, totalAmount, orderId);
  }

  validateOrderData(data: Partial<OrderApiResponse>): ValidationResult {
    const errors: ValidationError[] = [];

    if (data.status) {
      const validStatuses = ['NEW', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(data.status)) {
        errors.push({
          field: 'status',
          message: `Invalid status. Valid statuses are: ${validStatuses.join(', ')}`,
          value: data.status
        });
      }
    }

    if (data.itemsJson && !Array.isArray(data.itemsJson)) {
      errors.push({
        field: 'itemsJson',
        message: 'Items must be an array',
        value: data.itemsJson
      });
    }

    if (data.contact && typeof data.contact !== 'string') {
      errors.push({
        field: 'contact',
        message: 'Contact must be a string',
        value: data.contact
      });
    }

    if (data.message && typeof data.message !== 'string') {
      errors.push({
        field: 'message',
        message: 'Message must be a string',
        value: data.message
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
