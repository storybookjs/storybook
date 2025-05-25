import { useEffect, useRef } from 'react';

interface UseModalDialogOptions {
  isOpen: boolean;
  onClose: () => void;
}

export function useModalDialog({ isOpen, onClose }: UseModalDialogOptions) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (dialogNode) {
      if (isOpen) {
        if (!dialogNode.hasAttribute('open')) {
          dialogNode.showModal();
        }
      } else {
        if (dialogNode.hasAttribute('open')) {
          dialogNode.close();
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (dialogNode) {
      const handleDialogCloseEvent = () => {
        if (isOpen) {
          onClose();
        }
      };
      dialogNode.addEventListener('close', handleDialogCloseEvent);
      return () => {
        dialogNode.removeEventListener('close', handleDialogCloseEvent);
      };
    }
    return undefined;
  }, [isOpen, onClose]);

  return dialogRef;
}
