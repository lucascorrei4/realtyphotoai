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
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

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

        if (session?.access_token && session?.user) {
          console.log('✅ Session found:', session.user.id, session.user.email);
          
          // CRITICAL: Set loading to false FIRST to allow UI to render
          setLoading(false);
          
          // Use session user data directly - fetch full profile in background
          const sessionUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            role: 'user',
            subscription_plan: 'free',
            monthly_generations_limit: 10,
            total_generations: 0,
            successful_generations: 0,
            failed_generations: 0,
            is_active: true,
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          console.log('👤 Setting user from session:', sessionUser);
          setUser(sessionUser);
          
          // Fetch full profile from database in background (non-blocking)
          console.log('🔄 Fetching profile for user:', session.user.id);
          fetchUserProfile(session.user.id).catch(err => {
            console.error('❌ Profile fetch error (non-critical):', err);
            // Don't clear user or set loading - user is already set from session
          });
          
          return;
        }

        // No session found, allow access to landing page
        console.log('🔓 No session found - allowing access to landing page');
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

  const fetchUserProfile = async (userId: string, retryCount: number = 0): Promise<void> => {
    console.log('🔍 fetchUserProfile called:', userId, 'retry:', retryCount);
    try {
      // Prevent multiple simultaneous calls
      if (isFetching) {
        console.log('⏳ Profile fetch already in progress, skipping...');
        return;
      }

      setIsFetching(true);
      console.log('📡 Starting profile fetch...');
      
      // Check if Supabase is properly configured first
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      if (!supabaseAnonKey || !supabaseUrl) {
        console.warn('⚠️ Supabase configuration missing - skipping profile fetch');
        setLoading(false);
        setIsFetching(false);
        return;
      }
      
      console.log('✅ Supabase configured, making query...');

      // Prevent infinite retry loops
      if (retryCount >= 3) {
        console.warn('⚠️ Maximum fetch attempts reached - stopping retries');
        // Don't clear loading here - let the session check handle it
        // This ensures we don't redirect to /auth if we have a valid session
        setIsFetching(false);
        return;
      }

      // Fetch user profile with timeout
      let profile: any = null;
      let error: any = null;
      
      try {
        console.log('📤 Making Supabase query to user_profiles table...');
        
        const queryPromise = supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000);
        });
        
        console.log('⏳ Waiting for query response (5s timeout)...');
        const result = await Promise.race([queryPromise, timeoutPromise]) as any;
        console.log('📥 Query response received:', result);
        
        // Check if we have data first - if yes, use it even if there's an error property
        if (result?.data) {
          profile = result.data;
          error = result.error; // Might be null even if data exists
        } else {
          profile = result.data;
          error = result.error || result;
        }
      } catch (err) {
        // Only treat as error if we don't have profile data
        if (!profile) {
          error = err;
          console.error('❌ Error in profile query:', err);
          if (err instanceof Error && err.message.includes('timeout')) {
            console.warn('⚠️ Query timed out - profile may not exist or RLS blocking access');
          }
        }
      }
      
      // If we have profile data, use it immediately (even if there was a timeout error)
      if (profile && !error) {
        console.log('✅ Profile data received, processing...');
      } else if (profile && error) {
        // We have data but also an error - use the data (query succeeded)
        console.log('✅ Profile data received (despite error), processing...');
        error = null; // Clear error since we have data
      } else if (error) {
        console.log('❌ Profile fetch error, handling...');
      }

      // Only handle errors if we don't have profile data
      if (error && !profile) {
        console.error('❌ Error fetching user profile:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details
        });

        // If profile doesn't exist, create one
        if (error?.code === 'PGRST116' || (error?.message && error.message.includes('No rows'))) {
          console.log('📝 Profile not found, creating new profile...');
          await createUserProfile(userId);
          // Retry after creating profile
          if (retryCount < 2) {
            console.log('🔄 Retrying profile fetch after creation...');
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return fetchUserProfile(userId, retryCount + 1);
          }
        } else if (error?.message?.includes('timeout')) {
          // Query timed out - check if profile exists before attempting creation
          console.log('⏱️ Query timed out, checking if profile exists before creating...');
          
          // Quick check if profile exists (with a short timeout to avoid blocking)
          const quickCheckPromise = supabase
            .from('user_profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();
          
          const quickTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Quick check timeout')), 2000); // 2 second timeout
          });
          
          try {
            const quickResult = await Promise.race([quickCheckPromise, quickTimeoutPromise]) as any;
            
            // If profile doesn't exist (no data and no error, or error is PGRST116), create it
            if (!quickResult?.data && (!quickResult?.error || quickResult?.error?.code === 'PGRST116')) {
              console.log('⏱️ Profile not found, creating in background (non-blocking)...');
              createUserProfile(userId).catch(createErr => {
                // Ignore 409/23505 (already exists) - race condition where profile was created
                if (createErr?.code === '23505' || createErr?.message?.includes('duplicate key')) {
                  console.log('✅ Profile already exists (race condition)');
                } else {
                  console.error('❌ Failed to create profile (non-critical):', createErr);
                }
              });
            } else if (quickResult?.data) {
              console.log('✅ Profile exists (found in quick check), skipping creation');
            }
          } catch (quickErr) {
            // Quick check also timed out - skip creation to avoid unnecessary errors
            console.log('⏱️ Quick check timed out, skipping profile creation to avoid duplicate errors');
          }
          
          // Don't retry - just continue with session user immediately
          setIsFetching(false);
          return;
        } else {
          // For network/timeout errors, retry with exponential backoff
          if (retryCount < 2 && (error.message?.includes('timeout') || error.message?.includes('network') || error.code === 'PGRST301')) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`🔄 Retrying profile fetch in ${delay}ms... (attempt ${retryCount + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchUserProfile(userId, retryCount + 1);
          }
          
          // If profile fetch failed but we have session, keep current user
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setLoading(false);
          }
          // If session exists, user is already set from session check, so don't clear it
        }
        setIsFetching(false);
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

      setUser(profile);
      setLoading(false);
      setFetchAttempts(0); // Reset attempts on success
      setIsFetching(false);

    } catch (error) {
      console.error('🚨 Error in fetchUserProfile:', error);
      
      // Retry on unexpected errors if we haven't exceeded retry count
      if (retryCount < 2) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`🔄 Retrying profile fetch after error in ${delay}ms... (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserProfile(userId, retryCount + 1);
      }
      
      // If profile fetch failed but we have session, keep current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
      }
      // If session exists, user is already set from session check, so don't clear it
      setIsFetching(false);
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
        // Ignore 409/23505 errors - profile already exists (duplicate key)
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
          console.log('✅ Profile already exists, skipping creation');
          return;
        }
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
        // Set user immediately from session, don't wait for profile fetch
        const sessionUser: User = {
          id: data.user.id,
          email: data.user.email || '',
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          role: 'user',
          subscription_plan: 'free',
          monthly_generations_limit: 10,
          total_generations: 0,
          successful_generations: 0,
          failed_generations: 0,
          is_active: true,
          created_at: data.user.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setUser(sessionUser);
        setLoading(false);
        
        // Fetch full profile in background (don't await)
        fetchUserProfile(data.user.id).catch(err => {
          console.error('Profile fetch error (non-blocking):', err);
        });
        
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
