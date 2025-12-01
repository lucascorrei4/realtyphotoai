import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface PlanRule {
  id: string;
  plan_name: 'free' | 'basic' | 'premium' | 'enterprise';
  display_name?: string; // Unique display name from database
  description?: string; // Plan description from database
  monthly_generations_limit: number;
  concurrent_generations: number;
  allowed_models: string[];
  price_per_month: number;
  features: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stripe_product_id?: string;
  stripe_price_id?: string;
  stripe_monthly_price_id?: string;
  stripe_yearly_price_id?: string;
  stripe_metadata?: Record<string, any>;
}

/**
 * Plan display names (fallback - database is now the source of truth)
 * This is kept for backward compatibility
 */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: 'Explorer',
  basic: 'Creator',
  premium: 'Studio',
  enterprise: 'Business'
};

/**
 * Map database plan names to credit-based plan IDs
 */
export const PLAN_MAPPING: Record<string, string> = {
  free: 'explorer',
  basic: 'creator',
  premium: 'studio',
  enterprise: 'business'
};

export function mapPlanIdToPlanName(planId: string): string {
  const entry = Object.entries(PLAN_MAPPING).find(([, mappedId]) => mappedId === planId);
  return entry ? entry[0] : planId;
}

export function mapPlanNameToPlanId(planName: string): string {
  return PLAN_MAPPING[planName] || planName;
}

export class PlanRulesService {
  /**
   * Get all active plan rules
   */
  async getAllPlanRules(): Promise<PlanRule[]> {
    try {
      const { data, error } = await supabase
        .from('plan_rules')
        .select('*')
        .eq('is_active', true)
        .order('price_per_month', { ascending: true });

      if (error) {
        logger.error('Error fetching plan rules:', error);
        throw new Error('Failed to fetch plan rules');
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getAllPlanRules:', error as Error);
      throw error;
    }
  }

  /**
   * Get plan rule by plan name
   */
  async getPlanRule(planNameOrId: string): Promise<PlanRule | null> {
    try {
      const planName = mapPlanIdToPlanName(planNameOrId);
      const { data, error } = await supabase
        .from('plan_rules')
        .select('*')
        .eq('plan_name', planName)
        .eq('is_active', true)
        .single();

      if (error) {
        logger.error('Error fetching plan rule:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error in getPlanRule:', error as Error);
      return null;
    }
  }

  /**
   * Calculate credits for a plan based on monthly_generations_limit
   * Uses 200% margin: Revenue = 3.0 × Cost
   * Max cost = Price ÷ 3.0
   * Max credits = Max cost ÷ $0.039 (image cost)
   * 
   * Note: Credits can be used for both images and videos:
   * - Image: 1 credit = $0.039 cost (maintains 200% margin)
   * - Video: 12 credits/second = ~$0.15 cost/second × 3.0 margin = $0.45/second charge
   * Both maintain the same 200% profit margin
   * 
   * IMPORTANT: displayCredits comes from monthly_generations_limit in the database
   * This is the single source of truth for what users see
   */
  calculateCreditsForPlan(planRule: PlanRule): {
    monthlyCredits: number;
    displayCredits: number;
  } {
    const price = planRule.price_per_month;
    
    // Use monthly_generations_limit from database as displayCredits (single source of truth)
    // This is what users see and what should be used for credit validation
    let displayCredits = planRule.monthly_generations_limit || 0;
    
    // For free plan, give minimal credits
    // 300 credits allows: 1 image (40) + 1 video (240) = 280, with 20 credits buffer
    if (price === 0) {
      return {
        monthlyCredits: 10, // 10 actual credits
        displayCredits: displayCredits || 300 // Use database value or fallback to 300 (allows 1 image + 1 video)
      };
    }

    // Calculate max cost for 200% margin: Price ÷ 3.0
    const maxCost = price / 3.0;
    
    // Calculate max credits: Max cost ÷ $0.039 per image
    // Credits are universal and maintain 200% margin for both images and videos
    const monthlyCredits = Math.floor(maxCost / 0.039);

    // If displayCredits is 0 or null from database, calculate it based on price (fallback)
    // This should rarely happen if database is configured correctly
    if (displayCredits === 0) {
      logger.warn(`monthly_generations_limit is 0 for plan ${planRule.plan_name}, calculating from price`, {
        planName: planRule.plan_name,
        price,
        monthlyGenerationsLimit: planRule.monthly_generations_limit
      });
      // Calculate display credits based on plan tier (fallback calculation)
      if (price <= 20) {
        displayCredits = monthlyCredits * 10;
      } else if (price <= 50) {
        displayCredits = monthlyCredits * 10;
      } else if (price <= 100) {
        displayCredits = monthlyCredits * 9;
      } else {
        displayCredits = monthlyCredits * 9;
      }
    }

    return {
      monthlyCredits,
      displayCredits
    };
  }

  /**
   * Convert plan rule to subscription plan format
   */
  convertToSubscriptionPlan(planRule: PlanRule): any {
    const credits = this.calculateCreditsForPlan(planRule);
    // Use display_name from database (single source of truth), fallback if not set
    const displayName = (planRule as any).display_name || PLAN_DISPLAY_NAMES[planRule.plan_name] || planRule.plan_name;
    
    // Determine quality and features based on plan
    const isEnterprise = planRule.plan_name === 'enterprise';
    const isPremium = planRule.plan_name === 'premium';
    const isBasic = planRule.plan_name === 'basic';
    
    const metadata = planRule.stripe_metadata || {};
    const metadataStrings: Record<string, string> = Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : JSON.stringify(value)
      ])
    );

