import { supabase } from '../config/supabase';
import { SubscriptionPlan } from '../config/subscriptionPlans';

/**
 * Plan display names (fallback - should come from database)
 * This is kept for backward compatibility, but database is now the source of truth
 */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: 'Explorer',
  basic: 'Creator',
  premium: 'Studio',
  enterprise: 'Business'
};

/**
 * Calculate credits for a plan based on price (200% margin)
 * 
 * Pricing Strategy:
 * - 200% margin: Revenue = 3.0 × Cost, so Max Cost = Price ÷ 3.0
 * - Credits maintain 200% margin for both images and videos:
 *   - Image: 1 credit = $0.039 cost (200% margin maintained)
 *   - Video: 12 credits/second = ~$0.15 cost/second × 3.0 = $0.45/second (200% margin maintained)
 */
export function calculateCreditsFromPrice(price: number): { monthlyCredits: number; displayCredits: number } {
  if (price === 0) {
    return { monthlyCredits: 10, displayCredits: 100 };
  }

  // 200% margin: Revenue = 3.0 × Cost, so Max Cost = Price ÷ 3.0
  const maxCost = price / 3.0;
  // Credits are universal and maintain 200% margin for both images and videos
  const monthlyCredits = Math.floor(maxCost / 0.039); // $0.039 per image

  // Calculate display credits with multipliers
  let displayCredits: number;
  if (price <= 20) {
    displayCredits = monthlyCredits * 10; // ~10x multiplier
  } else if (price <= 50) {
    displayCredits = monthlyCredits * 10; // ~10x multiplier
  } else if (price <= 100) {
    displayCredits = monthlyCredits * 9; // ~9x multiplier
  } else {
    displayCredits = monthlyCredits * 9; // ~9x multiplier
  }

  return { monthlyCredits, displayCredits };
}

/**
 * Get all active plans from database
 */
export async function getAllPlansFromDatabase(): Promise<SubscriptionPlan[]> {
  try {
    const { data: planRules, error } = await supabase
      .from('plan_rules')
      .select('*')
      .eq('is_active', true)
      .order('price_per_month', { ascending: true });

    if (error) {
      console.error('[getAllPlansFromDatabase] Error fetching plan rules:', error);
      return [];
    }

    if (!planRules || planRules.length === 0) {
      console.warn('[getAllPlansFromDatabase] No active plan rules found in database');
      return [];
    }

    const plans: SubscriptionPlan[] = planRules.map((planRule) => {
      const displayCredits = planRule.monthly_generations_limit || 0;
      const price = planRule.price_per_month || 0;
      let monthlyCredits = 0;
      if (price === 0) {
        monthlyCredits = 10; // Free plan
      } else {
        const maxCost = price / 3.0;
        monthlyCredits = Math.floor(maxCost / 0.039);
      }

      const displayName = planRule.display_name || PLAN_DISPLAY_NAMES[planRule.plan_name] || planRule.plan_name;
      const planDescription = planRule.description || `The ${displayName} plan with ${displayCredits.toLocaleString()} credits per month`;

      return {
        id: planRule.plan_name,
        name: planRule.plan_name,
        displayName,
        description: planDescription,
        price: {
          monthly: price,
          yearly: Math.round(price * 12 * 0.5)
        },
        features: {
          monthlyCredits,
          displayCredits
        },
        limits: {
          monthlyCredits,
          monthlyGenerations: monthlyCredits
        },
        stripe: {
          productId: planRule.stripe_product_id || undefined,
          monthlyPriceId: planRule.stripe_price_id || undefined,
          metadata: planRule.stripe_metadata || {}
        },
        billingCycle: 'monthly'
      };
    });

    return plans;
  } catch (error) {
    console.error('[getAllPlansFromDatabase] Error:', error);
    return [];
  }
}

/**
 * Get user's subscription plan from database plan_rules
 */
export async function getUserPlanFromDatabase(planName: string): Promise<SubscriptionPlan | null> {
  try {
    const { data: planRule, error } = await supabase
      .from('plan_rules')
      .select('*')
      .eq('plan_name', planName)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(`[getUserPlanFromDatabase] Error fetching plan rule for "${planName}":`, error);
      return null;
    }

    if (!planRule) {
      console.error(`[getUserPlanFromDatabase] Plan rule not found in database for: "${planName}"`);
      return null;
    }

    // Use monthly_generations_limit from database as display credits (what users see)
    // This is the single source of truth from the database
    const displayCredits = planRule.monthly_generations_limit || 0;
    
    // Calculate actual credits for billing (200% margin: Price ÷ 3.0 ÷ $0.039)
    const price = planRule.price_per_month || 0;
    let monthlyCredits = 0;
    if (price === 0) {
      monthlyCredits = 10; // Free plan
    } else {
      const maxCost = price / 3.0;
      monthlyCredits = Math.floor(maxCost / 0.039);
    }
    
    // Use display_name from database (single source of truth), fallback to hardcoded if not set
    const displayName = planRule.display_name || PLAN_DISPLAY_NAMES[planName] || planName;

    // Determine feature levels
    const isEnterprise = planName === 'enterprise';
    const isPremium = planName === 'premium';
    const isBasic = planName === 'basic';

    // Use description from database if available
    const planDescription = planRule.description || `The ${displayName} plan with ${displayCredits.toLocaleString()} credits per month`;
    
    const plan: SubscriptionPlan = {
      id: planName,
      name: planName,
      displayName,
      description: planDescription,
      price: {
        monthly: planRule.price_per_month || 0,
        yearly: Math.round((planRule.price_per_month || 0) * 12 * 0.5)
      },
      features: {
        monthlyCredits,
        displayCredits
      },
      limits: {
        monthlyCredits,
        monthlyGenerations: monthlyCredits
      },
      stripe: {
        productId: planRule.stripe_product_id || undefined,
        monthlyPriceId: planRule.stripe_price_id || undefined,
        metadata: planRule.stripe_metadata || {}
      },
      billingCycle: 'monthly'
    };

    return plan;
  } catch (error) {
    console.error('Error fetching plan from database:', error);
    return null;
  }
}

