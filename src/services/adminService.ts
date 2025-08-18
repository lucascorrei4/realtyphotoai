import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { UserProfile } from './authService';

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
  created_at: string;
  updated_at: string;
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
   * Get all generations with pagination (admin view)
   */
  async getAllGenerations(page: number = 1, limit: number = 50): Promise<{ generations: any[], total: number }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const { count: total } = await supabase
        .from('generations')
        .select('*', { count: 'exact', head: true });

      // Get paginated results
      const { data: generations, error } = await supabase
        .from('generations')
        .select(`
          *,
          user_profiles!inner(email, name, subscription_plan)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error fetching generations:', error);
        throw new Error('Failed to fetch generations');
      }

      return {
        generations: generations || [],
        total: total || 0
      };
    } catch (error) {
      logger.error('Error in getAllGenerations:', error as Error);
      throw error;
    }
  }
}

export default new AdminService();