    return {
        id: PLAN_MAPPING[planRule.plan_name] || planRule.plan_name,
        name: PLAN_MAPPING[planRule.plan_name] || planRule.plan_name,
        displayName,
        description: this.getPlanDescription(planRule.plan_name, planRule),
      price: {
        monthly: planRule.price_per_month,
        yearly: Math.round(planRule.price_per_month * 12 * 0.5) // 50% discount
      },
      features: {
        monthlyCredits: credits.monthlyCredits,
        displayCredits: credits.displayCredits,
        aiPhotos: credits.monthlyCredits, // Backward compatibility
        aiModels: isEnterprise ? 50 : isPremium ? 10 : isBasic ? 3 : 1,
        quality: isEnterprise ? 'ultra' : isPremium ? 'high' : isBasic ? 'medium' : 'low',
        likeness: isEnterprise ? 'ultra' : isPremium ? 'high' : isBasic ? 'medium' : 'low',
        parallelProcessing: planRule.concurrent_generations || 1,
        commercialUse: !isBasic && planRule.plan_name !== 'free',
        importPhotos: !isBasic && planRule.plan_name !== 'free',
        customPrompts: !isBasic && planRule.plan_name !== 'free',
        photoRemix: !isBasic && planRule.plan_name !== 'free',
        photoEditing: isPremium || isEnterprise,
        photoCrop: isPremium || isEnterprise,
        photoZoom: isPremium || isEnterprise,
        aiVideos: isPremium || isEnterprise,
        loraSupport: isPremium || isEnterprise,
        photoRelight: isPremium || isEnterprise,
        unlimitedStorage: isEnterprise,
        priorityProcessing: isPremium || isEnterprise,
        modelExport: isEnterprise,
        freeAutoGenerated: isEnterprise ? 2400 : isPremium ? 2400 : isBasic ? 144 : 48,
        watermark: planRule.plan_name === 'free'
      },
      limits: {
        monthlyCredits: credits.monthlyCredits,
        monthlyGenerations: credits.monthlyCredits, // Backward compatibility
        concurrentGenerations: planRule.concurrent_generations || 1,
        storageLimit: isEnterprise ? -1 : isPremium ? 20 : isBasic ? 5 : 1
      },
      stripe: {
        productId: planRule.stripe_product_id,
        monthlyPriceId: planRule.stripe_monthly_price_id || planRule.stripe_price_id,
        yearlyPriceId: planRule.stripe_yearly_price_id,
        metadata: metadataStrings
      },
      billingCycle: 'monthly'
    };
  }

  /**
   * Get plan description
   * Database is now the source of truth - this is fallback only
   */
  private getPlanDescription(planName: string, planRule?: PlanRule): string {
    // Use description from database if available
    if (planRule && (planRule as any).description) {
      return (planRule as any).description;
    }
    
    // Fallback to hardcoded descriptions
    const descriptions: Record<string, string> = {
      free: 'Start exploring AI photo generation with our free tier. Perfect for trying out the platform.',
      basic: 'Create amazing AI photos with essential features. Perfect for personal projects and small businesses.',
      premium: 'Professional-grade AI photo generation with advanced features. Ideal for content creators and agencies.',
      enterprise: 'Enterprise-level access with unlimited capabilities. Built for studios and large-scale operations.'
    };
    return descriptions[planName] || 'AI photo generation plan';
  }

  /**
   * Get subscription plan for user based on their plan_name from database
   */
  async getUserSubscriptionPlan(userPlanName: string): Promise<any> {
    try {
      const planRule = await this.getPlanRule(userPlanName);
      if (!planRule) {
        // Fallback to default plan
        logger.warn(`Plan rule not found for: ${userPlanName}, using default`);
        const defaultPlan = this.getDefaultPlan(userPlanName);
        logger.info(`Using default plan for ${userPlanName}`, {
          displayCredits: defaultPlan.features?.displayCredits,
          monthlyCredits: defaultPlan.features?.monthlyCredits
        });
        return defaultPlan;
      }
      
      const subscriptionPlan = this.convertToSubscriptionPlan(planRule);
      logger.info(`Retrieved plan for ${userPlanName}`, {
        displayCredits: subscriptionPlan.features?.displayCredits,
        monthlyCredits: subscriptionPlan.features?.monthlyCredits,
        monthlyGenerationsLimit: planRule.monthly_generations_limit,
        price: planRule.price_per_month
      });
      return subscriptionPlan;
    } catch (error) {
      logger.error('Error getting user subscription plan:', error as Error);
      const defaultPlan = this.getDefaultPlan(userPlanName);
      logger.info(`Using default plan (error fallback) for ${userPlanName}`, {
        displayCredits: defaultPlan.features?.displayCredits,
        monthlyCredits: defaultPlan.features?.monthlyCredits
      });
      return defaultPlan;
    }
  }

  /**
   * Get default plan (fallback)
   */
  private getDefaultPlan(planName: string): any {
    // Default mappings based on plan_rules data
    const defaults: Record<string, any> = {
      free: {
        monthlyCredits: 10,
        displayCredits: 300, // Allows 1 image (40) + 1 video (240) = 280, with 20 credits buffer
        price: 0
      },
      basic: {
        monthlyCredits: 84,
        displayCredits: 800,
        price: 19.99
      },
      premium: {
        monthlyCredits: 426,
        displayCredits: 4000,
        price: 49.99
      },
      enterprise: {
        monthlyCredits: 1708,
        displayCredits: 16000,
        price: 199.99
      }
    };

    const defaultPlan = defaults[planName] || defaults.free;
    
    return {
      id: PLAN_MAPPING[planName] || planName,
      name: PLAN_MAPPING[planName] || planName,
      displayName: PLAN_DISPLAY_NAMES[planName] || planName,
      features: {
        monthlyCredits: defaultPlan.monthlyCredits,
        displayCredits: defaultPlan.displayCredits,
        aiPhotos: defaultPlan.monthlyCredits
      },
      limits: {
        monthlyCredits: defaultPlan.monthlyCredits,
        monthlyGenerations: defaultPlan.monthlyCredits
      }
    };
  }
}

export default new PlanRulesService();

