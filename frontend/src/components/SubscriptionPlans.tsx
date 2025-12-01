import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  SUBSCRIPTION_PLANS,
  SubscriptionPlan,
  formatPrice,
  getFeatureList,
} from '../config/subscriptionPlans';
import { getUserPlanFromDatabase, getAllPlansFromDatabase } from '../utils/planUtils';
import { getBackendUrl } from '../config/environment';

export type SubscriptionPlansVariant = 'modal' | 'page';

interface SubscriptionPlansProps {
  onClose?: () => void;
  onSuccess?: (planId: string) => void;
  variant?: SubscriptionPlansVariant;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({
  onClose,
  onSuccess,
  variant = 'page',
}) => {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => Object.values(SUBSCRIPTION_PLANS));
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const isModal = variant === 'modal';

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        // First, try to fetch all plans from database (source of truth)
        const dbPlans = await getAllPlansFromDatabase();
        
        if (dbPlans.length > 0) {
          // Include all plans including free, sort by price
          const allPlans = dbPlans
            .sort((a, b) => a.price.monthly - b.price.monthly);
          
          setPlans(allPlans);
        } else {
          // Fallback to hardcoded plans if database fetch fails
          console.warn('[SubscriptionPlans] No plans found in database, using hardcoded plans');
          const hardcodedPlans = Object.values(SUBSCRIPTION_PLANS)
            .sort((a, b) => a.price.monthly - b.price.monthly);
          setPlans(hardcodedPlans);
        }

