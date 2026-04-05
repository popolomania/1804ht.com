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
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Gate /list-property to agents only — shows an inline prompt otherwise
function AgentOnlyRoute() {
  const { user, loading } = useAuth();
  const [modal, setModal] = useState(false);

  if (loading) return null;
  if (user?.role === "agent") return <ListProperty />;

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
              <main className="flex-1">
                <Switch>
                  <Route path="/" component={Home} />
                  <Route path="/browse" component={Browse} />
                  <Route path="/listing/:id" component={ListingDetail} />
                  <Route path="/saved" component={Saved} />
                  <Route path="/list-property" component={AgentOnlyRoute} />
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
