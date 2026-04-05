import { pgTable, text, integer, real, boolean, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // "guest" = browse only, "agent" = can list/edit/delete own listings, "admin" = full access
  role: text("role").notNull().default("guest"),
  phone: text("phone"),
  // Email verification
  emailVerified: boolean("email_verified").notNull().default(false),
  verifyToken: text("verify_token"),
  verifyTokenExpiry: timestamp("verify_token_expiry"),
  // Admin-controlled status
  // "pending"  = email verified but awaiting admin approval (agents only)
  // "approved" = admin has approved the agent account
  // "suspended" = admin has suspended the account
  // guests always have "approved" (no manual review needed)
  accountStatus: text("account_status").notNull().default("approved"),
  adminNotes: text("admin_notes"),           // internal notes by admin
  reviewedAt: timestamp("reviewed_at"),      // when admin last acted on the account
  reviewedBy: integer("reviewed_by"),        // admin user id
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, passwordHash: true, createdAt: true });
export const registerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  role: z.enum(["guest", "agent"]).default("guest"), // "admin" not exposed in public form
  phone: z.string().optional(),
});

export type AccountStatus = "pending" | "approved" | "suspended";
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// ── Listings ──────────────────────────────────────────────────────────────────
export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  priceType: text("price_type").notNull().default("sale"), // "sale" | "rent"
  address: text("address").notNull(),
  city: text("city").notNull(),
  department: text("department").notNull(), // e.g. "Ouest", "Nord", "Artibonite"
  propertyType: text("property_type").notNull(), // "house" | "land" | "apartment" | "commercial" | "villa"
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  areaSqm: real("area_sqm"),
  lat: real("lat"),
  lng: real("lng"),
  images: text("images").notNull().default("[]"), // JSON array of image URLs
  amenities: text("amenities").notNull().default("[]"), // JSON array
  status: text("status").notNull().default("active"), // "active" | "sold" | "pending"
  featured: boolean("featured").default(false),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email"),
  ownerId: integer("owner_id"), // FK → users.id (null for seed/legacy listings)
});

export const savedListings = pgTable("saved_listings", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  sessionId: text("session_id").notNull(),
});

export const insertListingSchema = createInsertSchema(listings).omit({ id: true });
export const updateListingSchema = insertListingSchema.partial();
export const insertSavedListingSchema = createInsertSchema(savedListings).omit({ id: true });

export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type SavedListing = typeof savedListings.$inferSelect;
export type InsertSavedListing = z.infer<typeof insertSavedListingSchema>;
