/**
 * AI Translation Service
 * Использует OpenAI API для перевода и адаптации описаний продуктов
 * с английского на русский язык с сохранением стиля и привлекательности
 */

interface TranslationOptions {
  preserveStyle?: boolean; // Сохранить маркетинговый стиль
  targetAudience?: 'general' | 'luxury' | 'natural'; // Целевая аудитория
  enhanceDescription?: boolean; // Улучшить описание, сделать его более привлекательным
}

export class AITranslationService {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    
    if (!this.apiKey) {
      console.log('ℹ️  AI Translation Service: Disabled (no OPENAI_API_KEY provided)');
    } else {
      console.log('✅ AI Translation Service: Enabled');
    }
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Переводит и адаптирует описание продукта с английского на русский
   */
  async translateProductDescription(
    englishText: string,
    productType: string = 'cosmetic',
    options: TranslationOptions = {}
  ): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('AI Translation Service is not configured. Please set OPENAI_API_KEY.');
    }

    if (!englishText || englishText.trim().length === 0) {
      return '';
    }

    const {
      preserveStyle = true,
      targetAudience = 'natural',
      enhanceDescription = true
    } = options;

    // Формируем промпт для AI
    const prompt = this.buildTranslationPrompt(
      englishText,
      productType,
      preserveStyle,
      targetAudience,
      enhanceDescription
    );

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Ты профессиональный копирайтер и переводчик, специализирующийся на косметических и органических продуктах. Твоя задача - создавать привлекательные, естественные и продающие описания на русском языке.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      const translatedText = data.choices?.[0]?.message?.content?.trim();

      if (!translatedText) {
        throw new Error('No translation received from AI');
      }

      return translatedText;
    } catch (error) {
      console.error('AI Translation error:', error);
      throw error;
    }
  }

  /**
   * Строит промпт для перевода
   */
  private buildTranslationPrompt(
    text: string,
    productType: string,
    preserveStyle: boolean,
    targetAudience: string,
    enhanceDescription: boolean
  ): string {
    let prompt = `Переведи и адаптируй следующее описание продукта с английского на русский язык:\n\n"${text}"\n\n`;

    prompt += `Тип продукта: ${productType}\n`;
    prompt += `Целевая аудитория: ${targetAudience === 'luxury' ? 'премиум сегмент' : targetAudience === 'natural' ? 'приверженцы натуральной косметики' : 'широкая аудитория'}\n\n`;

    if (enhanceDescription) {
      prompt += `Важные требования:\n`;
      prompt += `- Сделай описание более привлекательным и продающим\n`;
      prompt += `- Используй яркие, но естественные формулировки\n`;
      prompt += `- Подчеркни преимущества и уникальность продукта\n`;
      prompt += `- Добавь эмоциональную окраску, но сохрани достоверность\n`;
      prompt += `- Используй язык, который вызывает желание приобрести продукт\n`;
    }

    if (preserveStyle) {
      prompt += `- Сохрани маркетинговый стиль оригинала\n`;
      prompt += `- Если в оригинале есть акценты на натуральность, органичность, экологичность - подчеркни это\n`;
    }

    prompt += `\nРезультат должен быть:\n`;
    prompt += `- На русском языке\n`;
    prompt += `- Естественным и читаемым\n`;
    prompt += `- Подходящим для описания косметического/органического продукта\n`;
    prompt += `- Без технических терминов в латинском языке (кроме названий ингредиентов, если необходимо)\n`;
    prompt += `- Привлекательным для целевой аудитории\n\n`;
    prompt += `Верни только переведенный и адаптированный текст, без дополнительных комментариев.`;

    return prompt;
  }

  /**
   * Переводит краткое описание (summary)
   */
  async translateSummary(
    englishSummary: string,
    productName: string = ''
  ): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('AI Translation Service is not configured. Please set OPENAI_API_KEY.');
    }

    if (!englishSummary || englishSummary.trim().length === 0) {
      return '';
    }

    const prompt = `Переведи и адаптируй краткое описание продукта "${productName}" с английского на русский язык.\n\n` +
      `Оригинал: "${englishSummary}"\n\n` +
      `Требования:\n` +
      `- Краткое, емкое описание (2-3 предложения)\n` +
      `- Привлекательное и продающее\n` +
      `- Подчеркни главное преимущество продукта\n` +
      `- Естественный русский язык\n\n` +
      `Верни только переведенный текст, без дополнительных комментариев.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Ты профессиональный копирайтер, специализирующийся на косметических продуктах.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || englishSummary;
    } catch (error) {
      console.error('AI Summary translation error:', error);
      throw error;
    }
  }

  /**
   * Переводит название продукта
   */
  async translateTitle(
    englishTitle: string
  ): Promise<string> {
    if (!this.isEnabled()) {
      throw new Error('AI Translation Service is not configured. Please set OPENAI_API_KEY.');
    }

    if (!englishTitle || englishTitle.trim().length === 0) {
      return '';
    }

    const prompt = `Переведи название косметического продукта с английского на русский язык.\n\n` +
      `Оригинал: "${englishTitle}"\n\n` +
      `Требования:\n` +
      `- Естественный перевод, подходящий для косметического продукта\n` +
      `- Сохрани брендовые названия, если они есть\n` +
      `- Если название содержит специфические термины, переведи их понятно\n` +
      `- Результат должен звучать привлекательно на русском\n\n` +
      `Верни только переведенное название, без дополнительных комментариев.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Ты переводчик косметических продуктов.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 100,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || englishTitle;
    } catch (error) {
      console.error('AI Title translation error:', error);
      throw error;
    }
  }
}

export const aiTranslationService = new AITranslationService();

