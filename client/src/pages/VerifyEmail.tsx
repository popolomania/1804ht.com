/**
 * /#/verify — landing page for email verification link clicks.
 *
 * The server redirects to:
 *   /#/verify?success=1          → verified OK
 *   /#/verify?error=invalid      → bad/missing token
 *   /#/verify?error=expired      → token older than 24 h
 *   /#/verify?error=already      → already verified
 *   /#/verify?error=server       → unexpected server error
 */
import { useEffect } from "react";
import { Link } from "wouter";
import { CheckCircle, XCircle, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmail() {
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const success = params.get("success") === "1";
  const error = params.get("error");
  const { markVerified } = useAuth();

  // If success, update client auth state immediately
  useEffect(() => {
    if (success) markVerified();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  if (success) {
    return (
      <StatusCard
        icon={<CheckCircle className="w-12 h-12 text-green-500" />}
        title="Email vérifié !"
        body="Votre adresse email a été confirmée avec succès. Vous pouvez maintenant publier des annonces sur 1804ht.com."
        action={
          <Link href="/list-property">
            <Button className="mt-4">Publier une annonce →</Button>
          </Link>
        }
      />
    );
  }

  if (error === "already") {
    return (
      <StatusCard
        icon={<CheckCircle className="w-12 h-12 text-teal-500" />}
        title="Déjà vérifié"
        body="Votre adresse email est déjà confirmée. Vous pouvez accéder à toutes les fonctionnalités d'agent."
        action={
          <Link href="/">
            <Button variant="outline" className="mt-4">Retour à l'accueil</Button>
          </Link>
        }
      />
    );
  }

  if (error === "expired") {
    return (
      <StatusCard
        icon={<Clock className="w-12 h-12 text-amber-500" />}
        title="Lien expiré"
        body="Ce lien de vérification a expiré (valide 24 heures). Connectez-vous et utilisez le bandeau jaune pour recevoir un nouveau lien."
        action={
          <Link href="/">
            <Button variant="outline" className="mt-4">Retour à l'accueil</Button>
          </Link>
        }
      />
    );
  }

  // invalid | server | unknown
  return (
    <StatusCard
      icon={<XCircle className="w-12 h-12 text-destructive" />}
      title="Lien invalide"
      body="Ce lien de vérification est invalide ou a déjà été utilisé. Si vous avez besoin d'un nouveau lien, connectez-vous et cliquez sur « Renvoyer l'email » dans le bandeau de confirmation."
      action={
        <Link href="/">
          <Button variant="outline" className="mt-4">Retour à l'accueil</Button>
        </Link>
      }
    />
  );
}

// ── Shared card layout ────────────────────────────────────────────────────────
function StatusCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-2xl font-bold mb-3">{title}</h1>
        <p className="text-muted-foreground leading-relaxed">{body}</p>
        {action}
      </div>
    </div>
  );
}
