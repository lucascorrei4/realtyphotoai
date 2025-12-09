import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../config/supabase';
import { getBackendUrl } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useCredits } from '../contexts/CreditContext';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { refreshCredits } = useCredits();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'verifying'>('loading');
  const [message, setMessage] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const sessionId = searchParams.get('session_id');
  const paymentType = searchParams.get('type');

  useEffect(() => {
    const processPaymentSuccess = async () => {
      if (!sessionId) {
        setStatus('error');
        setMessage('Missing payment session ID');
        return;
      }

      try {
        // Verify payment with backend
        const response = await fetch(`${getBackendUrl()}/api/v1/stripe/verify-session?session_id=${sessionId}`, {
          method: 'GET',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to verify payment' }));
          throw new Error(errorData.message || 'Failed to verify payment');
        }

        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || 'Payment verification failed');
        }

        const { customer_email, session: sessionData } = data;
        const metadata = sessionData?.metadata || {};

        if (!customer_email) {
          setStatus('error');
          setMessage('Could not retrieve payment information');
          return;
        }

        // Check if this is a one-time payment
        const isOneTimePayment = paymentType === 'one_time' || metadata.payment_type === 'one_time';
        const credits = parseInt(metadata.credits || '0', 10);

        // Check if user is already logged in
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          // User is logged in - check if we need to add credits (for one-time payments)
          if (isOneTimePayment && credits > 0 && currentSession.user.id) {
            try {
              // Add credits for logged-in user (in case webhook didn't process yet)
              const addCreditsResponse = await fetch(`${getBackendUrl()}/api/v1/stripe/add-credits-from-session`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${currentSession.access_token}`,
                },
                body: JSON.stringify({
                  sessionId,
                  userId: currentSession.user.id,
                }),
              });

              if (addCreditsResponse.ok) {
                console.log(`Successfully added ${credits} credits`);
                // Refresh user data and credits to update UI
                if (refreshUser) {
                  await refreshUser();
                }
                if (refreshCredits) {
                  await refreshCredits();
                }
              } else {
                console.warn('Failed to add credits, but payment was successful');
              }
            } catch (creditError) {
              console.error('Error adding credits:', creditError);
              // Don't fail the payment success - credits may have been added by webhook
              // Still refresh credits in case webhook processed it
              if (refreshCredits) {
                await refreshCredits();
              }
            }
          } else {
            // Refresh credits even if not one-time payment (to ensure UI is up to date)
            if (refreshCredits) {
              await refreshCredits();
            }
          }

          // Refresh user data to ensure profile is up to date
          if (refreshUser) {
            await refreshUser();
          }

          // Redirect to dashboard
          setStatus('success');
          setMessage('Payment successful! Redirecting to dashboard...');
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
          return;
        }

        // User is not logged in - automatically create account and send OTP for immediate access
        // First, check if account exists
        let accountExists = false;
        try {
          const { data: existingUser } = await supabase
            .from('user_profiles')
            .select('id, email')
            .eq('email', customer_email)
            .single();
          
          if (existingUser) {
            accountExists = true;
          }
        } catch (error) {
          // Account doesn't exist, will create it
          accountExists = false;
        }

        // Store session ID for credit addition after authentication
        if (isOneTimePayment) {
          localStorage.setItem('pending_payment_session', sessionId);
        }

        // Automatically send OTP code (6-digit code) - faster than magic link
        // This allows immediate access without checking email inbox
        // Note: Without emailRedirectTo, Supabase sends a 6-digit code instead of magic link
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: customer_email,
          options: {
            shouldCreateUser: true, // Creates account if it doesn't exist
            // Don't provide emailRedirectTo - this makes it send a 6-digit code instead of magic link
            // We'll also send a magic link as fallback below
          },
        });

        if (otpError) {
          throw new Error(`Failed to send access code: ${otpError.message}`);
        }

        // Also send magic link as fallback (users can use either method)
        const redirectUrl = `${window.location.origin}/auth/callback?redirect=/dashboard&session_id=${sessionId}`;
        await supabase.auth.signInWithOtp({
          email: customer_email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: redirectUrl,
          },
        }).catch(() => {
          // Ignore errors for magic link - OTP code is primary method
        });

        // Store customer email for OTP verification
        setCustomerEmail(customer_email);
        
        // Show success with OTP entry form instead of "check email" message
        setStatus('verifying');
        setMessage(`Payment successful! We've sent a 6-digit code to ${customer_email}. Enter it below to access your account and credits immediately.`);
      } catch (error) {
        console.error('Error processing payment success:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'An error occurred while processing your payment');
      }
    };

    processPaymentSuccess();
  }, [sessionId, paymentType, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Processing Payment...
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                Please wait while we confirm your payment
              </p>
            </>
          )}

          {status === 'verifying' && (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Payment Successful!
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {message}
              </p>
              
              {/* OTP Entry Form */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="otp" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Enter 6-digit code
                  </label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border-2 border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    placeholder="000000"
                    disabled={verifying}
                  />
                </div>
                
                <button
                  onClick={async () => {
                    if (otpCode.length !== 6) {
                      setMessage('Please enter a valid 6-digit code');
                      return;
                    }

                    setVerifying(true);
                    try {
                      // Verify OTP code
                      const { data, error } = await supabase.auth.verifyOtp({
                        email: customerEmail,
                        token: otpCode,
                        type: 'email',
                      });

                      if (error) {
                        throw error;
                      }

                      if (data.user) {
                        // Successfully verified - refresh user and credits, then redirect
                        if (refreshUser) {
                          await refreshUser();
                        }
                        if (refreshCredits) {
                          await refreshCredits();
                        }

                        // Add credits if one-time payment (in case webhook didn't process yet)
                        if (sessionId && paymentType === 'one_time') {
                          try {
                            const addCreditsResponse = await fetch(`${getBackendUrl()}/api/v1/stripe/add-credits-from-session`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${data.session?.access_token || ''}`,
                              },
                              body: JSON.stringify({
                                sessionId,
                                userId: data.user.id,
                              }),
                            });

                            if (addCreditsResponse.ok) {
                              // Refresh again after credits added
                              if (refreshCredits) {
                                await refreshCredits();
                              }
                              if (refreshUser) {
                                await refreshUser();
                              }
                            }
                          } catch (creditError) {
                            console.error('Error adding credits:', creditError);
                            // Don't fail - credits may have been added by webhook
                          }
                        }

                        setStatus('success');
                        setMessage('Access granted! Redirecting to dashboard...');
                        setTimeout(() => {
                          navigate('/dashboard');
                        }, 1500);
                      }
                    } catch (error: any) {
                      console.error('Error verifying OTP:', error);
                      setMessage(error.message || 'Invalid code. Please try again or check your email.');
                      setOtpCode('');
                    } finally {
                      setVerifying(false);
                    }
                  }}
                  disabled={verifying || otpCode.length !== 6}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {verifying ? 'Verifying...' : 'Verify & Access Account'}
                </button>

                <button
                  onClick={async () => {
                    // Resend OTP code
                    try {
                      const { error: resendError } = await supabase.auth.signInWithOtp({
                        email: customerEmail,
                        options: {
                          shouldCreateUser: true,
                          emailRedirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard&session_id=${sessionId}`,
                        },
                      });

                      if (resendError) {
                        setMessage(`Failed to resend code: ${resendError.message}`);
                      } else {
                        setMessage(`New code sent to ${customerEmail}. Please check your email.`);
                        setOtpCode('');
                      }
                    } catch (error: any) {
                      setMessage(`Failed to resend code: ${error.message}`);
                    }
                  }}
                  className="w-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                >
                  Didn't receive code? Resend
                </button>

                <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                  Or check your email for a magic link to access your account
                </p>
              </div>
            </>
          )}

          {status === 'success' && !message.includes('Check your email') && (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Payment Successful!
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {message}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Payment Error
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {message}
              </p>
              <button
                onClick={() => navigate('/pricing')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Return to Pricing
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;

