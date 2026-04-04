import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, like, gte, lte, sql, or } from "drizzle-orm";
import { listings, savedListings } from "@shared/schema";
import type { Listing, InsertListing, SavedListing, InsertSavedListing } from "@shared/schema";

const sqlite = new Database("database.sqlite");
const db = drizzle(sqlite);

// Create tables if not exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    price_type TEXT NOT NULL DEFAULT 'sale',
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    department TEXT NOT NULL,
    property_type TEXT NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area_sqm REAL,
    lat REAL,
    lng REAL,
    images TEXT NOT NULL DEFAULT '[]',
    amenities TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    featured INTEGER DEFAULT 0,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_email TEXT
  );

  CREATE TABLE IF NOT EXISTS saved_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    session_id TEXT NOT NULL
  );
`);

export interface IStorage {
  getListings(filters?: ListingFilters): Listing[];
  getListingById(id: number): Listing | undefined;
  createListing(data: InsertListing): Listing;
  getFeaturedListings(): Listing[];
  getSavedListings(sessionId: string): Listing[];
  saveListing(data: InsertSavedListing): SavedListing;
  unsaveListing(listingId: number, sessionId: string): void;
  isSaved(listingId: number, sessionId: string): boolean;
  seedIfEmpty(): void;
}

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

export const storage: IStorage = {
  getListings(filters?: ListingFilters): Listing[] {
    let query = db.select().from(listings).where(eq(listings.status, "active"));
    const rows = db.select().from(listings).all() as Listing[];
    
    let results = rows.filter(l => l.status === "active");
    
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      results = results.filter(l =>
        l.title.toLowerCase().includes(s) ||
        l.city.toLowerCase().includes(s) ||
        l.department.toLowerCase().includes(s) ||
        l.address.toLowerCase().includes(s) ||
        l.description.toLowerCase().includes(s)
      );
    }
    if (filters?.city) {
      results = results.filter(l => l.city.toLowerCase() === filters.city!.toLowerCase());
    }
    if (filters?.department) {
      results = results.filter(l => l.department === filters.department);
    }
    if (filters?.priceMin !== undefined) {
      results = results.filter(l => l.price >= filters.priceMin!);
    }
    if (filters?.priceMax !== undefined) {
      results = results.filter(l => l.price <= filters.priceMax!);
    }
    if (filters?.propertyType) {
      results = results.filter(l => l.propertyType === filters.propertyType);
    }
    if (filters?.priceType) {
      results = results.filter(l => l.priceType === filters.priceType);
    }
    if (filters?.bedrooms !== undefined) {
      results = results.filter(l => (l.bedrooms ?? 0) >= filters.bedrooms!);
    }
    
    return results;
  },

  getListingById(id: number): Listing | undefined {
    return db.select().from(listings).where(eq(listings.id, id)).get() as Listing | undefined;
  },

  createListing(data: InsertListing): Listing {
    return db.insert(listings).values(data).returning().get() as Listing;
  },

  getFeaturedListings(): Listing[] {
    return db.select().from(listings)
      .where(and(eq(listings.featured, true), eq(listings.status, "active")))
      .all() as Listing[];
  },

  getSavedListings(sessionId: string): Listing[] {
    const saved = db.select().from(savedListings)
      .where(eq(savedListings.sessionId, sessionId))
      .all() as SavedListing[];
    
    const ids = saved.map(s => s.listingId);
    if (ids.length === 0) return [];
    
    return ids.map(id => db.select().from(listings).where(eq(listings.id, id)).get()).filter(Boolean) as Listing[];
  },

  saveListing(data: InsertSavedListing): SavedListing {
    return db.insert(savedListings).values(data).returning().get() as SavedListing;
  },

  unsaveListing(listingId: number, sessionId: string): void {
    db.delete(savedListings)
      .where(and(eq(savedListings.listingId, listingId), eq(savedListings.sessionId, sessionId)))
      .run();
  },

  isSaved(listingId: number, sessionId: string): boolean {
    const row = db.select().from(savedListings)
      .where(and(eq(savedListings.listingId, listingId), eq(savedListings.sessionId, sessionId)))
      .get();
    return !!row;
  },

  seedIfEmpty(): void {
    const count = db.select({ count: sql<number>`count(*)` }).from(listings).get() as { count: number };
    if (count.count > 0) return;

    const seedData: InsertListing[] = [
      {
        title: "Villa Moderne avec Vue sur la Mer",
        description: "Magnifique villa de luxe avec une vue panoramique sur la mer des Caraïbes. Finitions haut de gamme, piscine privée, terrasse spacieuse. Idéale pour une famille ou un investissement locatif premium.",
        price: 485000,
        priceType: "sale",
        address: "Route de Laboule, Pétion-Ville",
        city: "Pétion-Ville",
        department: "Ouest",
        propertyType: "villa",
        bedrooms: 4,
        bathrooms: 3,
        areaSqm: 320,
        lat: 18.5100,
        lng: -72.2900,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
          "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80",
          "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Piscine", "Garage", "Sécurité 24h", "Groupe électrogène", "Citerne", "Terrasse"]),
        status: "active",
        featured: true,
        contactName: "Maison Caraïbe Immobilier",
        contactPhone: "+509 3612-0000",
        contactEmail: "info@maisoncaraibe.ht"
      },
      {
        title: "Appartement Neuf au Centre-Ville",
        description: "Appartement moderne de 3 chambres dans un immeuble sécurisé au coeur de Port-au-Prince. Proche de tous les services, commerce et transport. Finitions contemporaines.",
        price: 1800,
        priceType: "rent",
        address: "Avenue John Brown, Bois Verna",
        city: "Port-au-Prince",
        department: "Ouest",
        propertyType: "apartment",
        bedrooms: 3,
        bathrooms: 2,
        areaSqm: 120,
        lat: 18.5460,
        lng: -72.3388,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80",
          "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Climatisation", "Groupe électrogène", "Parking", "Interphone", "Eau courante"]),
        status: "active",
        featured: true,
        contactName: "Agence Lakay",
        contactPhone: "+509 3700-1234",
        contactEmail: "contact@agencylakay.ht"
      },
      {
        title: "Terrain en Bord de Mer – Limbé",
        description: "Grand terrain de 2 hectares en bord de mer à Limbé, idéal pour un projet hôtelier ou de développement résidentiel. Accès direct à la plage, titre foncier clair.",
        price: 95000,
        priceType: "sale",
        address: "Route Côtière, Limbé",
        city: "Limbé",
        department: "Nord",
        propertyType: "land",
        bedrooms: null,
        bathrooms: null,
        areaSqm: 20000,
        lat: 19.7000,
        lng: -72.4000,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1516455590571-18256e5bb9ff?w=800&q=80",
          "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Accès plage", "Titre foncier", "Électricité proche", "Route goudronnée"]),
        status: "active",
        featured: true,
        contactName: "Nord Immo",
        contactPhone: "+509 3888-5566",
        contactEmail: "nordimmo@gmail.com"
      },
      {
        title: "Maison Familiale à Delmas",
        description: "Belle maison de 4 chambres dans un quartier résidentiel calme de Delmas. Cour intérieure, garage pour 2 véhicules, citerne d'eau. Proche des écoles et marchés.",
        price: 195000,
        priceType: "sale",
        address: "Delmas 75, Rue Tranquille",
        city: "Delmas",
        department: "Ouest",
        propertyType: "house",
        bedrooms: 4,
        bathrooms: 2,
        areaSqm: 200,
        lat: 18.5600,
        lng: -72.3100,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80",
          "https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Garage", "Cour", "Citerne", "Groupe électrogène", "Mur de clôture"]),
        status: "active",
        featured: false,
        contactName: "Famille Dupont",
        contactPhone: "+509 3422-7788",
        contactEmail: null
      },
      {
        title: "Local Commercial – Cap-Haïtien",
        description: "Local commercial de 250m² en plein centre de Cap-Haïtien. Idéal pour boutique, restaurant ou bureaux. Visibilité maximale, fort passage piétonnier.",
        price: 2500,
        priceType: "rent",
        address: "Rue 22-23, Cap-Haïtien Centre",
        city: "Cap-Haïtien",
        department: "Nord",
        propertyType: "commercial",
        bedrooms: null,
        bathrooms: 2,
        areaSqm: 250,
        lat: 19.7567,
        lng: -72.2045,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
          "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Vitrine commerciale", "Électricité triphasée", "Toilettes", "Stockage"]),
        status: "active",
        featured: false,
        contactName: "Cap Invest",
        contactPhone: "+509 3600-2200",
        contactEmail: "capinvest@outlook.com"
      },
      {
        title: "Maison avec Jardin – Jacmel",
        description: "Charmante maison coloniale rénovée à Jacmel, ville touristique du sud d'Haïti. Jardin tropical, architecture authentique, proche du bord de mer et des galeries d'art.",
        price: 145000,
        priceType: "sale",
        address: "Route de Marché, Jacmel",
        city: "Jacmel",
        department: "Sud-Est",
        propertyType: "house",
        bedrooms: 3,
        bathrooms: 2,
        areaSqm: 165,
        lat: 18.2330,
        lng: -72.5367,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80",
          "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Jardin", "Terrasse", "Citerne", "Architecture coloniale", "Vue mer"]),
        status: "active",
        featured: true,
        contactName: "Jacmel Patrimoine",
        contactPhone: "+509 3744-9900",
        contactEmail: "info@jacmelpatrimoine.ht"
      },
      {
        title: "Studio Meublé – Pétion-Ville",
        description: "Studio entièrement meublé dans le quartier animé de Pétion-Ville. Parfait pour professionnels ou expatriés. Accès WiFi haut débit, sécurité 24h, générateur.",
        price: 750,
        priceType: "rent",
        address: "Rue Geffrard, Pétion-Ville",
        city: "Pétion-Ville",
        department: "Ouest",
        propertyType: "apartment",
        bedrooms: 1,
        bathrooms: 1,
        areaSqm: 45,
        lat: 18.5133,
        lng: -72.2847,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
          "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Meublé", "WiFi", "Climatisation", "Groupe électrogène", "Sécurité"]),
        status: "active",
        featured: false,
        contactName: "PV Rentals",
        contactPhone: "+509 3811-4455",
        contactEmail: "pvrentals@gmail.com"
      },
      {
        title: "Terrain Agricole – Artibonite",
        description: "Grand terrain agricole de 5 hectares dans la plaine de l'Artibonite, grenier d'Haïti. Sol fertile, accès à l'eau d'irrigation, idéal pour culture rizicole ou maraîchage.",
        price: 38000,
        priceType: "sale",
        address: "Plaine de l'Artibonite, Saint-Marc",
        city: "Saint-Marc",
        department: "Artibonite",
        propertyType: "land",
        bedrooms: null,
        bathrooms: null,
        areaSqm: 50000,
        lat: 19.1100,
        lng: -72.6900,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
          "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Irrigation", "Sol fertile", "Route d'accès", "Titre foncier"]),
        status: "active",
        featured: false,
        contactName: "Agro Haïti",
        contactPhone: "+509 3500-7788",
        contactEmail: "agrohaiti@gmail.com"
      },
      {
        title: "Villa avec Piscine – Laboule",
        description: "Villa d'exception dans le quartier résidentiel huppé de Laboule, en hauteur sur Port-au-Prince. Vue imprenable, piscine à débordement, sécurité maximale. 5 chambres avec suites parentales.",
        price: 750000,
        priceType: "sale",
        address: "Laboule 12, Chemin des Fleurs",
        city: "Pétion-Ville",
        department: "Ouest",
        propertyType: "villa",
        bedrooms: 5,
        bathrooms: 4,
        areaSqm: 480,
        lat: 18.4800,
        lng: -72.3000,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
          "https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=800&q=80",
          "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Piscine à débordement", "Sécurité 24h", "Garage 3 voitures", "Groupe électrogène", "Citerne", "Domotique", "Cave à vin"]),
        status: "active",
        featured: true,
        contactName: "Prestige Immobilier Haiti",
        contactPhone: "+509 3900-0001",
        contactEmail: "prestige@immo-haiti.ht"
      },
      {
        title: "Appartement 2 Chambres – Turgeau",
        description: "Appartement lumineux de 2 chambres dans le quartier résidentiel de Turgeau. Balcon avec vue sur la ville, immeuble récent avec groupe électrogène et citerne.",
        price: 1100,
        priceType: "rent",
        address: "Rue Capois, Turgeau",
        city: "Port-au-Prince",
        department: "Ouest",
        propertyType: "apartment",
        bedrooms: 2,
        bathrooms: 1,
        areaSqm: 85,
        lat: 18.5480,
        lng: -72.3310,
        images: JSON.stringify([
          "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
          "https://images.unsplash.com/photo-1560448075-cbc16bb4af8e?w=800&q=80"
        ]),
        amenities: JSON.stringify(["Balcon", "Climatisation", "Groupe électrogène", "Citerne", "Parking"]),
        status: "active",
        featured: false,
        contactName: "Madame Pierre",
        contactPhone: "+509 3644-2211",
        contactEmail: null
      }
    ];

    for (const item of seedData) {
      db.insert(listings).values(item).run();
    }
  }
};
