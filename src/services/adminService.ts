import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { UserProfile } from './authService';
import stripeService, { StripeProduct, StripePrice } from './stripeService';

export interface AdminSettings {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PlanRule {
  id: string;
  plan_name: string;
  monthly_generations_limit: number;
  concurrent_generations: number;
  allowed_models: string[];
  price_per_month: number;
  features: any;
  is_active: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StripePlanData {
  plan_name: string;
  monthly_generations_limit: number;
  concurrent_generations: number;
  allowed_models: string[];
  price_per_month: number;
  features: any;
  stripe_metadata?: Record<string, string>;
}

export interface GenerationStats {
  total_generations: number;
  successful_generations: number;
  failed_generations: number;
  success_rate: number;
  monthly_usage: number;
  monthly_limit: number;
  model_breakdown: any;
}

export class AdminService {
  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
      }

      return users || [];
    } catch (error) {
      logger.error('Error in getAllUsers:', error as Error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const { data: user, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Error fetching user:', error);
        return null;
      }

      return user;
    } catch (error) {
      logger.error('Error in getUserById:', error as Error);
      return null;
    }
  }

  /**
   * Update user profile (admin only)
   */
  async updateUser(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        logger.error('Error updating user:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in updateUser:', error as Error);
      return false;
    }
  }

  /**
   * Deactivate/activate user
   */
  async toggleUserStatus(userId: string, isActive: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: isActive })
        .eq('id', userId);

      if (error) {
        logger.error('Error toggling user status:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in toggleUserStatus:', error as Error);
      return false;
    }
  }

  /**
   * Change user subscription plan
   */
  async changeUserPlan(userId: string, newPlan: string): Promise<boolean> {
    try {
      // Get plan rules for the new plan
      const { data: planRule } = await supabase
        .from('plan_rules')
        .select('*')
        .eq('plan_name', newPlan)
        .eq('is_active', true)
        .single();

      if (!planRule) {
        throw new Error('Invalid plan');
      }

      // Update user plan and limits
      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_plan: newPlan,
          monthly_generations_limit: planRule.monthly_generations_limit
        })
        .eq('id', userId);

      if (error) {
        logger.error('Error changing user plan:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in changeUserPlan:', error as Error);
      return false;
    }
  }

  /**
   * Get all admin settings
   */
  async getAdminSettings(): Promise<AdminSettings[]> {
    try {
      const { data: settings, error } = await supabase
        .from('admin_settings')
        .select('*')
        .order('setting_key');

      if (error) {
        logger.error('Error fetching admin settings:', error);
        throw new Error('Failed to fetch admin settings');
      }

      return settings || [];
    } catch (error) {
      logger.error('Error in getAdminSettings:', error as Error);
      throw error;
    }
  }

  /**
   * Update admin setting
   */
  async updateAdminSetting(settingKey: string, newValue: any): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('admin_settings')
        .update({ 
          setting_value: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('setting_key', settingKey);

      if (error) {
        logger.error('Error updating admin setting:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in updateAdminSetting:', error as Error);
      return false;
    }
  }

  /**
   * Get all plan rules
   */
  async getPlanRules(): Promise<PlanRule[]> {
    try {
      const { data: plans, error } = await supabase
        .from('plan_rules')
        .select('*')
        .order('price_per_month');

      if (error) {
        logger.error('Error fetching plan rules:', error);
        throw new Error('Failed to fetch plan rules');
      }

      return plans || [];
    } catch (error) {
      logger.error('Error in getPlanRules:', error as Error);
      throw error;
    }
  }

  /**
   * Update plan rule
   */
  async updatePlanRule(planId: string, updates: Partial<PlanRule>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('plan_rules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId);

      if (error) {
        logger.error('Error updating plan rule:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in updatePlanRule:', error as Error);
      return false;
    }
  }

  /**
   * Create new plan rule with Stripe integration
   */
  async createPlanRule(planData: StripePlanData): Promise<PlanRule | null> {
    try {
      // Create Stripe product
      const stripeProduct = await stripeService.createProduct({
        name: `${planData.plan_name.charAt(0).toUpperCase() + planData.plan_name.slice(1)} Plan`,
        description: `${planData.monthly_generations_limit} generations per month`,
        metadata: {
          plan_name: planData.plan_name,
          monthly_limit: planData.monthly_generations_limit.toString(),
          concurrent_limit: planData.concurrent_generations.toString(),
          ...planData.stripe_metadata,
        },
      });

      // Create Stripe price (monthly)
      const stripePrice = await stripeService.createPrice({
        product_id: stripeProduct.id,
        unit_amount: Math.round(planData.price_per_month * 100), // Convert to cents
        currency: 'usd',
        recurring: {
          interval: 'month',
          interval_count: 1,
        },
        metadata: {
          plan_name: planData.plan_name,
          monthly_limit: planData.monthly_generations_limit.toString(),
        },
      });

      // Create plan rule in database
      const { data: planRule, error } = await supabase
        .from('plan_rules')
        .insert({
          plan_name: planData.plan_name,
          monthly_generations_limit: planData.monthly_generations_limit,
          concurrent_generations: planData.concurrent_generations,
          allowed_models: planData.allowed_models,
          price_per_month: planData.price_per_month,
          features: planData.features,
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating plan rule:', error);
        // Clean up Stripe resources if database insert fails
        try {
          await stripeService.archiveProduct(stripeProduct.id);
        } catch (cleanupError: any) {
          logger.error('Error cleaning up Stripe product after database failure:', cleanupError);
        }
        return null;
      }

      return planRule;
    } catch (error) {
      logger.error('Error in createPlanRule:', error as Error);
      return null;
    }
  }

  /**
   * Delete plan rule and archive Stripe product
   */
  async deletePlanRule(planId: string): Promise<boolean> {
    try {
      // Get plan rule to find Stripe IDs
      const { data: planRule } = await supabase
        .from('plan_rules')
        .select('stripe_product_id, stripe_price_id')
        .eq('id', planId)
        .single();

      if (planRule?.stripe_product_id) {
        // Archive Stripe product
        await stripeService.archiveProduct(planRule.stripe_product_id);
      }

      // Delete from database
      const { error } = await supabase
        .from('plan_rules')
        .delete()
        .eq('id', planId);

      if (error) {
        logger.error('Error deleting plan rule:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error in deletePlanRule:', error as Error);
      return false;
    }
  }

  /**
   * Get Stripe products and prices
   */
  async getStripeProducts(): Promise<{ products: StripeProduct[]; prices: StripePrice[] }> {
    try {
      return await stripeService.syncProductsWithDatabase();
    } catch (error) {
      logger.error('Error in getStripeProducts:', error as Error);
      throw error;
    }
  }

  /**
   * Sync Stripe plans with database
   */
  async syncStripePlans(): Promise<{ success: boolean; message: string }> {
    try {
      const { products, prices } = await stripeService.syncProductsWithDatabase();
      
      // Update existing plan rules with Stripe IDs if they don't have them
      for (const product of products) {
        const planName = product.metadata.plan_name;
        if (planName) {
          const { error } = await supabase
            .from('plan_rules')
            .update({
              stripe_product_id: product.id,
              updated_at: new Date().toISOString(),
            })
            .eq('plan_name', planName)
            .is('stripe_product_id', null);

          if (error) {
            logger.error(`Error updating plan rule for ${planName}:`, error);
          }
        }
      }

      return {
        success: true,
        message: `Synced ${products.length} products and ${prices.length} prices`,
      };
    } catch (error) {
      logger.error('Error in syncStripePlans:', error as Error);
      return {
        success: false,
        message: 'Failed to sync Stripe plans',
      };
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<any> {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      // Get total generations
      const { count: totalGenerations } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true });

      // Get successful generations
      const { count: successfulGenerations } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Get monthly generations
      const { count: monthlyGenerations } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

      // Get plan distribution
      const { data: planDistribution } = await supabase
        .from('user_profiles')
        .select('subscription_plan')
        .eq('is_active', true);

      const planStats = planDistribution?.reduce((acc: any, user: any) => {
        acc[user.subscription_plan] = (acc[user.subscription_plan] || 0) + 1;
        return acc;
      }, {});

      return {
        totalUsers: totalUsers || 0,
        totalGenerations: totalGenerations || 0,
        successfulGenerations: successfulGenerations || 0,
        successRate: totalGenerations ? Math.round((successfulGenerations || 0) / totalGenerations * 100) : 0,
        monthlyGenerations: monthlyGenerations || 0,
        planDistribution: planStats || {},
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in getSystemStats:', error as Error);
      throw error;
    }
  }

  /**
   * Get user generations (admin view)
   */
  async getUserGenerations(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching user generations:', error);
        throw new Error('Failed to fetch user generations');
      }

      return generations || [];
    } catch (error) {
      logger.error('Error in getUserGenerations:', error as Error);
      throw error;
    }
  }

  /**
   * Get all generations with pagination and filtering (admin view)
   */
  async getAllGenerations(
    page: number = 1, 
    limit: number = 50,
    filters: {
      modelType?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      userId?: string;
    } = {}
  ): Promise<{ 
    generations: any[], 
    total: number,
    totalPages: number,
    currentPage: number,
    itemsPerPage: number
  }> {
    try {
      const offset = (page - 1) * limit;

      // Build query with filters
      let query = supabase
        .from('generations')
        .select(`
          *,
          user_profiles!inner(email, name, subscription_plan)
        `, { count: 'exact' });

      // Apply filters
      if (filters.modelType && filters.modelType !== 'all') {
        query = query.eq('model_type', filters.modelType);
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        // Add one day to include the end date
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('created_at', endDate.toISOString());
      }

      // Apply ordering and pagination
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: generations, error, count } = await query;

      if (error) {
        logger.error('Error fetching generations:', error);
        throw new Error('Failed to fetch generations');
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      // Flatten user_profiles data into the generation object for easier access
      const flattenedGenerations = (generations || []).map((gen: any) => {
        const userProfile = gen.user_profiles;
        return {
          ...gen,
          user_email: userProfile?.email || null,
          user_name: userProfile?.name || null,
          user_subscription_plan: userProfile?.subscription_plan || null,
          user_profiles: undefined // Remove nested object
        };
      });

      return {
        generations: flattenedGenerations,
        total,
        totalPages,
        currentPage: page,
        itemsPerPage: limit
      };
    } catch (error) {
      logger.error('Error in getAllGenerations:', error as Error);
      throw error;
    }
  }

  /**
   * Delete a generation (admin only - can delete any generation)
   */
  async deleteGeneration(generationId: string): Promise<boolean> {
    try {
      // Verify the generation exists
      const { data: generation, error: fetchError } = await supabase
        .from('generations')
        .select('id')
        .eq('id', generationId)
        .single();

      if (fetchError || !generation) {
        throw new Error('Generation not found');
      }

      // Soft delete the generation (admins can delete any generation)
      const { error: updateError } = await supabase
        .from('generations')
        .update({ 
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      if (updateError) {
        logger.error('Error soft deleting generation:', updateError);
        throw new Error(`Failed to delete generation: ${updateError.message}`);
      }

      logger.info('Generation soft deleted successfully by admin', { generationId });
      return true;
    } catch (error) {
      logger.error('Error in deleteGeneration:', error as Error);
      throw error;
    }
  }
}

export default new AdminService();
