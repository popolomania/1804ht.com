import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Plus, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DEPARTMENTS, PROPERTY_TYPES } from "@/lib/utils";
import { useState } from "react";

const formSchema = z.object({
  title: z.string().min(10, "Titre trop court (min. 10 caractères)"),
  description: z.string().min(30, "Description trop courte (min. 30 caractères)"),
  price: z.coerce.number().min(1, "Prix requis"),
  priceType: z.enum(["sale", "rent"]),
  address: z.string().min(5, "Adresse requise"),
  city: z.string().min(2, "Ville requise"),
  department: z.string().min(1, "Département requis"),
  propertyType: z.enum(["house", "apartment", "villa", "land", "commercial"]),
  bedrooms: z.coerce.number().optional(),
  bathrooms: z.coerce.number().optional(),
  areaSqm: z.coerce.number().optional(),
  contactName: z.string().min(2, "Nom requis"),
  contactPhone: z.string().min(8, "Téléphone requis"),
  contactEmail: z.string().email("Email invalide").optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

export default function ListProperty() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priceType: "sale",
      propertyType: "house",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      title: "",
      description: "",
      address: "",
      city: "",
      department: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        images: JSON.stringify(["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80"]),
        amenities: JSON.stringify([]),
        status: "active",
        featured: false,
        contactEmail: data.contactEmail || null,
      };
      const res = await apiRequest("POST", "/api/listings", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/listings"] });
      setSubmitted(true);
    },
    onError: () => {
      toast({ variant: "destructive", description: "Erreur lors de la publication. Veuillez réessayer." });
    },
  });

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-testid="submission-success">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h1 className="text-xl font-bold mb-2">Annonce publiée avec succès !</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Votre propriété est maintenant visible sur Kaye Ayiti. Les acheteurs et locataires intéressés vous contacteront directement.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => { setSubmitted(false); form.reset(); }}>
            Publier une autre annonce
          </Button>
          <Button className="bg-primary text-primary-foreground" onClick={() => setLocation("/browse")}>
            Voir les annonces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Publier une annonce</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Remplissez ce formulaire pour mettre votre propriété en ligne gratuitement.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-6">
          {/* Section: Propriété */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Informations sur la propriété</h2>

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Titre de l'annonce</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Villa moderne avec piscine à Pétion-Ville" {...field} data-testid="input-title" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="priceType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type d'annonce</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-form-price-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="sale">À Vendre</SelectItem>
                      <SelectItem value="rent">À Louer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="propertyType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type de propriété</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-form-property-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROPERTY_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Décrivez votre propriété: emplacement, état, caractéristiques, environnement..."
                    rows={5}
                    {...field}
                    data-testid="input-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>

          {/* Section: Prix et surface */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Prix et dimensions</h2>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix (USD)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 150000" {...field} data-testid="input-price" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="areaSqm" render={({ field }) => (
                <FormItem>
                  <FormLabel>Surface (m²)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 200" {...field} data-testid="input-area" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bedrooms" render={({ field }) => (
                <FormItem>
                  <FormLabel>Chambres</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 3" {...field} data-testid="input-bedrooms" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bathrooms" render={({ field }) => (
                <FormItem>
                  <FormLabel>Salles de bain</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Ex: 2" {...field} data-testid="input-bathrooms" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Section: Localisation */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Localisation</h2>

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Adresse</FormLabel>
                <FormControl>
                  <Input placeholder="Rue, quartier..." {...field} data-testid="input-address" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ville</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Pétion-Ville" {...field} data-testid="input-city" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="department" render={({ field }) => (
                <FormItem>
                  <FormLabel>Département</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger data-testid="select-form-department">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          {/* Section: Contact */}
          <div className="bg-card border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Vos coordonnées</h2>

            <FormField control={form.control} name="contactName" render={({ field }) => (
              <FormItem>
                <FormLabel>Nom ou raison sociale</FormLabel>
                <FormControl>
                  <Input placeholder="Votre nom complet ou nom d'agence" {...field} data-testid="input-contact-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contactPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="+509 3XXX-XXXX" {...field} data-testid="input-contact-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contactEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="votre@email.com" {...field} data-testid="input-contact-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary text-primary-foreground h-12 text-base font-semibold"
            disabled={mutation.isPending}
            data-testid="btn-submit-listing"
          >
            {mutation.isPending ? "Publication en cours..." : "Publier gratuitement"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
