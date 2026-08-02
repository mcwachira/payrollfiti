import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell } from '@/components/NotificationBell';

// jsdom has no ResizeObserver — Radix's Popover needs one to measure/position
// its content, and throws without this stub.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const notifications = [
  {
    id: 'notif-1',
    type: 'LEAVE_REQUEST_PENDING',
    message: 'A leave request needs review',
    read: false,
    metadata: null,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'notif-2',
    type: 'PAYROLL_RUN_COMPLETED',
    message: 'August payroll run completed',
    read: true,
    metadata: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  },
];

function mockFetch(
  handler: (
    url: string,
    init?: RequestInit,
  ) => { status: number; body?: unknown },
) {
  window.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
    const { status, body } = handler(String(url), init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    (global as any).ResizeObserver = ResizeObserverStub;
  });

  it('shows the unread count as a badge', async () => {
    mockFetch((url) => {
      if (url.includes('unreadOnly=true')) {
        return { status: 200, body: [notifications[0]] };
      }
      return { status: 200, body: notifications };
    });

    renderWithClient(<NotificationBell />);

    expect(await screen.findByText('1')).toBeTruthy();
  });

  it('lists notifications once opened and marks an unread one as read on click', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    mockFetch((url, init) => {
      fetchCalls.push({ url, init });
      if (url.includes('unreadOnly=true')) {
        return { status: 200, body: [notifications[0]] };
      }
      if (url.includes('/read') && init?.method === 'PATCH') {
        return { status: 200, body: { ...notifications[0], read: true } };
      }
      return { status: 200, body: notifications };
    });

    renderWithClient(<NotificationBell />);

    const trigger = await screen.findByRole('button', {
      name: /notifications/i,
    });
    fireEvent.click(trigger);

    const unreadRow = await screen.findByText('A leave request needs review');
    fireEvent.click(unreadRow);

    await waitFor(() =>
      expect(
        fetchCalls.some(
          (c) =>
            c.url.endsWith('/notifications/notif-1/read') &&
            c.init?.method === 'PATCH',
        ),
      ).toBe(true),
    );
  });

  it('marks all notifications read via the header action', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    mockFetch((url, init) => {
      fetchCalls.push({ url, init });
      if (url.includes('unreadOnly=true')) {
        return { status: 200, body: [notifications[0]] };
      }
      if (url.endsWith('/read-all')) {
        return { status: 200, body: undefined };
      }
      return { status: 200, body: notifications };
    });

    renderWithClient(<NotificationBell />);

    const trigger = await screen.findByRole('button', {
      name: /notifications/i,
    });
    fireEvent.click(trigger);
    await screen.findByText('A leave request needs review');

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));

    await waitFor(() =>
      expect(
        fetchCalls.some(
          (c) =>
            c.url.endsWith('/notifications/read-all') &&
            c.init?.method === 'POST',
        ),
      ).toBe(true),
    );
  });

  it('shows an empty state when there are no notifications', async () => {
    mockFetch(() => ({ status: 200, body: [] }));

    renderWithClient(<NotificationBell />);

    const trigger = await screen.findByRole('button', {
      name: /^notifications$/i,
    });
    fireEvent.click(trigger);

    expect(await screen.findByText('No notifications yet')).toBeTruthy();
  });
});
