#!/usr/bin/env python3
"""Scan the calculators/ folders and regenerate assets/data/dashboard-data.js.

Run this whenever a calculator folder is added or removed:
    python tools/generate_dashboard_data.py

Known calculator folders use the curated metadata below. Any new folder that
contains an index.html is still discovered automatically and placed in the
"Other engineering tools" category until it is given a category here.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# The site files live in frontend/ after the frontend/backend split.
ROOT = Path(__file__).resolve().parent.parent / "frontend"
CALCULATORS = ROOT / "calculators"
OUTPUT = ROOT / "assets" / "data" / "dashboard-data.js"

CATEGORIES = [
    {
        "id": "structural",
        "name": "Structural sections",
        "description": "Channels, beams, angles and T-sections",
        "icon": "i-channel",
        "tone": "teal",
    },
    {
        "id": "hollow",
        "name": "Hollow sections",
        "description": "Box and rectangular hollow profiles",
        "icon": "box-channel",
        "tone": "blue",
    },
    {
        "id": "bars",
        "name": "Solid bars & rods",
        "description": "Round, square, hexagonal and polygonal bar stock",
        "icon": "round-bar",
        "tone": "amber",
    },
    {
        "id": "profiles",
        "name": "Pipes & profiled bars",
        "description": "Pipes, tubes and bars with machined holes",
        "icon": "pipe",
        "tone": "violet",
    },
    {
        "id": "fasteners",
        "name": "Fasteners",
        "description": "Bolts, studs and nuts to ISO, DIN and ASME",
        "icon": "nut-bolt",
        "tone": "amber",
    },
    {
        "id": "plate",
        "name": "Plates & sheets",
        "description": "Plate, sheet and slab stock",
        "icon": "plate",
        "tone": "slate",
    },
    {
        "id": "sphere",
        "name": "Spheres & balls",
        "description": "Solid spherical components",
        "icon": "sphere",
        "tone": "rose",
    },
    {
        "id": "cone",
        "name": "Cones & reducers",
        "description": "Solid cones and fabricated conical reducers",
        "icon": "cone",
        "tone": "teal",
    },
    {
        "id": "heads",
        "name": "Vessel heads",
        "description": "Dished, ellipsoidal, hemispherical and conical dish ends",
        "icon": "dish-end",
        "tone": "blue",
    },
]

OTHER_CATEGORY = {
    "id": "other",
    "name": "Other engineering tools",
    "description": "Additional calculators and utilities",
    "icon": "calculator",
    "tone": "slate",
}

GENERIC_TAGS = [
    "weight",
    "calculator",
    "metal",
    "steel",
    "carbon steel",
    "stainless steel",
    "aluminium",
    "brass",
    "bronze",
    "copper",
    "cast iron",
    "custom density",
    "engineering",
    "fabrication",
]

# Curated display order for the home page and print view. The first twelve
# entries follow the standard profile-selection sequence, from plate through
# trapezoidal bar; the remaining tools follow in their logical grouping.
DISPLAY_ORDER = [
    "plate",
    "circular-plate",
    "flange-plate",
    "sphere-ball",
    "l-channel",
    "i-channel",
    "c-channel",
    "e-section",
    "t-channel",
    "pipe",
    "shell",
    "dish-end",
    "dish-ends",
    "torispherical-dish-end",
    "flanged-dished-dish-end",
    "hemispherical-dish-end",
    "elliptical-dish-end",
    "dish-end-development",
    "round-bar",
    "round-bar-with-hexagonal-hole",
    "trapezium-bar",
    "trapezoidal-bar",
    "box-channel",
    "hexagon-bar",
    "square-bar",
    "triangular-bar",
    "hexagonal-bar-with-round-hole",
    "solid-cone",
    "truncated-cone",
]

TOOL_META = {
    "box-channel": {
        "category": "hollow",
        "icon": "box-channel",
        "tags": ["box", "rectangular", "hollow", "section", "tube", "channel"],
    },
    "c-channel": {
        "category": "structural",
        "icon": "c-channel",
        "tags": ["c", "channel", "structural", "section", "beam"],
    },
    "e-section": {
        "category": "structural",
        "icon": "e-section",
        "tags": ["e", "section", "structural", "profile"],
    },
    "hexagon-bar": {
        "category": "bars",
        "icon": "hex-bar",
        "tags": ["hex", "hexagon", "hexagonal", "bar", "rod", "solid"],
    },
    "hexagonal-bar-with-round-hole": {
        "category": "profiles",
        "icon": "hex-hole",
        "tags": ["hex", "hexagon", "hexagonal", "round hole", "hollow", "bored", "bar"],
    },
    "i-channel": {
        "category": "structural",
        "icon": "i-channel",
        "tags": ["i", "i-beam", "ibeam", "beam", "channel", "structural"],
    },
    "l-channel": {
        "category": "structural",
        "icon": "l-channel",
        "tags": ["l", "angle", "angle iron", "channel", "structural"],
    },
    "pipe": {
        "category": "profiles",
        "icon": "pipe",
        "tags": ["pipe", "tube", "round", "hollow", "od", "wall thickness"],
    },
    "shell": {
        "category": "profiles",
        "icon": "shell",
        "tags": ["shell", "cylindrical shell", "cylinder", "hollow", "tube", "sleeve", "vessel", "od", "thickness"],
    },
    "dish-end": {
        "category": "heads",
        "icon": "dish-end",
        "tags": ["dish end", "dish head", "vessel head", "tank head", "torispherical", "torispherical head", "ellipsoidal", "ellipsoidal 2:1", "hemispherical", "conical head", "formed plate", "od", "depth", "crown radius", "knuckle radius", "pressure vessel", "fabrication"],
    },
    "dish-ends": {
        "category": "heads",
        "icon": "dish-end",
        "display_title": "Dish Ends Calculator",
        "display_name": "Dish Ends Calculator",
        "tags": ["dish ends calculator", "dish ends", "flat head", "torispherical head", "ellipsoidal head", "hemispherical head", "elliptical head template", "all types", "blank diameter", "development", "template", "divisions", "vessel head"],
    },
    "torispherical-dish-end": {
        "category": "heads",
        "icon": "dish-end",
        "tags": ["torispherical", "torispherical head", "dish end", "vessel head", "crown radius", "knuckle radius", "10% head", "blank diameter", "formed plate"],
    },
    "flanged-dished-dish-end": {
        "category": "heads",
        "icon": "dish-end",
        "tags": ["flanged and dished", "f&d head", "f and d", "knuckle radius", "dish end", "vessel head", "asme head", "crown radius"],
    },
    "hemispherical-dish-end": {
        "category": "heads",
        "icon": "dish-end",
        "tags": ["hemispherical", "hemispherical head", "hemi head", "half sphere", "dish end", "vessel head"],
    },
    "elliptical-dish-end": {
        "category": "heads",
        "icon": "dish-end",
        "tags": ["elliptical", "elliptical head", "2:1 head", "ellipsoidal", "dish end", "vessel head", "semi ellipsoid"],
    },
    "dish-end-development": {
        "category": "heads",
        "icon": "dish-end",
        "tags": ["dish end development", "development", "blank size", "flat pattern", "template", "mirror line", "divisions", "dish end", "vessel head"],
    },
    "circular-plate": {
        "category": "plate",
        "icon": "circular-plate",
        "tags": ["circular plate", "round plate", "disc", "disk", "circle", "plate", "sheet", "diameter", "thickness"],
    },
    "flange-plate": {
        "category": "plate",
        "icon": "flange-plate",
        "display_title": "Flange Plate Weight Calculator",
        "display_name": "Flange Plate Weight Calculator",
        "tags": ["flange", "flange plate", "bolt circle", "bolt holes", "pcd", "pitch circle", "bore", "pipe flange", "blind flange", "ring"],
    },
    "nut-bolt": {
        "category": "fasteners",
        "icon": "nut-bolt",
        "display_title": "Nut & Bolt Weight Calculator",
        "display_name": "Nut & Bolt Weight Calculator",
        "tags": ["nut", "bolt", "stud", "fastener", "hex bolt", "socket head cap screw", "countersunk screw", "carriage bolt", "threaded rod", "lock nut", "jam nut", "iso 4014", "iso 4017", "iso 4032", "iso 4762", "din 603", "asme b18.2.1", "thread stress area"],
    },
    "plate": {
        "category": "plate",
        "icon": "plate",
        "tags": ["plate", "sheet", "slab", "flat", "floor plate"],
    },
    "round-bar": {
        "category": "bars",
        "icon": "round-bar",
        "display_title": "Solid Round Bar Weight Calculator",
        "tags": ["round", "bar", "rod", "solid", "diameter"],
    },
    "round-bar-with-hexagonal-hole": {
        "category": "profiles",
        "icon": "round-hex-hole",
        "tags": ["round", "bar", "hexagonal hole", "hex hole", "hollow", "bored"],
    },
    "solid-cone": {
        "category": "cone",
        "icon": "cone",
        "tags": ["cone", "solid cone", "circular cone", "volume", "base diameter", "height", "solid"],
    },
    "sphere-ball": {
        "category": "sphere",
        "icon": "sphere",
        "tags": ["sphere", "ball", "round", "solid"],
    },
    "square-bar": {
        "category": "bars",
        "icon": "square-bar",
        "tags": ["square", "bar", "rod", "solid"],
    },
    "t-channel": {
        "category": "structural",
        "icon": "t-channel",
        "tags": ["t", "tee", "channel", "structural", "beam"],
    },
    "trapezium-bar": {
        "category": "bars",
        "icon": "trapezium",
        "tags": ["trapezium", "trapezoid", "bar", "profile", "solid"],
    },
    "trapezoidal-bar": {
        "category": "bars",
        "icon": "trapezoidal",
        "tags": ["trapezoidal", "trapezoid", "bar", "profile", "solid"],
    },
    "triangular-bar": {
        "category": "bars",
        "icon": "triangular",
        "tags": ["triangle", "triangular", "bar", "profile", "solid"],
    },
    "truncated-cone": {
        "category": "cone",
        "icon": "truncated-cone",
        "tags": ["truncated cone", "conical reducer", "frustum", "cone", "reducer", "hollow", "plate", "thickness", "slant height", "fabrication"],
    },
}


def clean_text(value: str) -> str:
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.replace("&amp;", "&").strip()


def read_page(folder: Path) -> tuple[str, str]:
    html = (folder / "index.html").read_text(encoding="utf-8")
    title_match = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
    desc_match = re.search(
        r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']',
        html,
        re.S | re.I,
    )
    title = clean_text(title_match.group(1)) if title_match else folder.name.title()
    description = clean_text(desc_match.group(1)) if desc_match else ""
    return title, description


def build_data() -> dict:
    tools = []
    extra_categories = []
    for folder in sorted(CALCULATORS.iterdir(), key=lambda item: item.name.lower()):
        if not folder.is_dir() or not (folder / "index.html").is_file():
            continue

        title, description = read_page(folder)
        meta = TOOL_META.get(folder.name, {})
        title = meta.get("display_title", title)
        category = meta.get("category", "other")
        if category == "other" and not any(c["id"] == "other" for c in extra_categories):
            extra_categories.append(OTHER_CATEGORY)

        name = meta.get(
            "display_name",
            re.sub(r"\s+Weight Calculator\s*$", "", title, flags=re.I).strip(),
        )
        tags = list(dict.fromkeys(GENERIC_TAGS + meta.get("tags", [])))
        tools.append(
            {
                "id": re.sub(r"[^a-z0-9]+", "-", folder.name.lower()).strip("-"),
                "name": name,
                "title": title,
                "description": description or f"Open the {title}.",
                "category": category,
                "icon": meta.get("icon", "calculator"),
                "path": f"calculators/{folder.name}/index.html",
                "tags": tags,
            }
        )

    category_ids = {category["id"] for category in CATEGORIES}
    categories = [category for category in CATEGORIES]
    categories.extend(extra_categories)
    order = {category["id"]: index for index, category in enumerate(categories)}
    display_order = {folder: index for index, folder in enumerate(DISPLAY_ORDER)}

    def tool_sort_key(tool: dict) -> tuple:
        folder = Path(tool["path"]).parent.name
        if folder in display_order:
            return (0, display_order[folder], tool["name"].lower())
        return (1, order.get(tool["category"], 999), tool["name"].lower())

    tools.sort(key=tool_sort_key)

    return {
        "categories": categories,
        "tools": tools,
        "meta": {
            "materialPresets": 7,
            "unitSystems": 2,
        },
    }


def main() -> None:
    data = build_data()
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    payload = payload.replace("</", "<\\/")
    OUTPUT.write_text(
        "/* Generated by tools/generate_dashboard_data.py.\n"
        "   Re-run that script after adding or removing a calculator folder. */\n"
        f"window.ENGINEERING_DASHBOARD = {payload};\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT.name}: {len(data['tools'])} calculators, {len(data['categories'])} categories")


if __name__ == "__main__":
    main()
