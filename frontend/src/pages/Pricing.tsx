import React, { useState } from 'react';
import { SUBSCRIPTION_PLANS, SubscriptionPlan, BILLING_CYCLES, formatPrice, getFeatureList } from '../config/subscriptionPlans';

const Pricing: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);

  const plans = Object.values(SUBSCRIPTION_PLANS);

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);

    try {
      const response = await fetch('/api/v1/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
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

  const getMonthlyEquivalent = (plan: SubscriptionPlan) => {
    if (billingCycle === 'yearly') {
      return Math.round(plan.price.yearly / 12);
    }
    return plan.price.monthly;
  };

  const renderFeatureList = (plan: SubscriptionPlan) => {
    const features = getFeatureList(plan);
    
    return (
      <ul className="space-y-3 text-sm">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <svg className="w-4 h-4 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-600">{feature}</span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get started with basic AI photos, create your first model, and begin your AI photography journey. 
            Upgrade anytime to unlock more features and higher quality generations.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-12">
          <div className="bg-white rounded-lg p-1 flex shadow-sm border border-gray-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-3 rounded-md font-medium transition-colors relative ${
                billingCycle === 'monthly'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-3 rounded-md font-medium transition-colors relative ${
                billingCycle === 'yearly'
                  ? 'bg-red-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="flex items-center">
                Yearly: get 6+ months free
                <span className="ml-2 text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">🔥</span>
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white border-2 rounded-xl p-8 transition-all hover:shadow-lg ${
                plan.popular
                  ? 'border-red-500 shadow-lg scale-105'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                    Most popular
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{plan.displayName}</h3>
                <div className="mb-3">
                  <span className="text-5xl font-bold text-gray-900">
                    ${getPrice(plan)}
                  </span>
                  <span className="text-gray-600 ml-2">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {billingCycle === 'yearly' && (
                  <div className="text-sm text-green-600 font-medium mb-2">
                    Save ${getYearlySavings(plan)} per year
                  </div>
                )}
                <div className="text-sm text-gray-500">
                  ${getMonthlyEquivalent(plan)}/month {billingCycle === 'yearly' && 'billed yearly'}
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-600 text-center mb-8 leading-relaxed">
                {plan.description}
              </p>

              {/* Core Features */}
              <div className="mb-8">
                <div className="space-y-3 text-sm mb-6">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900">
                      {plan.features.displayCredits.toLocaleString()} Credits per month
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900">
                      ~{plan.features.monthlyCredits.toLocaleString()} images OR ~{Math.floor(plan.features.monthlyCredits / 15).toLocaleString()} videos (16s) OR mix
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-900">
                      Flux™ photorealistic model
                    </span>
                  </div>
                </div>

                {/* Additional Features */}
                <div className="border-t border-gray-100 pt-6">
                  {renderFeatureList(plan)}
                </div>
              </div>

              {/* Subscribe Button */}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loading === plan.id}
                className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors ${
                  plan.popular
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                } ${loading === plan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading === plan.id ? 'Processing...' : 'Subscribe →'}
              </button>

              {/* Billing Info */}
              {billingCycle === 'yearly' && (
                <div className="mt-4 text-center">
                  <button className="text-sm text-gray-500 hover:text-gray-700 underline">
                    View monthly billing ⌄
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What's included in each plan?
              </h3>
              <p className="text-gray-600">
                Each plan includes AI photo generation credits, model creation limits, and access to our Flux™ 
                photorealistic model. Higher tiers offer more credits, better quality, parallel processing, 
                and advanced features like video generation and LoRA support.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I change my plan anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                and we'll prorate any billing differences.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What happens if I exceed my monthly limit?
              </h3>
              <p className="text-gray-600">
                You can purchase additional credits or upgrade your plan. We'll notify you when you're 
                approaching your limit so you can plan accordingly.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600">
                We offer a 30-day money-back guarantee for all new subscriptions. Contact our support 
                team if you're not satisfied with your purchase.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-gray-500">
          <p>All plans include access to our AI photo generation platform.</p>
          <p>Cancel anytime. No hidden fees. Secure payment processing by Stripe.</p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
