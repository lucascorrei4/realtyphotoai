import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SubscriptionPlans from '../components/SubscriptionPlans';
import { checkAuthSession } from '../utils/authHelpers';

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifySession = async () => {
      try {
        const sessionExists = await checkAuthSession();
        setIsAuthenticated(sessionExists);
      } catch (error) {
        console.error('Failed to verify session for pricing page:', error);
        setIsAuthenticated(false);
      }
    };

    verifySession();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SubscriptionPlans
          onSuccess={() => navigate('/settings?subscription=success')}
        />

        {isAuthenticated === false && (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-gray-300">
            <p>
              Ready to activate a plan?{' '}
              <button
                onClick={() => navigate('/auth')}
                className="font-semibold text-white underline underline-offset-4 hover:text-blue-200"
              >
                Sign in to continue checkout
              </button>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pricing;
