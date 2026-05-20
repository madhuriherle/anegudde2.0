import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from './ui/Dialog';
import { Button } from './ui/Button';

const ConfirmDialog = ({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
  loading = false,
  color = 'primary'
}) => {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-100 rounded-full">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-gray-600">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={loading} className="font-bold">
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            variant={color === 'error' ? 'error' : color === 'secondary' ? 'secondary' : 'primary'}
            disabled={loading}
            className="font-bold px-6">
            
            {loading ?
            <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Processing...
              </span> :

            confirmText
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

};

export default ConfirmDialog;