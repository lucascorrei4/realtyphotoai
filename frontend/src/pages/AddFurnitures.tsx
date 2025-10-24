import React, { useState, useCallback, useRef } from 'react';
import { Upload, Sofa } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { authenticatedFormDataFetch } from '../utils/apiUtils';
import StatsWidget from '../components/StatsWidget';
import { RecentGenerationsWidget, ImagePreview } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { validateImageFile } from '../utils/fileValidation';

const AddFurnitures: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [roomImage, setRoomImage] = useState<File | null>(null);
  const [furnitureImage, setFurnitureImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('Add modern furniture to this room');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragTarget, setDragTarget] = useState<'room' | 'furniture' | null>(null);
  const roomInputRef = useRef<HTMLInputElement>(null);
  const furnitureInputRef = useRef<HTMLInputElement>(null);
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
      setRoomImage(file);
    }
  }, [showWarning]);

  const handleFurnitureFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file, 10);
      if (!validation.isValid) {
        showWarning(validation.error!);
        return;
      }
      setFurnitureImage(file);
    }
  }, [showWarning]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, target: 'room' | 'furniture') => {
    e.preventDefault();
    setIsDragOver(true);
    setDragTarget(target);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, target: 'room' | 'furniture') => {
    e.preventDefault();
    setIsDragOver(false);
    setDragTarget(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    
    const validation = validateImageFile(file, 10);
    if (!validation.isValid) {
      showWarning(validation.error!);
      return;
    }

    try {
      if (target === 'room') {
        setRoomImage(file);
        // Update the hidden input
        if (roomInputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          roomInputRef.current.files = dataTransfer.files;
        }
      } else {
        setFurnitureImage(file);
        // Update the hidden input
        if (furnitureInputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          furnitureInputRef.current.files = dataTransfer.files;
        }
      }
    } catch (error) {
      console.error('Error processing dropped file:', error);
      showError('Error processing dropped file. Please try again.');
    }
  }, [showWarning, showError]);

  const openRoomFileDialog = () => {
    roomInputRef.current?.click();
  };

  const openFurnitureFileDialog = () => {
    furnitureInputRef.current?.click();
  };

  const removeRoomFile = () => {
    setRoomImage(null);
    if (roomInputRef.current) {
      roomInputRef.current.value = '';
    }
  };

  const removeFurnitureFile = () => {
    setFurnitureImage(null);
    if (furnitureInputRef.current) {
      furnitureInputRef.current.value = '';
    }
  };


  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!roomImage) {
      showWarning('Please select a room image.');
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      
      // Append room image (required)
      formData.append('roomImage', roomImage);
      
      // Append furniture image (optional)
      if (furnitureImage) {
        formData.append('furnitureImage', furnitureImage);
      }
      
      // Append prompt
      formData.append('prompt', prompt);
      formData.append('furnitureType', furnitureImage ? 'specific' : 'general');

      const response = await authenticatedFormDataFetch('/api/v1/add-furnitures', formData);
      const result = await response.json();

      if (result.success) {
        // Trigger refresh of RecentGenerationsWidget
        setRefreshTrigger(prev => prev + 1);
        
        // Reset form after successful generation
        setRoomImage(null);
        setFurnitureImage(null);
        
        // Clear file inputs
        if (roomInputRef.current) {
          roomInputRef.current.value = '';
        }
        if (furnitureInputRef.current) {
          furnitureInputRef.current.value = '';
        }
        
        showSuccess('Furniture added successfully! Check the Recent Generations widget below.');
      } else {
        showError(`Failed to add furniture: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error adding furniture:', error);
      showError('Failed to add furniture. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Widget */}
      <StatsWidget
        modelType="add_furnitures"
        title="🪑 Add Furnitures"
        description="Add modern furniture to empty rooms or place specific furniture items using AI"
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
                isDragOver && dragTarget === 'room'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={(e) => handleDragOver(e, 'room')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'room')}
              onClick={openRoomFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${
                  isDragOver && dragTarget === 'room' 
                    ? 'bg-green-100 dark:bg-green-800' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Upload className={`h-8 w-8 ${
                    isDragOver && dragTarget === 'room'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragOver && dragTarget === 'room' ? 'Drop room image here' : 'Click to select or drag & drop room image'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload a photo of an empty room where you want to add furniture
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Supports JPG, PNG, WebP, and HEIC formats
                  </p>
                </div>

                {!(isDragOver && dragTarget === 'room') && (
                  <button
                    type="button"
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
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
                alt={roomImage.name}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {roomImage.name} ({(roomImage.size / 1024 / 1024).toFixed(1)}MB)
              </p>
            </div>
          )}

          {/* Furniture Image Upload (Optional) */}
          <div className="form-group">
            <label htmlFor="furnitureImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🪑 Furniture Style Reference (Optional)
            </label>

            {/* Hidden file input */}
            <input
              ref={furnitureInputRef}
              type="file"
              id="furnitureImage"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleFurnitureFileSelect}
              className="hidden"
            />

            {/* Drag & drop area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${
                isDragOver && dragTarget === 'furniture'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={(e) => handleDragOver(e, 'furniture')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, 'furniture')}
              onClick={openFurnitureFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${
                  isDragOver && dragTarget === 'furniture' 
                    ? 'bg-blue-100 dark:bg-blue-800' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Sofa className={`h-8 w-8 ${
                    isDragOver && dragTarget === 'furniture'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragOver && dragTarget === 'furniture' ? 'Drop furniture image here' : 'Click to select or drag & drop specific furniture'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload a furniture image to use as style reference (optional)
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    AI will create similar furniture matching the style, not copy the exact item
                  </p>
                </div>

                {!(isDragOver && dragTarget === 'furniture') && (
                  <button
                    type="button"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFurnitureFileDialog();
                    }}
                  >
                    Choose Furniture Image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Furniture Image Preview */}
          {furnitureImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Furniture Style Reference Preview
              </h3>
              <ImagePreview
                file={furnitureImage}
                onRemove={removeFurnitureFile}
                alt={furnitureImage.name}
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {furnitureImage.name} ({(furnitureImage.size / 1024 / 1024).toFixed(1)}MB)
              </p>
            </div>
          )}

          {/* Furniture Prompt */}
          <div className="form-group">
            <label htmlFor="furniturePrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎨 Furniture Description
            </label>
            <textarea
              id="furniturePrompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the furniture you want to add (e.g., 'Add a modern sofa and coffee table', 'Place a wooden dining table and chairs')"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Describe the furniture you want to add to the room. Be specific about style, type, and placement.
            </small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!roomImage || isProcessing}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Adding furniture...
              </div>
            ) : (
              '🪑 Add Furniture to Room'
            )}
          </button>
        </form>
      </div>

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Add Furniture Generations"
        description="View your latest furniture addition transformations with before/after comparisons"
        showFilters={false}
        maxItems={10}
        className="mt-6"
        modelTypeFilter="add_furnitures"
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};

export default AddFurnitures;
