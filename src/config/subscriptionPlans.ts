export interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: {
    monthlyCredits: number; // Primary credit allocation per month (actual limit for billing)
    displayCredits: number; // Displayed credits to users (doesn't affect billing/limits)
    aiPhotos: number; // Deprecated: kept for backward compatibility, equals monthlyCredits
  };
  limits: {
    monthlyCredits: number; // Primary limit: monthly credits
    monthlyGenerations: number; // Deprecated: kept for backward compatibility, equals monthlyCredits
  };
  stripe: {
    productId?: string;
    monthlyPriceId?: string;
    yearlyPriceId?: string;
    metadata: Record<string, string>;
  };
  popular?: boolean;
  billingCycle: 'monthly' | 'yearly';
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  starter: {
    id: 'starter',
    name: 'starter',
    displayName: 'Starter',
    description: 'Get started with basic AI photos, create your first model, and begin your AI photography journey.',
    price: {
      monthly: 9.90, // 200% margin: $3.30 cost × 3.0 = $9.90
      yearly: 99 // 6+ months free (calculated as monthly * 12 * 0.5)
    },
    features: {
      monthlyCredits: 84, // Actual limit for billing: $9.90 ÷ 3.0 = $3.30 max cost = 84 credits
      displayCredits: 800, // Displayed to users (doesn't affect actual billing/limits)
      aiPhotos: 84,// Equals monthlyCredits for backward compatibility
    },
    limits: {
      monthlyCredits: 84,
      monthlyGenerations: 84, // Equals monthlyCredits for backward compatibility
    },
    stripe: {
      metadata: {
        plan_type: 'starter',
        model_type: 'flux_basic',
        quality_level: 'low',
        commercial_use: 'false'
      }
    },
    billingCycle: 'monthly'
  },
  pro: {
    id: 'pro',
    name: 'pro',
    displayName: 'Pro',
    description: 'Boost your creativity with higher quality photos, parallel processing, and commercial usage rights.',
    price: {
      monthly: 29.90, // 200% margin: $9.97 cost × 3.0 = $29.90
      yearly: 299 // ~5 months free (calculated as monthly * 12 * 0.5)
    },
    features: {
      monthlyCredits: 255, // Actual limit for billing: $29.90 ÷ 3.0 = $9.97 max cost = 255 credits
      displayCredits: 2500, // Displayed to users (doesn't affect actual billing/limits)
      aiPhotos: 255, // Equals monthlyCredits for backward compatibility
    },
    limits: {
      monthlyCredits: 255,
      monthlyGenerations: 255, // Equals monthlyCredits for backward compatibility
    },
    stripe: {
      metadata: {
        plan_type: 'pro',
        model_type: 'flux_standard',
        quality_level: 'medium',
        commercial_use: 'true'
      }
    },
    billingCycle: 'monthly'
  },
  premium: {
    id: 'premium',
    name: 'premium',
    displayName: 'Premium',
    description: 'Get more photos, more models, more features, and higher quality photos with our most popular plan.',
    price: {
      monthly: 49.90, // 200% margin: $16.63 cost × 3.0 = $49.90
      yearly: 499 // ~6 months free (calculated as monthly * 12 * 0.5)
    },
    features: {
      monthlyCredits: 426, // Actual limit for billing: $49.90 ÷ 3.0 = $16.63 max cost = 426 credits
      displayCredits: 4000, // Displayed to users (doesn't affect actual billing/limits)
      aiPhotos: 426, // Equals monthlyCredits for backward compatibility
    },
    limits: {
      monthlyCredits: 426,
      monthlyGenerations: 426, // Equals monthlyCredits for backward compatibility
    },
    stripe: {
      metadata: {
        plan_type: 'premium',
        model_type: 'flux_hd',
        quality_level: 'high',
        commercial_use: 'true'
      }
    },
    popular: true,
    billingCycle: 'monthly'
  },
  ultra: {
    id: 'ultra',
    name: 'ultra',
    displayName: 'Ultra',
    description: 'Get our highest level of access with ultra-fast processing and enterprise-level performance.',
    price: {
      monthly: 99.90, // 200% margin: $33.30 cost × 3.0 = $99.90
      yearly: 999 // 6+ months free (calculated as monthly * 12 * 0.5)
    },
    features: {
      monthlyCredits: 854, // Actual limit for billing: $99.90 ÷ 3.0 = $33.30 max cost = 854 credits
      displayCredits: 8000, // Displayed to users (doesn't affect actual billing/limits)
      aiPhotos: 854, // Equals monthlyCredits for backward compatibility
    },
    limits: {
      monthlyCredits: 854,
      monthlyGenerations: 854, // Equals monthlyCredits for backward compatibility
    },
    stripe: {
      metadata: {
        plan_type: 'ultra',
        model_type: 'flux_hd',
        quality_level: 'ultra',
        commercial_use: 'true'
      }
    },
    billingCycle: 'monthly'
  }
};

