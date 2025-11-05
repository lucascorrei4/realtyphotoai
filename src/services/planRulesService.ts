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
  async getPlanRule(planName: string): Promise<PlanRule | null> {
    try {
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
   */
  calculateCreditsForPlan(planRule: PlanRule): {
    monthlyCredits: number;
    displayCredits: number;
  } {
    const price = planRule.price_per_month;
    
    // For free plan, give minimal credits
    if (price === 0) {
      return {
        monthlyCredits: 10, // 10 actual credits
        displayCredits: 100 // 100 display credits (10x multiplier)
      };
    }

    // Calculate max cost for 200% margin: Price ÷ 3.0
    const maxCost = price / 3.0;
    
    // Calculate max credits: Max cost ÷ $0.039 per image
    const monthlyCredits = Math.floor(maxCost / 0.039);
    
    // Calculate display credits based on plan tier
    // Use multipliers to make numbers attractive
    let displayCredits: number;
    if (price <= 20) {
      // Starter tier: 10x multiplier
      displayCredits = monthlyCredits * 10;
    } else if (price <= 50) {
      // Pro tier: 10x multiplier
      displayCredits = monthlyCredits * 10;
    } else if (price <= 100) {
      // Premium tier: 9x multiplier
      displayCredits = monthlyCredits * 9;
    } else {
      // Enterprise tier: 9x multiplier
      displayCredits = monthlyCredits * 9;
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
        monthlyPriceId: planRule.stripe_price_id,
        metadata: planRule.stripe_metadata || {}
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
        return this.getDefaultPlan(userPlanName);
      }
      
      return this.convertToSubscriptionPlan(planRule);
    } catch (error) {
      logger.error('Error getting user subscription plan:', error as Error);
      return this.getDefaultPlan(userPlanName);
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
        displayCredits: 100,
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

