import { describe, it, expect, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useResyncOnReconnect } from '@/lib/offline/use-resync-on-reconnect';

describe('useResyncOnReconnect', () => {
  it('calls the callback when the browser comes back online', () => {
    const onReconnect = jest.fn();
    renderHook(() => useResyncOnReconnect(onReconnect));

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('always calls the latest callback, even if it changes between renders', () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ cb }) => useResyncOnReconnect(cb),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not call the callback on an "offline" event', () => {
    const onReconnect = jest.fn();
    renderHook(() => useResyncOnReconnect(onReconnect));

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(onReconnect).not.toHaveBeenCalled();
  });
});
