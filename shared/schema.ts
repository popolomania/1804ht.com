import { pgTable, text, integer, real, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
});

export const savedListings = pgTable("saved_listings", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id").notNull(),
  sessionId: text("session_id").notNull(),
});

export const insertListingSchema = createInsertSchema(listings).omit({ id: true });
export const insertSavedListingSchema = createInsertSchema(savedListings).omit({ id: true });

export type Listing = typeof listings.$inferSelect;
export type InsertListing = z.infer<typeof insertListingSchema>;
export type SavedListing = typeof savedListings.$inferSelect;
export type InsertSavedListing = z.infer<typeof insertSavedListingSchema>;
