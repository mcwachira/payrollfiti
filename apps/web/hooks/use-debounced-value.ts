
import { useEffect, useState } from 'react';

/**
 * Returns a delayed/debounced version of a value.
 *
 * The returned value only updates after `delayMs` milliseconds
 * have passed without the original value changing.
 *
 * Example:
 *
 * User types:
 *
 *     1
 *     10
 *     100
 *     1000
 *
 * Instead of reacting to every change immediately, the hook
 * waits until the user stops changing the value.
 *
 * This is useful for:
 * - Search inputs
 * - API requests
 * - Payroll calculations
 * - Filtering
 * - Validation
 */
export function useDebouncedValue<T>(
  value: T,
  delayMs = 400,
): T {

  // Store the debounced value.
  //
  // Initially, the debounced value is the same as the
  // value passed into the hook.
  const [debounced, setDebounced] = useState<T>(value);


  useEffect(() => {

    // Start a timer.
    //
    // If the value does not change for `delayMs`
    // milliseconds, update the debounced value.
    const timeout = setTimeout(() => {
      setDebounced(value);
    }, delayMs);


    // Cleanup function.
    //
    // If `value` changes before the timer finishes,
    // cancel the previous timer.
    //
    // This is the key part of debouncing.
    return () => {
      clearTimeout(timeout);
    };

  }, [value, delayMs]);


  // Return the delayed/debounced value.
  return debounced;
}
