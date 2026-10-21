import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from lib.db import db
from lib.importer import norm, read_table, rows_from_df
from models.participant import ImportResult, Participant, ParticipantUpdate

router = APIRouter()
BASE = Path(__file__).parent.parent
SEED_XLSX = BASE / "seed_participants.xlsx"
SEED_TEAMS = BASE / "seed_data.json"  # team assignments from the original panel (by id prefix)


def _to_model(doc: dict) -> Participant:
    doc.pop("_id", None)
    ua = doc.get("updated_at")
    if isinstance(ua, datetime) and ua.tzinfo is None:
        doc["updated_at"] = ua.replace(tzinfo=timezone.utc)
    return Participant(**doc)


def _key(ext_id: str) -> str:
    return (ext_id or "")[:8].lower()


async def import_rows(rows: list[dict], replace: bool) -> tuple[int, int, int]:
    if replace:
        await db.participants.delete_many({})
    existing = await db.participants.find({}, {"_id": 0}).to_list(5000)
    by_ext = {_key(d["ext_id"]): d for d in existing if d.get("ext_id")}
    by_name = {norm(d["name"]): d for d in existing}
    # balance new people across teams by gender, then by total size
    load = Counter()
    for d in existing:
        load[(d.get("team", 1), d.get("gender", ""))] += 1
        load[d.get("team", 1)] += 1

    created = updated = 0
    now = datetime.now(timezone.utc)
    for row in rows:
        match = by_ext.get(_key(row.get("ext_id", ""))) if row.get("ext_id") else None
        match = match or by_name.get(norm(row["name"]))
        if match:
            row["updated_at"] = now
            await db.participants.update_one({"id": match["id"]}, {"$set": row})
            updated += 1
            continue
        g = row.get("gender", "")
        if "team" not in row:
            row["team"] = min(range(1, 7), key=lambda t: (load[(t, g)], load[t], t))
        row.setdefault("status", "waiting" if row.get("registration") == "waiting" else "pending")
        p = Participant(**row)
        await db.participants.insert_one(p.model_dump())
        load[(p.team, g)] += 1
        load[p.team] += 1
        by_name[norm(p.name)] = p.model_dump()
        if p.ext_id:
            by_ext[_key(p.ext_id)] = p.model_dump()
        created += 1
    total = await db.participants.count_documents({})
    return created, updated, total


async def seed_if_empty() -> None:
    if await db.participants.count_documents({}) > 0 or not SEED_XLSX.exists():
        return
    rows, _ = rows_from_df(read_table(SEED_XLSX.name, SEED_XLSX.read_bytes()))
    teams: dict[str, int] = {}
    if SEED_TEAMS.exists():
        raw = json.loads(SEED_TEAMS.read_text(encoding="utf-8"))
        for idx, group in enumerate(raw["G"]):
            for p in group:
                teams[_key(p[0])] = idx + 1
    # pre-assigned people first so the balancer sees their load
    rows.sort(key=lambda r: 0 if _key(r.get("ext_id", "")) in teams else 1)
    for r in rows:
        t = teams.get(_key(r.get("ext_id", "")))
        if t:
            r["team"] = t
    await import_rows(rows, replace=False)


@router.get("/participants", response_model=List[Participant])
async def list_participants():
    docs = await db.participants.find({}, {"_id": 0}).sort("name", 1).to_list(5000)
    return [_to_model(d) for d in docs]


@router.patch("/participants/{id}", response_model=Participant)
async def update_participant(id: str, body: ParticipantUpdate):
    changes = body.model_dump(exclude_none=True)
    changes["updated_at"] = datetime.now(timezone.utc)
    doc = await db.participants.find_one_and_update(
        {"id": id}, {"$set": changes}, projection={"_id": 0}, return_document=True
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Participante não encontrado")
    return _to_model(doc)


@router.post("/participants/import", response_model=ImportResult)
async def import_participants(file: UploadFile = File(...), replace: bool = Form(False)):
    content = await file.read()
    try:
        rows, mapping = rows_from_df(read_table(file.filename or "", content))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível ler o arquivo. Use .xlsx ou .csv.")
    if not rows:
        raise HTTPException(status_code=400, detail="Nenhum participante encontrado no arquivo.")
    created, updated, total = await import_rows(rows, replace)
    return ImportResult(created=created, updated=updated, total=total, columns=mapping)
