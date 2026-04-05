import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { User } from "@shared/schema";
import { registerSchema, loginSchema } from "@shared/schema";
import MemoryStore from "memorystore";
import { sendVerificationEmail, sendWelcomeEmail } from "./mailer";

const MemStore = MemoryStore(session);

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
function tokenExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 24);
  return d;
}

export function safeUser(user: User) {
  const { passwordHash: _, verifyToken: __, ...safe } = user;
  return safe;
}

// ── Passport strategy ─────────────────────────────────────────────────────────
passport.use(
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const rows = await db().select().from(users).where(eq(users.email, email));
      const user = rows[0];
      if (!user) return done(null, false, { message: "Email ou mot de passe incorrect" });
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return done(null, false, { message: "Email ou mot de passe incorrect" });
      return done(null, user);
    } catch (e) {
      return done(e);
    }
  })
);

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: number, done) => {
  try {
    const rows = await db().select().from(users).where(eq(users.id, id));
    done(null, rows[0] ?? null);
  } catch (e) {
    done(e);
  }
});

// ── Middleware setup ───────────────────────────────────────────────────────────
export function setupAuth(app: Express) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "1804ht-secret-changeme",
      resave: false,
      saveUninitialized: false,
      store: new MemStore({ checkPeriod: 86_400_000 }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
}

// ── Bootstrap admin from env ──────────────────────────────────────────────────
// Set ADMIN_EMAIL + ADMIN_PASSWORD in env to auto-create an admin on startup.
export async function bootstrapAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  try {
    const existing = await db().select().from(users).where(eq(users.email, email));
    if (existing.length > 0) {
      // Ensure existing user has admin role
      if (existing[0].role !== "admin") {
        await db().update(users).set({ role: "admin", accountStatus: "approved" }).where(eq(users.id, existing[0].id));
        console.log(`[admin] Promoted ${email} to admin`);
      }
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await db().insert(users).values({
      name: "Admin",
      email,
      passwordHash,
      role: "admin",
      emailVerified: true,
      accountStatus: "approved",
    });
    console.log(`[admin] Bootstrap admin created: ${email}`);
  } catch (e: any) {
    console.error("[admin] Bootstrap failed:", e.message);
  }
}

// ── Auth routes ────────────────────────────────────────────────────────────────
export function registerAuthRoutes(app: Express) {

  // POST /api/auth/register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { name, email, password, role, phone } = parsed.data;

      const existing = await db().select().from(users).where(eq(users.email, email));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Cet email est déjà utilisé" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const isAgent = role === "agent";

      // Guests: auto-verified + approved. Agents: need email verify → then pending admin review.
      const verifyToken = isAgent ? generateToken() : null;
      const verifyTokenExpiry = isAgent ? tokenExpiry() : null;
      const emailVerified = !isAgent;
      const accountStatus = isAgent ? "pending" : "approved";

      const rows = await db()
        .insert(users)
        .values({
          name,
          email,
          passwordHash,
          role: role ?? "guest",
          phone: phone ?? null,
          emailVerified,
          verifyToken,
          verifyTokenExpiry,
          accountStatus,
        })
        .returning();
      const user = rows[0];

      if (isAgent && verifyToken) {
        sendVerificationEmail({ to: email, name, token: verifyToken }).catch((err) =>
          console.error("[mailer] Failed to send verification email:", err.message)
        );
      }

      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Erreur de connexion" });
        return res.status(201).json({
          ...safeUser(user),
          pendingVerification: isAgent,
        });
      });
    } catch (e: any) {
      console.error("[register]", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // POST /api/auth/login
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Email ou mot de passe manquant" });
    }

    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) return res.status(500).json({ error: "Erreur serveur" });
      if (!user) return res.status(401).json({ error: info?.message ?? "Identifiants incorrects" });

      req.login(user, (loginErr) => {
        if (loginErr) return res.status(500).json({ error: "Erreur de connexion" });
        return res.json(safeUser(user));
      });
    })(req, res, next);
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => res.json({ ok: true }));
  });

  // GET /api/auth/me
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Non connecté" });
    return res.json(safeUser(req.user as User));
  });

  // GET /api/auth/verify/:token
  app.get("/api/auth/verify/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      if (!token || token.length !== 64) return res.redirect("/#/verify?error=invalid");

      const rows = await db().select().from(users).where(eq(users.verifyToken, token as string));
      const user = rows[0];

      if (!user) return res.redirect("/#/verify?error=invalid");
      if (user.emailVerified) return res.redirect("/#/verify?error=already");
      if (user.verifyTokenExpiry && new Date() > user.verifyTokenExpiry) {
        return res.redirect("/#/verify?error=expired");
      }

      // Mark email verified; accountStatus stays "pending" — admin still needs to approve
      await db()
        .update(users)
        .set({ emailVerified: true, verifyToken: null, verifyTokenExpiry: null })
        .where(eq(users.id, user.id));

      if (req.user && (req.user as User).id === user.id) {
        (req.user as any).emailVerified = true;
        (req.user as any).verifyToken = null;
      }

      sendWelcomeEmail({ to: user.email, name: user.name }).catch(() => {});
      return res.redirect("/#/verify?success=1");
    } catch (e) {
      console.error("[verify]", e);
      return res.redirect("/#/verify?error=server");
    }
  });

  // POST /api/auth/resend-verification
  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (!user) return res.status(401).json({ error: "Connexion requise" });
    if (user.role !== "agent") return res.status(400).json({ error: "Réservé aux agents" });
    if (user.emailVerified) return res.status(400).json({ error: "Email déjà vérifié" });

    try {
      const token = generateToken();
      const expiry = tokenExpiry();
      await db().update(users).set({ verifyToken: token, verifyTokenExpiry: expiry }).where(eq(users.id, user.id));
      (req.user as any).verifyToken = token;
      (req.user as any).verifyTokenExpiry = expiry;
      await sendVerificationEmail({ to: user.email, name: user.name, token });
      return res.json({ ok: true });
    } catch (e: any) {
      console.error("[resend-verification]", e.message);
      return res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
    }
  });
}

// ── Guards ────────────────────────────────────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Connexion requise" });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as User | undefined;
  if (!user) return res.status(401).json({ error: "Connexion requise" });
  if (user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux administrateurs" });
  next();
}

// Verified email + admin-approved accountStatus
export function requireAgent(req: Request, res: Response, next: NextFunction) {
  const user = req.user as User | undefined;
  if (!user) return res.status(401).json({ error: "Connexion requise" });
  if (user.role !== "agent" && user.role !== "admin") {
    return res.status(403).json({ error: "Réservé aux agents / propriétaires" });
  }
  if (user.role === "agent" && !user.emailVerified) {
    return res.status(403).json({ error: "Vérifiez votre email avant de publier une annonce" });
  }
  if (user.role === "agent" && user.accountStatus !== "approved") {
    return res.status(403).json({
      error:
        user.accountStatus === "pending"
          ? "Votre compte est en attente d'approbation par un administrateur"
          : "Votre compte a été suspendu — contactez le support",
    });
  }
  next();
}
