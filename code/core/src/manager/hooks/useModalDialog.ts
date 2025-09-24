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
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialogNode = dialogRef.current;
    if (dialogNode) {
      const handleDialogCloseEvent = (event: Event) => {
        if (isOpen) {
          event.preventDefault();
          onClose();
        }
      };

      const handleEscapeKey = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          onClose();
        }
      };

      dialogNode.addEventListener('close', handleDialogCloseEvent);
      dialogNode.addEventListener('keydown', handleEscapeKey);

      return () => {
        dialogNode.removeEventListener('close', handleDialogCloseEvent);
        dialogNode.removeEventListener('keydown', handleEscapeKey);
      };
    }
    return undefined;
  }, [isOpen, onClose]);

  return dialogRef;
}
