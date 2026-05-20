import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle } from
"./Dialog";
import { Button } from "./Button";
import { AlertTriangle } from 'lucide-react';











export const DeletionWarningDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  consequences = [],
  isPending = false
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-error/20">
        <DialogHeader className="flex flex-col items-center text-center space-y-3">
          <div className="p-3 bg-error/10 rounded-full">
            <AlertTriangle className="w-8 h-8 text-error" />
          </div>
          <DialogTitle className="text-xl font-bold text-error">
            {title}
          </DialogTitle>
          <DialogDescription className="text-text-main font-medium">
            {description}
          </DialogDescription>
        </DialogHeader>

        {consequences.length > 0 &&
        <div className="bg-bg-temple/30 p-4 rounded-lg border border-border-temple/40 space-y-2">
            <p className="text-[10px] font-bold text-text-main/60 uppercase tracking-widest">Important Consequences:</p>
            <ul className="space-y-1.5">
              {consequences.map((c, idx) =>
            <li key={idx} className="text-xs text-text-main flex items-start gap-2">
                  <span className="mt-1 w-1 h-1 rounded-full bg-error shrink-0" />
                  {c}
                </li>
            )}
            </ul>
          </div>
        }

        <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 border border-border-temple hover:bg-bg-cream"
            disabled={isPending}>
            
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 h-11 bg-error hover:bg-red-700 text-white font-bold shadow-lg shadow-error/10 active:scale-95 transition-all"
            disabled={isPending}>
            
            {isPending ? 'Processing...' : 'Confirm Deletion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

};