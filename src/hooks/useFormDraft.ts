import { useEffect, useRef, useState } from "react";

const PREFIX = "draft:";

function isEmpty(v: any): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v).every(isEmpty);
  if (typeof v === "number") return v === 0;
  if (typeof v === "boolean") return v === false;
  return false;
}

/**
 * Persists a form state to localStorage so users never lose work on accidental
 * reload, navigation or tab close. Also warns before closing the tab when there
 * are unsaved changes.
 *
 * - `enabled` should be false when editing an existing record (we don't want to
 *   restore a "new item" draft over an edit session).
 */
export function useFormDraft<T>(
  key: string,
  initial: T,
  enabled: boolean = true,
): {
  value: T;
  setValue: React.Dispatch<React.SetStateAction<T>>;
  clearDraft: () => void;
  hasDraft: boolean;
} {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    if (!enabled || typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return initial;
      return { ...(initial as any), ...JSON.parse(raw) } as T;
    } catch {
      return initial;
    }
  });
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    if (!enabled || typeof window === "undefined") return false;
    return !!localStorage.getItem(storageKey);
  });
  const dirty = useRef(false);

  // Debounced persistence
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      try {
        if (isEmpty(value)) {
          localStorage.removeItem(storageKey);
          setHasDraft(false);
          dirty.current = false;
        } else {
          localStorage.setItem(storageKey, JSON.stringify(value));
          setHasDraft(true);
          dirty.current = true;
        }
      } catch {
        /* quota or private mode — ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, storageKey, enabled]);

  // Warn before unload if there are unsaved changes
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    dirty.current = false;
    setHasDraft(false);
  };

  return { value, setValue, clearDraft, hasDraft };
}
