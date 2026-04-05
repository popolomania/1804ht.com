import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Home from "@/pages/Home";
import Browse from "@/pages/Browse";
import ListingDetail from "@/pages/ListingDetail";
import Saved from "@/pages/Saved";
import ListProperty from "@/pages/ListProperty";
import VerifyEmail from "@/pages/VerifyEmail";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import UpgradeModal from "@/components/UpgradeModal";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import { useState } from "react";
import { Building2, MailCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── /list-property gate ───────────────────────────────────────────────────────
// Three states:
//   1. Not logged in / not an agent → register CTA
//   2. Agent but unverified          → verify-email wall
//   3. Agent + verified              → form
// -- /admin gate --
function AdminRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role === "admin") return <AdminDashboard />;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-4 text-center">
      <ShieldAlert className="w-12 h-12 text-destructive opacity-60" />
      <h2 className="text-xl font-bold">Accès réservé aux administrateurs</h2>
      <p className="text-muted-foreground max-w-sm">Vous n avez pas les droits pour accéder à cette page.</p>
    </div>
  );
}

function AgentOnlyRoute() {
  const { user, loading, resendVerification } = useAuth();
  const [modal, setModal] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (loading) return null;

  // State 3 — verified agent
  if (user?.role === "agent" && user.emailVerified) return <ListProperty />;

  // State 2 — unverified agent
  if (user?.role === "agent" && !user.emailVerified) {
    const handleResend = async () => {
      try {
        setResending(true);
        await resendVerification();
        setResent(true);
      } catch {
        // Banner already shows a toast; silently ignore here
      } finally {
        setResending(false);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <MailCheck className="w-12 h-12 text-amber-500" />
        <h2 className="text-xl font-bold">Vérifiez votre email d'abord</h2>
        <p className="text-muted-foreground max-w-sm">
          Un lien de confirmation a été envoyé à{" "}
          <span className="font-mono font-medium">{user.email}</span>.
          Cliquez sur ce lien pour activer votre compte Agent et publier des annonces.
        </p>
        {!resent ? (
          <Button variant="outline" onClick={handleResend} disabled={resending}>
            {resending ? "Envoi…" : "Renvoyer l'email"}
          </Button>
        ) : (
          <p className="text-sm text-green-600 font-medium">Email renvoyé — vérifiez votre boîte.</p>
        )}
      </div>
    );
  }

  // State 1a — logged-in guest
  if (user?.role === "guest") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <Building2 className="w-12 h-12 text-primary opacity-60" />
        <h2 className="text-xl font-bold">Réservé aux agents et propriétaires</h2>
        <p className="text-muted-foreground max-w-sm">
          Vous êtes connecté en tant que Visiteur. Demandez le statut Agent pour pouvoir publier des annonces.
        </p>
        {user.upgradeRequestedAt ? (
          <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
            <span>⏳ Demande en cours d'examen par un administrateur</span>
          </div>
        ) : (
          <Button onClick={() => setModal(true)}>
            Devenir Agent / Propriétaire
          </Button>
        )}
        <UpgradeModal open={modal} onClose={() => setModal(false)} />
      </div>
    );
  }

  // State 1b — not logged in
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
      <Building2 className="w-12 h-12 text-primary opacity-60" />
      <h2 className="text-xl font-bold">Réservé aux agents et propriétaires</h2>
      <p className="text-muted-foreground max-w-sm">
        Créez un compte Agent / Propriétaire ou connectez-vous pour publier une annonce.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setModal(true)}>Se connecter</Button>
        <Button onClick={() => setModal(true)}>Créer un compte</Button>
      </div>
      <AuthModal open={modal} onClose={() => setModal(false)} initialMode="register" />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // Embed mode: hide navbar/footer when loaded via iframe with ?embed=1
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router hook={useHashLocation}>
            <div className="min-h-screen flex flex-col bg-background text-foreground">
              {!isEmbed && <Navbar />}
              {/* Verification banner sits right below the navbar */}
              {!isEmbed && <VerifyEmailBanner />}
              <main className="flex-1">
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/browse" component={Browse} />
                  <Route path="/listing/:id" component={ListingDetail} />
                  <Route path="/saved" component={Saved} />
                  <Route path="/list-property" component={AgentOnlyRoute} />
                  <Route path="/verify" component={VerifyEmail} />
                  <Route path="/admin" component={AdminRoute} />
                  <Route component={NotFound} />
                </Switch>
              </main>
              {!isEmbed && <Footer />}
            </div>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
