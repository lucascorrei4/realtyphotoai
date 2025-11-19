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
          // Filter out free plan and sort by price
          const paidPlans = dbPlans
            .filter(plan => plan.id !== 'free')
            .sort((a, b) => a.price.monthly - b.price.monthly);
          
          setPlans(paidPlans);
        } else {
          // Fallback to hardcoded plans if database fetch fails
          console.warn('[SubscriptionPlans] No plans found in database, using hardcoded plans');
          const hardcodedPlans = Object.values(SUBSCRIPTION_PLANS)
            .filter(plan => plan.id !== 'free')
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
          .filter(plan => plan.id !== 'free')
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

    // If user has an active subscription, direct them to customer portal
    if (hasActiveSubscription) {
      setError('You have an active subscription. Please use "Manage Subscription" to change your plan.');
      // Optionally auto-open portal
      // handleOpenCustomerPortal();
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

      if (!token) {
        throw new Error('Please log in to subscribe');
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          billingCycle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      onSuccess?.(planId);
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

    return (
      <ul className="space-y-2 text-sm">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <svg
              className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-gray-600">{feature}</span>
          </li>
        ))}
      </ul>
    );
  };

  const containerClasses = isModal
    ? 'p-6'
    : 'px-6 py-10 sm:px-10 lg:px-16';

  const headerContent = isModal ? (
    <div className="flex justify-between items-center mb-6">
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
    <div className="mb-10 text-center">
      <h1 className="text-4xl font-bold text-gray-100 sm:text-5xl">Choose Your Plan</h1>
      <p className="mt-3 text-lg text-gray-300">
        Access powerful AI photo generation tailored to real estate professionals.
      </p>
    </div>
  );

  return (
    <div className={containerClasses}>
      {headerContent}

      <div className={`flex justify-center ${isModal ? 'mb-8' : 'mb-12'}`}>
        <div className="bg-gray-100 rounded-lg p-1 flex">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-6 py-2 rounded-md font-medium transition-colors ${
              billingCycle === 'monthly'
                ? 'bg-red-500 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-6 py-2 rounded-md font-medium transition-colors relative ${
              billingCycle === 'yearly'
                ? 'bg-red-500 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="flex items-center">
              Yearly: get 6+ months free
              <span className="ml-1 text-xs bg-red-600 text-white px-1 rounded">🔥</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans
          .filter((plan) => plan.id !== 'free')
          .map((plan) => {
            const isCurrentPlan = plan.id === currentPlanId;
            const isPopular = plan.popular || plan.id === 'premium';

            return (
              <div
                key={plan.id}
                className={`relative bg-white border-2 rounded-lg p-6 transition-all ${
                  isCurrentPlan
                    ? 'border-green-500 shadow-lg ring-2 ring-green-200'
                    : isPopular
                    ? 'border-red-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Current Plan
                    </span>
                  </div>
                )}
                {!isCurrentPlan && isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.displayName}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatPrice(getPrice(plan))}
                    </span>
                    <span className="text-gray-600">
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 font-medium">
                      Save {formatPrice(getYearlySavings(plan))} per year
                    </div>
                  )}
                </div>

                <p className="text-gray-600 text-sm mb-6 text-center">{plan.description}</p>

                <div className="mb-6">{renderFeatureList(plan)}</div>

                <button
                  onClick={() => {
                    if (hasActiveSubscription && !isCurrentPlan) {
                      handleOpenCustomerPortal();
                    } else {
                      handleSubscribe(plan.id);
                    }
                  }}
                  disabled={(loading === plan.id || portalLoading) && !isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-green-500 text-white cursor-not-allowed'
                      : hasActiveSubscription
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : isPopular
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  } ${(loading === plan.id || portalLoading) && !isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCurrentPlan
                    ? 'Current Plan ✓'
                    : hasActiveSubscription
                    ? 'Manage Subscription →'
                    : loading === plan.id
                    ? 'Processing...'
                    : 'Subscribe →'}
                </button>

                {billingCycle === 'yearly' && (
                  <div className="mt-3 text-center">
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                      View monthly billing ⌄
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <div className={`${isModal ? 'mt-8' : 'mt-12'} text-center text-sm ${
        isModal ? 'text-gray-500' : 'text-gray-400'
      }`}>
        <p>All plans include access to our AI photo generation platform.</p>
        <p>Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
};

export default SubscriptionPlans;

