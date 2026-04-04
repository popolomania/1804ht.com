import { Link } from "wouter";
import { Heart, Bed, Bath, Ruler, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Listing } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getSessionId, formatPrice, getPropertyTypeLabel, getDepartmentClass } from "@/lib/utils";

interface Props {
  listing: Listing;
  savedIds?: number[];
}

export default function ListingCard({ listing, savedIds = [] }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const sessionId = getSessionId();
  const isSaved = savedIds.includes(listing.id);
  const images: string[] = JSON.parse(listing.images || "[]");
  const mainImage = images[0] || "https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?w=600&q=75";

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await apiRequest("POST", "/api/saved", { listingId: listing.id, sessionId });
    qc.invalidateQueries({ queryKey: ["/api/saved", sessionId] });
    toast({ description: isSaved ? "Retiré des favoris" : "Ajouté aux favoris" });
  };

  return (
    <Link href={`/listing/${listing.id}`} data-testid={`card-listing-${listing.id}`}>
      <div className="listing-card rounded-lg overflow-hidden border bg-card cursor-pointer h-full flex flex-col">
        {/* Image */}
        <div className="relative overflow-hidden">
          <img
            src={mainImage}
            alt={listing.title}
            className="property-image"
            loading="lazy"
          />
          {/* Overlays */}
          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
            <Badge
              className={`text-xs font-semibold ${listing.priceType === "rent" ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"}`}
              data-testid={`badge-type-${listing.id}`}
            >
              {listing.priceType === "rent" ? "À Louer" : "À Vendre"}
            </Badge>
            {listing.featured && (
              <Badge className="text-xs bg-yellow-400 text-yellow-900 font-semibold">
                Coup de coeur
              </Badge>
            )}
          </div>
          {/* Favorite button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSave}
            className="absolute top-2 right-2 bg-white/80 hover:bg-white dark:bg-black/60 dark:hover:bg-black/80 rounded-full w-8 h-8 backdrop-blur-sm"
            data-testid={`btn-save-${listing.id}`}
          >
            <Heart
              className={`w-4 h-4 ${isSaved ? "fill-red-500 text-red-500" : "text-gray-600"}`}
            />
          </Button>
          {/* Price */}
          <div className="absolute bottom-2 left-2">
            <div className="price-badge text-white text-sm font-bold px-2 py-1 rounded-md" data-testid={`price-${listing.id}`}>
              {formatPrice(listing.price, listing.priceType)}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col flex-1 gap-2">
          <h3 className="font-semibold text-sm leading-snug line-clamp-2" data-testid={`title-${listing.id}`}>
            {listing.title}
          </h3>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{listing.city}, {listing.department}</span>
          </div>

          {/* Stats */}
          {(listing.bedrooms || listing.bathrooms || listing.areaSqm) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2 mt-auto">
              {listing.bedrooms && (
                <span className="flex items-center gap-1">
                  <Bed className="w-3 h-3" />
                  {listing.bedrooms} ch.
                </span>
              )}
              {listing.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="w-3 h-3" />
                  {listing.bathrooms} sdb.
                </span>
              )}
              {listing.areaSqm && (
                <span className="flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  {listing.areaSqm >= 10000 ? `${(listing.areaSqm / 10000).toFixed(1)} ha` : `${listing.areaSqm}m²`}
                </span>
              )}
              <span className={`ml-auto px-1.5 py-0.5 rounded text-xs font-medium ${getDepartmentClass(listing.department)}`}>
                {getPropertyTypeLabel(listing.propertyType)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
