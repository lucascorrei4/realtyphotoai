import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, Calendar, Image, RefreshCw } from 'lucide-react';
import { getBackendUrl } from '../config/api';

export interface Generation {
  id: string;
  model_type: string;
  status: string;
  created_at: string;
  input_image_url?: string;
  output_image_url?: string;
  prompt?: string;
  error_message?: string;
  processing_time_ms?: number;
}

export interface RecentGenerationsWidgetProps {
  userId?: string;
  title?: string;
  description?: string;
  showFilters?: boolean;
  maxItems?: number;
  className?: string;
  modelTypeFilter?: string; // Pre-filter by specific model type
}

const RecentGenerationsWidget: React.FC<RecentGenerationsWidgetProps> = ({
  userId,
  title = "Recent Generations",
  description = "View your past AI generations with before/after comparisons",
  showFilters = true,
  maxItems = 10,
  className = "",
  modelTypeFilter
}) => {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    modelType: modelTypeFilter || 'all',
    dateFrom: '',
    dateTo: '',
    status: 'all'
  });

  const itemsPerPage = maxItems;

  useEffect(() => {
    fetchGenerations();
  }, [userId, currentPage, filters]);

  const fetchGenerations = async () => {
    if (!userId) {
      setGenerations([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        userId,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(filters.modelType !== 'all' && { modelType: filters.modelType }),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });

      // If modelTypeFilter is provided, always use it
      if (modelTypeFilter) {
        params.set('modelType', modelTypeFilter);
      }

      const response = await fetch(`${getBackendUrl()}/api/v1/user/generations?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch generations');
      }

      const result = await response.json();
      
      if (result.success) {
        setGenerations(result.data.generations || []);
        setTotalPages(result.data.totalPages || 1);
        setTotalCount(result.data.totalCount || 0);
      } else {
        throw new Error(result.message || 'Failed to fetch generations');
      }
    } catch (err) {
      console.error('Error fetching generations:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch generations';
      setError(errorMessage);
      setGenerations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getModelTypeLabel = (modelType: string) => {
    switch (modelType) {
      case 'interior_design':
        return 'Interior Design';
      case 'image_enhancement':
        return 'Image Enhancement';
      case 'element_replacement':
        return 'Element Replacement';
      default:
        return modelType;
    }
  };

  const renderImageComparison = (generation: Generation) => {
    if (!generation.input_image_url && !generation.output_image_url) {
      return (
        <div className="flex items-center justify-center h-32 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Image className="h-8 w-8 text-gray-400" />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">No images available</span>
        </div>
      );
    }

    // Helper function to construct absolute URLs
    const getAbsoluteUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      // Remove leading slash if present to avoid double slashes
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const fullUrl = `${getBackendUrl()}/${cleanPath}`;
      return fullUrl;
    };

    return (
      <div className="grid grid-cols-2 gap-4">
        {/* Before Image */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">BEFORE</h4>
          {generation.input_image_url ? (
            <div className="relative">
              <img
                src={getAbsoluteUrl(generation.input_image_url)}
                alt="Before"
                className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                onLoad={(e) => {
                  // Hide loading indicator
                  const loadingIndicator = e.currentTarget.nextElementSibling;
                  if (loadingIndicator) {
                    loadingIndicator.classList.add('hidden');
                  }
                }}
                onError={(e) => {
                  console.error('Failed to load input image:', generation.input_image_url);
                  // Hide loading indicator and show error
                  const loadingIndicator = e.currentTarget.nextElementSibling;
                  const errorIndicator = loadingIndicator?.nextElementSibling;
                  if (loadingIndicator) {
                    loadingIndicator.classList.add('hidden');
                  }
                  if (errorIndicator) {
                    errorIndicator.classList.remove('hidden');
                  }
                }}
              />
              {/* Loading indicator */}
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400"></div>
              </div>
              {/* Fallback for failed images */}
              <div className="hidden absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">Image failed to load</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">No input image</span>
            </div>
          )}
        </div>

        {/* After Image */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">AFTER</h4>
          {generation.output_image_url ? (
            <div className="relative">
              <img
                src={getAbsoluteUrl(generation.output_image_url)}
                alt="After"
                className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                onLoad={(e) => {
                  // Hide loading indicator
                  const loadingIndicator = e.currentTarget.nextElementSibling;
                  if (loadingIndicator) {
                    loadingIndicator.classList.add('hidden');
                  }
                }}
                onError={(e) => {
                  console.error('Failed to load output image:', generation.output_image_url);
                  // Hide loading indicator and show error
                  const loadingIndicator = e.currentTarget.nextElementSibling;
                  const errorIndicator = loadingIndicator?.nextElementSibling;
                  if (loadingIndicator) {
                    loadingIndicator.classList.add('hidden');
                  }
                  if (errorIndicator) {
                    errorIndicator.classList.remove('hidden');
                  }
                }}
              />
              {/* Loading indicator */}
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400"></div>
              </div>
              {/* Fallback for failed images */}
              <div className="hidden absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">Image failed to load</span>
              </div>
            </div>
          ) : (
            <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <span className="text-xs text-gray-500 dark:text-gray-400">No output image</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && generations.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
              {description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
              )}
            </div>
          </div>
          
          {/* Loading skeleton */}
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-2"></div>
                <div className="h-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
            )}
          </div>
          
          <button
            onClick={fetchGenerations}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                <Filter className="h-4 w-4 mr-1" />
                Model Type
              </label>
              <select
                value={filters.modelType}
                onChange={(e) => handleFilterChange('modelType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Types</option>
                <option value="interior_design">Interior Design</option>
                <option value="image_enhancement">Image Enhancement</option>
                <option value="element_replacement">Element Replacement</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200 text-sm">
              ⚠️ {error}
            </p>
          </div>
        )}

        {/* Generations List */}
        {generations.length > 0 ? (
          <div className="space-y-6">
            {generations.map((generation) => (
              <div key={generation.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {/* Generation Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(generation.status)}`}>
                      {generation.status}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {getModelTypeLabel(generation.model_type)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(generation.created_at)}
                  </span>
                </div>

                {/* Prompt */}
                {generation.prompt && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PROMPT</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded">
                      {generation.prompt}
                    </p>
                  </div>
                )}

                {/* Image Comparison */}
                {renderImageComparison(generation)}

                {/* Processing Info */}
                {generation.processing_time_ms && (
                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    Processing time: {generation.processing_time_ms}ms
                  </div>
                )}

                {/* Error Message */}
                {generation.error_message && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      Error: {generation.error_message}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {userId ? 'No generations found' : 'Please provide a user ID to view generations'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} results
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentGenerationsWidget;
