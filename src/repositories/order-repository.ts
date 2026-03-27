/**
 * Order Repository
 * Репозиторий для работы с заказами
 */

import { BaseRepositoryImpl } from './base-repository.js';
import { OrderRepository, OrderApiResponse } from '../interfaces/repositories.js';
import { FilterOptions, SortOptions, PaginationOptions } from '../types/admin.js';

export class OrderRepositoryImpl extends BaseRepositoryImpl<OrderApiResponse> implements OrderRepository {
  protected model: any;

  constructor(prisma: any) {
    super(prisma);
    this.model = prisma.order;
  }

  async findByUserId(userId: string): Promise<OrderApiResponse[]> {
    try {
      return await this.model.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByUserId');
    }
  }

  async findByStatus(status: string): Promise<OrderApiResponse[]> {
    try {
      return await this.model.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByStatus');
    }
  }

  async findByDateRange(from: Date, to: Date): Promise<OrderApiResponse[]> {
    try {
      return await this.model.findMany({
        where: {
          createdAt: {
            gte: from,
            lte: to
          }
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByDateRange');
    }
  }

  async updateStatus(orderId: string, status: string): Promise<OrderApiResponse> {
    try {
      return await this.model.update({
        where: { id: orderId },
        data: { status },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'updateStatus');
    }
  }

  async calculateTotal(orderId: string): Promise<number> {
    try {
      const order = await this.model.findUnique({
        where: { id: orderId },
        select: { itemsJson: true }
      });

      if (!order || !Array.isArray(order.itemsJson)) {
        return 0;
      }

      return order.itemsJson.reduce((total: number, item: any) => {
        return total + (item.price * item.quantity);
      }, 0);
    } catch (error) {
      this.handleError(error as Error, 'calculateTotal');
    }
  }

  async getOrdersCount(): Promise<number> {
    try {
      return await this.model.count();
    } catch (error) {
      this.handleError(error as Error, 'getOrdersCount');
    }
  }

  async getPendingOrdersCount(): Promise<number> {
    try {
      return await this.model.count({
        where: { status: 'NEW' }
      });
    } catch (error) {
      this.handleError(error as Error, 'getPendingOrdersCount');
    }
  }

  async getCompletedOrdersCount(): Promise<number> {
    try {
      return await this.model.count({
        where: { status: 'COMPLETED' }
      });
    } catch (error) {
      this.handleError(error as Error, 'getCompletedOrdersCount');
    }
  }

  async getTotalRevenue(): Promise<number> {
    try {
      const result = await this.model.aggregate({
        _sum: {
          totalAmount: true
        },
        where: {
          status: 'COMPLETED'
        }
      });
      return result._sum.totalAmount || 0;
    } catch (error) {
      this.handleError(error as Error, 'getTotalRevenue');
    }
  }

  async getOrdersWithUsers(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: OrderApiResponse[]; total: number }> {
    try {
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(sort);
      const { skip, take } = this.buildPagination(pagination);

      const [items, total] = await Promise.all([
        this.model.findMany({
          where,
          orderBy,
          skip,
          take,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                telegramId: true,
                balance: true
              }
            }
          }
        }),
        this.model.count({ where })
      ]);

      return { items, total };
    } catch (error) {
      this.handleError(error as Error, 'getOrdersWithUsers');
    }
  }

  protected buildWhereClause(filters?: FilterOptions): any {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { contact: { contains: filters.search, mode: 'insensitive' } },
        { message: { contains: filters.search, mode: 'insensitive' } },
        {
          user: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { username: { contains: filters.search, mode: 'insensitive' } }
            ]
          }
        }
      ];
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dateFrom) {
      where.createdAt = { ...where.createdAt, gte: filters.dateFrom };
    }

    if (filters?.dateTo) {
      where.createdAt = { ...where.createdAt, lte: filters.dateTo };
    }

    return where;
  }
}
