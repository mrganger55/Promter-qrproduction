# -*- coding: utf-8 -*-
"""
QR Production Prompter — Build script

Commands:
  python build.py                Rebuild bundle + manifest from current TXT files (SAFE)
  python build.py migrate        Upgrade existing song TXT files to new format (one-time)
  python build.py from-pdf       Re-extract from PDFs (DESTRUCTIVE — asks for confirmation)

Design:
- Song TXT files in "Şarkılar TXT/" are the single source of truth.
- Setlist TXT files in "EBD Setlist/" describe workspace structure.
- Bundle (js/songs-bundle.js) is auto-generated; do not edit.
- Manifest (data/songs-manifest.json) is auto-generated; do not edit.
"""
import sys
import os
import json
import re
import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BASE = Path(__file__).resolve().parent
SONGS_TXT_DIR = BASE / "Şarkılar TXT"
SETLIST_DIR = BASE / "EBD Setlist"
PDF_DIR = BASE / "Şarkılar ve sözler"
MANIFEST_PATH = BASE / "data" / "songs-manifest.json"
BUNDLE_PATH = BASE / "js" / "songs-bundle.js"
TONES_PATH = BASE / "data" / "tones-db.json"

# ============================================================
#  Turkish locale helpers
# ============================================================
def tr_upper(s):
    """Turkish-aware uppercase: i→İ, ı→I, rest is generic upper."""
    if not s:
        return s
    return s.replace("i", "İ").replace("ı", "I").upper()

def tr_lower(s):
    if not s:
        return s
    return s.replace("I", "ı").replace("İ", "i").lower()

TR_ASCII = str.maketrans({
    "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
    "Ç": "c", "Ğ": "g", "I": "i", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
    "â": "a", "î": "i", "û": "u", "Â": "a", "Î": "i", "Û": "u",
})

def slugify(s):
    """Turkish title → lowercase ASCII with underscores. '14 BAHAR' → '14_bahar'"""
    s = (s or "").strip()
    s = s.translate(TR_ASCII).lower()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_\-]", "", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "untitled"

