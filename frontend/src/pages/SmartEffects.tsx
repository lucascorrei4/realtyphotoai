import React, { useState, useCallback, useRef } from 'react';
import { Upload, Sparkles } from 'lucide-react';
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

type EffectType = 
  | 'dusk'
  | 'balloons'
  | 'helicopter'
  | 'gift_bow'
  | 'fireworks'
  | 'confetti'
  | 'holiday_lights'
  | 'snow'
  | 'sunrise';

interface EffectOption {
  value: EffectType;
  label: string;
  description: string;
  emoji: string;
}

const EFFECT_OPTIONS: EffectOption[] = [
  {
    value: 'dusk',
    label: 'Dusk Effect',
    description: 'Transform the house with beautiful evening dusk lighting',
    emoji: '🌆'
  },
  {
    value: 'balloons',
    label: 'Thousand Balloons',
    description: 'Add a thousand colorful balloons over the house like a gift',
    emoji: '🎈'
  },
  {
    value: 'helicopter',
    label: 'Helicopter Reveal',
    description: 'Helicopter lifts fabric to unveil house for open house event',
    emoji: '🚁'
  },
  {
    value: 'gift_bow',
    label: 'Gift Bow',
    description: 'A big decorative bow over the house making it look like a gift',
    emoji: '🎀'
  },
  {
    value: 'fireworks',
    label: 'Fireworks Display',
    description: 'Spectacular fireworks celebration over the house',
    emoji: '🎆'
  },
  {
    value: 'confetti',
    label: 'Confetti Celebration',
    description: 'Colorful confetti raining down around the house',
    emoji: '🎊'
  },
  {
    value: 'holiday_lights',
    label: 'Holiday Lights',
    description: 'Beautiful holiday lights decorating the entire house',
    emoji: '✨'
  },
  {
    value: 'snow',
    label: 'Snow Falling',
    description: 'Gentle snow falling on the house creating a winter wonderland',
    emoji: '❄️'
  },
  {
    value: 'sunrise',
    label: 'Sunrise Effect',
    description: 'Stunning sunrise lighting illuminating the house',
    emoji: '🌅'
  }
];

const SmartEffects: React.FC = () => {
  const { user } = useAuth();
  const { refreshCredits, creditBalance } = useCredits();
  const { showSuccess, showError, showWarning } = useToast();
  const [houseImage, setHouseImage] = useState<File | null>(null);
  const [effectType, setEffectType] = useState<EffectType>('dusk');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const houseInputRef = useRef<HTMLInputElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const maxFileSize = API_CONFIG.MAX_FILE_SIZE;

  const selectedEffect = EFFECT_OPTIONS.find(opt => opt.value === effectType) || EFFECT_OPTIONS[0];

  const handleHouseFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file, 10);
      if (!validation.isValid) {
        showWarning(validation.error!);
        return;
      }
      
      try {
        setHouseImage(file);
      } catch (error) {
        console.error('Error processing house file:', error);
        showError('Error processing house file. Please try again.');
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
      setHouseImage(file);
      
      // Update the hidden input
      if (houseInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        houseInputRef.current.files = dataTransfer.files;
      }
    } catch (error) {
      console.error('Error processing dropped file:', error);
      showError('Error processing dropped file. Please try again.');
    }
  }, [showWarning, showError]);

  const openHouseFileDialog = () => {
    houseInputRef.current?.click();
  };

  const removeHouseFile = () => {
    setHouseImage(null);
    if (houseInputRef.current) {
      houseInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!houseImage) {
      showWarning('Please select a house image.');
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
      
      // Append house image (required)
      formData.append('houseImage', houseImage);
      
      // Append effect parameters
      formData.append('effectType', effectType);
      if (customPrompt.trim()) {
        formData.append('customPrompt', customPrompt.trim());
      }

      const response = await authenticatedFormDataFetch('/api/v1/smart-effects', formData);
      const result = await response.json();

      if (result.success) {
        // Trigger refresh of RecentGenerationsWidget
        setRefreshTrigger(prev => prev + 1);

        await refreshCredits();
        
        // Reset form after successful generation
        setHouseImage(null);
        
        // Clear file input
        if (houseInputRef.current) {
          houseInputRef.current.value = '';
        }
        
        // Reset custom prompt
        setCustomPrompt('');
        
        showSuccess('Smart effect applied successfully! Check the Recent Generations widget below.');
      } else {
        showError(`Failed to apply smart effect: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error applying smart effect:', error);
      showError('Failed to apply smart effect. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with How It Works Button */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">✨ Smart Effects</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Transform houses with magical effects using AI-powered visual enhancements
          </p>
        </div>
        <HowItWorksButton variant="outline" />
      </div>

      {/* Stats Widget */}
      <StatsWidget
        modelType="smart_effects"
        title=""
        description=""
        userId={user?.id}
      />

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* House Image Upload */}
          <div className="form-group">
            <label htmlFor="houseImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🏠 House Image (Required)
            </label>

            {/* Hidden file input */}
            <input
              ref={houseInputRef}
              type="file"
              id="houseImage"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleHouseFileSelect}
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
              onClick={openHouseFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${
                  isDragOver 
                    ? 'bg-blue-100 dark:bg-blue-800' 
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Sparkles className={`h-8 w-8 ${
                    isDragOver
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragOver ? 'Drop house image here' : 'Click to select or drag & drop house image'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload a photo of the house you want to enhance with smart effects
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
                      openHouseFileDialog();
                    }}
                  >
                    Choose House Image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* House Image Preview */}
          {houseImage && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                House Image Preview
              </h3>
              <ImagePreview
                file={houseImage}
                onRemove={removeHouseFile}
                alt="House image preview"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {houseImage.name} ({(houseImage.size / 1024 / 1024).toFixed(1)}MB)
              </p>
            </div>
          )}

          {/* Effect Type Selection */}
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              ✨ Smart Effect
            </label>
            
            {/* Grid of selectable effect cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {EFFECT_OPTIONS.map((option) => {
                const isSelected = effectType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEffectType(option.value)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all duration-200 text-left
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Emoji */}
                    <div className="text-4xl mb-2">{option.emoji}</div>
                    
                    {/* Label */}
                    <h3 className={`
                      text-base font-semibold mb-1
                      ${isSelected 
                        ? 'text-blue-700 dark:text-blue-300' 
                        : 'text-gray-900 dark:text-white'
                      }
                    `}>
                      {option.label}
                    </h3>
                    
                    {/* Description */}
                    <p className={`
                      text-sm leading-relaxed
                      ${isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                      }
                    `}>
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Selected effect highlight */}
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start space-x-3">
                <div className="text-3xl flex-shrink-0">{selectedEffect.emoji}</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
                    {selectedEffect.label}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    {selectedEffect.description}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Prompt (Optional) */}
          <div className="form-group">
            <label htmlFor="customPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎨 Custom Instructions (Optional)
            </label>
            <textarea
              id="customPrompt"
              rows={3}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Add any additional instructions or modifications you want for the selected effect (e.g., 'Make the balloons more colorful', 'Add more fireworks')"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Optionally customize how the effect should be applied to your house image.
            </small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!houseImage || isProcessing}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Applying smart effect...
              </div>
            ) : (
              `✨ Apply ${selectedEffect.label}`
            )}
          </button>
        </form>
      </div>

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Smart Effects Generations"
        description="View your latest smart effects transformations with before/after comparisons"
        showFilters={false}
        maxItems={10}
        className="mt-6"
        modelTypeFilter="smart_effects"
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
};

export default SmartEffects;

