#!/usr/bin/env python3
"""
Build public/data/facilities.json from Mexico's official health-facility registry
(CLUES — Catálogo de Clave Única de Establecimientos de Salud, DGIS / Secretaría de Salud).

Python 3 standard library only (zipfile + xml.etree), no pip installs.

Usage:
  python3 scripts/build-facilities.py                 # downloads the XLSX (~25 MB) to a temp dir
  python3 scripts/build-facilities.py path/to/ESTABLECIMIENTO_SALUD_YYYYMM.xlsx

Source page: http://www.dgis.salud.gob.mx/contenidos/intercambio/clues_gobmx.html
("Las variables de las CLUES están abiertas a todo el sector salud, no existen restricciones para su uso.")

Filters (see docs/data.md §B.5):
  * ENTIDAD in Puebla, Hidalgo, San Luis Potosí, Veracruz (covers Sierra Norte de Puebla + Huasteca demo regions)
  * ESTATUS DE OPERACION == "EN OPERACION"
  * NOMBRE TIPO ESTABLECIMIENTO in {DE CONSULTA EXTERNA, DE HOSPITALIZACIÓN}
  * public / social-security / Cruz Roja only (drops SERVICIOS MEDICOS PRIVADOS and non-care
    institutions such as fiscalías, forensic services, CIJ addiction centres)
  * drops mobile units / brigades (no fixed location) and single-purpose UNEMES (dialysis, mental health…)
  * requires valid coordinates inside Mexico's bounding box
"""
import json, os, re, sys, tempfile, urllib.request, zipfile, collections
import xml.etree.ElementTree as ET

DEFAULT_URL = "http://gobi.salud.gob.mx/gobi/catalogos/catalogosmaestros/ESTABLECIMIENTO_SALUD_202608.xlsx"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "facilities.json")
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

STATES = {"PUEBLA", "HIDALGO", "SAN LUIS POTOSI", "VERACRUZ DE IGNACIO DE LA LLAVE"}
TYPES = {"DE CONSULTA EXTERNA", "DE HOSPITALIZACIÓN", "DE HOSPITALIZACION"}
# Institution keep-list (NOMBRE DE LA INSTITUCION, stripped) -> short label shown in the app
INSTITUTIONS = {
    "SECRETARIA DE SALUD": "SSA",
    "SERVICIOS DE SALUD IMSS BIENESTAR": "IMSS-Bienestar",
    "INSTITUTO MEXICANO DEL SEGURO SOCIAL REGIMEN BIENESTAR": "IMSS-Bienestar",
    "INSTITUTO MEXICANO DEL SEGURO SOCIAL": "IMSS",
    "INSTITUTO DE SEGURIDAD Y SERVICIOS SOCIALES DE LOS TRABAJADORES DEL ESTADO": "ISSSTE",
    "SERVICIOS MEDICOS ESTATALES": "Estatal",
    "SERVICIOS MEDICOS MUNICIPALES": "Municipal",
    "SISTEMA NACIONAL PARA EL DESARROLLO INTEGRAL DE LA FAMILIA": "DIF",
    "SECRETARIA DE LA DEFENSA NACIONAL": "SEDENA",
    "SECRETARIA DE MARINA": "SEMAR",
    "PETROLEOS MEXICANOS": "PEMEX",
    "CRUZ ROJA MEXICANA": "Cruz Roja",
}
DROP_TIPOLOGIA = re.compile(r"M[OÓ]VIL|BRIGADA|UNEMES|PREVENCION EN ADICCIONES|FORENSE|MINISTERIO", re.I)


