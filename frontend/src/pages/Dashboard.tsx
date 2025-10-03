import React, { useState, useEffect } from 'react';
import {
  Image,
  Clock,
  CheckCircle,
  AlertCircle,
  PlayCircle,
  Target,
  Crown
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { RecentGenerationsWidget, QuickActions } from '../components';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';


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
    addFurnitures: number;
    exteriorDesign: number;
    generalFurniture: number;
  };
  monthlyData: Array<{
    month: string;
    generations: number;
    success: number;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    status: string;
    timestamp: string;
    model: string;
  }>;
}

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
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
      // First try to fetch by user ID
      let { data: generations, error } = await supabase
        .from('generations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // If no generations found by ID, try by email as fallback
      if (!generations || generations.length === 0) {
        const { data: generationsByEmail, error: emailError } = await supabase
          .from('generations')
          .select('*')
          .eq('user_email', user.email)
          .order('created_at', { ascending: false });

        if (generationsByEmail && !emailError) {
          generations = generationsByEmail;
        }
      }

      if (error) {
        console.error('Error fetching generations:', error);
        return;
      }

      const userGenerations = generations || [];
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
        addFurnitures: userGenerations.filter(g => g.model_type === 'add_furnitures').length,
        exteriorDesign: userGenerations.filter(g => g.model_type === 'exterior_design').length,
        generalFurniture: userGenerations.filter(g => g.model_type === 'general_furniture').length,
      };

      // Calculate monthly data for the last 6 months
      const monthlyData = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        const monthGenerations = userGenerations.filter(g => {
          const generationDate = new Date(g.created_at);
          return generationDate >= monthStart && generationDate <= monthEnd;
        });
        
        const monthSuccess = monthGenerations.filter(g => g.status === 'completed').length;
        
        monthlyData.push({
          month: monthNames[date.getMonth()],
          generations: monthGenerations.length,
          success: monthSuccess
        });
      }

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
        monthlyData,
        recentActivity
      });
    } catch (error) {
      console.error('Error calculating user stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };



  const usageData = [
    { name: 'Interior Design', value: userStats?.generationsByType?.interiorDesign || 0, color: '#8B5CF6' },
    { name: 'Image Enhancement', value: userStats?.generationsByType?.imageEnhancement || 0, color: '#10B981' },
    { name: 'Replace Elements', value: userStats?.generationsByType?.replaceElements || 0, color: '#F59E0B' },
    { name: 'Add Furnitures', value: userStats?.generationsByType?.addFurnitures || 0, color: '#10B981' },
    { name: 'Exterior Design', value: userStats?.generationsByType?.exteriorDesign || 0, color: '#F59E0B' },
    { name: 'General Furniture', value: userStats?.generationsByType?.generalFurniture || 0, color: '#10B981' },
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
          Here's what's happening with your RealVisionAI account
        </p>
      </div>

      {/* Subscription Upgrade Prompt */}
      {user?.subscription_plan === 'free' && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
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
          {statsLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Loading chart data...</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={userStats?.monthlyData || []}>
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
            </>
          )}
        </div>

        {/* Usage by Type Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Usage by Service Type</h3>
          {statsLoading ? (
            <div className="flex items-center justify-center h-[200px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Loading usage data...</p>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions />

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
                    <div className={`p-2 rounded-full ${activity.status === 'completed'
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
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activity.status === 'completed'
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



    </div>
  );
};

export default Dashboard;
