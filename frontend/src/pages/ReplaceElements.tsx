import React, { useState, useCallback, useRef } from 'react';
import { Palette, Upload, Sparkles, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { getEndpointUrl, getBackendUrl } from '../config/api';

interface ElementReplacementRequest {
  id: string;
  prompt: string;
  outputFormat: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  image?: string;
  result?: string;
}

const ReplaceElements: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('Replace the floor for a modern black mirror floor');
  const [outputFormat, setOutputFormat] = useState('jpg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<any[]>([]);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [requests, setRequests] = useState<ElementReplacementRequest[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
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

    const file = files[0]; // Take first file
    console.log('Processing dropped file:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Validate file type and size
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      alert(`⚠️ Invalid file type: ${file.name}. Please select only JPG, PNG, WebP, or HEIC files.`);
      return;
    }

    if (file.size > maxFileSize) {
      alert(`⚠️ File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`);
      return;
    }

    setSelectedFile(file);
    console.log('Dropped file set successfully:', file.name);
  }, []);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      alert('Please select an image to transform.');
      return;
    }

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('prompt', prompt);
      formData.append('outputFormat', outputFormat);

      const response = await fetch(getEndpointUrl('REPLACE_ELEMENTS'), {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        // Set results for immediate display
        setResults([{
          originalImage: result.data.originalImage,
          replacedImage: result.data.replacedImage,
          prompt: prompt,
          outputFormat: outputFormat
        }]);
        setProcessingTime(result.data.processingTime || 0);

        // Add new request to the list
        const newRequest: ElementReplacementRequest = {
          id: Date.now().toString(),
          prompt,
          outputFormat,
          status: 'completed',
          createdAt: new Date().toISOString(),
          image: result.data.originalImage,
          result: result.data.replacedImage
        };
        setRequests(prev => [newRequest, ...prev]);

        // Reset form
        setSelectedFile(null);
        setIsProcessing(false);
      } else {
        alert(`Transformation failed: ${result.message || result.error}`);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Transformation error:', error);
      alert('Transformation failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'processing':
        return <Sparkles className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          🎨 Replace Elements
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Transform images by replacing elements or changing styles using AI
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-500 rounded-full">
              <Palette className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{requests.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-500 rounded-full">
              <Clock className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {requests.filter(r => r.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-500 rounded-full">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Processing</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {requests.filter(r => r.status === 'processing').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-500 rounded-full">
              <CheckCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {requests.filter(r => r.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form - Matching home.html structure exactly */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Upload - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="replaceElementsImage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📸 Image to Transform (JPG/PNG/WebP/HEIC)
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              id="replaceElementsImage"
              accept="image/jpeg,image/png,image/webp,image/heic"
              onChange={handleFileSelect}
              className="hidden"
              required
            />

            {/* Modern drag & drop area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer ${isDragOver
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={openFileDialog}
            >
              <div className="flex flex-col items-center space-y-4">
                <div className={`p-3 rounded-full ${isDragOver ? 'bg-purple-100 dark:bg-purple-800' : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                  <Upload className={`h-8 w-8 ${isDragOver ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'
                    }`} />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {isDragOver ? 'Drop image here' : 'Click to select or drag & drop'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload an image where you want to replace elements or change the style
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Supports JPG, PNG, WebP, and HEIC formats
                  </p>
                </div>

                {!isDragOver && (
                  <button
                    type="button"
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFileDialog();
                    }}
                  >
                    Choose File
                  </button>
                )}
              </div>
            </div>

            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Upload an image where you want to replace elements or change the style
            </small>
          </div>

          {/* Transformation Prompt - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="replacePrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎨 Transformation Prompt
            </label>
            <textarea
              id="replacePrompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe how you want to transform the image..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Describe the style, theme, or elements you want to replace (e.g., "Make this a cyberpunk scene", "Transform into watercolor painting")
            </small>
          </div>

          {/* Output Format - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="outputFormat" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📁 Output Format
            </label>
            <select
              id="outputFormat"
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="jpg" selected>JPEG (JPG)</option>
              <option value="png">PNG</option>
              <option value="webp">WebP</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Choose the output format for your transformed image
            </small>
          </div>

          {/* Model Information - EXACTLY as in home.html */}
          <div className="form-group" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '2px solid #e9ecef' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                🎨 Flux Kontext Pro Model
              </span>
            </label>
            <small className="text-gray-600 dark:text-gray-400 block mt-2">
              ✓ Advanced AI model for element replacement and style transfer<br />
              ✓ Can transform images into different artistic styles<br />
              ✓ Maintains image structure while changing appearance<br />
              ✓ Perfect for creative transformations and style experiments
            </small>
          </div>

          {/* Submit Button - EXACTLY as in home.html */}
          <button
            type="submit"
            disabled={!selectedFile || isProcessing}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              '🎨 Transform Image'
            )}
          </button>
        </form>
      </div>

      {/* File Preview */}
      {selectedFile && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Selected Image to Transform
          </h3>
          <div className="relative inline-block">
            <img
              src={URL.createObjectURL(selectedFile)}
              alt={selectedFile.name}
              className="w-64 h-48 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
            />
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-all duration-200"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎉 Transformation Complete!
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              ⏱️ {processingTime / 1000}s
            </div>
          </div>

          <div className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  🎨 {result.prompt}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded mb-2">
                      BEFORE
                    </span>
                    <img
                      src={`${getBackendUrl()}${result.originalImage}`}
                      alt="Original"
                      className="w-full rounded-lg shadow-md"
                    />
                  </div>
                  <div className="text-center">
                    <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded mb-2">
                      AFTER
                    </span>
                    <img
                      src={`${getBackendUrl()}${result.replacedImage}`}
                      alt="Transformed"
                      className="w-full rounded-lg shadow-md"
                    />
                  </div>
                </div>
                <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                  <p className="text-purple-800 dark:text-purple-200 text-sm">
                    <strong>🎨 Prompt:</strong> {result.prompt}
                  </p>
                  <p className="text-purple-700 dark:text-purple-300 text-xs mt-1">
                    <strong>📁 Output Format:</strong> {result.outputFormat.toUpperCase()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <p className="text-purple-800 dark:text-purple-200 text-sm">
              <strong>💡 Pro Tip:</strong> Right-click on images to save them to your computer!
            </p>
          </div>
        </div>
      )}

      {/* Recent Requests */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Recent Requests
          </h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                      {getStatusIcon(request.status)}
                      <span className="ml-1">{request.status}</span>
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prompt</span>
                    <p className="text-sm text-gray-900 dark:text-white truncate">{request.prompt}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Output Format</span>
                    <p className="text-sm text-gray-900 dark:text-white uppercase">{request.outputFormat}</p>
                  </div>
                </div>

                {request.image && request.result && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center">
                      <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded mb-2">
                        BEFORE
                      </span>
                      <img
                        src={`${getBackendUrl()}${request.image}`}
                        alt="Original"
                        className="w-full rounded-lg shadow-md"
                      />
                    </div>
                    <div className="text-center">
                      <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded mb-2">
                        AFTER
                      </span>
                      <img
                        src={`${getBackendUrl()}${request.result}`}
                        alt="Transformed"
                        className="w-full rounded-lg shadow-md"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplaceElements;
