import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SubscriptionPlans from '../components/SubscriptionPlans';
import { checkAuthSession } from '../utils/authHelpers';

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const verifySession = async () => {
      const sessionExists = await checkAuthSession();
      if (!sessionExists) {
        navigate('/auth', { replace: true });
      }
    };
    verifySession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-900 py-16 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <SubscriptionPlans
          onSuccess={() => navigate('/settings?subscription=success')}
        />
      </div>
    </div>
  );
};

export default Pricing;
