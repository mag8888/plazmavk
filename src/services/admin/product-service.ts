/**
 * Product Service
 * Сервис для работы с товарами
 */

import { ProductService, ProductApiResponse } from '../../interfaces/services.js';
import { ProductRepositoryImpl } from '../../repositories/product-repository.js';
import { ValidationResult, FilterOptions, SortOptions, PaginationOptions } from '../../types/admin.js';
import { ValidationError } from '../../types/validation.js';

export class ProductServiceImpl implements ProductService {
  private productRepository: ProductRepositoryImpl;

  constructor(productRepository: ProductRepositoryImpl) {
    this.productRepository = productRepository;
  }

  async findById(id: string): Promise<ProductApiResponse | null> {
    return await this.productRepository.findById(id);
  }

  async findAll(options?: FilterOptions): Promise<{ items: ProductApiResponse[]; total: number }> {
    return await this.productRepository.findAll(options);
  }

  async create(data: Partial<ProductApiResponse>): Promise<ProductApiResponse> {
    const validation = this.validateProductData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.productRepository.create(data);
  }

  async update(id: string, data: Partial<ProductApiResponse>): Promise<ProductApiResponse> {
    const validation = this.validateProductData(data);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    return await this.productRepository.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return await this.productRepository.delete(id);
  }

  async findByCategory(categoryId: string): Promise<ProductApiResponse[]> {
    return await this.productRepository.findByCategory(categoryId);
  }

  async findByStatus(isActive: boolean): Promise<ProductApiResponse[]> {
    return await this.productRepository.findByStatus(isActive);
  }

  async toggleActive(productId: string): Promise<ProductApiResponse> {
    return await this.productRepository.toggleActive(productId);
  }

  async uploadImage(productId: string, imageFile: Buffer): Promise<string> {
    const { uploadImage } = await import('../cloudinary-service.js');
    
    try {
      const result = await uploadImage(imageFile, {
        folder: 'vital/products',
        publicId: `product-${productId}`,
        resourceType: 'image',
      });
      
      return result.secureUrl;
    } catch (error) {
      console.error('Failed to upload product image:', error);
      throw new Error(`Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validateProductData(data: Partial<ProductApiResponse>): ValidationResult {
    const errors: ValidationError[] = [];

    if (data.title && typeof data.title !== 'string') {
      errors.push({
        field: 'title',
        message: 'Title must be a string',
        value: data.title
      });
    }

    if (data.title && data.title.length < 1) {
      errors.push({
        field: 'title',
        message: 'Title is required',
        value: data.title
      });
    }

    if (data.title && data.title.length > 255) {
      errors.push({
        field: 'title',
        message: 'Title must be less than 255 characters',
        value: data.title
      });
    }

    if (data.description && typeof data.description !== 'string') {
      errors.push({
        field: 'description',
        message: 'Description must be a string',
        value: data.description
      });
    }

    if (data.price !== undefined && (typeof data.price !== 'number' || data.price < 0)) {
      errors.push({
        field: 'price',
        message: 'Price must be a non-negative number',
        value: data.price
      });
    }

    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
      errors.push({
        field: 'isActive',
        message: 'isActive must be a boolean',
        value: data.isActive
      });
    }

    if (data.imageUrl && typeof data.imageUrl !== 'string') {
      errors.push({
        field: 'imageUrl',
        message: 'Image URL must be a string',
        value: data.imageUrl
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
