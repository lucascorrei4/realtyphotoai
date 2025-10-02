import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter, Calendar, Image, RefreshCw, Camera, Palette, Wand2, Maximize2, Download, Share2, X } from 'lucide-react';
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
  refreshTrigger?: number; // Trigger to refresh the widget
}

const RecentGenerationsWidget: React.FC<RecentGenerationsWidgetProps> = ({
  userId,
  title = "Recent Generations",
  description = "View your past AI generations with before/after comparisons",
  showFilters = true,
  maxItems = 10,
  className = "",
  modelTypeFilter = "all",
  refreshTrigger
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

  // Watch for refresh trigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchGenerations();
    }
  }, [refreshTrigger]);

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

  const getModelTypeIcon = (modelType: string) => {
    switch (modelType) {
      case 'interior_design':
        return <Palette className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
      case 'image_enhancement':
        return <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
      case 'element_replacement':
        return <Wand2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
      default:
        return <Image className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
    }
  };

  const getModelTypeIconBg = (modelType: string) => {
    switch (modelType) {
      case 'interior_design':
        return 'from-purple-500 to-purple-600';
      case 'image_enhancement':
        return 'from-blue-500 to-blue-600';
      case 'element_replacement':
        return 'from-green-500 to-green-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  // Lightbox Modal Component with Before/After Comparison
  const LightboxModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    imageSrc: string;
    alt: string;
    beforeImageSrc?: string;
    showComparison: boolean;
    setShowComparison: (show: boolean) => void;
  }> = ({ isOpen, onClose, imageSrc, alt, beforeImageSrc, showComparison, setShowComparison }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);

    if (!isOpen) return null;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSliderPosition(parseInt(e.target.value));
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      setSliderPosition(Math.max(0, Math.min(100, percentage)));
    };

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 group"
          >
            <X className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>

          {/* Comparison Mode Toggle */}
          {beforeImageSrc && (
            <button
              onClick={() => setShowComparison(!showComparison)}
              className="absolute top-4 left-4 z-10 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white transition-all duration-200 group text-sm"
            >
              {showComparison ? 'Single View' : 'Compare View'}
            </button>
          )}
          
          {/* Image Display */}
          {showComparison && beforeImageSrc ? (
            <div className="relative w-full h-full max-w-5xl max-h-[80vh]">
              {/* Before Image (Background) */}
              <img
                src={beforeImageSrc}
                alt="Before"
                className="absolute inset-0 w-full h-full object-contain rounded-lg shadow-2xl"
              />
              
              {/* After Image (Overlay with clip-path) */}
              <div 
                className="absolute inset-0 w-full h-full overflow-hidden rounded-lg"
                style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
              >
                <img
                  src={imageSrc}
                  alt="After"
                  className="w-full h-full object-contain"
                />
              </div>
              
              {/* Slider Line */}
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg z-10"
                style={{ left: `${sliderPosition}%` }}
              >
                {/* Slider Handle */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing">
                  <div className="w-1 h-6 bg-gray-400 rounded"></div>
                </div>
              </div>
              
              {/* Slider Input (Invisible but functional) */}
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={handleSliderChange}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setIsDragging(false)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-grab active:cursor-grabbing z-20"
              />
              
              {/* Labels */}
              <div className="absolute top-4 left-4 bg-red-500/80 text-white px-3 py-1 rounded-full text-sm font-medium">
                Before
              </div>
              <div className="absolute top-4 right-4 bg-green-500/80 text-white px-3 py-1 rounded-full text-sm font-medium">
                After
              </div>
              
              {/* Instructions */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-lg text-sm">
                Drag to compare • {Math.round(sliderPosition)}%
              </div>
            </div>
          ) : (
            /* Single Image View */
            <img
              src={imageSrc}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
          )}
          
          {/* Background click to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={onClose}
          />
        </div>
      </div>
    );
  };

  const ImageWithLoading: React.FC<{
    src: string;
    alt: string;
    label: string;
    labelColor: string;
    onError?: (error: any) => void;
    showActions?: boolean;
    beforeImageSrc?: string;
  }> = ({ src, alt, label, labelColor, onError, showActions = false, beforeImageSrc }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showLightbox, setShowLightbox] = useState(false);
    const [showComparison, setShowComparison] = useState(true);


    const handleLoad = () => {
      setLoading(false);
    };

    const handleError = (e: any) => {
      setLoading(false);
      setError(true);
      if (onError) onError(e);
    };

    const handleMaximize = () => {
      setShowLightbox(true);
    };

    const handleDownload = async () => {
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `image-${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Failed to download image:', error);
      }
    };

    const handleShare = async () => {
      try {
        if (navigator.share) {
          // Use Web Share API if available
          await navigator.share({
            title: 'AI Enhanced Image',
            text: 'Check out this AI-enhanced image!',
            url: src
          });
        } else {
          // Fallback: copy URL to clipboard
          await navigator.clipboard.writeText(src);
          console.log('Image URL copied to clipboard');
          // You could add a toast notification here
        }
      } catch (error) {
        console.error('Failed to share image:', error);
        // Fallback: copy URL to clipboard
        try {
          await navigator.clipboard.writeText(src);
          console.log('Image URL copied to clipboard as fallback');
        } catch (fallbackError) {
          console.error('Failed to copy URL to clipboard:', fallbackError);
        }
      }
    };

    return (
      <div className="relative group">
        <img
          src={src}
          alt={alt}
          className="w-full h-40 sm:h-48 lg:h-56 object-cover rounded-lg shadow-md group-hover:shadow-lg transition-shadow"
          onLoad={handleLoad}
          onError={handleError}
        />
        <div className={`absolute top-2 left-2 ${labelColor} text-white px-2 py-1 rounded text-xs font-medium`}>
          {label}
        </div>

        {/* Modern Floating Action Buttons - only show on "After" images */}
        {showActions && !loading && !error && (
          <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex flex-row space-x-3 z-50">
            <button
              onClick={handleMaximize}
              className="group w-10 h-10 bg-white/90 hover:bg-white backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20"
              title="View full size"
            >
              <Maximize2 className="h-4 w-4 text-gray-700 group-hover:text-gray-900 transition-colors" />
            </button>
            <button
              onClick={handleDownload}
              className="group w-10 h-10 bg-white/90 hover:bg-white backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20"
              title="Download image"
            >
              <Download className="h-4 w-4 text-gray-700 group-hover:text-gray-900 transition-colors" />
            </button>
            <button
              onClick={handleShare}
              className="group w-10 h-10 bg-white/90 hover:bg-white backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20"
              title="Share image"
            >
              <Share2 className="h-4 w-4 text-gray-700 group-hover:text-gray-900 transition-colors" />
            </button>
          </div>
        )}

        {/* Lightbox Modal */}
        <LightboxModal
          isOpen={showLightbox}
          onClose={() => setShowLightbox(false)}
          imageSrc={src}
          alt={alt}
          beforeImageSrc={beforeImageSrc}
          showComparison={showComparison}
          setShowComparison={setShowComparison}
        />

        {loading && (
          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 dark:border-gray-400"></div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <span className="text-xs text-gray-500 dark:text-gray-400 text-center px-2">Image failed to load</span>
          </div>
        )}
      </div>
    );
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
    const getAbsoluteUrl = (path: string | undefined) => {
      if (!path || path.trim() === '') return '';
      if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
      }
      // Remove leading slash if present to avoid double slashes
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      const fullUrl = `${getBackendUrl()}/${cleanPath}`;
      return fullUrl;
    };

    const inputImageUrl = getAbsoluteUrl(generation.input_image_url);
    const outputImageUrl = getAbsoluteUrl(generation.output_image_url);

    return (
      <div className="space-y-4">
        {/* Before Image */}
        {inputImageUrl ? (
          <ImageWithLoading
            src={inputImageUrl}
            alt="Before"
            label="Before"
            labelColor="bg-red-500"
          />
        ) : (
          <div className="w-full h-40 sm:h-48 lg:h-56 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">No input image</span>
          </div>
        )}

        {/* After Image */}
        {outputImageUrl ? (
          <ImageWithLoading
            src={outputImageUrl}
            alt="After"
            label="After"
            labelColor="bg-green-500"
            showActions={true}
            beforeImageSrc={inputImageUrl}
          />
        ) : (
          <div className="w-full h-40 sm:h-48 lg:h-56 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">No output image</span>
          </div>
        )}
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
          <div className="flex items-center space-x-3 mb-2">
            <div className={`w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-r ${getModelTypeIconBg(modelTypeFilter)} rounded-lg flex items-center justify-center`}>
              {getModelTypeIcon(modelTypeFilter)}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {title}
              {description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
              )}
            </h3>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
            {generations.map((generation) => (
              <div key={generation.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
                {/* Header Section */}
                <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(generation.status)}`}>
                        {generation.status}
                      </span>
                      {generation.processing_time_ms && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {generation.processing_time_ms}ms
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(generation.created_at)}
                    </span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-4">

                  {/* Prompt 
                {generation.prompt && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">PROMPT</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded">
                      {generation.prompt}
                    </p>
                  </div>
                )}
                  */}

                  {/* Image Comparison */}
                  {renderImageComparison(generation)}

                  {/* Error Message */}
                  {generation.error_message && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        Error: {generation.error_message}
                      </p>
                    </div>
                  )}
                </div>
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
