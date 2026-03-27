/**
 * Base Repository
 * Базовый класс для всех репозиториев
 */

import { BaseRepository, BaseRepositoryClass, FilterOptions, SortOptions, PaginationOptions, DatabaseQuery, DatabaseResult } from '../interfaces/repositories.js';

export abstract class BaseRepositoryImpl<T> extends BaseRepositoryClass<T> implements BaseRepository<T> {
  protected abstract model: any; // Prisma модель

  async findById(id: string): Promise<T | null> {
    try {
      return await this.model.findUnique({
        where: { id }
      });
    } catch (error) {
      this.handleError(error as Error, 'findById');
    }
  }

  async findAll(filters?: FilterOptions, sort?: SortOptions, pagination?: PaginationOptions): Promise<{ items: T[]; total: number }> {
    try {
      const where = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(sort);
      const { skip, take } = this.buildPagination(pagination);

      const [items, total] = await Promise.all([
        this.model.findMany({
          where,
          orderBy,
          skip,
          take
        }),
        this.model.count({ where })
      ]);

      return { items, total };
    } catch (error) {
      this.handleError(error as Error, 'findAll');
    }
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      return await this.model.create({
        data: this.sanitizeData(data)
      });
    } catch (error) {
      this.handleError(error as Error, 'create');
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      return await this.model.update({
        where: { id },
        data: this.sanitizeData(data)
      });
    } catch (error) {
      this.handleError(error as Error, 'update');
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.model.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      this.handleError(error as Error, 'delete');
      return false;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.model.count({
        where: { id }
      });
      return count > 0;
    } catch (error) {
      this.handleError(error as Error, 'exists');
    }
  }

  protected sanitizeData(data: Partial<T>): Partial<T> {
    // Удаляем undefined значения
    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key as keyof T] === undefined) {
        delete sanitized[key as keyof T];
      }
    });
    return sanitized;
  }

  protected buildIncludeClause(relations?: string[]): any {
    if (!relations || relations.length === 0) return undefined;

    const include: any = {};
    relations.forEach(relation => {
      include[relation] = true;
    });
    return include;
  }

  protected buildSelectClause(fields?: string[]): any {
    if (!fields || fields.length === 0) return undefined;

    const select: any = {};
    fields.forEach(field => {
      select[field] = true;
    });
    return select;
  }
}