        // Set current plan ID from user's subscription_plan
        if (user?.subscription_plan) {
          setCurrentPlanId(user.subscription_plan);
        }
      } catch (err) {
        console.error('[SubscriptionPlans] Error fetching plans:', err);
        // Fallback to hardcoded plans on error
        const hardcodedPlans = Object.values(SUBSCRIPTION_PLANS)
          .sort((a, b) => a.price.monthly - b.price.monthly);
        setPlans(hardcodedPlans);
        if (user?.subscription_plan) {
          setCurrentPlanId(user.subscription_plan);
        }
      }
    };

    fetchPlans();
  }, [user]);

  // Check if user has an active subscription
  useEffect(() => {
    const checkActiveSubscription = async () => {
      if (!user?.id) {
        setHasActiveSubscription(false);
        return;
      }

      try {
        const supabase = (await import('../config/supabase')).default;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setHasActiveSubscription(false);
          return;
        }

        const response = await fetch(`${getBackendUrl()}/api/v1/stripe/subscription`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setHasActiveSubscription(data.subscription?.status === 'active' || false);
        } else {
          setHasActiveSubscription(false);
        }
      } catch (error) {
        console.error('Error checking active subscription:', error);
        setHasActiveSubscription(false);
      }
    };

    checkActiveSubscription();
  }, [user]);

  const handleOpenCustomerPortal = async () => {
    setPortalLoading(true);
    setError(null);

    try {
      const supabase = (await import('../config/supabase')).default;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Please log in to manage subscription');
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open customer portal');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open customer portal');
      setPortalLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (planId === currentPlanId) {
      setError('You are already subscribed to this plan');
      return;
    }

    // Skip free plan - it doesn't need Stripe checkout
    if (planId === 'free') {
      setError('Free plan is automatically assigned. Please contact support if you need to switch to free.');
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      const supabase = (await import('../config/supabase')).default;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Prepare headers - include token if available, but don't require it
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Get user email if logged in (optional - Stripe will collect email if not provided)
      const userEmail = session?.user?.email;

      // Always go to Stripe checkout for paid plans
      // Stripe will collect email during checkout if user is not logged in
      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          planId,
          billingCycle,
          // Email is optional - Stripe will collect it during checkout
          ...(userEmail && { email: userEmail }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to create checkout session');
      }

      onSuccess?.(planId);
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(null);
    }
  };

  const getPrice = (plan: SubscriptionPlan) =>
    billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;

  const getYearlySavings = (plan: SubscriptionPlan) => {
    const fullYearlyPrice = plan.price.monthly * 12;
    const discountedYearlyPrice = plan.price.yearly;
    return fullYearlyPrice - discountedYearlyPrice;
  };

  const renderFeatureList = (plan: SubscriptionPlan) => {
    const features = getFeatureList(plan);
    const displayCredits = plan.features.displayCredits || plan.features.monthlyCredits;

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-1">
              {displayCredits.toLocaleString()}
            </div>
            <div className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Credits / Month
            </div>
          </div>
        </div>
        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-3 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-gray-700 font-medium">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const containerClasses = isModal
    ? 'p-6'
    : 'px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto';

  const headerContent = isModal ? (
    <div className="flex justify-between items-center mb-8">
      <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl"
          aria-label="Close subscription plans"
        >
          ×
        </button>
      )}
    </div>
  ) : (
    <div className="mb-12 text-center">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4">
        Choose Your Plan
      </h1>
      <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
        Start with 300 free credits. Upgrade anytime. Cancel anytime.
      </p>
    </div>
  );

  return (
    <div className={containerClasses}>
      {headerContent}

      <div className={`flex justify-center ${isModal ? 'mb-10' : 'mb-16'}`}>
        <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-xl p-1.5 border border-white/20">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 ${
              billingCycle === 'monthly'
                ? 'bg-white text-gray-900 shadow-lg'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 relative ${
              billingCycle === 'yearly'
                ? 'bg-white text-gray-900 shadow-lg'
                : 'text-gray-300 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              Yearly
              <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                Save 50%
              </span>
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <p className="text-red-600">{error}</p>
          {hasActiveSubscription && error.includes('active subscription') && (
            <button
              onClick={handleOpenCustomerPortal}
              disabled={portalLoading}
              className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {portalLoading ? 'Opening...' : 'Open Customer Portal to Manage Subscription'}
            </button>
          )}
        </div>
      )}

      {hasActiveSubscription && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <p className="text-blue-800 text-sm">
            <strong>You have an active subscription.</strong> To change your plan, please use the "Manage Subscription" button below or click on any plan to open the customer portal.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {plans.map((plan) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const isPopular = plan.popular || plan.id === 'premium';
            const isFreePlan = plan.id === 'free';

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl transition-all duration-300 ${
                  isCurrentPlan
                    ? 'ring-4 ring-green-500 shadow-2xl scale-105'
                    : isPopular
                    ? 'ring-4 ring-red-500 shadow-2xl scale-105 z-10 border-2 border-red-500'
                    : isFreePlan
                    ? 'shadow-xl hover:shadow-2xl'
                    : 'shadow-lg hover:shadow-xl hover:-translate-y-1'
                } ${isPopular ? 'lg:scale-110' : ''} ${isPopular && !isCurrentPlan ? 'bg-gradient-to-br from-white to-red-50' : ''}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                    <span className="bg-green-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
                      ✓ Current Plan
                    </span>
                  </div>
                )}
                {!isCurrentPlan && isPopular && (
                  <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="relative">
                      {/* Glowing background effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-pink-500 to-red-500 rounded-full blur-lg opacity-60 animate-pulse"></div>
                      
                      {/* Main badge */}
                      <div className="relative bg-gradient-to-r from-red-500 via-pink-500 to-red-500 text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap border-2 border-white/30">
                        {/* Animated star icon */}
                        <svg 
                          className="w-5 h-5 text-yellow-300 animate-spin-slow drop-shadow-lg" 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        
                        {/* Text with gradient effect */}
                        <span className="font-black text-sm tracking-wide drop-shadow-md">
                          MOST POPULAR
                        </span>
                        
                        {/* Sparkle effect */}
                        <div className="absolute -right-1 -top-1 w-2 h-2 bg-yellow-300 rounded-full animate-ping"></div>
                        <div className="absolute -left-1 -bottom-1 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`p-6 sm:p-8 ${isPopular ? 'pt-10' : 'pt-8'}`}>
                  <div className="text-center mb-6">
                    <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                      {plan.displayName}
                    </h3>
                    <div className="mb-4">
                      {isFreePlan ? (
                        <div>
                          <span className="text-5xl sm:text-5xl font-extrabold text-gray-900">Free</span>
                          <p className="text-sm text-gray-500 mt-1">Forever</p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-5xl sm:text-5xl font-extrabold text-gray-900">
                              {formatPrice(getPrice(plan))}
                            </span>
                            <span className="text-xl text-gray-500 font-medium">
                              /{billingCycle === 'yearly' ? 'yr' : 'mo'}
                            </span>
                          </div>
                          {billingCycle === 'yearly' && (
                            <div className="mt-2 text-sm text-green-600 font-semibold">
                              Save {formatPrice(getYearlySavings(plan))}/year
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    {renderFeatureList(plan)}
                  </div>

                  {isFreePlan ? (
                    <button
                      onClick={() => {
                        if (!user) {
                          // Navigate to auth page if not logged in
                          window.location.href = '/auth';
                        } else if (!isCurrentPlan) {
                          // If logged in but not on free plan, they can switch (no checkout needed for free)
                          // This would typically update their plan in the backend
                          setError('Please contact support to switch to the free plan, or cancel your current subscription first.');
                        }
                      }}
                      disabled={isCurrentPlan}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-200 ${
                        isCurrentPlan
                          ? 'bg-green-500 text-white cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      }`}
                    >
                      {isCurrentPlan ? 'Current Plan ✓' : user ? 'Switch to Free' : 'Get Started Free'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (isCurrentPlan) {
                          return; // Do nothing if already on this plan
                        }
                        // Always go to Stripe checkout for paid plans
                        // Stripe will handle existing subscriptions appropriately
                        handleSubscribe(plan.id);
                      }}
                      disabled={(loading === plan.id || portalLoading) || isCurrentPlan}
                      className={`w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-200 ${
                        isCurrentPlan
                          ? 'bg-green-500 text-white cursor-not-allowed'
                          : isPopular
                          ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                          : 'bg-gray-900 hover:bg-gray-800 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      } ${(loading === plan.id || portalLoading) || isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isCurrentPlan
                        ? 'Current Plan ✓'
                        : loading === plan.id
                        ? 'Processing...'
                        : 'Get Started'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <div className={`${isModal ? 'mt-8' : 'mt-16'} text-center`}>
        <div className="inline-flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400 mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>No hidden fees</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>14-day money-back guarantee</span>
          </div>
        </div>
        <p className="text-gray-500 text-sm">
          All plans include full access to our AI photo generation platform
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPlans;

