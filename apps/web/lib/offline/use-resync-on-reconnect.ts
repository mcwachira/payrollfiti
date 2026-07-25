'use client';
import { useEffect, useRef } from 'react';

/**
 * Runs `onReconnect` whenever the browser transitions from offline back to
 * online — the "sync when online" half of offline support: cached data
 * shown while offline gets silently refreshed the moment connectivity
 * returns, without the user having to manually reload.
 */
export function useResyncOnReconnect(onReconnect: () => void): void {
  const callbackRef = useRef(onReconnect);
  callbackRef.current = onReconnect;

  useEffect(() => {
    const handleOnline = () => callbackRef.current();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
}
