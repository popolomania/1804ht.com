/**
 * UpgradeModal — lets a registered Visiteur request Agent / Propriétaire status
 * without creating a new account.
 *
 * States:
 *   default   — form with reason textarea + optional phone
 *   submitted — request already pending (read-only confirmation)
 *   loading   — sending
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle, Clock } from "lucide-react";

const schema = z.object({
  reason: z
    .string()
    .min(10, "Expliquez pourquoi vous souhaitez devenir agent (10 caractères min.)")
    .max(500, "500 caractères maximum"),
  phone: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  const { user, requestUpgrade } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const alreadyRequested = !!user?.upgradeRequestedAt;

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: user?.phone ?? "" },
  });

  const onSubmit = async (values: FormData) => {
    try {
      setBusy(true);
      await requestUpgrade(values.reason, values.phone || undefined);
      setDone(true);
      toast({
        title: "Demande envoyée",
        description: "Un administrateur examinera votre demande et vous contactera par email.",
      });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-primary" />
            <DialogTitle>Passer en mode Agent</DialogTitle>
          </div>
          <DialogDescription>
            Devenez Agent / Propriétaire pour publier des annonces immobilières sur 1804ht.com.
          </DialogDescription>
        </DialogHeader>

        {/* Already requested state */}
        {(alreadyRequested && !done) ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Clock className="w-10 h-10 text-amber-500" />
            <p className="font-semibold">Demande en cours d'examen</p>
            <p className="text-sm text-muted-foreground">
              Votre demande a déjà été soumise. Un administrateur va l'examiner
              et vous enverra un email dès qu'une décision est prise.
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-2">
              Fermer
            </Button>
          </div>
        ) : done ? (
          /* Success state */
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="font-semibold">Demande envoyée !</p>
            <p className="text-sm text-muted-foreground">
              Un administrateur examinera votre profil et vous enverra un email
              de confirmation avec un lien de vérification.
            </p>
            <Button onClick={handleClose} className="mt-2">
              Fermer
            </Button>
          </div>
        ) : (
          /* Form state */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
            {/* What you get */}
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm space-y-1">
              <p className="font-semibold text-primary">En tant qu'Agent vous pouvez :</p>
              <ul className="text-muted-foreground space-y-0.5 list-none">
                <li>✓ Publier des annonces (vente & location)</li>
                <li>✓ Gérer et modifier vos propres listings</li>
                <li>✓ Afficher vos coordonnées sur les annonces</li>
              </ul>
            </div>

            <div className="space-y-1">
              <Label>
                Pourquoi souhaitez-vous devenir agent ?
                <span className="text-muted-foreground ml-1 text-xs">(obligatoire)</span>
              </Label>
              <textarea
                rows={3}
                placeholder="Ex : Je suis agent immobilier indépendant à Cap-Haïtien et je souhaite publier mes propriétés en vente…"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                {...register("reason")}
              />
              {errors.reason && (
                <p className="text-xs text-destructive">{errors.reason.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>
                Téléphone
                <span className="text-muted-foreground ml-1 text-xs">(optionnel)</span>
              </Label>
              <Input
                type="tel"
                placeholder="+509 3xxx-xxxx"
                {...register("phone")}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Envoi…" : "Soumettre la demande"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
