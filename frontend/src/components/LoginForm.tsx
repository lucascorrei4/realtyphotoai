import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, CheckCircle, AlertCircle, MailCheck, Clock, Copy, Bell } from 'lucide-react';
import OffersSection from './OffersSection';
import { getBackendUrl } from '../config/api';
import { buildConversionMetadata } from '../utils/conversionTracking';
import { supabase } from '../config/supabase';

export interface LoginFormProps {
  variant?: 'landing' | 'auth-page';
  showLogo?: boolean;
  onSuccess?: () => void;
  redirectTo?: string;
  className?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({
  variant = 'landing',
  showLogo = false,
  onSuccess,
  redirectTo = '/dashboard',
  className = ''
}) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'plan'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [codeEnteredTime, setCodeEnteredTime] = useState<number | null>(null);
  const [autoSubmitAttempted, setAutoSubmitAttempted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [codeSentTime, setCodeSentTime] = useState<number | null>(null);
  const [hasAutoSubmitError, setHasAutoSubmitError] = useState(false);
  const [isFirstSignIn, setIsFirstSignIn] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { sendCode, signIn, refreshUser } = useAuth();
  const navigate = useNavigate();

  const STORAGE_KEY = 'login_form_state';
  const CODE_EXPIRY_DURATION = 2 * 60 * 1000; // 2 minutes

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        
        // Check if code is still valid (not expired)
        if (parsed.codeSentTime && (now - parsed.codeSentTime) < CODE_EXPIRY_DURATION) {
          // Restore state only if code hasn't expired
          if (parsed.email) setEmail(parsed.email);
          if (parsed.step) setStep(parsed.step);
          if (parsed.codeSentTime) {
            setCodeSentTime(parsed.codeSentTime);
            // The countdown timer will automatically recalculate from this time
          }
        } else {
          // Clear expired state
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error restoring login form state:', error);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    
    // Cleanup on unmount - clear storage if user navigates away after successful auth
    return () => {
      // Only clear if we're not in the middle of a successful auth flow
      // (storage will be cleared explicitly on success)
    };
  }, []);

