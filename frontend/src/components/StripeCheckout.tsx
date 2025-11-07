import React from 'react';
import SubscriptionPlans from './SubscriptionPlans';

interface StripeCheckoutProps {
  onClose: () => void;
  onSuccess?: (planId: string) => void;
}

const StripeCheckout: React.FC<StripeCheckoutProps> = ({ onClose, onSuccess }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
      <SubscriptionPlans onClose={onClose} onSuccess={onSuccess} variant="modal" />
    </div>
  </div>
);

export default StripeCheckout;
