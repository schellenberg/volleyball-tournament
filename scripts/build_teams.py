#!/usr/bin/env python3
"""Sync teams/<slug>.md and teams/<slug>.(jpg|jpeg|png|webp) into data/tournament.json.

<slug> is the team id (e.g. aces) or the slugified team name (e.g. cvvc-aces).
Markdown format:
    Coach: Jane Doe, John Smith
    # or "Coaches:"
    - 7, Alex Smith, OH        (number, name, position; "|" also works)
Teams without a file are left unchanged.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEAMS_DIR = ROOT / "teams"
JSON_PATH = ROOT / "data" / "tournament.json"
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse(text):
    coach, roster = "", []
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"^(?:[-*]\s*)?\**coach(?:es)?\**\s*:\**\s*(.*)$", line, re.I)
        if m:
            coach = m.group(1).strip()
            continue
        m = re.match(r"^(?:[-*+]|\d+\.)?\s*(.+)$", line)
        if not line.startswith(("-", "*", "+")) or not m:
            continue
        parts = [p.strip() for p in re.split(r"\s*[|,]\s*", line.lstrip("-*+ ").strip())]
        if len(parts) < 2:
            continue
        num, name = parts[0], parts[1]
        pos = parts[2] if len(parts) > 2 else ""
        if not re.fullmatch(r"\d+", num):  # allow "Name, #, pos" no; require number first
            continue
        roster.append({"number": int(num), "name": name, "position": pos})
    return coach, roster


def main():
    data = json.loads(JSON_PATH.read_text())
    for t in data["teams"]:
        keys = {slug(t["id"]), slug(t["name"])}
        md = next((TEAMS_DIR / (k + ".md") for k in keys if (TEAMS_DIR / (k + ".md")).exists()), None)
        if md:
            t["coach"], t["roster"] = parse(md.read_text())
            print(f"{t['name']}: {len(t['roster'])} players from {md.name}")
        for k in sorted(keys):
            img = next((TEAMS_DIR / (k + e) for e in IMG_EXT if (TEAMS_DIR / (k + e)).exists()), None)
            if img:
                t["photo"] = f"teams/{img.name}"
                print(f"{t['name']}: photo {img.name}")
                break
    JSON_PATH.write_text(json.dumps(data, indent=2) + "\n")


if __name__ == "__main__":
    sys.exit(main())
