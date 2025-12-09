/**
 * Get the appropriate Stripe secret key based on environment
 * Uses STRIPE_SECRET_KEY_TEST in development mode if available
 * Falls back to STRIPE_SECRET_KEY otherwise
 */
export function getStripeSecretKey(): string {
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  // In development, prefer STRIPE_SECRET_KEY_TEST if available
  if (isDevelopment && process.env.STRIPE_SECRET_KEY_TEST) {
    return process.env.STRIPE_SECRET_KEY_TEST;
  }
  
  // Otherwise use STRIPE_SECRET_KEY (works for both test and production keys)
  const key = process.env.STRIPE_SECRET_KEY;
  
  if (!key) {
    throw new Error(
      `Stripe secret key is required. Set STRIPE_SECRET_KEY${isDevelopment ? ' or STRIPE_SECRET_KEY_TEST' : ''} environment variable.`
    );
  }
  
  return key;
}

