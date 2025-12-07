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
   */
  async sendAuthCode(email: string, metadata?: Partial<ConversionEventPayload>): Promise<AuthResponse> {
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store the code temporarily (in production, use a proper email service)
      // For now, we'll store it in a simple way - in production use Redis or similar
      const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Store code in temporary table or use email service
      // This is a simplified version - in production, send actual email
      // ⚠️ FOR TESTING: Code is logged here and returned in response
      logger.info(`🔐 AUTH CODE GENERATED for ${email}: ${code} (expires: ${codeExpiry.toISOString()})`);
      logger.info(`📧 TESTING MODE: Code ${code} returned in response for ${email}`);

      // Check if this is a new signup (meta_event_name is null or not set)
      const isNewSignup = !existingUser || !existingUser.meta_event_name;

      if (isNewSignup) {
        // New signup - set meta_event_name to 'Lead' and send Lead event
        const conversionPayload: ConversionEventPayload = {
          email,
          ...metadata,
          externalId: metadata?.externalId ?? (existingUser?.id ?? email),
        };

        logger.info(`Sending Lead event for ${email} (new signup)`);
        
        // Send Lead event to webhook
        await conversionEventService.sendConversionEvent('Lead', conversionPayload);

        // Update or set meta_event_name to 'Lead' in user_profiles
        if (existingUser) {
          // Update existing profile
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
              meta_event_name: 'Lead',
              updated_at: new Date().toISOString()
            })
            .eq('email', email);

          if (updateError) {
            logger.warn(`Failed to update meta_event_name for ${email}`, {
              error: updateError.message || String(updateError),
              code: updateError.code
            });
          } else {
            logger.info(`Set meta_event_name='Lead' for ${email}`);
          }
        } else {
          // Profile doesn't exist yet - will be set when profile is created or on OTP confirmation
          logger.info(`Profile not found for ${email}, Lead event sent but meta_event_name will be set later`);
        }

        return {
          success: true,
          message: 'Signup code sent to your email',
          code: code // Remove this in production
        };
      } else {
        // Existing user - no Lead event needed
        logger.info(`Skipping Lead event for ${email} (existing user, meta_event_name: ${existingUser.meta_event_name})`);
        return {
          success: true,
          message: 'Login code sent to your email',
          code: code // Remove this in production
        };
      }
    } catch (error) {
      logger.error('Error sending auth code:', error as Error);
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
          logger.info(`Updated meta_event_name to 'CompleteRegistration' for ${email}`);
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
      const user = await this.getUserProfile(userId);
      
      if (!user) {
        logger.warn(`User profile not found for userId: ${userId}, email: ${email}`);
        return { sent: false, isFirstSignIn: false };
      }

      // Simple: If already CompleteRegistration, skip
      if (user.meta_event_name === 'CompleteRegistration') {
        logger.info(`CompleteRegistration already sent for ${email}`);
        return { sent: false, isFirstSignIn: false };
      }

      // Send CompleteRegistration event
      const conversionPayload: ConversionEventPayload = {
        email: user.email,
        createdAt: user.created_at,
        ...metadata,
        externalId: metadata?.externalId ?? user.id,
      };

      logger.info(`Sending CompleteRegistration event for ${email}`);
      await conversionEventService.sendConversionEvent('CompleteRegistration', conversionPayload);

      // Update meta_event_name
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          meta_event_name: 'CompleteRegistration',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        logger.error(`Failed to update meta_event_name for ${email}`, {
          error: updateError.message || String(updateError),
          code: updateError.code
        });
      } else {
        logger.info(`Set meta_event_name='CompleteRegistration' for ${email}`);
      }

      return { sent: true, isFirstSignIn: true };
    } catch (error) {
      logger.error('Error sending CompleteRegistration:', error as Error);
      return { sent: false, isFirstSignIn: false };
    }
  }
}

export default new AuthService();
