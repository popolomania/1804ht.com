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

export default function App() {
  // Embed mode: hide navbar/footer when loaded via iframe with ?embed=1
  const isEmbed = new URLSearchParams(window.location.search).get("embed") === "1";

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router hook={useHashLocation}>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            {!isEmbed && <Navbar />}
            <main className="flex-1">
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/browse" component={Browse} />
                <Route path="/listing/:id" component={ListingDetail} />
                <Route path="/saved" component={Saved} />
                <Route path="/list-property" component={ListProperty} />
                <Route component={NotFound} />
              </Switch>
            </main>
            {!isEmbed && <Footer />}
          </div>
        </Router>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
