import React, { useState, useEffect } from 'react';
import { 
  Image, 
  Clock, 
  TrendingUp, 
  Activity, 
  FileText, 
  Palette, 
  Replace, 
  Zap,
  Calendar,
  BarChart3,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Target,
  Crown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { RecentGenerationsWidget } from '../components';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface UserStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  successRate: number;
  monthlyUsage: number;
  monthlyLimit: number;
  generationsByType: {
    interiorDesign: number;
    imageEnhancement: number;
    replaceElements: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    status: string;
    timestamp: string;
    model: string;
  }>;
}

const Dashboard: React.FC = () => {
  const { user, loading, syncUserProfile, refreshUser, forceClearCacheAndRefetch } = useAuth();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserStats();
    }
  }, [user]);

  const fetchUserStats = async () => {
    if (!user?.id) return;
    
    setStatsLoading(true);
    try {
      console.log('🔍 Fetching user stats for user ID:', user.id);
      console.log('🔍 User email:', user.email);
      
      // First try to fetch by user ID
      let { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // If no generations found by ID, try by email as fallback
      if (!generations || generations.length === 0) {
        console.log('🔄 No generations found by ID, trying by email...');
        const { data: generationsByEmail, error: emailError } = await supabase
          .from('generations')
          .select('*')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false });
        
        if (generationsByEmail && !emailError) {
          generations = generationsByEmail;
          console.log('✅ Found generations by email:', generationsByEmail.length);
        }
      }

      if (error) {
        console.error('Error fetching generations:', error);
        return;
      }

      const userGenerations = generations || [];
      console.log('📊 Total generations found:', userGenerations.length);
      
      // Calculate statistics
      const totalGenerations = userGenerations.length;
      const successfulGenerations = userGenerations.filter(g => g.status === 'completed').length;
      const failedGenerations = userGenerations.filter(g => g.status === 'failed').length;
      const successRate = totalGenerations > 0 ? Math.round((successfulGenerations / totalGenerations) * 100) : 0;
      
      // Monthly usage (current month)
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyUsage = userGenerations.filter(g => 
        new Date(g.created_at) >= currentMonth
      ).length;

      // Count by model type
      const generationsByType = {
        interiorDesign: userGenerations.filter(g => g.model_type === 'interior_design').length,
        imageEnhancement: userGenerations.filter(g => g.model_type === 'image_enhancement').length,
        replaceElements: userGenerations.filter(g => g.model_type === 'element_replacement').length,
      };

      // Recent activity (last 10 generations)
      const recentActivity = userGenerations.slice(0, 10).map(g => ({
        id: g.id,
        type: g.model_type.replace('_', ' '),
        status: g.status,
        timestamp: g.created_at,
        model: g.model_type
      }));

      setUserStats({
        totalGenerations,
        successfulGenerations,
        failedGenerations,
        successRate,
        monthlyUsage,
        monthlyLimit: user.monthly_generations_limit || 0,
        generationsByType,
        recentActivity
      });
    } catch (error) {
      console.error('Error calculating user stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Mock data for charts (replace with real data when available)
  const monthlyData = [
    { month: 'Jan', generations: 12, success: 10 },
    { month: 'Feb', generations: 18, success: 16 },
    { month: 'Mar', generations: 15, success: 14 },
    { month: 'Apr', generations: 22, success: 20 },
    { month: 'May', generations: 25, success: 23 },
    { month: 'Jun', generations: 30, success: 28 },
  ];

  const usageData = [
    { name: 'Interior Design', value: userStats?.generationsByType?.interiorDesign || 0, color: '#8B5CF6' },
    { name: 'Image Enhancement', value: userStats?.generationsByType?.imageEnhancement || 0, color: '#10B981' },
    { name: 'Replace Elements', value: userStats?.generationsByType?.replaceElements || 0, color: '#F59E0B' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name || user?.email?.split('@')[0] || 'User'}! 👋
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Here's what's happening with your RealtyPhotoAI account
        </p>
      </div>

      {/* User Status Card */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Your Account Status</h2>
            <div className="space-y-1">
              <p className="text-blue-100">
                <span className="font-medium">Plan:</span> 
                <span className="ml-2 px-2 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                  {user?.subscription_plan ? user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1) : 'Free'}
                </span>
              </p>
              <p className="text-blue-100">
                <span className="font-medium">Monthly Usage:</span> 
                <span className="ml-2">
                  {userStats?.monthlyUsage || 0} / {userStats?.monthlyLimit || 0} generations
                </span>
              </p>
              <p className="text-blue-100">
                <span className="font-medium">Role:</span> 
                <span className="ml-2 px-2 py-1 bg-white bg-opacity-20 rounded-full text-sm">
                  {user?.role?.replace('_', ' ') || 'User'}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold mb-2">
              {userStats?.successRate || 0}%
            </div>
            <p className="text-blue-100">Success Rate</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-500">
              <Image className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Generations
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {userStats?.totalGenerations || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-500">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Successful
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {userStats?.successfulGenerations || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-500">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                This Month
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {userStats?.monthlyUsage || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-500">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Remaining
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {Math.max(0, (userStats?.monthlyLimit || 0) - (userStats?.monthlyUsage || 0))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Generations Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Monthly Generations</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1F2937', 
                  border: 'none', 
                  borderRadius: '8px',
                  color: '#F9FAFB'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="generations" 
                stackId="1"
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.6}
              />
              <Area 
                type="monotone" 
                dataKey="success" 
                stackId="2"
                stroke="#10B981" 
                fill="#10B981" 
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Total</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Successful</span>
            </div>
          </div>
        </div>

        {/* Usage by Type Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Usage by Service Type</h3>
          <div className="space-y-4">
            {usageData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full" 
                      style={{ 
                        width: `${Math.max(0, Math.min(100, (item.value / Math.max(...usageData.map(u => u.value), 1)) * 100))}%`,
                        backgroundColor: item.color 
                      }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-8 text-right">
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => window.location.href = '/image-enhancement'}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
          >
            <Image className="h-6 w-6 text-gray-400 group-hover:text-blue-500 mr-2 transition-colors" />
            <span className="text-gray-600 dark:text-gray-400 group-hover:text-blue-600 transition-colors">Enhance Images</span>
          </button>
          
          <button 
            onClick={() => window.location.href = '/interior-design'}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 transition-colors group"
          >
            <Palette className="h-6 w-6 text-gray-400 group-hover:text-purple-500 mr-2 transition-colors" />
            <span className="text-gray-600 dark:text-gray-400 group-hover:text-purple-600 transition-colors">Interior Design</span>
          </button>
          
          <button 
            onClick={() => window.location.href = '/replace-elements'}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-400 dark:hover:border-green-500 transition-colors group"
          >
            <Replace className="h-6 w-6 text-gray-400 group-hover:text-green-500 mr-2 transition-colors" />
            <span className="text-gray-600 dark:text-gray-400 group-hover:text-green-600 transition-colors">Replace Elements</span>
          </button>
        </div>
      </div>

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Your Recent Generations"
        description="Track your latest AI generations and their status"
        showFilters={true}
        maxItems={8}
      />

      {/* Recent Activity */}
      {userStats?.recentActivity && userStats.recentActivity.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Recent Activity
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {userStats.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-full ${
                      activity.status === 'completed' 
                        ? 'bg-green-100 dark:bg-green-900' 
                        : activity.status === 'processing'
                        ? 'bg-yellow-100 dark:bg-yellow-900'
                        : 'bg-red-100 dark:bg-red-900'
                    }`}>
                      {activity.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : activity.status === 'processing' ? (
                        <PlayCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {activity.type}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(activity.timestamp).toLocaleDateString()} at {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      activity.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        : activity.status === 'processing'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                    }`}>
                      {activity.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subscription Upgrade Prompt */}
      {user?.subscription_plan === 'free' && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">🚀 Upgrade Your Plan</h2>
              <p className="text-yellow-100 mb-4">
                Get more generations, faster processing, and access to premium features
              </p>
              <button className="bg-white text-orange-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                View Plans
              </button>
            </div>
            <Crown className="h-16 w-16 text-yellow-200" />
          </div>
        </div>
      )}

      {/* Debug Section - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">🔍 Debug Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>User ID:</strong> {user?.id}</p>
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Role:</strong> {user?.role}</p>
              <p><strong>Is Admin:</strong> {user?.role === 'admin' || user?.role === 'super_admin' ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p><strong>Plan:</strong> {user?.subscription_plan}</p>
              <p><strong>Monthly Limit:</strong> {user?.monthly_generations_limit}</p>
              <p><strong>Total Generations:</strong> {userStats?.totalGenerations || 0}</p>
              <p><strong>Success Rate:</strong> {userStats?.successRate || 0}%</p>
            </div>
          </div>
          
          {/* Debug Actions */}
          <div className="mt-4 space-y-2">
            <button
              onClick={() => {
                console.log('🔄 Manual sync triggered...');
                syncUserProfile();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              🔄 Sync User Profile
            </button>
            
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered...');
                refreshUser();
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              🔄 Refresh User
            </button>
            
            <button
              onClick={async () => {
                console.log('🔍 Checking database directly...');
                try {
                  const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('email', user?.email)
                    .single();
                  
                  if (error) {
                    console.error('❌ Database query error:', error);
                  } else {
                    console.log('✅ Database query result:', data);
                    console.log('🔍 User role in database:', data.role);
                    console.log('🔍 User ID in database:', data.id);
                    console.log('🔍 Current user ID:', user?.id);
                  }
                } catch (err) {
                  console.error('🚨 Error querying database:', err);
                }
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              🔍 Check Database
            </button>
            
            <button
              onClick={() => {
                console.log('🧹 Force clearing cache and refetching...');
                forceClearCacheAndRefetch();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              🧹 Clear Cache & Refetch
            </button>
            
            <button
              onClick={async () => {
                console.log('🔧 Force fixing admin role...');
                try {
                  // First check what's in the database
                  const { data: profileData, error: profileError } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('email', user?.email)
                    .single();
                  
                  if (profileError) {
                    console.error('❌ Error fetching profile:', profileError);
                    return;
                  }
                  
                  console.log('🔍 Current profile in database:', profileData);
                  console.log('🔍 Profile role in database:', profileData.role);
                  console.log('🔍 Current user role in state:', user?.role);
                  
                  if (profileData.role === 'admin' && user?.role !== 'admin') {
                    console.log('🔄 Role mismatch detected! Forcing profile sync...');
                    // Force update the user state with the database profile
                    const { data: { user: authUser } } = await supabase.auth.getUser();
                    if (authUser) {
                      console.log('🔄 Syncing profile for auth user:', authUser.email);
                      // This should trigger the improved createUserProfile logic
                      await syncUserProfile();
                    }
                  } else {
                    console.log('✅ Roles match or no mismatch detected');
                  }
                } catch (err) {
                  console.error('🚨 Error fixing admin role:', err);
                }
              }}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              🔧 Fix Admin Role
            </button>
          </div>
          
          {user?.role === 'admin' || user?.role === 'super_admin' ? (
            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <p className="text-green-800 dark:text-green-200">
                ✅ You have admin access! You should see the admin menu in the sidebar.
              </p>
            </div>
          ) : (
            <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200">
                ⚠️ You don't have admin access. Admin features won't be visible.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
