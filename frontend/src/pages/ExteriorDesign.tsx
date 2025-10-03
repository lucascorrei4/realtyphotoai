import React, { useState, useCallback, useRef } from 'react';
import { Upload, Building2 } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import { authenticatedFormDataFetch } from '../utils/apiUtils';
import StatsWidget from '../components/StatsWidget';
import { RecentGenerationsWidget } from '../components';
import { useAuth } from '../contexts/AuthContext';

const ExteriorDesign: React.FC = () => {
  const { user } = useAuth();
  const [buildingImage, setBuildingImage] = useState<File | null>(null);
  const [buildingPreview, setBuildingPreview] = useState<string | null>(null);
  const [designPrompt, setDesignPrompt] = useState('Transform this building with a modern exterior design');
  const [designType, setDesignType] = useState<'modern' | 'traditional' | 'minimalist' | 'industrial' | 'custom'>('modern');
  const [style, setStyle] = useState<'isometric' | 'realistic' | 'architectural'>('architectural');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const buildingInputRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const maxFileSize = API_CONFIG.MAX_FILE_SIZE;
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

  const handleBuildingFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!validTypes.includes(file.type)) {
        alert(`⚠️ Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`);
        return;
      }
      if (file.size > maxFileSize) {
        alert(`⚠️ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
        return;
      }
      
      try {
        const preview = URL.createObjectURL(file);
        setBuildingImage(file);
        setBuildingPreview(preview);
      } catch (error) {
        console.error('Error creating building file preview:', error);
        alert('Error processing building file. Please try again.');
      }
    }
  }, [maxFileSize, validTypes]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const file = files[0];
    
    if (!validTypes.includes(file.type)) {
      alert(`⚠️ Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`);
      return;
    }

    if (file.size > maxFileSize) {
      alert(`⚠️ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
      return;
    }

    try {
      const preview = URL.createObjectURL(file);
      setBuildingImage(file);
      setBuildingPreview(preview);
      
      // Update the hidden input
      if (buildingInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        buildingInputRef.current.files = dataTransfer.files;
      }
    } catch (error) {
      console.error('Error processing dropped file:', error);
      alert('Error processing dropped file. Please try again.');
    }
  }, [maxFileSize, validTypes]);

  const openBuildingFileDialog = () => {
    buildingInputRef.current?.click();
  };

  const removeBuildingFile = () => {
    setBuildingImage(null);
    setBuildingPreview(null);
    if (buildingInputRef.current) {
      buildingInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!buildingImage) {
      alert('Please select a building image.');
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      
      // Append building image (required)
      formData.append('buildingImage', buildingImage);
      
      // Append design parameters
      formData.append('designPrompt', designPrompt);
      formData.append('designType', designType);
      formData.append('style', style);

      const response = await authenticatedFormDataFetch('/api/v1/exterior-design', formData);
      const result = await response.json();

      if (result.success) {
        // Trigger refresh of RecentGenerationsWidget
        setRefreshTrigger(prev => prev + 1);
        
        // Reset form after successful generation
        setBuildingImage(null);
        setBuildingPreview(null);
        
        // Clear file input
        if (buildingInputRef.current) {
          buildingInputRef.current.value = '';
        }
        
        alert('Exterior design generated successfully! Check the Recent Generations widget below.');
      } else {
        alert(`Failed to generate exterior design: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error generating exterior design:', error);
      alert('Failed to generate exterior design. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Widget */}
      <StatsWidget
        modelType="exterior_design"
        title="🏢 Exterior Design"
        description="Transform building exteriors with AI-powered architectural design"
        userId={user?.id}
      />

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Building Image Upload */}
          <div className="form-group">
            <label htmlFor="buildingImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🏢 Building Image (Required)
            </label>

            {/* Hidden file input */}
            <input
              ref={buildingInputRef}
              type="file"
              id="buildingImage"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleBuildingFileSelect}
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
              onClick={openBuildingFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${
                  isDragOver 
                    ? 'bg-blue-100 dark:bg-blue-800' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Building2 className={`h-8 w-8 ${
                    isDragOver
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragOver ? 'Drop building image here' : 'Click to select or drag & drop building image'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload a photo of the building you want to redesign
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
                      openBuildingFileDialog();
                    }}
                  >
                    Choose Building Image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Building Image Preview */}
          {buildingImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Building Image Preview
              </h3>
              <div className="relative inline-block">
                <img
                  src={buildingPreview || ''}
                  alt={buildingImage.name}
                  className="w-64 h-48 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
                />
                <button
                  onClick={removeBuildingFile}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-all duration-200"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {buildingImage.name} ({(buildingImage.size / 1024 / 1024).toFixed(1)}MB)
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
              placeholder="Describe the exterior design you want (e.g., 'Modern glass facade with vertical gardens', 'Traditional brick with contemporary elements')"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Describe the exterior design transformation you want to apply to the building.
            </small>
          </div>

          {/* Design Type */}
          <div className="form-group">
            <label htmlFor="designType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🏗️ Design Style
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
              <option value="industrial">Industrial</option>
              <option value="custom">Custom</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Choose the architectural style for your exterior design.
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
              <option value="architectural">Architectural Visualization</option>
              <option value="isometric">Isometric View</option>
              <option value="realistic">Photorealistic</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Choose how you want the design to be visualized.
            </small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!buildingImage || isProcessing}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Generating exterior design...
              </div>
            ) : (
              '🏢 Generate Exterior Design'
            )}
          </button>
        </form>
      </div>

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Exterior Design Generations"
        description="View your latest exterior design transformations with before/after comparisons"
        showFilters={false}
        maxItems={10}
        className="mt-6"
        modelTypeFilter="exterior_design"
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};

export default ExteriorDesign;
