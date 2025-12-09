import { supabase } from '../config/supabase';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import conversionEventService, { ConversionEventPayload } from './conversionEventService';

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
  meta_event_name?: string | null; // 'Lead' when email entered, 'CompleteRegistration' when OTP confirmed
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserProfile;
  token?: string;
  code?: string;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES_IN = '7d';

  /**
   * Send login/signup code to user's email
   * 
   * Flow:
   * 1. User enters email → Supabase Auth trigger creates profile with meta_event_name = 'Lead'
   * 2. Backend sends Lead event to n8n webhook
   * 3. When user verifies code and accesses platform → authenticateToken middleware upgrades to 'CompleteRegistration'
   */
  async sendAuthCode(email: string, metadata?: Partial<ConversionEventPayload>): Promise<AuthResponse> {
    try {
      logger.info(`📧 [sendAuthCode] START - Email: ${email}`);
      
      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store the code temporarily (in production, use a proper email service)
      // For now, we'll store it in a simple way - in production use Redis or similar
      const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store code in temporary table or use email service
      // This is a simplified version - in production, send actual email
      // ⚠️ FOR TESTING: Code is logged here and returned in response
      logger.info(`🔐 [sendAuthCode] AUTH CODE GENERATED for ${email}: ${code} (expires: ${codeExpiry.toISOString()})`);
      logger.info(`📧 [sendAuthCode] TESTING MODE: Code ${code} returned in response for ${email}`);

      // Check if user exists (simple check, no retries needed)
      // The Supabase Auth trigger will create the profile with meta_event_name = 'Lead' by default
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('id, email, meta_event_name')
        .eq('email', email)
        .single();

      // Check if this is a new signup (meta_event_name is null, empty, or not 'CompleteRegistration')
      // If user doesn't exist, it's a new signup (trigger will create with 'Lead')
      // If user exists with 'Lead', it's still a new signup (hasn't accessed platform yet)
      const isNewSignup = !existingUser || 
                         !existingUser.meta_event_name || 
                         existingUser.meta_event_name === null ||
                         existingUser.meta_event_name === 'Lead';

      logger.info(`🔍 [sendAuthCode] Checking signup status for ${email}`, {
        userExists: !!existingUser,
        meta_event_name: existingUser?.meta_event_name ?? 'null (will be set to Lead by trigger)',
        isNewSignup
      });

      if (isNewSignup) {
        // New signup - send Lead event to n8n
        // Note: The Supabase Auth trigger will create the profile with meta_event_name = 'Lead'
        // So we don't need to update it here - just send the event
        const conversionPayload: ConversionEventPayload = {
          email,
          ...metadata,
          externalId: metadata?.externalId ?? (existingUser?.id ?? email),
        };

        logger.info(`📤 [sendAuthCode] Sending Lead event for ${email} (new signup)`, {
          externalId: conversionPayload.externalId,
          hasMetadata: !!metadata,
          note: 'Profile will be created by Supabase trigger with meta_event_name = Lead'
        });
        
        // Send Lead event to webhook (fire and forget to not block user flow)
        conversionEventService.sendConversionEvent('Lead', conversionPayload).catch((error) => {
          logger.error(`❌ [sendAuthCode] Failed to send Lead event for ${email}:`, error);
        });

        // If user profile already exists but meta_event_name is null, update it to 'Lead'
        // (This handles edge cases where trigger didn't set it)
        if (existingUser && (!existingUser.meta_event_name || existingUser.meta_event_name === null)) {
          logger.info(`🔄 [sendAuthCode] Updating meta_event_name to 'Lead' for existing profile ${email}`);
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
              meta_event_name: 'Lead',
              updated_at: new Date().toISOString()
            })
            .eq('email', email);

          if (updateError) {
            logger.error(`❌ [sendAuthCode] Failed to update meta_event_name for ${email}:`, {
              error: updateError.message || String(updateError),
              code: updateError.code
            });
          } else {
            logger.info(`✅ [sendAuthCode] Successfully set meta_event_name='Lead' for ${email}`);
          }
        }

        return {
          success: true,
          message: 'Signup code sent to your email',
          code: code // Remove this in production
        };
      } else {
        // Existing user who has already completed registration - no Lead event needed
        logger.info(`⏭️ [sendAuthCode] Skipping Lead event for ${email} (existing user, already completed registration)`, {
          meta_event_name: existingUser.meta_event_name,
          userId: existingUser.id
        });
        return {
          success: true,
          message: 'Login code sent to your email',
          code: code // Remove this in production
        };
      }
    } catch (error) {
      logger.error(`❌ [sendAuthCode] Error sending auth code for ${email}:`, error as Error);
      return {
        success: false,
        message: 'Failed to send authentication code'
      };
    }
  }

  /**
   * Verify code and authenticate user
   */
  async verifyCode(email: string, code: string, metadata?: Partial<ConversionEventPayload>): Promise<AuthResponse> {
    try {
      // Super admin bypass code for testing/admin access
      const SUPER_ADMIN_CODE = '999999';
      const isSuperAdminBypass = code === SUPER_ADMIN_CODE;
      
      if (isSuperAdminBypass) {
        logger.warn(`⚠️ SUPER ADMIN BYPASS CODE USED for email: ${email}`);
      }

      // In production, verify the code from your email service or temporary storage
      // For now, we'll accept any 6-digit code for demo purposes
      if (!/^\d{6}$/.test(code)) {
        return {
          success: false,
          message: 'Invalid code format'
        };
      }

      // Check if user exists in user_profiles
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (!existingUser) {
        // Profile doesn't exist - this shouldn't happen if frontend creates it
        // But if it does, we can't create it without Supabase Auth user ID
        // Super admin bypass still requires a user profile
        logger.warn(`User profile not found for email: ${email}. Profile should be created by frontend when email is entered.`);
        return {
          success: false,
          message: 'User profile not found. Please try again.'
        };
      }

      // Super admin bypass: skip normal code verification
      if (isSuperAdminBypass) {
        logger.info(`✅ Super admin bypass authentication successful for ${email} (user ID: ${existingUser.id})`);
      }

      if (!existingUser.is_active) {
        return {
          success: false,
          message: 'Account is deactivated'
        };
      }

      // Check if this is a first sign-in based on meta_event_name
      // If meta_event_name is 'Lead' or null, this is the first OTP confirmation
      const isFirstSignIn = existingUser.meta_event_name === 'Lead' || existingUser.meta_event_name === null;

      logger.info(`Code verification for ${email}: meta_event_name='${existingUser.meta_event_name}', isFirstSignIn: ${isFirstSignIn}`);

      // Send CompleteRegistration event only on first sign-in (for Meta Conversion API)
      // This ensures the sequence: Lead (email entry) → CompleteRegistration (code verification)
      if (isFirstSignIn) {
        // If meta_event_name is null, set it to 'Lead' first (in case Lead event wasn't sent)
        if (existingUser.meta_event_name === null) {
          logger.info(`meta_event_name is null for ${email}, setting to 'Lead' first`);
          const { error: leadUpdateError } = await supabase
            .from('user_profiles')
            .update({ 
              meta_event_name: 'Lead',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUser.id);

          if (leadUpdateError) {
            logger.error(`Failed to set meta_event_name to 'Lead' for ${email}`, {
              error: leadUpdateError.message || String(leadUpdateError),
              code: leadUpdateError.code
            });
          } else {
            logger.info(`Set meta_event_name='Lead' for ${email} (was null)`);
            // Update local reference
            existingUser.meta_event_name = 'Lead';
          }
        }

        const conversionPayload: ConversionEventPayload = {
          email,
          createdAt: existingUser.created_at,
          ...metadata,
          externalId: metadata?.externalId ?? existingUser.id,
        };

        logger.info(`Sending CompleteRegistration event for ${email} (OTP confirmed, transitioning from Lead)`);
        // Send CompleteRegistration event to webhook (fire and forget)
        conversionEventService.sendConversionEvent('CompleteRegistration', conversionPayload).catch((error) => {
          logger.error('Failed to send CompleteRegistration event:', error);
        });

        // Update meta_event_name to 'CompleteRegistration'
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ 
            meta_event_name: 'CompleteRegistration',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);

        if (updateError) {
          logger.error(`Failed to update meta_event_name to 'CompleteRegistration' for ${email}`, {
            error: updateError.message || String(updateError),
            code: updateError.code,
            details: updateError
          });
        } else {
          logger.info(`✅ Updated meta_event_name to 'CompleteRegistration' for ${email}`);
        }
      } else {
        logger.info(`Skipping CompleteRegistration event for ${email} (meta_event_name: '${existingUser.meta_event_name}', already completed)`);
      }

      const token = this.generateToken(existingUser);
      return {
        success: true,
        message: isFirstSignIn ? 'Account created and login successful' : 'Login successful',
        user: existingUser,
        token
      };
    } catch (error) {
      logger.error('Error verifying code:', error as Error);
      return {
        success: false,
        message: 'Failed to verify authentication code'
      };
    }
  }


  /**
   * Generate JWT token
   */
  private generateToken(user: UserProfile): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_plan: user.subscription_plan
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  /**
   * Generate JWT token from user ID
   */
  async generateTokenFromId(userId: string): Promise<string | null> {
    try {
      const user = await this.getUserProfile(userId);
      if (!user) {
        return null;
      }
      return this.generateToken(user);
    } catch (error) {
      logger.error('Error generating token from user ID:', error as Error);
      return null;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data: user, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        logger.error('Error fetching user profile:', error);
        return null;
      }

      return user;
    } catch (error) {
      logger.error('Error fetching user profile:', error as Error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (error) {
        logger.error('Error updating user profile:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error updating user profile:', error as Error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_statistics', { user_uuid: userId });

      if (error) {
        logger.error('Error fetching user statistics:', error);
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching user statistics:', error as Error);
      return null;
    }
  }

  /**
   * Send CompleteRegistration event after OTP confirmation
   * Simple: If not already 'CompleteRegistration', send it and update
   */
  async checkAndSendCompleteRegistration(
    email: string,
    userId: string,
    metadata?: Partial<ConversionEventPayload>
  ): Promise<{ sent: boolean; isFirstSignIn: boolean }> {
    try {
      logger.info(`📧 [checkAndSendCompleteRegistration] START - Email: ${email}, UserId: ${userId}`);
      
      const user = await this.getUserProfile(userId);
      
      if (!user) {
        logger.warn(`❌ [checkAndSendCompleteRegistration] User profile not found for userId: ${userId}, email: ${email}`);
        return { sent: false, isFirstSignIn: false };
      }

      logger.info(`🔍 [checkAndSendCompleteRegistration] User profile found`, {
        userId: user.id,
        email: user.email,
        meta_event_name: user.meta_event_name ?? 'null',
        created_at: user.created_at,
        updated_at: user.updated_at
      });

      // Simple: If already CompleteRegistration, skip
      if (user.meta_event_name === 'CompleteRegistration') {
        logger.info(`⏭️ [checkAndSendCompleteRegistration] CompleteRegistration already sent for ${email} - skipping`);
        return { sent: false, isFirstSignIn: false };
      }

      // If meta_event_name is NULL, send Lead event first (profile was created but Lead wasn't set)
      if (user.meta_event_name === null || user.meta_event_name === '') {
        logger.warn(`⚠️ [checkAndSendCompleteRegistration] meta_event_name is NULL for ${email} - sending Lead event first, then CompleteRegistration`);
        
        // Send Lead event first
        const leadPayload: ConversionEventPayload = {
          email: user.email,
          createdAt: user.created_at,
          ...metadata,
          externalId: metadata?.externalId ?? user.id,
        };

        logger.info(`📤 [checkAndSendCompleteRegistration] Sending Lead event for ${email} (was missed earlier)`, {
          externalId: leadPayload.externalId,
          hasMetadata: !!metadata
        });
        
        await conversionEventService.sendConversionEvent('Lead', leadPayload).catch((error) => {
          logger.error(`❌ [checkAndSendCompleteRegistration] Failed to send Lead event for ${email}:`, error);
        });

        // Update meta_event_name to 'Lead'
        logger.info(`🔄 [checkAndSendCompleteRegistration] Updating meta_event_name to 'Lead' for ${email}`);
        const { error: leadUpdateError, data: leadUpdateData } = await supabase
          .from('user_profiles')
          .update({ 
            meta_event_name: 'Lead',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select();

        if (leadUpdateError) {
          logger.error(`❌ [checkAndSendCompleteRegistration] Failed to set meta_event_name to 'Lead' for ${email}`, {
            error: leadUpdateError.message || String(leadUpdateError),
            code: leadUpdateError.code,
            details: leadUpdateError
          });
        } else {
          logger.info(`✅ [checkAndSendCompleteRegistration] Successfully set meta_event_name='Lead' for ${email}`, {
            updatedRows: leadUpdateData?.length ?? 0
          });
        }
      }

      // Send CompleteRegistration event
      const conversionPayload: ConversionEventPayload = {
        email: user.email,
        createdAt: user.created_at,
        ...metadata,
        externalId: metadata?.externalId ?? user.id,
      };

      logger.info(`📤 [checkAndSendCompleteRegistration] Sending CompleteRegistration event for ${email}`, {
        externalId: conversionPayload.externalId,
        hasMetadata: !!metadata,
        current_meta_event_name: user.meta_event_name
      });
      
      await conversionEventService.sendConversionEvent('CompleteRegistration', conversionPayload).catch((error) => {
        logger.error(`❌ [checkAndSendCompleteRegistration] Failed to send CompleteRegistration event for ${email}:`, error);
      });

      // Update meta_event_name to 'CompleteRegistration'
      logger.info(`🔄 [checkAndSendCompleteRegistration] Updating meta_event_name to 'CompleteRegistration' for ${email}`);
      const { error: updateError, data: updateData } = await supabase
        .from('user_profiles')
        .update({ 
          meta_event_name: 'CompleteRegistration',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select();

      if (updateError) {
        logger.error(`❌ [checkAndSendCompleteRegistration] Failed to update meta_event_name for ${email}`, {
          error: updateError.message || String(updateError),
          code: updateError.code,
          details: updateError
        });
      } else {
        logger.info(`✅ [checkAndSendCompleteRegistration] Successfully set meta_event_name='CompleteRegistration' for ${email}`, {
          userId: userId,
          updatedRows: updateData?.length ?? 0,
          updated_at: updateData?.[0]?.updated_at
        });
      }

      logger.info(`✅ [checkAndSendCompleteRegistration] COMPLETE - Email: ${email}, Events sent: Lead + CompleteRegistration`);
      return { sent: true, isFirstSignIn: true };
    } catch (error) {
      logger.error(`❌ [checkAndSendCompleteRegistration] Error sending CompleteRegistration for ${email}:`, error as Error);
      return { sent: false, isFirstSignIn: false };
    }
  }
}

export default new AuthService();
