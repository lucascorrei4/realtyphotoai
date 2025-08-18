import supabase from '../config/supabase';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: 'user' | 'admin' | 'super_admin';
  subscription_plan: 'free' | 'basic' | 'premium' | 'enterprise';
  monthly_generations_limit: number;
  total_generations: number;
  successful_generations: number;
  failed_generations: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserData {
  role?: 'user' | 'admin' | 'super_admin';
  subscription_plan?: 'free' | 'basic' | 'premium' | 'enterprise';
  monthly_generations_limit?: number;
  is_active?: boolean;
  name?: string;
  phone?: string;
}

class AdminService {
  // Get all users
  async getAllUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  // Get user by ID
  async getUserById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // Update user profile
  async updateUser(userId: string, updateData: UpdateUserData): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // Deactivate user
  async deactivateUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  }

  // Activate user
  async activateUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  }

  // Change user role
  async changeUserRole(userId: string, newRole: 'user' | 'admin' | 'super_admin'): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  }

  // Change subscription plan
  async changeSubscriptionPlan(userId: string, newPlan: 'free' | 'basic' | 'premium' | 'enterprise'): Promise<void> {
    // Get plan limits from plan_rules table
    const { data: planRule } = await supabase
      .from('plan_rules')
      .select('monthly_generations_limit')
      .eq('plan_name', newPlan)
      .single();

    const monthlyLimit = planRule?.monthly_generations_limit || 10;

    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        subscription_plan: newPlan,
        monthly_generations_limit: monthlyLimit,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  }

  // Get user statistics
  async getUserStatistics(userId: string): Promise<any> {
    const { data, error } = await supabase.rpc('get_user_statistics', {
      user_uuid: userId
    });

    if (error) {
      throw error;
    }

    return data;
  }

  // Get system statistics
  async getSystemStatistics(): Promise<any> {
    const { data: users } = await supabase
      .from('user_profiles')
      .select('*');

    const { data: generations } = await supabase
      .from('generations')
      .select('*');

    if (!users || !generations) {
      return null;
    }

    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.is_active).length,
      newThisMonth: users.filter(u => new Date(u.created_at) >= thisMonth).length,
      totalGenerations: generations.length,
      successfulGenerations: generations.filter(g => g.status === 'completed').length,
      failedGenerations: generations.filter(g => g.status === 'failed').length,
      averageSuccessRate: generations.length > 0 
        ? Math.round((generations.filter(g => g.status === 'completed').length / generations.length) * 100)
        : 0
    };
  }
}

export default new AdminService();
