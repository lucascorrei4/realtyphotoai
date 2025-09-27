import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { getEndpointUrl, getBackendUrl } from '../config/api';
import { authenticatedFormDataFetch } from '../utils/apiUtils';
import StatsWidget from '../components/StatsWidget';
import { RecentGenerationsWidget } from '../components';
import { useAuth } from '../contexts/AuthContext';

interface InteriorDesignRequest {
  id: string;
  roomType: string;
  style: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  image?: string;
  result?: string;
}

const InteriorDesign: React.FC = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [roomType, setRoomType] = useState('living-room');
  const [style, setStyle] = useState('modern-minimalist');
  const [prompt, setPrompt] = useState('Modern minimalist living room with clean lines, comfortable seating, coffee table, plants, and warm lighting');
  const [negativePrompt, setNegativePrompt] = useState('lowres, watermark, banner, logo, text, deformed, blurry, out of focus, surreal, ugly, functional');
  const [guidance, setGuidance] = useState(15);
  const [steps, setSteps] = useState(50);
  const [strength, setStrength] = useState(0.8);
  const [useInteriorDesign, setUseInteriorDesign] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<any[]>([]);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [requests, setRequests] = useState<InteriorDesignRequest[]>([]);

  // Auto-generate prompt when room type or style changes
  useEffect(() => {
    if (useInteriorDesign) {
      generateRoomSpecificPrompt();
    }
  }, [roomType, style, useInteriorDesign]);

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

    const file = files[0]; // Take first file for interior design

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
  }, []);

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const generateRoomSpecificPrompt = () => {
    const roomSpecificPrompts: Record<string, Record<string, string>> = {
      'living-room': {
        'modern-minimalist': 'Modern minimalist living room with clean lines, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and plants. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'traditional-elegant': 'Traditional elegant living room with classic furniture, rich textures, fireplace, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'contemporary-luxury': 'Contemporary luxury living room with premium materials, statement lighting, comfortable seating arrangement, coffee table, area rug, ambient lighting and floor lamps, wall art and throw blankets. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'cozy-rustic': 'Cozy rustic living room with natural wood elements, stone fireplace, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and plants. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'scandinavian': 'Scandinavian living room with light wood, neutral colors, comfortable seating arrangement, coffee table, area rug, natural light and ambient lighting, plants and throw blankets. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'industrial-chic': 'Industrial chic living room with exposed brick, metal accents, comfortable seating arrangement, coffee table, area rug, ambient lighting and floor lamps, wall art and accent chairs. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'coastal-calm': 'Coastal calm living room with light blues, natural textures, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, plants and throw blankets. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'bohemian-eclectic': 'Bohemian eclectic living room with mixed patterns, vibrant colors, comfortable seating arrangement, coffee table, area rug, ambient lighting and floor lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mid-century-modern': 'Mid-century modern living room with retro furniture, clean geometry, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and accent chairs. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'french-country': 'French country living room with elegant antiques, soft colors, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'asian-zen': 'Asian zen living room with natural materials, balanced proportions, comfortable seating arrangement, coffee table, area rug, ambient lighting and natural light, plants and wall art. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mediterranean': 'Mediterranean living room with warm colors, arched elements, comfortable seating arrangement, coffee table, area rug, ambient lighting and table lamps, wall art and decorative pillows. The space should feel welcoming and social space perfect for entertaining and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.'
      },
      'bedroom': {
        'modern-minimalist': 'Modern minimalist bedroom with clean lines, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'traditional-elegant': 'Traditional elegant bedroom with classic furniture, warm wood tones, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'contemporary-luxury': 'Contemporary luxury bedroom with premium materials, sophisticated design, bed with quality bedding, nightstands, dresser, bedside lamps and dimmable fixtures, decorative pillows and personal touches. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'cozy-rustic': 'Cozy rustic bedroom with natural wood elements, warm textures, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'scandinavian': 'Scandinavian bedroom with light wood, neutral colors, bed with quality bedding, nightstands, dresser, natural light and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'industrial-chic': 'Industrial chic bedroom with exposed elements, metal fixtures, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'coastal-calm': 'Coastal calm bedroom with light blues, natural textures, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'bohemian-eclectic': 'Bohemian eclectic bedroom with mixed patterns, vibrant colors, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and personal touches. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mid-century-modern': 'Mid-century modern bedroom with retro furniture, clean geometry, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'french-country': 'French country bedroom with elegant antiques, soft colors, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and window treatments. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'asian-zen': 'Asian zen bedroom with natural materials, balanced proportions, bed with quality bedding, nightstands, dresser, bedside lamps and natural light, decorative pillows and area rug. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mediterranean': 'Mediterranean bedroom with warm colors, arched elements, bed with quality bedding, nightstands, dresser, bedside lamps and ambient lighting, decorative pillows and personal touches. The space should feel peaceful and restful sanctuary for sleep and relaxation. Professionally staged, perfect lighting, high-end photography, realistic proportions.'
      },
      'kitchen': {
        'modern-minimalist': 'Modern minimalist kitchen with clean lines, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, decorative bowls and fresh flowers. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'traditional-elegant': 'Traditional elegant kitchen with classic design, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, decorative bowls and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'contemporary-luxury': 'Contemporary luxury kitchen with premium materials, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, decorative bowls and artwork. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'cozy-rustic': 'Cozy rustic kitchen with natural wood elements, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'scandinavian': 'Scandinavian kitchen with light wood, neutral colors, modern appliances, clean countertops, stylish backsplash, natural light and pendant lighting, fresh flowers and decorative bowls. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'industrial-chic': 'Industrial chic kitchen with exposed elements, metal fixtures, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, artwork and decorative bowls. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'coastal-calm': 'Coastal calm kitchen with light blues, natural textures, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'bohemian-eclectic': 'Bohemian eclectic kitchen with mixed patterns, vibrant colors, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and artwork. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mid-century-modern': 'Mid-century modern kitchen with retro design, modern appliances, clean countertops, stylish backsplash, pendant lighting and under-cabinet lighting, decorative bowls and fresh flowers. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'french-country': 'French country kitchen with elegant design, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'asian-zen': 'Asian zen kitchen with natural materials, balanced proportions, modern appliances, clean countertops, stylish backsplash, natural light and pendant lighting, fresh flowers and decorative bowls. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.',
        'mediterranean': 'Mediterranean kitchen with warm colors, arched elements, modern appliances, clean countertops, stylish backsplash, pendant lighting and natural light, fresh flowers and herb garden. The space should feel functional and beautiful space perfect for cooking and gathering. Professionally staged, perfect lighting, high-end photography, realistic proportions.'
      }
    };

    const roomPrompts = roomSpecificPrompts[roomType];
    if (roomPrompts && roomPrompts[style]) {
      setPrompt(roomPrompts[style]);
    } else {
      const fallbackPrompt = style.replace('-', ' ') + ' ' + roomType.replace('-', ' ') + ' with beautiful furniture, modern decor, and elegant lighting. The space should feel welcoming and professionally designed.';
      setPrompt(fallbackPrompt);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
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
      formData.append('roomType', roomType);
      formData.append('style', style);
      formData.append('prompt', prompt);
      formData.append('negativePrompt', negativePrompt);
      formData.append('guidance', guidance.toString());
      formData.append('steps', steps.toString());
      formData.append('strength', strength.toString());

      // Choose endpoint based on user preference
      const endpoint = useInteriorDesign ? '/api/v1/interior-design' : '/api/v1/process-image';

      const response = await authenticatedFormDataFetch(endpoint, formData);

      const result = await response.json();

      if (result.success) {
        // Set results for immediate display
        setResults([{
          originalImage: result.originalImage,
          processedImage: result.processedImage,
          roomType: roomType,
          style: style,
          prompt: prompt
        }]);
        setProcessingTime(result.processingTime || 0);

        // Add new request to the list
        const newRequest: InteriorDesignRequest = {
          id: Date.now().toString(),
          roomType,
          style,
          prompt,
          status: 'completed',
          createdAt: new Date().toISOString(),
          image: result.originalImage,
          result: result.processedImage
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

  return (
    <div className="space-y-6">
      {/* Stats Widget */}
      <StatsWidget
        modelType="interior_design"
        title="🏠 Interior Design"
        description="Transform empty rooms into beautifully decorated spaces using AI!"
        userId={user?.id}
      />

      {/* Form - Matching home.html structure exactly */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Room Image Upload - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="image" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              📸 Room Image (JPG/PNG/WebP/HEIC)
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              id="image"
              accept="image/jpeg,image/png,image/webp,image/heic"
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
                    {isDragOver ? 'Drop room image here' : 'Click to select or drag & drop'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Upload a photo of an empty or cluttered room
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
                    Choose File
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* File Preview */}
          {selectedFile && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Selected Room Image
              </h3>
              <div className="relative inline-block">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt={selectedFile.name}
                  className="w-64 h-48 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600"
                />
                <button
                  onClick={() => setSelectedFile(null)}
                  className="w-10 h-10 absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-all duration-200"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
              </p>
            </div>
          )}

          {/* Room Type - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="roomType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🏠 Room Type
            </label>
            <select
              id="roomType"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="living-room">Living Room</option>
              <option value="bedroom">Bedroom</option>
              <option value="kitchen">Kitchen</option>
              <option value="bathroom">Bathroom</option>
              <option value="dining-room">Dining Room</option>
              <option value="office">Home Office</option>
              <option value="garden">Garden</option>
              <option value="backyard">Backyard</option>
              <option value="entryway">Entryway</option>
              <option value="basement">Basement</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Select the type of room you want to transform
            </small>
          </div>

          {/* Decoration Style - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="style" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎨 Decoration Style
            </label>
            <select
              id="style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="modern-minimalist">Modern Minimalist</option>
              <option value="traditional-elegant">Traditional Elegant</option>
              <option value="contemporary-luxury">Contemporary Luxury</option>
              <option value="cozy-rustic">Cozy Rustic</option>
              <option value="scandinavian">Scandinavian</option>
              <option value="industrial-chic">Industrial Chic</option>
              <option value="coastal-calm">Coastal Calm</option>
              <option value="bohemian-eclectic">Bohemian Eclectic</option>
              <option value="mid-century-modern">Mid-Century Modern</option>
              <option value="french-country">French Country</option>
              <option value="asian-zen">Asian Zen</option>
              <option value="mediterranean">Mediterranean</option>
            </select>
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Choose your preferred interior design style
            </small>
          </div>

          {/* Custom Description - EXACTLY as in home.html */}
          <div className="form-group">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ✨ Custom Description (Optional)
            </label>
            <textarea
              id="prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the furniture and decor to add..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Hidden fields that match the original form structure - EXACTLY as in home.html */}
          <div className="form-group" style={{ display: 'none' }}>
            <label htmlFor="negativePrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🚫 Negative Prompt (Optional)
            </label>
            <textarea
              id="negativePrompt"
              rows={2}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Describe what to avoid in the image..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Elements to avoid in the generated image
            </small>
          </div>

          <div style={{ display: 'none' }}>
            <div className="form-group">
              <label htmlFor="guidance" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🎯 AI Guidance (1-20)
              </label>
              <input
                type="number"
                id="guidance"
                value={guidance}
                onChange={(e) => setGuidance(parseFloat(e.target.value))}
                step="0.1"
                min="1"
                max="20"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <small className="text-gray-500 dark:text-gray-400 mt-1 block">
                Higher = follows prompt more closely (optimized: 15)
              </small>
            </div>

            <div className="form-group" style={{ display: 'none' }}>
              <label htmlFor="steps" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ⚡ Processing Steps (10-50)
              </label>
              <input
                type="number"
                id="steps"
                value={steps}
                onChange={(e) => setSteps(parseInt(e.target.value))}
                min="10"
                max="50"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <small className="text-gray-500 dark:text-gray-400 mt-1 block">
                Higher = better quality, slower (optimized: 50)
              </small>
            </div>
          </div>

          <div className="form-group" style={{ display: 'none' }}>
            <label htmlFor="strength" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              🎨 Prompt Strength (0.1-1.0)
            </label>
            <input
              type="number"
              id="strength"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              step="0.05"
              min="0.1"
              max="1.0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <small className="text-gray-500 dark:text-gray-400 mt-1 block">
              Higher = stronger prompt influence (optimized: 0.8)
            </small>
          </div>

          {/* Interior Design Model Checkbox - EXACTLY as in home.html */}
          <div className="form-group" style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '2px solid #e9ecef', display: 'none' }}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                id="useInteriorDesign"
                checked={useInteriorDesign}
                onChange={(e) => setUseInteriorDesign(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                🏠 Use Interior Design Model (Recommended)
              </span>
            </label>
            <small className="text-gray-600 dark:text-gray-400 block mt-2 ml-7">
              ✓ Specialized for room transformation and furniture placement<br />
              ✓ Better results for interior design tasks<br />
              ✓ Uses the latest adirik/interior-design model
            </small>
          </div>

          {/* Submit Button - EXACTLY as in home.html */}
          <button
            type="submit"
            disabled={!selectedFile || isProcessing}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isProcessing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              '🚀 Transform Room with AI'
            )}
          </button>
        </form>
      </div>



      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎉 Room Transformation Complete!
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              ⏱️ {processingTime / 1000}s
            </div>
          </div>

          <div className="space-y-6">
            {results.map((result, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  🏠 {result.roomType.replace('-', ' ')} - {result.style.replace('-', ' ')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center">
                    <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium rounded mb-2">
                      BEFORE
                    </span>
                    <img
                      src={`${getBackendUrl()}${result.originalImage}`}
                      alt="Original Room"
                      className="w-full rounded-lg shadow-md"
                    />
                  </div>
                  <div className="text-center">
                    <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-medium rounded mb-2">
                      AFTER
                    </span>
                    <img
                      src={`${getBackendUrl()}${result.processedImage}`}
                      alt="Transformed Room"
                      className="w-full rounded-lg shadow-md"
                    />
                  </div>
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    <strong>🏠 Room Type:</strong> {result.roomType.replace('-', ' ')}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    <strong>🎨 Style:</strong> {result.style.replace('-', ' ')}
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                    <strong>✨ Prompt:</strong> {result.prompt.substring(0, 100)}...
                  </p>
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
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(request.status)}`}>
                      {request.status}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Room Type</span>
                    <p className="text-sm text-gray-900 dark:text-white">{request.roomType.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Style</span>
                    <p className="text-sm text-gray-900 dark:text-white">{request.style.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prompt</span>
                    <p className="text-sm text-gray-900 dark:text-white truncate">{request.prompt.substring(0, 50)}...</p>
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

      {/* Recent Generations Widget */}
      <RecentGenerationsWidget
        userId={user?.id}
        title="Interior Design Generations"
        description="View your latest interior design transformations with before/after comparisons"
        showFilters={false}
        maxItems={10}
        className="mt-6"
        modelTypeFilter="interior_design"
      />
    </div>
  );
};

export default InteriorDesign;
