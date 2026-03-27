/**
 * Validation Types
 * Типы для валидации данных
 */

// Базовые типы валидации
export interface ValidationRule {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  message?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  data?: any;
}

// Правила валидации для пользователей
export interface UserValidationRules {
  telegramId: ValidationRule;
  firstName: ValidationRule;
  lastName: ValidationRule;
  username: ValidationRule;
  email: ValidationRule;
  phone: ValidationRule;
  balance: ValidationRule;
}

// Правила валидации для заказов
export interface OrderValidationRules {
  userId: ValidationRule;
  contact: ValidationRule;
  message: ValidationRule;
  status: ValidationRule;
  itemsJson: ValidationRule;
}

// Правила валидации для товаров
export interface ProductValidationRules {
  title: ValidationRule;
  description: ValidationRule;
  price: ValidationRule;
  categoryId: ValidationRule;
  isActive: ValidationRule;
  imageUrl: ValidationRule;
}

// Правила валидации для категорий
export interface CategoryValidationRules {
  name: ValidationRule;
  slug: ValidationRule;
  description: ValidationRule;
  isActive: ValidationRule;
}

// Правила валидации для партнеров
export interface PartnerValidationRules {
  userId: ValidationRule;
  isActive: ValidationRule;
  programType: ValidationRule;
  referralCode: ValidationRule;
  balance: ValidationRule;
  bonus: ValidationRule;
}

// Правила валидации для отзывов
export interface ReviewValidationRules {
  userId: ValidationRule;
  rating: ValidationRule;
  text: ValidationRule;
  isApproved: ValidationRule;
}

// Правила валидации для аудио
export interface AudioValidationRules {
  title: ValidationRule;
  description: ValidationRule;
  category: ValidationRule;
  duration: ValidationRule;
  fileSize: ValidationRule;
  fileUrl: ValidationRule;
  isActive: ValidationRule;
}

// Правила валидации для файлов
export interface FileValidationRules {
  maxSize: number;
  allowedTypes: string[];
  allowedExtensions: string[];
  required?: boolean;
}

// Правила валидации для форм
export interface FormValidationRules {
  [fieldName: string]: ValidationRule;
}

// Типы для валидации API запросов
export interface ApiRequestValidation {
  body?: FormValidationRules;
  params?: FormValidationRules;
  query?: FormValidationRules;
  headers?: FormValidationRules;
}

// Типы для валидации ответов API
export interface ApiResponseValidation {
  statusCode: number;
  schema: any;
  examples?: any[];
}

// Типы для валидации конфигурации
export interface ConfigValidationRules {
  [key: string]: ValidationRule;
}

// Типы для валидации окружения
export interface EnvironmentValidationRules {
  [key: string]: ValidationRule;
}

// Базовые валидаторы
export interface BaseValidator<T> {
  validate(data: T, rules: any): ValidationResult;
  validateField(field: string, value: any, rule: ValidationRule): ValidationError | null;
  sanitize(data: T): T;
}

// Специализированные валидаторы
export interface UserValidator extends BaseValidator<any> {
  validateTelegramId(telegramId: string): ValidationError | null;
  validateUsername(username: string): ValidationError | null;
  validateEmail(email: string): ValidationError | null;
  validatePhone(phone: string): ValidationError | null;
  validatePassword(password: string): ValidationError | null;
}

export interface FileValidator extends BaseValidator<File> {
  validateSize(file: File, maxSize: number): ValidationError | null;
  validateType(file: File, allowedTypes: string[]): ValidationError | null;
  validateExtension(file: File, allowedExtensions: string[]): ValidationError | null;
}

export interface OrderValidator extends BaseValidator<any> {
  validateItems(items: any[]): ValidationError | null;
  validateStatus(status: string): ValidationError | null;
  validateContact(contact: string): ValidationError | null;
}

// Типы для схем валидации
export interface ValidationSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: { [key: string]: ValidationSchema };
  items?: ValidationSchema;
  required?: string[];
  additionalProperties?: boolean;
}

// Типы для валидации JSON Schema
export interface JsonSchemaValidation {
  schema: ValidationSchema;
  data: any;
  errors: ValidationError[];
}

// Типы для валидации регулярных выражений
export interface RegexValidationRule extends ValidationRule {
  pattern: RegExp;
  flags?: string;
}

// Типы для валидации диапазонов
export interface RangeValidationRule extends ValidationRule {
  min?: number;
  max?: number;
  exclusiveMin?: boolean;
  exclusiveMax?: boolean;
}

// Типы для валидации длины строк
export interface LengthValidationRule extends ValidationRule {
  minLength?: number;
  maxLength?: number;
}

// Типы для валидации массивов
export interface ArrayValidationRule extends ValidationRule {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  itemSchema?: ValidationSchema;
}

// Типы для валидации объектов
export interface ObjectValidationRule {
  properties?: { [key: string]: ValidationRule };
  required?: string[];
  additionalProperties?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
  message?: string;
}

