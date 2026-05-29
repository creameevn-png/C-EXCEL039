'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; msg: string; kind: ToastKind };

const TOAST_ICON = { success: FiCheckCircle, error: FiAlertCircle, info: FiInfo };

const Ctx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  let nextId = 1;

  const show = useCallback((msg: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, msg, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  useEffect(() => {
    (window as any).__showToast = show;
  }, [show]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="toast-container">
        {items.map((t) => {
          const Icon = TOAST_ICON[t.kind];
          return (
            <div key={t.id} className={`toast ${t.kind}`}>
              <Icon />
              <span>{t.msg}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

export function showToast(msg: string, kind: ToastKind = 'info') {
  if (typeof window !== 'undefined' && (window as any).__showToast) {
    (window as any).__showToast(msg, kind);
  }
}
