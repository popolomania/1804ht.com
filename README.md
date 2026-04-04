# 1804ht.com 🇭🇹

**1804ht.com** ("Kay Ayiti" — Haitian Creole for "Home Haiti") is a full-stack real estate listing platform for Haiti, modeled after Zillow. Browse, search, filter, and list properties for sale or rent across all ten departments. A Leaflet.js map view plots every listing as a clickable, color-coded pin.

---

## Live Demo

Deployed on Perplexity Computer — ask the project owner for the link.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript, Vite |
| **Routing** | Wouter (hash-based routing for static deployment) |
| **UI Components** | shadcn/ui (Radix UI primitives) + Tailwind CSS v3 |
| **Data Fetching** | TanStack Query v5 |
| **Forms** | react-hook-form + zod + @hookform/resolvers |
| **Map** | Leaflet.js 1.9.4 (dynamically imported, CSS injected at runtime) |
| **Backend** | Express.js (TypeScript via tsx) |
| **Database** | SQLite via `better-sqlite3` + Drizzle ORM |
| **Schema validation** | Drizzle-Zod + Zod |
| **Build** | Vite (client) + esbuild/tsup (server → `dist/index.cjs`) |
| **Fonts** | Plus Jakarta Sans (Google Fonts) |

---

## Project Structure

```
1804ht.com/
├── client/
│   ├── index.html
│   └── src/
│       ├── App.tsx                  # Router + ThemeProvider wrapper
│       ├── index.css                # Tailwind + CSS custom properties (HSL palette)
│       ├── components/
│       │   ├── Footer.tsx
│       │   ├── ListingCard.tsx      # Property card with save/unsave heart
│       │   ├── ListingsMap.tsx      # Leaflet map with pins, popups, legend
│       │   ├── Logo.tsx             # Inline SVG logo
│       │   ├── Navbar.tsx
│       │   └── ThemeProvider.tsx    # Light/dark mode context
│       ├── lib/
│       │   ├── queryClient.ts       # TanStack Query + apiRequest helper
│       │   └── utils.ts             # formatPrice, getSessionId, dept helpers
│       └── pages/
│           ├── Home.tsx             # Hero, featured listings, city chips, CTA
│           ├── Browse.tsx           # Filterable listing grid + map toggle
│           ├── ListingDetail.tsx    # Gallery, stats, amenities, contact card
│           ├── ListProperty.tsx     # Post a new listing form
│           ├── Saved.tsx            # Favorites (session-scoped)
│           └── not-found.tsx
├── server/
│   ├── index.ts                     # Express entry point
│   ├── routes.ts                    # REST API routes
│   ├── storage.ts                   # Drizzle queries + IStorage interface + seed data
│   ├── static.ts
│   └── vite.ts
├── shared/
│   └── schema.ts                    # Drizzle table definitions + Zod insert schemas
├── drizzle.config.ts
├── package.json
├── tailwind.config.ts
└── vite.config.ts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run (development)

```bash
git clone https://github.com/popolomania/1804ht.com.git
cd 1804ht.com
npm install
npm run dev
```

The app runs on **http://localhost:5000** — Express serves the Vite frontend and API on the same port.

### Build for Production

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

This starts a single Express server that serves both the static frontend and the API.

---

## API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/listings` | All active listings. Accepts query filters (see below). |
| `GET` | `/api/listings/featured` | Featured listings only. |
| `GET` | `/api/listings/:id` | Single listing by ID. |
| `POST` | `/api/listings` | Create a new listing. |
| `GET` | `/api/saved/:sessionId` | Saved listings for a session. |
| `POST` | `/api/saved` | Toggle save/unsave a listing. |
| `GET` | `/api/saved/:sessionId/:listingId/status` | Is a listing saved? |

### Filter Query Params (`GET /api/listings`)

| Param | Type | Example |
|---|---|---|
| `search` | string | `?search=Jacmel` |
| `priceType` | `sale` \| `rent` | `?priceType=sale` |
| `propertyType` | `house` \| `apartment` \| `villa` \| `land` \| `commercial` | `?propertyType=villa` |
| `department` | string | `?department=Nord` |
| `priceMin` | number | `?priceMin=50000` |
| `priceMax` | number | `?priceMax=500000` |
| `bedrooms` | number | `?bedrooms=3` (minimum) |

---

## Database Schema

Defined in `shared/schema.ts` using Drizzle ORM (SQLite).

