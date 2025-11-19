import toast from 'react-hot-toast';

export const useToast = () => {
  const showSuccess = (message: string) => {
    toast.success(message);
  };

  const showError = (message: string) => {
    toast.error(message);
  };

  const showLoading = (message: string) => {
    return toast.loading(message);
  };

  const showInfo = (message: string) => {
    return toast(message, {
      icon: 'ℹ️',
      style: {
        background: '#3B82F6',
        color: '#fff',
      },
    });
  };

  const showWarning = (message: string) => {
    return toast(message, {
      icon: '⚠️',
      style: {
        background: '#F59E0B',
        color: '#fff',
      },
    });
  };

  const dismiss = (toastId?: string) => {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  };

  const updateToast = (toastId: string, message: string, type: 'success' | 'error' | 'loading' | 'warning' = 'success') => {
    if (type === 'warning') {
      toast(message, { 
        id: toastId,
        icon: '⚠️',
        style: {
          background: '#F59E0B',
          color: '#fff',
        },
      });
    } else {
      toast[type](message, { id: toastId });
    }
  };

  return {
    showSuccess,
    showError,
    showLoading,
    showInfo,
    showWarning,
    dismiss,
    updateToast,
  };
};


