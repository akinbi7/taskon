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
import { apiCall } from "./api";
import type { SessionData } from "../types";

interface SessionContextValue {
  session: SessionData | null;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<void>;
  retry: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await apiCall<SessionData>("session");
    if (mounted.current) {
      setSession(next);
      setError(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refresh();
    } catch (loadError) {
      if (mounted.current) setError(loadError);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [refresh]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(
    () => ({ session, loading, error, refresh, retry: () => void load() }),
    [session, loading, error, refresh, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
