import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Palette, Replace } from 'lucide-react';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleNavigate('/image-enhancement')}
          className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
        >
          <Image className="h-6 w-6 text-gray-400 group-hover:text-blue-500 mr-2 transition-colors" />
          <span className="text-gray-600 dark:text-gray-400 group-hover:text-blue-600 transition-colors">Enhance Images</span>
        </button>

        <button
          onClick={() => handleNavigate('/interior-design')}
          className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-400 dark:hover:border-purple-500 transition-colors group"
        >
          <Palette className="h-6 w-6 text-gray-400 group-hover:text-purple-500 mr-2 transition-colors" />
          <span className="text-gray-600 dark:text-gray-400 group-hover:text-purple-600 transition-colors">Interior Design</span>
        </button>

        <button
          onClick={() => handleNavigate('/replace-elements')}
          className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-400 dark:hover:border-green-500 transition-colors group"
        >
          <Replace className="h-6 w-6 text-gray-400 group-hover:text-green-500 mr-2 transition-colors" />
          <span className="text-gray-600 dark:text-gray-400 group-hover:text-green-600 transition-colors">Replace Elements</span>
        </button>
      </div>
    </div>
  );
};

export default QuickActions;
