import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart, Bed, Bath, Ruler, MapPin, Phone, Mail, ChevronLeft,
  Share2, CheckCircle2, Home, Building2, TreePine, Store, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import type { Listing } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { getSessionId, formatPrice, getPropertyTypeLabel, getDepartmentClass } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const typeIcons: Record<string, any> = {
  house: Home, apartment: Building2, villa: Crown,
  land: TreePine, commercial: Store
};

export default function ListingDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const sessionId = getSessionId();
  const [activeImage, setActiveImage] = useState(0);
  const [showPhone, setShowPhone] = useState(false);

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: ["/api/listings", params.id],
    queryFn: async (): Promise<Listing> => {
      const res = await apiRequest("GET", `/api/listings/${params.id}`);
      return res.json() as Promise<Listing>;
    },
  });

  const { data: savedStatus } = useQuery<{ saved: boolean }>({
    queryKey: ["/api/saved", sessionId, params.id, "status"],
    queryFn: async (): Promise<{ saved: boolean }> => {
      const res = await apiRequest("GET", `/api/saved/${sessionId}/${params.id}/status`);
      return res.json() as Promise<{ saved: boolean }>;
    },
  });

  const toggleSave = useMutation({
    mutationFn: () => apiRequest("POST", "/api/saved", { listingId: Number(params.id), sessionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/saved", sessionId, params.id, "status"] });
      qc.invalidateQueries({ queryKey: ["/api/saved", sessionId] });
      toast({ description: savedStatus?.saved ? "Retiré des favoris" : "Ajouté aux favoris" });
    },
  });

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ description: "Lien copié dans le presse-papier" });
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Skeleton className="h-72 w-full rounded-xl mb-6" />
        <Skeleton className="h-8 w-2/3 mb-3" />
        <Skeleton className="h-4 w-1/3 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <p className="text-lg font-semibold mb-2">Annonce introuvable</p>
        <Button variant="outline" onClick={() => setLocation("/browse")}>Retour aux annonces</Button>
      </div>
    );
  }

  const images: string[] = JSON.parse(listing.images || "[]");
  const amenities: string[] = JSON.parse(listing.amenities || "[]");
  const TypeIcon = typeIcons[listing.propertyType] ?? Home;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => setLocation("/browse")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        data-testid="btn-back"
      >
        <ChevronLeft className="w-4 h-4" /> Retour aux annonces
      </button>

      {/* Image gallery */}
      <div className="grid grid-cols-1 gap-2 mb-6">
        <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "16/7" }}>
          <img
            src={images[activeImage] ?? "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=1200&q=80"}
            alt={listing.title}
            className="w-full h-full object-cover"
            data-testid="main-image"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleSave.mutate()}
              className="bg-white/80 hover:bg-white dark:bg-black/60 rounded-full backdrop-blur-sm"
              data-testid="btn-save-detail"
            >
              <Heart className={`w-5 h-5 ${savedStatus?.saved ? "fill-red-500 text-red-500" : "text-gray-600"}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="bg-white/80 hover:bg-white dark:bg-black/60 rounded-full backdrop-blur-sm"
              data-testid="btn-share"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </Button>
          </div>
          {listing.featured && (
            <Badge className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 font-semibold">
              Coup de coeur
            </Badge>
          )}
        </div>
        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === activeImage ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
                data-testid={`thumb-${i}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: details */}
        <div className="md:col-span-2 space-y-6">
          {/* Title & badge */}
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className={listing.priceType === "rent" ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"}>
                {listing.priceType === "rent" ? "À Louer" : "À Vendre"}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <TypeIcon className="w-3 h-3" /> {getPropertyTypeLabel(listing.propertyType)}
              </Badge>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDepartmentClass(listing.department)}`}>
                {listing.department}
              </span>
            </div>
            <h1 className="text-xl font-bold leading-snug mb-1" data-testid="listing-title">
              {listing.title}
            </h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{listing.address}, {listing.city}, Haïti</span>
            </div>
          </div>

          {/* Price */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4" data-testid="price-section">
            <span className="text-2xl font-bold text-primary">{formatPrice(listing.price, listing.priceType)}</span>
            {listing.priceType === "rent" && <span className="text-sm text-muted-foreground ml-2">par mois</span>}
          </div>

          {/* Stats */}
          {(listing.bedrooms || listing.bathrooms || listing.areaSqm) && (
            <div className="grid grid-cols-3 gap-4">
              {listing.bedrooms && (
                <div className="text-center p-3 bg-card border rounded-lg" data-testid="stat-bedrooms">
                  <Bed className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="font-bold">{listing.bedrooms}</div>
                  <div className="text-xs text-muted-foreground">Chambres</div>
                </div>
              )}
              {listing.bathrooms && (
                <div className="text-center p-3 bg-card border rounded-lg" data-testid="stat-bathrooms">
                  <Bath className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="font-bold">{listing.bathrooms}</div>
                  <div className="text-xs text-muted-foreground">Salles de bain</div>
                </div>
              )}
              {listing.areaSqm && (
                <div className="text-center p-3 bg-card border rounded-lg" data-testid="stat-area">
                  <Ruler className="w-5 h-5 mx-auto mb-1 text-primary" />
                  <div className="font-bold">
                    {listing.areaSqm >= 10000
                      ? `${(listing.areaSqm / 10000).toFixed(1)} ha`
                      : `${listing.areaSqm} m²`}
                  </div>
                  <div className="text-xs text-muted-foreground">Surface</div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Description */}
          <div>
            <h2 className="font-semibold mb-3">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed" data-testid="listing-description">
              {listing.description}
            </p>
          </div>

          {/* Amenities */}
          {amenities.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3">Équipements et caractéristiques</h2>
              <div className="grid grid-cols-2 gap-2">
                {amenities.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm" data-testid={`amenity-${i}`}>
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Map placeholder */}
          <div>
            <h2 className="font-semibold mb-3">Localisation</h2>
            <div className="map-container rounded-xl h-48 flex items-center justify-center border">
              <div className="text-center text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{listing.city}, {listing.department}</p>
                <p className="text-xs">{listing.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: contact card */}
        <div>
          <div className="sticky top-20">
            <div className="bg-card border rounded-xl p-5 space-y-4" data-testid="contact-card">
              <div>
                <h3 className="font-semibold mb-1">Contacter l'annonceur</h3>
                <p className="text-sm text-muted-foreground">{listing.contactName}</p>
              </div>
              <Separator />
              <div className="space-y-3">
                <Button
                  className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowPhone(true)}
                  data-testid="btn-show-phone"
                >
                  <Phone className="w-4 h-4" />
                  {showPhone ? listing.contactPhone : "Afficher le numéro"}
                </Button>
                {listing.contactEmail && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => window.location.href = `mailto:${listing.contactEmail}?subject=Intérêt pour: ${listing.title}`}
                    data-testid="btn-email"
                  >
                    <Mail className="w-4 h-4" />
                    Envoyer un email
                  </Button>
                )}
                <Button
                  variant={savedStatus?.saved ? "secondary" : "outline"}
                  className="w-full gap-2"
                  onClick={() => toggleSave.mutate()}
                  data-testid="btn-save-card"
                >
                  <Heart className={`w-4 h-4 ${savedStatus?.saved ? "fill-current" : ""}`} />
                  {savedStatus?.saved ? "Retiré des favoris" : "Sauvegarder"}
                </Button>
              </div>

              {/* Quick facts */}
              <div className="bg-muted/40 rounded-lg p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Référence</span>
                  <span className="font-medium">KA-{String(listing.id).padStart(5, "0")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge variant="outline" className="text-xs py-0">Disponible</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Département</span>
                  <span className="font-medium">{listing.department}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
