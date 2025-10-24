import React, { useState, useEffect, useRef } from 'react';
import { createImagePreview, revokeImagePreview } from '../utils/imagePreview';

interface ImagePreviewProps {
  file: File;
  className?: string;
  showRemoveButton?: boolean;
  onRemove?: () => void;
  alt?: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  file,
  className = "w-full h-32 sm:h-40 md:h-48 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-600",
  showRemoveButton = true,
  onRemove,
  alt
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const generatePreview = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const url = await createImagePreview(file);
        
        if (isMounted) {
          // Clean up previous URL if it exists
          if (currentUrlRef.current) {
            revokeImagePreview(currentUrlRef.current);
          }
          
          currentUrlRef.current = url;
          setPreviewUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error creating image preview:', err);
        if (isMounted) {
          setError('Failed to create preview');
          setIsLoading(false);
        }
      }
    };

    generatePreview();

    return () => {
      isMounted = false;
      // Clean up the current preview URL when component unmounts or file changes
      if (currentUrlRef.current) {
        revokeImagePreview(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, [file]);

  const handleRemove = () => {
    if (currentUrlRef.current) {
      revokeImagePreview(currentUrlRef.current);
      currentUrlRef.current = null;
    }
    if (onRemove) {
      onRemove();
    }
  };

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-700`}>
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800`}>
        <div className="text-center p-2">
          <div className="text-red-600 dark:text-red-400 text-xs sm:text-sm">Preview Error</div>
          <div className="text-red-500 dark:text-red-500 text-xs mt-1 truncate">{file.name}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block group">
      <img
        src={previewUrl || ''}
        alt={alt || file.name}
        className={className}
        onError={() => setError('Failed to load image')}
      />
      {showRemoveButton && (
        <button
          onClick={handleRemove}
          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white p-1.5 sm:p-2 rounded-full transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-110"
          aria-label="Remove image"
          title="Remove image"
        >
          {/* Trash Icon SVG */}
          <svg 
            className="w-3 h-3 sm:w-4 sm:h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ImagePreview;
