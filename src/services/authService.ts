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
      logger.info(`Auth code for ${email}: ${code} (expires: ${codeExpiry})`);

      // Check if this is a new signup (profile doesn't exist OR was just created)
      let isNewSignup = false;
      if (!existingUser) {
        // Profile doesn't exist - definitely a new signup
        isNewSignup = true;
      } else {
        // Profile exists - check if it was just created (within last 2 minutes)
        // This handles the case where frontend creates profile when email is entered
        const profileCreatedAt = new Date(existingUser.created_at);
        const now = new Date();
        const secondsSinceCreation = (now.getTime() - profileCreatedAt.getTime()) / 1000;
        isNewSignup = secondsSinceCreation < 120; // 2 minutes window
      }

      if (isNewSignup) {
        // New signup - send Lead event
        const conversionPayload: ConversionEventPayload = {
          email,
          ...metadata,
          externalId: metadata?.externalId ?? email,
        };

        logger.info(`Sending Lead event for ${email} (new signup)`);
        await conversionEventService.sendConversionEvent('Lead', conversionPayload);

        return {
          success: true,
          message: 'Signup code sent to your email',
          code: code // Remove this in production
        };
      } else {
        // Existing user - no Lead event needed
        logger.info(`Skipping Lead event for ${email} (existing user)`);
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
        logger.warn(`User profile not found for email: ${email}. Profile should be created by frontend when email is entered.`);
        return {
          success: false,
          message: 'User profile not found. Please try again.'
        };
      }

      // User exists - check if this is a new signup or existing user login
      // Profile was created recently (within 10 minutes) = new signup (first sign-in)
      // This detects the case where profile was created when email was entered
      const profileCreatedAt = new Date(existingUser.created_at);
      const now = new Date();
      const minutesSinceCreation = (now.getTime() - profileCreatedAt.getTime()) / (1000 * 60);
      // If profile was created within last 10 minutes, it's a new signup
      // This covers: email entry (creates profile) → code verification (user might take a few minutes)
      const isFirstSignIn = minutesSinceCreation < 10; // 10 minutes window

      logger.info(`Code verification for ${email}: profile created ${minutesSinceCreation.toFixed(2)} minutes ago, isFirstSignIn: ${isFirstSignIn}`);

      if (!existingUser.is_active) {
        return {
          success: false,
          message: 'Account is deactivated'
        };
      }

      // Send CompleteRegistration event only on first sign-in (for Meta Conversion API)
      // This ensures the sequence: Lead (email entry) → CompleteRegistration (code verification)
      if (isFirstSignIn) {
        const conversionPayload: ConversionEventPayload = {
          email,
          createdAt: existingUser.created_at,
          ...metadata,
          externalId: metadata?.externalId ?? existingUser.id,
        };

        logger.info(`Sending CompleteRegistration event for ${email} (new signup)`);
        // Send CompleteRegistration event to webhook (fire and forget)
        conversionEventService.sendConversionEvent('CompleteRegistration', conversionPayload).catch((error) => {
          logger.error('Failed to send CompleteRegistration event:', error);
        });
      } else {
        logger.info(`Skipping CompleteRegistration event for ${email} (existing user login)`);
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
}

export default new AuthService();
