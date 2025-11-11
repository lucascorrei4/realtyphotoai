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
  actionSource?: string;
  eventSourceUrl?: string;
  externalId?: string;
}

interface N8nWebhookPayload {
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
  action_source?: string;
  event_source_url?: string;
  external_id?: string;
}

export interface ConversionEventTestResult {
  event: ConversionEventType;
  webhookUrl: string | undefined;
  requestBody: N8nWebhookPayload;
  success: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  responseBody?: unknown;
  rawResponseBody?: string;
  errorMessage?: string;
  timestamp: string;
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

    const requestPayload = this.buildRequestPayload(event, payload);

    try {
      const response = await this.postToWebhook(requestPayload);
      await this.handleResponse(response);
    } catch (error) {
      logger.error(`Failed to send ${event} conversion event to N8N webhook:`, error as Error);
    }
  }

  async sendTestConversionEvent(
    event: ConversionEventType,
    payloadOverrides: Partial<ConversionEventPayload> = {},
  ): Promise<ConversionEventTestResult> {
    const effectivePayload: ConversionEventPayload = {
      email: payloadOverrides.email ?? `test+${Date.now()}@realtyphotoai.com`,
    };

    if (payloadOverrides.firstName !== undefined) {
      effectivePayload.firstName = payloadOverrides.firstName;
    }

    if (payloadOverrides.lastName !== undefined) {
      effectivePayload.lastName = payloadOverrides.lastName;
    }

    if (payloadOverrides.phone !== undefined) {
      effectivePayload.phone = payloadOverrides.phone;
    }

    effectivePayload.ip = payloadOverrides.ip ?? '127.0.0.1';
    effectivePayload.userAgent = payloadOverrides.userAgent ?? 'RealtyPhotoAI-Test/1.0';

    if (payloadOverrides.fbp !== undefined) {
      effectivePayload.fbp = payloadOverrides.fbp;
    }

    if (payloadOverrides.fbc !== undefined) {
      effectivePayload.fbc = payloadOverrides.fbc;
    }

    if (payloadOverrides.createdAt !== undefined) {
      effectivePayload.createdAt = payloadOverrides.createdAt;
    }

    if (payloadOverrides.amount !== undefined) {
      effectivePayload.amount = payloadOverrides.amount;
    }

    if (payloadOverrides.currency !== undefined) {
      effectivePayload.currency = payloadOverrides.currency;
    }

    if (payloadOverrides.eventIdOverride !== undefined) {
      effectivePayload.eventIdOverride = payloadOverrides.eventIdOverride;
    }

    if (payloadOverrides.actionSource !== undefined) {
      effectivePayload.actionSource = payloadOverrides.actionSource;
    }

    if (payloadOverrides.eventSourceUrl !== undefined) {
      effectivePayload.eventSourceUrl = payloadOverrides.eventSourceUrl;
    }

    effectivePayload.externalId = payloadOverrides.externalId ?? effectivePayload.email;

    const requestPayload = this.buildRequestPayload(event, effectivePayload);
    const timestamp = new Date().toISOString();

    if (!this.webhookUrl) {
      const errorMessage = 'N8N webhook URL is not configured. Cannot send test conversion event.';
      logger.warn(errorMessage);
      return {
        event,
        webhookUrl: this.webhookUrl,
        requestBody: requestPayload,
        success: false,
        status: 503,
        statusText: 'SERVICE_UNAVAILABLE',
        durationMs: 0,
        errorMessage,
        timestamp,
      };
    }

    const start = Date.now();

    try {
      const response = await this.postToWebhook(requestPayload);
      const rawResponseBody = await response.text();
      const parsedResponse = this.safeParseJson(rawResponseBody);
      const durationMs = Date.now() - start;

      if (!response.ok) {
        logger.error(
          `N8N webhook test responded with status ${response.status}: ${response.statusText}. Body: ${rawResponseBody}`,
        );
      }

      return {
        event,
        webhookUrl: this.webhookUrl,
        requestBody: requestPayload,
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        responseBody: parsedResponse,
        rawResponseBody,
        timestamp,
      };
    } catch (error) {
      const durationMs = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error sending test conversion event';
      logger.error(`Failed to send ${event} test conversion event to N8N webhook:`, error as Error);

      return {
        event,
        webhookUrl: this.webhookUrl,
        requestBody: requestPayload,
        success: false,
        status: 0,
        statusText: 'NETWORK_ERROR',
        durationMs,
        errorMessage,
        timestamp,
      };
    }
  }

  private buildRequestPayload(event: ConversionEventType, payload: ConversionEventPayload): N8nWebhookPayload {
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
      actionSource,
      eventSourceUrl,
      externalId,
    } = payload;

    const now = new Date().toISOString();

    const body: N8nWebhookPayload = {
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
    };

    if (actionSource) {
      body.action_source = actionSource;
    }

    if (eventSourceUrl) {
      body.event_source_url = eventSourceUrl;
    }

    if (externalId) {
      body.external_id = externalId;
    }

    return body;
  }

  private async postToWebhook(requestPayload: N8nWebhookPayload): Promise<Response> {
    if (!this.webhookUrl) {
      throw new Error('N8N webhook URL is not configured.');
    }

    return fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });
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

  private safeParseJson(text: string): unknown {
    if (!text || !text.trim()) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      logger.debug('Failed to parse JSON from N8N webhook response:', { error });
      return undefined;
    }
  }
}

export const conversionEventService = new ConversionEventService();
export default conversionEventService;

