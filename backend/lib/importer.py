"""Spreadsheet (XLSX/CSV) parsing + column detection for participant imports."""

import io
import re
import unicodedata

import pandas as pd


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower()).strip()


# Fields that may be fed by several columns (values are joined).
MULTI = {"notes"}


def detect_field(header: str) -> str | None:
    h = norm(header)
    if h.startswith("id da") or "identificacao" in h or "data de" in h or "ultima" in h:
        return "exclusion" if "exclusao" in h else None
    is_phone = any(k in h for k in ("tel", "fone", "cel", "whats")) or h.startswith("numero")
    if any(k in h for k in ("emerg", "responsavel", "parente")):
        if "mail" in h:
            return None
        return "emergency_phone" if is_phone else "emergency_name"
    if h in ("#", "id", "codigo", "id inscricao"):
        return "ext_id"
    if "mail" in h:
        return "email"
    if "lista de espera" in h:
        return "flag_waiting"
    if h.startswith("confirmad"):
        return "flag_confirmed"
    if "equipe" in h or h in ("time", "grupo"):
        return "team"
    if "camis" in h or "tamanho" in h:
        return "shirt"
    if "estaca" in h or "distrito" in h:
        return "estaca"
    if h == "ala" or h.startswith("ala ") or "unidade" in h or "ramo" in h:
        return "ala"
    if "idade" in h:
        return "age"
    if "sexo" in h or "genero" in h:
        return "gender"
    if "aliment" in h or "dieta" in h:
        return "dietary"
    if any(k in h for k in ("medic", "saude", "alerg", "condic")):
        return "medical"
    if any(k in h for k in ("observ", "coment", "obs", "bio", "resposta", "pesquisa")):
        return "notes"
    if is_phone:
        return "phone"
    if "sobrenome" in h:
        return "last_name"
    if "nome" in h:
        return "name"
    return None


def read_table(filename: str, content: bytes) -> pd.DataFrame:
    name = filename.lower()
    if name.endswith((".xlsx", ".xlsm", ".xls")):
        df = pd.read_excel(io.BytesIO(content), dtype=str)
    else:
        text = ""
        for enc in ("utf-8-sig", "latin-1"):
            try:
                text = content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        df = pd.read_csv(io.StringIO(text), dtype=str, sep=None, engine="python")
    return df.fillna("")


def clean_gender(v: str) -> str:
    n = norm(v)
    if n in ("m", "masc", "masculino", "male", "homem", "0") or n.startswith("masc"):
        return "M"
    if n in ("f", "fem", "feminino", "female", "mulher", "1") or n.startswith("fem"):
        return "F"
    return ""


def clean_shirt(v: str) -> str:
    s = str(v).strip().upper().replace(" ", "")
    return "3XG" if s in ("EXG", "XGG", "XXG") else s


def clean_int(v: str) -> int | None:
    m = re.search(r"\d+", str(v))
    return int(m.group()) if m else None


def is_yes(v: str) -> bool:
    return norm(v) in ("sim", "s", "yes", "true", "1", "x")


def clean_note(v: str) -> str:
    # survey answers come as "06. Pergunta?: Resposta" — keep it readable
    return re.sub(r"^\d+\.\s*", "", v.strip())


def rows_from_df(df: pd.DataFrame) -> tuple[list[dict], dict[str, str]]:
    mapping: dict[str, str] = {}
    for col in df.columns:
        f = detect_field(str(col))
        if f and (f in MULTI or f not in mapping.values()):
            mapping[str(col)] = f
    if "name" not in mapping.values():
        raise ValueError("Não encontrei a coluna de NOME na planilha.")
    rows: list[dict] = []
    for _, r in df.iterrows():
        row: dict = {}
        notes: list[str] = []
        skip = False
        for col, field in mapping.items():
            val = str(r[col]).strip()
            if field == "exclusion":
                skip = bool(val)
            elif field == "notes":
                if val and norm(val) not in ("no.", "no", "nao", "nao."):
                    notes.append(clean_note(val))
            elif field == "gender":
                row[field] = clean_gender(val)
            elif field == "shirt":
                row[field] = clean_shirt(val)
            elif field == "age":
                row[field] = clean_int(val)
            elif field == "team":
                t = clean_int(val)
                if t and 1 <= t <= 6:
                    row[field] = t
            elif field in ("flag_waiting", "flag_confirmed"):
                row[field] = is_yes(val)
            else:
                row[field] = val
        if skip:
            continue
        last = row.pop("last_name", "")
        if last:
            row["name"] = f"{row.get('name', '')} {last}".strip()
        if notes:
            row["notes"] = "\n".join(notes)
        waiting, confirmed = row.pop("flag_waiting", None), row.pop("flag_confirmed", None)
        if waiting:
            row["registration"] = "waiting"
        elif confirmed is not None:
            row["registration"] = "confirmed" if confirmed else "pending"
        if row.get("name"):
            rows.append(row)
    return rows, {k: v for k, v in mapping.items() if v != "exclusion"}
