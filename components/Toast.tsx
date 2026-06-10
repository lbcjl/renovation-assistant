"use client";

import { useCallback, useRef, useState } from "react";

export type ToastType = "success" | "error";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const TOAST_DURATION_MS = 3000;

/** Toast list state + a `notify` function to push auto-dismissing toasts. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastType, message: string) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) => [...current, { id, type, message }]);
      setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  return { toasts, notify, dismiss };
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) {
    return null;
  }
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.type}`}>
          <span className="toast__icon">{toast.type === "success" ? "✓" : "✕"}</span>
          <span className="toast__message">{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
