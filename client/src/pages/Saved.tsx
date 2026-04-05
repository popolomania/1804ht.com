import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Heart, Frown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ListingCard from "@/components/ListingCard";
import type { Listing } from "@shared/schema";
import { getSessionId } from "@/lib/utils";
import { useLocation } from "wouter";

export default function Saved() {
  const sessionId = getSessionId();
  const [, setLocation] = useLocation();

  const { data: saved, isLoading } = useQuery<Listing[]>({
    queryKey: ["/api/saved", sessionId],
    queryFn: async (): Promise<Listing[]> => {
      return apiRequest("GET", `/api/saved/${sessionId}`).then(r => r.json() as Promise<Listing[]>);
    },
  });

  const savedIds = (saved ?? []).map((l: Listing) => l.id);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Heart className="w-5 h-5 text-red-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Mes favoris</h1>
          <p className="text-sm text-muted-foreground">Propriétés que vous avez sauvegardées</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-lg overflow-hidden border">
              <Skeleton className="h-48 w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : saved?.length === 0 ? (
        <div className="text-center py-24" data-testid="saved-empty">
          <Frown className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="font-semibold mb-2">Aucun favori pour l'instant</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
            Cliquez sur le cœur sur n'importe quelle annonce pour la sauvegarder ici.
          </p>
          <Button onClick={() => setLocation("/browse")} className="bg-primary text-primary-foreground">
            Parcourir les annonces
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-6" data-testid="saved-count">
            {saved?.length} propriété{(saved?.length ?? 0) > 1 ? "s" : ""} sauvegardée{(saved?.length ?? 0) > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {saved?.map(listing => (
              <ListingCard key={listing.id} listing={listing} savedIds={savedIds} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
