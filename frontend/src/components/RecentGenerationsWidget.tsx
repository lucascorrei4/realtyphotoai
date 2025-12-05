import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Filter, Calendar, Image, RefreshCw, Camera, Palette, Wand2, Sofa, Building2, Maximize2, Download, Share2, X, Video, Play, Loader2, Trash2 } from 'lucide-react';
import { getBackendUrl } from '../config/api';
import { supabase } from '../config/supabase';
import { authenticatedFetch } from '../utils/apiUtils';
import { useToast } from '../hooks/useToast';
import CameraMovementModal, { CameraMovementOption } from './CameraMovementModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { useVideoGenerationQueue } from '../hooks/useVideoGenerationQueue';
import { useCredits } from '../contexts/CreditContext';
import { getVideo6sCredits } from '../config/subscriptionPlans';

export interface Generation {
  id: string;
  model_type: string;
  status: string;
  created_at: string;
  input_image_url?: string;
  output_image_url?: string;
  output_video_url?: string; // For video outputs
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
  const [videoGenerating, setVideoGenerating] = useState<Record<string, 'veo3_fast' | null>>({});
  const [pollingIntervals, setPollingIntervals] = useState<Record<string, NodeJS.Timeout>>({});
  const [cameraMovementModal, setCameraMovementModal] = useState<{ isOpen: boolean; generationId: string; imageUrl: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; generationId: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const generalPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { showSuccess, showError, showWarning, showInfo, updateToast, dismiss } = useToast();
  const { canStartGeneration, getProcessingCount, addToQueue, updateQueueItem, removeFromQueue } = useVideoGenerationQueue();
  const { creditBalance } = useCredits();

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

  // General polling for any processing generations
  useEffect(() => {
    // Check if there are any processing generations
    const hasProcessingGenerations = generations.some(
      g => g.status === 'processing' || g.status === 'pending'
    );

    // If there are processing generations, start polling
    if (hasProcessingGenerations && !generalPollIntervalRef.current) {
      const interval = setInterval(() => {
        fetchGenerations();
      }, 8000); // Poll every 8 seconds for general generations

      generalPollIntervalRef.current = interval;
    }

    // Clean up interval when no processing generations
    if (!hasProcessingGenerations && generalPollIntervalRef.current) {
      clearInterval(generalPollIntervalRef.current);
      generalPollIntervalRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (generalPollIntervalRef.current) {
        clearInterval(generalPollIntervalRef.current);
        generalPollIntervalRef.current = null;
      }
    };
  }, [generations]);

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
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });

      // Handle modelType filter: use modelTypeFilter if explicitly provided (and not 'all'), 
      // otherwise use the user's filter selection
      const effectiveModelType = (modelTypeFilter && modelTypeFilter !== 'all')
        ? modelTypeFilter
        : filters.modelType;

      if (effectiveModelType !== 'all') {
        params.set('modelType', effectiveModelType);
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
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTimeOnly = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Check if output is a video
  const isVideoOutput = (generation: Generation): boolean => {
    if (generation.model_type?.startsWith('video_')) {
      return true;
    }
    const outputUrl = generation.output_image_url || generation.output_video_url;
    if (outputUrl) {
      return outputUrl.toLowerCase().endsWith('.mp4') ||
        outputUrl.toLowerCase().endsWith('.webm') ||
        outputUrl.toLowerCase().endsWith('.mov');
    }
    return false;
  };

  // Get video URL from generation
  const getVideoUrl = (generation: Generation): string | null => {
    const outputUrl = generation.output_image_url || generation.output_video_url;
    if (!outputUrl) return null;

    if (outputUrl.startsWith('http://') || outputUrl.startsWith('https://')) {
      return outputUrl;
    }
    const cleanPath = outputUrl.startsWith('/') ? outputUrl.slice(1) : outputUrl;
    return `${getBackendUrl()}/${cleanPath}`;
  };

  // Poll for video generation completion
  const pollVideoGeneration = (videoGenerationId: string, toastId: string, queueItemId?: string, videoTypeKey?: string) => {
    let pollAttempts = 0;
    const maxAttempts = 36; // 36 * 5 seconds = 3 minutes max

    const pollInterval = setInterval(async () => {
      pollAttempts++;

      // Stop polling after max attempts
      if (pollAttempts > maxAttempts) {
        clearInterval(pollInterval);
        setPollingIntervals(prev => {
          const newState = { ...prev };
          delete newState[videoGenerationId];
          return newState;
        });
        updateToast(toastId, 'Video generation is taking longer than expected. Please check back in a moment.', 'warning');
        return;
      }

      try {
        const response = await authenticatedFetch(`/api/v1/user/generations?userId=${userId}&limit=100`);

        if (!response.ok) {
          console.error('Polling error: Response not OK', response.status, response.statusText);
          return; // Continue polling on error
        }

        const result = await response.json();

        if (result.success && result.data?.generations) {
          const videoGen = result.data.generations.find((g: Generation) => g.id === videoGenerationId);

          if (videoGen) {
            if (videoGen.status === 'completed') {
              // Clear polling interval
              clearInterval(pollInterval);
              setPollingIntervals(prev => {
                const newState = { ...prev };
                delete newState[videoGenerationId];
                return newState;
              });

              // Clear the video generating state
              if (videoTypeKey) {
                setVideoGenerating(prev => {
                  const newState = { ...prev };
                  delete newState[videoTypeKey];
                  return newState;
                });
              }

              // Update queue status to completed and remove after a delay
              if (queueItemId) {
                updateQueueItem(queueItemId, { status: 'completed' });
                // Auto-remove from queue after 5 seconds
                setTimeout(() => {
                  removeFromQueue(queueItemId);
                }, 5000);
              }

              // Update toast to success with action
              updateToast(toastId, '🎬 Video generated successfully! Scroll down to view it.', 'success');

              // Refresh generations to show the new video
              fetchGenerations();

              // Scroll to the video after a short delay
              setTimeout(() => {
                const videoElement = document.querySelector(`[data-generation-id="${videoGenerationId}"]`);
                if (videoElement) {
                  videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Highlight the video card briefly
                  videoElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');
                  setTimeout(() => {
                    videoElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
                  }, 3000);
                }
              }, 500);

              // Auto-dismiss after 8 seconds (give user time to see the message)
              setTimeout(() => {
                dismiss(toastId);
              }, 8000);
            } else if (videoGen.status === 'failed') {
              // Clear polling interval
              clearInterval(pollInterval);
              setPollingIntervals(prev => {
                const newState = { ...prev };
                delete newState[videoGenerationId];
                return newState;
              });

              // Clear the video generating state
              if (videoTypeKey) {
                setVideoGenerating(prev => {
                  const newState = { ...prev };
                  delete newState[videoTypeKey];
                  return newState;
                });
              }

              // Update queue status to failed
              if (queueItemId) {
                updateQueueItem(queueItemId, {
                  status: 'failed',
                  error: videoGen.error_message || 'Unknown error'
                });
              }

              updateToast(toastId, `Video generation failed: ${videoGen.error_message || 'Unknown error'}`, 'error');
            }
            // If status is 'processing', continue polling
          } else {
            // Generation not found yet, continue polling (might not be in the first page)
          }
        } else {
          console.error('Polling error: Unexpected response format', result);
        }
      } catch (error) {
        console.error('Error polling video generation:', error);
        // Continue polling on error (might be transient)
      }
    }, 5000); // Poll every 5 seconds

    // Store interval for cleanup
    setPollingIntervals(prev => ({ ...prev, [videoGenerationId]: pollInterval }));
  };

  // Open delete confirmation modal
  const handleDeleteClick = (generationId: string) => {
    setDeleteModal({ isOpen: true, generationId });
  };

  // Delete generation (soft delete)
  const handleDeleteGeneration = async () => {
    if (!deleteModal?.generationId) return;

    const generationIdToDelete = deleteModal.generationId;
    setIsDeleting(true);

    try {
      const response = await authenticatedFetch(`/api/v1/user/generations/${generationIdToDelete}?userId=${userId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        showSuccess('Generation deleted successfully');
        // Close modal
        setDeleteModal(null);

        // Optimistically remove the item from local state for immediate UI update
        setGenerations(prev => prev.filter(g => g.id !== generationIdToDelete));
        setTotalCount(prev => Math.max(0, prev - 1));

        // Refresh the list after a short delay to ensure backend has processed and get accurate counts
        // This ensures pagination and total counts are correct
        setTimeout(() => {
          fetchGenerations();
        }, 500);
      } else {
        // If deletion failed, show error
        showError(result.message || 'Failed to delete generation');
      }
    } catch (error) {
      console.error('Error deleting generation:', error);
      showError('Failed to delete generation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Close delete modal
  const handleCloseDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModal(null);
    }
  };

  // Generate video from image
  const handleGenerateVideo = async (
    generationId: string,
    imageUrl: string,
    motionType: 'veo3_fast',
    cameraMovement?: string
  ) => {
    if (!imageUrl) {
      showWarning('No image URL available for video generation');
      return;
    }

    // Check if user has enough credits before processing
    const creditsNeeded = getVideo6sCredits(); // 240 credits per 6s video
    if (creditBalance && creditBalance.displayCreditsRemaining < creditsNeeded) {
      showError(
        `Insufficient credits! You need more credits. Please upgrade your plan.`
      );
      return;
    }

    // Check concurrent limit (3 max)
    if (!canStartGeneration()) {
      const processingCount = getProcessingCount();
      showWarning(
        `You can only generate 3 videos at a time. Please wait for ${processingCount} video${processingCount > 1 ? 's' : ''} to complete.`
      );
      return;
    }

    // Create unique ID for queue item
    const queueItemId = `${generationId}_${Date.now()}`;
    let currentQueueItemId = queueItemId;

    // Add to queue (this will fail if limit exceeded)
    const added = addToQueue(queueItemId, generationId, imageUrl, motionType);
    if (!added) {
      showWarning('Unable to start video generation. Maximum concurrent limit reached.');
      return;
    }

    // Use different keys for animate vs camera movement to avoid both buttons showing as generating
    const videoTypeKey = cameraMovement ? `${generationId}_camera` : `${generationId}_animate`;
    setVideoGenerating(prev => ({ ...prev, [videoTypeKey]: motionType }));

    // Close modal if it's open
    if (cameraMovementModal?.isOpen) {
      setCameraMovementModal(null);
    }

    // Update queue status to processing
    updateQueueItem(queueItemId, { status: 'processing' });

    // Show initial toast with 2-minute warning
    const toastId = showInfo('🎬 Video generation started! This may take up to 2 minutes to process. We\'ll notify you when it\'s ready.');

    try {
      const response = await authenticatedFetch('/api/v1/generate-video-motion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl,
          motionType,
          generationId: generationId, // Pass generationId so backend can look up original prompt
          options: {
            prompt: 'Add a impressive ultrarealistic movement to this image',
            cameraMovement: cameraMovement,
            duration: 6
          }
        })
      });

      const result = await response.json();

      if (result.success && result.data?.generationId) {
        const videoGenerationId = result.data.generationId;

        // Update queue item with actual generation ID
        updateQueueItem(currentQueueItemId, { generationId: videoGenerationId });

        // Check if video is already completed (synchronous generation)
        if (result.data?.resultVideoUrl) {
          // Video completed immediately - update queue and show success
          updateQueueItem(currentQueueItemId, { status: 'completed' });
          // Auto-remove from queue after 5 seconds
          setTimeout(() => {
            removeFromQueue(currentQueueItemId);
          }, 5000);
          updateToast(toastId, '🎬 Video generated successfully! Scroll down to view it.', 'success');

          // Clear the video generating state immediately
          const videoTypeKey = cameraMovement ? `${generationId}_camera` : `${generationId}_animate`;
          setVideoGenerating(prev => {
            const newState = { ...prev };
            delete newState[videoTypeKey];
            return newState;
          });

          // Refresh generations to show the new video
          fetchGenerations();

          // Scroll to the video after a short delay
          setTimeout(() => {
            const videoElement = document.querySelector(`[data-generation-id="${videoGenerationId}"]`);
            if (videoElement) {
              videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Highlight the video card briefly
              videoElement.classList.add('ring-4', 'ring-blue-500', 'ring-opacity-50');
              setTimeout(() => {
                videoElement.classList.remove('ring-4', 'ring-blue-500', 'ring-opacity-50');
              }, 3000);
            }
          }, 1000);

          // Auto-dismiss after 8 seconds
          setTimeout(() => {
            dismiss(toastId);
          }, 8000);
        } else {
          // Video is still processing - start polling for completion
          // Pass queueItemId and videoTypeKey to pollVideoGeneration so it can update the queue and clear state
          const videoTypeKey = cameraMovement ? `${generationId}_camera` : `${generationId}_animate`;
          pollVideoGeneration(videoGenerationId, toastId, currentQueueItemId, videoTypeKey);

          // Refresh generations after a short delay to see the processing status
          setTimeout(() => {
            fetchGenerations();
          }, 2000);
        }
      } else {
        // Update queue to failed status
        updateQueueItem(currentQueueItemId, {
          status: 'failed',
          error: result.message || result.error
        });
        updateToast(toastId, `Failed to generate video: ${result.message || result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error generating video:', error);
      // Update queue to failed status
      updateQueueItem(currentQueueItemId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      updateToast(toastId, 'Failed to generate video. Please try again.', 'error');
    } finally {
      // Clear the correct video type key (animate or camera)
      const videoTypeKey = cameraMovement ? `${generationId}_camera` : `${generationId}_animate`;
      setVideoGenerating(prev => {
        const newState = { ...prev };
        delete newState[videoTypeKey];
        return newState;
      });
    }
  };

  // Cleanup polling intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingIntervals).forEach(interval => clearInterval(interval));
      if (generalPollIntervalRef.current) {
        clearInterval(generalPollIntervalRef.current);
        generalPollIntervalRef.current = null;
      }
    };
  }, [pollingIntervals]);

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
      case 'add_furnitures':
        return 'Add Furnitures';
      case 'exterior_design':
        return 'Exterior Design';
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
      case 'add_furnitures':
        return <Sofa className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
      case 'exterior_design':
        return <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />;
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
      case 'add_furnitures':
        return 'from-orange-500 to-orange-600';
      case 'exterior_design':
        return 'from-indigo-500 to-indigo-600';
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
        // Use backend proxy to bypass CORS issues with R2
        const backendUrl = getBackendUrl();
        const proxyUrl = `${backendUrl}/api/v1/proxy-image?url=${encodeURIComponent(src)}`;

        // Get auth token for authenticated request
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const response = await fetch(proxyUrl, {
          headers: token ? {
            'Authorization': `Bearer ${token}`
          } : {}
        });

        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }

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
        // Show error toast if available
        if (typeof window !== 'undefined' && (window as any).toast) {
          (window as any).toast.error('Failed to download image. Please try again.');
        }
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
          // You could add a toast notification here
        }
      } catch (error) {
        console.error('Failed to share image:', error);
        // Fallback: copy URL to clipboard
        try {
          await navigator.clipboard.writeText(src);
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

  const handleVideoDownload = async (videoUrl: string) => {
    try {
      // Use backend proxy to bypass CORS issues with R2
      const backendUrl = getBackendUrl();
      const proxyUrl = `${backendUrl}/api/v1/proxy-image?url=${encodeURIComponent(videoUrl)}`;

      // Get auth token for authenticated request
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(proxyUrl, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });

      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      // Try to extract extension from URL or default to mp4
      const extension = videoUrl.split('.').pop()?.split(/[#?]/)[0] || 'mp4';
      a.download = `video-${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download video:', error);
      showError('Failed to download video. Please try again.');
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

        {/* After Image or Video */}
        {outputImageUrl ? (
          isVideoOutput(generation) ? (
            // Video Player
            <div className="relative group">
              <div className="w-full h-40 sm:h-48 lg:h-56 bg-black rounded-lg overflow-hidden">
                <video
                  src={getVideoUrl(generation) || outputImageUrl}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
              <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                <Video className="h-3 w-3" />
                Video
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const url = getVideoUrl(generation) || outputImageUrl;
                  if (url) handleVideoDownload(url);
                }}
                className="absolute top-2 right-2 p-1.5 bg-blue-600/80 hover:bg-blue-700 text-white rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 z-20 shadow-sm"
                title="Download Video"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          ) : (
            // Image with video generation buttons
            <div className="space-y-2">
              <ImageWithLoading
                src={outputImageUrl}
                alt="After"
                label="After"
                labelColor="bg-green-500"
                showActions={true}
                beforeImageSrc={inputImageUrl}
              />

              {/* Video Generation Buttons */}
              {generation.status === 'completed' && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleGenerateVideo(generation.id, outputImageUrl, 'veo3_fast')}
                    disabled={!!videoGenerating[`${generation.id}_animate`] || !!videoGenerating[`${generation.id}_camera`]}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Animate elements in the scene (e.g., snow, leaves, water)"
                  >
                    {videoGenerating[`${generation.id}_animate`] === 'veo3_fast' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Video className="h-4 w-4" />
                        <span>Animate Scene</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setCameraMovementModal({
                      isOpen: true,
                      generationId: generation.id,
                      imageUrl: outputImageUrl
                    })}
                    disabled={!!videoGenerating[`${generation.id}_animate`] || !!videoGenerating[`${generation.id}_camera`]}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move the camera around the scene (pan, zoom, orbit)"
                  >
                    {videoGenerating[`${generation.id}_camera`] === 'veo3_fast' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Drone View</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="w-full h-40 sm:h-48 lg:h-56 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            {generation.status === 'processing' || generation.status === 'pending' ? (
              <div className="flex flex-col items-center justify-center space-y-4 px-4 w-full max-w-xs">
                <Loader2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
                <div className="w-full">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center mb-2">
                    {generation.status === 'processing' ? 'Processing your image...' : 'Queued for processing...'}
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 animate-pulse"
                      style={{
                        width: generation.status === 'processing' ? '65%' : '30%',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    {generation.status === 'processing'
                      ? 'This usually takes 30-120 seconds'
                      : 'Waiting to start...'}
                  </p>
                </div>
              </div>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">No output image</span>
            )}
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
                <option value="exterior_design">Exterior Design</option>
                <option value="image_enhancement">Image Enhancement</option>
                <option value="element_replacement">Element Replacement</option>
                <option value="add_furnitures">Add Furnitures</option>
                <option value="smart_effects">Smart Effects</option>
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
              <div
                key={generation.id}
                data-generation-id={generation.id}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden transition-all duration-300"
              >
                {/* Header Section */}
                <div className="p-4 border-b border-gray-200 dark:border-slate-700 text-center m-auto w-full">

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(generation.status)}`}>
                        {generation.status}
                      </span>

                    </div>
                    <div className="flex items-center space-x-3">

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteClick(generation.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete generation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" className="text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M10 6v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {formatDate(generation.created_at)}
                      </div>
                    </div>
                    {generation.processing_time_ms && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {(generation.processing_time_ms / 1000).toFixed(2)}s
                      </span>
                    )}
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

      {/* Camera Movement Modal */}
      {cameraMovementModal && (
        <CameraMovementModal
          isOpen={cameraMovementModal.isOpen}
          onClose={() => setCameraMovementModal(null)}
          onSelect={(movement: CameraMovementOption) => {
            // Use veo3_fast for camera movement to ensure aspect ratio is respected
            handleGenerateVideo(
              cameraMovementModal.generationId,
              cameraMovementModal.imageUrl,
              'veo3_fast',
              movement.prompt
            );
          }}
          isGenerating={!!videoGenerating[cameraMovementModal.generationId]}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={handleCloseDeleteModal}
          onConfirm={handleDeleteGeneration}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};

export default RecentGenerationsWidget;
