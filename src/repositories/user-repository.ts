/**
 * User Repository
 * Репозиторий для работы с пользователями
 */

import { BaseRepositoryImpl } from './base-repository.js';
import { UserRepository, UserApiResponse, UserWithStats } from '../interfaces/repositories.js';
import { FilterOptions, SortOptions, PaginationOptions } from '../types/admin.js';

export class UserRepositoryImpl extends BaseRepositoryImpl<UserApiResponse> implements UserRepository {
  protected model: any;

  constructor(prisma: any) {
    super(prisma);
    this.model = prisma.user;
  }

  async findByTelegramId(telegramId: string): Promise<UserApiResponse | null> {
    try {
      return await this.model.findUnique({
        where: { telegramId }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByTelegramId');
    }
  }

  async findByUsername(username: string): Promise<UserApiResponse | null> {
    try {
      return await this.model.findUnique({
        where: { username }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByUsername');
    }
  }

  async findByEmail(email: string): Promise<UserApiResponse | null> {
    try {
      return await this.model.findUnique({
        where: { email }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByEmail');
    }
  }

  async findWithStats(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: UserWithStats[]; total: number }> {
    try {
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(sort);
      const { skip, take } = this.buildPagination(pagination);

      const [users, total] = await Promise.all([
        this.model.findMany({
          where,
          orderBy,
          skip,
          take,
          include: {
            orders: {
              select: {
                id: true,
                itemsJson: true
              }
            },
            partnerProfile: {
              select: {
                id: true,
                directPartners: true,
                multiPartners: true
              }
            },
            inviter: {
              select: {
                id: true,
                firstName: true,
                username: true
              }
            }
          }
        }),
        this.model.count({ where })
      ]);

      const items = users.map((user: any) => this.mapToUserWithStats(user));
      return { items, total };
    } catch (error) {
      this.handleError(error as Error, 'findWithStats');
    }
  }

  async updateBalance(userId: string, amount: number): Promise<UserApiResponse> {
    try {
      return await this.model.update({
        where: { id: userId },
        data: {
          balance: {
            increment: amount
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'updateBalance');
    }
  }

  async findReferrals(userId: string, level: number): Promise<UserApiResponse[]> {
    try {
      const partnerProfile = await this.prisma.partnerProfile.findUnique({
        where: { userId },
        include: {
          referrals: {
            where: { level },
            include: {
              profile: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

      if (!partnerProfile) return [];

      return partnerProfile.referrals.map((ref: any) => ref.profile.user);
    } catch (error) {
      this.handleError(error as Error, 'findReferrals');
    }
  }

  async findInviter(userId: string): Promise<UserApiResponse | null> {
    try {
      const user = await this.model.findUnique({
        where: { id: userId },
        include: {
          inviter: true
        }
      });

      return user?.inviter || null;
    } catch (error) {
      this.handleError(error as Error, 'findInviter');
    }
  }

  async searchUsers(query: string): Promise<UserApiResponse[]> {
    try {
      return await this.model.findMany({
        where: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { username: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 20
      });
    } catch (error) {
      this.handleError(error as Error, 'searchUsers');
    }
  }

  async getUsersCount(): Promise<number> {
    try {
      return await this.model.count();
    } catch (error) {
      this.handleError(error as Error, 'getUsersCount');
    }
  }

  async getUsersWithBalance(): Promise<number> {
    try {
      return await this.model.count({
        where: {
          balance: {
            gt: 0
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'getUsersWithBalance');
    }
  }

  async getTotalBalance(): Promise<number> {
    try {
      const result = await this.model.aggregate({
        _sum: {
          balance: true
        }
      });
      return result._sum.balance || 0;
    } catch (error) {
      this.handleError(error as Error, 'getTotalBalance');
    }
  }

  async getTotalOrderSum(): Promise<number> {
    try {
      const result = await this.prisma.order.aggregate({
        _sum: {
          totalAmount: true
        },
        where: {
          status: 'COMPLETED'
        }
      });
      return result._sum.totalAmount || 0;
    } catch (error) {
      this.handleError(error as Error, 'getTotalOrderSum');
    }
  }

  private mapToUserWithStats(user: any): UserWithStats {
    const ordersCount = user.orders?.length || 0;
    const totalOrderSum = user.orders?.reduce((sum: number, order: any) => {
      const items = Array.isArray(order.itemsJson) ? order.itemsJson : [];
      return sum + items.reduce((itemSum: number, item: any) => itemSum + (item.price * item.quantity), 0);
    }, 0) || 0;

    const directPartners = user.partnerProfile?.directPartners || 0;
    const level2Partners = user.partnerProfile?.multiPartners || 0;
    const level3Partners = 0; // TODO: реализовать подсчет партнеров 3го уровня

    return {
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      balance: user.balance,
      bonus: user.bonus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ordersCount,
      totalOrderSum,
      directPartners,
      level2Partners,
      level3Partners,
      inviter: user.inviter
    };
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

    if (filters?.dateFrom) {
      where.createdAt = { ...where.createdAt, gte: filters.dateFrom };
    }

    if (filters?.dateTo) {
      where.createdAt = { ...where.createdAt, lte: filters.dateTo };
    }

    return where;
  }
}
