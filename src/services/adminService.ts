import Stripe from 'stripe';
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
   * Includes monthly credits used calculation
   */
  async getAllUsers(): Promise<any[]> {
    try {
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
      }

      if (!users || users.length === 0) {
        return [];
      }

      // Calculate monthly credits used for each user
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Get all monthly generations for all users in one query
      const { data: monthlyGenerations, error: generationsError } = await supabase
        .from('generations')
        .select('user_id, model_type, status, created_at, is_deleted, metadata')
        .eq('status', 'completed')
        .eq('is_deleted', false)
        .gte('created_at', currentMonth.toISOString())
        .lt('created_at', nextMonth.toISOString());

      if (generationsError) {
        logger.error('Error fetching monthly generations:', generationsError);
        // Continue without credits calculation if this fails
      }

      // Calculate credits used per user
      const creditsByUser: { [userId: string]: number } = {};
      if (monthlyGenerations) {
        monthlyGenerations.forEach((gen: any) => {
          if (!creditsByUser[gen.user_id]) {
            creditsByUser[gen.user_id] = 0;
          }
          
          // Check if it's a video generation
          const isVideoGeneration = gen.model_type?.startsWith('video_') || gen.model_type === 'video_motion';
          
          if (isVideoGeneration) {
            // Video: 40 credits per second (VIDEO_PER_SECOND from CREDIT_COSTS)
            // Default 6 seconds = 240 credits
            const duration = gen.metadata?.duration || gen.metadata?.duration_seconds || 6;
            creditsByUser[gen.user_id] += duration * 40;
          } else {
            // Image: 40 credits per image (IMAGE from CREDIT_COSTS)
            creditsByUser[gen.user_id] += 40;
          }
        });
      }

      // Get plan rules to get the actual display credits for each plan
      const { data: planRules, error: planRulesError } = await supabase
        .from('plan_rules')
        .select('plan_name, monthly_generations_limit')
        .eq('is_active', true);

      if (planRulesError) {
        logger.error('Error fetching plan rules:', planRulesError);
      }

      // Create a map of plan name to display credits
      const planCreditsMap: { [planName: string]: number } = {};
      if (planRules) {
        planRules.forEach((plan: any) => {
          planCreditsMap[plan.plan_name] = plan.monthly_generations_limit || 0;
        });
      }

      // Get prepaid credit balances for all users (for one-time payment plans like explorer/a_la_carte)
      const { data: creditTransactions, error: creditTransactionsError } = await supabase
        .from('credit_transactions')
        .select('user_id, credits, expires_at');

      if (creditTransactionsError) {
        logger.error('Error fetching credit transactions:', creditTransactionsError);
      }

      // Calculate prepaid credit balance per user (only non-expired credits)
      const prepaidCreditsByUser: { [userId: string]: number } = {};
      if (creditTransactions) {
        const now = new Date();
        creditTransactions.forEach((txn: any) => {
          // Only count non-expired credits
          if (!txn.expires_at || new Date(txn.expires_at) > now) {
            if (!prepaidCreditsByUser[txn.user_id]) {
              prepaidCreditsByUser[txn.user_id] = 0;
            }
            prepaidCreditsByUser[txn.user_id] += txn.credits || 0;
          }
        });
      }

      // Add credits information to each user
      // For one-time plans (explorer/a_la_carte), use prepaid credits balance
      // For subscription plans, use plan_rules limit
      return users.map((user: any) => {
        const planName = user.subscription_plan || 'free';
        const isOneTimePlan = planName === 'explorer' || planName === 'a_la_carte';
        
        let totalCredits: number;
        if (isOneTimePlan) {
          // For one-time plans, total is the prepaid balance (credits purchased)
          // This represents credits they have left to use
          totalCredits = prepaidCreditsByUser[user.id] || 0;
        } else {
          // For subscription plans, use plan_rules monthly limit
          totalCredits = planCreditsMap[planName] || user.monthly_generations_limit || 0;
        }
        
        return {
          ...user,
          monthly_credits_used: creditsByUser[user.id] || 0,
          monthly_credits_total: totalCredits
        };
      });
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
   * Sets is_active to the provided boolean value (true for active, false for inactive)
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
   * Delete user (soft delete by setting is_active to false and optionally marking as deleted)
   * For hard delete, we'll set is_active = false and can add additional cleanup if needed
   */
  async deleteUser(userId: string): Promise<boolean> {
    try {
      // First, deactivate the user
      const { error: deactivateError } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (deactivateError) {
        logger.error('Error deactivating user during delete:', deactivateError);
        return false;
      }

      // Optionally, you can add a deleted_at timestamp or is_deleted flag here
      // For now, we'll just deactivate the user
      // If you want hard delete, you can use:
      // const { error: deleteError } = await supabase
      //   .from('user_profiles')
      //   .delete()
      //   .eq('id', userId);

      return true;
    } catch (error) {
      logger.error('Error in deleteUser:', error as Error);
      return false;
    }
  }

  /**
   * Change user subscription plan
   */
  async changeUserPlan(userId: string, newPlan: string, stripeSessionId?: string, forceCredits?: boolean): Promise<boolean> {
    try {
      // Fetch user profile to get email/customer id for Stripe lookup
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('email, stripe_customer_id')
        .eq('id', userId)
        .single();

      if (userError || !userProfile) {
        logger.error('changeUserPlan: user not found', { userId, newPlan, stripeSessionId, error: userError });
        throw new Error('User not found');
      }

      const userEmail = (userProfile.email || '').toLowerCase();
      const userStripeCustomerId = userProfile.stripe_customer_id as string | null | undefined;

      // For one-time purchase plans, we handle them specially (explorer = 800 credits, a_la_carte = 2500 credits)
      const isOneTimePlan = newPlan === 'explorer' || newPlan === 'a_la_carte';
      let creditsToAdd = 0;
      if (newPlan === 'explorer') {
        creditsToAdd = 800;
      } else if (newPlan === 'a_la_carte') {
        creditsToAdd = 2500;
      }

      // Get plan rules for the new plan (optional for one-time plans)
      const { data: planRule } = await supabase
        .from('plan_rules')
        .select('*')
        .eq('plan_name', newPlan)
        .eq('is_active', true)
        .single();

      // For regular subscription plans, require plan_rules entry
      if (!planRule && !isOneTimePlan) {
        logger.error('changeUserPlan: plan not active/valid', { userId, newPlan });
        throw new Error('Invalid plan. Make sure the plan exists and is active in plan_rules.');
      }

      // For one-time plans without plan_rules entry, create a default config
      const effectivePlanRule = planRule || {
        plan_name: newPlan,
        monthly_generations_limit: creditsToAdd, // Use credits as the limit for display
        concurrent_generations: 2,
        allowed_models: ['interior_design', 'exterior_design', 'smart_effects', 'add_furniture', 'video_motion'],
        price_per_month: 0,
        is_active: true
      };

      if (isOneTimePlan) {
        // If forceCredits is true, skip Stripe verification and just add credits
        if (forceCredits) {
          logger.info('changeUserPlan: forceCredits enabled, skipping Stripe verification', {
            userId,
            newPlan,
            creditsToAdd
          });

          // Add prepaid credits directly
          const description = `Admin manual plan change to ${newPlan} (forced without Stripe verification)`;
          const { error: rpcError } = await supabase.rpc('add_prepaid_credits', {
            p_user_id: userId,
            p_credits: creditsToAdd,
            p_description: description,
            p_stripe_session_id: null,
            p_stripe_payment_intent_id: null,
            p_expires_at: null
          });

          if (rpcError) {
            logger.warn('RPC add_prepaid_credits failed (force), attempting direct insert', {
              error: rpcError.message
            });

            const { data: currentBalanceData } = await supabase
              .from('credit_transactions')
              .select('credits, expires_at')
              .eq('user_id', userId);

            const currentBalance = (currentBalanceData || []).reduce((sum, t) => {
              if (!t.expires_at || new Date(t.expires_at) > new Date()) {
                return sum + (t.credits || 0);
              }
              return sum;
            }, 0);

            const newBalance = currentBalance + creditsToAdd;

            const { error: insertError } = await supabase
              .from('credit_transactions')
              .insert({
                user_id: userId,
                transaction_type: 'admin_grant',
                credits: creditsToAdd,
                balance_after: newBalance,
                description,
                stripe_session_id: null,
                stripe_payment_intent_id: null,
                expires_at: null
              });

            if (insertError) {
              logger.error('Direct insert to credit_transactions failed (force):', insertError);
              return false;
            }
          }
        } else {
          // Normal flow: require Stripe verification
          const { getStripeSecretKey } = require('../utils/stripeConfig');
          const stripe = new Stripe(getStripeSecretKey(), { apiVersion: '2023-10-16' });
          const expectedAmount = newPlan === 'explorer' ? 27 : 47;

          // Helper: find latest paid checkout session for this user by email or customer id
          const findLatestPaidSession = async (): Promise<Stripe.Checkout.Session | null> => {
            let startingAfter: string | undefined;
            let latest: Stripe.Checkout.Session | null = null;

            // Iterate through paid sessions (paginated) until we find a match
            do {
              // Stripe typings for Checkout session list don't expose payment_status filter; fetch and filter in code
              const listParams: Stripe.Checkout.SessionListParams = { limit: 50 };
              if (startingAfter) {
                listParams.starting_after = startingAfter;
              }

              const sessions = await stripe.checkout.sessions.list(listParams);

              for (const s of sessions.data) {
                if (s.payment_status !== 'paid') {
                  continue;
                }
                const sessionEmail = s.customer_details?.email?.toLowerCase();
                const matchEmail = userEmail && sessionEmail === userEmail;
                const matchCustomer =
                  !!userStripeCustomerId &&
                  typeof s.customer === 'string' &&
                  s.customer === userStripeCustomerId;

                if (!matchEmail && !matchCustomer) {
                  continue;
                }

                const paidAmount = (s.amount_total || 0) / 100;
                if (paidAmount < expectedAmount - 0.01) {
                  continue;
                }

                if (!latest || (s.created || 0) > (latest.created || 0)) {
                  latest = s;
                }
              }

              startingAfter = sessions.has_more ? sessions.data[sessions.data.length - 1].id : undefined;

              // Early exit if we already found a match
              if (latest) {
                break;
              }
            } while (startingAfter);

            return latest;
          };

          let sessionIdToUse = stripeSessionId;
          if (!sessionIdToUse) {
            const latestSession = await findLatestPaidSession();
            if (!latestSession) {
              logger.error('changeUserPlan: no paid Stripe session found by email/customer', {
                userId,
                newPlan,
                userEmail,
                userStripeCustomerId,
              });
              throw new Error(`No paid Stripe session found for this user (${userEmail}). The user needs to complete a $${expectedAmount} payment first, or use "Force Credits" to grant manually.`);
            }
            sessionIdToUse = latestSession.id;
          }

          // Verify payment in Stripe before adding credits
          const session = await stripe.checkout.sessions.retrieve(sessionIdToUse, {
            expand: ['payment_intent', 'customer', 'customer_details'],
          });

          if (!session || session.payment_status !== 'paid') {
            logger.error('changeUserPlan: Stripe session not paid', {
              userId,
              newPlan,
              sessionId: sessionIdToUse,
              payment_status: session?.payment_status
            });
            throw new Error('Stripe session is not paid. Credits not granted.');
          }

          const amountPaid = (session.amount_total || 0) / 100;
          if (amountPaid < expectedAmount - 0.01) {
            logger.error('changeUserPlan: amount mismatch', {
              userId,
              newPlan,
              sessionId: session.id,
              amountPaid,
              expectedAmount
            });
            throw new Error(`Stripe payment amount mismatch. Expected at least $${expectedAmount}.`);
          }

          logger.info('changeUserPlan: using Stripe session', {
            userId,
            newPlan,
            sessionId: session.id,
            amountPaid
          });

          // Add prepaid credits (RPC first, fallback direct insert)
          const description = `Admin plan change to ${newPlan} (Stripe session ${session.id})`;
          const { error: rpcError } = await supabase.rpc('add_prepaid_credits', {
            p_user_id: userId,
            p_credits: creditsToAdd,
            p_description: description,
            p_stripe_session_id: session.id,
            p_stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            p_expires_at: null
          });

          if (rpcError) {
            logger.warn('RPC add_prepaid_credits failed, attempting direct insert', {
              error: rpcError.message,
              code: rpcError.code,
              details: rpcError.details,
              hint: rpcError.hint
            });

            const { data: currentBalanceData } = await supabase
              .from('credit_transactions')
              .select('credits, expires_at')
              .eq('user_id', userId);

            const currentBalance = (currentBalanceData || []).reduce((sum, t) => {
              if (!t.expires_at || new Date(t.expires_at) > new Date()) {
                return sum + (t.credits || 0);
              }
              return sum;
            }, 0);

            const newBalance = currentBalance + creditsToAdd;

            const { error: insertError } = await supabase
              .from('credit_transactions')
              .insert({
                user_id: userId,
                transaction_type: 'purchase',
                credits: creditsToAdd,
                balance_after: newBalance,
                description,
                stripe_session_id: session.id,
                stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
                expires_at: null
              });

            if (insertError) {
              logger.error('Direct insert to credit_transactions failed:', insertError);
              return false;
            }
          }
        }
      }

      // Update user plan and limits
      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_plan: newPlan,
          monthly_generations_limit: effectivePlanRule.monthly_generations_limit
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
   * List recent Stripe customers
   */
  async getStripeCustomers(limit: number = 20) {
    return stripeService.listCustomers(limit);
  }

  /**
   * List recent Stripe checkout sessions (transactions)
   */
  async getStripeSessions(limit: number = 20) {
    return stripeService.listCheckoutSessions(limit);
  }

  /**
   * List recent Stripe subscriptions
   */
  async getStripeSubscriptions(limit: number = 20) {
    return stripeService.listSubscriptions(limit);
  }

  /**
   * List recent Stripe invoices
   */
  async getStripeInvoices(limit: number = 20) {
    return stripeService.listInvoices(limit);
  }

  /**
   * List recent Stripe payouts
   */
  async getStripePayouts(limit: number = 10) {
    return stripeService.listPayouts(limit);
  }

  /**
   * Get Stripe balance
   */
  async getStripeBalance() {
    return stripeService.getBalance();
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
