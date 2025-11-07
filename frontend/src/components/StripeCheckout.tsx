import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SUBSCRIPTION_PLANS, SubscriptionPlan, formatPrice, getFeatureList } from '../config/subscriptionPlans';
import { getUserPlanFromDatabase } from '../utils/planUtils';
import { getBackendUrl } from '../config/environment';

interface StripeCheckoutProps {
  onClose: () => void;
  onSuccess?: (planId: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  // Fetch plans from database and determine current plan
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        // Get all active plans from database
        const planNames = ['free', 'basic', 'premium', 'enterprise', 'ultra'];
        const fetchedPlans: SubscriptionPlan[] = [];
        
        for (const planName of planNames) {
          const dbPlan = await getUserPlanFromDatabase(planName);
          if (dbPlan) {
            fetchedPlans.push(dbPlan);
          } else {
            // Fallback to hardcoded plan if not in database
            const fallbackPlan = SUBSCRIPTION_PLANS[planName];
            if (fallbackPlan) {
              fetchedPlans.push(fallbackPlan);
            }
          }
        }
        
        // Sort plans by price
        fetchedPlans.sort((a, b) => a.price.monthly - b.price.monthly);
        setPlans(fetchedPlans);
        
        // Set current plan
        if (user?.subscription_plan) {
          setCurrentPlanId(user.subscription_plan);
        }
      } catch (err) {
        console.error('Error fetching plans:', err);
        // Fallback to hardcoded plans
        setPlans(Object.values(SUBSCRIPTION_PLANS));
        if (user?.subscription_plan) {
          setCurrentPlanId(user.subscription_plan);
        }
      }
    };

    fetchPlans();
  }, [user]);

  const handleSubscribe = async (planId: string) => {
    // Don't allow subscribing to current plan
    if (planId === currentPlanId) {
      setError('You are already subscribed to this plan');
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      // Get auth token from Supabase session
      const supabase = (await import('../config/supabase')).default;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('Please log in to subscribe');
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          planId,
          billingCycle
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout (with split payments configured in backend)
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(null);
    }
  };

  const getPrice = (plan: SubscriptionPlan) => {
    return billingCycle === 'yearly' ? plan.price.yearly : plan.price.monthly;
  };

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
            <svg className="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-600">{feature}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Billing Toggle */}
          <div className="flex justify-center mb-8">
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
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.filter(p => p.id !== 'free').map((plan) => {
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
                    <span className="text-gray-600">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 font-medium">
                      Save {formatPrice(getYearlySavings(plan))} per year
                    </div>
                  )}
                </div>

                <p className="text-gray-600 text-sm mb-6 text-center">{plan.description}</p>

                {/* Features */}
                <div className="mb-6">
                  {renderFeatureList(plan)}
                </div>

                {/* Subscribe Button */}
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id || isCurrentPlan}
                  className={`w-full py-3 px-4 rounded-md font-medium transition-colors ${
                    isCurrentPlan
                      ? 'bg-green-500 text-white cursor-not-allowed'
                      : isPopular
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  } ${loading === plan.id || isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isCurrentPlan 
                    ? 'Current Plan ✓' 
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

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-500">
            <p>All plans include access to our AI photo generation platform.</p>
            <p>Cancel anytime. No hidden fees.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripeCheckout;
