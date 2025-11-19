import React, { useState } from 'react';
import { X, ArrowLeft, ArrowRight, Move, RotateCw, Film, Zap, Loader2 } from 'lucide-react';

export type CameraMovementType = 'truck_left' | 'pan_right' | 'tracking_shot' | 'bullet_time';

export interface CameraMovementOption {
  id: CameraMovementType;
  name: string;
  description: string;
  prompt: string;
  icon: React.ReactNode;
  visualIndicator: string; // Simple text description for visual movement
}

const cameraMovements: CameraMovementOption[] = [
  {
    id: 'truck_left',
    name: 'Truck Left',
    description: 'Camera moves left while keeping the subject in frame',
    prompt: '[Truck left]',
    icon: <ArrowLeft className="w-6 h-6" />,
    visualIndicator: '← Left Movement'
  },
  {
    id: 'pan_right',
    name: 'Pan Right',
    description: 'Camera rotates right to reveal more of the scene',
    prompt: '[Pan right]',
    icon: <ArrowRight className="w-6 h-6" />,
    visualIndicator: '→ Right Pan'
  },
  {
    id: 'tracking_shot',
    name: 'Tracking Shot',
    description: 'Camera follows the subject smoothly through the scene',
    prompt: '[Tracking shot]',
    icon: <Move className="w-6 h-6" />,
    visualIndicator: '↔ Follow Motion'
  },
  {
    id: 'bullet_time',
    name: 'Bullet Time Effect',
    description: 'Dramatic slow-motion camera orbit around the subject',
    prompt: '[Truck left, Pan right, Zoom in]',
    icon: <RotateCw className="w-6 h-6" />,
    visualIndicator: '⭕ Orbit Effect'
  }
];

interface CameraMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (movement: CameraMovementOption) => void;
  isGenerating?: boolean;
}

const CameraMovementModal: React.FC<CameraMovementModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  isGenerating = false
}) => {
  const [selectedMovement, setSelectedMovement] = useState<CameraMovementType | null>(null);

  if (!isOpen) return null;

  const handleSelect = (movement: CameraMovementOption) => {
    if (isGenerating) return;
    setSelectedMovement(movement.id);
    onSelect(movement);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Film className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Choose Camera Movement
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select the type of camera movement you want to apply to your image
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cameraMovements.map((movement) => {
              const isSelected = selectedMovement === movement.id;
              const isDisabled = isGenerating && !isSelected;

              return (
                <button
                  key={movement.id}
                  onClick={() => handleSelect(movement)}
                  disabled={isDisabled}
                  className={`
                    relative p-6 rounded-xl border-2 transition-all duration-200 text-left
                    ${isSelected
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg scale-105'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md'
                    }
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`
                    w-14 h-14 rounded-lg flex items-center justify-center mb-4 transition-colors
                    ${isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }
                  `}>
                    {movement.icon}
                  </div>

                  {/* Visual Movement Indicator */}
                  <div className="mb-3">
                    <div className={`
                      inline-block px-3 py-1 rounded-full text-xs font-semibold
                      ${isSelected
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }
                    `}>
                      {movement.visualIndicator}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className={`
                    text-xl font-bold mb-2
                    ${isSelected
                      ? 'text-indigo-900 dark:text-indigo-100'
                      : 'text-gray-900 dark:text-white'
                    }
                  `}>
                    {movement.name}
                  </h3>

                  {/* Description */}
                  <p className={`
                    text-sm leading-relaxed
                    ${isSelected
                      ? 'text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-600 dark:text-gray-400'
                    }
                  `}>
                    {movement.description}
                  </p>

                  {/* Animated Arrow Indicator */}
                  <div className="mt-4 flex items-center justify-center">
                    <div className={`
                      relative w-20 h-12 border-2 rounded-lg overflow-hidden
                      ${isSelected
                        ? 'border-indigo-400 dark:border-indigo-500'
                        : 'border-gray-300 dark:border-gray-600'
                      }
                    `}>
                      {/* Movement Animation */}
                      <div className={`
                        absolute inset-0 flex items-center justify-center
                        ${movement.id === 'truck_left' ? 'animate-pulse' : ''}
                        ${movement.id === 'pan_right' ? 'animate-bounce' : ''}
                        ${movement.id === 'tracking_shot' ? 'animate-pulse' : ''}
                        ${movement.id === 'bullet_time' ? 'animate-spin' : ''}
                      `}>
                        {movement.id === 'truck_left' && (
                          <ArrowLeft className={`
                            w-6 h-6
                            ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}
                            animate-[slide-left_1s_ease-in-out_infinite]
                          `} />
                        )}
                        {movement.id === 'pan_right' && (
                          <ArrowRight className={`
                            w-6 h-6
                            ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}
                            animate-[slide-right_1s_ease-in-out_infinite]
                          `} />
                        )}
                        {movement.id === 'tracking_shot' && (
                          <Move className={`
                            w-6 h-6
                            ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}
                            animate-[move-horizontal_2s_ease-in-out_infinite]
                          `} />
                        )}
                        {movement.id === 'bullet_time' && (
                          <RotateCw className={`
                            w-6 h-6
                            ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}
                            animate-spin
                          `} />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating video with selected movement...
                </span>
              ) : (
                'Click on a movement type to apply it to your image'
              )}
            </p>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes slide-left {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-8px); }
        }
        @keyframes slide-right {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
        @keyframes move-horizontal {
          0%, 100% { transform: translateX(-8px); }
          50% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
};

export default CameraMovementModal;