// Типы для валидации дат
export interface DateValidationRule extends ValidationRule {
  minDate?: Date;
  maxDate?: Date;
  format?: string;
}

// Типы для валидации URL
export interface UrlValidationRule extends ValidationRule {
  protocols?: string[];
  requireProtocol?: boolean;
  allowLocal?: boolean;
}

// Типы для валидации email
export interface EmailValidationRule extends ValidationRule {
  allowDisplayName?: boolean;
  requireDisplayName?: boolean;
  allowUtf8LocalPart?: boolean;
  requireTld?: boolean;
}

// Типы для валидации телефона
export interface PhoneValidationRule extends ValidationRule {
  countryCode?: string;
  format?: 'e164' | 'international' | 'national' | 'rfc3966';
  strict?: boolean;
}

// Типы для валидации UUID
export interface UuidValidationRule extends ValidationRule {
  version?: 1 | 2 | 3 | 4 | 5;
  strict?: boolean;
}

// Типы для валидации JSON
export interface JsonValidationRule extends ValidationRule {
  schema?: ValidationSchema;
  allowComments?: boolean;
  allowTrailingCommas?: boolean;
}

// Типы для валидации Base64
export interface Base64ValidationRule extends ValidationRule {
  padding?: boolean;
  urlSafe?: boolean;
}

// Типы для валидации JWT
export interface JwtValidationRule extends ValidationRule {
  secret?: string;
  algorithms?: string[];
  issuer?: string;
  audience?: string;
  clockTolerance?: number;
}

// Типы для валидации паролей
export interface PasswordValidationRule extends ValidationRule {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  forbiddenPatterns?: RegExp[];
}

// Типы для валидации валют
export interface CurrencyValidationRule extends ValidationRule {
  currency?: string;
  allowNegative?: boolean;
  precision?: number;
}

// Типы для валидации цветов
export interface ColorValidationRule extends ValidationRule {
  format?: 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla';
  allowAlpha?: boolean;
}

// Типы для валидации координат
export interface CoordinateValidationRule extends ValidationRule {
  type?: 'latitude' | 'longitude';
  precision?: number;
}

// Типы для валидации IP адресов
export interface IpValidationRule extends ValidationRule {
  version?: 4 | 6;
  allowPrivate?: boolean;
  allowReserved?: boolean;
}

// Типы для валидации доменов
export interface DomainValidationRule extends ValidationRule {
  allowWildcard?: boolean;
  allowIdn?: boolean;
  allowTld?: boolean;
}

// Типы для валидации MAC адресов
export interface MacValidationRule extends ValidationRule {
  format?: 'colon' | 'dash' | 'dot' | 'none';
  case?: 'upper' | 'lower' | 'any';
}

// Типы для валидации ISBN
export interface IsbnValidationRule extends ValidationRule {
  version?: 10 | 13;
  allowSeparators?: boolean;
}

// Типы для валидации ISSN
export interface IssnValidationRule extends ValidationRule {
  allowSeparator?: boolean;
  case?: 'upper' | 'lower' | 'any';
}

// Типы для валидации IBAN
export interface IbanValidationRule extends ValidationRule {
  country?: string;
  allowWhitespace?: boolean;
}

// Типы для валидации BIC
export interface BicValidationRule extends ValidationRule {
  allowTest?: boolean;
  case?: 'upper' | 'lower' | 'any';
}

// Типы для валидации кредитных карт
export interface CreditCardValidationRule extends ValidationRule {
  type?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'dinersclub' | 'jcb' | 'unionpay';
  allowTest?: boolean;
}

// Типы для валидации SSN
export interface SsnValidationRule extends ValidationRule {
  country?: 'US' | 'CA' | 'GB';
  allowTest?: boolean;
}

// Типы для валидации VAT
export interface VatValidationRule extends ValidationRule {
  country?: string;
  allowTest?: boolean;
}

// Типы для валидации ISBN
export interface IsbnValidationRule extends ValidationRule {
  version?: 10 | 13;
  allowSeparators?: boolean;
}

// Типы для валидации ISSN
export interface IssnValidationRule extends ValidationRule {
  allowSeparator?: boolean;
  case?: 'upper' | 'lower' | 'any';
}

// Типы для валидации IBAN
export interface IbanValidationRule extends ValidationRule {
  country?: string;
  allowWhitespace?: boolean;
}

// Типы для валидации BIC
export interface BicValidationRule extends ValidationRule {
  allowTest?: boolean;
  case?: 'upper' | 'lower' | 'any';
}

// Типы для валидации кредитных карт
export interface CreditCardValidationRule extends ValidationRule {
  type?: 'visa' | 'mastercard' | 'amex' | 'discover' | 'dinersclub' | 'jcb' | 'unionpay';
  allowTest?: boolean;
}

// Типы для валидации SSN
export interface SsnValidationRule extends ValidationRule {
  country?: 'US' | 'CA' | 'GB';
  allowTest?: boolean;
}

// Типы для валидации VAT
export interface VatValidationRule extends ValidationRule {
  country?: string;
  allowTest?: boolean;
}
