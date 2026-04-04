/**
 * db:seed — idempotent seed script for Render Postgres (and any PostgreSQL instance)
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run db:seed
 *
 * Behaviour:
 *   - Inserts each of the 10 canonical seed listings if a row with that exact
 *     title does not already exist.
 *   - Safe to run multiple times against a live database — existing data is
 *     never modified or deleted.
 *   - Works after schema changes: run `npm run db:push` first, then this.
 *
 * Adding new seed listings: append to SEED_DATA below and re-run.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { listings } from "../shared/schema";
import type { InsertListing } from "../shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL is not set.");
  console.error("    export DATABASE_URL=postgresql://user:pass@host:5432/dbname");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client);

// ── Canonical seed listings ───────────────────────────────────────────────────

const SEED_DATA: InsertListing[] = [
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
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Piscine", "Garage", "Sécurité 24h", "Groupe électrogène", "Citerne", "Terrasse"]),
    status: "active",
    featured: true,
    contactName: "Maison Caraïbe Immobilier",
    contactPhone: "+509 3612-0000",
    contactEmail: "info@maisoncaraibe.ht",
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
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Climatisation", "Groupe électrogène", "Parking", "Interphone", "Eau courante"]),
    status: "active",
    featured: true,
    contactName: "Agence Lakay",
    contactPhone: "+509 3700-1234",
    contactEmail: "contact@agencylakay.ht",
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
      "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Accès plage", "Titre foncier", "Électricité proche", "Route goudronnée"]),
    status: "active",
    featured: true,
    contactName: "Nord Immo",
    contactPhone: "+509 3888-5566",
    contactEmail: "nordimmo@gmail.com",
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
      "https://images.unsplash.com/photo-1584738766473-61c083514bf4?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Garage", "Cour", "Citerne", "Groupe électrogène", "Mur de clôture"]),
    status: "active",
    featured: false,
    contactName: "Famille Dupont",
    contactPhone: "+509 3422-7788",
    contactEmail: null,
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
      "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Vitrine commerciale", "Électricité triphasée", "Toilettes", "Stockage"]),
    status: "active",
    featured: false,
    contactName: "Cap Invest",
    contactPhone: "+509 3600-2200",
    contactEmail: "capinvest@outlook.com",
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
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Jardin", "Terrasse", "Citerne", "Architecture coloniale", "Vue mer"]),
    status: "active",
    featured: true,
    contactName: "Jacmel Patrimoine",
    contactPhone: "+509 3744-9900",
    contactEmail: "info@jacmelpatrimoine.ht",
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
      "https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Meublé", "WiFi", "Climatisation", "Groupe électrogène", "Sécurité"]),
    status: "active",
    featured: false,
    contactName: "PV Rentals",
    contactPhone: "+509 3811-4455",
    contactEmail: "pvrentals@gmail.com",
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
      "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Irrigation", "Sol fertile", "Route d'accès", "Titre foncier"]),
    status: "active",
    featured: false,
    contactName: "Agro Haïti",
    contactPhone: "+509 3500-7788",
    contactEmail: "agrohaiti@gmail.com",
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
      "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Piscine à débordement", "Sécurité 24h", "Garage 3 voitures", "Groupe électrogène", "Citerne", "Domotique", "Cave à vin"]),
    status: "active",
    featured: true,
    contactName: "Prestige Immobilier Haiti",
    contactPhone: "+509 3900-0001",
    contactEmail: "prestige@immo-haiti.ht",
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
      "https://images.unsplash.com/photo-1560448075-cbc16bb4af8e?w=800&q=80",
    ]),
    amenities: JSON.stringify(["Balcon", "Climatisation", "Groupe électrogène", "Citerne", "Parking"]),
    status: "active",
    featured: false,
    contactName: "Madame Pierre",
    contactPhone: "+509 3644-2211",
    contactEmail: null,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`\nConnecting to database…`);
  console.log(`Seeding ${SEED_DATA.length} listings (skipping any that already exist by title)…\n`);

  let inserted = 0;
  let skipped = 0;

  for (const item of SEED_DATA) {
    // Check by title — idempotent, no schema changes needed
    const existing = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.title, item.title));

    if (existing.length > 0) {
      console.log(`  skip  "${item.title}" (id=${existing[0].id})`);
      skipped++;
    } else {
      const rows = await db.insert(listings).values(item).returning({ id: listings.id });
      console.log(`  ✓  inserted "${item.title}" (id=${rows[0].id})`);
      inserted++;
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} already existed.`);
  await client.end();
}

seed().catch((err) => {
  console.error("\n❌  Seed failed:", err.message);
  client.end().finally(() => process.exit(1));
});
