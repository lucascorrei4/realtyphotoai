import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Home,
  Image,
  Palette,
  Replace,
  Sofa,
  Building2,
  Sparkles,
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
import { PLAN_DISPLAY_NAMES } from '../utils/planUtils';
import { Crown } from 'lucide-react';
import packageJson from '../../package.json';
import { CreditProvider, useCredits } from '../contexts/CreditContext';
import VideoGenerationNotification from './VideoGenerationNotification';

interface LayoutProps {
  children: React.ReactNode;
}

const LayoutContent: React.FC<LayoutProps> = ({ children }) => {
  const { theme, toggleTheme } = useTheme();
  const { user, loading, signOut } = useAuth();
  const { creditBalance, creditsLoading, refreshCredits } = useCredits();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Refresh credits when subscription plan changes
  useEffect(() => {
    if (user?.subscription_plan) {
      // Small delay to ensure plan data is updated
      const timeoutId = setTimeout(() => {
        refreshCredits();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [user?.subscription_plan, refreshCredits]);

  // Ensure component is mounted before rendering theme-dependent content
  useEffect(() => {
    setMounted(true);
  }, []);

  const navigation = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/smart-effects', label: 'Smart Effects', icon: Sparkles },
    { path: '/add-furnitures', label: 'Add Furnitures', icon: Sofa },
    { path: '/interior-design', label: 'Interior Design', icon: Palette },
    { path: '/exterior-design', label: 'Exterior Design', icon: Building2 },
    { path: '/image-enhancement', label: 'Image Enhancement', icon: Image },
    { path: '/replace-elements', label: 'Replace Elements', icon: Replace },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  const adminNavigation = [
    { path: '/admin', label: 'Admin Dashboard', icon: Shield, adminOnly: true },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const totalCredits = creditBalance?.displayCreditsTotal ?? 0;
  const usedCredits = creditBalance?.displayCreditsUsed ?? 0;
  const usageRatio = totalCredits > 0 ? Math.min(usedCredits / totalCredits, 1) : 0;
  const usagePercent = totalCredits > 0 ? Math.min(100, Math.round(usageRatio * 100)) : 0;

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
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        {/* Header - Fixed */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
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

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-6">
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
                        <span>{usedCredits.toLocaleString()} / {totalCredits.toLocaleString()} credits</span>
                        <span>{usagePercent}%</span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 mt-1">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            usageRatio > 0.9
                              ? 'bg-red-500'
                              : usageRatio > 0.7
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${usageRatio * 100}%`
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
                  // Check if the current path matches or starts with the item path
                  const isItemActive = location.pathname === item.path || 
                    (item.path !== '/admin' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${isItemActive
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

        {/* Theme toggle and Logout - Fixed at bottom */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3 bg-white dark:bg-gray-800">
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
          
          <div className="h-px w-full bg-gray-200 dark:bg-gray-700" />
          <small className="text-xs text-gray-500 dark:text-gray-400 text-center block">RealVision AI {packageJson.version}</small>
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
                        {usedCredits.toLocaleString()}
                      </span>
                      <span className="text-xs text-blue-600 dark:text-blue-400">
                        / {totalCredits.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">credits used</p>
                  </div>
                  <div className="md:hidden">
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {usedCredits.toLocaleString()} / {totalCredits.toLocaleString()}
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

        {/* Global Video Generation Notification */}
        <VideoGenerationNotification />
      </div>
    </div>
  );
};

const Layout: React.FC<LayoutProps> = ({ children }) => (
  <CreditProvider>
    <LayoutContent>{children}</LayoutContent>
  </CreditProvider>
);

export default Layout;
