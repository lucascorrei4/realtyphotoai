import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import supabase from '../config/supabase';
import {
  User,
  Mail,
  Phone,
  Crown,
  BarChart3,
  Image,
  Settings as SettingsIcon,
  LogOut,
  Edit3,
  Save,
  X,
  CheckCircle,
  CreditCard,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getBackendUrl } from '../config/environment';
import { SUBSCRIPTION_PLANS, getCreditUsageSummary, getImageCredits, getVideoCredits } from '../config/subscriptionPlans';
import { getUserPlanFromDatabase, PLAN_DISPLAY_NAMES } from '../utils/planUtils';
import StripeCheckout from '../components/StripeCheckout';
import OffersSection from '../components/OffersSection';
import { getAuthHeaders } from '../utils/apiUtils';

interface UserStats {
  total_generations: number;
  successful_generations: number;
  failed_generations: number;
  success_rate: number;
  monthly_usage: number;
  monthly_limit: number;
  display_usage: number;
  display_limit: number;
  actual_usage: number;
  actual_limit: number;
  model_breakdown: {
    [key: string]: number;
  };
}

interface SubscriptionInfo {
  plan_name: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

const SYNC_STORAGE_KEY = 'subscription-last-sync';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const Settings: React.FC = () => {
  const { user, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const hasInitialSynced = useRef(false);

  const fetchUserStats = useCallback(async () => {
    if (!user?.id) {
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      const { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching generations for settings stats:', error);
      }

      const userGenerations = generations || [];
      const totalGenerations = userGenerations.length;
      const successfulGenerations = userGenerations.filter(g => g.status === 'completed').length;
      const failedGenerations = userGenerations.filter(g => g.status === 'failed').length;
      const successRate = totalGenerations > 0 ? Math.round((successfulGenerations / totalGenerations) * 100) : 0;

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyCompletedGenerations = userGenerations.filter(g =>
        g.status === 'completed' && new Date(g.created_at) >= currentMonth
      );

      // Calculate credits used in DISPLAY credits (since CREDIT_COSTS represents display credits)
      let displayCreditsUsed = 0;
      monthlyCompletedGenerations.forEach(g => {
        if (g.generation_type === 'video' && g.duration_seconds) {
          displayCreditsUsed += getVideoCredits(g.duration_seconds);
        } else {
          displayCreditsUsed += getImageCredits(1);
        }
      });

      const planName = user.subscription_plan || 'free';
      let userPlan = SUBSCRIPTION_PLANS.starter;
      if (planName) {
        const dbPlan = await getUserPlanFromDatabase(planName);
        if (dbPlan) {
          userPlan = dbPlan;
        } else if (SUBSCRIPTION_PLANS[planName as keyof typeof SUBSCRIPTION_PLANS]) {
          userPlan = SUBSCRIPTION_PLANS[planName as keyof typeof SUBSCRIPTION_PLANS];
        }
      }

      // Get prepaid credits from credit_transactions table (one-time purchases)
      let prepaidCredits = 0;
      try {
        // Try using RPC function first
        const { data: prepaidBalance, error: prepaidError } = await supabase.rpc('get_user_prepaid_credit_balance', {
          p_user_id: user.id
        });

        if (!prepaidError && prepaidBalance !== null && prepaidBalance !== undefined) {
          prepaidCredits = prepaidBalance;
        } else if (prepaidError) {
          // Fallback: calculate manually if RPC function fails
          console.warn('RPC function failed, calculating prepaid credits manually:', prepaidError);
          const now = new Date().toISOString();
          const { data: transactions } = await supabase
            .from('credit_transactions')
            .select('credits, expires_at')
            .eq('user_id', user.id)
            .or(`expires_at.is.null,expires_at.gt.${now}`);
          
          if (transactions) {
            prepaidCredits = transactions.reduce((sum, t) => {
              // Only count non-expired credits
              if (!t.expires_at || new Date(t.expires_at) > new Date()) {
                return sum + (t.credits || 0);
              }
              return sum;
            }, 0);
          }
        }
      } catch (prepaidErr) {
        console.error('Error fetching prepaid credits:', prepaidErr);
        // Continue with 0 prepaid credits
      }

      // Calculate credit summary using display credits directly
      // For one-time purchase plans (explorer, a_la_carte), only use prepaid credits, ignore plan credits
      const isOneTimePlan = planName === 'explorer' || planName === 'a_la_carte';
      const planDisplayCreditsTotal = isOneTimePlan ? 0 : (userPlan.features.displayCredits || userPlan.features.monthlyCredits);
      const displayCreditsTotal = planDisplayCreditsTotal + prepaidCredits; // Include prepaid credits
      const displayCreditsRemaining = Math.max(0, displayCreditsTotal - displayCreditsUsed);
      const actualCreditsTotal = userPlan.features.monthlyCredits;
      const actualCreditsUsed = actualCreditsTotal > 0 && planDisplayCreditsTotal > 0 
        ? Math.floor(displayCreditsUsed * (actualCreditsTotal / planDisplayCreditsTotal))
        : displayCreditsUsed;

      const creditSummary = {
        displayCreditsTotal,
        displayCreditsUsed,
        displayCreditsRemaining,
        actualCreditsTotal,
        actualCreditsUsed,
        actualCreditsRemaining: Math.max(0, actualCreditsTotal - actualCreditsUsed),
        prepaidCredits // Include for debugging
      };

      setStats({
        total_generations: totalGenerations,
        successful_generations: successfulGenerations,
        failed_generations: failedGenerations,
        success_rate: successRate,
        monthly_usage: actualCreditsUsed,
        monthly_limit: creditSummary.actualCreditsTotal,
        display_usage: creditSummary.displayCreditsUsed,
        display_limit: creditSummary.displayCreditsTotal,
        actual_usage: creditSummary.actualCreditsUsed,
        actual_limit: creditSummary.actualCreditsTotal,
        model_breakdown: {
          image_enhancement: userGenerations.filter(g => g.model_type === 'image_enhancement').length,
          interior_design: userGenerations.filter(g => g.model_type === 'interior_design').length,
          element_replacement: userGenerations.filter(g => g.model_type === 'element_replacement').length,
          add_furnitures: userGenerations.filter(g => g.model_type === 'add_furnitures').length,
        },
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSubscription = useCallback(async () => {
    if (!user) return;

    try {
      setSubscriptionLoading(true);
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) {
        setSubscriptionLoading(false);
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/subscription`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          setSubscription(data.subscription);
        } else {
          setSubscription(null);
        }
      } else {
        console.error('Failed to fetch subscription:', response.status, response.statusText);
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchUserStats();
    fetchSubscription();
  }, [user, navigate, fetchUserStats, fetchSubscription]);

  // Update edit form when user data changes
  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    setSaveError(null);

    try {
      // Get authentication headers (supports both Supabase and JWT tokens)
      const headers = await getAuthHeaders();
      
      if (!headers['Authorization']) {
        throw new Error('No authentication token found. Please sign in again.');
      }

      const apiUrl = `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'}/api/v1/auth/profile`;

      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone
        })
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('API Error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update profile`);
      }

      const updatedProfile = await response.json();

      // Update the user context with the new profile data
      // Refresh the user data in AuthContext to reflect the changes
      try {
        await refreshUser();
      } catch (error) {
        console.warn('Failed to refresh user context:', error);
        // Don't fail the save operation if context refresh fails
      }

      setEditing(false);
      setSaveSuccess(true);

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleOpenCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/portal`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to open customer portal');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to open customer portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSyncSubscription = useCallback(async ({ showFeedback = true }: { showFeedback?: boolean } = {}) => {
    if (showFeedback) {
      setSyncLoading(true);
      setSaveError(null);
    }

    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/sync-subscription`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Don't throw error for NO_CUSTOMER_ID - this is expected for users without subscriptions
        if (errorData?.error === 'NO_CUSTOMER_ID') {
          // Silently handle - user just needs to subscribe first
          return;
        }
        throw new Error(errorData.message || 'Failed to sync subscription');
      }

      const data = await response.json();

      await fetchSubscription();
      await refreshUser();

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());
      }

      if (showFeedback) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 5000);
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
      if (showFeedback) {
        setSaveError(error instanceof Error ? error.message : 'Failed to sync subscription');
      }
    } finally {
      if (showFeedback) {
        setSyncLoading(false);
      }
    }
  }, [fetchSubscription, refreshUser]);

  const handlePlanChangeSuccess = useCallback(async () => {
    setShowPlanModal(false);
    // For subscriptions, sync from Stripe
    if (subscription) {
      await handleSyncSubscription();
    }
    // Refresh user data to update subscription_plan (for one-time purchases)
    if (refreshUser) {
      await refreshUser();
    }
  }, [handleSyncSubscription, refreshUser, subscription]);

  // Determine if user has a one-time payment plan (explorer/a_la_carte) without a subscription
  const isOneTimePlanUser = user ? (user.subscription_plan === 'explorer' || user.subscription_plan === 'a_la_carte') && !subscription : false;

  // Auto sync once on initial page load to ensure state is fresh
  useEffect(() => {
    if (!user || subscriptionLoading) return;
    if (hasInitialSynced.current) return;
    hasInitialSynced.current = true;
    handleSyncSubscription({ showFeedback: false });
  }, [user, subscriptionLoading, handleSyncSubscription]);

  // Auto sync on page load if last sync is stale
  useEffect(() => {
    if (!user || subscriptionLoading) return;
    if (typeof window === 'undefined') return;

    const lastSync = sessionStorage.getItem(SYNC_STORAGE_KEY);
    if (!lastSync || Date.now() - Number(lastSync) > SYNC_COOLDOWN_MS) {
      handleSyncSubscription({ showFeedback: false });
    }
  }, [user, subscriptionLoading, handleSyncSubscription]);

  // Sync when returning from Stripe customer portal
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    if (params.get('portal') === 'success') {
      handleSyncSubscription({ showFeedback: false });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());
      }
      navigate('/settings', { replace: true });
    }
  }, [location.search, user, handleSyncSubscription, navigate]);

  const handleCancelSubscription = async (immediately: boolean = false) => {
    setCancelLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers['Authorization']) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ immediately }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      // Refresh subscription info and ensure local state is in sync
      await handleSyncSubscription();
      setShowCancelConfirm(false);
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const planColors = {
    free: 'bg-gray-100 text-gray-800 dark:bg-gray-100 dark:text-gray-800',
    basic: 'bg-blue-100 text-blue-800 dark:bg-blue-100 dark:text-blue-800',
    premium: 'bg-purple-100 text-purple-800 dark:bg-purple-100 dark:text-purple-800',
    enterprise: 'bg-green-100 text-green-800 dark:bg-green-100 dark:text-green-800',
    explorer: 'bg-blue-100 text-blue-800 dark:bg-blue-100 dark:text-blue-800',
    a_la_carte: 'bg-purple-100 text-purple-800 dark:bg-purple-100 dark:text-purple-800'
  };

  const modelColors = {
    image_enhancement: '#3B82F6',
    interior_design: '#8B5CF6',
    element_replacement: '#10B981',
    add_furnitures: '#F59E0B'
  };

  const modelBreakdownData = stats?.model_breakdown ?
    Object.entries(stats.model_breakdown).map(([model, count]) => ({
      name: model.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      color: modelColors[model as keyof typeof modelColors] || '#6B7280'
    })) : [];

  const monthlyUsageData = [
    { name: 'Used', value: stats?.display_usage || 0, color: '#3B82F6' },
    { name: 'Remaining', value: Math.max(0, (stats?.display_limit || 0) - (stats?.display_usage || 0)), color: '#E5E7EB' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your account and view usage statistics</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile</h2>
              {!editing ? (
                <button
                  onClick={() => {
                    setEditing(true);
                    setSaveError(null);
                    setSaveSuccess(false);
                  }}
                  className="group relative flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  <Edit3 className="h-4 w-4 relative z-10" />
                  <span className="relative z-10 font-medium">Edit Profile</span>
                </button>
              ) : (
                <div className="flex space-x-3">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className={`group relative flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    {saving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white relative z-10"></div>
                    ) : (
                      <Save className="h-4 w-4 relative z-10" />
                    )}
                    <span className="relative z-10 font-medium">{saving ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setSaveError(null);
                      setSaveSuccess(false);
                      setEditForm({ name: user?.name || '', phone: user?.phone || '' });
                    }}
                    className="group relative flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-600 to-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    <X className="h-4 w-4 relative z-10" />
                    <span className="relative z-10 font-medium">Cancel</span>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                {editing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                    placeholder="Enter your name"
                  />
                ) : (
                  <span className="text-gray-900 dark:text-white">{user.name || 'Not set'}</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{user.email}</span>
              </div>

              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                {editing ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200 shadow-sm hover:shadow-md focus:shadow-lg"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <span className="text-gray-900 dark:text-white">{user.phone || 'Not set'}</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Crown className="h-5 w-5 text-gray-400" />
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${planColors[user.subscription_plan as keyof typeof planColors] || planColors.free}`}>
                  {PLAN_DISPLAY_NAMES[user.subscription_plan] || user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1)} Plan
                </span>
              </div>
            </div>

            {/* Success Message */}
            {saveSuccess && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Profile updated successfully!
                </p>
              </div>
            )}

            {/* Error Message */}
            {saveError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>
              </div>
            )}
          </div>

          {/* Subscription Management Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Subscription</h2>
              <CreditCard className="h-5 w-5 text-gray-400" />
            </div>

            {subscriptionLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : subscription || (user.subscription_plan && user.subscription_plan !== 'free') ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Current Plan</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${planColors[(subscription?.plan_name || user.subscription_plan) as keyof typeof planColors] || planColors.free}`}>
                      {PLAN_DISPLAY_NAMES[subscription?.plan_name || user.subscription_plan || 'free'] ||
                        (subscription?.plan_name || user.subscription_plan || 'Free').charAt(0).toUpperCase() + (subscription?.plan_name || user.subscription_plan || 'Free').slice(1)}
                    </span>
                  </div>

                  {subscription && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${subscription.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                          {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                        </span>
                      </div>

                      {subscription.current_period_end && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Renews On</span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {new Date(subscription.current_period_end).toLocaleDateString()}
                          </span>
                        </div>
                      )}

                      {subscription.cancel_at_period_end && (
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Your subscription will cancel at the end of the billing period.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  {/* Sync button for users who paid but subscription not recognized */}
                  <button
                    onClick={() => {
                      setShowPlanModal(true);
                      setSaveError(null);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <Crown className="h-4 w-4" />
                    <span className="font-medium">
                      {isOneTimePlanUser ? 'Add More Credits' : 'Change Plan'}
                    </span>
                  </button>

                  {/* Only show "Manage Subscription" for users with subscriptions, not one-time plans */}
                  {subscription && (
                    <button
                      onClick={handleOpenCustomerPortal}
                      disabled={portalLoading}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {portalLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      ) : (
                        <>
                          <ExternalLink className="h-4 w-4" />
                          <span className="font-medium">Manage Subscription</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Show cancel button if user has active subscription (not for one-time plans) */}
                  {subscription?.status === 'active' && (
                    <button
                      onClick={() => {
                        setShowCancelConfirm(true);
                        setSaveError(null);
                      }}
                      disabled={cancelLoading}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <X className="h-4 w-4" />
                      <span className="font-medium">
                        {subscription?.cancel_at_period_end
                          ? 'Subscription Cancelling'
                          : 'Cancel Subscription'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    You don't have an active subscription. Subscribe to unlock more features and credits.
                  </p>
                  <button
                    onClick={() => {
                      setShowPlanModal(true);
                      setSaveError(null);
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <Crown className="h-4 w-4" />
                    <span className="font-medium">View Plans</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Section */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Usage Statistics</h2>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Generations</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-white">{stats.total_generations}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">Success Rate</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-white">{stats.success_rate}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Image className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Display Credits Used</p>
                        <p className="text-2xl font-bold text-purple-900 dark:text-white">
                          {stats.display_usage?.toLocaleString() || '0'}
                          <span className="text-base text-purple-500 dark:text-purple-300"> / {stats.display_limit?.toLocaleString() || '0'}</span>
                        </p>
                        <p className="text-xs text-purple-500 dark:text-purple-300">Marketing credits shown in your dashboard</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <SettingsIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      <div>
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Display Credits Remaining</p>
                        <p className="text-2xl font-bold text-orange-900 dark:text-white">
                          {Math.max(0, (stats.display_limit || 0) - (stats.display_usage || 0)).toLocaleString()}
                        </p>
                        <p className="text-xs text-orange-500 dark:text-orange-300">Actual usage resets every billing cycle</p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Monthly Usage Chart */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Display Credits Usage</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={monthlyUsageData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {monthlyUsageData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center space-x-4 mt-2">
                      {monthlyUsageData.map((entry, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Model Breakdown Chart */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Model Usage</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={modelBreakdownData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p>No statistics available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plan Selection Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowPlanModal(false);
          }
        }}>
          <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl ${isOneTimePlanUser ? 'max-w-6xl' : 'max-w-4xl'} w-full max-h-[90vh] overflow-y-auto`}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isOneTimePlanUser ? 'Add Credits And Go' : 'Manage Subscription'}
              </h2>
              <button
                onClick={() => {
                  setShowPlanModal(false);
                  setSaveError(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className={isOneTimePlanUser ? 'p-0' : 'p-6'}>
              {isOneTimePlanUser ? (
                <OffersSection
                  embedded={true}
                  title="Add Credits And Go"
                  subtitle="Choose a one-time payment option to add credits to your account"
                />
              ) : (
                <StripeCheckout
                  onClose={() => {
                    setShowPlanModal(false);
                    setSaveError(null);
                  }}
                  onSuccess={handlePlanChangeSuccess}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Cancel Subscription</h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to cancel your subscription? Your subscription will remain active until{' '}
                {subscription?.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : 'the end of your billing period'
                }, and you'll continue to have access to all features until then.
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={() => handleCancelSubscription(false)}
                  disabled={cancelLoading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelLoading ? 'Canceling...' : 'Cancel at Period End'}
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelLoading}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Keep Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
