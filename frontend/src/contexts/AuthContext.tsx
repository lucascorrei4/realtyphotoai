import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import supabase from '../config/supabase';
import { sendConversionEvent, buildConversionMetadata } from '../utils/conversionTracking';

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
  const latestFetchIdRef = useRef(0);
  const isFetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const loadingTimeoutRef = useRef<number | null>(null);

  const clearLoadingFallback = useCallback(() => {
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  const markLoadingComplete = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }
    clearLoadingFallback();
    setLoading(false);
  }, [clearLoadingFallback]);

  const mapSessionUserToUser = useCallback((sessionUser: SupabaseAuthUser): User => ({
    id: sessionUser.id,
    email: sessionUser.email || '',
    name:
      sessionUser.user_metadata?.full_name ||
      sessionUser.user_metadata?.name ||
      sessionUser.email?.split('@')[0] ||
      'User',
    role: 'user',
    subscription_plan: 'free',
    monthly_generations_limit: 10,
    total_generations: 0,
    successful_generations: 0,
    failed_generations: 0,
    is_active: true,
    created_at: sessionUser.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }), []);

  const setUserFromSession = useCallback((sessionUser?: SupabaseAuthUser | null) => {
    if (!sessionUser) {
      return;
    }

    const mappedUser = mapSessionUserToUser(sessionUser);

    setUser(prev => {
      if (prev?.id === mappedUser.id) {
        return prev;
      }
      return mappedUser;
    });

    markLoadingComplete();
  }, [mapSessionUserToUser, markLoadingComplete]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearLoadingFallback();
    };
  }, [clearLoadingFallback]);

  useEffect(() => {
    loadingTimeoutRef.current = window.setTimeout(() => {
      markLoadingComplete();
    }, 4000);

    // Check for existing session
    const checkSession = async () => {
      try {
        // First, check for JWT token from super admin bypass
        const jwtToken = localStorage.getItem('auth_token');
        if (jwtToken) {
          try {
            // Verify token with backend and get user info
            const backendUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            const response = await fetch(`${backendUrl}/api/v1/auth/verify-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`,
              },
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.user) {
                // Set user from backend response
                setUser(result.user as User);
                markLoadingComplete();
                return;
              }
            } else {
              // Token is invalid or expired, remove it
              localStorage.removeItem('auth_token');
            }
          } catch (error) {
            console.error('❌ Error verifying JWT token:', error);
            // Continue to check Supabase session
          }
        }

        // Check if Supabase is properly configured
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

        if (!supabaseAnonKey || !supabaseUrl) {
          console.warn('⚠️ Supabase configuration missing - running in demo mode');
          markLoadingComplete();
          return;
        }

        // Simple session check from Supabase (should automatically read from localStorage)
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('❌ Session error:', error);
          markLoadingComplete();
          return;
        }

        if (session?.access_token && session?.user) {
          setUserFromSession(session.user);

          // Fetch full profile from database in background (non-blocking)
          fetchUserProfile(session.user.id).catch(err => {
            console.error('❌ Profile fetch error (non-critical):', err);
            // Don't clear user or set loading - user is already set from session
          });

          return;
        }

        // No session found, allow access to landing page
        markLoadingComplete();

      } catch (error) {
        console.error('🚨 Error checking session:', error);
        markLoadingComplete();
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          setUserFromSession(session.user);
          fetchUserProfile(session.user.id).catch(err => {
            console.error('❌ Profile fetch error (non-critical):', err);
          });
        } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
          setUser(null);
          markLoadingComplete();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [markLoadingComplete, setUserFromSession]);

  const fetchUserProfile = async (userId: string, retryCount: number = 0): Promise<void> => {
    if (isFetchingRef.current && retryCount === 0) {
      return;
    }

    const fetchId = ++latestFetchIdRef.current;
    isFetchingRef.current = true;

    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      if (!supabaseAnonKey || !supabaseUrl) {
        console.warn('⚠️ Supabase configuration missing - skipping profile fetch');
        markLoadingComplete();
        return;
      }

      if (retryCount >= 3) {
        console.warn('⚠️ Maximum fetch attempts reached - stopping retries');
        markLoadingComplete();
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('id,email,name,phone,role,subscription_plan,monthly_generations_limit,total_generations,successful_generations,failed_generations,is_active,created_at,updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error && !profile) {
        console.error('❌ Error fetching user profile:', error);

        if (error.code === 'PGRST116' || /No rows/i.test(error.message || '')) {
          await createUserProfile(userId);

          if (retryCount < 2) {
            await new Promise(resolve => setTimeout(resolve, 500));
            return fetchUserProfile(userId, retryCount + 1);
          }
        } else if (retryCount < 2 && (/timeout|network/i.test(error.message || '') || error.code === 'PGRST301')) {
          const delay = (1 << retryCount) * 500; // 500ms, 1s
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchUserProfile(userId, retryCount + 1);
        } else {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            markLoadingComplete();
          }
        }

        return;
      }

      if (!profile) {
        console.warn('⚠️ Profile query returned no data.');
        markLoadingComplete();
        return;
      }

      if (profile.is_active === false) {
        console.error('❌ User account is inactive');
        await forceSignOut();
        markLoadingComplete();
        return;
      }

      const resolvedRole = (profile.role || 'user') as User['role'];
      if (!['user', 'admin', 'super_admin'].includes(resolvedRole)) {
        console.warn('⚠️ Unexpected user role detected, defaulting to user:', profile.role);
      }

      setUser({
        ...(profile as User),
        role: ['user', 'admin', 'super_admin'].includes(resolvedRole) ? resolvedRole : 'user',
        is_active: profile.is_active ?? true,
      });
      markLoadingComplete();
    } catch (error) {
      console.error('🚨 Error in fetchUserProfile:', error);

      if (retryCount < 2) {
        const delay = (1 << retryCount) * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserProfile(userId, retryCount + 1);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        markLoadingComplete();
      }
    } finally {
      if (latestFetchIdRef.current === fetchId) {
        isFetchingRef.current = false;
        markLoadingComplete();
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
        // Ignore 409/23505 errors - profile already exists (duplicate key)
        if (error.code === '23505' || error.message?.includes('duplicate key')) {
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
      markLoadingComplete();
    } catch (error) {
      console.error('Error creating user profile:', error);
      markLoadingComplete();
    }
  };

  const sendCode = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      if (!supabaseAnonKey || !supabaseUrl) {
        // Demo mode - simulate successful code sending
        // Still send conversion event even in demo mode
        sendConversionEvent('send-code', email).catch(() => {
          // Ignore errors in demo mode
        });
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

      // Send Lead conversion event to backend (fire and forget)
      // The backend will check if user exists and send Lead event for new users
      sendConversionEvent('send-code', email).catch(() => {
        // Silently ignore errors - conversion tracking should not block user flow
      });

      return { success: true, message: '6-digit code sent to your email!' };
    } catch (error) {
      console.error('Error sending code:', error);
      return { success: false, message: 'Failed to send code' };
    }
  };

  const signIn = async (email: string, code: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Super admin bypass code for testing/admin access
      const SUPER_ADMIN_CODE = '999999';
      const isSuperAdminBypass = code === SUPER_ADMIN_CODE;

      if (isSuperAdminBypass) {
        console.warn('⚠️ SUPER ADMIN BYPASS CODE DETECTED - Using backend API for authentication');
        
        // Use backend API for super admin bypass
        const backendUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/api/v1/auth/verify-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, code }),
        });

        const result = await response.json();

        if (result.success && result.user) {
          // Store token if provided (needed for API calls)
          if (result.token) {
            localStorage.setItem('auth_token', result.token);
          }

          // Fetch full user profile from backend (same data structure as normal OTP login)
          // This ensures we have the most up-to-date information including generation counts
          // Use the backend API to get the complete profile, matching what fetchUserProfile does
          try {
            const backendUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
            const profileResponse = await fetch(`${backendUrl}/api/v1/auth/verify-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${result.token}`,
              },
            });

            if (profileResponse.ok) {
              const profileResult = await profileResponse.json();
              if (profileResult.success && profileResult.user) {
                // Use the complete user profile from backend (same as fetchUserProfile does)
                
                // Set user with complete profile data (matching normal OTP login flow)
                setUser({
                  ...profileResult.user,
                  role: (profileResult.user.role || 'user') as User['role'],
                  is_active: profileResult.user.is_active ?? true,
                } as User);
                markLoadingComplete();
              } else {
                // Fallback to user data from verify-code response
                setUser(result.user as User);
                markLoadingComplete();
              }
            } else {
              // Fallback to user data from verify-code response
              setUser(result.user as User);
              markLoadingComplete();
            }
          } catch (error) {
            console.warn('Failed to refresh user profile after super admin login:', error);
            // Fallback to user data from verify-code response
            setUser(result.user as User);
            markLoadingComplete();
          }

          // Send conversion event
          sendConversionEvent('verify-code', email, code).catch(() => {
            // Ignore errors
          });

          return { success: true, message: result.message || 'Super admin authentication successful!' };
        } else {
          return { success: false, message: result.message || 'Super admin authentication failed' };
        }
      }

      // Check if Supabase is configured
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
      const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

      if (!supabaseAnonKey || !supabaseUrl) {
        // Demo mode - simulate successful login
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
        // Still send conversion event even in demo mode
        sendConversionEvent('verify-code', email, code).catch(() => {
          // Ignore errors in demo mode
        });
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
        // Send CompleteRegistration conversion event to backend (fire and forget)
        // The backend will check if user is new (first sign-in) and send CompleteRegistration event
        const backendUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
        const conversionMetadata = buildConversionMetadata(email, data.user.id);
        
        fetch(`${backendUrl}/api/v1/auth/complete-registration`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: data.user.id,
            ...conversionMetadata,
          }),
        }).catch((error) => {
          // Silently ignore errors - conversion tracking should not block user flow
          console.debug('CompleteRegistration event tracking failed (non-blocking):', error);
        });

        // Set user immediately from session, don't wait for profile fetch
        setUserFromSession(data.user);

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
      // Clear JWT token from localStorage (used for super admin bypass)
      localStorage.removeItem('auth_token');
      // Clear sessionStorage items
      sessionStorage.removeItem('login_form_state');
      sessionStorage.removeItem('subscription-last-sync');
      markLoadingComplete();
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
      markLoadingComplete();

      // Clear JWT token from localStorage (used for super admin bypass)
      localStorage.removeItem('auth_token');

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

      // Clear sessionStorage items
      sessionStorage.removeItem('login_form_state');
      sessionStorage.removeItem('subscription-last-sync');

    } catch (error) {
      console.error('🚨 Error clearing authentication state:', error);
      markLoadingComplete();
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
    markLoadingComplete();
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
