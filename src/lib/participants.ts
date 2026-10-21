// Mirrors backend/models/participant.py — keep in sync.
export type Status = "pending" | "confirmed" | "waiting";

export interface Participant {
  id: string;
  ext_id: string;
  name: string;
  email: string;
  registration: Status;
  gender: "M" | "F" | "";
  age: number | null;
  ala: string;
  estaca: string;
  phone: string;
  shirt: string;
  emergency_name: string;
  emergency_phone: string;
  medical: string;
  dietary: string;
  notes: string;
  team: number;
  contacted: boolean;
  status: Status;
  leader_note: string;
  updated_at: string;
}

export interface ParticipantUpdate {
  contacted?: boolean;
  status?: Status;
  leader_note?: string;
  team?: number;
}

export interface ImportResult {
  created: number;
  updated: number;
  total: number;
  columns: Record<string, string>;
}

export const TEAMS = [1, 2, 3, 4, 5, 6] as const;
export const SHIRTS = ["PP", "P", "M", "G", "GG", "XG", "3XG"] as const;

export const TEAM_COLORS: Record<number, string> = {
  1: "#EF4444",
  2: "#3B82F6",
  3: "#10B981",
  4: "#F59E0B",
  5: "#8B5CF6",
  6: "#EC4899",
};

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Pendente",
  confirmed: "Presença confirmada",
  waiting: "Lista de espera",
};

export const REGISTRATION_LABEL: Record<Status, string> = {
  pending: "Inscrição pendente",
  confirmed: "Inscrição confirmada",
  waiting: "Inscrição em espera",
};

const NEGATIVE =
  /^(n|no|nope|n[aã]o|nenhum[a]?|nada|naonao|not that i am aware|n\/a|-|\.|acho (que )?n[aã]o|pelo que sei,? n[aã]o|at[eé] o momento,? n[aã]o)([\s,]+(tenho|possuo|sei|h[aá]|senhor|tamb[eé]m|nada|nenhuma?))*[\s!.👎]*$|^sem\b.*$/iu;

export function cleanInfo(v: string): string {
  const t = (v || "").trim().replace(/[,;]+$/, "");
  return !t || NEGATIVE.test(t) ? "" : t;
}

export function hasHealthAlert(p: Participant): boolean {
  return Boolean(cleanInfo(p.medical) || cleanInfo(p.dietary));
}

export function firstName(name: string): string {
  const f = (name || "").trim().split(/\s+/)[0] ?? "";
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

export function phoneDigits(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length === 8 || d.length === 9) d = "91" + d; // número sem DDD → assume Belém (91)
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d;
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export type TemplateKey = "first" | "reminder" | "health" | "confirmed";

export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  first: "Primeiro contato",
  reminder: "Lembrete carinhoso",
  confirmed: "Boas-vindas (confirmado)",
  health: "Cuidado com a saúde",
};

export function buildMessage(key: TemplateKey, p: Participant, leader: string): string {
  const nome = firstName(p.name);
  const quem = leader.trim()
    ? `Aqui é ${leader.trim()}, da liderança da Equipe ${p.team}`
    : `Aqui é da liderança da Equipe ${p.team}`;
  switch (key) {
    case "first":
      return `Oi, ${nome}! Tudo bem? 😊\n\n${quem} na Conferência JAS 2026 em Belém. Vi sua inscrição e fiquei muito feliz em saber que você vai estar com a gente!\n\nQueria me apresentar e saber se está tudo certinho pra você participar. Se tiver qualquer dúvida sobre a programação, horários ou o que levar, é só me chamar por aqui.\n\nVai ser incrível ter você na nossa equipe! 🙌`;
    case "reminder":
      return `Oi, ${nome}! Como você está? 😊\n\nPassando só pra saber se continua tudo certo pra nossa Conferência JAS em Belém. A equipe está animada e contando os dias pra te ver!\n\nSe surgir qualquer coisa ou precisar de ajuda, me chama, tá bom?`;
    case "confirmed":
      return `${nome}, que alegria ter você confirmado(a)! 🎉\n\n${quem}. A gente vai criar um grupo da equipe pra combinar os detalhes e se conhecer melhor antes da conferência.\n\nEnquanto isso, qualquer dúvida é só falar comigo. Até breve!`;
    case "health": {
      const info = [cleanInfo(p.medical), cleanInfo(p.dietary)].filter(Boolean).join("; ");
      return `Oi, ${nome}! Tudo bem? 😊\n\n${quem} na JAS 2026. Vi na sua inscrição que você comentou sobre: ${info || "uma questão de saúde"}.\n\nQueremos cuidar bem de você durante a conferência. Tem algo que a gente precisa saber ou preparar? Fica à vontade pra me contar.`;
    }
  }
}

export function buildSummary(all: Participant[], filtered: Participant[]): string {
  const lines: string[] = ["📋 *Conferência JAS 2026 • Belém*", ""];
  const c = all.filter((p) => p.contacted).length;
  const conf = all.filter((p) => p.status === "confirmed").length;
  lines.push(`👥 Inscritos: *${all.length}*`, `✅ Contatados: *${c}*`, `🎉 Confirmados: *${conf}*`, "");
  for (const t of TEAMS) {
    const team = all.filter((p) => p.team === t);
    if (!team.length) continue;
    const tc = team.filter((p) => p.contacted).length;
    const tconf = team.filter((p) => p.status === "confirmed").length;
    lines.push(`*Equipe ${t}* — ${team.length} jovens • ${tc} contatados • ${tconf} confirmados`);
  }
  const counts = shirtCounts(filtered);
  const shirts = SHIRTS.filter((s) => counts[s]).map((s) => `${s}: ${counts[s]}`).join(" · ");
  if (shirts) lines.push("", `👕 Camisetas: ${shirts}`);
  const med = all.filter(hasHealthAlert).length;
  if (med) lines.push(`⚕️ ${med} jovens com alerta de saúde/alimentação`);
  return lines.join("\n");
}

export function shirtCounts(list: Participant[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of list) if (p.shirt) out[p.shirt] = (out[p.shirt] ?? 0) + 1;
  return out;
}
