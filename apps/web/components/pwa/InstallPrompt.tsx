'use client';
import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/config';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own non-standard flag — there's no matchMedia equivalent.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function recentlyDismissed() {
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
}

/**
 * Chrome/Edge/Android fire `beforeinstallprompt`, which we capture and
 * defer so we can trigger it from our own banner instead of the browser's.
 * iOS Safari never fires that event — "Add to Home Screen" is
 * Share-sheet-only there — so we show static instructions instead.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    setDismissed(false);

    if (isIos()) {
      setShowIosInstructions(true);
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      window.localStorage.removeItem(DISMISS_KEY);
    } else {
      dismiss();
    }
  };

  if (dismissed || (!deferredPrompt && !showIosInstructions)) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-lg border bg-background p-4 shadow-lg sm:left-auto sm:right-4 sm:translate-x-0">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      {showIosInstructions ? (
        <div className="pr-4">
          <p className="font-medium">Install {APP_NAME}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Share, then
            &quot;Add to Home Screen&quot;.
          </p>
        </div>
      ) : (
        <div className="pr-4">
          <p className="font-medium">Install {APP_NAME}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add it to your home screen for quick, offline-ready access.
          </p>
          <Button size="sm" className="mt-3" onClick={install}>
            <Download className="mr-1.5 h-4 w-4" />
            Install app
          </Button>
        </div>
      )}
    </div>
  );
}
