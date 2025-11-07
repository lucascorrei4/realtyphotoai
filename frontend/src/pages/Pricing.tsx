import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import StripeCheckout from '../components/StripeCheckout';
import { checkAuthSession } from '../utils/authHelpers';
import { useEffect } from 'react';

const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const verifySession = async () => {
      const sessionExists = await checkAuthSession();
      if (!sessionExists) {
        navigate('/auth', { replace: true });
      }
    };
    verifySession();
  }, [navigate]);

  const handleClose = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <StripeCheckout
        onClose={handleClose}
        onSuccess={() => navigate('/settings?subscription=success')}
      />
    </div>
  );
};

export default Pricing;
