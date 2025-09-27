import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import supabase from '../config/supabase';

export interface User {
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

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, code: string) => Promise<{ success: boolean; message: string }>;
  sendCode: (email: string) => Promise<{ success: boolean; message: string }>;
  signOut: () => Promise<void>;
  forceSignOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncUserProfile: () => Promise<void>;
  forceClearCacheAndRefetch: () => Promise<void>;
  debugSession: () => Promise<void>;
  manualSessionCheck: () => Promise<any>;
  forceClearLoading: () => void;
  refreshSupabaseClient: () => Promise<void>;
  createUserFromLocalStorage: () => Promise<boolean>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {

        // Check if Supabase is properly configured
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

        if (!supabaseAnonKey || !supabaseUrl) {
          console.warn('⚠️ Supabase configuration missing - running in demo mode');
          setLoading(false);
          return;
        }

        // Simple session check from Supabase (should automatically read from localStorage)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Session error:', error);
          setLoading(false);
          return;
        }

        if (session?.access_token) {
          await fetchUserProfile(session.user.id);
          return;
        }

        // No session found, allow access to landing page
        setLoading(false);

      } catch (error) {
        console.error('🚨 Error checking session:', error);
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout after 5 seconds')), 5000);
      });

      // Get profile from Supabase
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const result = await Promise.race([profilePromise, timeoutPromise]);
      const { data: profile, error } = result;


      if (error) {
        console.error('❌ Error fetching user profile:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details
        });

        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          await createUserProfile(userId);
        } else {
          // For any other error, set loading to false so user can proceed
          setLoading(false);
        }
        return;
      }

      // Middleware: Verify user is active and has valid role
      if (!profile.is_active) {
        console.error('❌ User account is inactive');
        await forceSignOut();
        return;
      }

      if (!profile.role || !['user', 'admin', 'super_admin'].includes(profile.role)) {
        console.error('❌ Invalid user role:', profile.role);
        await forceSignOut();
        return;
      }

      // Set the user state with the database profile (which has the correct role)
      setUser(profile);
      setLoading(false);

    } catch (error) {
      console.error('🚨 Error in fetchUserProfile:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      setLoading(false);
    }
  };

  const createUserProfile = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the Supabase function to create profile (bypasses RLS)
      const { error } = await supabase.rpc('create_user_profile', {
        user_id: userId,
        user_email: user.email!,
        user_role: 'user',
        user_plan: 'free'
      });

      if (error) {
        console.error('Error creating user profile:', error);
        return;
      }

      // Fetch the created profile
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('Error fetching created profile:', fetchError);
        return;
      }

      setUser(profile);
      setLoading(false);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setLoading(false);
    }
  };

  const sendCode = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      
      if (!supabaseAnonKey || !supabaseUrl) {
        // Demo mode - simulate successful code sending
        console.log('Demo mode: Simulating OTP code sent to:', email);
        return { success: true, message: '6-digit code sent to your email! (Demo mode)' };
      }

      // First check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.auth.signOut();
        setUser(null);
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // This will create a user if they don't exist
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('Error sending OTP code:', error);
        return { success: false, message: error.message };
      }

      return { success: true, message: '6-digit code sent to your email!' };
    } catch (error) {
      console.error('Error sending code:', error);
      return { success: false, message: 'Failed to send code' };
    }
  };

  const signIn = async (email: string, code: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
      
      if (!supabaseAnonKey || !supabaseUrl) {
        // Demo mode - simulate successful login
        console.log('Demo mode: Simulating login for:', email);
        const demoUser = {
          id: 'demo-user-123',
          email: email,
          name: 'Demo User',
          role: 'user' as const,
          subscription_plan: 'free' as const,
          monthly_generations_limit: 10,
          total_generations: 0,
          successful_generations: 0,
          failed_generations: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setUser(demoUser);
        return { success: true, message: 'Successfully signed in! (Demo mode)' };
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email'
      });

      if (error) {
        console.error('Error verifying OTP code:', error);
        return { success: false, message: error.message };
      }

      if (data.user) {
        await fetchUserProfile(data.user.id);
        return { success: true, message: 'Successfully signed in!' };
      } else {
        return { success: false, message: 'Verification failed' };
      }
    } catch (error) {
      console.error('Error signing in:', error);
      return { success: false, message: 'Authentication failed' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const forceSignOut = async (): Promise<void> => {
    try {
      // Clear Supabase session
      await supabase.auth.signOut();

      // Clear local state
      setUser(null);

      // Clear all localStorage items
      localStorage.removeItem('supabase.auth.token');
      localStorage.removeItem('supabase.auth.refresh_token');
      localStorage.removeItem('supabase.auth.expires_at');
      localStorage.removeItem('supabase.auth.session');

      // Clear Supabase-specific items
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

    } catch (error) {
      console.error('🚨 Error clearing authentication state:', error);
    }
  };

  // Function to force clear all cached user data and refetch
  const forceClearCacheAndRefetch = async () => {
    try {
      // Clear current user state
      setUser(null);

      // Clear all Supabase-related localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } 
    } catch (error) {
      console.error('🚨 Error clearing cache and refetching:', error);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetchUserProfile(user.id);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  // Function to manually sync user profile with database
  const syncUserProfile = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return;
      }

      // Just fetch the profile by ID
      await fetchUserProfile(authUser.id);
    } catch (error) {
      console.error('🚨 Error syncing user profile:', error);
    }
  };

  const debugSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetchUserProfile(session.user.id);
      } 

    } catch (error) {
      console.error('🚨 Error in manual session debug:', error);
    }
  };

  const manualSessionCheck = async () => {
    try {

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Manual check timeout')), 3000); // 3 second timeout
      });

      const sessionPromise = supabase.auth.getSession();

      const result = await Promise.race([sessionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error('❌ Manual check failed:', error);
      return null;
    }
  };

  const forceClearLoading = () => {
    setLoading(false);
  };

  const refreshSupabaseClient = async () => {
    try {
      // Clear any existing session
      await supabase.auth.signOut();

      // Try to get session again
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetchUserProfile(session.user.id);
      } 
    } catch (error) {
      console.error('🚨 Error refreshing Supabase client:', error);
    }
  };

  // Simple localStorage fallback (only used if Supabase completely fails)
  const createUserFromLocalStorage = async () => {
    try {
      // Check for Supabase session key
      const sessionKey = Object.keys(localStorage).find(key => key.includes('sb-'));
      if (!sessionKey) {
        return false;
      }

      const data = localStorage.getItem(sessionKey);
      if (!data) return false;

      const parsed = JSON.parse(data);
      if (!parsed.access_token || !parsed.user) return false;

      // Check if token is expired
      if (parsed.expires_at && Date.now() / 1000 > parsed.expires_at) {
        localStorage.removeItem(sessionKey);
        return false;
      }

      await fetchUserProfile(parsed.user.id);
      return true;

    } catch (error) {
      console.error('🚨 Error in localStorage fallback:', error);
      return false;
    }
  };

  // Simple function to manually refresh user data
  const refreshUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetchUserProfile(user.id);
      }
    } catch (error) {
      console.error('🚨 Error refreshing user data:', error);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    sendCode,
    signOut,
    forceSignOut,
    refreshUser,
    syncUserProfile,
    forceClearCacheAndRefetch,
    debugSession,
    manualSessionCheck,
    forceClearLoading,
    refreshSupabaseClient,
    createUserFromLocalStorage,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
