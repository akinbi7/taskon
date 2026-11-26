import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "plain" | "good" | "warn";

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);
  const nextId = useRef(1);

  const notify = useCallback((message: string, tone: ToastTone = "plain") => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast({ id: nextId.current++, message, tone });
    timer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-slot" aria-live="polite">
        {toast ? (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <span className="toast__line" aria-hidden="true" />
            <p>{toast.message}</p>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
