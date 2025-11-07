import React, { useState, useCallback, useRef } from 'react';
import { Upload, Camera } from 'lucide-react';
import { API_CONFIG, getBackendUrl } from '../config/api';
import { authenticatedFormDataFetch } from '../utils/apiUtils';
import StatsWidget from '../components/StatsWidget';
import { RecentGenerationsWidget } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { validateImageFiles, validateImageFile } from '../utils/fileValidation';
import ImagePreview from '../components/ImagePreview';
import { createImagePreview } from '../utils/imagePreview';
import { useCredits } from '../contexts/CreditContext';


const ImageEnhancement: React.FC = () => {
  const { user } = useAuth();
  const { refreshCredits } = useCredits();
  const { showSuccess, showError, showWarning } = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showOriginals, setShowOriginals] = useState(true);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFileSize = API_CONFIG.MAX_FILE_SIZE;
  const maxFileCount = API_CONFIG.MAX_FILE_COUNT;

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    if (files.length > maxFileCount) {
      showWarning(`Maximum ${maxFileCount} files allowed. Please select fewer files.`);
      event.target.value = '';
      return;
    }

    // Validate file types and sizes
    const validation = validateImageFiles(files, 10, maxFileCount);
    if (!validation.isValid) {
      showWarning(validation.error!);
      event.target.value = '';
      return;
    }

    try {
      setSelectedFiles(files);
    } catch (error) {
      console.error('Error processing files:', error);
      showError('Error processing files. Please try again.');
    }
  }, [maxFileCount, maxFileSize]);

  const handleReferenceFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file, 10);
      if (!validation.isValid) {
        showWarning(validation.error!);
        return;
      }
      
      try {
        setReferenceFile(file);
      } catch (error) {
        console.error('Error processing reference file:', error);
        showError('Error processing reference file. Please try again.');
      }
    }
  };

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

    if (files.length > maxFileCount) {
      showWarning(`Maximum ${maxFileCount} files allowed. Please select fewer files.`);
      return;
    }

    // Validate and process dropped files
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const validFiles = files.filter(file => {
      if (!validTypes.includes(file.type)) {
        showWarning(`Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`);
        return false;
      }

      if (file.size > maxFileSize) {
        showWarning(`File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      try {
        setSelectedFiles(validFiles);

        // Update the hidden file input with the dropped files
        if (fileInputRef.current) {
          // Create a new DataTransfer object and add the files
          const dataTransfer = new DataTransfer();
          validFiles.forEach(file => dataTransfer.items.add(file));
          fileInputRef.current.files = dataTransfer.files;
        }

      } catch (error) {
        console.error('Error processing dropped files:', error);
        showError('Error processing dropped files. Please try again.');
      }
    }
  }, [maxFileCount, maxFileSize]);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      showWarning('Please select at least one image to enhance.');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    const startTime = Date.now();


    try {
      const formData = new FormData();

      // Append all selected images - use the actual File objects from selectedFiles
      selectedFiles.forEach((file, index) => {
        // Ensure we're using the actual File object, not a preview
        if (file instanceof File) {
          formData.append('image', file);
        } else {
          console.error(`File ${index + 1} is not a File instance:`, file);
        }
      });

      // Append reference image if provided
      if (referenceFile) {
        if (referenceFile instanceof File) {
          formData.append('referenceImage', referenceFile);
        } else {
          console.error('Reference file is not a File instance:', referenceFile);
        }
      }

      // Append enhancement settings
      formData.append('enhancementType', 'luminosity');
      formData.append('enhancementStrength', 'moderate');

      const response = await authenticatedFormDataFetch('/api/v1/image-enhancement', formData);

      const result = await response.json();
      const endTime = Date.now();
      setProcessingTime(endTime - startTime);

      if (result.success) {

        // Handle the backend response format correctly
        if (result.data && result.data.enhancedImages) {
          // Multiple images enhanced
          const enhancedResults = result.data.enhancedImages.map((enhancedImage: string, index: number) => ({
            originalImage: result.data.originalImages[index],
            enhancedImage: enhancedImage
          }));
          setResults(enhancedResults);
        } else if (result.enhancedImage) {
          // Single image enhanced (fallback)
          setResults([{
            originalImage: result.originalImage || (selectedFiles[0] ? URL.createObjectURL(selectedFiles[0]) : ''),
            enhancedImage: result.enhancedImage
          }]);
        } else {
          // Fallback to the old format
          setResults(result.data.enhancedImages || [result.data.enhancedImage]);
        }

        // Trigger refresh of RecentGenerationsWidget
        setRefreshTrigger(prev => prev + 1);

        await refreshCredits();
        
        // Reset form after successful generation
        setSelectedFiles([]);
        setReferenceFile(null);
        
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
      } else {
        showError(`Enhancement failed: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      showError('Enhancement failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const removeReferenceFile = () => {
    setReferenceFile(null);
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-6">


      {/* Stats Widget */}
      <StatsWidget
        modelType="image_enhancement"
        title="✨ Image Enhancement"
        description="Enhance multiple images with AI-powered luminosity and color improvements"
        userId={user?.id}
      />

      {/* Form - Matching home.html structure exactly */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Image Upload - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="enhancementImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📸 Images to Enhance (JPG/PNG/WebP/HEIC) - Up to 20 photos
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              id="enhancementImage"
              accept="image/jpeg,image/png,image/webp,image/heic"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              required
            />

            {/* Modern drag & drop area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${isDragOver ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                  <Upload className={`h-8 w-8 ${isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                    }`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragOver ? 'Drop images here' : 'Click to select or drag & drop'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Select up to 20 images that need luminosity and color enhancement
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
                      openFileDialog();
                    }}
                  >
                    Choose Files
                  </button>
                )}
              </div>
            </div>

            {/* File Counter - EXACTLY as in home.html */}
            {selectedFiles.length > 0 && (
              <>
                <div id="fileCounter" className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm">
                  <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                    {selectedFiles.length === 1
                      ? `${selectedFiles[0].name} (${(selectedFiles[0].size / 1024 / 1024).toFixed(1)}MB)`
                      : `${selectedFiles.length} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB total`
                    }
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Selected Files ({selectedFiles.length})
                  </h3>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        <ImagePreview
                          file={file}
                          onRemove={() => removeFile(index)}
                          alt={file.name}
                          className="w-full h-24 xs:h-28 sm:h-32 md:h-36 lg:h-40 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
                        />
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate px-1">
                          {file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reference Image - Hidden in original but we'll show it */}
          <div className="form-group" style={{ display: 'none' }}>
            <label htmlFor="referenceImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎨 Reference Image (Optional)
            </label>
            <input
              type="file"
              id="referenceImage"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleReferenceFileSelect}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Upload a reference image to match colors and lighting (optional)
            </small>
          </div>

          {/* Hidden fields that match the original form structure - EXACTLY as in home.html */}
          <div className="form-group" style={{ display: 'none' }}>
            <label htmlFor="enhancementType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ✨ Enhancement Type
            </label>
            <select
              id="enhancementType"
              defaultValue="luminosity"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="luminosity">Luminosity Enhancement</option>
              <option value="color-matching">Color Matching</option>
              <option value="lighting-improvement">Lighting Improvement</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Choose the type of enhancement you want to apply
            </small>
          </div>

          <div className="form-group" style={{ display: 'none' }}>
            <label htmlFor="enhancementStrength" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎯 Enhancement Strength
            </label>
            <select
              id="enhancementStrength"
              defaultValue="moderate"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="subtle">Subtle</option>
              <option value="moderate">Moderate</option>
              <option value="strong">Strong</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              How much enhancement to apply to the image
            </small>
          </div>

          {/* File Preview */}


          {/* Reference Image Preview */}
          {referenceFile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Reference Image
              </h3>
              <div className="flex justify-center sm:justify-start">
                <ImagePreview
                  file={referenceFile}
                  onRemove={removeReferenceFile}
                  alt="Reference image"
                  className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {referenceFile.name}
              </p>
            </div>
          )}

          {/* Submit Button - EXACTLY as in home.html */}
          <button
            type="submit"
            disabled={selectedFiles.length === 0 || isProcessing}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''}...
              </div>
            ) : (
              `✨ Enhance Images`
            )}
          </button>
        </form>
      </div>



      {/* Results will be shown in RecentGenerationsWidget */}

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Image Enhancement Generations"
        description="View your latest image enhancement transformations with before/after comparisons"
        showFilters={false}
        maxItems={10}
        className="mt-6"
        modelTypeFilter="image_enhancement"
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};

export default ImageEnhancement;
