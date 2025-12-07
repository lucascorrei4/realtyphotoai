import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useNavigate, useLocation } from 'react-router-dom';
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
  
  // Set initial tab based on route
  const getInitialTab = (): 'overview' | 'users' | 'plans' | 'stripe' | 'settings' | 'dashboard' | 'generations' => {
    if (location.pathname === '/admin/generations') {
      return 'generations';
    }
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'plans' | 'stripe' | 'settings' | 'dashboard' | 'generations'>(getInitialTab());
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

  // Fetch recent generations when dashboard tab is active
  useEffect(() => {
    if (activeTab === 'dashboard' && user) {
      fetchRecentGenerations();
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

  const changeUserPlan = async (userId: string, newPlan: string) => {
    try {
      const response = await authenticatedFetch(`/api/v1/admin/users/${userId}/change-plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPlan }),
      });

      if (response.ok) {
        showSuccess('User plan updated successfully');
        await fetchUsers();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
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
    enterprise: '#10B981'
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
              { id: 'dashboard', label: 'Dashboard', icon: Shield, shortLabel: 'Dashboard' },
              { id: 'generations', label: 'Generations', icon: Image, shortLabel: 'Generations' },
              { id: 'users', label: 'Users', icon: Users, shortLabel: 'Users' },
              { id: 'plans', label: 'Plans', icon: Crown, shortLabel: 'Plans' },
              { id: 'stripe', label: 'Stripe', icon: Crown, shortLabel: 'Stripe' },
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
                  className={`flex items-center space-x-1.5 sm:space-x-2 py-3 sm:py-4 px-2 sm:px-3 lg:px-4 border-b-2 font-medium text-xs sm:text-sm transition-all whitespace-nowrap min-w-fit ${
                    activeTab === tab.id
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
            {/* Overview Tab */}
            {activeTab === 'overview' && systemStats && (
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">System Overview</h2>
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Total Users</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.totalUsers.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {users.filter(u => u.is_active).length} active
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0 ml-2">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Total Generations</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.totalGenerations.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {systemStats.monthlyGenerations} this month
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0 ml-2">
                        <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 dark:text-green-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Success Rate</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.successRate}%</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {systemStats.successfulGenerations.toLocaleString()} successful
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0 ml-2">
                        <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Monthly Activity</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mt-1">{systemStats.monthlyGenerations.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Current month
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex-shrink-0 ml-2">
                        <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600 dark:text-orange-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">Plan Distribution</h3>
                    <ResponsiveContainer width="100%" height={250} className="sm:h-[300px]">
                      <PieChart>
                        <Pie
                          data={planDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
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

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">System Info</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white break-words sm:break-normal">
                          {new Date(systemStats.lastUpdated).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Active Users</span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          {users.filter(u => u.is_active).length} / {users.length}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Failed Generations</span>
                        <span className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
                          {(systemStats.totalGenerations - systemStats.successfulGenerations).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <div className="space-y-4 sm:space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                      Admin Dashboard
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                      Monitor system activity and manage your platform
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      fetchData();
                      fetchRecentGenerations();
                    }}
                    className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors w-full sm:w-auto"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Real Stats Grid */}
                {systemStats && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                            {systemStats.totalUsers.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {users.filter(u => u.is_active).length} active
                          </p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                          <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Generations</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                            {systemStats.totalGenerations.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {systemStats.monthlyGenerations} this month
                          </p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                          <Image className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                            {systemStats.successRate}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {systemStats.successfulGenerations.toLocaleString()} successful
                          </p>
                        </div>
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                          <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Monthly Activity</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                            {systemStats.monthlyGenerations.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Current month
                          </p>
                        </div>
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                          <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <button
                    onClick={() => setActiveTab('users')}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 hover:shadow-lg transition-all text-left group active:scale-95"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors flex-shrink-0">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">User Management</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage all users</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('generations');
                      navigate('/admin/generations');
                    }}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 hover:shadow-lg transition-all text-left group active:scale-95"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors flex-shrink-0">
                        <Image className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">All Generations</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">View all activity</p>
                      </div>
                    </div>
                  </button>

                  {user?.role === 'super_admin' && (
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 hover:shadow-lg transition-all text-left group active:scale-95"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors flex-shrink-0">
                          <Crown className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">Plan Management</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Manage plans</p>
                        </div>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('overview')}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 hover:shadow-lg transition-all text-left group active:scale-95"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors flex-shrink-0">
                        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-white truncate">System Overview</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">View analytics</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Recent Activity - Real Data */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <h2 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white">
                      Recent Activity
                    </h2>
                    <button
                      onClick={fetchRecentGenerations}
                      className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center space-x-1 self-start sm:self-auto"
                    >
                      <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 ${recentGenerationsLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <div className="p-4 sm:p-6">
                    {recentGenerationsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    ) : recentGenerations.length > 0 ? (
                      <div className="space-y-3 sm:space-y-4">
                        {recentGenerations.map((generation) => (
                          <div 
                            key={generation.id} 
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors gap-3 sm:gap-4"
                          >
                            <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                              <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${
                                generation.status === 'completed' 
                                  ? 'bg-green-100 dark:bg-green-900/30' 
                                  : generation.status === 'processing' || generation.status === 'pending'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                  : 'bg-red-100 dark:bg-red-900/30'
                              }`}>
                                <Activity className={`h-3 w-3 sm:h-4 sm:w-4 ${
                                  generation.status === 'completed' 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : generation.status === 'processing' || generation.status === 'pending'
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                                  <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {generation.user_email || generation.user_name || 'Unknown User'}
                                  </p>
                                  {generation.user_subscription_plan && (
                                    <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                      generation.user_subscription_plan === 'free' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                      generation.user_subscription_plan === 'basic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                      generation.user_subscription_plan === 'premium' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                    }`}>
                                      {generation.user_subscription_plan}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                  {getModelTypeLabel(generation.model_type)} • {generation.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex sm:flex-col sm:text-right items-center sm:items-end justify-between sm:justify-end gap-2 sm:gap-1 ml-0 sm:ml-4">
                              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                {formatTimeAgo(generation.created_at)}
                              </p>
                              <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                generation.status === 'completed'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                  : generation.status === 'processing' || generation.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                              }`}>
                                {generation.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
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
                            <td colSpan={7} className="px-6 py-12 text-center">
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
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  user.role === 'super_admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                  user.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {user.role === 'super_admin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  user.subscription_plan === 'free' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                  user.subscription_plan === 'basic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                  user.subscription_plan === 'premium' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                }`}>
                                  {user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1)}
                                </span>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1">
                                  <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{user.total_generations}</span>
                                  <span className="text-gray-500 dark:text-gray-400 hidden sm:inline">/</span>
                                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{user.monthly_generations_limit}</span>
                                </div>
                              </td>
                              <td className="px-4 xl:px-6 py-3 sm:py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  user.is_active 
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
                                    className={`p-1.5 sm:p-2 rounded transition-colors touch-manipulation ${
                                      user.is_active
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
                                className={`p-2 rounded transition-colors ${
                                  user.is_active
                                    ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                                    : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                                }`}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                              >
                                {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
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
                              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                user.role === 'super_admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                user.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {user.role === 'super_admin' ? 'Super Admin' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Plan:</span>
                              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                user.subscription_plan === 'free' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' :
                                user.subscription_plan === 'basic' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                user.subscription_plan === 'premium' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' :
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                              }`}>
                                {user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Usage:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">
                                {user.total_generations} / {user.monthly_generations_limit}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Status:</span>
                              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center ${
                                user.is_active 
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

            {/* Plans Tab */}
            {activeTab === 'plans' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Plan Management</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowCreatePlan(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Create Plan</span>
                    </button>
                    <button
                      onClick={syncStripePlans}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      <span>Sync Stripe</span>
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {plans.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                      <Crown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        {user?.role === 'super_admin' 
                          ? 'No plans found. Create your first plan.'
                          : 'Plans management requires super admin access'}
                      </p>
                    </div>
                  ) : (
                    plans.map((plan) => (
                      <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                          <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white capitalize truncate flex-1">
                            {plan.plan_name} Plan
                          </h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full flex-shrink-0 ml-2 ${
                            plan.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                          }`}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Monthly Limit:</span>
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{plan.monthly_generations_limit.toLocaleString()}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Concurrent:</span>
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">{plan.concurrent_generations}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Price:</span>
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">${plan.price_per_month}/month</span>
                          </div>
                          {plan.stripe_product_id && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 pt-2 border-t border-gray-200 dark:border-gray-700">
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Stripe ID:</span>
                              <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate sm:ml-2 font-mono">
                                {plan.stripe_product_id.substring(0, 8)}...
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white mb-2">Allowed Models:</h4>
                          <div className="flex flex-wrap gap-1">
                            {plan.allowed_models.map((model) => (
                              <span
                                key={model}
                                className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded"
                              >
                                {model.replace('_', ' ')}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => setEditingPlan(plan)}
                              className="flex-1 px-3 py-2 text-xs sm:text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center justify-center"
                            >
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Edit
                            </button>
                            <button
                              onClick={() => deletePlan(plan.id)}
                              className="px-3 py-2 text-xs sm:text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors flex items-center justify-center"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Stripe Tab */}
            {activeTab === 'stripe' && (
              <div className="space-y-4 sm:space-y-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Stripe Integration</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">Stripe Products</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Products</span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          {plans.filter(p => p.stripe_product_id).length}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Synced Plans</span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          {plans.filter(p => p.stripe_product_id && p.stripe_price_id).length}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={syncStripePlans}
                      className="w-full mt-3 sm:mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm sm:text-base"
                    >
                      Sync with Stripe
                    </button>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">Webhook Status</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Endpoint</span>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white break-all sm:break-normal">
                          /api/webhooks/stripe
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg gap-1 sm:gap-0">
                        <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Status</span>
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full self-start sm:self-auto">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">Stripe Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Publishable Key
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="pk_test_..."
                        readOnly
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Webhook Secret
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="whsec_..."
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Generations Tab */}
            {activeTab === 'generations' && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">All Generations</h2>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">
                    View all generations across all users in real-time
                  </p>
                </div>
                
                <RecentGenerationsWidget
                  title="All User Generations"
                  description="Monitor all AI generations across the platform with user identification"
                  showFilters={true}
                  maxItems={20}
                  adminMode={true}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
