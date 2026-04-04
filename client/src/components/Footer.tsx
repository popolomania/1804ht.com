import { Link } from "wouter";
import Logo from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="border-t bg-card mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              La plateforme immobilière de référence en Haïti. Achetez, louez ou vendez votre propriété dans tout le pays.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Explorer</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/browse" className="hover:text-foreground transition-colors">Toutes les annonces</Link></li>
              <li><Link href="/browse?priceType=sale" className="hover:text-foreground transition-colors">Propriétés à vendre</Link></li>
              <li><Link href="/browse?priceType=rent" className="hover:text-foreground transition-colors">Propriétés à louer</Link></li>
              <li><Link href="/saved" className="hover:text-foreground transition-colors">Mes favoris</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Régions</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/browse?department=Ouest" className="hover:text-foreground transition-colors">Ouest (Port-au-Prince)</Link></li>
              <li><Link href="/browse?department=Nord" className="hover:text-foreground transition-colors">Nord (Cap-Haïtien)</Link></li>
              <li><Link href="/browse?department=Artibonite" className="hover:text-foreground transition-colors">Artibonite</Link></li>
              <li><Link href="/browse?department=Sud-Est" className="hover:text-foreground transition-colors">Sud-Est (Jacmel)</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t flex flex-wrap gap-4 justify-between items-center text-xs text-muted-foreground">
          <span>© 2026 Kaye Ayiti. Tous droits réservés.</span>
          <div className="flex gap-4">
            <span>Haïti 🇭🇹</span>
            <span>Français | Kreyòl</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
