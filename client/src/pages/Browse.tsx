import { useState, useEffect } from "react";
import { useLocation, useLocation as useNav } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X, LayoutGrid, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import ListingCard from "@/components/ListingCard";
import ListingsMap from "@/components/ListingsMap";
import type { Listing } from "@shared/schema";
import { getSessionId, DEPARTMENTS, PROPERTY_TYPES } from "@/lib/utils";

export default function Browse() {
  const [location] = useLocation();
  const [, navigate] = useNav();
  const sessionId = getSessionId();

  // Parse URL params
  const parseParams = () => {
    const hash = window.location.hash;
    const qIndex = hash.indexOf("?");
    if (qIndex === -1) return new URLSearchParams();
    return new URLSearchParams(hash.slice(qIndex + 1));
  };

  const [search, setSearch] = useState(() => parseParams().get("search") ?? "");
  const [priceType, setPriceType] = useState(() => parseParams().get("priceType") ?? "all");
  const [propertyType, setPropertyType] = useState(() => parseParams().get("propertyType") ?? "all");
  const [department, setDepartment] = useState(() => parseParams().get("department") ?? "all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000000]);
  const [bedrooms, setBedrooms] = useState("0");
  const [showFilters, setShowFilters] = useState(false);
  const [inputSearch, setInputSearch] = useState(search);
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");

  // Re-parse on URL change
  useEffect(() => {
    const params = parseParams();
    setSearch(params.get("search") ?? "");
    setInputSearch(params.get("search") ?? "");
    setPriceType(params.get("priceType") ?? "all");
    setPropertyType(params.get("propertyType") ?? "all");
    setDepartment(params.get("department") ?? "all");
  }, [location]);

  const buildQueryParams = () => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (priceType !== "all") params.priceType = priceType;
    if (propertyType !== "all") params.propertyType = propertyType;
    if (department !== "all") params.department = department;
    if (priceRange[0] > 0) params.priceMin = String(priceRange[0]);
    if (priceRange[1] < 1000000) params.priceMax = String(priceRange[1]);
    if (bedrooms !== "0") params.bedrooms = bedrooms;
    return params;
  };

  const queryString = new URLSearchParams(buildQueryParams()).toString();

  const { data: listings, isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/listings", queryString],
    queryFn: async (): Promise<Listing[]> => {
      const res = await apiRequest("GET", `/api/listings?${queryString}`);
      return res.json() as Promise<Listing[]>;
    },
  });

  const { data: saved } = useQuery<Listing[]>({
    queryKey: ["/api/saved", sessionId],
    queryFn: (): Promise<Listing[]> => apiRequest("GET", `/api/saved/${sessionId}`).then(r => r.json() as Promise<Listing[]>),
  });
  const savedIds = (saved ?? []).map((l: Listing) => l.id);

  const handleSearch = () => setSearch(inputSearch);
  const clearFilters = () => {
    setSearch(""); setInputSearch(""); setPriceType("all");
    setPropertyType("all"); setDepartment("all");
    setPriceRange([0, 1000000]); setBedrooms("0");
  };
  const hasFilters = search || priceType !== "all" || propertyType !== "all" || department !== "all" || priceRange[0] > 0 || priceRange[1] < 1000000 || bedrooms !== "0";

  const handleMapListingClick = (id: number) => {
    navigate(`/listing/${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header + search */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par ville, quartier..."
            value={inputSearch}
            onChange={e => setInputSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="pl-9"
            data-testid="input-browse-search"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={priceType} onValueChange={setPriceType}>
            <SelectTrigger className="w-36" data-testid="select-browse-price-type">
              <SelectValue placeholder="Achat / Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="sale">À Vendre</SelectItem>
              <SelectItem value="rent">À Louer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={propertyType} onValueChange={setPropertyType}>
            <SelectTrigger className="w-36" data-testid="select-browse-property-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout type</SelectItem>
              {PROPERTY_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-40" data-testid="select-browse-department">
              <SelectValue placeholder="Département" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les dép.</SelectItem>
              {DEPARTMENTS.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-primary text-primary-foreground border-primary" : ""}
            data-testid="btn-toggle-filters"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Button>
          <Button onClick={handleSearch} className="bg-primary text-primary-foreground" data-testid="btn-browse-search">
            Chercher
          </Button>
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="bg-card border rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="advanced-filters">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Chambres minimum
            </label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
              <SelectTrigger data-testid="select-bedrooms">
                <SelectValue placeholder="Chambres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Tout</SelectItem>
                <SelectItem value="1">1+</SelectItem>
                <SelectItem value="2">2+</SelectItem>
                <SelectItem value="3">3+</SelectItem>
                <SelectItem value="4">4+</SelectItem>
                <SelectItem value="5">5+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Budget: ${priceRange[0].toLocaleString()} – ${priceRange[1] >= 1000000 ? "1M+" : priceRange[1].toLocaleString()}
            </label>
            <Slider
              min={0}
              max={1000000}
              step={10000}
              value={priceRange}
              onValueChange={(v) => setPriceRange(v as [number, number])}
              className="mt-2"
              data-testid="slider-price"
            />
          </div>
        </div>
      )}

      {/* Active filter badges */}
      {hasFilters && (
        <div className="flex gap-2 flex-wrap mb-4 items-center">
          <span className="text-xs text-muted-foreground">Filtres actifs:</span>
          {search && <Badge variant="secondary" className="gap-1">{search} <X className="w-3 h-3 cursor-pointer" onClick={() => { setSearch(""); setInputSearch(""); }} /></Badge>}
          {priceType !== "all" && <Badge variant="secondary" className="gap-1">{priceType === "sale" ? "À Vendre" : "À Louer"} <X className="w-3 h-3 cursor-pointer" onClick={() => setPriceType("all")} /></Badge>}
          {propertyType !== "all" && <Badge variant="secondary" className="gap-1">{PROPERTY_TYPES.find(t => t.value === propertyType)?.label} <X className="w-3 h-3 cursor-pointer" onClick={() => setPropertyType("all")} /></Badge>}
          {department !== "all" && <Badge variant="secondary" className="gap-1">{department} <X className="w-3 h-3 cursor-pointer" onClick={() => setDepartment("all")} /></Badge>}
          <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-2">Tout effacer</button>
        </div>
      )}

      {/* Results count + view toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground" data-testid="results-count">
          {isLoading ? "Chargement..." : `${listings?.length ?? 0} propriété${(listings?.length ?? 0) !== 1 ? "s" : ""} trouvée${(listings?.length ?? 0) !== 1 ? "s" : ""}`}
        </p>

        {/* Grid / Map toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1" data-testid="view-toggle">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            className={`gap-1.5 h-8 px-3 ${viewMode === "grid" ? "shadow-sm" : ""}`}
            onClick={() => setViewMode("grid")}
            data-testid="btn-view-grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Grille</span>
          </Button>
          <Button
            variant={viewMode === "map" ? "secondary" : "ghost"}
            size="sm"
            className={`gap-1.5 h-8 px-3 ${viewMode === "map" ? "shadow-sm" : ""}`}
            onClick={() => setViewMode("map")}
            data-testid="btn-view-map"
          >
            <Map className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Carte</span>
          </Button>
        </div>
      </div>

      {/* Content: Grid or Map */}
      {isLoading ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
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
          <Skeleton className="w-full rounded-xl" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }} />
        )
      ) : listings?.length === 0 ? (
        <div className="text-center py-20" data-testid="no-results">
          <div className="text-4xl mb-3">🏠</div>
          <p className="font-semibold mb-1">Aucune propriété trouvée</p>
          <p className="text-sm text-muted-foreground mb-4">Essayez d'élargir votre recherche ou modifier les filtres.</p>
          <Button variant="outline" onClick={clearFilters}>Réinitialiser les filtres</Button>
        </div>
      ) : viewMode === "map" ? (
        <ListingsMap
          listings={listings ?? []}
          onListingClick={handleMapListingClick}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {listings?.map(listing => (
            <ListingCard key={listing.id} listing={listing} savedIds={savedIds} />
          ))}
        </div>
      )}
    </div>
  );
}
