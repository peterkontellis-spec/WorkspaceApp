'use client';

import { useRef, type MouseEvent, type PointerEvent } from 'react';

function outside(event: MouseEvent<HTMLDialogElement> | PointerEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
}

/** Require both ends outside: selecting text or dragging out must not close. */
export function useBackdropDismiss(onClose: () => void) {
  const beganOutside = useRef(false);
  return {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => { beganOutside.current = event.button === 0 && outside(event); },
    onPointerCancel: () => { beganOutside.current = false; },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      const dismiss = beganOutside.current && outside(event);
      beganOutside.current = false;
      if (dismiss) onClose();
    },
  };
}
