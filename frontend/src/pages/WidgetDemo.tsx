import React, { useState } from 'react';
import { RecentGenerationsWidget } from '../components';
import { useAuth } from '../contexts/AuthContext';

const WidgetDemo: React.FC = () => {
  const { user } = useAuth();
  const [demoUserId, setDemoUserId] = useState(user?.id || 'demo-user-123');
  const [showFilters, setShowFilters] = useState(true);
  const [maxItems, setMaxItems] = useState(10);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Recent Generations Widget Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            This page demonstrates the RecentGenerationsWidget component with different configurations. 
            The widget can be easily integrated into any service page to show past generations with filtering and pagination.
          </p>
        </div>

        {/* Configuration Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Widget Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                User ID
              </label>
              <input
                type="text"
                value={demoUserId}
                onChange={(e) => setDemoUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Enter user ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Show Filters
              </label>
              <select
                value={showFilters.toString()}
                onChange={(e) => setShowFilters(e.target.value === 'true')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Items Per Page
              </label>
              <select
                value={maxItems}
                onChange={(e) => setMaxItems(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        {/* Widget Examples */}
        <div className="space-y-8">
          {/* Example 1: Full Featured Widget */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Example 1: Full Featured Widget
            </h2>
            <RecentGenerationsWidget
              userId={demoUserId}
              title="Recent Generations"
              description="Complete widget with all features enabled - filters, pagination, and before/after image comparison"
              showFilters={showFilters}
              maxItems={maxItems}
            />
          </div>

          {/* Example 2: Compact Widget */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Example 2: Compact Widget (No Filters)
            </h2>
            <RecentGenerationsWidget
              userId={demoUserId}
              title="Quick View"
              description="Compact widget without filters for simple display"
              showFilters={false}
              maxItems={5}
            />
          </div>

          {/* Example 3: Custom Styled Widget */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Example 3: Custom Styled Widget
            </h2>
            <RecentGenerationsWidget
              userId={demoUserId}
              title="My Generations"
              description="Custom styled widget with different title and description"
              showFilters={true}
              maxItems={maxItems}
              className="border-2 border-blue-200 dark:border-blue-800"
            />
          </div>

          {/* Example 4: Service-Specific Widget */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Example 4: Service-Specific Widget
            </h2>
            <RecentGenerationsWidget
              userId={demoUserId}
              title="Interior Design History"
              description="Widget configured specifically for interior design service with custom styling"
              showFilters={true}
              maxItems={maxItems}
              className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20"
            />
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mt-8">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            🚀 How to Use This Widget
          </h3>
          <div className="text-blue-800 dark:text-blue-200 space-y-2">
            <p><strong>1. Import:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">import { '{ RecentGenerationsWidget }' } from '../components';</code></p>
            <p><strong>2. Basic Usage:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">&lt;RecentGenerationsWidget userId="user123" /&gt;</code></p>
            <p><strong>3. With Filters:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">&lt;RecentGenerationsWidget userId="user123" showFilters={true} /&gt;</code></p>
            <p><strong>4. Custom Pagination:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">&lt;RecentGenerationsWidget userId="user123" maxItems={20} /&gt;</code></p>
            <p><strong>5. Custom Styling:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">&lt;RecentGenerationsWidget userId="user123" className="custom-css-class" /&gt;</code></p>
          </div>
        </div>

        {/* Features List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ✨ Widget Features
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Before/After Image Comparison</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Pagination Support</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Model Type Filtering</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Status Filtering</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Date Range Filtering</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Responsive Design</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Dark Mode Support</span>
              </div>
              <div className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
                <span className="text-gray-700 dark:text-gray-300">Loading States</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetDemo;
