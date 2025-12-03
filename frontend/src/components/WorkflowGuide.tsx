import React from 'react';
import { Image, Video, ArrowRight, Sparkles, Camera, Zap } from 'lucide-react';

interface WorkflowGuideProps {
  className?: string;
  showTitle?: boolean;
}

const WorkflowGuide: React.FC<WorkflowGuideProps> = ({ className = '', showTitle = true }) => {
  const isModalMode = className.includes('bg-transparent') || className.includes('border-0');
  
  return (
    <div className={`${isModalMode ? '' : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800'} p-6 md:p-8 ${className}`}>
      {showTitle && !isModalMode && (
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
            How It Works
          </h3>
        </div>
      )}

      <div className="space-y-6">
        {/* Step 1: Generate Image */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
          <div className="flex-shrink-0 flex items-center gap-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                1
              </div>
              <div className="w-0.5 h-8 bg-blue-300 dark:bg-blue-700 md:hidden"></div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <Image className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Generate Your Image
            </h4>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-300">
              First, create your enhanced image using this service. Upload your photo and customize the settings to get the perfect result.
            </p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center md:justify-start md:ml-20">
          <ArrowRight className="h-6 w-6 text-blue-500 rotate-90 md:rotate-0" />
        </div>

        {/* Step 2: Animate Image */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
          <div className="flex-shrink-0 flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
              2
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <Video className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Animate Your Image
            </h4>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 mb-4">
              Once your image is ready, you can bring it to life with animation. Choose from two options:
            </p>
            
            {/* Animation Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Animate Scene */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <h5 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    Animate Scene
                  </h5>
                </div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  Add natural motion to your scene - perfect for showcasing dynamic elements and creating engaging content.
                </p>
              </div>

              {/* Drone View */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                  <h5 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    Drone View
                  </h5>
                </div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                  Apply cinematic camera movements - pan, zoom, and orbit around your image for professional drone-like footage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>💡 Tip:</strong> After generating your image, you'll find animation options in the "Recent Generations" section below. Simply click "Animate Scene" or "Drone View" on any completed generation.
        </p>
      </div>
    </div>
  );
};

export default WorkflowGuide;

