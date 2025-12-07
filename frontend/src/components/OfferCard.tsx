import React from 'react';
import { CheckCircle, Zap, Crown, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface OfferCardProps {
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
  onSelect?: () => void;
  paymentType: 'one-time' | 'monthly';
}

const OfferCard: React.FC<OfferCardProps> = ({
  title,
  price,
  priceSubtext,
  highlight,
  description,
  features,
  badge,
  badgeColor = 'blue',
  icon: Icon,
  isBestValue = false,
  onSelect,
  paymentType
}) => {
  const badgeColorClasses = {
    blue: 'bg-blue-500 text-white',
    purple: 'bg-purple-500 text-white',
    emerald: 'bg-emerald-500 text-white'
  };

  return (
    <div
      className={`relative flex flex-col rounded-3xl border-2 transition-all duration-300 ${
        isBestValue
          ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-white shadow-2xl scale-105 z-10 dark:from-emerald-950/30 dark:to-slate-900 dark:border-emerald-400'
          : 'border-slate-200 bg-white shadow-xl hover:shadow-2xl hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-900'
      }`}
    >
      {isBestValue && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500 rounded-full blur-lg opacity-60 animate-pulse"></div>
            <div className="relative bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500 text-white px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap border-2 border-white/30">
              <Crown className="h-4 w-4 text-yellow-300" />
              <span className="font-black text-xs tracking-wide">BEST OFFER</span>
            </div>
          </div>
        </div>
      )}

      {badge && !isBestValue && (
        <div className="absolute -top-3 right-4 z-10">
          <span className={`${badgeColorClasses[badgeColor]} px-3 py-1 rounded-full text-xs font-bold shadow-lg`}>
            {badge}
          </span>
        </div>
      )}

      <div className={`p-6 sm:p-8 ${isBestValue ? 'pt-10' : 'pt-8'}`}>
        {/* Header */}
        <div className="text-center mb-6">
          {Icon && (
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4 ${
              isBestValue
                ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
            }`}>
              <Icon className="h-6 w-6" />
            </div>
          )}
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h3>
          <div className="mb-4">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-5xl font-extrabold text-slate-900 dark:text-white">
                {price}
              </span>
              {priceSubtext && (
                <span className="text-lg text-slate-500 dark:text-slate-400 font-medium">
                  {priceSubtext}
                </span>
              )}
            </div>
            {paymentType === 'one-time' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium uppercase tracking-wide">
                One-Time Payment
              </p>
            )}
            {paymentType === 'monthly' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium uppercase tracking-wide">
                Per Month
              </p>
            )}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 px-4 py-1.5">
            <Zap className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {highlight}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-center text-sm text-slate-600 dark:text-slate-300 mb-6">
          {description}
        </p>

        {/* Features */}
        <ul className="space-y-3 mb-6">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-slate-700 dark:text-slate-300">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <button
          onClick={onSelect}
          className={`w-full py-4 px-6 rounded-xl font-bold text-base transition-all duration-200 ${
            isBestValue
              ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
              : 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            Get Started
            <ArrowRight className="h-5 w-5" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default OfferCard;

