import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCopy, HeartPulse, RefreshCw, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import ParticipantCard from "@/components/dashboard/ParticipantCard";
import WhatsAppDialog from "@/components/dashboard/WhatsAppDialog";
import ImportDialog from "@/components/dashboard/ImportDialog";
import {
  SHIRTS,
  TEAMS,
  TEAM_COLORS,
  buildSummary,
  hasHealthAlert,
  shirtCounts,
  type Participant,
} from "@/lib/participants";

const STATUS_FILTERS: Record<string, string> = {
  all: "Todos os status",
  contacted: "✅ Contatados",
  not_contacted: "⏳ Não contatados",
  confirmed: "🎉 Presença confirmada",
  pending: "Pendentes",
  waiting: "Lista de espera",
  medical: "⚕️ Com alerta de saúde",
};

function matchesStatus(p: Participant, f: string): boolean {
  switch (f) {
    case "contacted":
      return p.contacted;
    case "not_contacted":
      return !p.contacted;
    case "medical":
      return hasHealthAlert(p);
    case "confirmed":
    case "pending":
    case "waiting":
      return p.status === f;
    default:
      return true;
  }
}

function Stat({ label, value, sub, tone, testId }: { label: string; value: number; sub?: string; tone: string; testId: string }) {
  return (
    <div className="rounded-xl border bg-card/70 px-4 py-3 backdrop-blur">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("font-heading text-3xl font-semibold tabular-nums", tone)} data-testid={testId}>
          {value}
        </span>
        {sub && <span className="font-mono text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

const pct = (n: number, t: number) => (t ? `${Math.round((n / t) * 100)}%` : "0%");

export default function Dashboard() {
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["participants"],
    queryFn: () => apiGet<Participant[]>("/participants"),
    refetchInterval: 30_000, // keep the 6 leaders in sync
  });
  const all = useMemo(() => (isError ? [] : (data ?? [])), [data, isError]);
  const [team, setTeam] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [estaca, setEstaca] = useState("all");
  const [shirt, setShirt] = useState("all");
  const [waTarget, setWaTarget] = useState<Participant | null>(null);

  const estacas = useMemo(() => [...new Set(all.map((p) => p.estaca).filter(Boolean))].sort(), [all]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = q.replace(/\D/g, "");
    return all.filter(
      (p) =>
        (team === "all" || p.team === team) &&
        matchesStatus(p, status) &&
        (estaca === "all" || p.estaca === estaca) &&
        (shirt === "all" || p.shirt === shirt) &&
        (!q ||
          `${p.name} ${p.ala} ${p.estaca} ${p.leader_note}`.toLowerCase().includes(q) ||
          (qd.length >= 3 && p.phone.replace(/\D/g, "").includes(qd))),
    );
  }, [all, team, search, status, estaca, shirt]);

  const contacted = all.filter((p) => p.contacted).length;
  const confirmed = all.filter((p) => p.status === "confirmed").length;
  const alerts = all.filter(hasHealthAlert).length;
  const counts = shirtCounts(filtered);
  const filteredAlerts = filtered.filter(hasHealthAlert).length;
  const groups = TEAMS.filter((t) => team === "all" || t === team).map((t) => ({
    t,
    list: filtered.filter((p) => p.team === t),
    size: all.filter((p) => p.team === t).length,
    done: all.filter((p) => p.team === t && p.contacted).length,
  }));

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary(all, filtered));
      toast.success("Resumo copiado! É só colar no grupo do WhatsApp.");
    } catch {
      toast.error("Não foi possível copiar o resumo.");
    }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">Painel das 6 equipes</p>
            <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl" data-testid="app-title">
              Conferência JAS 2026 <span className="text-muted-foreground">• Belém</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5"
              data-testid="refresh-button"
            >
              <RefreshCw className={cn("size-4", isFetching && "animate-spin")} /> Atualizar
            </Button>
            <ImportDialog />
            <Button size="sm" onClick={copySummary} className="gap-1.5" data-testid="copy-summary-button">
              <ClipboardCopy className="size-4" /> Resumo
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Inscritos" value={all.length} tone="text-foreground" testId="stat-total" />
          <Stat label="Contatados" value={contacted} sub={pct(contacted, all.length)} tone="text-emerald-400" testId="stat-contacted" />
          <Stat label="Confirmados" value={confirmed} sub={pct(confirmed, all.length)} tone="text-sky-400" testId="stat-confirmed" />
          <Stat label="Alertas de saúde" value={alerts} tone="text-rose-400" testId="stat-alerts" />
        </section>

        <section className="space-y-3 rounded-2xl border bg-card/60 p-4 backdrop-blur">
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
            {(["all", ...TEAMS] as const).map((t) => {
              const active = team === t;
              const n = t === "all" ? all.length : all.filter((p) => p.team === t).length;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTeam(t)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-[background-color,border-color,color] duration-150",
                    active ? "border-emerald-500/60 bg-emerald-500/15 text-foreground" : "text-muted-foreground hover:bg-secondary",
                  )}
                  data-testid={`team-tab-${t}`}
                >
                  {t !== "all" && <span className="size-2 rounded-full" style={{ background: TEAM_COLORS[t] }} />}
                  {t === "all" ? "Todas" : `Equipe ${t}`}
                  <span className="font-mono text-[11px] opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar por nome, ala, estaca ou telefone..."
                className="pl-9"
                data-testid="search-input"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 lg:flex">
              <Select value={status} onValueChange={(v: string) => setStatus(v)}>
                <SelectTrigger className="w-full lg:w-48" data-testid="status-filter">
                  <SelectValue>{(v) => STATUS_FILTERS[v as string]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_FILTERS).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={estaca} onValueChange={(v: string) => setEstaca(v)}>
                <SelectTrigger className="w-full lg:w-52" data-testid="estaca-filter">
                  <SelectValue>{(v) => (v === "all" ? "Todas as estacas" : (v as string))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as estacas</SelectItem>
                  {estacas.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={shirt} onValueChange={(v: string) => setShirt(v)}>
                <SelectTrigger className="w-full lg:w-40" data-testid="shirt-filter">
                  <SelectValue>{(v) => (v === "all" ? "Todas camisetas" : `Camiseta ${v as string}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas camisetas</SelectItem>
                  {SHIRTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <div className="flex flex-wrap items-center gap-1.5" data-testid="shirt-summary">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Camisetas no filtro
              </span>
              {SHIRTS.filter((s) => counts[s]).map((s) => (
                <span key={s} className="rounded-md border bg-background/60 px-2 py-0.5 font-mono text-xs">
                  {s} <b className="text-emerald-400">{counts[s]}</b>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs">
              {filteredAlerts > 0 && (
                <span className="flex items-center gap-1 font-medium text-rose-400" data-testid="filtered-alerts">
                  <HeartPulse className="size-3.5" /> {filteredAlerts} com alerta
                </span>
              )}
              <span className="font-medium text-muted-foreground" data-testid="showing-count">
                Mostrando {filtered.length} de {all.length}
              </span>
            </div>
          </div>
        </section>

        {all.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-12 text-center" data-testid="empty-state">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isError ? "Não foi possível carregar os participantes agora." : "Nenhum participante ainda. Importe a planilha de inscrições."}
            </p>
          </div>
        )}

        {groups
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <section key={g.t} className="space-y-3" data-testid={`team-section-${g.t}`}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
                  <span className="h-5 w-1.5 rounded-full" style={{ background: TEAM_COLORS[g.t] }} />
                  Equipe {g.t}
                  <span className="font-mono text-xs font-normal text-muted-foreground">{g.list.length} no filtro</span>
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: pct(g.done, g.size), background: TEAM_COLORS[g.t] }}
                    />
                  </div>
                  <span className="font-mono" data-testid={`team-progress-${g.t}`}>
                    {g.done}/{g.size} contatados
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.list.map((p, i) => (
                  <ParticipantCard key={p.id} p={p} index={i} onWhatsApp={setWaTarget} />
                ))}
              </div>
            </section>
          ))}
      </main>

      <WhatsAppDialog participant={waTarget} onClose={() => setWaTarget(null)} />
      <Toaster richColors />
    </div>
  );
}
