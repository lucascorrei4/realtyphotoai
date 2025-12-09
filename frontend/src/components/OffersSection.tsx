import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import OfferCard, { OfferCardProps } from './OfferCard';
import { Coins, Video, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getBackendUrl } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { getAllPlansFromDatabase } from '../utils/planUtils';
import { SubscriptionPlan, formatPrice } from '../config/subscriptionPlans';

export interface Offer {
  title: string;
  price: string;
  priceSubtext?: string;
  highlight: string;
  description: string;
  features: string[];
  badge?: string;
  badgeColor?: 'blue' | 'purple' | 'emerald';
  icon?: LucideIcon;
  isBestValue?: boolean;
  paymentType: 'one-time' | 'monthly';
  onSelect?: () => void;
}

interface OffersSectionProps {
  offers?: Offer[];
  title?: string;
  subtitle?: string;
  className?: string;
  embedded?: boolean; // If true, remove background and adjust padding for embedded use
}

const defaultOffers: Offer[] = [
  {
    title: 'DIY 800',
    price: '$27',
    highlight: '800 Credits',
    description: '800 Credits - Recharge and go',
    features: [
      '800 credits included',
      'Credits never expire',
      'Use on any service',
      'Recharge and go'
    ],
    badge: 'One-Time',
    badgeColor: 'blue',
    icon: Coins,
    paymentType: 'one-time'
  },
  {
    title: 'A la carte',
    price: '$47',
    highlight: '3 Intro 6s Viral Videos',
    description: 'Real Vision AI - 3 Intro 6s Viral Videos - We do for you!',
    features: [
      '3 intro 6-second viral videos',
      '2500 credits included',
      'Professional video creation',
      'Done-for-you service',
      'One-time payment'
    ],
    badge: 'We Do For You',
    badgeColor: 'purple',
    icon: Video,
    paymentType: 'one-time'
  },
  {
    title: 'Real Vision AI Best Offer',
    price: '$49.90',
    priceSubtext: '/mo',
    highlight: '2500 credits per month',
    description: 'Real Vision AI - Best option for regular users. Get the most value with monthly credits.',
    features: [
      '2500 credits per month',
      'Best option available',
      'Use on all services',
      'Cancel anytime'
    ],
    badge: 'Best Option',
    badgeColor: 'emerald',
    icon: Rocket,
    isBestValue: true,
    paymentType: 'monthly'
  }
];

const OffersSection: React.FC<OffersSectionProps> = ({
  offers: customOffers,
  title = 'Choose Your Perfect Plan',
  subtitle = 'Pick the option that works best for your needs. All plans include full access to our AI-powered platform.',
  className = '',
  embedded = false
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>(defaultOffers);
  const [studioPlan, setStudioPlan] = useState<SubscriptionPlan | null>(null);

  // Fetch Studio/premium plan from database
  useEffect(() => {
    const fetchStudioPlan = async () => {
      try {
        const dbPlans = await getAllPlansFromDatabase();
        const premiumPlan = dbPlans.find(plan => plan.id === 'premium');
        
        if (premiumPlan) {
          setStudioPlan(premiumPlan);
          
          // Update the Best Offer with Studio plan data
          const displayCredits = premiumPlan.features.displayCredits || premiumPlan.features.monthlyCredits;
          const monthlyPrice = premiumPlan.price.monthly;
          
          setOffers(prevOffers => {
            const updatedOffers = [...prevOffers];
            const bestOfferIndex = updatedOffers.findIndex(offer => offer.paymentType === 'monthly');
            
            if (bestOfferIndex !== -1) {
              updatedOffers[bestOfferIndex] = {
                ...updatedOffers[bestOfferIndex],
                title: premiumPlan.displayName, // This will be "Studio" from database
                price: formatPrice(monthlyPrice),
                priceSubtext: '/mo',
                highlight: `${displayCredits.toLocaleString()} credits per month`,
                description: 'Built for content creators, digital agencies, and professionals who demand the highest quality and advanced features.',
                features: [
                  `${displayCredits.toLocaleString()} credits per month`,
                  'Best option available',
                  'Use on all services',
                  'Cancel anytime'
                ]
              };
            }
            
            return updatedOffers;
          });
        } else {
          // Fallback: use default offer if plan not found
          console.warn('[OffersSection] Premium plan not found in database, using default');
        }
      } catch (error) {
        console.error('[OffersSection] Error fetching Studio plan:', error);
        // Keep default offers on error
      }
    };

    // Only fetch if custom offers not provided
    if (!customOffers) {
      fetchStudioPlan();
    } else {
      setOffers(customOffers);
    }
  }, [customOffers]);

  const handleSelect = async (offer: Offer) => {
    if (offer.onSelect) {
      offer.onSelect();
      return;
    }

    setLoading(offer.title);

    try {
      // Get auth token if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Handle recurring subscription (Studio/premium plan)
      if (offer.paymentType === 'monthly') {
        const userEmail = session?.user?.email;
        
        const response = await fetch(`${getBackendUrl()}/api/v1/stripe/checkout`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            planId: 'premium', // Use premium plan for Studio
            billingCycle: 'monthly',
            ...(userEmail && { email: userEmail }),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to create checkout session');
        }

        window.location.href = data.url;
        return;
      }

      // Handle one-time payments
      if (offer.paymentType === 'one-time') {
        const userEmail = session?.user?.email;
        
        // Determine amount and credits based on offer
        let amount = 0;
        let credits = 0;
        let offerType: 'credits' | 'videos' = 'credits';
        let description = offer.description || '';

        if (offer.title.includes('DIY 800')) {
          amount = 27;
          credits = 800;
          description = '800 Credits - Recharge and go';
          offerType = 'credits';
        } else if (offer.title.includes('A la carte')) {
          amount = 47;
          credits = 2500; // A la carte includes 2500 credits
          description = offer.description || 'Real Vision AI - 3 Intro 6s Viral Videos - We do for you';
          offerType = 'videos';
        }

        const response = await fetch(`${getBackendUrl()}/api/v1/stripe/checkout-one-time`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            amount,
            credits: credits > 0 ? credits : undefined,
            description,
            offerType,
            ...(userEmail && { email: userEmail }),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || data.error || 'Failed to create checkout session');
        }

        window.location.href = data.url;
        return;
      }

      // Default: navigate to pricing
      navigate('/pricing');
    } catch (error) {
      console.error('Error initiating checkout:', error);
      alert(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section
      className={`rounded-3xl px-4 py-20 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ${embedded ? '!bg-transparent dark:!bg-transparent !py-12' : ''} ${className}`}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl lg:text-5xl mb-4">
            {title}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {offers.map((offer, index) => (
            <div key={index} className="relative">
              <OfferCard
              title={offer.title}
              price={offer.price}
              priceSubtext={offer.priceSubtext}
              highlight={offer.highlight}
              description={offer.description}
              features={offer.features}
              badge={offer.badge}
              badgeColor={offer.badgeColor}
              icon={offer.icon}
              isBestValue={offer.isBestValue}
              paymentType={offer.paymentType}
              onSelect={() => handleSelect(offer)}
            />
            {loading === offer.title && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 rounded-3xl z-10">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Processing...</p>
                </div>
              </div>
            )}
            </div>
          ))}
        </div>

        {/* Trust Signals */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>No hidden fees</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>Instant access</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OffersSection;

