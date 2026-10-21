import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MessageCircle, Phone, HeartPulse, Check } from "lucide-react";
import { toast } from "sonner";
import { apiPatch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  REGISTRATION_LABEL,
  STATUS_LABEL,
  TEAMS,
  TEAM_COLORS,
  cleanInfo,
  hasHealthAlert,
  phoneDigits,
  type Participant,
  type ParticipantUpdate,
  type Status,
} from "@/lib/participants";

const STATUS_BORDER: Record<Status, string> = {
  confirmed: "border-l-emerald-500",
  pending: "border-l-amber-500",
  waiting: "border-l-violet-500",
};

export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ParticipantUpdate }) =>
      apiPatch<Participant>(`/participants/${id}`, body),
    onSuccess: (updated) => {
      qc.setQueryData<Participant[]>(["participants"], (old) =>
        old?.map((p) => (p.id === updated.id ? updated : p)),
      );
    },
    onError: () => toast.error("Não foi possível salvar. Tente novamente."),
  });
}

function Detail({ label, value, testId }: { label: string; value: string; testId: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[13px] whitespace-pre-line text-foreground/90" data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

interface Props {
  p: Participant;
  index: number;
  onWhatsApp: (p: Participant) => void;
}

export default function ParticipantCard({ p, index, onWhatsApp }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(p.leader_note);
  const update = useUpdateParticipant();
  const alert = hasHealthAlert(p);
  const tid = p.id.slice(0, 8);
  const save = (body: ParticipantUpdate) => update.mutate({ id: p.id, body });

  return (
    <article
      data-testid={`participant-card-${tid}`}
      style={{ animationDelay: `${Math.min(index, 20) * 18}ms` }}
      className={cn(
        "animate-card-in group relative flex flex-col gap-3 rounded-xl border border-l-4 bg-card p-4",
        "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20",
        STATUS_BORDER[p.status],
        p.contacted && "bg-emerald-500/[0.06] ring-1 ring-emerald-500/25",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold leading-tight" data-testid={`participant-name-${tid}`}>
            {p.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {p.ala || "—"} {p.estaca && <>· {p.estaca}</>}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold"
          style={{ background: `${TEAM_COLORS[p.team]}22`, color: TEAM_COLORS[p.team] }}
          data-testid={`participant-team-${tid}`}
        >
          EQ {p.team}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={p.gender === "F" ? "border-pink-500/40 text-pink-300" : "border-sky-500/40 text-sky-300"}
        >
          {p.gender === "F" ? "Feminino" : p.gender === "M" ? "Masculino" : "—"}
        </Badge>
        {p.age != null && <Badge variant="secondary">{p.age} anos</Badge>}
        {p.shirt && (
          <Badge variant="secondary" className="font-mono" data-testid={`participant-shirt-${tid}`}>
            👕 {p.shirt}
          </Badge>
        )}
        {alert && (
          <Badge className="animate-soft-pulse gap-1 bg-rose-600 text-white" data-testid={`participant-alert-${tid}`}>
            <HeartPulse className="size-3" /> Saúde
          </Badge>
        )}
        {p.registration !== "confirmed" && (
          <Badge variant="outline" className="border-violet-500/40 text-violet-300" data-testid={`participant-registration-${tid}`}>
            {REGISTRATION_LABEL[p.registration]}
          </Badge>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 self-start text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
        data-testid={`participant-details-toggle-${tid}`}
      >
        <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} />
        {open ? "Ocultar detalhes" : "Ver detalhes"}
      </button>

      {open && (
        <div
          className="grid gap-2.5 rounded-lg border bg-background/60 p-3 animate-in fade-in-50 duration-200"
          data-testid={`participant-details-${tid}`}
        >
          <Detail label="Telefone" value={p.phone} testId={`detail-phone-${tid}`} />
          <Detail label="E-mail" value={p.email} testId={`detail-email-${tid}`} />
          <Detail
            label="Contato de emergência"
            value={[p.emergency_name, p.emergency_phone].filter(Boolean).join(" · ")}
            testId={`detail-emergency-${tid}`}
          />
          <Detail label="Condições médicas" value={cleanInfo(p.medical)} testId={`detail-medical-${tid}`} />
          <Detail label="Alimentação" value={cleanInfo(p.dietary)} testId={`detail-dietary-${tid}`} />
          <Detail label="Observações da inscrição" value={p.notes} testId={`detail-notes-${tid}`} />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mover para equipe
            </span>
            <Select value={String(p.team)} onValueChange={(v: string) => save({ team: Number(v) })}>
              <SelectTrigger size="sm" className="w-full" data-testid={`participant-team-select-${tid}`}>
                <SelectValue>{(v) => `Equipe ${v as string}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    Equipe {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <div className="flex gap-2">
          <Select value={p.status} onValueChange={(v: string) => save({ status: v as Status })}>
            <SelectTrigger size="sm" className="flex-1" data-testid={`participant-status-select-${tid}`}>
              <SelectValue>{(v) => STATUS_LABEL[v as Status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={p.contacted ? "default" : "outline"}
            onClick={() => save({ contacted: !p.contacted })}
            className="gap-1 transition-colors duration-150"
            data-testid={`participant-contacted-toggle-${tid}`}
          >
            <Check className="size-3.5" />
            {p.contacted ? "Contatado" : "Marcar contato"}
          </Button>
        </div>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== p.leader_note && save({ leader_note: note })}
          placeholder="📝 Anotação da liderança..."
          className="h-8 text-xs"
          data-testid={`participant-note-input-${tid}`}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-[2] gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
            onClick={() => onWhatsApp(p)}
            disabled={!p.phone}
            data-testid={`participant-whatsapp-button-${tid}`}
          >
            <MessageCircle className="size-4" /> WhatsApp
          </Button>
          <a
            href={`tel:+${phoneDigits(p.phone)}`}
            aria-label={`Ligar para ${p.name}`}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors duration-150 hover:bg-secondary"
            data-testid={`participant-call-link-${tid}`}
          >
            <Phone className="size-3.5" /> Ligar
          </a>
        </div>
      </div>
    </article>
  );
}
