import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  Crown, 
  BarChart3, 
  Image, 
  Settings as SettingsIcon,
  LogOut,
  Edit3,
  Save,
  X,
  CheckCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UserStats {
  total_generations: number;
  successful_generations: number;
  failed_generations: number;
  success_rate: number;
  monthly_usage: number;
  monthly_limit: number;
  model_breakdown: {
    [key: string]: number;
  };
}

const Settings: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });

  const fetchUserStats = useCallback(async () => {
    try {
      // For now, use mock data since the API endpoint might not exist
      // In a real implementation, you'd fetch from your backend
      const mockStats: UserStats = {
        total_generations: user?.total_generations || 0,
        successful_generations: user?.successful_generations || 0,
        failed_generations: user?.failed_generations || 0,
        success_rate: (user?.total_generations && user?.successful_generations) 
          ? Math.round((user.successful_generations / user.total_generations) * 100) 
          : 0,
        monthly_usage: 5, // Mock data
        monthly_limit: user?.monthly_generations_limit || 10,
        model_breakdown: {
          image_enhancement: 3,
          interior_design: 1,
          element_replacement: 1
        }
      };
      
      setStats(mockStats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchUserStats();
  }, [user, navigate, fetchUserStats]);

  const handleSaveProfile = async () => {
    try {
      // For now, just update local state
      // In a real implementation, you'd make an API call
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user) {
    return null;
  }

  const planColors = {
    free: 'bg-gray-100 text-gray-800 dark:bg-gray-100 dark:text-gray-800',
    basic: 'bg-blue-100 text-blue-800 dark:bg-blue-100 dark:text-blue-800',
    premium: 'bg-purple-100 text-purple-800 dark:bg-purple-100 dark:text-purple-800',
    enterprise: 'bg-green-100 text-green-800 dark:bg-green-100 dark:text-green-800'
  };

  const modelColors = {
    image_enhancement: '#3B82F6',
    interior_design: '#8B5CF6',
    element_replacement: '#10B981'
  };

  const modelBreakdownData = stats?.model_breakdown ? 
    Object.entries(stats.model_breakdown).map(([model, count]) => ({
      name: model.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      color: modelColors[model as keyof typeof modelColors] || '#6B7280'
    })) : [];

  const monthlyUsageData = [
    { name: 'Used', value: stats?.monthly_usage || 0, color: '#3B82F6' },
    { name: 'Remaining', value: (stats?.monthly_limit || 0) - (stats?.monthly_usage || 0), color: '#E5E7EB' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your account and view usage statistics</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <LogOut className="h-5 w-5" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Section */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Profile</h2>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                >
                  <Edit3 className="h-4 w-4" />
                  <span>Edit</span>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveProfile}
                    className="flex items-center space-x-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditForm({ name: user?.name || '', phone: user?.phone || '' });
                    }}
                    className="flex items-center space-x-2 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                {editing ? (
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter your name"
                  />
                ) : (
                  <span className="text-gray-900 dark:text-white">{user.name || 'Not set'}</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <span className="text-gray-900 dark:text-white">{user.email}</span>
              </div>

              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                {editing ? (
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <span className="text-gray-900 dark:text-white">{user.phone || 'Not set'}</span>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <Crown className="h-5 w-5 text-gray-400" />
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${planColors[user.subscription_plan]}`}>
                  {user.subscription_plan.charAt(0).toUpperCase() + user.subscription_plan.slice(1)} Plan
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Usage Statistics</h2>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Generations</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-white">{stats.total_generations}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">Success Rate</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-white">{stats.success_rate}%</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Image className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Monthly Usage</p>
                        <p className="text-2xl font-bold text-purple-900 dark:text-white">{stats.monthly_usage}/{stats.monthly_limit}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <SettingsIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      <div>
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Remaining</p>
                        <p className="text-2xl font-bold text-orange-900 dark:text-white">{stats.monthly_limit - stats.monthly_usage}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Monthly Usage Chart */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Monthly Usage</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={monthlyUsageData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {monthlyUsageData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center space-x-4 mt-2">
                      {monthlyUsageData.map((entry, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{entry.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Model Breakdown Chart */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Model Usage</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={modelBreakdownData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p>No statistics available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
