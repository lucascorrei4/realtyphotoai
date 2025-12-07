import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../config/supabase';
import { getBackendUrl } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
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

              if (!addCreditsResponse.ok) {
                console.warn('Failed to add credits, but payment was successful');
              }
            } catch (creditError) {
              console.error('Error adding credits:', creditError);
              // Don't fail the payment success - credits may have been added by webhook
            }
          }

          // Redirect to dashboard
          setStatus('success');
          setMessage('Payment successful! Redirecting to dashboard...');
          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
          return;
        }

        // User is not logged in - store session ID and send magic link
        // Store session ID in localStorage for credit addition after authentication
        if (isOneTimePayment) {
          localStorage.setItem('pending_payment_session', sessionId);
        }

        // Send magic link with redirect that includes session_id
        const redirectUrl = `${window.location.origin}/auth/callback?redirect=/dashboard&session_id=${sessionId}`;
        
        const { error: magicLinkError } = await supabase.auth.signInWithOtp({
          email: customer_email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: redirectUrl,
          },
        });

        if (magicLinkError) {
          throw new Error(`Failed to send magic link: ${magicLinkError.message}`);
        }

        setStatus('success');
        setMessage(`Payment successful! Check your email (${customer_email}) for a magic link to access your account.`);
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

          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Payment Successful!
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                {message}
              </p>
              {message.includes('Check your email') && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm text-blue-800 dark:text-blue-200">
                  We've sent a magic link to your email. Click it to access your account and start using your credits!
                </div>
              )}
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

