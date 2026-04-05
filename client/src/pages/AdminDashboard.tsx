import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Building2, CheckCircle, XCircle, Clock, ShieldAlert,
  Search, RefreshCw, Trash2, Eye, ChevronDown, ChevronUp,
  MailCheck, AlertTriangle, Home, Ban, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  emailVerified: boolean;
  accountStatus: string;
  adminNotes: string | null;
  createdAt: string | null;
  reviewedAt: string | null;
}

interface AdminListing {
  id: number;
  title: string;
  city: string;
  department: string;
  priceType: string;
  price: number;
  propertyType: string;
  status: string;
  contactName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerStatus: string | null;
}

interface Stats {
  users: { total: number; guests: number; agents: number; admins: number };
  agents: { pending: number; approved: number; suspended: number; unverifiedEmail: number };
  listings: { total: number; active: number; pending: number; sold: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  switch (status) {
    case "approved":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Approuvé</Badge>;
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">En attente</Badge>;
    case "suspended":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Suspendu</Badge>;
    case "active":
      return <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-0">Active</Badge>;
    case "sold":
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">Vendu/Loué</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-HT", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPrice(p: number, type: string) {
  return `$${p.toLocaleString()}${type === "rent" ? "/mois" : ""}`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [agentSearch, setAgentSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState("all");
  const [listingSearch, setListingSearch] = useState("");
  const [listingFilter, setListingFilter] = useState("all");
  const [expandedAgent, setExpandedAgent] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ [id: number]: string }>({});

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async (): Promise<Stats> => {
      const r = await apiRequest("GET", "/api/admin/stats");
      return r.json() as Promise<Stats>;
    },
    refetchInterval: 30_000,
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/agents", agentFilter, agentSearch],
    queryFn: async (): Promise<AdminUser[]> => {
      const params = new URLSearchParams({ status: agentFilter, q: agentSearch });
      const r = await apiRequest("GET", `/api/admin/agents?${params}`);
      return r.json() as Promise<AdminUser[]>;
    },
  });

  const { data: adminListings = [], isLoading: listingsLoading } = useQuery<AdminListing[]>({
    queryKey: ["/api/admin/listings", listingFilter, listingSearch],
    queryFn: async (): Promise<AdminListing[]> => {
      const params = new URLSearchParams({ status: listingFilter, q: listingSearch });
      const r = await apiRequest("GET", `/api/admin/listings?${params}`);
      return r.json() as Promise<AdminListing[]>;
    },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await apiRequest("PATCH", `/api/admin/users/${id}/status`, { status });
      return r.json();
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      const label = status === "approved" ? "approuvé" : status === "suspended" ? "suspendu" : "en attente";
      toast({ title: `Compte ${label}` });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const r = await apiRequest("PATCH", `/api/admin/users/${id}/notes`, { notes });
      return r.json();
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      setEditingNotes((prev) => { const n = { ...prev }; delete n[id]; return n; });
      toast({ title: "Notes enregistrées" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteUser = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/users/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Utilisateur supprimé" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateListingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await apiRequest("PATCH", `/api/admin/listings/${id}/status`, { status });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/listings"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Annonce mise à jour" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteListing = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/listings/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/listings"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Annonce supprimée" });
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Tableau de bord Admin</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Gérez les comptes agents, les approbations et les annonces.
        </p>
      </div>

      {/* Stats cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Utilisateurs"
            value={stats.users.total}
            sub={`${stats.users.agents} agents · ${stats.users.guests} visiteurs`}
            color="teal"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="En attente"
            value={stats.agents.pending}
            sub="Agents à approuver"
            color={stats.agents.pending > 0 ? "amber" : "muted"}
            pulse={stats.agents.pending > 0}
          />
          <StatCard
            icon={<CheckCircle className="w-5 h-5" />}
            label="Agents approuvés"
            value={stats.agents.approved}
            sub={`${stats.agents.suspended} suspendu(s)`}
            color="green"
          />
          <StatCard
            icon={<Building2 className="w-5 h-5" />}
            label="Annonces"
            value={stats.listings.total}
            sub={`${stats.listings.active} actives · ${stats.listings.pending} en attente`}
            color="blue"
          />
        </div>
      ) : null}

      {/* Main tabs */}
      <Tabs defaultValue="agents">
        <TabsList className="mb-6">
          <TabsTrigger value="agents" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Agents
            {stats?.agents.pending ? (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                {stats.agents.pending}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="listings" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Annonces
          </TabsTrigger>
        </TabsList>

        {/* ── AGENTS TAB ── */}
        <TabsContent value="agents">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone…"
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "pending", "approved", "suspended"] as const).map((s) => (
                <Button
                  key={s}
                  variant={agentFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAgentFilter(s)}
                  className="text-xs"
                >
                  {s === "all" ? "Tous" : s === "pending" ? "En attente" : s === "approved" ? "Approuvés" : "Suspendus"}
                </Button>
              ))}
            </div>
          </div>

          {/* Agent list */}
          {agentsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Aucun agent trouvé.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {agents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  expanded={expandedAgent === agent.id}
                  onToggle={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                  onApprove={() => updateStatus.mutate({ id: agent.id, status: "approved" })}
                  onSuspend={() => updateStatus.mutate({ id: agent.id, status: "suspended" })}
                  onReinstate={() => updateStatus.mutate({ id: agent.id, status: "approved" })}
                  onDelete={() => {
                    if (confirm(`Supprimer le compte de ${agent.name} ? Cette action est irréversible.`)) {
                      deleteUser.mutate(agent.id);
                    }
                  }}
                  notes={editingNotes[agent.id] ?? agent.adminNotes ?? ""}
                  onNotesChange={(v) => setEditingNotes((prev) => ({ ...prev, [agent.id]: v }))}
                  onSaveNotes={() => saveNotes.mutate({ id: agent.id, notes: editingNotes[agent.id] ?? "" })}
                  busy={updateStatus.isPending || saveNotes.isPending || deleteUser.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── LISTINGS TAB ── */}
        <TabsContent value="listings">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Titre, ville, contact…"
                value={listingSearch}
                onChange={(e) => setListingSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "active", "pending", "sold"] as const).map((s) => (
                <Button
                  key={s}
                  variant={listingFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setListingFilter(s)}
                  className="text-xs"
                >
                  {s === "all" ? "Toutes" : s === "active" ? "Actives" : s === "pending" ? "En attente" : "Vendues"}
                </Button>
              ))}
            </div>
          </div>

          {listingsLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : adminListings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Aucune annonce trouvée.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Annonce</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Lieu</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Propriétaire</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {adminListings.map((listing) => (
                    <tr key={listing.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[200px]">{listing.title}</p>
                        <p className="text-xs text-muted-foreground">{fmtPrice(listing.price, listing.priceType)}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                        {listing.city}, {listing.department}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {listing.ownerName ? (
                          <div>
                            <p className="text-sm">{listing.ownerName}</p>
                            <p className="text-xs text-muted-foreground">{listing.ownerEmail}</p>
                            {listing.ownerStatus && listing.ownerStatus !== "approved" && (
                              <span className="text-[10px] text-amber-600">({listing.ownerStatus})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{statusBadge(listing.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {listing.status !== "active" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => updateListingStatus.mutate({ id: listing.id, status: "active" })}
                            >
                              Activer
                            </Button>
                          )}
                          {listing.status !== "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => updateListingStatus.mutate({ id: listing.id, status: "pending" })}
                            >
                              Suspendre
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Supprimer "${listing.title}" ?`)) deleteListing.mutate(listing.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color, pulse = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: "teal" | "amber" | "green" | "blue" | "muted";
  pulse?: boolean;
}) {
  const colorMap = {
    teal: "text-teal-600 bg-teal-50 dark:bg-teal-900/20",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    green: "text-green-600 bg-green-50 dark:bg-green-900/20",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    muted: "text-muted-foreground bg-muted/50",
  };
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[color]} ${pulse ? "animate-pulse" : ""}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ── Agent Row ─────────────────────────────────────────────────────────────────
function AgentRow({
  agent, expanded, onToggle, onApprove, onSuspend, onReinstate, onDelete,
  notes, onNotesChange, onSaveNotes, busy,
}: {
  agent: AdminUser;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onSuspend: () => void;
  onReinstate: () => void;
  onDelete: () => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onSaveNotes: () => void;
  busy: boolean;
}) {
  const isPending = agent.accountStatus === "pending";
  const isSuspended = agent.accountStatus === "suspended";
  const isApproved = agent.accountStatus === "approved";

  return (
    <div className={`rounded-xl border transition-colors ${isPending ? "border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20" : "bg-card"}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={onToggle}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
          isPending ? "bg-amber-200 text-amber-700 dark:bg-amber-800 dark:text-amber-200" :
          isSuspended ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
          "bg-primary/10 text-primary"
        }`}>
          {agent.name[0].toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{agent.name}</span>
            {agent.role === "admin" && <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 border-0 text-[10px]">Admin</Badge>}
            {!agent.emailVerified && <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><MailCheck className="w-3 h-3" /> Email non vérifié</span>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
        </div>

        {/* Status + date */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {statusBadge(agent.accountStatus)}
          <span className="text-xs text-muted-foreground">{fmtDate(agent.createdAt)}</span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isPending && (
            <Button size="sm" variant="default" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={onApprove} disabled={busy}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Approuver
            </Button>
          )}
          {isPending && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={onSuspend} disabled={busy}>
              <Ban className="w-3.5 h-3.5 mr-1" />
              Refuser
            </Button>
          )}
          {isApproved && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={onSuspend} disabled={busy}>
              <Ban className="w-3.5 h-3.5 mr-1" />
              Suspendre
            </Button>
          )}
          {isSuspended && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600 hover:bg-green-50 hover:text-green-700" onClick={onReinstate} disabled={busy}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              Réactiver
            </Button>
          )}
        </div>

        <button className="text-muted-foreground shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Téléphone</p>
              <p>{agent.phone ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Email vérifié</p>
              <p className={agent.emailVerified ? "text-green-600" : "text-amber-600"}>
                {agent.emailVerified ? "Oui" : "Non"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dernière révision</p>
              <p>{fmtDate(agent.reviewedAt)}</p>
            </div>
          </div>

          {/* Admin notes */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Notes internes (visibles uniquement par les admins)</p>
            <textarea
              rows={2}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Ajouter des notes sur ce compte…"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
            <div className="flex justify-between items-center mt-2">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onSaveNotes} disabled={busy}>
                Enregistrer les notes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
                disabled={busy}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Supprimer ce compte
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
