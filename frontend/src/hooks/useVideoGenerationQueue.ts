import { useState, useEffect, useCallback } from 'react';

export interface VideoGenerationQueueItem {
  id: string;
  generationId: string;
  imageUrl: string;
  motionType: 'veo3_fast';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  error?: string;
}

const STORAGE_KEY = 'video_generation_queue';
const MAX_CONCURRENT = 3;

// Shared queue state across all hook instances
let globalQueue: VideoGenerationQueueItem[] = [];
let queueListeners: Set<() => void> = new Set();

/**
 * Load queue from localStorage
 */
const loadQueueFromStorage = (): VideoGenerationQueueItem[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    // Filter out completed/failed items older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = parsed.filter((item: VideoGenerationQueueItem) => {
      if (item.status === 'completed' || item.status === 'failed') {
        return item.completedAt && item.completedAt > oneHourAgo;
      }
      return true;
    });

    // Update localStorage with filtered items if needed
    if (filtered.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }

    return filtered;
  } catch (error) {
    console.error('Error loading video generation queue:', error);
    return [];
  }
};

/**
 * Save queue to localStorage and notify all listeners
 */
const saveQueueToStorage = (newQueue: VideoGenerationQueueItem[]) => {
  globalQueue = newQueue;
  
  if (newQueue.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Dispatch custom event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('video-queue-updated', { detail: newQueue }));
  }

  // Notify all listeners
  queueListeners.forEach(listener => listener());
};

// Initialize global queue from storage
if (typeof window !== 'undefined') {
  globalQueue = loadQueueFromStorage();

  // Listen for storage events (cross-tab/window sync)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      globalQueue = loadQueueFromStorage();
      queueListeners.forEach(listener => listener());
    }
  });

  // Listen for custom events (same-tab updates)
  window.addEventListener('video-queue-updated', ((e: CustomEvent<VideoGenerationQueueItem[]>) => {
    globalQueue = e.detail || loadQueueFromStorage();
    queueListeners.forEach(listener => listener());
  }) as EventListener);
}

/**
 * Hook to manage video generation queue in localStorage
 * Tracks concurrent generations and provides queue management
 * All hook instances share the same queue state
 */
export const useVideoGenerationQueue = () => {
  const [queue, setQueue] = useState<VideoGenerationQueueItem[]>(globalQueue);

  // Sync with global queue and set up listener
  useEffect(() => {
    // Initial sync
    setQueue(globalQueue);

    // Create listener to update local state when global queue changes
    const listener = () => {
      setQueue([...globalQueue]);
    };

    queueListeners.add(listener);

    // Cleanup
    return () => {
      queueListeners.delete(listener);
    };
  }, []);

  // Helper to update queue (both local state and global queue)
  const updateQueue = useCallback((updater: (prev: VideoGenerationQueueItem[]) => VideoGenerationQueueItem[]) => {
    const newQueue = updater(globalQueue);
    saveQueueToStorage(newQueue);
    setQueue([...newQueue]);
  }, []);

  /**
   * Check if user can start a new video generation
   */
  const canStartGeneration = useCallback((): boolean => {
    const processingCount = globalQueue.filter(
      item => item.status === 'queued' || item.status === 'processing'
    ).length;
    return processingCount < MAX_CONCURRENT;
  }, []);

  /**
   * Get processing count
   */
  const getProcessingCount = useCallback((): number => {
    return globalQueue.filter(
      item => item.status === 'queued' || item.status === 'processing'
    ).length;
  }, []);

  /**
   * Add a new video generation to the queue
   */
  const addToQueue = useCallback((
    id: string,
    generationId: string,
    imageUrl: string,
    motionType: 'veo3_fast'
  ): boolean => {
    const processingCount = globalQueue.filter(
      item => item.status === 'queued' || item.status === 'processing'
    ).length;
    
    if (processingCount >= MAX_CONCURRENT) {
      return false;
    }

    const newItem: VideoGenerationQueueItem = {
      id,
      generationId,
      imageUrl,
      motionType,
      status: 'queued',
      createdAt: Date.now(),
    };

    updateQueue(prev => [...prev, newItem]);
    return true;
  }, [updateQueue]);

  /**
   * Update queue item status
   */
  const updateQueueItem = useCallback((
    id: string,
    updates: Partial<VideoGenerationQueueItem>
  ): void => {
    updateQueue(prev =>
      prev.map(item => {
        if (item.id === id || item.generationId === id) {
          return {
            ...item,
            ...updates,
            ...(updates.status === 'completed' || updates.status === 'failed'
              ? { completedAt: Date.now() }
              : {}),
          };
        }
        return item;
      })
    );
  }, [updateQueue]);

  /**
   * Remove item from queue
   */
  const removeFromQueue = useCallback((id: string): void => {
    updateQueue(prev => prev.filter(item => item.id !== id && item.generationId !== id));
  }, [updateQueue]);

  /**
   * Get active (processing/queued) items
   */
  const getActiveItems = useCallback((): VideoGenerationQueueItem[] => {
    return queue.filter(
      item => item.status === 'queued' || item.status === 'processing'
    );
  }, [queue]);

  /**
   * Get recently completed items (for notifications)
   */
  const getRecentCompleted = useCallback((): VideoGenerationQueueItem[] => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return queue.filter(
      item =>
        item.status === 'completed' &&
        item.completedAt &&
        item.completedAt > fiveMinutesAgo
    );
  }, [queue]);

  return {
    queue,
    canStartGeneration,
    getProcessingCount,
    addToQueue,
    updateQueueItem,
    removeFromQueue,
    getActiveItems,
    getRecentCompleted,
  };
};

