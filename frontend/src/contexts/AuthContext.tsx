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
  debugSession: () => Promise<void>;
  manualSessionCheck: () => Promise<any>;
  forceClearLoading: () => void;
  refreshSupabaseClient: () => Promise<void>;
  createUserFromLocalStorage: () => Promise<boolean>;
  bypassSupabaseAndUseLocalStorage: () => Promise<boolean>;
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
        console.log('🔍 Checking for existing session...');
        console.log('📅 Current timestamp:', new Date().toISOString());
        
        // Check if Supabase is properly configured
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
        
        if (!supabaseAnonKey) {
          console.error('🚨 REACT_APP_SUPABASE_ANON_KEY is missing! Cannot authenticate.');
          setLoading(false);
          return;
        }
        
        if (!supabaseUrl) {
          console.error('🚨 REACT_APP_SUPABASE_URL is missing! Cannot authenticate.');
          setLoading(false);
          return;
        }
        
        console.log('✅ Supabase configuration verified');
        
        // PRIORITY 1: Check localStorage for existing session data FIRST
        console.log('🔍 Checking localStorage for existing session data...');
        const allKeys = Object.keys(localStorage);
        const supabaseKeys = allKeys.filter(key => key.includes('supabase') || key.includes('sb-'));
        
        console.log('🔍 Found Supabase-related keys:', supabaseKeys);
        
        for (const key of supabaseKeys) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              console.log(`🔍 Checking ${key}:`, parsed);
              
              if (parsed.access_token && parsed.user) {
                console.log(`✅ Found valid session in ${key}, creating user directly...`);
                
                // Create a minimal user object from localStorage data
                const tempUser: User = {
                  id: parsed.user.id,
                  email: parsed.user.email,
                  name: parsed.user.user_metadata?.name || parsed.user.email,
                  phone: parsed.user.phone || '',
                  role: 'user', // Default role
                  subscription_plan: 'free', // Default plan
                  monthly_generations_limit: 10, // Default limit
                  total_generations: 0,
                  successful_generations: 0,
                  failed_generations: 0,
                  is_active: true,
                  created_at: parsed.user.created_at || new Date().toISOString(),
                  updated_at: parsed.user.updated_at || new Date().toISOString()
                };
                
                console.log('✅ Setting user from localStorage data:', tempUser);
                setUser(tempUser);
                setLoading(false);
                return; // Exit early, don't try Supabase
              }
            }
          } catch (parseError) {
            console.log(`⚠️ Failed to parse ${key}:`, parseError);
          }
        }
        
        // PRIORITY 2: Only try Supabase if no localStorage data found
        console.log('❌ No valid localStorage session found, trying Supabase...');
        
        // Debug Supabase client configuration
        console.log('🔧 Supabase client config:', {
          url: process.env.REACT_APP_SUPABASE_URL,
          hasAnonKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
          anonKeyLength: process.env.REACT_APP_SUPABASE_ANON_KEY?.length || 0,
          anonKeyStart: process.env.REACT_APP_SUPABASE_ANON_KEY?.substring(0, 20) + '...' || 'none'
        });
        
        // Test basic Supabase connectivity first
        try {
          console.log('🌐 Testing Supabase connectivity...');
          
          // TEMPORARILY DISABLED - Skip connectivity test
          console.log('⚠️ Connectivity test temporarily disabled for debugging');
          
          // Add timeout to connectivity test
          // const connectivityTimeout = new Promise((_, reject) => {
          //   setTimeout(() => reject(new Error('Connectivity test timeout')), 3000); // 3 second timeout
          // });
          
          // const connectivityPromise = supabase
          //   .from('user_profiles')
          //   .select('count')
          //   .limit(1);
          
          // const { data, error } = await Promise.race([connectivityPromise, connectivityTimeout]) as any;
          
          // if (error) {
          //   console.log('⚠️ Supabase connectivity test result:', error.message);
          // } else {
          //   console.log('✅ Supabase connectivity test successful');
          // }
        } catch (connectError) {
          console.log('⚠️ Supabase connectivity test failed:', connectError);
          if (connectError instanceof Error && connectError.message === 'Connectivity test timeout') {
            console.log('⏰ Connectivity test timed out - Supabase client may be misconfigured');
          }
        }
        
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 2000); // Reduced to 2 seconds
        });
        
        console.log('🔄 Attempting to get session...');
        console.log('⏱️ Starting session check at:', new Date().toISOString());
        
        // Try to get session with timeout
        let session;
        let sessionCheckFailed = false;
        
        try {
          const sessionPromise = supabase.auth.getSession();
          console.log('📡 Session promise created, waiting for response...');
          
          const result = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: any } };
          session = result.data.session;
          console.log('📋 Current session:', session);
          console.log('⏱️ Session check completed at:', new Date().toISOString());
        } catch (sessionError) {
          console.error('🚨 Session check failed:', sessionError);
          sessionCheckFailed = true;
          
          // If session check fails, try to get user directly
          try {
            console.log('🔄 Trying to get user directly...');
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              console.log('✅ User found directly:', user.email);
              await fetchUserProfile(user.id);
              return;
            }
          } catch (userError) {
            console.error('🚨 Direct user check also failed:', userError);
          }
          // If both fail, continue without session
          session = null;
        }
        
        // If Supabase calls are failing, try to use localStorage data
        if (sessionCheckFailed && !session) {
          console.log('🔄 Supabase calls failed, trying localStorage fallback...');
          const success = await createUserFromLocalStorage();
          if (success) {
            console.log('✅ Successfully created user from localStorage fallback');
            return;
          }
        }
        
        if (session?.access_token) {
          console.log('✅ User is already authenticated:', session.user.email);
          console.log('🔄 Fetching user profile for ID:', session.user.id);
          await fetchUserProfile(session.user.id);
        } else {
          console.log('❌ No active session found');
        }
      } catch (error) {
        console.error('🚨 Error checking session:', error);
        if (error instanceof Error && error.message === 'Session check timeout') {
          console.log('⏰ Session check timed out, clearing state...');
          await forceSignOut();
        } else {
          // For any other error, also clear loading state
          console.log('🚨 Unexpected error, clearing loading state...');
        }
      } finally {
        console.log('🏁 Setting loading to false');
        console.log('⏱️ Final timestamp:', new Date().toISOString());
        setLoading(false);
      }
    };

    checkSession();

    // Backup timeout to ensure loading state is always cleared
    const backupTimeout = setTimeout(() => {
      console.log('🚨 Backup timeout triggered - forcing loading to false');
      setLoading(false);
    }, 4000); // 4 seconds total backup timeout

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event, session?.user?.email);
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('🔐 User signed in, fetching profile...');
          await fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out');
          setUser(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(backupTimeout);
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      console.log('🔍 Fetching user profile for ID:', userId);
      
      // First try to get profile from Supabase
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('❌ Error fetching user profile:', error);
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          console.log('📝 Profile not found, creating new profile...');
          await createUserProfile(userId);
        }
        return;
      }

      console.log('✅ User profile fetched successfully:', profile);
      setUser(profile);
    } catch (error) {
      console.error('🚨 Error in fetchUserProfile:', error);
      
      // If Supabase fails, try to create user from localStorage
      console.log('🔄 Supabase failed, falling back to localStorage...');
      const success = await createUserFromLocalStorage();
      if (success) {
        console.log('✅ Successfully created user from localStorage fallback');
      } else {
        console.log('❌ Failed to create user from localStorage fallback');
      }
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
    } catch (error) {
      console.error('Error creating user profile:', error);
    }
  };

  const sendCode = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      // First check if user is already authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('User already authenticated, signing out first...');
        await supabase.auth.signOut();
        setUser(null);
      }

      console.log('Sending OTP code to:', email);
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

      console.log('OTP code sent successfully');
      return { success: true, message: '6-digit code sent to your email!' };
    } catch (error) {
      console.error('Error sending code:', error);
      return { success: false, message: 'Failed to send code' };
    }
  };

  const signIn = async (email: string, code: string): Promise<{ success: boolean; message: string }> => {
    try {
      console.log('Verifying OTP code for:', email);
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
        console.log('OTP verification successful for user:', data.user.email);
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
      console.log('🧹 Force clearing all authentication state...');
      
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
        console.log('🗑️ Removing localStorage key:', key);
        localStorage.removeItem(key);
      });
      
      console.log('✅ Authentication state cleared successfully');
    } catch (error) {
      console.error('🚨 Error clearing authentication state:', error);
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

  const debugSession = async () => {
    try {
      console.log('🔍 Manual session debug started...');
      console.log('⏱️ Debug timestamp:', new Date().toISOString());
      console.log('📊 Current state:', { user, loading });
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log('📋 Manual session check result:', session);
      
      if (session?.access_token) {
        console.log('✅ Session is active. User:', session.user.email);
        console.log('🔄 Attempting to fetch user profile...');
        await fetchUserProfile(session.user.id);
      } else {
        console.log('❌ No active session found.');
      }
      
      console.log('🏁 Manual debug completed');
    } catch (error) {
      console.error('🚨 Error in manual session debug:', error);
    }
  };

  const manualSessionCheck = async () => {
    try {
      console.log('🔍 Manual session check with timeout...');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Manual check timeout')), 3000); // 3 second timeout
      });
      
      const sessionPromise = supabase.auth.getSession();
      
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      console.log('✅ Manual check successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Manual check failed:', error);
      return null;
    }
  };

  const forceClearLoading = () => {
    console.log('🧹 Manually clearing loading state...');
    setLoading(false);
  };

  const refreshSupabaseClient = async () => {
    try {
      console.log('🔄 Refreshing Supabase client...');
      
      // Clear any existing session
      await supabase.auth.signOut();
      
      // Try to get session again
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        console.log('✅ Supabase client refreshed successfully');
        await fetchUserProfile(session.user.id);
      } else {
        console.log('❌ No session after refresh');
      }
    } catch (error) {
      console.error('🚨 Error refreshing Supabase client:', error);
    }
  };

  const createUserFromLocalStorage = async () => {
    try {
      console.log('🔍 Manually creating user from localStorage...');
      
      // Check all possible localStorage keys
      const allKeys = Object.keys(localStorage);
      const supabaseKeys = allKeys.filter(key => key.includes('supabase') || key.includes('sb-'));
      
      console.log('🔍 Found Supabase-related keys:', supabaseKeys);
      
      for (const key of supabaseKeys) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const parsed = JSON.parse(data);
            console.log(`🔍 Checking ${key}:`, parsed);
            
            if (parsed.access_token && parsed.user) {
              console.log(`✅ Found valid session in ${key}, creating user...`);
              
              // Create a minimal user object from localStorage data
              const tempUser: User = {
                id: parsed.user.id,
                email: parsed.user.email,
                name: parsed.user.user_metadata?.name || parsed.user.email,
                phone: parsed.user.phone || '',
                role: 'user', // Default role
                subscription_plan: 'free', // Default plan
                monthly_generations_limit: 10, // Default limit
                total_generations: 0,
                successful_generations: 0,
                failed_generations: 0,
                is_active: true,
                created_at: parsed.user.created_at || new Date().toISOString(),
                updated_at: parsed.user.updated_at || new Date().toISOString()
              };
              
              console.log('✅ Setting user from localStorage data:', tempUser);
              setUser(tempUser);
              setLoading(false);
              return true;
            }
          }
        } catch (parseError) {
          console.log(`⚠️ Failed to parse ${key}:`, parseError);
        }
      }
      
      console.log('❌ No valid session data found in localStorage');
      return false;
    } catch (error) {
      console.error('🚨 Error creating user from localStorage:', error);
      return false;
    }
  };

  const bypassSupabaseAndUseLocalStorage = async () => {
    try {
      console.log('🚀 Bypassing Supabase entirely, using localStorage only...');
      setLoading(true);
      
      const success = await createUserFromLocalStorage();
      if (success) {
        console.log('✅ Successfully bypassed Supabase and created user from localStorage');
        return true;
      } else {
        console.log('❌ Failed to create user from localStorage');
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('🚨 Error in bypass function:', error);
      setLoading(false);
      return false;
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
    debugSession,
    manualSessionCheck,
    forceClearLoading,
    refreshSupabaseClient,
    createUserFromLocalStorage,
    bypassSupabaseAndUseLocalStorage,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
