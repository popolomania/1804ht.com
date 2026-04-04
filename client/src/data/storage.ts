import type { Listing, InsertListing, SavedListing } from "@shared/schema";
import { staticListings } from "./listings";

// In-memory mutable listings array (starts as copy of seed data)
let listingsStore: Listing[] = [...staticListings];
let nextListingId = staticListings.length + 1;

// In-memory saved listings store: { [sessionId]: Set<listingId> }
const savedStore: Map<string, Set<number>> = new Map();

export interface ListingFilters {
  search?: string;
  city?: string;
  department?: string;
  priceMin?: number;
  priceMax?: number;
  propertyType?: string;
  priceType?: string;
  bedrooms?: number;
}

export function getListings(filters?: ListingFilters): Listing[] {
  let results = listingsStore.filter((l) => l.status === "active");

  if (filters?.search) {
    const s = filters.search.toLowerCase();
    results = results.filter(
      (l) =>
        l.title.toLowerCase().includes(s) ||
        l.city.toLowerCase().includes(s) ||
        l.department.toLowerCase().includes(s) ||
        l.address.toLowerCase().includes(s) ||
        l.description.toLowerCase().includes(s)
    );
  }
  if (filters?.city) {
    results = results.filter(
      (l) => l.city.toLowerCase() === filters.city!.toLowerCase()
    );
  }
  if (filters?.department) {
    results = results.filter((l) => l.department === filters.department);
  }
  if (filters?.priceMin !== undefined) {
    results = results.filter((l) => l.price >= filters.priceMin!);
  }
  if (filters?.priceMax !== undefined) {
    results = results.filter((l) => l.price <= filters.priceMax!);
  }
  if (filters?.propertyType) {
    results = results.filter((l) => l.propertyType === filters.propertyType);
  }
  if (filters?.priceType) {
    results = results.filter((l) => l.priceType === filters.priceType);
  }
  if (filters?.bedrooms !== undefined) {
    results = results.filter((l) => (l.bedrooms ?? 0) >= filters.bedrooms!);
  }

  return results;
}

export function getListingById(id: number): Listing | undefined {
  return listingsStore.find((l) => l.id === id);
}

export function getFeaturedListings(): Listing[] {
  return listingsStore.filter((l) => l.featured === true && l.status === "active");
}

export function createListing(data: InsertListing): Listing {
  const listing: Listing = {
    id: nextListingId++,
    title: data.title,
    description: data.description,
    price: data.price,
    priceType: data.priceType ?? "sale",
    address: data.address,
    city: data.city,
    department: data.department,
    propertyType: data.propertyType,
    bedrooms: data.bedrooms ?? null,
    bathrooms: data.bathrooms ?? null,
    areaSqm: data.areaSqm ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    images: data.images ?? "[]",
    amenities: data.amenities ?? "[]",
    status: data.status ?? "active",
    featured: data.featured ?? false,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail ?? null,
  };
  listingsStore.push(listing);
  return listing;
}

export function getSavedListings(sessionId: string): Listing[] {
  const ids = savedStore.get(sessionId);
  if (!ids || ids.size === 0) return [];
  return listingsStore.filter((l) => ids.has(l.id));
}

export function saveListing(listingId: number, sessionId: string): SavedListing {
  if (!savedStore.has(sessionId)) {
    savedStore.set(sessionId, new Set());
  }
  savedStore.get(sessionId)!.add(listingId);
  return { id: Date.now(), listingId, sessionId };
}

export function unsaveListing(listingId: number, sessionId: string): void {
  const ids = savedStore.get(sessionId);
  if (ids) {
    ids.delete(listingId);
  }
}

export function isSaved(listingId: number, sessionId: string): boolean {
  const ids = savedStore.get(sessionId);
  return ids ? ids.has(listingId) : false;
}