### `listings`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | Auto-increment |
| `title` | text | Listing headline |
| `description` | text | Full description |
| `price` | real | USD |
| `price_type` | text | `"sale"` or `"rent"` |
| `address` | text | Street address |
| `city` | text | e.g. `"Cap-Haïtien"` |
| `department` | text | One of Haiti's 10 departments |
| `property_type` | text | `house`, `apartment`, `villa`, `land`, `commercial` |
| `bedrooms` | integer | nullable |
| `bathrooms` | integer | nullable |
| `area_sqm` | real | nullable (m²) |
| `lat` | real | nullable — for precise map pin placement |
| `lng` | real | nullable |
| `images` | text | JSON array of image URLs |
| `amenities` | text | JSON array of strings |
| `status` | text | `"active"`, `"sold"`, `"pending"` |
| `featured` | integer (boolean) | Shown in "Coups de coeur" |
| `contact_name` | text | |
| `contact_phone` | text | |
| `contact_email` | text | nullable |

### `saved_listings`

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `listing_id` | integer | FK → `listings.id` |
| `session_id` | text | In-memory session ID (no auth required) |

---

## Leaflet Map Setup

The map component (`client/src/components/ListingsMap.tsx`) uses **dynamic import** to avoid SSR/hydration issues:

```ts
const leaflet = await import("leaflet");
const L = leaflet.default;
```

The Leaflet CSS is injected into `<head>` programmatically on first mount:

```ts
useEffect(() => {
  if (document.getElementById("leaflet-css")) return;
  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);
}, []);
```

### Pin Placement

- Listings with **explicit `lat`/`lng`** are placed at exact coordinates.
- Listings without coordinates are placed at a **department centroid** and **jittered** radially so multiple pins in the same department don't stack.

### Department Centroids

```ts
const DEPT_COORDS: Record<string, [number, number]> = {
  "Ouest":      [18.5466, -72.3388],  // Port-au-Prince
  "Nord":       [19.7567, -72.2045],  // Cap-Haïtien
  "Artibonite": [19.1100, -72.6900],  // Saint-Marc
  "Sud-Est":    [18.2330, -72.5367],  // Jacmel
  // ... all 10 departments
};
```

### Pin Colors by Property Type

| Type | Color | Abbreviation |
|---|---|---|
| Villa | Amber `#f59e0b` | VL |
| Maison | Blue `#3b82f6` | MN |
| Appartement | Purple `#8b5cf6` | AP |
| Terrain | Green `#10b981` | TR |
| Commercial | Orange `#f97316` | CO |

Pins are rendered as inline SVG via `L.divIcon`. Clicking a pin opens a Leaflet popup with a photo, price, badges, and a "Voir l'annonce →" button that navigates to the listing detail page.

---

## Seed Data

The database is seeded automatically on first boot via `storage.seedIfEmpty()` (called in `server/routes.ts`). The function checks row count — if zero, it inserts 10 sample listings spanning Haiti's main regions:

| # | Title | City | Dept | Type | Price |
|---|---|---|---|---|---|
| 1 | Villa Moderne avec Vue sur la Mer | Pétion-Ville | Ouest | Villa | $485,000 |
| 2 | Appartement Neuf au Centre-Ville | Port-au-Prince | Ouest | Apartment | $1,800/mo |
| 3 | Terrain en Bord de Mer – Limbé | Limbé | Nord | Land | $95,000 |
| 4 | Maison Familiale à Delmas | Delmas | Ouest | House | $195,000 |
| 5 | Local Commercial – Cap-Haïtien | Cap-Haïtien | Nord | Commercial | $2,500/mo |
| 6 | Maison avec Jardin – Jacmel | Jacmel | Sud-Est | House | $145,000 |
| 7 | Studio Meublé – Pétion-Ville | Pétion-Ville | Ouest | Apartment | $750/mo |
| 8 | Terrain Agricole – Artibonite | Saint-Marc | Artibonite | Land | $38,000 |
| 9 | Villa avec Piscine – Laboule | Pétion-Ville | Ouest | Villa | $750,000 |
| 10 | Appartement 2 Chambres – Turgeau | Port-au-Prince | Ouest | Apartment | $1,100/mo |

To re-seed from scratch: delete `database.sqlite` and restart the server.

---

## Design System

- **Colors:** Deep Caribbean Teal (`hsl(186 72% 28%)`) primary, Warm Sand background, Coral accent (`hsl(14 85% 55%)`)
- **Dark mode:** Fully supported — toggle in the navbar, seeded from `prefers-color-scheme`
- **Typography:** Plus Jakarta Sans (Google Fonts)
- **UI:** shadcn/ui components with a custom HSL palette replacing the default `red` placeholders
- **Routing:** Hash-based (`/#/`, `/#/browse`, `/#/listing/:id`) for static hosting compatibility

---

## License

MIT
