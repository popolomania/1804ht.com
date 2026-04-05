import { Link, useLocation } from "wouter";
import { Heart, Moon, Sun, Menu, X, LogOut, User, Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { useState } from "react";
import Logo from "@/components/Logo";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export default function Navbar() {
  const { theme, toggle } = useTheme();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: "login" | "register" }>({
    open: false,
    mode: "login",
  });
  const { user, logout, loading } = useAuth();
  const { toast } = useToast();

  const openLogin = () => setAuthModal({ open: true, mode: "login" });
  const openRegister = () => setAuthModal({ open: true, mode: "register" });
  const closeModal = () => setAuthModal((s) => ({ ...s, open: false }));

  const handleLogout = async () => {
    await logout();
    toast({ title: "Déconnecté" });
  };

  const links = [
    { href: "/", label: "Accueil" },
    { href: "/browse", label: "Annonces" },
    { href: "/saved", label: "Favoris" },
  ];

  // "Publier" is only shown to verified agents
  const canPublish = user?.role === "agent" && user.emailVerified;

  return (
    <>
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm" data-testid="navbar">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo />
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((l) => (
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
            {canPublish && (
              <Link href="/list-property">
                <Button
                  variant={location === "/list-property" ? "secondary" : "ghost"}
                  size="sm"
                  className="text-sm font-medium"
                >
                  <Building2 className="w-4 h-4 mr-1" />
                  Publier
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={`Passer en mode ${theme === "dark" ? "clair" : "sombre"}`}
              data-testid="theme-toggle"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            {/* Auth area */}
            {!loading && (
              <>
                {user ? (
                  /* ── Logged-in user dropdown ── */
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="flex items-center gap-2 max-w-[160px]">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                          {user.name[0].toUpperCase()}
                        </span>
                        <span className="hidden md:block truncate text-sm">{user.name}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel className="pb-1">
                        <p className="font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground font-normal truncate">{user.email}</p>
                        <span
                          className={`inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            user.role === "agent" && user.emailVerified
                              ? "bg-primary/15 text-primary"
                              : user.role === "agent" && !user.emailVerified
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {user.role === "agent" && !user.emailVerified
                            ? "⚠ Email non vérifié"
                            : user.role === "agent"
                            ? "Agent / Propriétaire"
                            : "Visiteur"}
                        </span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {user.role === "agent" && (
                        <Link href="/list-property">
                          <DropdownMenuItem>
                            <Building2 className="w-4 h-4 mr-2" />
                            Mes annonces
                          </DropdownMenuItem>
                        </Link>
                      )}
                      <Link href="/saved">
                        <DropdownMenuItem>
                          <Heart className="w-4 h-4 mr-2" />
                          Mes favoris
                        </DropdownMenuItem>
                      </Link>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={handleLogout}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Se déconnecter
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  /* ── Guest buttons ── */
                  <div className="hidden md:flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={openLogin}>
                      Connexion
                    </Button>
                    <Button size="sm" onClick={openRegister}>
                      S'inscrire
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Agent publish CTA — desktop */}
            {canPublish && (
              <Link href="/list-property" className="hidden md:block">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  + Publier une annonce
                </Button>
              </Link>
            )}

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
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
                <Button variant={location === l.href ? "secondary" : "ghost"} className="w-full justify-start text-sm">
                  {l.label === "Favoris" && <Heart className="w-4 h-4 mr-2" />}
                  {l.label}
                </Button>
              </Link>
            ))}
            {canPublish && (
              <Link href="/list-property" onClick={() => setMenuOpen(false)}>
                <Button variant={location === "/list-property" ? "secondary" : "ghost"} className="w-full justify-start text-sm">
                  <Building2 className="w-4 h-4 mr-2" />
                  Publier
                </Button>
              </Link>
            )}

            <div className="border-t pt-2 mt-1 flex flex-col gap-1">
              {user ? (
                <>
                  <div className="px-2 py-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.role === "agent" ? "Agent / Propriétaire" : "Visiteur"}</p>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-sm text-destructive hover:text-destructive"
                    onClick={() => { setMenuOpen(false); handleLogout(); }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Se déconnecter
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" className="w-full justify-start text-sm" onClick={() => { setMenuOpen(false); openLogin(); }}>
                    <User className="w-4 h-4 mr-2" />
                    Connexion
                  </Button>
                  <Button className="w-full justify-start text-sm" onClick={() => { setMenuOpen(false); openRegister(); }}>
                    S'inscrire
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      <AuthModal open={authModal.open} onClose={closeModal} initialMode={authModal.mode} />
    </>
  );
}
