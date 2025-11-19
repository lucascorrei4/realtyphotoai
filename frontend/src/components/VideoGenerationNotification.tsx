import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Video, CheckCircle2, AlertCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { useVideoGenerationQueue, VideoGenerationQueueItem } from '../hooks/useVideoGenerationQueue';
import { useNavigate } from 'react-router-dom';

/**
 * Global floating notification component for video generation progress
 * Shows across all pages when videos are being generated
 */
const VideoGenerationNotification: React.FC = () => {
  const navigate = useNavigate();
  const { queue, removeFromQueue } = useVideoGenerationQueue();
  const [isVisible, setIsVisible] = useState(false);
  const [dismissedCompleted, setDismissedCompleted] = useState<Set<string>>(new Set());

  // Memoize active items to prevent unnecessary recalculations
  const activeItems = useMemo(() => {
    return queue.filter(
      item => item.status === 'queued' || item.status === 'processing'
    );
  }, [queue]);

  // Memoize recent completed items
  const completedItems = useMemo(() => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return queue.filter(
      item =>
        item.status === 'completed' &&
        item.completedAt &&
        item.completedAt > fiveMinutesAgo
    );
  }, [queue]);

  // Memoize recent completed that haven't been dismissed
  const recentCompleted = useMemo(() => {
    return completedItems.filter(item => !dismissedCompleted.has(item.id));
  }, [completedItems, dismissedCompleted]);

  // Update visibility based on active items only (not completed)
  // Only show when there are videos actively processing
  useEffect(() => {
    const hasActive = activeItems.length > 0;
    setIsVisible(hasActive);
  }, [activeItems.length]);

  // Auto-dismiss completed notifications after 10 seconds
  useEffect(() => {
    if (recentCompleted.length > 0) {
      const itemIds = recentCompleted.map(item => item.id);
      const timer = setTimeout(() => {
        itemIds.forEach(itemId => {
          setDismissedCompleted(prev => {
            const newSet = new Set(prev);
            newSet.add(itemId);
            return newSet;
          });
          // Remove from queue after dismissal
          setTimeout(() => removeFromQueue(itemId), 1000);
        });
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [recentCompleted.length, removeFromQueue]);

  // Handler for dismissing completed notifications
  const handleDismissCompleted = useCallback(() => {
    recentCompleted.forEach(item => {
      setDismissedCompleted(prev => {
        const newSet = new Set(prev);
        newSet.add(item.id);
        return newSet;
      });
      removeFromQueue(item.id);
    });
  }, [recentCompleted, removeFromQueue]);

  // Handler for viewing a completed video
  const handleViewVideo = useCallback((itemId: string) => {
    setDismissedCompleted(prev => {
      const newSet = new Set(prev);
      newSet.add(itemId);
      return newSet;
    });
    removeFromQueue(itemId);
    navigate('/dashboard');
  }, [navigate, removeFromQueue]);

  // Handler for removing an item
  const handleRemoveItem = useCallback((itemId: string) => {
    setDismissedCompleted(prev => {
      const newSet = new Set(prev);
      newSet.add(itemId);
      return newSet;
    });
    removeFromQueue(itemId);
  }, [removeFromQueue]);

  // Handler for dismissing the entire notification
  const handleDismissNotification = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Only show when there are active videos processing
  if (!isVisible || activeItems.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full md:w-96">
      {/* Active Generations */}
      {activeItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 mb-3 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <h3 className="text-white font-semibold text-sm">
                {activeItems.length} Video{activeItems.length > 1 ? 's' : ''} Generating
              </h3>
            </div>
            <button
              onClick={handleDismissNotification}
              className="text-white hover:text-gray-200 transition-colors"
              title="Hide notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
            {activeItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {item.status === 'processing' ? (
                    <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  ) : (
                    <Video className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {item.motionType === 'veo3_fast' ? 'Animate Scene' : 'Camera Movement'}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.status === 'queued' ? 'Queued' : 'Processing...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-indigo-600 rounded-full transition-all duration-500 ${
                          item.status === 'processing' ? 'animate-pulse' : ''
                        }`}
                        style={{
                          width: item.status === 'processing' ? '60%' : '10%',
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {item.status === 'queued'
                      ? 'Waiting to start...'
                      : 'This may take up to 2 minutes'}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from queue"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Notifications - Only show if there are active items too */}
      {recentCompleted.length > 0 && activeItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-green-200 dark:border-green-800 overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <h3 className="text-white font-semibold text-sm">
                Video Generation Complete!
              </h3>
            </div>
            <button
              onClick={handleDismissCompleted}
              className="text-white hover:text-gray-200 transition-colors"
              title="Dismiss completed notifications"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {recentCompleted.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 group"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      {item.motionType === 'veo3_fast' ? 'Animate Scene' : 'Camera Movement'} Complete
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                      Your video is ready to view!
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewVideo(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
                      >
                        <span>View Video</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Remove notification"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoGenerationNotification;