  // Save state to sessionStorage whenever relevant values change
  useEffect(() => {
    try {
      if (step === 'code' && email && codeSentTime) {
        const state = {
          email,
          step,
          codeSentTime,
          timestamp: Date.now()
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else if (step === 'email') {
        // Clear storage when back to email step
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error saving login form state:', error);
    }
  }, [step, email, codeSentTime]);

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup timers on unmount
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // Auto-focus code input when step changes
  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        codeInputRef.current?.focus();
      }, 100);
    }
  }, [step]);

  // Check if user should see plan selection step
  // Show plan selection if:
  // 1. First-time sign in (meta_event_name is 'Lead' or null), OR
  // 2. User is on free plan and doesn't have an active paid subscription
  const checkIsFirstSignIn = useCallback(async (userId: string): Promise<boolean> => {
    try {
      // Check user profile directly from Supabase before it gets updated
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('meta_event_name, subscription_plan')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking user profile:', error);
        return false;
      }

      if (!profile) {
        // Profile doesn't exist yet - this is a first sign in
        console.log('[LoginForm] Profile not found - treating as first sign in');
        return true;
      }

      // If meta_event_name is 'Lead' or null, this is first sign in
      const isFirstTimeSignIn = profile.meta_event_name === 'Lead' || profile.meta_event_name === null;
      
      // If user is on free plan (or plan is null/undefined), check if they have an active paid subscription
      const subscriptionPlan = profile.subscription_plan || 'free'; // Default to 'free' if null/undefined
      if (subscriptionPlan === 'free') {
        try {
          // Check for active subscriptions in stripe_subscriptions table
          const { data: subscriptions, error: subError } = await supabase
            .from('stripe_subscriptions')
            .select('id, status, plan_name')
            .eq('user_id', userId)
            .eq('status', 'active')
            .limit(1);

          if (subError) {
            console.error('[LoginForm] Error checking subscriptions:', subError);
            // If we can't check subscriptions, default to showing plan selection for free users
            // This is safer - we'd rather show plan selection than miss it
            const shouldShowPlan = isFirstTimeSignIn || true;
            console.log('[LoginForm] Profile check result (subscription check failed - defaulting to show plan):', {
              userId,
              meta_event_name: profile.meta_event_name,
              subscription_plan: subscriptionPlan,
              isFirstTimeSignIn,
              subError: subError.message,
              shouldShowPlan
            });
            return shouldShowPlan;
          }

          // If user is on free plan and has no active subscription, show plan selection
          const hasActiveSubscription = subscriptions && subscriptions.length > 0;
          const shouldShowPlan = isFirstTimeSignIn || !hasActiveSubscription;
          
          console.log('[LoginForm] Profile check result (free user):', {
            userId,
            meta_event_name: profile.meta_event_name,
            subscription_plan: subscriptionPlan,
            isFirstTimeSignIn,
            hasActiveSubscription,
            activeSubscriptions: subscriptions?.length || 0,
            shouldShowPlan
          });
          
          return shouldShowPlan;
        } catch (subCheckError) {
          console.error('[LoginForm] Exception checking subscriptions:', subCheckError);
          // If subscription check fails, default to showing plan selection for free users
          // This is safer - we'd rather show plan selection than miss it
          const shouldShowPlan = isFirstTimeSignIn || true;
          console.log('[LoginForm] Profile check result (subscription check exception - defaulting to show plan):', {
            userId,
            meta_event_name: profile.meta_event_name,
            subscription_plan: subscriptionPlan,
            isFirstTimeSignIn,
            error: subCheckError instanceof Error ? subCheckError.message : String(subCheckError),
            shouldShowPlan
          });
          return shouldShowPlan;
        }
      }

      // If user is not on free plan, only show plan selection if it's their first sign in
      const shouldShowPlan = isFirstTimeSignIn;
      console.log('[LoginForm] Profile check result (non-free user):', {
        userId,
        meta_event_name: profile.meta_event_name,
        subscription_plan: subscriptionPlan,
        isFirstTimeSignIn,
        shouldShowPlan
      });
      return shouldShowPlan;
    } catch (error) {
      console.error('Error checking first sign in:', error);
      return false;
    }
  }, []);

  // Memoize the verify function to prevent unnecessary re-renders
  const handleAutoVerify = useCallback(async () => {
    if (!isMountedRef.current || !code || code.length !== 6 || loading || autoSubmitAttempted || hasAutoSubmitError) {
      return;
    }

    try {
      setAutoSubmitAttempted(true);
      setLoading(true);
      setMessage('');
      
      // Set flag IMMEDIATELY before verifyOtp to prevent App.tsx from redirecting
      // This is critical because verifyOtp creates a session, which triggers AuthContext
      // to set the user state, which would cause an immediate redirect
      // Use a more aggressive approach - set to 'true' by default, then remove if not needed
      sessionStorage.setItem('show_plan_selection', 'checking');
      
      // Verify OTP directly to get user before signIn triggers complete-registration
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email'
      });

      if (verifyError) {
        sessionStorage.removeItem('show_plan_selection');
        setMessage(verifyError.message);
        setMessageType('error');
        setAutoSubmitAttempted(true);
        setHasAutoSubmitError(true);
        setLoading(false);
        return;
      }

      if (!verifyData?.user) {
        sessionStorage.removeItem('show_plan_selection');
        setMessage('Verification failed');
        setMessageType('error');
        setAutoSubmitAttempted(true);
        setHasAutoSubmitError(true);
        setLoading(false);
        return;
      }

      // Check profile IMMEDIATELY after verifyOtp, before any async complete-registration calls
      const firstSignIn = await checkIsFirstSignIn(verifyData.user.id);
      setIsFirstSignIn(firstSignIn);

      // Update flag based on check result - set IMMEDIATELY before any other async operations
      if (firstSignIn) {
        sessionStorage.setItem('show_plan_selection', 'true');
        console.log('[LoginForm] First sign in detected - showing plan selection step', {
          userId: verifyData.user.id,
          firstSignIn
        });
      } else {
        sessionStorage.removeItem('show_plan_selection');
        console.log('[LoginForm] Returning user - will redirect to dashboard', {
          userId: verifyData.user.id,
          firstSignIn
        });
      }
      
      // Force a small delay to ensure sessionStorage is written before any navigation attempts
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger complete-registration manually (since we already verified OTP)
      // This ensures the backend knows about the registration
      const backendUrl = getBackendUrl();
      const conversionMetadata = buildConversionMetadata(email, verifyData.user.id);
      
      fetch(`${backendUrl}/api/v1/auth/complete-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: verifyData.user.id,
          ...conversionMetadata,
        }),
      }).catch(err => {
        console.error('Error calling complete-registration:', err);
        // Non-blocking - proceed anyway
      });

      // Refresh user data from AuthContext now that session is established
      if (refreshUser) {
        await refreshUser().catch(err => {
          console.error('Error refreshing user:', err);
          // Non-blocking
        });
      }

      setMessage('Successfully signed in!');
      setMessageType('success');
      setHasAutoSubmitError(false); // Reset error flag on success
      
      // Clear persisted state on successful login
      sessionStorage.removeItem(STORAGE_KEY);
      
      if (firstSignIn) {
        // Show plan selection step for new users
        console.log('[LoginForm] First sign in detected - showing plan selection step');
        setTimeout(() => {
          if (isMountedRef.current) {
            setStep('plan');
            setLoading(false); // Stop loading so user can interact
          }
        }, 500);
        return; // Exit early - don't navigate to dashboard
      } else {
        // Clear the flag for returning users
        sessionStorage.removeItem('show_plan_selection');
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
      setTimeout(() => {
        if (isMountedRef.current) {
          navigate(redirectTo);
        }
      }, 500);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Auto-verify error:', error);
      setMessage('Authentication failed. Please try again.');
      setMessageType('error');
      setAutoSubmitAttempted(true); // Keep as true to prevent retry
      setHasAutoSubmitError(true); // Mark that we had an error, don't auto-retry
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [code, email, loading, autoSubmitAttempted, hasAutoSubmitError, navigate, redirectTo, onSuccess, checkIsFirstSignIn, refreshUser]);

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    // Clear any existing timer
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }

    // Reset error flag when code changes (user is typing a new code)
    if (code.length < 6) {
      setAutoSubmitAttempted(false);
      setHasAutoSubmitError(false);
    }

    // Only auto-submit if we haven't had an error and conditions are met
    if (step === 'code' && code.length === 6 && !loading && !autoSubmitAttempted && !hasAutoSubmitError && isMountedRef.current) {
      // Small delay for better UX (user can see all digits entered)
      autoSubmitTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && code.length === 6 && !hasAutoSubmitError) {
          handleAutoVerify();
        }
      }, 300);
    }

    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    };
  }, [code, step, loading, autoSubmitAttempted, hasAutoSubmitError, handleAutoVerify]);

  // Track when code was entered for reminder
  useEffect(() => {
    if (step === 'code' && code.length > 0) {
      if (codeEnteredTime === null) {
        setCodeEnteredTime(Date.now());
      }
    }
  }, [code, step, codeEnteredTime]);

  // Countdown timer when code step is active
  useEffect(() => {
    if (step === 'code' && codeSentTime) {
      const COUNTDOWN_DURATION = 2 * 60 * 1000; // 2 minutes
      const updateCountdown = () => {
        const elapsed = Date.now() - codeSentTime;
        const remaining = Math.max(0, COUNTDOWN_DURATION - elapsed);
        setCountdown(remaining);
        
        if (remaining === 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }
      };

      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    } else {
      setCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [step, codeSentTime]);

  // Update browser tab title when code is sent
  useEffect(() => {
    const originalTitle = document.title;
    
    if (step === 'code' && countdown !== null) {
      const minutes = Math.floor(countdown / 60000);
      const seconds = Math.floor((countdown % 60000) / 1000);
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      document.title = `⏰ ${timeString} - Enter your code | ${originalTitle.split('|')[1] || 'RealVision AI'}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [step, countdown]);

  // Browser notification when code is sent (if user allows)
  useEffect(() => {
    if (step === 'code' && codeSentTime && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('Check your email!', {
          body: `We sent a 6-digit code to ${email}. Please enter it to continue.`,
          icon: '/logo_white.png',
          tag: 'verification-code',
          requireInteraction: false,
        });
      } catch (error) {
        console.error('Notification error:', error);
        // Silently fail - notification is not critical
      }
    }
  }, [step, codeSentTime, email]);

  const handleSendCode = async () => {
    if (!isMountedRef.current) return;
    
    if (!email || !email.includes('@')) {
      setMessage('Please enter a valid email address');
      setMessageType('error');
      return;
    }

    try {
      setLoading(true);
      setMessage('');

      const result = await sendCode(email);
      
      if (!isMountedRef.current) return; // Component unmounted during async operation
      
      if (result.success) {
        setMessage(result.message);
        setMessageType('success');
        setStep('code');
        setCodeEnteredTime(null);
        setAutoSubmitAttempted(false);
        setCodeSentTime(Date.now());
        
        // Request notification permission
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
          Notification.requestPermission().catch(err => {
            console.error('Notification permission error:', err);
          });
        }
      } else {
        setMessage(result.message);
        setMessageType('error');
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Send code error:', error);
      setMessage('Failed to send code. Please try again.');
      setMessageType('error');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleVerifyCode = async () => {
    if (!isMountedRef.current) return;
    
    if (!code || code.length !== 6) {
      setMessage('Please enter the 6-digit code');
      setMessageType('error');
      return;
    }

    try {
      setLoading(true);
      setMessage('');
      setHasAutoSubmitError(false); // Reset error flag on manual verify

      // Set flag IMMEDIATELY before verifyOtp to prevent App.tsx from redirecting
      // This is critical because verifyOtp creates a session, which triggers AuthContext
      // to set the user state, which would cause an immediate redirect
      sessionStorage.setItem('show_plan_selection', 'checking');

      // Verify OTP directly to get user before signIn triggers complete-registration
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email'
      });

      if (verifyError) {
        sessionStorage.removeItem('show_plan_selection');
        setMessage(verifyError.message);
        setMessageType('error');
        setAutoSubmitAttempted(true);
        setHasAutoSubmitError(true);
        setLoading(false);
        return;
      }

      if (!verifyData?.user) {
        sessionStorage.removeItem('show_plan_selection');
        setMessage('Verification failed');
        setMessageType('error');
        setAutoSubmitAttempted(true);
        setHasAutoSubmitError(true);
        setLoading(false);
        return;
      }

      // Check profile IMMEDIATELY after verifyOtp, before any async complete-registration calls
      const firstSignIn = await checkIsFirstSignIn(verifyData.user.id);
      setIsFirstSignIn(firstSignIn);

      // Set flag to prevent App.tsx from redirecting if this is first sign in
      // Update flag IMMEDIATELY before any other async operations
      if (firstSignIn) {
        sessionStorage.setItem('show_plan_selection', 'true');
        console.log('[LoginForm] First sign in detected - showing plan selection step', {
          userId: verifyData.user.id,
          firstSignIn
        });
      } else {
        sessionStorage.removeItem('show_plan_selection');
        console.log('[LoginForm] Returning user - will redirect to dashboard', {
          userId: verifyData.user.id,
          firstSignIn
        });
      }
      
      // Force a small delay to ensure sessionStorage is written before any navigation attempts
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger complete-registration manually (since we already verified OTP)
      // This ensures the backend knows about the registration
      const backendUrl = getBackendUrl();
      const conversionMetadata = buildConversionMetadata(email, verifyData.user.id);
      
      fetch(`${backendUrl}/api/v1/auth/complete-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: verifyData.user.id,
          ...conversionMetadata,
        }),
      }).catch(err => {
        console.error('Error calling complete-registration:', err);
        // Non-blocking - proceed anyway
      });

      // Refresh user data from AuthContext now that session is established
      if (refreshUser) {
        await refreshUser().catch(err => {
          console.error('Error refreshing user:', err);
          // Non-blocking
        });
      }

      setMessage('Successfully signed in!');
      setMessageType('success');
      setHasAutoSubmitError(false);
      
      // Clear persisted state on successful login
      sessionStorage.removeItem(STORAGE_KEY);
      
      if (firstSignIn) {
        // Show plan selection step for new users
        // Don't navigate away - stay on the form to show plan selection
        console.log('[LoginForm] First sign in detected - showing plan selection step');
        setTimeout(() => {
          if (isMountedRef.current) {
            setStep('plan');
            setLoading(false); // Stop loading so user can interact
          }
        }, 500);
        return; // Exit early - don't navigate to dashboard
      } else {
        // Clear the flag for returning users
        sessionStorage.removeItem('show_plan_selection');
      }
      
      // Not a first-time user, proceed with normal flow
      if (onSuccess) {
        onSuccess();
      }
      
      // Small delay to show success message before redirect
      setTimeout(() => {
        if (isMountedRef.current) {
          navigate(redirectTo);
        }
      }, 500);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Verify code error:', error);
      setMessage('Authentication failed. Please try again.');
      setMessageType('error');
      setAutoSubmitAttempted(true); // Prevent auto-retry
      setHasAutoSubmitError(true);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setMessage('');
    setCodeEnteredTime(null);
    setAutoSubmitAttempted(false);
    setHasAutoSubmitError(false); // Reset error flag
    setCodeSentTime(null);
    setCountdown(null);
    // Clear persisted state when going back
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(email).then(() => {
      // Brief feedback could be shown here
    });
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    // Reset error flags when user manually changes the code
    if (value.length < 6) {
      setAutoSubmitAttempted(false);
      setHasAutoSubmitError(false);
    }
  };

  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6 && !loading) {
      handleVerifyCode();
    }
  };

  const handleResendCode = async () => {
    setCode('');
    setMessage('');
    setCodeEnteredTime(null);
    setAutoSubmitAttempted(false);
    setHasAutoSubmitError(false); // Reset error flag
    setCodeSentTime(null);
    setCountdown(null);
    await handleSendCode();
  };

  const isAuthPageVariant = variant === 'auth-page';

  // Calculate countdown display
  const countdownMinutes = countdown ? Math.floor(countdown / 60000) : 0;
  const countdownSeconds = countdown ? Math.floor((countdown % 60000) / 1000) : 0;
  const isCountdownActive = countdown !== null && countdown > 0;
  const isCountdownLow = countdown !== null && countdown < 60000; // Less than 1 minute

  // Handler for when user selects a plan (skip plan selection and go to dashboard)
  const handlePlanSelected = () => {
    // Clear the flag so App.tsx can redirect normally
    sessionStorage.removeItem('show_plan_selection');
    
    if (onSuccess) {
      onSuccess();
    }
    setTimeout(() => {
      if (isMountedRef.current) {
        navigate(redirectTo);
      }
    }, 300);
  };

  // Safety check: ensure step is valid
  if (step !== 'email' && step !== 'code' && step !== 'plan') {
    console.error('Invalid step value:', step);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500">An error occurred. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  // Render based on variant
  if (isAuthPageVariant) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-all duration-500 ${
        step === 'code' 
          ? 'bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950' 
          : step === 'plan'
          ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
          : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900'
      } ${className}`}>
        <div className={`w-full space-y-8 ${step === 'plan' ? 'max-w-6xl' : 'max-w-md'}`}>
          {/* Logo */}
          {showLogo && (
            <div className="text-center mb-4">
              <a href="/" title="Go home">
                <img 
                  src="https://realvisionaire.com/logo_white.png" 
                  alt="Real Vision AI Logo" 
                  className="mx-auto h-32 w-auto object-contain"
                />
              </a>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-center space-x-2 mb-6 flex-wrap">
            <div className={`flex items-center space-x-2 transition-all duration-300 ${
              step === 'email' ? 'scale-105' : ''
            }`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
                step === 'email'
                  ? 'bg-blue-500 text-white ring-4 ring-blue-500/30'
                  : (step === 'code' || step === 'plan')
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-gray-300'
              }`}>
                {(step === 'code' || step === 'plan') ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  '1'
                )}
              </div>
              <span className={`text-sm font-medium transition-colors hidden sm:inline ${
                step === 'email' ? 'text-white' : (step === 'code' || step === 'plan') ? 'text-green-400' : 'text-gray-400'
              }`}>
                Email
              </span>
            </div>
            
            {/* Connector Line */}
            <div className={`h-0.5 w-8 transition-all duration-300 ${
              (step === 'code' || step === 'plan') ? 'bg-blue-500' : 'bg-slate-600'
            }`}></div>
            
            <div className={`flex items-center space-x-2 transition-all duration-300 ${
              step === 'code' ? 'scale-105' : ''
            }`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
                step === 'code'
                  ? 'bg-blue-500 text-white ring-4 ring-blue-500/30 animate-pulse'
                  : step === 'plan'
                    ? 'bg-green-500 text-white'
                    : 'bg-slate-600 text-gray-300'
              }`}>
                {step === 'plan' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  '2'
                )}
              </div>
              <span className={`text-sm font-medium transition-colors hidden sm:inline ${
                step === 'code' ? 'text-white' : step === 'plan' ? 'text-green-400' : 'text-gray-400'
              }`}>
                Code
              </span>
            </div>
            
            {/* Connector Line */}
            <div className={`h-0.5 w-8 transition-all duration-300 ${
              step === 'plan' ? 'bg-blue-500' : 'bg-slate-600'
            }`}></div>
            
            <div className={`flex items-center space-x-2 transition-all duration-300 ${
              step === 'plan' ? 'scale-105' : ''
            }`}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
                step === 'plan'
                  ? 'bg-blue-500 text-white ring-4 ring-blue-500/30 animate-pulse'
                  : 'bg-slate-600 text-gray-300'
              }`}>
                3
              </div>
              <span className={`text-sm font-medium transition-colors hidden sm:inline ${
                step === 'plan' ? 'text-white' : 'text-gray-400'
              }`}>
                Plan
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center">
            <h2 className={`text-3xl font-bold text-white`}>
              {step === 'email' ? 'Welcome' : step === 'code' ? 'Enter Your Code' : 'Choose Your Plan'}
            </h2>
            {step === 'code' && (
              <div className="mt-3 mb-6">
                <p className="text-sm text-gray-400 mb-1">
                  Code sent to
                </p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm font-medium text-blue-400 break-all">
                    {email}
                  </p>
                  <button
                    onClick={handleCopyEmail}
                    className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                    title="Copy email"
                  >
                    <Copy className="h-4 w-4 text-blue-400" />
                  </button>
                </div>
                {isCountdownActive && (
                  <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                    isCountdownLow 
                      ? 'bg-red-500/20 text-red-300 border border-red-500/50' 
                      : 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                  }`}>
                    <Clock className={`h-4 w-4 ${isCountdownLow ? 'animate-pulse' : ''}`} />
                    <span className={`text-xs font-semibold`}>
                      {formatTime(countdown)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {step === 'email' && (
              <p className="mt-2 text-sm text-gray-300">
                Enter your email to receive a login code
              </p>
            )}
          </div>

          {/* Form */}
          {step === 'plan' ? (
            <div className="w-full flex flex-col items-center">
              <div className="w-full max-w-6xl">
                <OffersSection 
                  title="Add Credits And Go"
                  subtitle="Select a plan to get started with RealVision AI"
                  embedded={true}
                />
              </div>
            </div>
          ) : (
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 space-y-6">
            {step === 'email' ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !loading && email && handleSendCode()}
                      className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="Enter your email"
                      disabled={loading}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendCode}
                  disabled={loading || !email}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-blue-500/30"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <span>Send Code</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Simplified reminder - only show if countdown is low or code not entered */}
                {isCountdownLow && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <div className="flex items-center justify-center gap-2">
                      <Bell className="h-4 w-4 text-red-400 animate-pulse" />
                      <span className="text-xs font-medium text-red-300 text-center">
                        Check your email now • Code expires soon
                      </span>
                    </div>
                  </div>
                )}
                
                <div>
                  <label htmlFor="code" className="block text-sm font-semibold text-gray-200 mb-3">
                    Verification Code
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-blue-400" />
                    <input
                      ref={codeInputRef}
                      id="code"
                      type="text"
                      value={code}
                      onChange={handleCodeChange}
                      onKeyDown={handleCodeKeyDown}
                      className="w-full pl-14 pr-4 py-4 bg-slate-700/50 border-2 border-blue-500/50 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center text-2xl font-mono tracking-[0.5em] font-semibold shadow-lg shadow-blue-500/20"
                      placeholder="000000"
                      maxLength={6}
                      disabled={loading}
                      autoFocus
                      inputMode="numeric"
                    />
                  </div>
                  {/* Progress dots indicator */}
                  <div className="mt-3 flex items-center justify-center space-x-2">
                    {[1, 2, 3, 4, 5, 6].map((digit) => (
                      <div
                        key={digit}
                        className={`h-2 w-2 rounded-full transition-all duration-200 ${
                          code.length >= digit ? 'bg-blue-500 scale-125' : 'bg-slate-600'
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={handleBackToEmail}
                    disabled={loading}
                    className="flex-1 py-3 px-4 border border-slate-600 text-gray-300 rounded-lg font-medium hover:bg-slate-700 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleResendCode}
                    disabled={loading}
                    className="flex-1 py-3 px-4 border border-slate-600 text-gray-300 rounded-lg font-medium hover:bg-slate-700 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Resend
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    disabled={loading || code.length !== 6}
                    className={`flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg ${
                      code.length === 6 
                        ? 'shadow-blue-500/50 scale-105' 
                        : 'shadow-blue-500/30'
                    }`}
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <span>Verify Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Message Display */}
            {message && (
              <div className={`p-4 rounded-lg flex items-center space-x-3 ${
                messageType === 'success' 
                  ? 'bg-green-900/30 text-green-300 border border-green-700/50' 
                  : 'bg-red-900/30 text-red-300 border border-red-700/50'
              }`}>
                {messageType === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                <span className="text-sm font-medium">{message}</span>
              </div>
            )}
          </div>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-gray-400">
            {step === 'email' ? (
              <p>
                Don't have an account? No problem! Just enter your email and we'll create one for you.
              </p>
            ) : (
              <p className="text-xs">
                Didn't receive it? Check spam or{' '}
                <button
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-blue-400 hover:text-blue-300 underline disabled:opacity-50"
                >
                  resend
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Landing page variant
  return (
    <div className={className}>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-2 mb-6 flex-wrap">
        <div className={`flex items-center space-x-2 transition-all duration-300 ${
          step === 'email' ? 'scale-105' : ''
        }`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
            step === 'email'
              ? 'bg-blue-600 text-white ring-4 ring-blue-600/30 dark:bg-blue-500'
              : (step === 'code' || step === 'plan')
                ? 'bg-green-500 text-white'
                : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
          }`}>
            {(step === 'code' || step === 'plan') ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              '1'
            )}
          </div>
          <span className={`text-sm font-medium transition-colors hidden sm:inline ${
            step === 'email' 
              ? 'text-blue-600 dark:text-blue-400 font-semibold' 
              : (step === 'code' || step === 'plan')
                ? 'text-green-600 dark:text-green-400' 
                : 'text-gray-500 dark:text-gray-400'
          }`}>
            Email
          </span>
        </div>
        
        {/* Connector Line */}
        <div className={`h-0.5 w-8 transition-all duration-300 ${
          (step === 'code' || step === 'plan')
            ? 'bg-blue-600 dark:bg-blue-500' 
            : 'bg-gray-300 dark:bg-gray-600'
        }`}></div>
        
        <div className={`flex items-center space-x-2 transition-all duration-300 ${
          step === 'code' ? 'scale-105' : ''
        }`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
            step === 'code'
              ? 'bg-blue-600 text-white ring-4 ring-blue-600/30 animate-pulse dark:bg-blue-500'
              : step === 'plan'
                ? 'bg-green-500 text-white'
                : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
          }`}>
            {step === 'plan' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              '2'
            )}
          </div>
          <span className={`text-sm font-medium transition-colors hidden sm:inline ${
            step === 'code' 
              ? 'text-blue-600 dark:text-blue-400 font-semibold' 
              : step === 'plan'
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400'
          }`}>
            Code
          </span>
        </div>
        
        {/* Connector Line */}
        <div className={`h-0.5 w-8 transition-all duration-300 ${
          step === 'plan'
            ? 'bg-blue-600 dark:bg-blue-500' 
            : 'bg-gray-300 dark:bg-gray-600'
        }`}></div>
        
        <div className={`flex items-center space-x-2 transition-all duration-300 ${
          step === 'plan' ? 'scale-105' : ''
        }`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-all duration-300 ${
            step === 'plan'
              ? 'bg-blue-600 text-white ring-4 ring-blue-600/30 animate-pulse dark:bg-blue-500'
              : 'bg-gray-300 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
          }`}>
            3
          </div>
          <span className={`text-sm font-medium transition-colors hidden sm:inline ${
            step === 'plan' 
              ? 'text-blue-600 dark:text-blue-400 font-semibold' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            Plan
          </span>
        </div>
      </div>

      <div className="mb-6 text-center sm:mb-8">
        <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-500 sm:h-16 sm:w-16 ${
          step === 'code'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 animate-pulse scale-110'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`}>
          {step === 'code' ? (
            <MailCheck className="h-6 w-6 text-white sm:h-8 sm:w-8 animate-pulse" />
          ) : (
            <Mail className="h-6 w-6 text-white sm:h-8 sm:w-8" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
          {step === 'email' ? 'Get Started Today' : step === 'code' ? 'Enter Your Code' : 'Choose Your Plan'}
        </h2>
        {step === 'email' ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Enter your email to receive a secure login code.
          </p>
        ) : (
          <div className="mt-3 mb-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Code sent to
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400 break-all">{email}</span>
              <button
                onClick={handleCopyEmail}
                className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                title="Copy email"
              >
                <Copy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </button>
            </div>
            {isCountdownActive && (
              <div className={`mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full ${
                isCountdownLow 
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30' 
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
              }`}>
                <Clock className={`h-4 w-4 ${isCountdownLow ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-semibold">
                  {formatTime(countdown)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {step === 'plan' ? (
        <div className="w-full flex flex-col items-center">
          <div className="w-full max-w-6xl">
            <OffersSection 
              title="Add Credits And Go"
              subtitle="Select a plan to get started with RealVision AI"
              embedded={true}
            />
          </div>
        </div>
      ) : (
      <div className={`space-y-6 rounded-2xl p-6 shadow-xl ring-offset-2 transition-all duration-500 ${
        step === 'code'
          ? 'bg-white dark:bg-slate-800 ring-4 ring-blue-500/60 shadow-2xl shadow-blue-500/30'
          : 'bg-white dark:bg-slate-800 ring-offset-white dark:ring-offset-slate-950'
      }`}>
        {step === 'email' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="email-landing" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="email-landing"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && email && handleSendCode()}
                  className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
                  placeholder="you@agency.com"
                  disabled={loading}
                />
              </div>
            </div>
            <button
              onClick={handleSendCode}
              disabled={loading || !email}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
              ) : (
                <>
                  <span>Send Code</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Simplified reminder - only show if countdown is low */}
            {isCountdownLow && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 dark:bg-red-500/20 dark:border-red-500/50">
                <div className="flex items-center justify-center gap-2">
                  <Bell className="h-4 w-4 text-red-500 dark:text-red-400 animate-pulse" />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400 text-center">
                    Check your email now • Code expires soon
                  </span>
                </div>
              </div>
            )}
            
            <div>
              <label htmlFor="code-landing" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Verification Code
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={codeInputRef}
                  id="code-landing"
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  onKeyDown={handleCodeKeyDown}
                  className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-center text-lg font-mono tracking-widest text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700 dark:text-white"
                  placeholder="000000"
                  maxLength={6}
                  disabled={loading}
                  autoFocus
                  inputMode="numeric"
                />
              </div>
              {/* Progress indicator */}
              <div className="mt-3 flex items-center justify-center space-x-2">
                {[1, 2, 3, 4, 5, 6].map((digit) => (
                  <div
                    key={digit}
                    className={`h-2 w-2 rounded-full transition-all duration-200 ${
                      code.length >= digit 
                        ? 'bg-blue-500 scale-125' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  ></div>
                ))}
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleBackToEmail}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 py-3 text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Back
              </button>
              <button
                onClick={handleResendCode}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 py-3 text-gray-700 transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Resend
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className={`flex flex-1 items-center justify-center space-x-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-3 font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                  code.length === 6 ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                }`}
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                ) : (
                  <>
                    <span>Verify</span>
                    <CheckCircle className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className={`flex items-center space-x-3 rounded-lg p-4 ${
            messageType === 'success'
              ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200'
              : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
          }`}>
            {messageType === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-300" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-300" />
            )}
            <span className="text-sm font-medium">{message}</span>
          </div>
        )}
      </div>
      )}

      {step !== 'plan' && (
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          {step === 'email' ? (
            <p>Don't have an account? Enter your email and we'll create one instantly.</p>
          ) : (
            <p className="text-xs">
              Didn't receive it? Check spam or{' '}
              <button
                onClick={handleResendCode}
                disabled={loading}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline disabled:opacity-50"
              >
                resend
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default LoginForm;


