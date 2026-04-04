import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl mb-4">🏚️</div>
      <h1 className="text-xl font-bold mb-2">Page introuvable</h1>
      <p className="text-muted-foreground text-sm mb-6">Cette page n'existe pas ou a été déplacée.</p>
      <Button onClick={() => setLocation("/")} className="bg-primary text-primary-foreground">
        Retour à l'accueil
      </Button>
    </div>
  );
}
