/**
 * Repositories Index
 * Экспорт всех репозиториев
 */

export { BaseRepositoryImpl } from './base-repository.js';
export { UserRepositoryImpl } from './user-repository.js';
export { OrderRepositoryImpl } from './order-repository.js';
export { PartnerRepositoryImpl } from './partner-repository.js';
export { ProductRepositoryImpl } from './product-repository.js';

// Фабрика репозиториев
export class RepositoryFactory {
  private static prisma: any;

  static initialize(prisma: any) {
    RepositoryFactory.prisma = prisma;
  }

  static getUserRepository(): UserRepositoryImpl {
    return new UserRepositoryImpl(RepositoryFactory.prisma);
  }

  static getOrderRepository(): OrderRepositoryImpl {
    return new OrderRepositoryImpl(RepositoryFactory.prisma);
  }

  static getPartnerRepository(): PartnerRepositoryImpl {
    return new PartnerRepositoryImpl(RepositoryFactory.prisma);
  }

  static getProductRepository(): ProductRepositoryImpl {
    return new ProductRepositoryImpl(RepositoryFactory.prisma);
  }
}
