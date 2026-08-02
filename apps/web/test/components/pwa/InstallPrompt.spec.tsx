import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })) as unknown as typeof window.matchMedia;
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockMatchMedia(false);
    setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
    );
    Object.defineProperty(window.navigator, 'standalone', {
      value: undefined,
      configurable: true,
    });
  });

  it('renders nothing until beforeinstallprompt fires', () => {
    render(<InstallPrompt />);
    expect(screen.queryByText(/Install/)).toBeNull();
  });

  it('shows a custom install banner and triggers the deferred prompt', async () => {
    render(<InstallPrompt />);

    const promptSpy = jest.fn<() => Promise<void>>().mockResolvedValue();
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = promptSpy;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });

    act(() => {
      window.dispatchEvent(event);
    });

    const installButton = await screen.findByRole('button', {
      name: /install app/i,
    });
    await act(async () => {
      fireEvent.click(installButton);
    });

    expect(promptSpy).toHaveBeenCalled();
  });

  it('shows Add to Home Screen instructions on iOS Safari, with no native event', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    );
    render(<InstallPrompt />);
    expect(screen.getByText(/Add to Home Screen/)).not.toBeNull();
  });

  it('does not render when already running standalone', () => {
    mockMatchMedia(true);
    render(<InstallPrompt />);
    const event = new Event('beforeinstallprompt');
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.queryByText(/Install/)).toBeNull();
  });

  it('stays dismissed for the cooldown window after the user dismisses it', () => {
    window.localStorage.setItem('pwa-install-dismissed-at', String(Date.now()));
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    );
    render(<InstallPrompt />);
    expect(screen.queryByText(/Add to Home Screen/)).toBeNull();
  });
});
