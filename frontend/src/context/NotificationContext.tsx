import React, { createContext, useContext, useCallback } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Snackbar, Alert } from '@mui/material';
import type { AlertColor } from '@mui/material';

const MySwal = withReactContent(Swal);

// Custom styles to match the "simple" look from the screenshot
const swalStyles = `
  .swal2-container {
    z-index: 10000 !important;
  }
  .swal2-simple-popup {
    border-radius: 12px !important;
    font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif !important;
  }
  .swal2-simple-popup .swal2-title {
    font-size: 1.8rem !important;
    font-weight: 600 !important;
    color: #444 !important;
  }
  .swal2-simple-popup .swal2-html-container {
    font-size: 1.1rem !important;
    color: #777 !important;
  }
  .swal2-simple-popup .swal2-confirm, 
  .swal2-simple-popup .swal2-cancel {
    border-radius: 8px !important;
    font-weight: bold !important;
    padding: 12px 24px !important;
    font-size: 1rem !important;
  }
`;

interface NotificationContextType {
  showNotification: (message: string, severity?: AlertColor) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showConfirm: (title: string, message: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [severity, setSeverity] = React.useState<AlertColor>('info');

  const showNotification = useCallback((msg: string, sev: AlertColor = 'info') => {
    setMessage(msg);
    setSeverity(sev);
    setOpen(true);
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
      confirmButtonColor: '#81d4fa', // Light blue to match simple theme
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
      confirmButtonColor: '#81d4fa', // Light blue from screenshot
      cancelButtonColor: '#cccccc', // Grey from screenshot
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true, // Cancel on left, Confirm on right
      customClass: {
        popup: 'swal2-simple-popup',
      }
    });
    return result.isConfirmed;
  }, []);

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  return (
    <NotificationContext.Provider value={{ showNotification, showSuccess, showError, showConfirm }}>
      <style>{swalStyles}</style>
      {children}
      <Snackbar 
        open={open} 
        autoHideDuration={4000} 
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleClose} severity={severity} variant="filled" sx={{ width: '100%' }}>
          {message}
        </Alert>
      </Snackbar>
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
