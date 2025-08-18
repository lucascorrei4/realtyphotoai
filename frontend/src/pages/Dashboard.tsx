import React from 'react';
import { Users, Image, Clock, TrendingUp, Activity, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { RecentGenerationsWidget } from '../components';

const Dashboard: React.FC = () => {
  const { user, loading, debugSession, forceClearLoading, forceSignOut, refreshSupabaseClient, createUserFromLocalStorage, bypassSupabaseAndUseLocalStorage } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Loading dashboard...</p>
          
          {/* Debug buttons */}
          <div className="space-y-2">
            <button
              onClick={() => {
                console.log('🔍 Manual session check triggered...');
                debugSession();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
            >
              Debug Session
            </button>
            
            <button
              onClick={() => {
                console.log('🧹 Force clearing loading state...');
                forceClearLoading();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              Force Clear Loading
            </button>
            
            <button
              onClick={() => {
                console.log('🔄 Refreshing Supabase client...');
                refreshSupabaseClient();
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              Refresh Client
            </button>
            
            <button
              onClick={async () => {
                console.log('💾 Creating user from localStorage...');
                const success = await createUserFromLocalStorage();
                if (success) {
                  console.log('✅ User created from localStorage successfully!');
                } else {
                  console.log('❌ Failed to create user from localStorage');
                }
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              Use LocalStorage
            </button>
            
            <button
              onClick={async () => {
                console.log('🚀 Bypassing Supabase entirely...');
                const success = await bypassSupabaseAndUseLocalStorage();
                if (success) {
                  console.log('✅ Successfully bypassed Supabase!');
                } else {
                  console.log('❌ Failed to bypass Supabase');
                }
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              Bypass Supabase
            </button>
            
            <button
              onClick={() => {
                console.log('🚪 Force logout...');
                forceSignOut();
              }}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition-colors ml-2"
            >
              Force Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mock data - replace with real API calls
  const stats = [
    {
      title: 'Total Users',
      value: '1,247',
      change: '+12%',
      changeType: 'positive',
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Images Processed',
      value: '8,934',
      change: '+23%',
      changeType: 'positive',
      icon: Image,
      color: 'bg-green-500'
    },
    {
      title: 'Avg Processing Time',
      value: '1.8s',
      change: '-15%',
      changeType: 'positive',
      icon: Clock,
      color: 'bg-yellow-500'
    },
    {
      title: 'Success Rate',
      value: '99.2%',
      change: '+0.5%',
      changeType: 'positive',
      icon: TrendingUp,
      color: 'bg-purple-500'
    }
  ];

  const recentActivity = [
    {
      id: 1,
      user: 'john.doe@email.com',
      action: 'Enhanced 5 images',
      time: '2 minutes ago',
      status: 'completed'
    },
    {
      id: 2,
      user: 'sarah.smith@email.com',
      action: 'Interior design request',
      time: '5 minutes ago',
      status: 'processing'
    },
    {
      id: 3,
      user: 'mike.wilson@email.com',
      action: 'Replaced elements in 3 images',
      time: '12 minutes ago',
      status: 'completed'
    },
    {
      id: 4,
      user: 'lisa.brown@email.com',
      action: 'Enhanced 12 images',
      time: '18 minutes ago',
      status: 'completed'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Welcome to your RealtyPhotoAI admin dashboard
        </p>
      </div>

      {/* Role Check and Admin Promotion */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Current User Status</h2>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Email:</span> {user?.email}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Role:</span> 
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  user?.role === 'super_admin' 
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                    : user?.role === 'admin'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                }`}>
                  {user?.role?.replace('_', ' ') || 'Unknown'}
                </span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Plan:</span> {user?.subscription_plan}
              </p>
            </div>
          </div>
          
          {/* Admin Promotion Button */}
          {user && user.role !== 'admin' && user.role !== 'super_admin' && (
            <div className="text-right">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                You need admin privileges to access admin features
              </p>
              <button
                onClick={async () => {
                  try {
                    console.log('🔧 Promoting user to admin...');
                    console.log('User ID:', user.id);
                    console.log('Current role:', user.role);
                    console.log('Target role: admin');
                    
                    // Update user role directly in Supabase
                    const { error } = await supabase
                      .from('user_profiles')
                      .update({ role: 'admin' })
                      .eq('id', user.id);
                    
                    if (error) {
                      console.error('❌ Error promoting to admin:', error);
                      alert('Failed to promote to admin: ' + error.message);
                    } else {
                      console.log('✅ Successfully promoted to admin!');
                      alert('Successfully promoted to admin! Please refresh the page to see the admin menu.');
                      // Refresh the page to show the updated role
                      window.location.reload();
                    }
                  } catch (error) {
                    console.error('Error promoting to admin:', error);
                    alert('Failed to promote to admin. Check console for details.');
                  }
                }}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm transition-colors"
              >
                🚀 Promote to Admin
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin Features Preview */}
      {user && user.role !== 'admin' && user.role !== 'super_admin' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h2 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-4">
            🔐 Admin Features (Available after promotion)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">👥 User Management</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• View all platform users</li>
                <li>• Manage user roles and permissions</li>
                <li>• Monitor user activity and usage</li>
                <li>• Update subscription plans</li>
              </ul>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📊 Admin Dashboard</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Platform-wide statistics</li>
                <li>• Total generations across all users</li>
                <li>• Success rates and performance metrics</li>
                <li>• System health monitoring</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${stat.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {stat.value}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <span className={`text-sm font-medium ${
                  stat.changeType === 'positive' 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {stat.change}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400 ml-1">
                  from last month
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Recent Activity
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.user}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {activity.action}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {activity.time}
                  </p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    activity.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Recent Generations"
        description="View your latest AI generations with before/after comparisons across all services"
        showFilters={true}
        maxItems={10}
      />

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
            <FileText className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Generate Report</span>
          </button>
          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
            <Users className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">Manage Users</span>
          </button>
          <button className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
            <Image className="h-6 w-6 text-gray-400 mr-2" />
            <span className="text-gray-600 dark:text-gray-400">View Images</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
