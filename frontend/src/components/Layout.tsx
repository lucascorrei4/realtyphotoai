import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import {
  Home,
  Image,
  Palette,
  Replace,
  Sofa,
  Building2,
  Users,
  Settings,
  Shield,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  Coins
} from 'lucide-react';
import { SUBSCRIPTION_PLANS, getCreditUsageSummary, getImageCredits, getVideoCredits } from '../config/subscriptionPlans';
import { getUserPlanFromDatabase, PLAN_DISPLAY_NAMES } from '../utils/planUtils';
import { Crown } from 'lucide-react';
import packageJson from '../../package.json';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [creditBalance, setCreditBalance] = useState<{
    displayCreditsRemaining: number;
    displayCreditsTotal: number;
    displayCreditsUsed: number;
  } | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);

  // Ensure component is mounted before rendering theme-dependent content
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch credit balance
  useEffect(() => {
    if (user?.id) {
      fetchCreditBalance();
    }
  }, [user]);

  const fetchCreditBalance = async () => {
    if (!user?.id) return;
    
    setCreditsLoading(true);
    try {
      // Get user's plan from database plan_rules
      let userPlan = SUBSCRIPTION_PLANS.starter; // Default fallback
      
      if (user.subscription_plan) {
        const dbPlan = await getUserPlanFromDatabase(user.subscription_plan);
        if (dbPlan) {
          userPlan = dbPlan;
        }
      }

      // Fetch ONLY current month's completed generations
      // Monthly credits reset each billing cycle
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

      // Calculate actual credits used - count ONLY current month's completed generations
      // Each completed generation consumes credits (1 credit per image, 15 credits per second of video)
      let actualCreditsUsed = 0;
      (generations || []).forEach(g => {
        // Check if it's a video generation (you'll need to add this field to generations table)
        if (g.generation_type === 'video' && g.duration_seconds) {
          actualCreditsUsed += getVideoCredits(g.duration_seconds);
        } else {
          // Default to image generation (1 credit per image)
          actualCreditsUsed += getImageCredits(1);
        }
      });

      // Get credit usage summary
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
  };

  const navigation = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/add-furnitures', label: 'Add Furnitures', icon: Sofa },
    { path: '/interior-design', label: 'Interior Design', icon: Palette },
    { path: '/exterior-design', label: 'Exterior Design', icon: Building2 },
    { path: '/image-enhancement', label: 'Image Enhancement', icon: Image },
    { path: '/replace-elements', label: 'Replace Elements', icon: Replace },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const adminNavigation = [
    { path: '/users', label: 'User Management', icon: Users, adminOnly: true },
    { path: '/admin', label: 'Admin Dashboard', icon: Shield, adminOnly: true },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Don't render theme-dependent content until mounted
  if (!mounted) {
    return null;
  }

  // Show loading spinner while authentication is in progress
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if no user (should redirect to auth page)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <img
              src={theme === 'dark' ? '/logo_white.png' : '/logo_black.png'}
              alt="RealVision AI"
              className="h-16 w-auto"
            />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive(item.path)
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={20} className="mr-3" />
                  {item.label}
                </Link>
              );
            })}

            {/* Plan Info Section */}
            {user && user.subscription_plan && (
              <>
                <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-4" />
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase">
                      {PLAN_DISPLAY_NAMES[user.subscription_plan] || user.subscription_plan} Plan
                    </span>
                    {user.subscription_plan !== 'free' && (
                      <Crown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  {creditBalance && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      <div className="flex items-center justify-between">
                        <span>{creditBalance.displayCreditsUsed.toLocaleString()} / {creditBalance.displayCreditsTotal.toLocaleString()} credits</span>
                        <span>{Math.min(100, Math.round((creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) * 100))}%</span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            (creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) > 0.9
                              ? 'bg-red-500'
                              : (creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) > 0.7
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (creditBalance.displayCreditsUsed / creditBalance.displayCreditsTotal) * 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-4" />
              </>
            )}

            {/* Separator line */}
            <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-4" />

            {isAdmin && (
              <>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Admin
                </h2>
                {adminNavigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isActive(item.path)
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon size={20} className="mr-3" />
                      {item.label}
                    </Link>
                  );
                })}
              </>
            )}
          </div>
        </nav>

        {/* Theme toggle and Logout */}
        <div className="absolute bottom-6 left-6 right-6 space-y-3">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            {theme === 'dark' ? (
              <>
                <Sun size={20} className="mr-2" />
                Light Mode
              </>
            ) : (
              <>
                <Moon size={20} className="mr-2" />
                Dark Mode
              </>
            )}
          </button>

          <button
            onClick={signOut}
            className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            <LogOut size={20} className="mr-2" />
            Logout
          </button>
           <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-4" />
           <small className="text-xs text-gray-500 dark:text-gray-400 px-3 text-center block">RealVision AI {packageJson.version}</small>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between h-16 px-6">
            {/* Left side - Mobile menu button */}
            <div className="flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Menu size={20} />
              </button>
            </div>

            {/* Right side - Credit balance and User profile */}
            <div className="flex items-center space-x-4">
              {/* Credit Balance */}
              {user && !creditsLoading && creditBalance && (
                <Link
                  to="/dashboard"
                  className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg px-3 py-2 transition-colors"
                >
                  <Coins className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <div className="hidden md:block">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        {creditBalance.displayCreditsUsed.toLocaleString()}
                      </span>
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        / {creditBalance.displayCreditsTotal.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">credits used</p>
                  </div>
                  <div className="md:hidden">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {creditBalance.displayCreditsUsed.toLocaleString()}/{creditBalance.displayCreditsTotal.toLocaleString()}
                    </span>
                  </div>
                </Link>
              )}
              {creditsLoading && (
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              )}

              {/* User profile */}
              {user && (
                <Link
                  to="/settings"
                  className="flex items-center space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-2 py-1 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {user.name || 'Profile'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user.role.replace('_', ' ')}
                    </p>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
