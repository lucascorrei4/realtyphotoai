import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import WorkflowGuideModal from './WorkflowGuideModal';

interface HowItWorksButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
}

const HowItWorksButton: React.FC<HowItWorksButtonProps> = ({ 
  className = '',
  variant = 'default'
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const baseStyles = "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200";
  
  const variantStyles = {
    default: "bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg",
    outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-blue-400 dark:border-blue-400",
    ghost: "text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-blue-400"
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        aria-label="How it works"
      >
        <HelpCircle className="h-4 w-4" />
        <span>How it works</span>
      </button>

      <WorkflowGuideModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

export default HowItWorksButton;

