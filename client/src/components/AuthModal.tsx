import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Home, Building2 } from "lucide-react";

// ── Schemas ───────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Au moins 6 caractères"),
  phone: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────
interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

export default function AuthModal({ open, onClose, initialMode = "login" }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [role, setRole] = useState<UserRole>("guest");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  // ── Login form ──────────────────────────────────────────────────────────────
  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const handleLogin = async (values: LoginForm) => {
    try {
      setBusy(true);
      await login(values.email, values.password);
      toast({ title: "Bienvenue !" });
      onClose();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (values: RegisterForm) => {
    try {
      setBusy(true);
      await register({ ...values, role });
      toast({
        title: "Compte créé !",
        description:
          role === "agent"
            ? "Vous pouvez maintenant publier des annonces."
            : "Bienvenue sur 1804ht.com",
      });
      onClose();
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    loginForm.reset();
    registerForm.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex rounded-lg border overflow-hidden mb-2">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {m === "login" ? "Se connecter" : "S'inscrire"}
            </button>
          ))}
        </div>

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="votre@email.com"
                {...loginForm.register("email")}
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Mot de passe</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  {...loginForm.register("password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {loginForm.formState.errors.password && (
                <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Connexion…" : "Se connecter"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-primary hover:underline font-medium"
              >
                S'inscrire
              </button>
            </p>
          </form>
        )}

        {/* ── REGISTER ── */}
        {mode === "register" && (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
            {/* Role selector */}
            <div className="space-y-2">
              <Label>Je suis…</Label>
              <div className="grid grid-cols-2 gap-3">
                <RoleCard
                  active={role === "guest"}
                  icon={<Home className="w-5 h-5" />}
                  title="Visiteur"
                  desc="Je cherche un bien à louer ou acheter"
                  onClick={() => setRole("guest")}
                />
                <RoleCard
                  active={role === "agent"}
                  icon={<Building2 className="w-5 h-5" />}
                  title="Agent / Propriétaire"
                  desc="Je veux publier des annonces"
                  onClick={() => setRole("agent")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Nom complet</Label>
              <Input placeholder="Jean Pierre" {...registerForm.register("name")} />
              {registerForm.formState.errors.name && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" placeholder="votre@email.com" {...registerForm.register("email")} />
              {registerForm.formState.errors.email && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
              )}
            </div>

            {role === "agent" && (
              <div className="space-y-1">
                <Label>Téléphone <span className="text-muted-foreground text-xs">(optionnel)</span></Label>
                <Input type="tel" placeholder="+509 3xxx-xxxx" {...registerForm.register("phone")} />
              </div>
            )}

            <div className="space-y-1">
              <Label>Mot de passe</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  {...registerForm.register("password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {registerForm.formState.errors.password && (
                <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Création…" : "Créer mon compte"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Déjà inscrit ?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-primary hover:underline font-medium"
              >
                Se connecter
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Role card sub-component ───────────────────────────────────────────────────
function RoleCard({
  active,
  icon,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 p-3 text-left transition-all ${
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted"
      }`}
    >
      <div className={`mb-1 ${active ? "text-primary" : "text-muted-foreground"}`}>{icon}</div>
      <p className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>{title}</p>
      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{desc}</p>
    </button>
  );
}
