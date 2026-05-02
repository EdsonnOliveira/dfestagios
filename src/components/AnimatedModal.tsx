'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const ANIM_MS = 200;

export type AnimatedModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndexClassName?: string;
  overlayClassName?: string;
  containerClassName?: string;
  closeOnOverlayClick?: boolean;
};

export function AnimatedModal({
  open,
  onClose,
  children,
  zIndexClassName = 'z-50',
  overlayClassName = 'bg-[#00408580] dark:bg-slate-900/80',
  containerClassName = 'p-4',
  closeOnOverlayClick = true,
}: AnimatedModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    exitTimerRef.current = setTimeout(() => {
      setMounted(false);
      exitTimerRef.current = null;
    }, ANIM_MS);
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  if (typeof document === 'undefined' || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center ${zIndexClassName} ${containerClassName}`}
    >
      <div
        role="presentation"
        className={`absolute inset-0 transition-opacity duration-200 ease-out ${overlayClassName} ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={closeOnOverlayClick ? onClose : undefined}
      />
      <div className="relative z-10 flex w-full justify-center pointer-events-none">
        <div
          className={`pointer-events-auto transition-all duration-200 ease-out ${
            visible
              ? 'translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none translate-y-2 scale-95 opacity-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
