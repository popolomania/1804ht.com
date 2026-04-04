import { Link, useLocation } from "wouter";
import { Heart, Moon, Sun, Menu, X, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { useState } from "react";
import Logo from "@/components/Logo";

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { href: "/", label: "Accueil" },
    { href: "/browse", label: "Annonces" },
    { href: "/saved", label: "Favoris" },
    { href: "/list-property", label: "Publier" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}>
              <Button
                variant={location === l.href ? "secondary" : "ghost"}
                size="sm"
                className="text-sm font-medium"
                data-testid={`nav-${l.label.toLowerCase()}`}
              >
                {l.label === "Favoris" && <Heart className="w-4 h-4 mr-1" />}
                {l.label}
              </Button>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={`Passer en mode ${theme === "dark" ? "clair" : "sombre"}`}
            data-testid="theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <Link href="/list-property" className="hidden md:block">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              + Publier une annonce
            </Button>
          </Link>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            data-testid="mobile-menu-toggle"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t bg-background px-4 py-3 flex flex-col gap-1" data-testid="mobile-menu">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
              <Button variant={location === l.href ? "secondary" : "ghost"} className="w-full justify-start text-sm">
                {l.label}
              </Button>
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