export const PLAN_FEATURES_DISPLAY = {
  quality: {
    low: 'Low Quality Photos',
    medium: 'Medium Quality Photos',
    high: 'High Quality Photos',
    ultra: 'Ultra Quality Photos'
  },
  likeness: {
    low: 'Low Likeness',
    medium: 'Medium Likeness',
    high: 'High Likeness',
    ultra: 'Ultra-High Likeness'
  },
  parallelProcessing: {
    1: 'Take 1 photo at a time',
    4: 'Take up to 4 photos in parallel',
    8: 'Take up to 8 photos in parallel',
    16: 'Take up to 16 photos in parallel'
  } as Record<number, string>
};

export const BILLING_CYCLES = {
  monthly: {
    label: 'Monthly',
    discount: 0
  },
  yearly: {
    label: 'Yearly: get 6+ months free',
    discount: 0.5 // 50% discount (6 months free)
  }
};

// Helper functions
export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS[planId];
}

export function getPlansByBillingCycle(cycle: 'monthly' | 'yearly'): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS).map(plan => ({
    ...plan,
    billingCycle: cycle,
    price: {
      monthly: plan.price.monthly,
      yearly: cycle === 'yearly' ? Math.round(plan.price.monthly * 12 * 0.5) : plan.price.yearly
    }
  }));
}

export function calculateYearlySavings(monthlyPrice: number): number {
  const yearlyPrice = Math.round(monthlyPrice * 12 * 0.5);
  const fullYearlyPrice = monthlyPrice * 12;
  return fullYearlyPrice - yearlyPrice;
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
}

export function getFeatureList(plan: SubscriptionPlan): string[] {
  const features: string[] = [];

  // Core features - Credit-based system
  // Use displayCredits for user-facing info, but actual limits use monthlyCredits
  const displayCredits = plan.features.displayCredits || plan.features.monthlyCredits;
  const actualCredits = plan.features.monthlyCredits;
  features.push(`${displayCredits.toLocaleString()} Credits per month`);
  features.push(`~${actualCredits.toLocaleString()} images OR ~${Math.floor(actualCredits / 15).toLocaleString()} videos (16s) OR mix`);

  return features;
}

/**
 * Credit cost constants for different generation types
 * These define how many credits each generation type costs
 */
export const CREDIT_COSTS = {
  IMAGE: 1, // 1 credit per image
  VIDEO_PER_SECOND: 15, // 15 credits per second of video
} as const;

/**
 * Calculate credits required for a video generation
 */
export function getVideoCredits(durationSeconds: number): number {
  return Math.ceil(durationSeconds * CREDIT_COSTS.VIDEO_PER_SECOND);
}

/**
 * Calculate credits required for image generation
 */
export function getImageCredits(count: number = 1): number {
  return count * CREDIT_COSTS.IMAGE;
}

/**
 * Calculate display credits used based on actual credits used
 * This converts actual credit usage to display credit usage proportionally
 */
export function getDisplayCreditsUsed(actualCreditsUsed: number, actualCreditsTotal: number, displayCreditsTotal: number): number {
  if (actualCreditsTotal === 0) return 0;
  const ratio = displayCreditsTotal / actualCreditsTotal;
  return Math.ceil(actualCreditsUsed * ratio);
}

/**
 * Calculate remaining display credits after usage
 */
export function getRemainingDisplayCredits(actualCreditsUsed: number, plan: SubscriptionPlan): number {
  const actualCreditsTotal = plan.features.monthlyCredits;
  const displayCreditsTotal = plan.features.displayCredits || actualCreditsTotal;
  const displayCreditsUsed = getDisplayCreditsUsed(actualCreditsUsed, actualCreditsTotal, displayCreditsTotal);
  return Math.max(0, displayCreditsTotal - displayCreditsUsed);
}

/**
 * Get usage summary for display
 */
export function getCreditUsageSummary(actualCreditsUsed: number, plan: SubscriptionPlan): {
  displayCreditsTotal: number;
  displayCreditsUsed: number;
  displayCreditsRemaining: number;
  actualCreditsTotal: number;
  actualCreditsUsed: number;
  actualCreditsRemaining: number;
} {
  const actualCreditsTotal = plan.features.monthlyCredits;
  const displayCreditsTotal = plan.features.displayCredits || actualCreditsTotal;
  const displayCreditsUsed = getDisplayCreditsUsed(actualCreditsUsed, actualCreditsTotal, displayCreditsTotal);
  const displayCreditsRemaining = Math.max(0, displayCreditsTotal - displayCreditsUsed);
  const actualCreditsRemaining = Math.max(0, actualCreditsTotal - actualCreditsUsed);

  return {
    displayCreditsTotal,
    displayCreditsUsed,
    displayCreditsRemaining,
    actualCreditsTotal,
    actualCreditsUsed,
    actualCreditsRemaining
  };
}

export default SUBSCRIPTION_PLANS;
