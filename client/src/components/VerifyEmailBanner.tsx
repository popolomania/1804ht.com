import { useState } from "react";
import { MailCheck, X, RefreshCw, CheckCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/**
 * Sticky top banner shown to logged-in agents who haven't verified their email.
 * Dismissable per-session (but reappears on next load until verified).
 */
export default function VerifyEmailBanner() {
  const { user, resendVerification } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Only show for unverified agents
  if (!user || user.role !== "agent" || user.emailVerified || dismissed) return null;

  const handleResend = async () => {
    try {
      setSending(true);
      await resendVerification();
      setSent(true);
      toast({
        title: "Email envoyé",
        description: `Un nouveau lien de vérification a été envoyé à ${user.email}`,
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
        {/* Icon */}
        <span className="shrink-0 text-amber-500">
          <MailCheck className="w-4 h-4" />
        </span>

        {/* Message */}
        <p className="text-sm text-amber-800 dark:text-amber-200 flex-1 min-w-0">
          <span className="font-semibold">Vérifiez votre email</span>
          {" — "}
          Un lien de confirmation a été envoyé à{" "}
          <span className="font-mono font-medium">{user.email}</span>.
          Vous devez confirmer votre adresse avant de publier des annonces.
        </p>

        {/* Resend button */}
        {!sent ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={sending}
            className="shrink-0 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 h-7 text-xs"
          >
            {sending ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            {sending ? "Envoi…" : "Renvoyer l'email"}
          </Button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium shrink-0">
            <CheckCircle className="w-3.5 h-3.5" />
            Email envoyé
          </span>
        )}

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-400 hover:text-amber-600 dark:text-amber-600 dark:hover:text-amber-400 transition-colors"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