def col_index(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group():
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_rows(path):
    z = zipfile.ZipFile(path)
    shared = []
    for _, el in ET.iterparse(z.open("xl/sharedStrings.xml")):
        if el.tag == NS + "si":
            shared.append("".join(t.text or "" for t in el.iter(NS + "t")))
            el.clear()
    # first sheet in workbook = CLUES_YYYYMM (main catalogue)
    rels = z.read("xl/_rels/workbook.xml.rels").decode()
    wb = z.read("xl/workbook.xml").decode()
    rid = re.search(r'<sheet [^>]*r:id="([^"]+)"', wb).group(1)
    target = re.search(r'Id="%s"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="%s"' % (rid, rid), rels)
    sheet = "xl/" + (target.group(1) or target.group(2)).lstrip("/").replace("xl/", "")
    header = None
    for _, el in ET.iterparse(z.open(sheet)):
        if el.tag != NS + "row":
            continue
        row = {}
        for c in el.iter(NS + "c"):
            t = c.get("t")
            if t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(NS + "t"))
            else:
                v = c.find(NS + "v")
                if v is None:
                    continue
                val = shared[int(v.text)] if t == "s" else v.text
            row[col_index(c.get("r"))] = val.strip()
        el.clear()
        if header is None:
            header = {i: h for i, h in row.items()}
            continue
        yield {header[i]: v for i, v in row.items() if i in header}


def nivel(r):
    tipo = r.get("NOMBRE TIPO ESTABLECIMIENTO", "")
    na = r.get("NIVEL ATENCION", "")
    if tipo.startswith("DE HOSPITALIZ"):
        return 3 if na == "TERCER NIVEL" else 2
    return 1


def title(s):
    # compact, readable casing; keep short words lowercase
    small = {"de", "del", "la", "las", "los", "y", "el", "en"}
    out = []
    for i, w in enumerate(s.lower().split()):
        out.append(w if (i and w in small) else w[:1].upper() + w[1:])
    return " ".join(out)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    if not src:
        src = os.path.join(tempfile.gettempdir(), "clues.xlsx")
        print("Downloading", DEFAULT_URL)
        urllib.request.urlretrieve(DEFAULT_URL, src)
    stats = collections.Counter()
    out = []
    for r in read_rows(src):
        stats["total"] += 1
        if r.get("ENTIDAD") not in STATES:
            continue
        stats["in_states"] += 1
        if r.get("ESTATUS DE OPERACION") != "EN OPERACION":
            continue
        stats["operating"] += 1
        if r.get("NOMBRE TIPO ESTABLECIMIENTO") not in TYPES:
            continue
        inst = INSTITUTIONS.get(r.get("NOMBRE DE LA INSTITUCION", "").strip())
        if not inst:
            continue
        tip = r.get("NOMBRE DE TIPOLOGIA", "")
        if DROP_TIPOLOGIA.search(tip) or r.get("UNIDAD MOVIL TIPO"):
            continue
        stats["public_care"] += 1
        try:
            lat, lng = float(r["LATITUD"]), float(r["LONGITUD"])
        except (KeyError, ValueError):
            stats["no_coords"] += 1
            continue
        if not (14.0 <= lat <= 33.0 and -118.5 <= lng <= -86.0):
            stats["bad_coords"] += 1
            continue
        n = nivel(r)
        out.append({
            "clues": r["CLUES"],
            "nombre": title(r.get("NOMBRE DE LA UNIDAD", "")),
            "tipo": title(tip) if tip and tip != "NO ESPECIFICADO" else ("Hospital" if n > 1 else "Consulta externa"),
            "nivel": n,  # 1 = primer nivel (consulta externa), 2 = hospital (2do nivel), 3 = hospital de alta especialidad
            "municipio": title(r.get("MUNICIPIO", "")),
            "localidad": title(r.get("LOCALIDAD", "")),
            "estado": {"PUEBLA": "PUE", "HIDALGO": "HGO", "SAN LUIS POTOSI": "SLP"}.get(r["ENTIDAD"], "VER"),
            "lat": round(lat, 4),
            "lng": round(lng, 4),
            "institucion": inst,
        })
    out.sort(key=lambda f: f["clues"])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    by_level = collections.Counter(f["nivel"] for f in out)
    by_state = collections.Counter(f["estado"] for f in out)
    print(dict(stats))
    print("written:", len(out), "records", os.path.getsize(OUT), "bytes ->", os.path.normpath(OUT))
    print("by nivel:", dict(by_level), "by estado:", dict(by_state))


if __name__ == "__main__":
    main()
