/**
 * Product Repository
 * Репозиторий для работы с товарами
 */

import { BaseRepositoryImpl } from './base-repository.js';
import { ProductRepository, ProductApiResponse } from '../interfaces/repositories.js';
import { FilterOptions, SortOptions, PaginationOptions } from '../types/admin.js';

export class ProductRepositoryImpl extends BaseRepositoryImpl<ProductApiResponse> implements ProductRepository {
  protected model: any;

  constructor(prisma: any) {
    super(prisma);
    this.model = prisma.product;
  }

  async findByCategory(categoryId: string): Promise<ProductApiResponse[]> {
    try {
      return await this.model.findMany({
        where: { categoryId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByCategory');
    }
  }

  async findByStatus(isActive: boolean): Promise<ProductApiResponse[]> {
    try {
      return await this.model.findMany({
        where: { isActive },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByStatus');
    }
  }

  async findByPriceRange(min: number, max: number): Promise<ProductApiResponse[]> {
    try {
      return await this.model.findMany({
        where: {
          price: {
            gte: min,
            lte: max
          }
        },
        orderBy: { price: 'asc' }
      });
    } catch (error) {
      this.handleError(error as Error, 'findByPriceRange');
    }
  }

  async toggleActive(productId: string): Promise<ProductApiResponse> {
    try {
      const product = await this.model.findUnique({
        where: { id: productId }
      });

      if (!product) {
        throw new Error('Product not found');
      }

      return await this.model.update({
        where: { id: productId },
        data: { isActive: !product.isActive }
      });
    } catch (error) {
      this.handleError(error as Error, 'toggleActive');
    }
  }

  async updateImage(productId: string, imageUrl: string): Promise<ProductApiResponse> {
    try {
      return await this.model.update({
        where: { id: productId },
        data: { imageUrl }
      });
    } catch (error) {
      this.handleError(error as Error, 'updateImage');
    }
  }

  async getProductsCount(): Promise<number> {
    try {
      return await this.model.count();
    } catch (error) {
      this.handleError(error as Error, 'getProductsCount');
    }
  }

  async getActiveProductsCount(): Promise<number> {
    try {
      return await this.model.count({
        where: { isActive: true }
      });
    } catch (error) {
      this.handleError(error as Error, 'getActiveProductsCount');
    }
  }

  async searchProducts(query: string): Promise<ProductApiResponse[]> {
    try {
      return await this.model.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 20,
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      this.handleError(error as Error, 'searchProducts');
    }
  }

  async getProductsWithCategories(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: ProductApiResponse[]; total: number }> {
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
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                isActive: true
              }
            }
          }
        }),
        this.model.count({ where })
      ]);

      return { items, total };
    } catch (error) {
      this.handleError(error as Error, 'getProductsWithCategories');
    }
  }

  protected buildWhereClause(filters?: FilterOptions): any {
    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
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
