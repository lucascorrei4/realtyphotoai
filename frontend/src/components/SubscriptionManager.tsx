import React, { useState, useEffect } from 'react';

interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  plan?: {
    id: string;
    name: string;
    features: any;
    limits: any;
  };
}

interface Usage {
  current: number;
  limit: number;
  remaining: number;
  percentage: number;
  periodStart: string;
  periodEnd: string;
  plan: {
    id: string;
    name: string;
    features: any;
  };
}

const SubscriptionManager: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const [subscriptionRes, usageRes] = await Promise.all([
        fetch('/api/v1/stripe/subscription', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch('/api/v1/stripe/usage', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      const subscriptionData = await subscriptionRes.json();
      const usageData = await usageRes.json();

      if (subscriptionData.success) {
        setSubscription(subscriptionData.subscription);
      }

      if (usageData.success) {
        setUsage(usageData.usage);
      }
    } catch (err) {
      setError('Failed to load subscription data');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/stripe/portal', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session');
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    try {
      setCancelling(true);
      const response = await fetch('/api/v1/stripe/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ immediately: false })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Refresh subscription data
      await fetchSubscriptionData();
      alert('Subscription will be cancelled at the end of your billing period.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPeriod = (start: string, end: string) => {
    return `${formatDate(start)} - ${formatDate(end)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchSubscriptionData}
          className="mt-2 text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="text-center p-8">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Subscription</h3>
        <p className="text-gray-600 mb-4">You don't have an active subscription. Subscribe to access premium features.</p>
        <button
          onClick={() => window.location.href = '/pricing'}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium"
        >
          View Plans
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {subscription.plan?.name || subscription.plan_name}
            </h3>
            <p className="text-sm text-gray-600">
              Status: <span className={`font-medium ${
                subscription.status === 'active' ? 'text-green-600' : 'text-yellow-600'
              }`}>
                {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
              </span>
            </p>
          </div>
          {subscription.cancel_at_period_end && (
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
              Cancelling
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-600">Current Period</p>
            <p className="font-medium text-gray-900">
              {formatPeriod(subscription.current_period_start, subscription.current_period_end)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Next Billing Date</p>
            <p className="font-medium text-gray-900">
              {formatDate(subscription.current_period_end)}
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleManageSubscription}
            disabled={loading}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Manage Subscription'}
          </button>
          {subscription.status === 'active' && !subscription.cancel_at_period_end && (
            <button
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          )}
        </div>
      </div>

      {/* Usage Statistics */}
      {usage && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage This Month</h3>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Generations Used</span>
              <span className="font-medium text-gray-900">
                {usage.current.toLocaleString()} / {usage.limit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  usage.percentage > 90 ? 'bg-red-500' :
                  usage.percentage > 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(usage.percentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {usage.remaining.toLocaleString()} generations remaining
            </p>
          </div>

          <div className="text-sm text-gray-600">
            <p>Billing period: {formatPeriod(usage.periodStart, usage.periodEnd)}</p>
          </div>
        </div>
      )}

      {/* Plan Features */}
      {subscription.plan?.features && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Plan Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Monthly Generations</p>
              <p className="font-medium text-gray-900">
                {subscription.plan.limits?.monthlyGenerations?.toLocaleString() || 'Unlimited'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Parallel Processing</p>
              <p className="font-medium text-gray-900">
                Up to {subscription.plan.limits?.concurrentGenerations || 1} at once
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Commercial Use</p>
              <p className="font-medium text-gray-900">
                {subscription.plan.features?.commercialUse ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Priority Processing</p>
              <p className="font-medium text-gray-900">
                {subscription.plan.features?.priorityProcessing ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
