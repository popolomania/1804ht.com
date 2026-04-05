/**
 * Admin API — all routes require role="admin"
 *
 * GET    /api/admin/stats              — counts by role/status
 * GET    /api/admin/users              — all users (paginated, filterable)
 * GET    /api/admin/agents             — agents only (pending/approved/suspended)
 * PATCH  /api/admin/users/:id/status   — approve | suspend | reinstate
 * PATCH  /api/admin/users/:id/notes    — update admin notes
 * DELETE /api/admin/users/:id          — delete a non-admin user
 * GET    /api/admin/listings           — all listings with owner info
 * PATCH  /api/admin/listings/:id/status — set listing status (active/pending/sold)
 * DELETE /api/admin/listings/:id       — remove any listing
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { users, listings } from "@shared/schema";
import { eq, ne, isNotNull } from "drizzle-orm";
import { requireAdmin } from "./auth";
import { sendVerificationEmail } from "./mailer";
import type { User } from "@shared/schema";
import { z } from "zod";
import crypto from "crypto";

function generateToken() { return crypto.randomBytes(32).toString("hex"); }
function tokenExpiry() { const d = new Date(); d.setHours(d.getHours() + 24); return d; }

export function registerAdminRoutes(app: Express) {

  // ── GET /api/admin/stats ───────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await db().select().from(users);
      const allListings = await db().select().from(listings);

      const stats = {
        users: {
          total: allUsers.length,
          guests: allUsers.filter((u) => u.role === "guest").length,
          agents: allUsers.filter((u) => u.role === "agent").length,
          admins: allUsers.filter((u) => u.role === "admin").length,
        },
        agents: {
          pending: allUsers.filter((u) => u.role === "agent" && u.accountStatus === "pending").length,
          approved: allUsers.filter((u) => u.role === "agent" && u.accountStatus === "approved").length,
          suspended: allUsers.filter((u) => u.role === "agent" && u.accountStatus === "suspended").length,
          unverifiedEmail: allUsers.filter((u) => u.role === "agent" && !u.emailVerified).length,
        },
        upgradeRequests: allUsers.filter((u) => u.role === "guest" && u.upgradeRequestedAt !== null).length,
        listings: {
          total: allListings.length,
          active: allListings.filter((l) => l.status === "active").length,
          pending: allListings.filter((l) => l.status === "pending").length,
          sold: allListings.filter((l) => l.status === "sold").length,
        },
      };

      res.json(stats);
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/admin/agents ──────────────────────────────────────────────────
  // ?status=pending|approved|suspended|all   (default: all)
  // ?q=search term (name or email)

  // -- GET /api/admin/upgrade-requests --
  app.get("/api/admin/upgrade-requests", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const rows = await db().select().from(users).where(isNotNull(users.upgradeRequestedAt));
      rows.sort((a, b) => (b.upgradeRequestedAt?.getTime() ?? 0) - (a.upgradeRequestedAt?.getTime() ?? 0));
      const safe = rows.map(({ passwordHash: _, verifyToken: __, ...u }) => u);
      res.json(safe);
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // -- POST /api/admin/users/:id/upgrade --
  const upgradeActionSchema = z.object({ action: z.enum(["approve", "reject"]) });

  app.post("/api/admin/users/:id/upgrade", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const parsed = upgradeActionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Action invalide (approve | reject)" });

      const admin = req.user as User;
      const target = (await db().select().from(users).where(eq(users.id, id)))[0];
      if (!target) return res.status(404).json({ error: "Utilisateur introuvable" });
      if (target.role !== "guest") return res.status(400).json({ error: "Cet utilisateur n\'est pas un visiteur" });

      if (parsed.data.action === "reject") {
        const updated = await db()
          .update(users)
          .set({ upgradeRequestedAt: null, upgradeReason: null, reviewedAt: new Date(), reviewedBy: admin.id })
          .where(eq(users.id, id))
          .returning();
        const { passwordHash: _, verifyToken: __, ...safe } = updated[0];
        return res.json({ ...safe, action: "rejected" });
      }

      // approve: promote to agent, issue verify token, send email
      const token = generateToken();
      const expiry = tokenExpiry();
      const updated = await db()
        .update(users)
        .set({
          role: "agent",
          accountStatus: "pending",
          emailVerified: false,
          verifyToken: token,
          verifyTokenExpiry: expiry,
          upgradeRequestedAt: null,
          upgradeReason: null,
          reviewedAt: new Date(),
          reviewedBy: admin.id,
        })
        .where(eq(users.id, id))
        .returning();

      sendVerificationEmail({ to: target.email, name: target.name, token })
        .catch((err: any) => console.error("[upgrade mailer]", err.message));

      const { passwordHash: _, verifyToken: __, ...safe } = updated[0];
      return res.json({ ...safe, action: "approved" });
    } catch (e: any) {
      console.error("[admin/upgrade]", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/admin/agents", requireAdmin, async (req: Request, res: Response) => {
    try {
      const status = (req.query.status as string) || "all";
      const q = (req.query.q as string) || "";

      let rows = await db()
        .select()
        .from(users)
        .where(ne(users.role, "guest"));

      // Filter by status
      if (status !== "all") {
        rows = rows.filter((u) => u.accountStatus === status);
      }
      // Filter by search
      if (q) {
        const ql = q.toLowerCase();
        rows = rows.filter(
          (u) =>
            u.name.toLowerCase().includes(ql) ||
            u.email.toLowerCase().includes(ql) ||
            (u.phone ?? "").toLowerCase().includes(ql)
        );
      }

      // Sort: pending first, then newest first
      rows.sort((a, b) => {
        if (a.accountStatus === "pending" && b.accountStatus !== "pending") return -1;
        if (b.accountStatus === "pending" && a.accountStatus !== "pending") return 1;
        return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      });

      // Strip password hashes
      const safe = rows.map(({ passwordHash: _, verifyToken: __, ...u }) => u);
      res.json(safe);
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── PATCH /api/admin/users/:id/status ─────────────────────────────────────
  const statusSchema = z.object({
    status: z.enum(["approved", "suspended", "pending"]),
  });

  app.patch("/api/admin/users/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const parsed = statusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Statut invalide" });

      const admin = req.user as User;

      // Prevent self-suspension
      if (id === admin.id) return res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre statut" });

      const target = await db().select().from(users).where(eq(users.id, id));
      if (!target[0]) return res.status(404).json({ error: "Utilisateur introuvable" });
      if (target[0].role === "admin") return res.status(400).json({ error: "Impossible de modifier un administrateur" });

      const updated = await db()
        .update(users)
        .set({
          accountStatus: parsed.data.status,
          reviewedAt: new Date(),
          reviewedBy: admin.id,
        })
        .where(eq(users.id, id))
        .returning();

      const { passwordHash: _, verifyToken: __, ...safe } = updated[0];
      res.json(safe);
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── PATCH /api/admin/users/:id/notes ──────────────────────────────────────
  const notesSchema = z.object({ notes: z.string().max(1000) });

  app.patch("/api/admin/users/:id/notes", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const parsed = notesSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Notes invalides" });

      const updated = await db()
        .update(users)
        .set({ adminNotes: parsed.data.notes })
        .where(eq(users.id, id))
        .returning();

      if (!updated[0]) return res.status(404).json({ error: "Utilisateur introuvable" });
      const { passwordHash: _, verifyToken: __, ...safe } = updated[0];
      res.json(safe);
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── DELETE /api/admin/users/:id ────────────────────────────────────────────
  app.delete("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const admin = req.user as User;
      if (id === admin.id) return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });

      const target = await db().select().from(users).where(eq(users.id, id));
      if (!target[0]) return res.status(404).json({ error: "Utilisateur introuvable" });
      if (target[0].role === "admin") return res.status(400).json({ error: "Impossible de supprimer un administrateur" });

      await db().delete(users).where(eq(users.id, id));
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── GET /api/admin/listings ────────────────────────────────────────────────
  app.get("/api/admin/listings", requireAdmin, async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) || "";
      const status = (req.query.status as string) || "all";

      let rows = await db().select().from(listings);

      if (status !== "all") rows = rows.filter((l) => l.status === status);
      if (q) {
        const ql = q.toLowerCase();
        rows = rows.filter(
          (l) =>
            l.title.toLowerCase().includes(ql) ||
            l.city.toLowerCase().includes(ql) ||
            l.contactName.toLowerCase().includes(ql)
        );
      }

      // Attach owner name/email for display
      const allUsers = await db().select().from(users);
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      const enriched = rows.map((l) => {
        const owner = l.ownerId ? userMap.get(l.ownerId) : null;
        return {
          ...l,
          ownerName: owner?.name ?? null,
          ownerEmail: owner?.email ?? null,
          ownerStatus: owner?.accountStatus ?? null,
        };
      });

      res.json(enriched);
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── PATCH /api/admin/listings/:id/status ──────────────────────────────────
  const listingStatusSchema = z.object({
    status: z.enum(["active", "pending", "sold"]),
  });

  app.patch("/api/admin/listings/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const parsed = listingStatusSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Statut invalide" });

      const updated = await db()
        .update(listings)
        .set({ status: parsed.data.status })
        .where(eq(listings.id, id))
        .returning();

      if (!updated[0]) return res.status(404).json({ error: "Annonce introuvable" });
      res.json(updated[0]);
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ── DELETE /api/admin/listings/:id ────────────────────────────────────────
  app.delete("/api/admin/listings/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      const deleted = await db().delete(listings).where(eq(listings.id, id)).returning();
      if (!deleted[0]) return res.status(404).json({ error: "Annonce introuvable" });
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}
