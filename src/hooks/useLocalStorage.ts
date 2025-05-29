
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

function useLocalStorage<T>(
  key: string,
  initialValueFromProps: T
): [T, (value: T | ((val: T) => T)) => void] {
  // Ref to store the very first initialValueFromProps.
  // This is important if initialValueFromProps is a new reference on each render (e.g., [] or {}).
  const initialValueRef = useRef(initialValueFromProps);

  // State initializer function: runs only on the first render.
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValueRef.current;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValueRef.current;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}” during initial load:`, error);
      return initialValueRef.current;
    }
  });

  // Effect to update storedValue if the `key` prop changes.
  useEffect(() => {
    if (typeof window === 'undefined') {
      // Still return initial value if on server or window not available yet for key change
      setStoredValue(initialValueRef.current);
      return;
    }
    // When key changes, re-read from localStorage for the new key.
    try {
      const item = window.localStorage.getItem(key);
      setStoredValue(item ? (JSON.parse(item) as T) : initialValueRef.current);
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}” after key change:`, error);
      setStoredValue(initialValueRef.current);
    }
  }, [key]); // Only re-run if key changes.

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      if (typeof window === 'undefined') {
        console.warn(`Tried setting localStorage key “${key}” (SSR / no window).`);
        return;
      }
      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.warn(`Error setting localStorage key “${key}”:`, error);
      }
    },
    [key, storedValue] // depends on storedValue for functional updates, key for localStorage
  );

  // Effect for localStorage 'storage' event (syncs across tabs)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage && event.key === key) {
        if (event.newValue === null) { // Value was removed or cleared in another tab
          setStoredValue(initialValueRef.current);
        } else {
          try {
            setStoredValue(JSON.parse(event.newValue) as T);
          } catch (error) {
            console.warn(`Error parsing localStorage key “${key}” from storage event:`, error);
            setStoredValue(initialValueRef.current); // Fallback
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key]); // Only depends on key. Uses initialValueRef.current internally. setStoredValue is stable.

  return [storedValue, setValue];
}

export default useLocalStorage;
