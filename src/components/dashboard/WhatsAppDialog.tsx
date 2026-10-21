import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_LABEL,
  buildMessage,
  hasHealthAlert,
  waLink,
  type Participant,
  type TemplateKey,
} from "@/lib/participants";
import { useUpdateParticipant } from "./ParticipantCard";

const LEADER_KEY = "jas-leader-name";

interface Props {
  participant: Participant | null;
  onClose: () => void;
}

export default function WhatsAppDialog({ participant, onClose }: Props) {
  const [leader, setLeader] = useState(() => localStorage.getItem(LEADER_KEY) ?? "");
  const [tpl, setTpl] = useState<TemplateKey>("first");
  const [text, setText] = useState("");
  const update = useUpdateParticipant();

  useEffect(() => {
    if (participant) setText(buildMessage(tpl, participant, leader));
  }, [participant, tpl, leader]);

  useEffect(() => {
    if (participant) setTpl(participant.status === "confirmed" ? "confirmed" : participant.contacted ? "reminder" : "first");
  }, [participant]);

  if (!participant) return null;
  const keys = (Object.keys(TEMPLATE_LABEL) as TemplateKey[]).filter(
    (k) => k !== "health" || hasHealthAlert(participant),
  );

  const send = () => {
    localStorage.setItem(LEADER_KEY, leader);
    window.open(waLink(participant.phone, text), "_blank", "noopener");
    if (!participant.contacted) update.mutate({ id: participant.id, body: { contacted: true } });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="whatsapp-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Mensagem para {participant.name}</DialogTitle>
          <DialogDescription>Escolha um modelo, ajuste do seu jeito e envie pelo WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leader-name">Seu nome (aparece na mensagem)</Label>
            <Input
              id="leader-name"
              value={leader}
              onChange={(e) => setLeader(e.target.value)}
              placeholder="Ex.: Irmão Carlos"
              data-testid="whatsapp-leader-name-input"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTpl(k)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
                  tpl === k ? "border-emerald-500 bg-emerald-500/15 text-emerald-300" : "hover:bg-secondary",
                )}
                data-testid={`whatsapp-template-${k}`}
              >
                {TEMPLATE_LABEL[k]}
              </button>
            ))}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={9}
            className="text-sm leading-relaxed"
            data-testid="whatsapp-message-textarea"
          />
          <Button
            onClick={send}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-500"
            data-testid="whatsapp-send-button"
          >
            <Send className="size-4" /> Abrir no WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
