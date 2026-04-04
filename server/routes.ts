import type { Express } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { insertListingSchema, insertSavedListingSchema } from "@shared/schema";

export function registerRoutes(httpServer: Server, app: Express) {
  // Seed database on startup (async, fire-and-forget)
  storage.seedIfEmpty().catch(console.error);

  // GET /api/listings - with optional filters
  app.get("/api/listings", async (req, res) => {
    try {
      const { search, city, department, priceMin, priceMax, propertyType, priceType, bedrooms } = req.query;
      const results = await storage.getListings({
        search: search as string,
        city: city as string,
        department: department as string,
        priceMin: priceMin ? Number(priceMin) : undefined,
        priceMax: priceMax ? Number(priceMax) : undefined,
        propertyType: propertyType as string,
        priceType: priceType as string,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
      });
      res.json(results);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch listings" });
    }
  });

  // GET /api/listings/featured
  app.get("/api/listings/featured", async (req, res) => {
    try {
      res.json(await storage.getFeaturedListings());
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch featured listings" });
    }
  });

  // GET /api/listings/:id
  app.get("/api/listings/:id", async (req, res) => {
    try {
      const listing = await storage.getListingById(Number(req.params.id));
      if (!listing) return res.status(404).json({ error: "Listing not found" });
      res.json(listing);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  // POST /api/listings
  app.post("/api/listings", async (req, res) => {
    try {
      const data = insertListingSchema.parse(req.body);
      const listing = await storage.createListing(data);
      res.status(201).json(listing);
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Invalid data" });
    }
  });

  // GET /api/saved/:sessionId
  app.get("/api/saved/:sessionId", async (req, res) => {
    try {
      res.json(await storage.getSavedListings(req.params.sessionId));
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch saved listings" });
    }
  });

  // POST /api/saved
  app.post("/api/saved", async (req, res) => {
    try {
      const data = insertSavedListingSchema.parse(req.body);
      // Toggle: unsave if already saved
      if (await storage.isSaved(data.listingId, data.sessionId)) {
        await storage.unsaveListing(data.listingId, data.sessionId);
        return res.json({ saved: false });
      }
      await storage.saveListing(data);
      res.json({ saved: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Invalid data" });
    }
  });

  // GET /api/saved/:sessionId/:listingId/status
  app.get("/api/saved/:sessionId/:listingId/status", async (req, res) => {
    try {
      const saved = await storage.isSaved(Number(req.params.listingId), req.params.sessionId);
      res.json({ saved });
    } catch (e) {
      res.status(500).json({ error: "Failed" });
    }
  });
}
