import fetch, { Response } from 'node-fetch';
import { config } from '../config';
import { logger } from '../utils/logger';

export type ConversionEventType = 'Lead' | 'CompleteRegistration';

export interface ConversionEventPayload {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
  fbp?: string;
  fbc?: string;
  createdAt?: string;
  amount?: number;
  currency?: string;
  eventIdOverride?: string;
}

interface N8nWebhookBody {
  body: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    ip: string;
    user_agent: string;
    fbp: string;
    fbc: string;
    created_at: string;
    amount: number;
    currency: string;
    event_id: string;
  };
}

class ConversionEventService {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = config.n8nWebhookUrl;
  }

  async sendConversionEvent(event: ConversionEventType, payload: ConversionEventPayload): Promise<void> {
    if (!this.webhookUrl) {
      logger.warn('N8N webhook URL is not configured. Conversion event will not be sent.');
      return;
    }

    const requestBody = this.buildRequestBody(event, payload);

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      await this.handleResponse(response);
    } catch (error) {
      logger.error(`Failed to send ${event} conversion event to N8N webhook:`, error as Error);
    }
  }

  private buildRequestBody(event: ConversionEventType, payload: ConversionEventPayload): N8nWebhookBody {
    const {
      email,
      firstName,
      lastName,
      phone,
      ip,
      userAgent,
      fbp,
      fbc,
      createdAt,
      amount,
      currency,
      eventIdOverride,
    } = payload;

    const now = new Date().toISOString();

    return {
      body: {
        first_name: firstName ?? 'Unknown',
        last_name: lastName ?? 'User',
        email,
        phone: phone ?? '',
        ip: ip ?? '',
        user_agent: userAgent ?? '',
        fbp: fbp ?? '',
        fbc: fbc ?? '',
        created_at: createdAt ?? now,
        amount: amount ?? 0,
        currency: currency ?? 'USD',
        event_id: eventIdOverride ?? event,
      },
    };
  }

  private async handleResponse(response: Response): Promise<void> {
    if (response.ok) {
      return;
    }

    const responseText = await response.text();
    logger.error(
      `N8N webhook responded with status ${response.status}: ${response.statusText}. Body: ${responseText}`,
    );
  }
}

export const conversionEventService = new ConversionEventService();
export default conversionEventService;

