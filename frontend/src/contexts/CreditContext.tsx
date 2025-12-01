import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { supabase } from '../config/supabase';
import {
  SUBSCRIPTION_PLANS,
  getCreditUsageSummary,
  getImageCredits,
  getVideoCredits
} from '../config/subscriptionPlans';
import { useAuth } from './AuthContext';
import { getUserPlanFromDatabase } from '../utils/planUtils';

export interface CreditBalance {
  displayCreditsRemaining: number;
  displayCreditsTotal: number;
  displayCreditsUsed: number;
}

interface CreditContextValue {
  creditBalance: CreditBalance | null;
  creditsLoading: boolean;
  refreshCredits: () => Promise<void>;
}

const CreditContext = createContext<CreditContextValue | undefined>(undefined);

export const CreditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const fetchCreditBalance = useCallback(async () => {
    if (!user?.id) {
      setCreditBalance(null);
      setCreditsLoading(false);
      return;
    }

    setCreditsLoading(true);
    try {
      let userPlan = SUBSCRIPTION_PLANS.starter;

      if (user.subscription_plan) {
        const dbPlan = await getUserPlanFromDatabase(user.subscription_plan);
        if (dbPlan) {
          userPlan = dbPlan;
          console.log(`[CreditContext] ✅ Loaded plan: ${dbPlan.displayName} (${dbPlan.features.displayCredits} display credits)`);
        } else {
          console.warn(`[CreditContext] ⚠️ Plan not found in database for: ${user.subscription_plan}, using starter fallback`);
        }
      }
      
      // Ensure we never use free plan as fallback for paid users
      if (user.subscription_plan && user.subscription_plan !== 'free' && userPlan.id === 'free') {
        console.warn('[CreditContext] ⚠️ Fallback to free plan detected for paid user, using starter instead');
        userPlan = SUBSCRIPTION_PLANS.starter;
      }

      const now = new Date();
      // Get first day of current month at 00:00:00 UTC
      const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      // Query generations table from database as source of truth
      // Select only necessary fields for credit calculation
      // Note: duration_seconds and generation_type columns don't exist in schema
      // Using model_type to determine video vs image, and metadata for video duration
      // Filter by current month only (between first day of month and first day of next month)
      const { data: generations, error } = await supabase
        .from('generations')
        .select('id, model_type, status, created_at, is_deleted, metadata')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .eq('is_deleted', false)
        .gte('created_at', currentMonth.toISOString())
        .lt('created_at', nextMonth.toISOString());

      if (error) {
        console.error('Error fetching credit balance from database:', error);
        // Don't return early - use empty array to show 0 credits used
        // This allows the UI to still display the plan's total credits
      }

      // Calculate credits used in DISPLAY credits from database generations
      // This matches the backend calculation logic exactly
      // The credit costs (40 per image, 240 per 6s video) are based on display credits
      let displayCreditsUsed = 0;
      let imageCount = 0;
      let videoCount = 0;
      
      (generations || []).forEach((generation) => {
        // Check if it's a video generation - use model_type (generation_type column doesn't exist)
        const isVideoGeneration = generation.model_type?.startsWith('video_');
        
        if (isVideoGeneration) {
          // Get duration from metadata or default to 6 seconds (standard video length)
          const duration = generation.metadata?.duration || 
                          generation.metadata?.duration_seconds || 
                          6; // Default to 6 seconds for videos
          const videoCredits = getVideoCredits(duration);
          displayCreditsUsed += videoCredits;
          videoCount++;
        } else {
          // All other generations are images
          displayCreditsUsed += getImageCredits(1);
          imageCount++;
        }
      });
      
      // Log detailed breakdown for debugging
      const videoBreakdown = (generations || [])
        .filter(g => g.model_type?.startsWith('video_'))
        .map(g => ({
          id: g.id,
          model_type: g.model_type,
          created_at: g.created_at,
          duration: g.metadata?.duration || g.metadata?.duration_seconds || 6,
          credits: getVideoCredits(g.metadata?.duration || g.metadata?.duration_seconds || 6)
        }));
      
      console.log('[CreditContext] Credit calculation from database:', {
        generationsCount: generations?.length || 0,
        imageCount,
        videoCount,
        displayCreditsUsed,
        currentMonthStart: currentMonth.toISOString(),
        currentMonthEnd: nextMonth.toISOString(),
        videoBreakdown: videoBreakdown.slice(0, 5) // Show first 5 for debugging
      });

      // Get display credits total from plan (which comes from database plan_rules.monthly_generations_limit)
      // Database is the single source of truth for credit limits
      const displayCreditsTotal = userPlan.features.displayCredits || userPlan.features.monthlyCredits;
      const displayCreditsRemaining = Math.max(0, displayCreditsTotal - displayCreditsUsed);
      
      console.log('[CreditContext] Credit balance from database:', {
        displayCreditsTotal,
        displayCreditsUsed,
        displayCreditsRemaining,
        planName: user.subscription_plan,
        planDisplayName: userPlan.displayName
      });

      // Calculate actual credits for comparison (convert back from display)
      const actualCreditsTotal = userPlan.features.monthlyCredits;
      const actualCreditsUsed = actualCreditsTotal > 0 && displayCreditsTotal > 0 
        ? Math.floor(displayCreditsUsed * (actualCreditsTotal / displayCreditsTotal))
        : displayCreditsUsed;

      const summary = {
        displayCreditsTotal,
        displayCreditsUsed,
        displayCreditsRemaining,
        actualCreditsTotal,
        actualCreditsUsed,
        actualCreditsRemaining: Math.max(0, actualCreditsTotal - actualCreditsUsed)
      };

      setCreditBalance({
        displayCreditsRemaining: summary.displayCreditsRemaining,
        displayCreditsTotal: summary.displayCreditsTotal,
        displayCreditsUsed: summary.displayCreditsUsed
      });
    } catch (error) {
      console.error('Error calculating credit balance:', error);
    } finally {
      setCreditsLoading(false);
    }
  }, [user?.id, user?.subscription_plan]);

  const refreshCredits = useCallback(async () => {
    await fetchCreditBalance();
  }, [fetchCreditBalance]);

  useEffect(() => {
    fetchCreditBalance();
  }, [fetchCreditBalance]);
  
  // Refresh credits when subscription plan changes
  useEffect(() => {
    if (user?.subscription_plan) {
      // Small delay to ensure plan data is updated
      const timeoutId = setTimeout(() => {
        fetchCreditBalance();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [user?.subscription_plan, fetchCreditBalance]);

  const value = useMemo(
    () => ({
      creditBalance,
      creditsLoading,
      refreshCredits
    }),
    [creditBalance, creditsLoading, refreshCredits]
  );

  return <CreditContext.Provider value={value}>{children}</CreditContext.Provider>;
};

export const useCredits = () => {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
};


