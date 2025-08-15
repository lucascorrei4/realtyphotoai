import React, { useState } from 'react';
import { Users as UsersIcon, Search, Filter, MoreVertical, Mail, Calendar, Activity } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'suspended';
  joinDate: string;
  lastActive: string;
  imagesProcessed: number;
  subscription: 'free' | 'pro' | 'enterprise';
}

const Users: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Mock data - replace with real API calls
  const users: User[] = [
    {
      id: '1',
      name: 'John Doe',
      email: 'john.doe@email.com',
      status: 'active',
      joinDate: '2024-01-15',
      lastActive: '2024-08-15',
      imagesProcessed: 45,
      subscription: 'pro'
    },
    {
      id: '2',
      name: 'Sarah Smith',
      email: 'sarah.smith@email.com',
      status: 'active',
      joinDate: '2024-02-20',
      lastActive: '2024-08-14',
      imagesProcessed: 128,
      subscription: 'enterprise'
    },
    {
      id: '3',
      name: 'Mike Wilson',
      email: 'mike.wilson@email.com',
      status: 'inactive',
      joinDate: '2024-03-10',
      lastActive: '2024-07-28',
      imagesProcessed: 23,
      subscription: 'free'
    },
    {
      id: '4',
      name: 'Lisa Brown',
      email: 'lisa.brown@email.com',
      status: 'active',
      joinDate: '2024-04-05',
      lastActive: '2024-08-15',
      imagesProcessed: 67,
      subscription: 'pro'
    },
    {
      id: '5',
      name: 'David Johnson',
      email: 'david.johnson@email.com',
      status: 'suspended',
      joinDate: '2024-01-30',
      lastActive: '2024-06-15',
      imagesProcessed: 12,
      subscription: 'free'
    }
  ];

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      suspended: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.inactive;
  };

  const getSubscriptionBadge = (subscription: string) => {
    const subscriptionConfig = {
      free: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      enterprise: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
    };
    return subscriptionConfig[subscription as keyof typeof subscriptionConfig] || subscriptionConfig.free;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Users
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your RealtyPhotoAI users and their accounts
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500 rounded-full">
              <UsersIcon className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-500 rounded-full">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {users.filter(u => u.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-500 rounded-full">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New This Month</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">3</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-500 rounded-full">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pro Users</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {users.filter(u => u.subscription === 'pro' || u.subscription === 'enterprise').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            User List ({filteredUsers.length} users)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Images Processed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getSubscriptionBadge(user.subscription)}`}>
                      {user.subscription}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {user.imagesProcessed}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {user.lastActive}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;
