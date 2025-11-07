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

      if (existingUser) {
        return {
          success: true,
          message: 'Login code sent to your email',
          code: code // Remove this in production
        };
      } else {
        const conversionPayload: ConversionEventPayload = {
          email,
          ...metadata,
        };

        await conversionEventService.sendConversionEvent('Lead', conversionPayload);

        return {
          success: true,
          message: 'Signup code sent to your email',
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

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (existingUser) {
        // User exists - login
        if (!existingUser.is_active) {
          return {
            success: false,
            message: 'Account is deactivated'
          };
        }

        const token = this.generateToken(existingUser);
        return {
          success: true,
          message: 'Login successful',
          user: existingUser,
          token
        };
      } else {
        // User doesn't exist - create new account
        const newUser = await this.createUser(email);
        if (newUser) {
          const token = this.generateToken(newUser);
          const conversionPayload: ConversionEventPayload = {
            email,
            createdAt: newUser.created_at,
            ...metadata,
          };

          await conversionEventService.sendConversionEvent('CompleteRegistration', conversionPayload);

          return {
            success: true,
            message: 'Account created and login successful',
            user: newUser,
            token
          };
        } else {
          return {
            success: false,
            message: 'Failed to create account'
          };
        }
      }
    } catch (error) {
      logger.error('Error verifying code:', error as Error);
      return {
        success: false,
        message: 'Failed to verify authentication code'
      };
    }
  }

  /**
   * Create new user profile
   */
  private async createUser(email: string): Promise<UserProfile | null> {
    try {
      // Create user in Supabase Auth (this would normally be done by the frontend)
      // For now, we'll create just the profile
      const { data: newUser, error } = await supabase
        .from('user_profiles')
        .insert({
          email,
          role: 'user',
          subscription_plan: 'free',
          monthly_generations_limit: 10,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating user profile:', error);
        return null;
      }

      return newUser;
    } catch (error) {
      logger.error('Error creating user:', error as Error);
      return null;
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