def canon(s):
    """Canonical form for title matching (uppercase, strip punct/spaces collapsed)."""
    s = tr_upper(s or "")
    s = re.sub(r"['’\"`\-\.\,\+]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ============================================================
#  Tones DB
# ============================================================
def load_tones():
    try:
        return json.loads(TONES_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}

def find_tone(title, tones):
    c = canon(title)
    for k, v in tones.items():
        if canon(k) == c:
            return v
    # Partial
    for k, v in tones.items():
        if canon(k) in c or c in canon(k):
            return v
    return ""

# ============================================================
#  Song TXT parsing / formatting
# ============================================================
PAGE_BREAK = "---"
SECTION_RE = re.compile(r"^\[(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|SOLO|BREAK|NOTE)\]$", re.IGNORECASE)
PAGEBREAK_RE = re.compile(r"^(?:-{3,}|={3,}|\[PAGE\])$", re.IGNORECASE)

def parse_song_txt(text):
    """Parse a song TXT into {title, key, pages: [[lines...], ...]}"""
    raw_lines = [ln.rstrip() for ln in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    # Strip leading blanks
    while raw_lines and not raw_lines[0].strip():
        raw_lines.pop(0)
    while raw_lines and not raw_lines[-1].strip():
        raw_lines.pop()
    if not raw_lines:
        return {"title": "", "key": "", "pages": [[]]}
    title = raw_lines[0].strip()
    idx = 1
    # Skip blanks after title
    while idx < len(raw_lines) and not raw_lines[idx].strip():
        idx += 1
    key = ""
    if idx < len(raw_lines) and raw_lines[idx].strip().upper().startswith("KEY:"):
        key = raw_lines[idx].split(":", 1)[1].strip()
        idx += 1
        while idx < len(raw_lines) and not raw_lines[idx].strip():
            idx += 1
    # Remaining = body
    body_lines = raw_lines[idx:]
    # Split into pages on --- / === / [PAGE]
    pages = [[]]
    for ln in body_lines:
        if PAGEBREAK_RE.match(ln.strip()):
            pages.append([])
        else:
            pages[-1].append(ln)
    # Trim blank leading/trailing lines in each page
    cleaned = []
    for p in pages:
        while p and not p[0].strip():
            p.pop(0)
        while p and not p[-1].strip():
            p.pop()
        if p:
            cleaned.append(p)
    if not cleaned:
        cleaned = [[]]
    return {"title": title, "key": key, "pages": cleaned}

def format_song_txt(parsed):
    """Format {title, key, pages} back to canonical TXT. Uppercase everything (Turkish-aware)."""
    out = []
    out.append(tr_upper(parsed["title"].strip()))
    out.append("")  # blank after title
    if parsed.get("key"):
        out.append("KEY: " + tr_upper(parsed["key"].strip()))
        out.append("")
    for i, page in enumerate(parsed["pages"]):
        for ln in page:
            if not ln.strip():
                out.append("")
            else:
                out.append(tr_upper(ln.rstrip()))
        if i < len(parsed["pages"]) - 1:
            out.append("")
            out.append(PAGE_BREAK)
            out.append("")
    # Collapse 3+ consecutive blank lines to 2
    text = "\n".join(out)
    text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
    return text

# ============================================================
#  Setlist TXT parsing
# ============================================================
def parse_setlist_txt(text, filename):
    """Parse a setlist TXT into {name, artist, items[]}.

    Format:
      # Workspace Name
      ARTIST: Sanatçı Adı      (optional)
      <blank>
      SONG TITLE | KEY | NOTE  (pipes optional for key/note)
      TALK: Konuşma başlığı    (or just TALK: )
      BREAK: Ara başlığı       (or just BREAK: )
      # Section Header         (additional # lines after line 1 = section separators, type=section)
    """
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    name = filename
    artist = ""
    items = []
    name_set = False
    for raw in lines:
        ln = raw.strip()
        if not ln:
            continue
        if ln.startswith("#"):
            title = ln.lstrip("#").strip()
            if not name_set:
                name = title or filename
                name_set = True
            else:
                # Section separator inside setlist
                items.append({"type": "section", "title": tr_upper(title), "key": "", "text": "", "note": ""})
            continue
        if ln.upper().startswith("ARTIST:"):
            artist = ln.split(":", 1)[1].strip()
            continue
        if ln.upper().startswith("TALK:"):
            t = ln.split(":", 1)[1].strip()
            items.append({"type": "talk", "title": tr_upper(t) if t else "KONUŞMA", "key": "", "text": "", "note": ""})
            continue
        if ln.upper().startswith("BREAK:"):
            t = ln.split(":", 1)[1].strip()
            items.append({"type": "break", "title": tr_upper(t) if t else "ARA", "key": "", "text": "", "note": ""})
            continue
        # Regular song line — split on |
        parts = [p.strip() for p in ln.split("|")]
        title = parts[0] if len(parts) > 0 else ""
        key = parts[1] if len(parts) > 1 else ""
        note = parts[2] if len(parts) > 2 else ""
        if not title:
            continue
        items.append({
            "type": "song",
            "title": tr_upper(title),
            "key": tr_upper(key) if key else "",
            "text": "",
            "note": tr_upper(note) if note else "",
        })
    return {"name": name, "artist": artist, "items": items, "filename": filename}

# ============================================================
#  File operations (case-safe rename on Windows)
# ============================================================
def safe_rename(src, dst):
    """Rename src → dst. Handles Windows case-insensitive filesystem (uses os.rename, two-step for case-only)."""
    if src == dst:
        return
    if src.parent == dst.parent and src.name.lower() == dst.name.lower() and src.name != dst.name:
        tmp = src.with_name(src.name + ".renametmp")
        os.rename(str(src), str(tmp))
        os.rename(str(tmp), str(dst))
    else:
        os.rename(str(src), str(dst))

# ============================================================
#  PDF extraction (legacy, opt-in)
# ============================================================
def pdf_to_text(pdf_path):
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        try:
            import PyPDF2
            PdfReader = PyPDF2.PdfReader
        except ImportError:
            print("ERROR: PyPDF2 not installed. Run: pip install PyPDF2")
            sys.exit(1)
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

def clean_pdf_text(raw):
    if not raw:
        return ""
    raw = raw.replace("�", "")
    raw = raw.replace("﻿", "")
    fixes = {"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl"}
    for k, v in fixes.items():
        raw = raw.replace(k, v)
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    raw = raw.replace(" ", "\n").replace(" ", "\n")
    raw = raw.replace("\v", "\n").replace("\f", "\n")
    raw = raw.replace(" ", " ").replace(" ", " ").replace(" ", " ")
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

# ============================================================
#  Commands
# ============================================================
def cmd_migrate():
    """Upgrade every TXT in Şarkılar TXT/ to the new format. Idempotent."""
    if not SONGS_TXT_DIR.exists():
        print("ERROR: not found:", SONGS_TXT_DIR)
        return 1
    tones = load_tones()
    changed = 0
    renamed = 0
    skipped = 0
    for txt in sorted(SONGS_TXT_DIR.glob("*.txt")):
        try:
            raw = txt.read_text(encoding="utf-8")
        except Exception as e:
            print("  ERR   read:", txt.name, e)
            continue
        parsed = parse_song_txt(raw)
        if not parsed["title"]:
            print("  SKIP  no title:", txt.name)
            skipped += 1
            continue
        # Inject tone from DB if missing
        if not parsed["key"]:
            parsed["key"] = find_tone(parsed["title"], tones)
        new_text = format_song_txt(parsed)
        new_name = slugify(parsed["title"]) + ".txt"
        new_path = SONGS_TXT_DIR / new_name

        if new_path != txt and new_path.exists() and new_path.resolve() != txt.resolve():
            print(f"  WARN  name collision: {txt.name} → {new_name} (already exists, leaving {txt.name} as-is)")
            continue

        content_differs = new_text != raw
        name_differs = new_path.name != txt.name

        if not content_differs and not name_differs:
            skipped += 1
            continue

        if content_differs:
            txt.write_text(new_text, encoding="utf-8")
            changed += 1
            print(f"  UPD   {txt.name}")
        if name_differs:
            safe_rename(txt, new_path)
            renamed += 1
            print(f"  MV    {txt.name} → {new_name}")

    print()
    print(f"=> changed: {changed}, renamed: {renamed}, unchanged: {skipped}")
    return 0

def cmd_build_bundle():
    """Read current TXT files, write manifest + bundle. Never modifies TXT files."""
    tones = load_tones()
    manifest = []
    bundle_texts = {}

    if not SONGS_TXT_DIR.exists():
        print("ERROR: not found:", SONGS_TXT_DIR)
        return 1

    for txt in sorted(SONGS_TXT_DIR.glob("*.txt")):
        try:
            content = txt.read_text(encoding="utf-8")
        except Exception as e:
            print("  ERR  ", txt.name, e)
            continue
        parsed = parse_song_txt(content)
        title = parsed["title"] or txt.stem
        key = parsed["key"] or find_tone(title, tones)
        line_count = sum(1 for l in content.split("\n") if l.strip())
        manifest.append({
            "title": title,
            "filename": txt.name,
            "key": key,
            "lines": line_count,
            "chars": len(content),
            "pageCount": len(parsed["pages"]),
        })
        bundle_texts[txt.name] = content

    manifest.sort(key=lambda x: x["title"].lower())

    # Parse setlists
    setlists = []
    if SETLIST_DIR.exists():
        for sl in sorted(SETLIST_DIR.glob("*.txt")):
            try:
                raw = sl.read_text(encoding="utf-8")
            except Exception as e:
                print("  ERR  setlist", sl.name, e)
                continue
            parsed = parse_setlist_txt(raw, sl.name)
            setlists.append(parsed)

    # Write manifest
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(
            {"count": len(manifest), "songs": manifest, "errors": []},
            ensure_ascii=False, indent=2
        ),
        encoding="utf-8"
    )

    # Write bundle
    build_time = datetime.datetime.now().isoformat(timespec="seconds")
    bundle = {
        "buildTime": build_time,
        "count": len(manifest),
        "songs": manifest,
        "texts": bundle_texts,
        "tones": tones,
        "setlists": setlists,
    }
    BUNDLE_PATH.parent.mkdir(parents=True, exist_ok=True)
    BUNDLE_PATH.write_text(
        "/* Auto-generated by build.py — DO NOT EDIT */\n"
        "window.SONGS_BUNDLE = "
        + json.dumps(bundle, ensure_ascii=False)
        + ";\n",
        encoding="utf-8"
    )
    print(f"=> {len(manifest)} songs, {len(setlists)} setlists")
    print(f"=> manifest: {MANIFEST_PATH.relative_to(BASE)}")
    print(f"=> bundle:   {BUNDLE_PATH.relative_to(BASE)} (buildTime={build_time})")
    return 0

SKIP_PDF_PATTERNS = ("setlist", "yedek")

def cmd_from_pdf(force=False):
    """Re-extract all PDFs to TXT — DESTRUCTIVE, asks for confirmation."""
    if not PDF_DIR.exists():
        print("ERROR: not found:", PDF_DIR)
        return 1
    pdfs = sorted([
        p for p in PDF_DIR.iterdir()
        if p.suffix.lower() == ".pdf"
        and not any(k in p.name.lower() for k in SKIP_PDF_PATTERNS)
    ])
    print(f"Found {len(pdfs)} PDF files under {PDF_DIR}")

    # Build list of TXT files that would be overwritten
    SONGS_TXT_DIR.mkdir(parents=True, exist_ok=True)
    would_overwrite = []
    for pdf in pdfs:
        title = pdf.stem.strip()
        slug = slugify(title)
        out = SONGS_TXT_DIR / (slug + ".txt")
        if out.exists():
            would_overwrite.append(out.name)

    if would_overwrite and not force:
        print()
        print(f"⚠  {len(would_overwrite)} existing TXT files will be OVERWRITTEN:")
        for n in would_overwrite[:10]:
            print("   ", n)
        if len(would_overwrite) > 10:
            print(f"   ... and {len(would_overwrite) - 10} more")
        print()
        ans = input("Overwrite? Any manual --- edits will be LOST. Type 'YES' to proceed: ").strip()
        if ans != "YES":
            print("Cancelled.")
            return 1

    tones = load_tones()
    for pdf in pdfs:
        title = pdf.stem.strip()
        slug = slugify(title)
        out = SONGS_TXT_DIR / (slug + ".txt")
        try:
            raw = pdf_to_text(pdf)
            cleaned = clean_pdf_text(raw)
            # Build canonical format
            body_lines = [ln for ln in cleaned.split("\n")]
            parsed = {
                "title": title,
                "key": find_tone(title, tones),
                "pages": [body_lines],
            }
            out.write_text(format_song_txt(parsed), encoding="utf-8")
            line_count = sum(1 for l in cleaned.split("\n") if l.strip())
            print(f"  OK   {pdf.name} → {out.name} ({line_count} lines)")
        except Exception as e:
            print(f"  ERR  {pdf.name}: {e}")

    # Rebuild bundle after extract
    print()
    cmd_build_bundle()
    return 0

# ============================================================
#  Main
# ============================================================
def main():
    args = sys.argv[1:]
    if not args or args[0] == "build" or args[0] == "bundle":
        return cmd_build_bundle()
    cmd = args[0]
    if cmd == "migrate":
        return cmd_migrate()
    if cmd == "from-pdf":
        force = "--force" in args
        return cmd_from_pdf(force=force)
    if cmd in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    print("Unknown command:", cmd)
    print("Run: python build.py help")
    return 1

if __name__ == "__main__":
    sys.exit(main())
