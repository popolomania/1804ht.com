import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { storage } from "./storage";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes, bootstrapAdmin } from "./auth";
import { registerAdminRoutes } from "./adminRoutes";
import { runMigrations } from "./migrate";

const app = express();
const httpServer = createServer(app);

// CORS – allow Squarespace and any domain to embed & call the API
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Allow iframe embedding from any origin (for Squarespace)
  res.removeHeader("X-Frame-Options");
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Auth (session + passport) — must come after body parsers
setupAuth(app);
registerAuthRoutes(app);
registerAdminRoutes(app);

// Health check — shows DB status and schema state without leaking secrets
app.get("/api/health", async (_req, res) => {
  const checks: Record<string, string> = {};
  checks.server = "ok";
  checks.nodeEnv = process.env.NODE_ENV ?? "unset";
  checks.databaseUrl = process.env.DATABASE_URL
    ? "set (" + process.env.DATABASE_URL.replace(/:([^@]+)@/, ":***@") + ")"
    : "MISSING";

  try {
    const { db } = await import("./db");
    const result = await db().execute(
      (await import("drizzle-orm/sql")).sql`SELECT 1 as ok`
    );
    checks.db = "connected";
    // Quick schema check
    const cols = await db().execute(
      (await import("drizzle-orm/sql")).sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY column_name
      `
    );
    checks.usersColumns = (cols as any[]).map((r: any) => r.column_name).join(", ") || "table missing";
  } catch (e: any) {
    checks.db = "ERROR: " + e.message;
  }

  const dbOk = checks.db === "connected" && checks.databaseUrl !== "MISSING";
  // Return 200 for liveness (server is running) — Railway healthcheck only needs this.
  // Database status is still reported in the response body for observability.
  res.status(200).json({ ...checks, dbReady: dbOk });
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run DB migrations FIRST — before routes, seeds, or anything else.
  // Uses only the 'postgres' prod dependency; no drizzle-kit needed.
  await runMigrations();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      // Seed after the server is listening so DATABASE_URL is guaranteed
      // to be available (Railway/Render inject env vars before starting the process,
      // but we defer anyway to keep startup non-blocking)
      storage.seedIfEmpty().catch((err) => {
        console.error("Seed failed (non-fatal):", err.message);
      });
      bootstrapAdmin().catch((err) => {
        console.error("Admin bootstrap failed (non-fatal):", err.message);
      });
    },
  );
})();
