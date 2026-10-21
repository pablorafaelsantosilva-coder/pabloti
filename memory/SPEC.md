# SPEC — Gestão de Equipes • Conferência JAS 2026 Belém

pt-BR dashboard for the leaders of 6 teams to contact and track the event's participants (no login).

## Data model (Mongo `participants`; Pydantic `backend/models/participant.py` ↔ TS `frontend/src/lib/participants.ts`)
id (uuid), ext_id (registration "#"), name, email, registration (pending|confirmed|waiting — from spreadsheet),
gender (M|F), age, ala, estaca, phone, shirt, emergency_name/phone, medical, dietary, notes,
team (1–6), contacted (bool), status (pending|confirmed|waiting — leader-managed presence), leader_note, updated_at.

## API (all under /api)
- GET /participants — list (sorted by name)
- PATCH /participants/{id} — {contacted?, status?, leader_note?, team? (1–6)}; 404 if missing
- POST /participants/import — multipart `file` (.xlsx/.csv) + `replace` (bool). Auto-detects pt-BR columns
  (Nome+Sobrenome, Genero male/female, Unidade, Estaca, Numero de telefone, Tamanho da camiseta, contato de
  emergência, Condicoes medicas, Alergias alimentares, Bio/Respostas → notes, Confirmado, Lista de espera,
  skips rows with Data de exclusao). Upsert by ext_id prefix (8 chars) or normalized name; keeps contact/status.
  New people without team are balanced by gender across teams. 400 with pt-BR detail on bad file.

## Seed
On startup, if collection empty: imports `backend/seed_participants.xlsx` (user's file, 309 rows). Team
assignments of the original prototype (`seed_data.json`, teams 1–2) are kept; rest balanced (~51/team).
Status starts `pending` (or `waiting` if registration is waiting: 24 people). 280 registrations confirmed.

## Frontend flows (single page `/`)
Stats (inscritos, contatados, confirmados, alertas de saúde), team tabs, search, filters (status/estaca/camiseta),
shirt summary for filter, cards per team with status select, contacted toggle, leader note (saves on blur),
details (move team), WhatsApp dialog (natural templates without shirt size, leader name stored in localStorage,
sending marks contacted), "Resumo" copies WhatsApp summary, "Importar planilha" dialog. Auto-refetch every 30s.
