import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Image,
  Clock,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Target,
  Crown,
  ExternalLink,
  Video as VideoIcon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { RecentGenerationsWidget, QuickActions } from '../components';
import OffersSection from '../components/OffersSection';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { SUBSCRIPTION_PLANS, getCreditUsageSummary, getImageCredits, getVideoCredits, SubscriptionPlan } from '../config/subscriptionPlans';
import { getUserPlanFromDatabase, PLAN_DISPLAY_NAMES } from '../utils/planUtils';
import { getBackendUrl } from '../config/environment';
import { useToast } from '../hooks/useToast';
import { useCredits } from '../contexts/CreditContext';


interface UserStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  successRate: number;
  monthlyUsage: number;
  monthlyLimit: number;
  actualCreditsUsed: number;
  creditUsageSummary: {
    displayCreditsTotal: number;
    displayCreditsUsed: number;
    displayCreditsRemaining: number;
    actualCreditsTotal: number;
    actualCreditsUsed: number;
    actualCreditsRemaining: number;
  };
  generationsByType: {
    interiorDesign: number;
    imageEnhancement: number;
    replaceElements: number;
    addFurnitures: number;
    exteriorDesign: number;
    generalFurniture: number;
  };
  monthlyData: Array<{
    month: string;
    generations: number;
    success: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    status: string;
    timestamp: string;
    model: string;
    output_url?: string;
    processing_time_ms?: number;
  }>;
}

