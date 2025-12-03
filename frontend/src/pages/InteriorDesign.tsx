import React, { useState, useCallback, useRef } from 'react';
import { Home } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { authenticatedFormDataFetch } from '../utils/apiUtils';
import StatsWidget from '../components/StatsWidget';
import { RecentGenerationsWidget, HowItWorksButton } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { validateImageFile } from '../utils/fileValidation';
import ImagePreview from '../components/ImagePreview';
import { createImagePreview } from '../utils/imagePreview';
import { useCredits } from '../contexts/CreditContext';
import { getImageCredits } from '../config/subscriptionPlans';

const InteriorDesign: React.FC = () => {
  const { user } = useAuth();
  const { refreshCredits, creditBalance } = useCredits();
  const { showSuccess, showError, showWarning } = useToast();
  const [roomImage, setRoomImage] = useState<File | null>(null);
  const [designPrompt, setDesignPrompt] = useState('Transform this room with a modern interior design');
  const [designType, setDesignType] = useState<'modern' | 'traditional' | 'minimalist' | 'scandinavian' | 'industrial' | 'bohemian' | 'custom'>('modern');
  const [style, setStyle] = useState<'realistic' | 'architectural' | 'lifestyle'>('realistic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const roomInputRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const maxFileSize = API_CONFIG.MAX_FILE_SIZE;

  const handleRoomFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file, 10);
      if (!validation.isValid) {
        showWarning(validation.error!);
        return;
      }
      
      try {
        setRoomImage(file);
      } catch (error) {
        console.error('Error processing room file:', error);
        showError('Error processing room file. Please try again.');
      }
    }
  }, [showWarning, showError]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    
    const validation = validateImageFile(file, 10);
    if (!validation.isValid) {
      showWarning(validation.error!);
      return;
    }

    try {
      setRoomImage(file);
      
      // Update the hidden input
      if (roomInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        roomInputRef.current.files = dataTransfer.files;
      }
    } catch (error) {
      console.error('Error processing dropped file:', error);
      showError('Error processing dropped file. Please try again.');
    }
  }, [showWarning, showError]);

  const openRoomFileDialog = () => {
    roomInputRef.current?.click();
  };

  const removeRoomFile = () => {
    setRoomImage(null);
    if (roomInputRef.current) {
      roomInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!roomImage) {
      showWarning('Please select a room image.');
      return;
    }

    // Check if user has enough credits before processing
    const creditsNeeded = getImageCredits(1); // 40 credits per image
    if (creditBalance && creditBalance.displayCreditsRemaining < creditsNeeded) {
      showError(
        `Insufficient credits! You need more credits. Please upgrade your plan.`
      );
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      
      // Append room image (required)
      formData.append('image', roomImage);
      
      // Append design parameters
      formData.append('prompt', designPrompt);
      formData.append('designType', designType);
      formData.append('style', style);

      const response = await authenticatedFormDataFetch('/api/v1/interior-design', formData);
      const result = await response.json();

      if (result.success) {
        // Trigger refresh of RecentGenerationsWidget
        setRefreshTrigger(prev => prev + 1);

        await refreshCredits();
        
        // Reset form after successful generation
        setRoomImage(null);
        
        // Clear file input
        if (roomInputRef.current) {
          roomInputRef.current.value = '';
        }
        
        showSuccess('Interior design generated successfully! Check the Recent Generations widget below.');
      } else {
        showError(`Failed to generate interior design: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error generating interior design:', error);
      showError('Failed to generate interior design. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with How It Works Button */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">🏠 Interior Design</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Transform room interiors with AI-powered design and styling
          </p>
        </div>
        <HowItWorksButton variant="outline" />
      </div>

      {/* Stats Widget */}
      <StatsWidget
        modelType="interior_design"
        title=""
        description=""
        userId={user?.id}
      />

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Room Image Upload */}
          <div className="form-group">
            <label htmlFor="roomImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🏠 Room Image (Required)
            </label>

            {/* Hidden file input */}
            <input
              ref={roomInputRef}
              type="file"
              id="roomImage"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleRoomFileSelect}
              className="hidden"
              required
            />

            {/* Drag & drop area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openRoomFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${
                  isDragOver 
                    ? 'bg-blue-100 dark:bg-blue-800' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Home className={`h-8 w-8 ${
                    isDragOver
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragOver ? 'Drop room image here' : 'Click to select or drag & drop room image'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload a photo of the room you want to redesign
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Supports JPG, PNG, WebP, and HEIC formats
                  </p>
                </div>

                {!isDragOver && (
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRoomFileDialog();
                    }}
                  >
                    Choose Room Image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Room Image Preview */}
          {roomImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Room Image Preview
              </h3>
              <ImagePreview
                file={roomImage}
                onRemove={removeRoomFile}
                alt="Room image preview"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {roomImage.name} ({(roomImage.size / 1024 / 1024).toFixed(1)}MB)
              </p>
            </div>
          )}

          {/* Design Prompt */}
          <div className="form-group">
            <label htmlFor="designPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎨 Design Description
            </label>
            <textarea
              id="designPrompt"
              rows={3}
              value={designPrompt}
              onChange={(e) => setDesignPrompt(e.target.value)}
              placeholder="Describe the interior design you want (e.g., 'Modern living room with cozy seating', 'Minimalist bedroom with natural light')"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Describe the interior design transformation you want to apply to the room.
            </small>
          </div>

          {/* Design Type */}
          <div className="form-group">
            <label htmlFor="designType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🏠 Design Style
            </label>
            <select
              id="designType"
              value={designType}
              onChange={(e) => setDesignType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="modern">Modern Contemporary</option>
              <option value="traditional">Traditional</option>
              <option value="minimalist">Minimalist</option>
              <option value="scandinavian">Scandinavian</option>
              <option value="industrial">Industrial</option>
              <option value="bohemian">Bohemian</option>
              <option value="custom">Custom</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Choose the interior design style for your room.
            </small>
          </div>

          {/* Visualization Style */}
          <div className="form-group">
            <label htmlFor="style" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎭 Visualization Style
            </label>
            <select
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="realistic">Photorealistic</option>
              <option value="architectural">Architectural Visualization</option>
              <option value="lifestyle">Lifestyle</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Choose how you want the design to be visualized.
            </small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!roomImage || isProcessing}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generating interior design...
              </div>
            ) : (
              '🏠 Generate Interior Design'
            )}
          </button>
        </form>
      </div>

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Interior Design Generations"
        description="View your latest interior design transformations with before/after comparisons"
        showFilters={false}
        maxItems={10}
        className="mt-6"
        modelTypeFilter="interior_design"
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};

export default InteriorDesign;