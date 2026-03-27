/**
 * Partner Service
 * Сервис для работы с партнерами
 */

import { PartnerService, PartnerApiResponse } from '../../interfaces/services.js';
import { PartnerRepositoryImpl } from '../../repositories/partner-repository.js';
import { ValidationResult, FilterOptions, SortOptions, PaginationOptions } from '../../types/admin.js';
import { ValidationError } from '../../types/validation.js';

export class PartnerServiceImpl implements PartnerService {
  private partnerRepository: PartnerRepositoryImpl;

  constructor(partnerRepository: PartnerRepositoryImpl) {
    this.partnerRepository = partnerRepository;
  }

  async findById(id: string): Promise<PartnerApiResponse | null> {
    return await this.partnerRepository.findById(id);
  }

  async findAll(options?: FilterOptions): Promise<{ items: PartnerApiResponse[]; total: number }> {
    return await this.partnerRepository.findAll(options);
  }

  async create(data: Partial<PartnerApiResponse>): Promise<PartnerApiResponse> {
    const validation = this.validatePartnerData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.partnerRepository.create(data);
  }

  async update(id: string, data: Partial<PartnerApiResponse>): Promise<PartnerApiResponse> {
    const validation = this.validatePartnerData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.partnerRepository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.partnerRepository.delete(id);
  }

  async findByUserId(userId: string): Promise<PartnerApiResponse | null> {
    return await this.partnerRepository.findByUserId(userId);
  }

  async findByReferralCode(code: string): Promise<PartnerApiResponse | null> {
    return await this.partnerRepository.findByReferralCode(code);
  }

  async activatePartner(userId: string): Promise<PartnerApiResponse> {
    return await this.partnerRepository.activatePartner(userId);
  }

  async deactivatePartner(userId: string): Promise<PartnerApiResponse> {
    return await this.partnerRepository.deactivatePartner(userId);
  }

  async calculateBonuses(userId: string, orderAmount: number, orderId?: string): Promise<void> {
    // Эта логика будет реализована в основном partner-service.ts
    // Здесь только валидация
    if (orderAmount <= 0) {
      throw new Error('Order amount must be positive');
    }
  }

  async getReferralHierarchy(userId: string): Promise<PartnerApiResponse[]> {
    return await this.partnerRepository.getReferralHierarchy(userId);
  }

  async recalculateBonuses(profileId: string): Promise<number> {
    return await this.partnerRepository.recalculateBonuses(profileId);
  }

  validatePartnerData(data: Partial<PartnerApiResponse>): ValidationResult {
    const errors: ValidationError[] = [];

    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
      errors.push({
        field: 'isActive',
        message: 'isActive must be a boolean',
        value: data.isActive
      });
    }

    if (data.programType) {
      const validTypes = ['DIRECT', 'MULTI_LEVEL'];
      if (!validTypes.includes(data.programType)) {
        errors.push({
          field: 'programType',
          message: `Invalid program type. Valid types are: ${validTypes.join(', ')}`,
          value: data.programType
        });
      }
    }

    if (data.referralCode && typeof data.referralCode !== 'string') {
      errors.push({
        field: 'referralCode',
        message: 'Referral code must be a string',
        value: data.referralCode
      });
    }

    if (data.balance !== undefined && (typeof data.balance !== 'number' || data.balance < 0)) {
      errors.push({
        field: 'balance',
        message: 'Balance must be a non-negative number',
        value: data.balance
      });
    }

    if (data.bonus !== undefined && (typeof data.bonus !== 'number' || data.bonus < 0)) {
      errors.push({
        field: 'bonus',
        message: 'Bonus must be a non-negative number',
        value: data.bonus
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
