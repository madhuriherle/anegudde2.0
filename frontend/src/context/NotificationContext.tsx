import React, { createContext, useContext, useCallback } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// Custom styles to match a modern Tailwind look
const swalStyles = `
  .swal2-container {
    z-index: 10000 !important;
    pointer-events: auto !important;
  }
  .swal2-backdrop-show {
    pointer-events: auto !important;
  }
  .swal2-simple-popup {
    border-radius: 24px !important;
    font-family: inherit !important;
    padding: 1.5rem !important;
    background: #FFFDF9 !important;
    border: 1px solid #E7D5C3 !important;
    box-shadow: 0 20px 50px rgba(62,39,35,0.18) !important;
    pointer-events: auto !important;
  }

  .swal2-temple-title {
    font-size: 24px !important;
    font-family: "Merriweather", serif !important;
    font-weight: 700 !important;
    color: #3E2723 !important;
    letter-spacing: 0 !important;
  }

  .swal2-temple-text {
    font-size: 15px !important;
    color: #7A5C4D !important;
    line-height: 1.6 !important;
  }

  .swal2-temple-icon.swal2-warning {
    color: #D18B47 !important;
    border-color: #E9B88A !important;
  }

  .swal2-temple-actions .swal2-styled {
    border-radius: 12px !important;
    padding: 0.75rem 1.25rem !important;
    font-weight: 700 !important;
    box-shadow: none !important;
  }

  .swal2-cancel-temple {
    background: #F3E9DC !important;
    color: #5D4037 !important;
    border: 1px solid #E4D2BD !important;
    box-shadow: none !important;
    font-weight: 700 !important;
  }

  .swal2-cancel-temple:hover {
    background: #EEDFCB !important;
  }

  .swal2-confirm-temple {
    background: #A14D2A !important;
    color: #fff !important;
    border: 1px solid #A14D2A !important;
  }

  .swal2-confirm-temple:hover {
    background: #8B3E1F !important;
    border-color: #8B3E1F !important;
  }
`;

interface NotificationContextType {
  showNotification: (message: string, severity?: 'success' | 'error' | 'warning' | 'info') => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showConfirm: (title: string, message: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const showNotification = useCallback((msg: string, sev: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const Toast = MySwal.mixin({
      toast: true,
      position: 'bottom-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });

    Toast.fire({
      icon: sev,
      title: msg,
      customClass: {
        popup: 'swal2-simple-popup !rounded-lg !p-4 !shadow-lg',
        title: '!text-sm !m-0 !font-bold'
      }
    });
  }, []);

  const showSuccess = useCallback((msg: string) => {
    MySwal.fire({
      icon: 'success',
      title: 'Success!',
      text: msg,
      timer: 2000,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: {
        popup: 'swal2-simple-popup',
      }
    });
  }, []);

  const showError = useCallback((msg: string) => {
    MySwal.fire({
      icon: 'error',
      title: 'Oops...',
      text: msg,
      confirmButtonColor: '#040b6b',
      customClass: {
        popup: 'swal2-simple-popup',
      }
    });
  }, []);

  const showConfirm = useCallback(async (
    title: string, 
    message: string, 
    confirmText: string = 'Yes, Continue', 
    cancelText: string = 'No, Cancel'
  ) => {
    const result = await MySwal.fire({
      title: title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#A14D2A',
      cancelButtonColor: '#F4E7D8',
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
      allowOutsideClick: false,
      allowEscapeKey: false,
      backdrop: true,
      customClass: {
        popup: 'swal2-simple-popup',
        container: 'swal2-container',
        title: 'swal2-temple-title',
        htmlContainer: 'swal2-temple-text',
        icon: 'swal2-temple-icon',
        actions: 'swal2-temple-actions',
        cancelButton: 'swal2-cancel-temple',
        confirmButton: 'swal2-confirm-temple'
      }
    });
    return result.isConfirmed;
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, showSuccess, showError, showConfirm }}>
      <style>{swalStyles}</style>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
