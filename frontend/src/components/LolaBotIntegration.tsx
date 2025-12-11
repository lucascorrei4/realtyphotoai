import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCredits } from '../contexts/CreditContext';

// Define the window interface to include LolaBot
declare global {
  interface Window {
    LolaBot: {
      mount: (config: any) => void;
    };
  }
}

const PAGE_CONTEXTS: Record<string, string> = {
  '/dashboard': 'User Dashboard - Overview of account, credits, and recent activities.',
  '/image-enhancement': 'Image Enhancement Service - AI tool to enhance real estate photos (HDR, brightness, clarity).',
  '/interior-design': 'Interior Design Service - Virtual staging and interior redesign using AI.',
  '/replace-elements': 'Replace Elements Service - Replace specific objects or areas in an image.',
  '/add-furnitures': 'Add Furniture Service - Virtually furnish empty rooms with realistic furniture.',
  '/exterior-design': 'Exterior Design Service - Renovate and redesign building exteriors/facades.',
  '/smart-effects': 'Smart Effects Service - Apply weather effects like day-to-dusk, twilight, or sunny conversions.',
  '/users': 'User Management (Admin) - Manage registered users and their permissions.',
  '/settings': 'Account Settings - Manage profile, password, and subscription plan.',
  '/pricing': 'Pricing & Plans - View subscription plans and purchase credit packages.',
  '/auth': 'Authentication - Login, Sign up, or Verify OTP.',
  '/payment-success': 'Payment Success - Confirmation page after successful payment.',
  '/privacy': 'Privacy Policy - Information about data handling.',
  '/': 'Landing Page - Home page of RealVisionAI.'
};

const LolaBotIntegration: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const { creditBalance } = useCredits();
  const loadedRef = useRef(false);

  // Load the script once
  useEffect(() => {
    if (loadedRef.current) return;
    
    const scriptId = 'lolabot-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://bizaigpt-lolabot.qj2rlw.easypanel.host/embed/lolabot.js';
      script.async = true;
      document.body.appendChild(script);
      loadedRef.current = true;
    }
  }, []);

  // Update bot context on route or user change
  useEffect(() => {
    const initBot = () => {
      if (!window.LolaBot) return;

      const path = location.pathname;
      let pageDescription = PAGE_CONTEXTS[path];

      // Handle Admin sub-routes
      if (!pageDescription && path.startsWith('/admin')) {
        pageDescription = 'Admin Dashboard - Administrative controls.';
      }
      
      // Fallback for unknown routes
      if (!pageDescription) {
        pageDescription = `Current Page: ${path} - RealVisionAI Application`;
      }

      // Handle Guest ID consistency
      let guestId = localStorage.getItem('lolabot_guest_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('lolabot_guest_id', guestId);
      }
      const currentUserId = user?.id || guestId;

      console.log('user', user);

      // Prepare context
      const context = {
        page: path,
        description: pageDescription,
        user_id: currentUserId,
        user_email: user?.email || 'guest',
        user_role: user?.role || 'visitor',
        plan: user?.subscription_plan || 'none',
        credits_available: creditBalance?.displayCreditsRemaining ?? 0,
        credits_used: creditBalance?.displayCreditsUsed ?? 0,
        credits_total: creditBalance?.displayCreditsTotal ?? 0
      };

      // Cleanup existing instances to prevent duplicates
      // 1. Remove iframe
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        // Identifying the specific iframe by src pattern from the provided script
        if (iframe.src && (iframe.src.includes('/chat/lola-demo') || iframe.src.includes('easypanel.host'))) {
           iframe.remove();
        }
      });
      
      // 2. Remove button
      const buttons = document.querySelectorAll('button');
      buttons.forEach(btn => {
        // Heuristic: Fixed position, bottom right, specific SVG content or style
        if (btn.style.position === 'fixed' && btn.style.bottom === '20px' && btn.style.right === '20px') {
             // The script uses specific SVG content
             if (btn.innerHTML.includes('<svg') && btn.innerHTML.includes('M21 11.5a8.38')) {
                 btn.remove();
             }
        }
      });

      // Mount the bot with new context
      try {
        window.LolaBot.mount({
          botId: "real-vision-ai", 
          userId: currentUserId,
          baseUrl: "https://realvisionai-lolabot-realvisionai.qj2rlw.easypanel.host",
          context: context
        });
      } catch (e) {
        console.error("Failed to mount LolaBot:", e);
      }
    };

    // Attempt to init. If script is not loaded yet, wait for it.
    if (window.LolaBot) {
      initBot();
    } else {
      const interval = setInterval(() => {
        if (window.LolaBot) {
          clearInterval(interval);
          initBot();
        }
      }, 500);
      return () => clearInterval(interval);
    }

  }, [location.pathname, user?.id, user?.email, user?.role, user?.subscription_plan, creditBalance]);

  return null;
};

export default LolaBotIntegration;
