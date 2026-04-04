import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Session ID (stored in memory only — no localStorage)
let _sessionId: string | null = null;
export function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
  return _sessionId;
}

export function formatPrice(price: number, priceType: string): string {
  if (priceType === "rent") {
    return `$${price.toLocaleString("fr-HT")}/mois`;
  }
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`;
  }
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`;
  }
  return `$${price.toLocaleString("fr-HT")}`;
}

export function getPropertyTypeLabel(type: string): string {
  const map: Record<string, string> = {
    house: "Maison",
    apartment: "Appartement",
    villa: "Villa",
    land: "Terrain",
    commercial: "Commercial",
  };
  return map[type] ?? type;
}

export function getDepartmentClass(dept: string): string {
  if (dept === "Ouest") return "dept-ouest";
  if (dept === "Nord") return "dept-nord";
  if (dept === "Artibonite") return "dept-artibonite";
  if (dept.includes("Sud")) return "dept-sud";
  return "dept-other";
}

export const DEPARTMENTS = [
  "Artibonite", "Centre", "Grand-Anse", "Nippes",
  "Nord", "Nord-Est", "Nord-Ouest", "Ouest", "Sud", "Sud-Est"
];

export const PROPERTY_TYPES = [
  { value: "house", label: "Maison" },
  { value: "apartment", label: "Appartement" },
  { value: "villa", label: "Villa" },
  { value: "land", label: "Terrain" },
  { value: "commercial", label: "Commercial" },
];
