import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  getListings,
  getListingById,
  getFeaturedListings,
  getSavedListings,
  saveListing,
  unsaveListing,
  isSaved,
  createListing,
} from "@/data/storage";
import type { ListingFilters } from "@/data/storage";

// ---- Mock Response that looks like a fetch Response ----
class MockResponse {
  private _data: unknown;
  ok = true;
  status = 200;
  statusText = "OK";

  constructor(data: unknown, status = 200) {
    this._data = data;
    this.ok = status >= 200 && status < 300;
    this.status = status;
    this.statusText = this.ok ? "OK" : "Error";
  }

  async json() {
    return this._data;
  }

  async text() {
    return JSON.stringify(this._data);
  }
}

// ---- Route /api/* calls to in-memory storage ----
function handleApiRequest(method: string, url: string, body?: unknown): MockResponse {
  // Strip query string from path for routing
  const [path, queryString] = url.split("?");
  const params = new URLSearchParams(queryString ?? "");

  // GET /api/listings/featured
  if (method === "GET" && path === "/api/listings/featured") {
    return new MockResponse(getFeaturedListings());
  }

  // GET /api/listings/:id
  const listingIdMatch = path.match(/^\/api\/listings\/(\d+)$/);
  if (method === "GET" && listingIdMatch) {
    const id = Number(listingIdMatch[1]);
    const listing = getListingById(id);
    if (!listing) return new MockResponse({ error: "Listing not found" }, 404);
    return new MockResponse(listing);
  }

  // GET /api/listings (with optional query params)
  if (method === "GET" && path === "/api/listings") {
    const filters: ListingFilters = {};
    if (params.get("search")) filters.search = params.get("search")!;
    if (params.get("city")) filters.city = params.get("city")!;
    if (params.get("department")) filters.department = params.get("department")!;
    if (params.get("priceMin")) filters.priceMin = Number(params.get("priceMin"));
    if (params.get("priceMax")) filters.priceMax = Number(params.get("priceMax"));
    if (params.get("propertyType")) filters.propertyType = params.get("propertyType")!;
    if (params.get("priceType")) filters.priceType = params.get("priceType")!;
    if (params.get("bedrooms")) filters.bedrooms = Number(params.get("bedrooms"));
    return new MockResponse(getListings(filters));
  }

  // POST /api/listings
  if (method === "POST" && path === "/api/listings") {
    try {
      const listing = createListing(body as any);
      return new MockResponse(listing, 201);
    } catch (e: any) {
      return new MockResponse({ error: e.message || "Invalid data" }, 400);
    }
  }

  // GET /api/saved/:sessionId/:listingId/status
  const savedStatusMatch = path.match(/^\/api\/saved\/([^/]+)\/(\d+)\/status$/);
  if (method === "GET" && savedStatusMatch) {
    const sessionId = savedStatusMatch[1];
    const listingId = Number(savedStatusMatch[2]);
    return new MockResponse({ saved: isSaved(listingId, sessionId) });
  }

  // GET /api/saved/:sessionId
  const savedMatch = path.match(/^\/api\/saved\/([^/]+)$/);
  if (method === "GET" && savedMatch) {
    const sessionId = savedMatch[1];
    return new MockResponse(getSavedListings(sessionId));
  }

  // POST /api/saved (toggle save)
  if (method === "POST" && path === "/api/saved") {
    const { listingId, sessionId } = body as { listingId: number; sessionId: string };
    if (isSaved(listingId, sessionId)) {
      unsaveListing(listingId, sessionId);
      return new MockResponse({ saved: false });
    }
    saveListing(listingId, sessionId);
    return new MockResponse({ saved: true });
  }

  return new MockResponse({ error: "Not found" }, 404);
}

// ---- Public apiRequest (replaces the fetch-based version) ----
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<MockResponse> {
  return handleApiRequest(method, url, data);
}

// ---- getQueryFn for TanStack Query defaultOptions ----
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // queryKey[0] is the path, queryKey[1] may be a query string for /api/listings
    const basePath = queryKey[0] as string;
    const extra = queryKey[1];

    let url = basePath;
    // If extra is a query string (e.g. Browse page appends it)
    if (typeof extra === "string" && extra !== "" && !extra.startsWith("/")) {
      url = `${basePath}?${extra}`;
    } else if (typeof extra === "string" && extra.startsWith("/")) {
      url = `${basePath}${extra}`;
    }

    const res = handleApiRequest("GET", url);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status}: ${text}`);
    }

    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
