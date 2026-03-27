/**
 * Partner Repository
 * Репозиторий для работы с партнерами
 */

import { BaseRepositoryImpl } from './base-repository.js';
import { PartnerRepository, PartnerApiResponse } from '../interfaces/repositories.js';
import { FilterOptions, SortOptions, PaginationOptions } from '../types/admin.js';

export class PartnerRepositoryImpl extends BaseRepositoryImpl<PartnerApiResponse> implements PartnerRepository {
  protected model: any;

  constructor(prisma: any) {
    super(prisma);
    this.model = prisma.partnerProfile;
  }

  async findByUserId(userId: string): Promise<PartnerApiResponse | null> {
    try {
      return await this.model.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
              balance: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByUserId');
    }
  }

  async findByReferralCode(code: string): Promise<PartnerApiResponse | null> {
    try {
      return await this.model.findUnique({
        where: { referralCode: code },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
              balance: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByReferralCode');
    }
  }

  async findActivePartners(): Promise<PartnerApiResponse[]> {
    try {
      return await this.model.findMany({
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
              balance: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.handleError(error as Error, 'findActivePartners');
    }
  }

  async findInactivePartners(): Promise<PartnerApiResponse[]> {
    try {
      return await this.model.findMany({
        where: { isActive: false },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
              balance: true,
              createdAt: true,
              updatedAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.handleError(error as Error, 'findInactivePartners');
    }
  }

  async activatePartner(userId: string): Promise<PartnerApiResponse> {
    try {
      return await this.model.update({
        where: { userId },
        data: {
          isActive: true,
          activatedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
              balance: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'activatePartner');
    }
  }

  async deactivatePartner(userId: string): Promise<PartnerApiResponse> {
    try {
      return await this.model.update({
        where: { userId },
        data: {
          isActive: false,
          expiresAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
              balance: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'deactivatePartner');
    }
  }

  async updateBalance(profileId: string, amount: number): Promise<PartnerApiResponse> {
    try {
      return await this.model.update({
        where: { id: profileId },
        data: {
          balance: {
            increment: amount
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
              telegramId: true,
              balance: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error as Error, 'updateBalance');
    }
  }

  async findReferrals(userId: string, level: number): Promise<PartnerApiResponse[]> {
    try {
      const partnerProfile = await this.model.findUnique({
        where: { userId },
        include: {
          referrals: {
            where: { level },
            include: {
              profile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      username: true,
                      telegramId: true,
                      balance: true,
                      createdAt: true,
                      updatedAt: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!partnerProfile) return [];

      return partnerProfile.referrals.map((ref: any) => ({
        ...ref.profile,
        user: ref.profile.user
      }));
    } catch (error) {
      this.handleError(error as Error, 'findReferrals');
    }
  }

  async getReferralHierarchy(userId: string): Promise<PartnerApiResponse[]> {
    try {
      const partnerProfile = await this.model.findUnique({
        where: { userId },
        include: {
          referrals: {
            include: {
              profile: {
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      username: true,
                      telegramId: true,
                      balance: true,
                      createdAt: true,
                      updatedAt: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      if (!partnerProfile) return [];

      return partnerProfile.referrals.map((ref: any) => ({
        ...ref.profile,
        user: ref.profile.user
      }));
    } catch (error) {
      this.handleError(error as Error, 'getReferralHierarchy');
    }
  }

  async recalculateBonuses(profileId: string): Promise<number> {
    try {
      // Получаем все транзакции партнера
      const transactions = await this.prisma.partnerTransaction.findMany({
        where: { profileId },
        orderBy: { createdAt: 'asc' }
      });

      let totalBalance = 0;
      for (const transaction of transactions) {
        if (transaction.type === 'CREDIT') {
          totalBalance += transaction.amount;
        } else if (transaction.type === 'DEBIT') {
          totalBalance -= transaction.amount;
        }
      }

      // Обновляем баланс
      await this.model.update({
        where: { id: profileId },
        data: { balance: totalBalance }
      });

      return totalBalance;
    } catch (error) {
      this.handleError(error as Error, 'recalculateBonuses');
    }
  }

  async getPartnersCount(): Promise<number> {
    try {
      return await this.model.count();
    } catch (error) {
      this.handleError(error as Error, 'getPartnersCount');
    }
  }

  async getActivePartnersCount(): Promise<number> {
    try {
      return await this.model.count({
        where: { isActive: true }
      });
    } catch (error) {
      this.handleError(error as Error, 'getActivePartnersCount');
    }
  }

  async getTotalBonuses(): Promise<number> {
    try {
      const result = await this.model.aggregate({
        _sum: {
          balance: true
        }
      });
      return result._sum.balance || 0;
    } catch (error) {
      this.handleError(error as Error, 'getTotalBonuses');
    }
  }

  async getPartnersWithUsers(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: PartnerApiResponse[]; total: number }> {
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
                balance: true,
                createdAt: true,
                updatedAt: true
              }
            }
          }
        }),
        this.model.count({ where })
      ]);

      return { items, total };
    } catch (error) {
      this.handleError(error as Error, 'getPartnersWithUsers');
    }
  }

  protected buildWhereClause(filters?: FilterOptions): any {
    const where: any = {};

    if (filters?.search) {
      where.user = {
        OR: [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { username: { contains: filters.search, mode: 'insensitive' } }
        ]
      };
    }

    if (filters?.status) {
      where.isActive = filters.status === 'active';
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
