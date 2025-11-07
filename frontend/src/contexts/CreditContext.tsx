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
        }
      }

      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('created_at', currentMonth.toISOString());

      if (error) {
        console.error('Error fetching credit balance:', error);
        return;
      }

      let actualCreditsUsed = 0;
      (generations || []).forEach((generation) => {
        if (generation.generation_type === 'video' && generation.duration_seconds) {
          actualCreditsUsed += getVideoCredits(generation.duration_seconds);
        } else {
          actualCreditsUsed += getImageCredits(1);
        }
      });

      const summary = getCreditUsageSummary(actualCreditsUsed, userPlan);

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


