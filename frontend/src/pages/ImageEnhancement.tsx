import React, { useState, useCallback, useRef } from 'react';
import { Upload, Image as ImageIcon, Download, Clock, FileText, X } from 'lucide-react';
import { getEndpointUrl, API_CONFIG, getBackendUrl } from '../config/api';

interface FileWithPreview extends File {
  preview?: string;
}

const ImageEnhancement: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showOriginals, setShowOriginals] = useState(true);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFileSize = API_CONFIG.MAX_FILE_SIZE;
  const maxFileCount = API_CONFIG.MAX_FILE_COUNT;

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    console.log('Files selected:', files.length, files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }
    
    if (files.length > maxFileCount) {
      alert(`⚠️ Maximum ${maxFileCount} files allowed. Please select fewer files.`);
      event.target.value = '';
      return;
    }

    // Validate file types and sizes
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    
    for (const file of files) {
      console.log('Validating file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      if (!validTypes.includes(file.type)) {
        alert(`⚠️ Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`);
        event.target.value = '';
        return;
      }
      
      if (file.size > maxFileSize) {
        alert(`⚠️ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
        event.target.value = '';
        return;
      }
    }

    try {
      // Create previews for selected files
      const previews = files.map(file => URL.createObjectURL(file));
      
      setSelectedFiles(files);
      setFilePreviews(previews);
      console.log('Files set successfully:', files.length);
    } catch (error) {
      console.error('Error creating file previews:', error);
      alert('Error processing files. Please try again.');
    }
  }, [maxFileCount, maxFileSize]);

  const handleReferenceFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('Reference file selected:', file.name, 'Type:', file.type, 'Size:', file.size);
      try {
        const preview = URL.createObjectURL(file);
        setReferenceFile(file);
        setReferencePreview(preview);
        console.log('Reference file preview created:', preview);
      } catch (error) {
        console.error('Error creating reference file preview:', error);
        alert('Error processing reference file. Please try again.');
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    console.log('Files dropped:', files.length, files.map(f => ({ name: f.name, type: f.type, size: f.size })));
    
    if (files.length === 0) return;
    
    if (files.length > maxFileCount) {
      alert(`⚠️ Maximum ${maxFileCount} files allowed. Please select fewer files.`);
      return;
    }

    // Validate and process dropped files
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const validFiles = files.filter(file => {
      if (!validTypes.includes(file.type)) {
        alert(`⚠️ Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`);
        return false;
      }
      
      if (file.size > maxFileSize) {
        alert(`⚠️ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB.`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      try {
        const previews = validFiles.map(file => URL.createObjectURL(file));
        
        setSelectedFiles(validFiles);
        setFilePreviews(previews);
        
        // Update the hidden file input with the dropped files
        if (fileInputRef.current) {
          // Create a new DataTransfer object and add the files
          const dataTransfer = new DataTransfer();
          validFiles.forEach(file => dataTransfer.items.add(file));
          fileInputRef.current.files = dataTransfer.files;
        }
        
        console.log('Dropped files processed successfully:', validFiles.length);
      } catch (error) {
        console.error('Error processing dropped files:', error);
        alert('Error processing dropped files. Please try again.');
      }
    }
  }, [maxFileCount, maxFileSize]);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (selectedFiles.length === 0) {
      alert('Please select at least one image to enhance.');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    const startTime = Date.now();

    try {
      const formData = new FormData();
      
      // Debug: Log what we're about to send
      console.log('Submitting form with files:', selectedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })));
      console.log('Hidden input files:', fileInputRef.current?.files);
      console.log('Selected files are File instances:', selectedFiles.every(f => f instanceof File));
      
      // Append all selected images - use the actual File objects from selectedFiles
      selectedFiles.forEach((file, index) => {
        // Ensure we're using the actual File object, not a preview
        if (file instanceof File) {
          formData.append('image', file);
          console.log(`Appending file ${index + 1} to FormData:`, file.name, file.type, file.size);
        } else {
          console.error(`File ${index + 1} is not a File instance:`, file);
        }
      });

      // Append reference image if provided
      if (referenceFile) {
        if (referenceFile instanceof File) {
          formData.append('referenceImage', referenceFile);
          console.log('Appending reference file:', referenceFile.name, referenceFile.type, referenceFile.size);
        } else {
          console.error('Reference file is not a File instance:', referenceFile);
        }
      }

      // Append enhancement settings
      formData.append('enhancementType', 'luminosity');
      formData.append('enhancementStrength', 'moderate');

      // Debug: Log FormData contents
      console.log('FormData entries:');
      Array.from(formData.entries()).forEach(([key, value]) => {
        console.log(`${key}:`, value instanceof File ? `${value.name} (${value.type}, ${value.size} bytes)` : value);
      });

      // Verify files are actually in FormData
      const imageEntries = Array.from(formData.getAll('image'));
      console.log('Image entries in FormData:', imageEntries.length);
      imageEntries.forEach((entry, index) => {
        if (entry instanceof File) {
          console.log(`Image ${index + 1}:`, entry.name, entry.type, entry.size);
        } else {
          console.log(`Image ${index + 1}: Not a File instance:`, entry);
        }
      });

      const response = await fetch(getEndpointUrl('IMAGE_ENHANCEMENT'), {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let the browser set it automatically for FormData
      });

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
            originalImage: result.originalImage || filePreviews[0],
            enhancedImage: result.enhancedImage
          }]);
        } else {
          // Fallback to the old format
          setResults(result.data.enhancedImages || [result.data.enhancedImage]);
        }
      } else {
        alert(`Enhancement failed: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Enhancement error:', error);
      alert('Enhancement failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newPreviews = filePreviews.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    setFilePreviews(newPreviews);
  };

  const removeReferenceFile = () => {
    setReferenceFile(null);
    setReferencePreview(null);
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          ✨ Image Enhancement
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Enhance multiple images with AI-powered luminosity and color improvements
        </p>
      </div>

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
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${
                  isDragOver ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Upload className={`h-8 w-8 ${
                    isDragOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
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
            
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Select up to 20 images that need luminosity and color enhancement. Hold Ctrl/Cmd to select multiple files.
            </small>
            
            {/* Pro Tip - EXACTLY as in home.html */}
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded text-center text-gray-600 dark:text-gray-400 text-xs">
              💡 <strong>Pro Tip:</strong> You can also drag and drop multiple images here!
            </div>

            {/* File Counter - EXACTLY as in home.html */}
            {selectedFiles.length > 0 && (
              <div id="fileCounter" className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm">
                <span className="font-semibold text-blue-700 dark:text-blue-300">
                  {selectedFiles.length}
                </span> files selected
                <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                  {selectedFiles.length === 1 
                    ? `${selectedFiles[0].name} (${(selectedFiles[0].size / 1024 / 1024).toFixed(1)}MB)`
                    : `${selectedFiles.length} files, ${(totalSize / 1024 / 1024).toFixed(1)}MB total`
                  }
                </div>
              </div>
            )}
          </div>

          {/* Reference Image - Hidden in original but we'll show it */}
          <div className="form-group">
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
              <option value="moderate" selected>Moderate</option>
              <option value="strong">Strong</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              How much enhancement to apply to the image
            </small>
          </div>

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

      {/* File Preview */}
      {selectedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Selected Files ({selectedFiles.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative group">
                <img
                  src={filePreviews[index]}
                  alt={file.name}
                  className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                  <button
                    onClick={() => removeFile(index)}
                    className="opacity-0 group-hover:opacity-100 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-all duration-200"
                  >
                    ×
                  </button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {file.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reference Image Preview */}
      {referenceFile && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Reference Image
          </h3>
          <div className="relative inline-block">
            <img
              src={referencePreview || ''}
              alt={referenceFile.name}
              className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
            />
            <button
              onClick={removeReferenceFile}
              className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-all duration-200"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {referenceFile.name}
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎉 Enhancement Complete!
            </h3>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowOriginals(!showOriginals)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showOriginals ? 'Hide' : 'Show'} Originals
              </button>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                ⏱️ {processingTime / 1000}s
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  📸 {selectedFiles[index]?.name || `Image ${index + 1}`}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {showOriginals && (
                    <div className="text-center">
                      <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded mb-2">
                        BEFORE
                      </span>
                      <img
                        src={result.originalImage ? `${getBackendUrl()}${result.originalImage}` : filePreviews[index]}
                        alt="Original"
                        className="w-full rounded-lg shadow-md"
                      />
                    </div>
                  )}
                  <div className="text-center">
                    <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded mb-2">
                      AFTER
                    </span>
                    <img
                      src={result.enhancedImage ? `${getBackendUrl()}${result.enhancedImage}` : result}
                      alt="Enhanced"
                      className="w-full rounded-lg shadow-md"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-blue-800 dark:text-blue-200 text-sm">
              <strong>💡 Pro Tip:</strong> Right-click on images to save them to your computer!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEnhancement;