const SYNC_STORAGE_KEY = 'subscription-last-sync';
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const Dashboard: React.FC = () => {
  const { user, loading, refreshUser } = useAuth();
  const { showLoading, showSuccess, showError, updateToast, dismiss } = useToast();
  const { creditBalance, refreshCredits } = useCredits();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showPricing, setShowPricing] = useState(false);
  const syncInFlightRef = useRef(false);
  const lastValidPlanRef = useRef<SubscriptionPlan | null>(null);

  const fetchUserStats = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setStatsLoading(true);
    try {
    
    // Check if we're using super admin bypass (JWT token in localStorage)
    // If so, use backend API directly instead of Supabase (which may be blocked by RLS)
    const isSuperAdminBypass = !!localStorage.getItem('auth_token');
    
    let generations: any[] | null = null;
    let error: any = null;
    
    if (isSuperAdminBypass) {
      try {
        const backendUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
        const { getAuthHeaders } = await import('../utils/apiUtils');
        const headers = await getAuthHeaders();
        
        const backendResponse = await fetch(`${backendUrl}/api/v1/user/generations?userId=${encodeURIComponent(user.id)}&limit=1000`, {
          method: 'GET',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
        });
        
        if (backendResponse.ok) {
          const backendData = await backendResponse.json();
          
          if (backendData.success && backendData.data?.generations) {
            generations = backendData.data.generations;
          } else if (backendData.success && Array.isArray(backendData.data)) {
            // Handle case where API returns array directly
            generations = backendData.data;
          } else {
            generations = [];
          }
        } else {
          const errorText = await backendResponse.text();
          error = { message: `Backend API error: ${backendResponse.status}` };
          generations = [];
        }
      } catch (backendError) {
        console.error('[Dashboard] ❌ Backend API error:', backendError);
        error = backendError;
        generations = [];
      }
    } else {
      // Normal flow: use Supabase
      try {
        // First try to fetch by user ID
        let { data: supabaseGenerations, error: supabaseError } = await supabase
          .from('generations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        

        generations = supabaseGenerations;
        error = supabaseError;

        // If no generations found by ID, try by email as fallback
        // Note: user_email column may not exist in all database schemas
        if (!generations || generations.length === 0) {
          try {
            const { data: generationsByEmail, error: emailError } = await supabase
              .from('generations')
              .select('*')
              .eq('user_email', user.email)
              .order('created_at', { ascending: false });

            if (generationsByEmail && !emailError) {
              generations = generationsByEmail;
            }
          } catch (emailQueryError: any) {
            // Silently ignore if user_email column doesn't exist (400 error)
            // or if RLS blocks the query - this is expected for some database schemas
            if (emailQueryError?.code !== 'PGRST116' && !emailQueryError?.message?.includes('column') && !emailQueryError?.message?.includes('user_email')) {
              console.warn('[Dashboard] ⚠️ Fallback email query failed:', emailQueryError);
            }
          }
        }
      } catch (supabaseError) {
        console.error('[Dashboard] ❌ Supabase error:', supabaseError);
        error = supabaseError;
        generations = [];
      }
    }

      const userGenerations = generations || [];
      // Calculate statistics
      const totalGenerations = userGenerations.length;
      const successfulGenerations = userGenerations.filter(g => g.status === 'completed').length;
      const failedGenerations = userGenerations.filter(g => g.status === 'failed').length;
      const successRate = totalGenerations > 0 ? Math.round((successfulGenerations / totalGenerations) * 100) : 0;

      // Monthly usage (current month) - use UTC to match database timestamps
      const now = new Date();
      const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      
      const monthlyGenerations = userGenerations.filter(g => {
        const createdDate = new Date(g.created_at);
        return createdDate >= currentMonth && createdDate < nextMonth && g.status === 'completed';
      });
      const monthlyUsage = monthlyGenerations.length;

      // Calculate credits used in DISPLAY credits (since CREDIT_COSTS represents display credits)
      // Monthly credits reset each billing cycle - filter by current month only
      const monthlyCompletedGenerations = userGenerations.filter(g => {
        const createdDate = new Date(g.created_at);
        return g.status === 'completed' && createdDate >= currentMonth && createdDate < nextMonth;
      });

      // Calculate directly in display credits (CREDIT_COSTS are display credits, not actual)
      // Note: generation_type and duration_seconds columns don't exist in schema
      // Using model_type to determine video vs image, and metadata for video duration
      let displayCreditsUsed = 0;
      monthlyCompletedGenerations.forEach(g => {
        // Check if it's a video generation - use model_type (generation_type column doesn't exist)
        const isVideoGeneration = g.model_type?.startsWith('video_');
        
        if (isVideoGeneration) {
          // Get duration from metadata or default to 6 seconds (standard video length)
          const duration = g.metadata?.duration || 
                          g.metadata?.duration_seconds || 
                          6; // Default to 6 seconds for videos
          displayCreditsUsed += getVideoCredits(duration);
        } else {
          // All other generations are images (40 display credits per image)
          displayCreditsUsed += getImageCredits(1);
        }
      });

      // Get user's plan from database and calculate credit usage summary
      // Use last valid plan as fallback to prevent resetting to default when database lookup fails
      // IMPORTANT: Don't fallback to free plan (300 credits) - use starter (800 credits) or last valid plan
      let userPlan: SubscriptionPlan = lastValidPlanRef.current || SUBSCRIPTION_PLANS.starter;
      
      // Ensure we never use free plan as fallback for paid users
      if (user.subscription_plan && user.subscription_plan !== 'free' && userPlan.id === 'free') {
        console.warn('[Dashboard] ⚠️ Fallback to free plan detected for paid user, using starter instead');
        userPlan = SUBSCRIPTION_PLANS.starter;
      }
      let planLoadError = null;

      if (user.subscription_plan) {
        try {
          const dbPlan = await getUserPlanFromDatabase(user.subscription_plan);
          if (dbPlan) {
            userPlan = dbPlan;
            lastValidPlanRef.current = dbPlan; // Store successful plan load
          } else {
            planLoadError = `Plan rule not found in database for: ${user.subscription_plan}`;
            console.warn(`[Dashboard] ⚠️ ${planLoadError}. Using last valid plan or default.`);
            // If we have a last valid plan and it matches the user's subscription_plan, keep using it
            if (lastValidPlanRef.current && lastValidPlanRef.current.id === user.subscription_plan) {
              userPlan = lastValidPlanRef.current;
            } else {
              // Silently refresh user data in case subscription_plan is stale
              // Don't await - let it refresh in background
              if (refreshUser) {
                refreshUser().catch(err => {
                  console.warn('[Dashboard] Background user refresh failed:', err);
                });
              }
            }
          }
        } catch (error) {
          planLoadError = `Error loading plan: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(`[Dashboard] ❌ ${planLoadError}`);
          // Use last valid plan if available
          if (lastValidPlanRef.current && lastValidPlanRef.current.id === user.subscription_plan) {
            userPlan = lastValidPlanRef.current;
          }
        }
      } else {
        console.warn('[Dashboard] ⚠️ User has no subscription_plan set');
      }

      // Calculate credit summary using display credits directly (CREDIT_COSTS are display credits)
      const displayCreditsTotal = userPlan.features.displayCredits || userPlan.features.monthlyCredits;
      const displayCreditsRemaining = Math.max(0, displayCreditsTotal - displayCreditsUsed);
      const actualCreditsTotal = userPlan.features.monthlyCredits;
      const actualCreditsUsed = actualCreditsTotal > 0 && displayCreditsTotal > 0 
        ? Math.floor(displayCreditsUsed * (actualCreditsTotal / displayCreditsTotal))
        : displayCreditsUsed;

      const creditUsageSummary = {
        displayCreditsTotal,
        displayCreditsUsed,
        displayCreditsRemaining,
        actualCreditsTotal,
        actualCreditsUsed,
        actualCreditsRemaining: Math.max(0, actualCreditsTotal - actualCreditsUsed)
      };

      // Count by model type
      const generationsByType = {
        interiorDesign: userGenerations.filter(g => g.model_type === 'interior_design').length,
        imageEnhancement: userGenerations.filter(g => g.model_type === 'image_enhancement').length,
        replaceElements: userGenerations.filter(g => g.model_type === 'element_replacement').length,
        addFurnitures: userGenerations.filter(g => g.model_type === 'add_furnitures').length,
        exteriorDesign: userGenerations.filter(g => g.model_type === 'exterior_design').length,
        generalFurniture: userGenerations.filter(g => g.model_type === 'general_furniture').length,
      };

      // Calculate monthly data for the last 6 months
      const monthlyData = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const monthGenerations = userGenerations.filter(g => {
          const generationDate = new Date(g.created_at);
          return generationDate >= monthStart && generationDate <= monthEnd;
        });

        const monthSuccess = monthGenerations.filter(g => g.status === 'completed').length;

        monthlyData.push({
          month: monthNames[date.getMonth()],
          generations: monthGenerations.length,
          success: monthSuccess
        });
      }

      // Helper function to convert model type to user-friendly label
      const getActivityTypeLabel = (modelType: string): string => {
        // Convert to user-friendly labels (hide technical model names like veo3_fast)
        const labels: Record<string, string> = {
          'interior_design': 'Interior Design',
          'exterior_design': 'Exterior Design',
          'image_enhancement': 'Image Enhancement',
          'element_replacement': 'Replace Elements',
          'add_furnitures': 'Add Furniture',
          'general_furniture': 'Add Furniture',
          'video_veo3_fast': 'Video',
          'video_minimax_director': 'Video',
          'video': 'Video',
          'smart_effects': 'Smart Effects'
        };
        
        // Check if exact match exists first
        if (labels[modelType]) {
          return labels[modelType];
        }
        
        // If it's a video type, normalize to just 'Video'
        if (modelType.startsWith('video_')) {
          return 'Video';
        }
        
        // Otherwise, format the model type nicely
        return modelType.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      };

      // Recent activity (last 10 generations)
      const recentActivity = userGenerations.slice(0, 10).map(g => ({
        id: g.id,
        type: getActivityTypeLabel(g.model_type),
        status: g.status,
        timestamp: g.created_at,
        model: g.model_type,
        output_url: g.output_image_url || g.output_video_url,
        processing_time_ms: g.processing_time_ms
      }));

      setUserStats({
        totalGenerations,
        successfulGenerations,
        failedGenerations,
        successRate,
        monthlyUsage,
        monthlyLimit: user.monthly_generations_limit || 0,
        actualCreditsUsed,
        creditUsageSummary,
        generationsByType,
        monthlyData,
        recentActivity
      });
    } catch (error) {
      console.error('Error calculating user stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  // Track previous subscription plan to detect changes
  const prevSubscriptionPlanRef = useRef<string | undefined>(user?.subscription_plan);

  useEffect(() => {
    if (user) {
      // If subscription plan changed, clear cached plan and refresh user data first
      if (prevSubscriptionPlanRef.current !== user.subscription_plan) {
        lastValidPlanRef.current = null; // Clear cached plan when plan changes
        prevSubscriptionPlanRef.current = user.subscription_plan;
        if (refreshUser) {
          refreshUser().then(() => {
            fetchUserStats();
          }).catch(() => {
            // If refresh fails, still fetch stats with current user data
            fetchUserStats();
          });
        } else {
          fetchUserStats();
        }
      } else {
        fetchUserStats();
      }
    } 
  }, [user, fetchUserStats, refreshUser]);

  const syncSubscription = useCallback(async () => {
    if (!user?.id || syncInFlightRef.current) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      syncInFlightRef.current = true;

      const response = await fetch(`${getBackendUrl()}/api/v1/stripe/sync-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(SYNC_STORAGE_KEY, Date.now().toString());
        }
        await fetchUserStats();
      } else {
        const data = await response.json().catch(() => null);
        // Don't show warning for NO_CUSTOMER_ID - this is expected for users without subscriptions
        if (data?.error !== 'NO_CUSTOMER_ID') {
          console.warn('Sync subscription failed:', data || response.statusText);
        }
      }
    } catch (error) {
      console.error('Error syncing subscription from dashboard:', error);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [user, fetchUserStats]);

  useEffect(() => {
    if (!user?.id) return;
    if (typeof window === 'undefined') return;

    const lastSync = sessionStorage.getItem(SYNC_STORAGE_KEY);
    if (!lastSync || Date.now() - Number(lastSync) > SYNC_COOLDOWN_MS) {
      syncSubscription();
    }
  }, [user, syncSubscription]);

  // Auto-refresh user data when subscription_plan might have changed
  useEffect(() => {
    if (!user?.id) return;

    let visibilityTimeout: NodeJS.Timeout | null = null;

    // Refresh user data when component becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear any pending timeout
        if (visibilityTimeout) {
          clearTimeout(visibilityTimeout);
        }
        // Small delay to avoid too frequent refreshes
        visibilityTimeout = setTimeout(() => {
          if (refreshUser) {
            refreshUser().then(() => {
              fetchUserStats();
            }).catch(err => {
              console.warn('[Dashboard] Auto-refresh on visibility change failed:', err);
            });
          }
        }, 1000);
      }
    };

    // Refresh when returning from Stripe portal or checkout
    const urlParams = new URLSearchParams(window.location.search);
    const portalSuccess = urlParams.get('portal') === 'success';
    const subscriptionSuccess = urlParams.get('subscription') === 'success';
    
    if (portalSuccess || subscriptionSuccess) {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      
      // For subscription success, sync subscription first, then refresh
      // For portal success, just refresh (portal changes are handled by webhooks)
      if (subscriptionSuccess) {
        // Show loading toast
        const loadingToastId = showLoading('Processing your subscription... Please wait while we update your account.');
        
        // Sync subscription first to ensure database is updated
        syncSubscription().then(() => {
          // Update toast to show we're waiting for webhook
          updateToast(loadingToastId, 'Syncing subscription data...', 'loading');
          
          // Then refresh user data and stats after a delay to ensure webhook processed
          setTimeout(() => {
            if (refreshUser) {
              refreshUser().then(() => {
                fetchUserStats();
                // Update toast to success
                updateToast(loadingToastId, 'Subscription activated successfully! Your plan has been updated.', 'success');
                // Dismiss after 3 seconds
                setTimeout(() => dismiss(loadingToastId), 3000);
              }).catch(err => {
                console.warn('[Dashboard] Auto-refresh after subscription success failed:', err);
                updateToast(loadingToastId, 'Subscription updated, but there was an error refreshing your data. Please refresh the page.', 'error');
                setTimeout(() => dismiss(loadingToastId), 5000);
              });
            } else {
              fetchUserStats();
              updateToast(loadingToastId, 'Subscription activated successfully!', 'success');
              setTimeout(() => dismiss(loadingToastId), 3000);
            }
          }, 3000); // Longer delay for checkout webhook processing
        }).catch(err => {
          console.warn('[Dashboard] Subscription sync failed, refreshing anyway:', err);
          updateToast(loadingToastId, 'Syncing subscription...', 'loading');
          
          // Even if sync fails, refresh user data
          setTimeout(() => {
            if (refreshUser) {
              refreshUser().then(() => {
                fetchUserStats();
                updateToast(loadingToastId, 'Subscription updated. If you don\'t see changes, please refresh the page.', 'success');
                setTimeout(() => dismiss(loadingToastId), 4000);
              }).catch(() => {
                updateToast(loadingToastId, 'Unable to refresh subscription data. Please refresh the page manually.', 'error');
                setTimeout(() => dismiss(loadingToastId), 5000);
              });
            } else {
              fetchUserStats();
              updateToast(loadingToastId, 'Subscription updated.', 'success');
              setTimeout(() => dismiss(loadingToastId), 3000);
            }
          }, 2000);
        });
      } else if (portalSuccess) {
        // Portal success - just refresh after delay
        setTimeout(() => {
          if (refreshUser) {
            refreshUser().then(() => {
              fetchUserStats();
            }).catch(err => {
              console.warn('[Dashboard] Auto-refresh after portal return failed:', err);
            });
          }
        }, 2000);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also set up periodic refresh every 2 minutes when tab is visible
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && refreshUser) {
        refreshUser().then(() => {
          fetchUserStats();
        }).catch(err => {
          console.warn('[Dashboard] Periodic auto-refresh failed:', err);
        });
      }
    }, 2 * 60 * 1000); // 2 minutes

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
      clearInterval(refreshInterval);
    };
  }, [user, refreshUser, fetchUserStats, syncSubscription]);

  const usageData = [
    { name: 'Interior Design', value: userStats?.generationsByType?.interiorDesign || 0, color: '#8B5CF6' },
    { name: 'Image Enhancement', value: userStats?.generationsByType?.imageEnhancement || 0, color: '#10B981' },
    { name: 'Replace Elements', value: userStats?.generationsByType?.replaceElements || 0, color: '#F59E0B' },
    { name: 'Add Furnitures', value: userStats?.generationsByType?.addFurnitures || 0, color: '#10B981' },
    { name: 'Exterior Design', value: userStats?.generationsByType?.exteriorDesign || 0, color: '#F59E0B' },
    { name: 'General Furniture', value: userStats?.generationsByType?.generalFurniture || 0, color: '#10B981' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name || user?.email?.split('@')[0] || 'User'}! 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Here's what's happening with your RealVisionAI account
        </p>
      </div>

      {/* Subscription Upgrade Prompt */}
      {user?.subscription_plan === 'free' && (
        <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">🚀 Upgrade Your Plan</h2>
              <p className="text-red-100 mb-4">
                Get more generations, faster processing, and access to premium features
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPricing(true)}
                  className="bg-white text-red-600 px-6 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  View Plans
                </button>
              </div>
            </div>
            <Crown className="h-16 w-16 text-red-200" />
          </div>
        </div>
      )}

      {/* Subscription Status for Paid Users */}
      {user?.subscription_plan && user.subscription_plan !== 'free' && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">✨ {PLAN_DISPLAY_NAMES[user.subscription_plan] || user.subscription_plan || 'Premium'} Plan</h2>
              <p className="text-green-100 mb-4">
                You're enjoying premium features with {userStats?.creditUsageSummary?.displayCreditsTotal.toLocaleString() || 'unlimited'} credits per month
              </p>
              <button
                onClick={() => setShowPricing(true)}
                className="bg-white text-green-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Manage Subscription
              </button>
            </div>
            <Crown className="h-16 w-16 text-green-200" />
          </div>
        </div>
      )}

      {/* Credit Usage Progress Bar */}
      {creditBalance && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Credit Balance</h3>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {creditBalance.displayCreditsUsed.toLocaleString()} / {creditBalance.displayCreditsTotal.toLocaleString()} credits
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${(creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) > 0.9
                  ? 'bg-red-500'
                  : (creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) > 0.7
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
              style={{
                width: `${Math.min(100, (creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) * 100)}%`
              }}
            ></div>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Used: {creditBalance.displayCreditsUsed.toLocaleString()} credits</span>
            <span>{Math.min(100, Math.round((creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) * 100))}% used</span>
          </div>
          {(creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) > 0.8 && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-orange-600 dark:text-orange-400">
                ⚠️ You're running low on credits. Consider upgrading for more!
              </p>
              <button
                onClick={() => setShowPricing(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Upgrade Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <QuickActions />

      {/* Legacy Usage Progress Bar (for backward compatibility) */}
      {userStats && !creditBalance && !userStats.creditUsageSummary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Monthly Usage</h3>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {userStats.monthlyUsage} / {userStats.monthlyLimit} generations
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${userStats.monthlyLimit > 0 && (userStats.monthlyUsage / userStats.monthlyLimit) > 0.9
                  ? 'bg-red-500'
                  : userStats.monthlyLimit > 0 && (userStats.monthlyUsage / userStats.monthlyLimit) > 0.7
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
              style={{
                width: `${userStats.monthlyLimit > 0 ? Math.min(100, (userStats.monthlyUsage / userStats.monthlyLimit) * 100) : 0}%`
              }}
            ></div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-500">
              <Image className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Generations
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {userStats?.totalGenerations || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-500">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Successful
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {userStats?.successfulGenerations || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-500">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                This Month
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {userStats?.monthlyUsage || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-500">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Credits Remaining
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {creditBalance?.displayCreditsRemaining.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Generations Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Monthly Generations</h3>
          {statsLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Loading chart data...</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userStats?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="generations"
                    stackId="1"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.6}
                  />
                  <Area
                    type="monotone"
                    dataKey="success"
                    stackId="2"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center space-x-4 mt-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Successful</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Usage by Type Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Usage by Service Type</h3>
          {statsLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Loading usage data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {usageData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(0, Math.min(100, (item.value / Math.max(...usageData.map(u => u.value), 1)) * 100))}%`,
                          backgroundColor: item.color
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">
                      {item.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Your Recent Generations"
        description="Track your latest AI generations and their status"
        showFilters={true}
        maxItems={8}
      />

      {/* Recent Activity */}
      {userStats?.recentActivity && userStats.recentActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Recent Activity
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {userStats.recentActivity.map((activity) => {
                const isVideo = activity.model?.startsWith('video_');
                const outputUrl = activity.output_url;
                const getAbsoluteUrl = (path: string | undefined) => {
                  if (!path || path.trim() === '') return '';
                  if (path.startsWith('http://') || path.startsWith('https://')) {
                    return path;
                  }
                  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
                  return `${getBackendUrl()}/${cleanPath}`;
                };
                const absoluteOutputUrl = outputUrl ? getAbsoluteUrl(outputUrl) : null;

                return (
                  <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className={`p-2 rounded-full flex-shrink-0 ${activity.status === 'completed'
                        ? 'bg-green-100 dark:bg-green-900'
                        : activity.status === 'processing'
                          ? 'bg-yellow-100 dark:bg-yellow-900'
                          : 'bg-red-100 dark:bg-red-900'
                        }`}>
                        {activity.status === 'completed' ? (
                          isVideo ? (
                            <VideoIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )
                        ) : activity.status === 'processing' ? (
                          <PlayCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.type}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}
                          </p>
                          {activity.processing_time_ms && activity.status === 'completed' && (
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              • {(activity.processing_time_ms / 1000).toFixed(1)}s
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {absoluteOutputUrl && activity.status === 'completed' && (
                        <a
                          href={absoluteOutputUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                          onClick={(e) => {
                            if (isVideo) {
                              // For videos, try to open in a way that allows download
                              e.preventDefault();
                              window.open(absoluteOutputUrl, '_blank');
                            }
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {isVideo ? 'View Video' : 'View Output'}
                        </a>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activity.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : activity.status === 'processing'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                        }`}>
                        {activity.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pricing/Offers Modal */}
      {showPricing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowPricing(false)}>
          <div 
            className="bg-transparent rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPricing(false)}
              className="absolute top-6 right-6 text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-gray-300 text-3xl font-bold z-10 bg-white/90 dark:bg-black/50 rounded-full w-10 h-10 flex items-center justify-center transition-colors backdrop-blur-sm shadow-lg"
              aria-label="Close pricing modal"
            >
              ×
            </button>
            <OffersSection
              title="Choose Your Plan"
              subtitle="Pick the option that works best for your needs. All plans include full access to our AI-powered platform."
              className="pt-8"
            />
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
