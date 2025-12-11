import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Users,
  BarChart3,
  Settings,
  Crown,
  Eye,
  Edit,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  LogOut,
  RefreshCw,
  Image,
  Clock,
  TrendingUp,
  Activity,
  FileText,
  Shield,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  Download,
  Filter as FilterIcon,
  X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../config/supabase';
import { RecentGenerationsWidget } from '../components';
import { authenticatedFetch } from '../utils/apiUtils';

interface SystemStats {
  totalUsers: number;
  totalGenerations: number;
  successfulGenerations: number;
  successRate: number;
  monthlyGenerations: number;
  planDistribution: {
    [key: string]: number;
  };
  lastUpdated: string;
}

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  subscription_plan: string;
  monthly_generations_limit: number;
  total_generations: number;
  monthly_credits_used?: number; // Credits used this month
  monthly_credits_total?: number; // Total credits available this month
  is_active: boolean;
  created_at: string;
}

interface PlanRule {
  id: string;
  plan_name: string;
  monthly_generations_limit: number;
  concurrent_generations: number;
  allowed_models: string[];
  price_per_month: number;
  features: any;
  is_active: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
}

const AdminDashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Set initial tab based on route
  const getInitialTab = (): 'overview' | 'users' | 'stripe' | 'settings' | 'generations' => {
    if (location.pathname === '/admin/generations') {
      return 'generations';
    }
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'stripe' | 'settings' | 'generations'>(getInitialTab());
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<PlanRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanRule | null>(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userActionMenu, setUserActionMenu] = useState<string | null>(null);
  const [stripeCustomers, setStripeCustomers] = useState<any[]>([]);
  const [stripeSessions, setStripeSessions] = useState<any[]>([]);
  const [stripeSubscriptions, setStripeSubscriptions] = useState<any[]>([]);
  const [stripeInvoices, setStripeInvoices] = useState<any[]>([]);
  const [stripePayouts, setStripePayouts] = useState<any[]>([]);
  const [stripeBalance, setStripeBalance] = useState<any | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [txnFilterText, setTxnFilterText] = useState('');
  const [txnStatus, setTxnStatus] = useState<string>('all');
  const [stripeTableTab, setStripeTableTab] = useState<'customers' | 'transactions'>('transactions');
  const [selectedStripeSession, setSelectedStripeSession] = useState<any | null>(null);

  // Update tab when route changes
  useEffect(() => {
    if (location.pathname === '/admin/generations') {
      setActiveTab('generations');
    } else if (location.pathname === '/admin') {
      setActiveTab('overview');
    }
  }, [location.pathname]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userActionMenu && !(event.target as Element).closest('.user-action-menu')) {
        setUserActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userActionMenu]);

  const [recentGenerations, setRecentGenerations] = useState<any[]>([]);
  const [recentGenerationsLoading, setRecentGenerationsLoading] = useState(false);

  // Fetch recent generations for activity feed
  const fetchRecentGenerations = async () => {
    try {
      setRecentGenerationsLoading(true);
      const response = await authenticatedFetch('/api/v1/admin/generations?limit=10&page=1');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.generations) {
          setRecentGenerations(data.data.generations);
        }
      }
    } catch (error) {
      console.error('Error fetching recent generations:', error);
    } finally {
      setRecentGenerationsLoading(false);
    }
  };

  // Fetch recent generations when overview tab is active
  useEffect(() => {
    if (activeTab === 'overview' && user) {
      fetchRecentGenerations();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'stripe' && user) {
      fetchStripeMeta();
    }
  }, [activeTab, user]);

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  // Get model type label
  const getModelTypeLabel = (modelType: string) => {
    const labels: { [key: string]: string } = {
      'interior_design': 'Interior Design',
      'exterior_design': 'Exterior Design',
      'image_enhancement': 'Image Enhancement',
      'element_replacement': 'Element Replacement',
      'add_furnitures': 'Add Furnitures',
      'smart_effects': 'Smart Effects',
      'video_motion': 'Video Motion'
    };
    return labels[modelType] || modelType;
  };

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const promises = [
        fetchSystemStats(),
        fetchUsers()
      ];

      // Only fetch plans if user is super_admin
      if (user && user.role === 'super_admin') {
        promises.push(fetchPlans());
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/stats');

      if (response.ok) {
        const data = await response.json();
        setSystemStats(data.stats);
      } else {
        console.error('Failed to fetch system stats:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching system stats:', error);
      showError('Failed to fetch system statistics');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/users');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.users) {
          // Sort users by created_at descending (newest first)
          const sortedUsers = [...data.users].sort((a, b) => {
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return dateB - dateA; // Descending order (newest first)
          });
          setUsers(sortedUsers);
        } else {
          console.error('Invalid response format:', data);
          setUsers([]);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch users:', response.status, response.statusText, errorText);
        showError('Failed to fetch users');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('Error fetching users. Please try again.');
      setUsers([]);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/plans');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.plans) {
          setPlans(data.plans);
        } else {
          console.error('Invalid response format:', data);
          setPlans([]);
        }
      } else {
        // Plans endpoint requires super_admin, so 403 is expected for regular admins
        if (response.status === 403) {
          console.log('Plans endpoint requires super_admin access');
          setPlans([]);
        } else {
          console.error('Failed to fetch plans:', response.status, response.statusText);
          // Don't show error for 403 as it's expected for non-super-admin users
          if (response.status !== 403) {
            showError('Failed to fetch plans');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      // Don't show error if it's a permission issue
      if (!(error instanceof Error && error.message.includes('403'))) {
        showError('Error fetching plans');
      }
    }
  };

  const fetchStripeMeta = async () => {
    if (!user) return;
    setStripeLoading(true);
    setTxnFilterText('');
    setTxnStatus('all');
    try {
      const [customersRes, sessionsRes, subscriptionsRes, invoicesRes, payoutsRes, balanceRes] = await Promise.all([
        authenticatedFetch('/api/v1/admin/stripe/customers'),
        authenticatedFetch('/api/v1/admin/stripe/sessions'),
        authenticatedFetch('/api/v1/admin/stripe/subscriptions'),
        authenticatedFetch('/api/v1/admin/stripe/invoices'),
        authenticatedFetch('/api/v1/admin/stripe/payouts'),
        authenticatedFetch('/api/v1/admin/stripe/balance'),
      ]);

      if (customersRes.ok) {
        const data = await customersRes.json();
        setStripeCustomers(data.customers || []);
      } else if (customersRes.status === 403) {
        showError('Stripe customers require admin access.');
        setStripeCustomers([]);
      } else {
        setStripeCustomers([]);
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setStripeSessions(data.sessions || []);
      } else if (sessionsRes.status === 403) {
        showError('Stripe sessions require admin access.');
        setStripeSessions([]);
      } else {
        setStripeSessions([]);
      }

      if (subscriptionsRes.ok) {
        const data = await subscriptionsRes.json();
        setStripeSubscriptions(data.subscriptions || []);
      } else {
        setStripeSubscriptions([]);
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setStripeInvoices(data.invoices || []);
      } else {
        setStripeInvoices([]);
      }

      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setStripePayouts(data.payouts || []);
      } else {
        setStripePayouts([]);
      }

      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setStripeBalance(data.balance || null);
      } else {
        setStripeBalance(null);
      }
    } catch (error) {
      console.error('Error fetching Stripe data:', error);
      setStripeCustomers([]);
      setStripeSessions([]);
      setStripeSubscriptions([]);
      setStripeInvoices([]);
      setStripePayouts([]);
      setStripeBalance(null);
    } finally {
      setStripeLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const response = await authenticatedFetch(`/api/v1/admin/users/${userId}/toggle-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive }),
      });

      if (response.ok) {
        showSuccess(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
        await fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        showError(errorData.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      showError('Error updating user status');
    }
  };

  const changeUserPlan = async (userId: string, newPlan: string, forceCredits?: boolean) => {
    try {
      const response = await authenticatedFetch(`/api/v1/admin/users/${userId}/change-plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPlan, forceCredits }),
      });

      if (response.ok) {
        const isOneTimePlan = newPlan === 'explorer' || newPlan === 'a_la_carte';
        const credits = newPlan === 'explorer' ? 800 : newPlan === 'a_la_carte' ? 2500 : 0;
        showSuccess(`User plan updated to ${newPlan}${isOneTimePlan ? ` (+${credits} credits)` : ''}`);
        await fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        // For one-time plans, show a more helpful error with option to force
        if ((newPlan === 'explorer' || newPlan === 'a_la_carte') && !forceCredits && errorData.error?.includes('No paid Stripe session')) {
          const shouldForce = window.confirm(
            `${errorData.error}\n\nDo you want to grant the credits manually without Stripe verification?\n\n` +
            `This will add ${newPlan === 'explorer' ? '800' : '2500'} credits to the user's account.`
          );
          if (shouldForce) {
            await changeUserPlan(userId, newPlan, true);
            return;
          }
        }
        showError(errorData.error || 'Failed to update user plan');
      }
    } catch (error) {
      console.error('Error changing user plan:', error);
      showError('Error changing user plan');
    }
  };

  const changeUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await authenticatedFetch(`/api/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        showSuccess('User role updated successfully');
        await fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        showError(errorData.error || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Error changing user role:', error);
      showError('Error changing user role');
    }
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete user ${userEmail}? This will deactivate their account.`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showSuccess('User deleted successfully');
        await fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        showError(errorData.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showError('Error deleting user');
    }
  };

  const viewUserGenerations = (userId: string) => {
    navigate(`/admin/generations?userId=${userId}`);
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    // Search filter
    if (searchTerm) {
      const matchesSearch =
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase()));
      if (!matchesSearch) return false;
    }

    // Role filter
    if (roleFilter !== 'all' && user.role !== roleFilter) {
      return false;
    }

    // Plan filter
    if (planFilter !== 'all' && user.subscription_plan !== planFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && !user.is_active) return false;
      if (statusFilter === 'inactive' && user.is_active) return false;
    }

    return true;
  });

  const syncStripePlans = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/stripe/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchPlans();
        showSuccess('Stripe plans synced successfully!');
      } else {
        showError('Failed to sync Stripe plans');
      }
    } catch (error) {
      console.error('Error syncing Stripe plans:', error);
      showError('Error syncing Stripe plans');
    }
  };

  const deletePlan = async (planId: string) => {
    if (!window.confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchPlans();
        showSuccess('Plan deleted successfully!');
      } else {
        showError('Failed to delete plan');
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      showError('Error deleting plan');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return null;
  }

  const planColors = {
    free: '#6B7280',
    basic: '#3B82F6',
    premium: '#8B5CF6',
    enterprise: '#10B981',
    explorer: '#3B82F6',
    a_la_carte: '#8B5CF6'
  };

  const planDistributionData = systemStats?.planDistribution ?
    Object.entries(systemStats.planDistribution).map(([plan, count]) => ({
      name: plan.charAt(0).toUpperCase() + plan.slice(1),
      value: count,
      color: planColors[plan as keyof typeof planColors] || '#6B7280'
    })) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchData}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Responsive with scroll */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto scrollbar-hide -mx-2 sm:-mx-4 lg:mx-0 px-2 sm:px-4 lg:px-0">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3, shortLabel: 'Overview' },
              { id: 'generations', label: 'Generations', icon: Image, shortLabel: 'Generations' },
              { id: 'users', label: 'Users', icon: Users, shortLabel: 'Users' },
              { id: 'stripe', label: 'Stripe', icon: TrendingUp, shortLabel: 'Stripe' },
              { id: 'settings', label: 'Settings', icon: Settings, shortLabel: 'Settings' }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    // Update URL when tab changes (except for generations which has its own route)
                    if (tab.id === 'generations') {
                      navigate('/admin/generations');
                    } else if (location.pathname === '/admin/generations') {
                      navigate('/admin');
                    }
                  }}
                  className={`flex items-center space-x-1.5 sm:space-x-2 py-3 sm:py-4 px-2 sm:px-3 lg:px-4 border-b-2 font-medium text-xs sm:text-sm transition-all whitespace-nowrap min-w-fit ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Overview Tab - Merged with Dashboard */}
            {activeTab === 'overview' && systemStats && (
              <div className="space-y-5 sm:space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <BarChart3 className="h-5 w-5 text-white" />
                      </div>
                      System Overview
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-0 sm:ml-[52px]">
                      Monitor platform activity, financials, and user engagement
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      fetchData();
                      fetchRecentGenerations();
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:shadow-xl hover:shadow-blue-500/30 active:scale-95 w-full sm:w-auto"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh Data</span>
                  </button>
                </div>

                {/* Stats Cards - Key Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Users</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.totalUsers.toLocaleString()}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                          {users.filter(u => u.is_active).length} active
                        </p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20 flex-shrink-0">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Generations</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.totalGenerations.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {systemStats.monthlyGenerations.toLocaleString()} this month
                        </p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 flex-shrink-0">
                        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Success Rate</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.successRate}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {systemStats.successfulGenerations.toLocaleString()} successful
                        </p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl shadow-lg shadow-violet-500/20 flex-shrink-0">
                        <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monthly Activity</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.monthlyGenerations.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Current month
                        </p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-orange-500/20 flex-shrink-0">
                        <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions & Customers */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Last Transactions Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        Last Transactions
                      </h3>
                      {stripeLoading && <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />}
                    </div>
                    <div className="p-4 sm:p-5">
                      {stripeSessions.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No transactions found</p>
                      ) : (
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {stripeSessions.slice(0, 6).map((session) => (
                            <div 
                              key={session.id} 
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                              onClick={() => setSelectedStripeSession(session)}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {session.customer_email || 'Guest'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {session.product || 'Unknown product'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  ${((session.amount_total || 0) / 100).toFixed(2)}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${session.payment_status === 'paid'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                    : session.payment_status === 'unpaid'
                                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                  }`}>
                                  {session.payment_status || 'n/a'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Last Customers Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                      <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        Last Customers
                      </h3>
                      {stripeLoading && <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />}
                    </div>
                    <div className="p-4 sm:p-5">
                      {stripeCustomers.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No customers found</p>
                      ) : (
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {stripeCustomers.slice(0, 6).map((customer) => (
                            <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-medium text-white">
                                    {(customer.email || customer.name || '?')[0].toUpperCase()}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {customer.email || customer.name || 'Unknown'}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                                    {customer.id}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                                {customer.created ? new Date(customer.created * 1000).toLocaleDateString() : '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Charts & System Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4">Plan Distribution</h3>
                    <div className="h-[200px] sm:h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={planDistributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={typeof window !== 'undefined' && window.innerWidth < 640 ? 60 : 90}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {planDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white mb-4">System Info</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(systemStats.lastUpdated).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Active Users</span>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          {users.filter(u => u.is_active).length} / {users.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <UserX className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 dark:text-red-400" />
                          </div>
                          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Failed Generations</span>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                          {(systemStats.totalGenerations - systemStats.successfulGenerations).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    onClick={() => setActiveTab('users')}
                    className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all text-left overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 w-fit">
                        <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Users</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Manage accounts</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('generations');
                      navigate('/admin/generations');
                    }}
                    className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 w-fit">
                        <Image className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Generations</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">View activity</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('stripe')}
                    className="group relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all text-left overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl group-hover:scale-110 transition-transform flex-shrink-0 w-fit">
                        <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Stripe</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Payments & billing</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Recent Activity - Real Data */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                      Recent Activity
                    </h2>
                    <button
                      onClick={fetchRecentGenerations}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${recentGenerationsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className="p-4 sm:p-5">
                    {recentGenerationsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                      </div>
                    ) : recentGenerations.length > 0 ? (
                      <div className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto">
                        {recentGenerations.map((generation) => (
                          <div
                            key={generation.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${generation.status === 'completed'
                                ? 'bg-green-100 dark:bg-green-900/30'
                                : generation.status === 'processing' || generation.status === 'pending'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                  : 'bg-red-100 dark:bg-red-900/30'
                              }`}>
                              <Activity className={`h-4 w-4 sm:h-5 sm:w-5 ${generation.status === 'completed'
                                  ? 'text-green-600 dark:text-green-400'
                                  : generation.status === 'processing' || generation.status === 'pending'
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {generation.user_email || generation.user_name || 'Unknown User'}
                                </p>
                                {generation.user_subscription_plan && (
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${generation.user_subscription_plan === 'free' ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300' :
                                      generation.user_subscription_plan === 'basic' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                                        generation.user_subscription_plan === 'premium' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' :
                                          'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                    }`}>
                                    {generation.user_subscription_plan}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {getModelTypeLabel(generation.model_type)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${generation.status === 'completed'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                  : generation.status === 'processing' || generation.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                                }`}>
                                {generation.status}
                              </span>
                              <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                                {formatTimeAgo(generation.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                          <Activity className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* All Generations Widget */}
                <RecentGenerationsWidget
                  title="All User Generations"
                  description="Monitor all AI generations across the platform in real-time"
                  showFilters={true}
                  maxItems={12}
                  adminMode={true}
                />
              </div>
            )}


            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">User Management</h2>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
                      Manage all users, roles, and subscription plans
                    </p>
                  </div>
                  <button
                    onClick={fetchUsers}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors w-full sm:w-auto"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Search and Filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        placeholder="Search by email or name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="all">All Roles</option>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="all">All Plans</option>
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Users Table - Responsive */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Plan
                          </th>
                          <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Usage
                          </th>
                          <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Credits
                          </th>
                          <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 xl:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-4 xl:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center">
                              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-500 dark:text-gray-400">
                                {searchTerm || roleFilter !== 'all' || planFilter !== 'all' || statusFilter !== 'all'
                                  ? 'No users match your filters'
                                  : 'No users found'}
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                      <span className="text-sm font-medium text-white">
                                        {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                                      {user.name || 'No name'}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                    user.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                  {user.role === 'super_admin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.subscription_plan === 'free' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                    user.subscription_plan === 'basic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                      user.subscription_plan === 'premium' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  }`}>
                                  {user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                  {user.total_generations.toLocaleString()}
                                </span>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                                      {(user.monthly_credits_used || 0).toLocaleString()}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400">/</span>
                                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                      {(user.monthly_credits_total || user.monthly_generations_limit || 0).toLocaleString()}
                                    </span>
                                  </div>
                                  {user.monthly_credits_total && user.monthly_credits_total > 0 && (
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                      <div
                                        className={`h-1.5 rounded-full transition-all ${((user.monthly_credits_used || 0) / user.monthly_credits_total) > 0.9
                                            ? 'bg-red-500'
                                            : ((user.monthly_credits_used || 0) / user.monthly_credits_total) > 0.7
                                              ? 'bg-yellow-500'
                                              : 'bg-green-500'
                                          }`}
                                        style={{
                                          width: `${Math.min(100, ((user.monthly_credits_used || 0) / user.monthly_credits_total) * 100)}%`
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                  }`}>
                                  {user.is_active ? (
                                    <>
                                      <UserCheck className="h-3 w-3 mr-1" />
                                      <span className="hidden sm:inline">Active</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="h-3 w-3 mr-1" />
                                      <span className="hidden sm:inline">Inactive</span>
                                    </>
                                  )}
                                </span>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                <span className="hidden xl:inline">{new Date(user.created_at).toLocaleDateString()}</span>
                                <span className="xl:hidden">{new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-1 sm:space-x-2">
                                  {/* View Generations */}
                                  <button
                                    onClick={() => viewUserGenerations(user.id)}
                                    className="p-1.5 sm:p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors touch-manipulation"
                                    title="View user generations"
                                  >
                                    <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                  </button>

                                  {/* Toggle Status */}
                                  <button
                                    onClick={() => toggleUserStatus(user.id, !user.is_active)}
                                    className={`p-1.5 sm:p-2 rounded transition-colors touch-manipulation ${user.is_active
                                        ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20'
                                      }`}
                                    title={user.is_active ? 'Deactivate user' : 'Activate user'}
                                  >
                                    {user.is_active ? <UserX className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                  </button>

                                  {/* Actions Menu */}
                                  <div className="relative user-action-menu">
                                    <button
                                      onClick={() => setUserActionMenu(userActionMenu === user.id ? null : user.id)}
                                      className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors touch-manipulation"
                                      title="More actions"
                                    >
                                      <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </button>
                                    {userActionMenu === user.id && (
                                      <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700">
                                        <div className="py-1">
                                          {/* Change Role (only for super_admin) */}
                                          {user && (user.role === 'super_admin') && (
                                            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Role</label>
                                              <select
                                                value={user.role}
                                                onChange={(e) => {
                                                  changeUserRole(user.id, e.target.value);
                                                  setUserActionMenu(null);
                                                }}
                                                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                                <option value="super_admin">Super Admin</option>
                                              </select>
                                            </div>
                                          )}

                                          {/* Change Plan */}
                                          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                            <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Plan</label>
                                            <select
                                              value={user.subscription_plan}
                                              onChange={(e) => {
                                                changeUserPlan(user.id, e.target.value);
                                                setUserActionMenu(null);
                                              }}
                                              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <option value="free">Free</option>
                                              <option value="basic">Basic</option>
                                              <option value="premium">Premium</option>
                                              <option value="enterprise">Enterprise</option>
                                              <option value="explorer">Explorer</option>
                                              <option value="a_la_carte">A la carte</option>
                                            </select>
                                          </div>

                                          {/* View Details */}
                                          <button
                                            onClick={() => {
                                              setSelectedUser(user);
                                              setUserActionMenu(null);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                          >
                                            <Eye className="h-4 w-4 mr-2" />
                                            View Details
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredUsers.length === 0 ? (
                      <div className="p-6 text-center">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          {searchTerm || roleFilter !== 'all' || planFilter !== 'all' || statusFilter !== 'all'
                            ? 'No users match your filters'
                            : 'No users found'}
                        </p>
                      </div>
                    ) : (
                      filteredUsers.map((user) => (
                        <div key={user.id} className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                                  <span className="text-sm font-medium text-white">
                                    {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {user.name || 'No name'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <button
                                onClick={() => viewUserGenerations(user.id)}
                                className="p-2 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                title="View generations"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => toggleUserStatus(user.id, !user.is_active)}
                                className={`p-2 rounded transition-colors ${user.is_active
                                    ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                                    : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                                  }`}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => deleteUser(user.id, user.email)}
                                className="p-2 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 rounded transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <div className="relative user-action-menu">
                                <button
                                  onClick={() => setUserActionMenu(userActionMenu === user.id ? null : user.id)}
                                  className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 rounded"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                                {userActionMenu === user.id && (
                                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-700">
                                    <div className="py-1">
                                      {user && (user.role === 'super_admin') && (
                                        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Role</label>
                                          <select
                                            value={user.role}
                                            onChange={(e) => {
                                              changeUserRole(user.id, e.target.value);
                                              setUserActionMenu(null);
                                            }}
                                            className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                            <option value="super_admin">Super Admin</option>
                                          </select>
                                        </div>
                                      )}
                                      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1">Plan</label>
                                        <select
                                          value={user.subscription_plan}
                                          onChange={(e) => {
                                            changeUserPlan(user.id, e.target.value);
                                            setUserActionMenu(null);
                                          }}
                                          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <option value="free">Free</option>
                                          <option value="basic">Basic</option>
                                          <option value="premium">Premium</option>
                                          <option value="enterprise">Enterprise</option>
                                          <option value="explorer">Explorer</option>
                                          <option value="a_la_carte">A la carte</option>
                                        </select>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setSelectedUser(user);
                                          setUserActionMenu(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Details
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Role:</span>
                              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'super_admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                  user.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                {user.role === 'super_admin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Plan:</span>
                              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${user.subscription_plan === 'free' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                  user.subscription_plan === 'basic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                    user.subscription_plan === 'premium' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                }`}>
                                {user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Generations:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {user.total_generations.toLocaleString()}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500 dark:text-gray-400">Credits:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {(user.monthly_credits_used || 0).toLocaleString()} / {(user.monthly_credits_total || user.monthly_generations_limit || 0).toLocaleString()}
                              </span>
                              {user.monthly_credits_total && user.monthly_credits_total > 0 && (
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${((user.monthly_credits_used || 0) / user.monthly_credits_total) > 0.9
                                        ? 'bg-red-500'
                                        : ((user.monthly_credits_used || 0) / user.monthly_credits_total) > 0.7
                                          ? 'bg-yellow-500'
                                          : 'bg-green-500'
                                      }`}
                                    style={{
                                      width: `${Math.min(100, ((user.monthly_credits_used || 0) / user.monthly_credits_total) * 100)}%`
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Status:</span>
                              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center ${user.is_active
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                }`}>
                                {user.is_active ? (
                                  <>
                                    <UserCheck className="h-3 w-3 mr-1" />
                                    Active
                                  </>
                                ) : (
                                  <>
                                    <UserX className="h-3 w-3 mr-1" />
                                    Inactive
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Created: {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {filteredUsers.length > 0 && (
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
                        Showing {filteredUsers.length} of {users.length} users
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stripe Tab */}
            {activeTab === 'stripe' && (
              <div className="space-y-5 sm:space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      Stripe Integration
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-0 sm:ml-[52px]">
                      Manage payments, customers, and financial data
                    </p>
                  </div>
                  <button
                    onClick={fetchStripeMeta}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/30 active:scale-95 w-full sm:w-auto"
                  >
                    <RefreshCw className={`h-4 w-4 ${stripeLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh Data</span>
                  </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Available</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                          {stripeBalance?.available?.length
                            ? `$${(stripeBalance.available[0]?.amount / 100).toFixed(0)}`
                            : '$0'}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">Ready to use</p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg shadow-emerald-500/20 flex-shrink-0">
                        <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                          {stripeBalance?.pending?.length
                            ? `$${(stripeBalance.pending[0]?.amount / 100).toFixed(0)}`
                            : '$0'}
                        </p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Processing</p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-orange-500/20 flex-shrink-0">
                        <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Volume</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                          {stripeSessions.length
                            ? `$${(stripeSessions.reduce((sum, s) => sum + (s.amount_total || 0), 0) / 100).toFixed(0)}`
                            : '$0'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stripeSessions.length} transactions</p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 flex-shrink-0">
                        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Payouts</p>
                        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                          {stripePayouts.length
                            ? `$${(stripePayouts.reduce((sum, p) => sum + (p.amount || 0), 0) / 100).toFixed(0)}`
                            : '$0'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stripePayouts.length} payouts</p>
                      </div>
                      <div className="p-2.5 sm:p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/20 flex-shrink-0">
                        <Download className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-1.5 inline-flex gap-1">
                  <button
                    onClick={() => setStripeTableTab('transactions')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${stripeTableTab === 'transactions'
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    Transactions
                  </button>
                  <button
                    onClick={() => setStripeTableTab('customers')}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${stripeTableTab === 'customers'
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                  >
                    Customers
                  </button>
                </div>

                {/* Transactions View */}
                {stripeTableTab === 'transactions' && (
                  <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={txnFilterText}
                          onChange={(e) => setTxnFilterText(e.target.value)}
                          placeholder="Search transactions..."
                          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <select
                        value={txnStatus}
                        onChange={(e) => setTxnStatus(e.target.value)}
                        className="px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      >
                        <option value="all">All statuses</option>
                        <option value="paid">Paid</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="canceled">Canceled</option>
                      </select>
                    </div>

                    {/* Transactions List */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                      {stripeSessions.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                            <FileText className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">No transactions found</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {stripeSessions
                            .filter((s) => {
                              const text = txnFilterText.toLowerCase();
                              const matchesText =
                                !text ||
                                s.id?.toLowerCase().includes(text) ||
                                s.customer?.toLowerCase().includes(text) ||
                                s.customer_email?.toLowerCase().includes(text) ||
                                s.product_name?.toLowerCase().includes(text) ||
                                s.payment_intent?.toLowerCase().includes(text);
                              const matchesStatus =
                                txnStatus === 'all' || (s.payment_status || '').toLowerCase() === txnStatus;
                              return matchesText && matchesStatus;
                            })
                            .map((s) => (
                              <div
                                key={s.id}
                                className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                                onClick={() => setSelectedStripeSession(s)}
                              >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.payment_status === 'paid'
                                    ? 'bg-green-100 dark:bg-green-900/30'
                                    : 'bg-gray-100 dark:bg-gray-700'
                                  }`}>
                                  <FileText className={`h-5 w-5 ${s.payment_status === 'paid'
                                      ? 'text-green-600 dark:text-green-400'
                                      : 'text-gray-500 dark:text-gray-400'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {s.customer_email || 'Guest checkout'}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {s.product_name || s.product || 'Unknown product'}
                                  </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    ${((s.amount_total || 0) / 100).toFixed(2)}
                                  </p>
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.payment_status === 'paid'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                                      : s.payment_status === 'unpaid'
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                    {s.payment_status || 'n/a'}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Customers View */}
                {stripeTableTab === 'customers' && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {stripeCustomers.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                          <Users className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">No customers found</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {stripeCustomers.map((c) => (
                          <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-medium text-white">
                                {(c.email || c.name || '?')[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {c.email || c.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                                {c.id}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {c.created ? new Date(c.created * 1000).toLocaleDateString() : '-'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Generations Tab */}
            {activeTab === 'generations' && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {searchParams.get('userId') ? 'User Generations' : 'All Generations'}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                    {searchParams.get('userId')
                      ? 'View generations for this specific user'
                      : 'View all generations across all users in real-time'}
                  </p>
                  {searchParams.get('userId') && (
                    <button
                      onClick={() => {
                        navigate('/admin/generations');
                      }}
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1"
                    >
                      <X className="h-4 w-4" />
                      <span>Clear filter</span>
                    </button>
                  )}
                </div>

                <RecentGenerationsWidget
                  title={searchParams.get('userId') ? 'User Generations' : 'All User Generations'}
                  description={searchParams.get('userId')
                    ? 'Monitor generations for this specific user'
                    : 'Monitor all AI generations across the platform with user identification'}
                  showFilters={true}
                  maxItems={20}
                  adminMode={true}
                  userId={searchParams.get('userId') || undefined}
                />
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">System Settings</h2>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <p className="text-gray-600 dark:text-gray-400">
                    System settings management is available for super admin users only.
                    {user.role !== 'super_admin' && ' You do not have permission to access this section.'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* User Detail Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">User Details</h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-2xl font-medium text-white">
                      {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : selectedUser.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {selectedUser.name || 'No name'}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedUser.role === 'super_admin' ? 'Super Admin' : selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plan</label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedUser.subscription_plan.charAt(0).toUpperCase() + selectedUser.subscription_plan.slice(1)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {new Date(selectedUser.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usage</label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {selectedUser.total_generations} / {selectedUser.monthly_generations_limit}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
                  <button
                    onClick={() => {
                      viewUserGenerations(selectedUser.id);
                      setSelectedUser(null);
                    }}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Generations
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stripe Transaction Detail Modal */}
        {selectedStripeSession && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transaction Details</h3>
                <button
                  onClick={() => setSelectedStripeSession(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 space-y-3 text-sm text-gray-800 dark:text-gray-100">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                  <span className="font-medium text-gray-600 dark:text-gray-300">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${selectedStripeSession.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}>
                    {selectedStripeSession.payment_status || 'n/a'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Customer</p>
                    <p className="font-mono break-words">{selectedStripeSession.customer || '-'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedStripeSession.customer_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Session ID</p>
                    <p className="font-mono break-words">{selectedStripeSession.id || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Payment Intent</p>
                    <p className="font-mono break-words">{selectedStripeSession.payment_intent || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Product / Plan</p>
                    <p className="font-medium">{selectedStripeSession.product_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                    <p className="font-medium">
                      {selectedStripeSession.amount_total
                        ? `$${(selectedStripeSession.amount_total / 100).toFixed(2)} ${selectedStripeSession.currency || ''}`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                    <p className="font-medium">
                      {selectedStripeSession.created
                        ? new Date(selectedStripeSession.created * 1000).toLocaleString()
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
