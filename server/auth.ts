import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { User } from "@shared/schema";
import { registerSchema, loginSchema } from "@shared/schema";
import MemoryStore from "memorystore";

const MemStore = MemoryStore(session);

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
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
}

// ── Auth route handlers ────────────────────────────────────────────────────────
export function registerAuthRoutes(app: Express) {
  // POST /api/auth/register
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      const { name, email, password, role, phone } = parsed.data;

      // Check duplicate email
      const existing = await db().select().from(users).where(eq(users.email, email));
      if (existing.length > 0) {
        return res.status(409).json({ error: "Cet email est déjà utilisé" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const rows = await db()
        .insert(users)
        .values({ name, email, passwordHash, role: role ?? "guest", phone: phone ?? null })
        .returning();
      const user = rows[0];

      // Auto-login after register
      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: "Erreur de connexion" });
        return res.status(201).json(safeUser(user));
      });
    } catch (e: any) {
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

  // GET /api/auth/me — returns current user or 401
  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Non connecté" });
    return res.json(safeUser(req.user as User));
  });
}

// Strip passwordHash from responses
export function safeUser(user: User) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

// Guard middleware: must be logged in
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Connexion requise" });
  next();
}

// Guard middleware: must be agent
export function requireAgent(req: Request, res: Response, next: NextFunction) {
  const user = req.user as User | undefined;
  if (!user) return res.status(401).json({ error: "Connexion requise" });
  if (user.role !== "agent") return res.status(403).json({ error: "Réservé aux agents / propriétaires" });
  next();
}
