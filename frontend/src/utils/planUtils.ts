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
 */
export function calculateCreditsFromPrice(price: number): { monthlyCredits: number; displayCredits: number } {
  if (price === 0) {
    return { monthlyCredits: 10, displayCredits: 100 };
  }

  // 200% margin: Revenue = 3.0 × Cost, so Max Cost = Price ÷ 3.0
  const maxCost = price / 3.0;
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

    if (error || !planRule) {
      console.error('Plan rule not found:', planName);
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
    
    return {
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
  } catch (error) {
    console.error('Error fetching plan from database:', error);
    return null;
  }
}

