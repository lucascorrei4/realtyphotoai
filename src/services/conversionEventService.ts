import fetch, { Response } from 'node-fetch';
import { config } from '../config';
import { logger } from '../utils/logger';

export type ConversionEventType = 'Lead' | 'CompleteRegistration' | 'Purchase';

export interface UtmParameters {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

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
  eventTime?: number; // Unix timestamp (for Purchase events)
  amount?: number;
  value?: number; // Alternative to amount (for Purchase events)
  currency?: string;
  eventIdOverride?: string;
  actionSource?: string;
  eventSourceUrl?: string;
  externalId?: string;
  planId?: string; // For Purchase events
  planName?: string; // For Purchase events
  pixelId?: string; // For Purchase events
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
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
  created_at?: string; // For Lead/CompleteRegistration events
  event_time?: number; // Unix timestamp (for Purchase events)
  amount?: number; // For Lead/CompleteRegistration events
  value?: number; // For Purchase events
  currency: string;
  event_name: string;
  event_id?: string;
  action_source?: string;
  event_source_url?: string;
  external_id?: string;
  plan_id?: string; // For Purchase events
  plan_name?: string; // For Purchase events
  pixel_id?: string; // For Purchase events
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
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

export class ConversionEventService {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = config.n8nWebhookUrl;
  }

  /**
   * Extracts UTM parameters from a URL string
   * Supports both query string format and full URLs
   */
  static extractUtmParameters(url: string | undefined | null): UtmParameters {
    if (!url) {
      return {};
    }

    try {
      const urlObj = url.startsWith('http') ? new URL(url) : new URL(`https://example.com?${url}`);
      const params = urlObj.searchParams;

      const utm: UtmParameters = {};

      const utmSource = params.get('utm_source');
      if (utmSource) {
        utm.utm_source = utmSource;
      }

      const utmMedium = params.get('utm_medium');
      if (utmMedium) {
        utm.utm_medium = utmMedium;
      }

      const utmCampaign = params.get('utm_campaign');
      if (utmCampaign) {
        utm.utm_campaign = utmCampaign;
      }

      const utmContent = params.get('utm_content');
      if (utmContent) {
        utm.utm_content = utmContent;
      }

      const utmTerm = params.get('utm_term');
      if (utmTerm) {
        utm.utm_term = utmTerm;
      }

      return utm;
    } catch (error) {
      logger.debug('Failed to parse URL for UTM parameters:', { url, error });
      return {};
    }
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

    if (payloadOverrides.utmSource !== undefined) {
      effectivePayload.utmSource = payloadOverrides.utmSource;
    }

    if (payloadOverrides.utmMedium !== undefined) {
      effectivePayload.utmMedium = payloadOverrides.utmMedium;
    }

    if (payloadOverrides.utmCampaign !== undefined) {
      effectivePayload.utmCampaign = payloadOverrides.utmCampaign;
    }

    if (payloadOverrides.utmContent !== undefined) {
      effectivePayload.utmContent = payloadOverrides.utmContent;
    }

    if (payloadOverrides.utmTerm !== undefined) {
      effectivePayload.utmTerm = payloadOverrides.utmTerm;
    }

    if (payloadOverrides.eventTime !== undefined) {
      effectivePayload.eventTime = payloadOverrides.eventTime;
    }

    if (payloadOverrides.value !== undefined) {
      effectivePayload.value = payloadOverrides.value;
    }

    if (payloadOverrides.planId !== undefined) {
      effectivePayload.planId = payloadOverrides.planId;
    }

    if (payloadOverrides.planName !== undefined) {
      effectivePayload.planName = payloadOverrides.planName;
    }

    if (payloadOverrides.pixelId !== undefined) {
      effectivePayload.pixelId = payloadOverrides.pixelId;
    }

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
      eventTime,
      amount,
      value,
      currency,
      eventIdOverride,
      actionSource,
      eventSourceUrl,
      externalId,
      planId,
      planName,
      pixelId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
    } = payload;

    const now = new Date().toISOString();
    const isPurchaseEvent = event === 'Purchase';

    // Extract UTM parameters from eventSourceUrl if not explicitly provided
    let finalUtm: UtmParameters = {};
    if (eventSourceUrl) {
      const urlUtm = ConversionEventService.extractUtmParameters(eventSourceUrl);
      finalUtm = urlUtm;
    }

    // Explicit UTM parameters override URL-extracted ones
    if (utmSource) {
      finalUtm.utm_source = utmSource;
    }
    if (utmMedium) {
      finalUtm.utm_medium = utmMedium;
    }
    if (utmCampaign) {
      finalUtm.utm_campaign = utmCampaign;
    }
    if (utmContent) {
      finalUtm.utm_content = utmContent;
    }
    if (utmTerm) {
      finalUtm.utm_term = utmTerm;
    }

    // event_name is the event type (Lead, CompleteRegistration, or Purchase)
    // event_id can be used for custom event identifiers if needed
    const eventName = eventIdOverride ?? event;

    // Build base payload
    const body: N8nWebhookPayload = {
      first_name: firstName ?? 'Unknown',
      last_name: lastName ?? 'User',
      email,
      phone: phone ?? '',
      ip: ip ?? '',
      user_agent: userAgent ?? '',
      fbp: fbp ?? '',
      fbc: fbc ?? '',
      currency: currency ?? 'USD',
      event_name: eventName,
    };

    // For Purchase events, use event_time and value (matching n8n parser format)
    // For Lead/CompleteRegistration events, use created_at and amount
    if (isPurchaseEvent) {
      // Use eventTime if provided, otherwise convert createdAt to Unix timestamp, or use current time
      if (eventTime !== undefined) {
        body.event_time = eventTime;
      } else if (createdAt) {
        body.event_time = Math.floor(new Date(createdAt).getTime() / 1000);
      } else {
        body.event_time = Math.floor(Date.now() / 1000);
      }
      
      // Use value if provided, otherwise use amount, or default to 0
      body.value = value ?? amount ?? 0;
    } else {
      // Lead/CompleteRegistration events use created_at and amount
      body.created_at = createdAt ?? now;
      body.amount = amount ?? 0;
    }

    // Include event_id if eventIdOverride is provided (for custom event tracking)
    if (eventIdOverride && eventIdOverride !== event) {
      body.event_id = eventIdOverride;
    }

    if (actionSource) {
      body.action_source = actionSource;
    }

    if (eventSourceUrl) {
      body.event_source_url = eventSourceUrl;
    }

    if (externalId) {
      body.external_id = externalId;
    }

    // Purchase events include plan_id, plan_name, and pixel_id
    if (isPurchaseEvent) {
      if (planId) {
        body.plan_id = planId;
      }
      if (planName) {
        body.plan_name = planName;
      }
      if (pixelId) {
        body.pixel_id = pixelId;
      }
    }

    // Add UTM parameters if any are present
    if (finalUtm.utm_source) {
      body.utm_source = finalUtm.utm_source;
    }
    if (finalUtm.utm_medium) {
      body.utm_medium = finalUtm.utm_medium;
    }
    if (finalUtm.utm_campaign) {
      body.utm_campaign = finalUtm.utm_campaign;
    }
    if (finalUtm.utm_content) {
      body.utm_content = finalUtm.utm_content;
    }
    if (finalUtm.utm_term) {
      body.utm_term = finalUtm.utm_term;
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

