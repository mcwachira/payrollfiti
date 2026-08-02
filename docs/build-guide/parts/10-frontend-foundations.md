# Part 10 — Frontend Foundations & Marketing Site

## 10.1 Route Groups: Three Audiences, One App

Next.js App Router route groups split the app by audience without affecting the URL structure:

```
app/
├── (marketing)/    # public: /, /pricing, /reviews, /features, /contact, /privacy, ...
├── (auth)/          # /login, /signup — no sidebar, no auth required
├── (app)/            # authenticated: /dashboard, /employees, /payroll, /leave, /loans, ...
├── offline/           # Serwist fallback route, shown when navigation fails with no network
└── sw.ts               # service worker source
```

Each group has its own `layout.tsx`: `(marketing)` wraps pages in the public `Header`/`Footer`; `(app)` wraps pages in the authenticated shell (sidebar, `AuthProvider`, `BrandingProvider`, React Query's `QueryClientProvider`) and redirects to `/login` when `useAuth()` resolves with no user.

## 10.2 The API Client — Token Refresh Is Transparent to Every Caller

Every backend module gets a matching `lib/*-api.ts` file on the frontend (`employees-api.ts`, `payroll-api.ts`, `leave-api.ts`, `loans-api.ts`, ...) — thin, typed wrapper functions around one shared `apiFetch`. The interesting logic lives entirely in that one shared function, so no individual page or hook ever has to think about auth:

```typescript
// lib/api-client.ts
let refreshPromise: Promise<AuthTokensDto> | null = null;

async function refreshTokens(): Promise<AuthTokensDto> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new ApiError(401, 'No refresh token');
  const response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { Authorization: `Bearer ${refreshToken}` } });
  if (!response.ok) { tokenStorage.clear(); throw new ApiError(response.status, 'Session expired'); }
  const data = await response.json();
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}, isRetry = false): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const accessToken = tokenStorage.getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (response.status === 401 && !skipAuth && !isRetry) {
    try {
      // Concurrent 401s from several in-flight requests share ONE refresh
      // call rather than each independently racing to refresh — the second
      // caller awaits the first's in-flight promise instead of triggering
      // its own token rotation.
      refreshPromise ??= refreshTokens().finally(() => { refreshPromise = null; });
      await refreshPromise;
      return apiFetch<T>(path, options, true); // retry once, with the new token
    } catch {
      tokenStorage.clear();
      throw new ApiError(401, 'Session expired, please log in again');
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? 'Request failed');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
```

The `refreshPromise` module-level singleton is the detail worth internalizing: without it, five simultaneous 401s (e.g. a dashboard firing off five parallel React Query fetches right as the access token expires) would each independently call `/auth/refresh`, racing to rotate the same refresh token — and because `AuthService.refresh` treats a stale/rotated-out refresh token as reuse and revokes the session (Part 4 §4.4), that race would log the user out. Coalescing every concurrent 401 onto one in-flight refresh call avoids that entirely.

A second helper handles binary responses — payslip PDFs, bank-export CSVs — which don't fit the JSON-in/JSON-out shape:

```typescript
export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}
```

## 10.3 AuthContext & BrandingContext

`AuthContext` owns the current user and the three auth mutations; it resolves `/auth/me` once on mount if a token is already present (surviving a page refresh) and otherwise starts unauthenticated:

```typescript
// contexts/AuthContext.tsx
export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthenticatedUserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenStorage.getAccessToken()) { setIsLoading(false); return; }
    apiFetch<AuthenticatedUserDto>('/auth/me').then(setUser).catch(() => tokenStorage.clear()).finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ user: AuthenticatedUserDto } & AuthTokensDto>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true,
    });
    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);
  // signup, logout follow the same shape
  return <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>{children}</AuthContext.Provider>;
}
```

`BrandingContext` layers on top of it: authenticated users get their tenant's actual branding (`/branding`); everyone else — including the entire public marketing site — gets a sensible fallback (`/branding/default`, which resolves to `APP_NAME`) so a payslip preview or the app shell never renders with missing logo/color data mid-fetch:

```typescript
// contexts/BrandingContext.tsx
const DEFAULT_BRANDING: BrandingConfigDto = { appName: APP_NAME };

export function BrandingProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingConfigDto>(DEFAULT_BRANDING);

  const fetchBranding = useCallback(async () => {
    const path = user ? '/branding' : '/branding/default';
    try {
      setBranding(await apiFetch<BrandingConfigDto>(path, user ? {} : { skipAuth: true }));
    } catch {
      setBranding(DEFAULT_BRANDING);
    }
  }, [user]);

  useEffect(() => { void fetchBranding(); }, [fetchBranding]);
  return <BrandingContext.Provider value={{ ...branding, refreshBranding: fetchBranding }}>{children}</BrandingContext.Provider>;
}
```

Refetching automatically when `user` changes (via the `useCallback` dependency) is what makes logging in as a different tenant immediately swap the visible logo/color — no manual cache invalidation needed anywhere else in the app.

## 10.4 Data Fetching — React Query, No Hand-Rolled `useEffect`

Every data-driven page follows the same shape: a `useQuery` for reads, a `useMutation` (with `queryClient.invalidateQueries` on success) for writes, and explicit loading/error rendering — never a bare `useEffect` fetch with local `useState` for loading flags. A representative page (Part 11 covers the full payroll page):

```typescript
const calculationQuery = useQuery({
  queryKey: ['payroll-calculate', country, salaryValue, allowances, deductions],
  queryFn: () => calculatePayroll({ country, salary: salaryValue, allowances, deductions }),
  enabled: salaryValue > 0,
});

// ...
{calculationQuery.isPending ? (
  <SkeletonRows count={6} />
) : calculationQuery.isError ? (
  <p className="text-red-600 dark:text-red-400 text-sm">
    {calculationQuery.error instanceof ApiError ? calculationQuery.error.message : 'Failed to calculate. Please try again.'}
  </p>
) : calculationQuery.data ? (
  <BreakdownView result={calculationQuery.data} />
) : null}
```

Inputs are debounced (`useDebouncedValue`, 400–500ms) before entering the query key, so typing in the pricing calculator's salary field doesn't fire a network request per keystroke — React Query's key-based caching then means moving back to a previously-typed value returns the cached result instantly with no request at all.

## 10.5 The Public Payroll Calculator — Same Engine, Zero Auth

The marketing-site `/pricing` page embeds a fully live tax calculator, unauthenticated, calling the `payroll-calculator` module from Part 5 §5.4 directly. Because it's the exact same `runPayrollCalculation` + country registry as real payroll, the country dropdown and every number shown is provably accurate, not a marketing approximation:

```typescript
// app/(marketing)/pricing/page.tsx
const countriesQuery = useQuery({ queryKey: ['calculator-countries'], queryFn: listSupportedCountries, staleTime: Infinity });

const calculationQuery = useQuery({
  queryKey: ['payroll-calculate', country, salaryValue, allowances, deductions],
  queryFn: () => calculatePayroll({ country, salary: salaryValue, allowances, deductions }),
  enabled: salaryValue > 0,
});

<Select value={country} onValueChange={setCountry}>
  <SelectContent>
    {(countriesQuery.data ?? []).map((c) => (
      <SelectItem key={c.countryCode} value={c.countryCode}>{getCountryName(c.countryCode)} ({c.currency})</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Rendering `getCountryName(c.countryCode)` ("South Africa (ZAR)") instead of the raw ISO pair ("ZA — ZAR") is a small but real UX fix: users reading a bare `ZA` code in a dropdown reasonably mistake it for an abbreviation of an unfamiliar country rather than recognizing it as South Africa, which is precisely the kind of confusion that makes people think a country "isn't supported" when it actually is. `getPricingForCountry`/`formatPrice` (from `@repo/pricing`, the same shared package `AuthService.signup` and `BillingService` use — Part 4 §4.4, Part 7 §7.6) drive both the plan-tier cards above the calculator and the calculator's own currency formatting, so pricing display and actual billing currency can never drift apart.

Statutory deduction line items get an inline tooltip explaining what they are (`DEDUCTION_TOOLTIPS`, keyed by the same `StatutoryDeductionLine.code` the engine produces — `NSSF`, `NHIF`, `HOUSING_LEVY`, `PENSION`, `NHF`, `UIF`, `SDL`), and any `ValidationIssue`s the engine's `validate()` returns (Part 3 §3.2) are surfaced directly in a warning box — the same validation real payroll runs would hit.

## 10.6 Reviews & Testimonials

Marketing testimonials live in one shared data file consumed by two surfaces — the homepage teaser (first 3) and a dedicated `/reviews` page (all of them) — so there's one place to add a new review rather than two copies drifting apart:

```typescript
// lib/testimonials-data.ts
export interface Testimonial { name: string; role: string; company: string; quote: string; }
export const testimonials: Testimonial[] = [ /* ... */ ];
```

```typescript
// app/(marketing)/reviews/page.tsx
export default function ReviewsPage() {
  return (
    <div className="py-20">
      {testimonials.map((t) => <TestimonialCard key={t.name} {...t} />)}
      <Link href="/contact">Share Your Story</Link>
    </div>
  );
}
```

`TestimonialsSection` on the homepage renders `testimonials.slice(0, 3)` plus a "Read more reviews" link to `/reviews` — the header's "Reviews" nav item points at `/reviews` directly rather than an in-page `#testimonials` anchor, so it's a real page from every entry point, not just a homepage scroll target.

## 10.7 Offline Support — Serwist

The employee self-service portal needs to show a cached payslip with no connection, so the app registers a real service worker via `@serwist/next` rather than skipping PWA support entirely:

```typescript
// app/sw.ts — runs in ServiceWorkerGlobalScope, transpiled/bundled by Next.js/Serwist at build time
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [{ url: '/offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});
serwist.addEventListeners();
```

Any navigation that fails with no network falls back to `/offline` — a static page rather than the browser's own offline error — and `runtimeCaching: defaultCache` gives every other asset (JS/CSS bundles, images) Serwist's default stale-while-revalidate strategy, so a returning visitor's shell loads instantly from cache even before the network request resolves.

Part 11 moves into the authenticated app itself — the sidebar shell and the full set of feature pages built on everything from Parts 10.2–10.4.
