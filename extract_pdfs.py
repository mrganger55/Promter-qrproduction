# -*- coding: utf-8 -*-
"""
QR Production Prompter — PDF -> TXT + manifest builder
SRC: Sarkilar ve sozler/*.pdf  ->  Sarkilar TXT/*.txt  +  data/songs-manifest.json
Applies smart line-breaking for PDFs whose text came out as a single long line.
"""
import sys
import json
import re
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

try:
    from PyPDF2 import PdfReader
except ImportError:
    import PyPDF2
    PdfReader = PyPDF2.PdfReader

BASE = Path(r"C:\Users\QR\Desktop\EBD")
SRC = BASE / "Şarkılar ve sözler"
DST = BASE / "Şarkılar TXT"
MANIFEST = BASE / "data" / "songs-manifest.json"
BUNDLE = BASE / "js" / "songs-bundle.js"  # inline bundle for file:// usage

DST.mkdir(parents=True, exist_ok=True)

UPPER = "A-ZÇĞİÖŞÜ"
LOWER = "a-zçğıöşü"

NO_SPLIT_WORDS = {
    "Allah", "Allah'ım", "Allah'a", "Allahım", "Allahın",
    "Tanrı", "Tanrım", "Tanrının",
    "Mevlam", "Mevla", "Mevlana",
    "Yâr", "Yar", "Yârim",
    "Rabbim", "Rabbi",
    "Süleyman", "Sultan",
}

def smart_linebreak(text):
    pattern = re.compile(
        "([" + LOWER + r"\?\!\,\"”’\)\]])\s+(?=[" + UPPER + "][" + LOWER + "])"
    )
    out = pattern.sub(r"\1\n", text)
    lines = out.split("\n")
    merged = []
    for ln in lines:
        ls = ln.strip()
        if merged:
            first = re.match("^([" + UPPER + "][" + LOWER + "'’ıİ]*)", ls)
            if first and first.group(1) in NO_SPLIT_WORDS:
                merged[-1] = merged[-1].rstrip() + " " + ls
                continue
        merged.append(ln)
    return "\n".join(merged)

def clean_text(raw):
    if not raw:
        return ""
    raw = raw.replace("�", "")  # replacement char
    raw = raw.replace("﻿", "")  # BOM
    fixes = {
        "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl",
        "ﬃ": "ffi", "ﬄ": "ffl",
    }
    for k, v in fixes.items():
        raw = raw.replace(k, v)
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    # Unicode line/paragraph separators (PyPDF2 emits these instead of \n)
    raw = raw.replace(" ", "\n").replace(" ", "\n")
    # Vertical tab / form feed → newline
    raw = raw.replace("\v", "\n").replace("\f", "\n")
    # Non-breaking space → regular space
    raw = raw.replace(" ", " ").replace(" ", " ").replace(" ", " ")
    raw = re.sub(r"\n[ \t]*\n+", "\n\n", raw)
    lines = [ln.rstrip() for ln in raw.split("\n")]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    text = "\n".join(lines)

    non_empty = [l for l in text.split("\n") if l.strip()]
    if len(non_empty) <= 3 and any(len(l) > 100 for l in non_empty):
        text = smart_linebreak(text)
        text = re.sub(r"\n[ \t]*\n+", "\n\n", text)

    return text

def pdf_to_text(pdf_path):
    try:
        reader = PdfReader(str(pdf_path))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                parts.append("")
        return "\n".join(parts)
    except Exception as e:
        print("    ! PyPDF2 read failed:", e)
        return ""

def title_from_filename(name):
    t = name.replace(".pdf", "").strip()
    t = re.sub(r"\s+", " ", t)
    return t

def slugify(name):
    s = name.strip().upper()
    tr = str.maketrans({
        "Ç": "C", "Ğ": "G", "İ": "I", "I": "I",
        "Ö": "O", "Ş": "S", "Ü": "U",
        "ç": "C", "ğ": "G", "ı": "I", "i": "I",
        "ö": "O", "ş": "S", "ü": "U",
    })
    s = s.translate(tr)
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^A-Z0-9_\-]", "", s)
    return s

manifest = []
errors = []

SKIP_PATTERNS = ("setlist", "yedek")  # non-song PDFs

pdfs = sorted([
    p for p in SRC.iterdir()
    if p.suffix.lower() == ".pdf"
    and not any(k in p.name.lower() for k in SKIP_PATTERNS)
])
print("Found", len(pdfs), "song PDF files")

seen_slugs = set()
for pdf in pdfs:
    title = title_from_filename(pdf.name)
    slug_base = slugify(title)
    slug = slug_base
    i = 2
    while slug in seen_slugs:
        slug = slug_base + "_" + str(i)
        i += 1
    seen_slugs.add(slug)

    try:
        raw = pdf_to_text(pdf)
        text = clean_text(raw)
        out = DST / (slug + ".txt")
        out.write_text(text, encoding="utf-8")
        line_count = sum(1 for l in text.split("\n") if l.strip())
        manifest.append({
            "title": title,
            "filename": out.name,
            "lines": line_count,
            "chars": len(text),
        })
        status = "OK   " if line_count > 3 else "THIN "
        print("  " + status + pdf.name + " -> " + out.name + " (" + str(line_count) + " lines)")
    except Exception as e:
        errors.append({"file": pdf.name, "error": str(e)})
        print("  ERR  " + pdf.name + ": " + str(e))

manifest.sort(key=lambda x: x["title"].lower())
MANIFEST.parent.mkdir(parents=True, exist_ok=True)
MANIFEST.write_text(
    json.dumps({"count": len(manifest), "songs": manifest, "errors": errors},
               ensure_ascii=False, indent=2),
    encoding="utf-8"
)

# Build inline JS bundle so the app works on file:// (no server needed)
bundle_texts = {}
for entry in manifest:
    p = DST / entry["filename"]
    try:
        bundle_texts[entry["filename"]] = p.read_text(encoding="utf-8")
    except Exception:
        bundle_texts[entry["filename"]] = ""

def _read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return None

tones_data = _read_json(BASE / "data" / "tones-db.json")
songs_db = _read_json(BASE / "data" / "songs-db.json")

BUNDLE.parent.mkdir(parents=True, exist_ok=True)
bundle_obj = {
    "count": len(manifest),
    "songs": manifest,
    "texts": bundle_texts,
    "tones": tones_data or {},
    "songsDB": songs_db or {},
}
bundle_js = (
    "/* Auto-generated by extract_pdfs.py — DO NOT EDIT */\n"
    "window.SONGS_BUNDLE = "
    + json.dumps(bundle_obj, ensure_ascii=False)
    + ";\n"
)
BUNDLE.write_text(bundle_js, encoding="utf-8")

print()
print("=>", len(manifest), "songs written to", str(DST))
print("=> manifest:", str(MANIFEST))
print("=> bundle:  ", str(BUNDLE))
if errors:
    print("=>", len(errors), "errors")
