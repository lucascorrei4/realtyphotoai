import React, { useState, useEffect } from 'react';
import { Home, Palette, Settings, Sparkles } from 'lucide-react';
import { getBackendUrl } from '../config/api';

interface GenerationStats {
  totalRequests: number;
  completed: number;
  processing: number;
  failed: number;
  successRate: number;
  generationsByType: {
    interiorDesign: number;
    imageEnhancement: number;
    replaceElements: number;
    addFurnitures: number;
    exteriorDesign: number;
    smartEffects: number;
  };
}

interface StatsWidgetProps {
  modelType: 'interior_design' | 'image_enhancement' | 'element_replacement' | 'add_furnitures' | 'exterior_design' | 'smart_effects';
  title?: string;
  description?: string;
  userId?: string; // Optional user ID for fetching user-specific stats
}

const StatsWidget: React.FC<StatsWidgetProps> = ({ 
  modelType,
  title = "Statistics",
  description,
  userId
}) => {
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // If we have a userId, fetch user-specific stats
        if (userId) {
          const response = await fetch(`${getBackendUrl()}/api/v1/user/stats?userId=${userId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch user statistics');
          }
          const result = await response.json();
          if (result.success) {
            setStats(result.data);
          } else {
            throw new Error(result.message || 'Failed to fetch statistics');
          }
        } else {
          // For now, show placeholder stats - in a real app, you might want to show global stats
          setStats({
            totalRequests: 0,
            completed: 0,
            processing: 0,
            failed: 0,
            successRate: 0,
            generationsByType: {
              interiorDesign: 0,
              imageEnhancement: 0,
              replaceElements: 0,
              addFurnitures: 0,
              exteriorDesign: 0,
              smartEffects: 0
            }
          });
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
        
        // Check if it's a network/backend unavailable error
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch statistics';
        const isNetworkError = errorMessage.includes('Failed to fetch') || 
                              errorMessage.includes('NetworkError') ||
                              errorMessage.includes('fetch');
        
        if (isNetworkError) {
          // If it's a network error, just set stats to zero without showing error
          setStats({
            totalRequests: 0,
            completed: 0,
            processing: 0,
            failed: 0,
            successRate: 0,
            generationsByType: {
              interiorDesign: 0,
              imageEnhancement: 0,
              replaceElements: 0,
              addFurnitures: 0,
              exteriorDesign: 0,
              smartEffects: 0
            }
          });
          setError(null); // Don't show error for network issues
        } else {
          // For other errors, show the error message
          setError(errorMessage);
          // Set default stats on error
          setStats({
            totalRequests: 0,
            completed: 0,
            processing: 0,
            failed: 0,
            successRate: 0,
            generationsByType: {
              interiorDesign: 0,
              imageEnhancement: 0,
              replaceElements: 0,
              addFurnitures: 0,
              exteriorDesign: 0,
              smartEffects: 0
            }
          });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [userId, modelType]);

  if (loading) {
    return (
      <div className="space-y-3 md:space-y-4">
        {(title || description) && (
          <div>
            {title && (
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1 md:mt-2">
                {description}
              </p>
            )}
          </div>
        )}
        
        {/* Loading skeleton - Modern Horizontal Scroll */}
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-3 md:gap-4 min-w-max md:min-w-0 md:grid md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-5 border border-gray-100 dark:border-gray-700 flex-shrink-0 w-[calc(100vw-3rem)] md:w-auto">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2.5 md:p-3 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse flex-shrink-0">
                    <div className="h-5 w-5 md:h-6 md:w-6 bg-gray-400 dark:bg-gray-500 rounded"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-600 rounded w-20 md:w-24 mb-2 animate-pulse"></div>
                    <div className="h-6 md:h-7 bg-gray-300 dark:bg-gray-600 rounded w-12 md:w-16 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3 md:space-y-4">
        {(title || description) && (
          <div>
            {title && (
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
            )}
            {description && (
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1 md:mt-2">
                {description}
              </p>
            )}
          </div>
        )}
        
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 md:p-4">
          <p className="text-red-800 dark:text-red-200 text-xs md:text-sm">
            ⚠️ Unable to load statistics: {error}
          </p>
        </div>
      </div>
    );
  }

  const currentStats = stats || {
    totalRequests: 0,
    completed: 0,
    processing: 0,
    failed: 0,
    successRate: 0,
    generationsByType: {
      interiorDesign: 0,
      imageEnhancement: 0,
      replaceElements: 0,
      addFurnitures: 0,
      exteriorDesign: 0,
      smartEffects: 0
    }
  };

  // Get the count for the current model type
  const getModelTypeCount = () => {
    switch (modelType) {
      case 'interior_design':
        return currentStats.generationsByType.interiorDesign;
      case 'image_enhancement':
        return currentStats.generationsByType.imageEnhancement;
      case 'element_replacement':
        return currentStats.generationsByType.replaceElements;
      case 'add_furnitures':
        return currentStats.generationsByType.addFurnitures;
      case 'exterior_design':
        return currentStats.generationsByType.exteriorDesign;
      case 'smart_effects':
        return currentStats.generationsByType.smartEffects;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      {(title || description) && (
        <div>
          {title && (
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              {title}
            </h1>
          )}
          {description && (
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1 md:mt-2">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Stats - Modern Horizontal Scroll Layout */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex gap-3 md:gap-4 min-w-max md:min-w-0 md:grid md:grid-cols-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex-shrink-0 w-[calc(100vw-3rem)] md:w-auto">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 md:p-3 bg-blue-500 rounded-xl flex-shrink-0">
                <Home className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Requests</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {getModelTypeCount()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex-shrink-0 w-[calc(100vw-3rem)] md:w-auto">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 md:p-3 bg-green-500 rounded-xl flex-shrink-0">
                <Palette className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Completed</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {currentStats.completed}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex-shrink-0 w-[calc(100vw-3rem)] md:w-auto">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 md:p-3 bg-yellow-500 rounded-xl flex-shrink-0">
                <Settings className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Processing</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {currentStats.processing}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 md:p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex-shrink-0 w-[calc(100vw-3rem)] md:w-auto">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2.5 md:p-3 bg-purple-500 rounded-xl flex-shrink-0">
                <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Success Rate</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                  {currentStats.successRate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsWidget;

