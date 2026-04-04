import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Search, MapPin, TrendingUp, Shield, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import ListingCard from "@/components/ListingCard";
import type { Listing } from "@shared/schema";
import { getSessionId, DEPARTMENTS, PROPERTY_TYPES } from "@/lib/utils";

const CITIES = ["Port-au-Prince", "Pétion-Ville", "Delmas", "Cap-Haïtien", "Jacmel", "Saint-Marc", "Gonaïves", "Limbé", "Cayes", "Jérémie"];

export default function Home() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [priceType, setPriceType] = useState("all");
  const [propertyType, setPropertyType] = useState("all");

  const sessionId = getSessionId();

  const { data: featured, isLoading: featuredLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings/featured"],
  });

  const { data: saved } = useQuery<Listing[]>({
    queryKey: ["/api/saved", sessionId],
    queryFn: async () => {
      
      return apiRequest("GET", `/api/saved/${sessionId}`).then(r => r.json());
    },
  });
  const savedIds = (saved ?? []).map((l: Listing) => l.id);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (priceType !== "all") params.set("priceType", priceType);
    if (propertyType !== "all") params.set("propertyType", propertyType);
    setLocation(`/browse?${params.toString()}`);
  };

  const handleCityClick = (city: string) => {
    setLocation(`/browse?search=${encodeURIComponent(city)}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="relative min-h-[520px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0" style={{
          background: "linear-gradient(135deg, hsl(186 72% 18%) 0%, hsl(186 60% 28%) 40%, hsl(14 70% 40%) 100%)"
        }}>
          {/* Decorative pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          {/* Decorative circles */}
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full opacity-20" style={{ background: "hsl(14 85% 55%)" }} />
          <div className="absolute -left-10 bottom-0 w-60 h-60 rounded-full opacity-10" style={{ background: "hsl(186 72% 60%)" }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-20 w-full">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/20 backdrop-blur text-white text-xs font-medium px-3 py-1 rounded-full border border-white/30">
              🇭🇹 La plateforme immobilière d'Haïti
            </span>
          </div>
          <h1 className="text-white font-bold text-4xl md:text-5xl leading-tight mb-3">
            Trouvez votre<br />
            <span className="text-yellow-300">Kaye</span> en Haïti
          </h1>
          <p className="text-white/80 text-lg mb-8 max-w-xl">
            Maisons, appartements, terrains et villas dans toutes les régions du pays.
          </p>

          {/* Search bar */}
          <div className="bg-white dark:bg-card rounded-xl p-3 search-hero-bar" data-testid="search-hero">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Ville, quartier, département..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="pl-9 border-none bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="input-search-hero"
                />
              </div>
              <Select value={priceType} onValueChange={setPriceType}>
                <SelectTrigger className="w-full md:w-36 bg-muted/50 border-none" data-testid="select-price-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Acheter / Louer</SelectItem>
                  <SelectItem value="sale">À Vendre</SelectItem>
                  <SelectItem value="rent">À Louer</SelectItem>
                </SelectContent>
              </Select>
              <Select value={propertyType} onValueChange={setPropertyType}>
                <SelectTrigger className="w-full md:w-40 bg-muted/50 border-none" data-testid="select-property-type">
                  <SelectValue placeholder="Propriété" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tout type</SelectItem>
                  {PROPERTY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} className="bg-primary text-primary-foreground md:px-8" data-testid="btn-search-hero">
                Rechercher
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick city links */}
      <section className="bg-muted/40 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
              <MapPin className="w-3 h-3" /> Villes:
            </span>
            {CITIES.map(city => (
              <button
                key={city}
                onClick={() => handleCityClick(city)}
                className="shrink-0 px-3 py-1 text-xs font-medium bg-background border rounded-full hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                data-testid={`city-chip-${city}`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured listings */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Coups de coeur</h2>
            <p className="text-sm text-muted-foreground">Propriétés sélectionnées par notre équipe</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/browse")} data-testid="btn-see-all">
            Voir tout
          </Button>
        </div>

        {featuredLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-lg overflow-hidden border">
                <Skeleton className="h-48 w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(featured ?? []).map(listing => (
              <ListingCard key={listing.id} listing={listing} savedIds={savedIds} />
            ))}
          </div>
        )}
      </section>

      {/* Why Kaye Ayiti */}
      <section className="bg-muted/30 border-y">
        <div className="max-w-7xl mx-auto px-4 py-14">
          <h2 className="text-xl font-bold text-center mb-10">Pourquoi Kaye Ayiti ?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <TrendingUp className="w-6 h-6 text-primary" />,
                title: "Marché local transparent",
                desc: "Des annonces vérifiées avec prix réels du marché haïtien, sans intermédiaire inutile."
              },
              {
                icon: <Shield className="w-6 h-6 text-primary" />,
                title: "Annonces de confiance",
                desc: "Chaque propriété est publiée directement par les propriétaires ou agents agréés."
              },
              {
                icon: <Phone className="w-6 h-6 text-primary" />,
                title: "Contact direct",
                desc: "Contactez directement les vendeurs ou locataires. Pas de commission cachée."
              }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 bg-card rounded-xl border" data-testid={`feature-card-${i}`}>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  {item.icon}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse by department */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-xl font-bold mb-6">Explorer par département</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {DEPARTMENTS.map(dept => (
            <button
              key={dept}
              onClick={() => setLocation(`/browse?department=${dept}`)}
              className="p-4 text-sm font-medium rounded-lg border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all text-left"
              data-testid={`dept-btn-${dept}`}
            >
              {dept}
            </button>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 py-14 text-center">
          <h2 className="text-2xl font-bold mb-3">Vous avez une propriété à vendre ou louer ?</h2>
          <p className="text-primary-foreground/80 mb-6 text-sm">Publiez gratuitement votre annonce et rejoignez des milliers de vendeurs en Haïti.</p>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setLocation("/list-property")}
            className="font-semibold"
            data-testid="btn-list-property-cta"
          >
            Publier une annonce gratuite
          </Button>
        </div>
      </section>
    </div>
  );
}
