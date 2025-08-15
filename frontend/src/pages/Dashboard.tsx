import React from 'react';
import { Users, Image, Clock, TrendingUp, Activity, FileText } from 'lucide-react';

const Dashboard: React.FC = () => {
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
