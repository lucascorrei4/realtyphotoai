/**
 * Utility functions for conversion event tracking
 */

export interface ConversionMetadata {
  email: string;
  userAgent?: string;
  eventSourceUrl?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbp?: string;
  fbc?: string;
  externalId?: string;
}

/**
 * Extract UTM parameters from the current URL
 */
export function extractUtmParameters(): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
} {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utm: {
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
    } = {};

    const utmSource = urlParams.get('utm_source');
    if (utmSource) {
      utm.utm_source = utmSource;
    }

    const utmMedium = urlParams.get('utm_medium');
    if (utmMedium) {
      utm.utm_medium = utmMedium;
    }

    const utmCampaign = urlParams.get('utm_campaign');
    if (utmCampaign) {
      utm.utm_campaign = utmCampaign;
    }

    const utmContent = urlParams.get('utm_content');
    if (utmContent) {
      utm.utm_content = utmContent;
    }

    const utmTerm = urlParams.get('utm_term');
    if (utmTerm) {
      utm.utm_term = utmTerm;
    }

    return utm;
  } catch (error) {
    console.error('Failed to extract UTM parameters:', error);
    return {};
  }
}

/**
 * Get Facebook Pixel data from cookies
 */
export function getFacebookPixelData(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined') {
    return {};
  }

  const cookies = document.cookie.split(';');
  const result: { fbp?: string; fbc?: string } = {};

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === '_fbp') {
      result.fbp = decodeURIComponent(value);
    } else if (name === '_fbc') {
      result.fbc = decodeURIComponent(value);
    }
  }

  return result;
}

/**
 * Build conversion metadata from current browser context
 */
export function buildConversionMetadata(email: string, externalId?: string): ConversionMetadata {
  const utm = extractUtmParameters();
  const fbData = getFacebookPixelData();

  return {
    email,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    utmContent: utm.utm_content,
    utmTerm: utm.utm_term,
    fbp: fbData.fbp,
    fbc: fbData.fbc,
    externalId: externalId ?? email,
  };
}

/**
 * Send conversion event to backend
 * This is a fire-and-forget call - errors are logged but don't block the user flow
 */
export async function sendConversionEvent(
  endpoint: 'send-code' | 'verify-code',
  email: string,
  code?: string,
  metadata?: Partial<ConversionMetadata>
): Promise<void> {
  try {
    const backendUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
    const url = `${backendUrl}/api/v1/auth/${endpoint}`;

    const conversionMetadata = metadata ?? buildConversionMetadata(email);

    const body: Record<string, unknown> = {
      email,
      ...conversionMetadata,
    };

    if (code) {
      body.code = code;
    }

    // Fire and forget - don't await or throw errors
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).catch((error) => {
      // Silently log errors - conversion tracking should not block user flow
      console.debug('Conversion event tracking failed (non-blocking):', error);
    });
  } catch (error) {
    // Silently log errors - conversion tracking should not block user flow
    console.debug('Conversion event tracking error (non-blocking):', error);
  }
}

