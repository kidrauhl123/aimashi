#!/usr/bin/env python3
"""User-facing pet package helper for Alkaka desktop pets."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("error: Pillow not installed. Run: pip3 install --user Pillow\n")
    sys.exit(1)

ATLAS_SIZE = (1536, 1872)
CELL_W, CELL_H = 192, 208
ROW_FRAME_COUNTS = {
    "idle": (0, 6),
    "waving": (3, 4),
    "jumping": (4, 5),
    "failed": (5, 8),
    "waiting": (6, 6),
    "review": (8, 6),
}
BUILTIN_DESCRIPTIONS = {
    "codex": "The original Codex companion.",
    "dewey": "A tidy duck for calm workspace days.",
    "fireball": "Hot path energy for fast iteration.",
    "rocky": "A steady rock when the diff gets large.",
    "seedy": "Small green shoots for new ideas.",
    "stacky": "A balanced stack for deep work.",
    "bsod": "A tiny blue-screen helper.",
    "null-signal": "Quiet signal from the void.",
}


@dataclass
class ValidationResult:
    ok: bool
    pet_dir: Path
    manifest: dict[str, object]
    errors: list[str]
    warnings: list[str]
    package_type: str = "unknown"


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-")


def display_name(value: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"[^a-zA-Z0-9]+", value) if part)


def codex_home() -> Path:
    return Path(os.environ.get("CODEX_HOME") or "~/.codex").expanduser().resolve()


def alkaka_pets_root() -> Path:
    return Path("~/.alkaka/pets").expanduser().resolve()


def target_root(name: str) -> Path:
    if name == "alkaka":
        return alkaka_pets_root()
    if name == "codex":
        return codex_home() / "pets"
    raise SystemExit(f"unknown target: {name}")


def find_codex_app(raw: str | None = None) -> Path:
    candidates = []
    if raw:
        candidates.append(Path(raw).expanduser())
    candidates.extend([Path("/Applications/Codex.app"), Path.home() / "Applications" / "Codex.app"])
    for candidate in candidates:
        if candidate.is_dir():
            return candidate
    raise SystemExit("Codex.app not found in /Applications or ~/Applications")


def load_manifest(pet_dir: Path) -> dict[str, object]:
    manifest_path = pet_dir / "pet.json"
    if not manifest_path.is_file():
        raise ValueError("pet.json missing")
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("pet.json must contain an object")
    return data


def manifest_sheet_path(pet_dir: Path, manifest: dict[str, object]) -> Path:
    raw = manifest.get("spritesheetPath")
    if not isinstance(raw, str) or not raw:
        raise ValueError("spritesheetPath missing")
    path = Path(raw)
    if path.is_absolute():
        raise ValueError("spritesheetPath must be relative")
    return pet_dir / path


def alpha_nonzero_count(image: Image.Image) -> int:
    return sum(image.getchannel("A").histogram()[1:])


def validate_atlas(path: Path, *, strict_cells: bool = True) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        with Image.open(path) as opened:
            source_format = opened.format
            image = opened.convert("RGBA")
    except Exception as exc:  # noqa: BLE001
        return [f"could not open spritesheet: {exc}"], warnings

    if image.size != ATLAS_SIZE:
        errors.append(f"expected {ATLAS_SIZE[0]}x{ATLAS_SIZE[1]}, got {image.width}x{image.height}")
    if source_format not in {"PNG", "WEBP"}:
        errors.append(f"expected PNG or WebP, got {source_format}")
    if not strict_cells or image.size != ATLAS_SIZE:
        return errors, warnings

    for state, (row, used_count) in ROW_FRAME_COUNTS.items():
        for col in range(8):
            cell = image.crop((col * CELL_W, row * CELL_H, (col + 1) * CELL_W, (row + 1) * CELL_H))
            count = alpha_nonzero_count(cell)
            if col < used_count and count < 50:
                errors.append(f"{state} row {row} col {col} is empty or too sparse")
            if col >= used_count and count != 0:
                errors.append(f"{state} row {row} unused col {col} is not transparent")
    return errors, warnings


def validate_package(pet_dir: Path, *, strict_cells: bool = True) -> ValidationResult:
    errors: list[str] = []
    warnings: list[str] = []
    manifest: dict[str, object] = {}
    try:
        manifest = load_manifest(pet_dir)
    except Exception as exc:  # noqa: BLE001
        return ValidationResult(False, pet_dir, manifest, [str(exc)], warnings)

    for key in ("id", "displayName"):
        if not isinstance(manifest.get(key), str) or not manifest.get(key):
            errors.append(f"{key} missing")

    if isinstance(manifest.get("spritesheetPath"), str) and manifest.get("spritesheetPath"):
        try:
            sheet = manifest_sheet_path(pet_dir, manifest)
            if not sheet.is_file():
                errors.append(f"spritesheet not found: {sheet}")
            else:
                atlas_errors, atlas_warnings = validate_atlas(sheet, strict_cells=strict_cells)
                errors.extend(atlas_errors)
                warnings.extend(atlas_warnings)
        except ValueError as exc:
            errors.append(str(exc))
        return ValidationResult(not errors, pet_dir, manifest, errors, warnings, "atlas")

    if isinstance(manifest.get("characterName"), str) and manifest.get("characterName"):
        character = str(manifest["characterName"])
        for rel in ("conf/actions.xml", "conf/behaviors.xml"):
            if not (pet_dir / rel).is_file():
                errors.append(f"{rel} missing")
        if not (pet_dir / "img" / character).is_dir():
            errors.append(f"img/{character} missing")
        return ValidationResult(not errors, pet_dir, manifest, errors, warnings, "legacy-xml")

    errors.append("spritesheetPath or characterName missing")
    return ValidationResult(False, pet_dir, manifest, errors, warnings)


def write_package(
    *,
    source_sheet: Path,
    target_dir: Path,
    pet_id: str,
    name: str,
    description: str,
    force: bool,
) -> None:
    errors, warnings = validate_atlas(source_sheet)
    if warnings:
        for warning in warnings:
            print(f"warning: {warning}", file=sys.stderr)
    if errors:
        raise SystemExit("invalid spritesheet:\n" + "\n".join(f"- {error}" for error in errors))
    if target_dir.exists() and any(target_dir.iterdir()) and not force:
        raise SystemExit(f"{target_dir} already exists; pass --force to overwrite")
    target_dir.mkdir(parents=True, exist_ok=True)
    # Electron/Codex can display WebP directly, but the standalone Qt dev app
    # may not bundle a WebP image plugin. Store Alkaka-installed packages as
    # PNG so the runtime path works out of the box.
    target_sheet = target_dir / "spritesheet.png"
    with Image.open(source_sheet) as image:
        image.convert("RGBA").save(target_sheet, "PNG")
    manifest = {
        "id": pet_id,
        "displayName": name,
        "description": description,
        "spritesheetPath": target_sheet.name,
    }
    (target_dir / "pet.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def command_list(args: argparse.Namespace) -> int:
    rows = []
    for source_name, root in [("alkaka", alkaka_pets_root()), ("codex", codex_home() / "pets")]:
        if not root.is_dir():
            continue
        for pet_dir in sorted(p for p in root.iterdir() if p.is_dir()):
            result = validate_package(pet_dir, strict_cells=False)
            rows.append({
                "source": source_name,
                "id": result.manifest.get("id", pet_dir.name),
                "displayName": result.manifest.get("displayName", pet_dir.name),
                "path": str(pet_dir),
                "ok": result.ok,
                "type": result.package_type,
                "errors": result.errors,
            })
    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        if not rows:
            print("No pets installed. Run: python3 pet-app/petctl.py extract-builtins")
        for row in rows:
            status = "ok" if row["ok"] else "invalid"
            print(f"{row['id']}\t{row['source']}\t{row['type']}\t{status}\t{row['path']}")
    return 0


def resolve_pet_arg(value: str) -> Path:
    raw = Path(value).expanduser()
    if raw.exists():
        return raw.resolve()
    for root in [alkaka_pets_root(), codex_home() / "pets"]:
        candidate = root / value
        if candidate.exists():
            return candidate.resolve()
    raise SystemExit(f"pet not found: {value}")


def command_validate(args: argparse.Namespace) -> int:
    pet_dir = resolve_pet_arg(args.pet)
    result = validate_package(pet_dir, strict_cells=not args.fast)
    payload = {
        "ok": result.ok,
        "path": str(result.pet_dir),
        "id": result.manifest.get("id"),
        "displayName": result.manifest.get("displayName"),
        "type": result.package_type,
        "errors": result.errors,
        "warnings": result.warnings,
    }
    print(json.dumps(payload, indent=2) if args.json else human_validation(payload))
    return 0 if result.ok else 1


def human_validation(payload: dict[str, object]) -> str:
    lines = [f"{'OK' if payload['ok'] else 'INVALID'}: {payload['path']}"]
    for error in payload["errors"]:
        lines.append(f"error: {error}")
    for warning in payload["warnings"]:
        lines.append(f"warning: {warning}")
    return "\n".join(lines)


def install_from_package(source_dir: Path, args: argparse.Namespace) -> Path:
    result = validate_package(source_dir, strict_cells=True)
    if not result.ok:
        raise SystemExit("invalid package:\n" + "\n".join(f"- {error}" for error in result.errors))
    source_sheet = manifest_sheet_path(source_dir, result.manifest)
    pet_id = slugify(args.id or str(result.manifest.get("id", source_dir.name)))
    if not pet_id:
        raise SystemExit("pet id is empty")
    name = args.name or str(result.manifest.get("displayName", display_name(pet_id)))
    description = args.description or str(result.manifest.get("description", f"{name} custom pet."))
    target_dir = target_root(args.target) / pet_id
    write_package(
        source_sheet=source_sheet,
        target_dir=target_dir,
        pet_id=pet_id,
        name=name,
        description=description,
        force=args.force,
    )
    return target_dir


def install_from_sheet(source_sheet: Path, args: argparse.Namespace) -> Path:
    pet_id = slugify(args.id or source_sheet.stem)
    if not pet_id:
        raise SystemExit("pet id is empty")
    name = args.name or display_name(pet_id)
    description = args.description or f"{name} custom pet."
    target_dir = target_root(args.target) / pet_id
    write_package(
        source_sheet=source_sheet,
        target_dir=target_dir,
        pet_id=pet_id,
        name=name,
        description=description,
        force=args.force,
    )
    return target_dir


def command_install(args: argparse.Namespace) -> int:
    source = Path(args.source).expanduser().resolve()
    if source.is_dir():
        target_dir = install_from_package(source, args)
    elif source.is_file():
        target_dir = install_from_sheet(source, args)
    else:
        raise SystemExit(f"source not found: {source}")
    print(f"Installed: {target_dir}")
    print(f"Run: ./build/pet-app/alkaka-pet.app/Contents/MacOS/alkaka-pet --pet {target_dir.name}")
    return 0


def extract_asar(app: Path, out_dir: Path) -> None:
    asar = app / "Contents" / "Resources" / "app.asar"
    if not asar.is_file():
        raise SystemExit(f"app.asar missing: {asar}")
    subprocess.run(
        ["npx", "--yes", "@electron/asar", "extract", str(asar), str(out_dir)],
        check=True,
    )


def command_extract_builtins(args: argparse.Namespace) -> int:
    app = find_codex_app(args.app)
    root = target_root(args.target)
    with tempfile.TemporaryDirectory(prefix="alkaka-pet-asar-") as tmp:
        out_dir = Path(tmp) / "asar"
        extract_asar(app, out_dir)
        assets = out_dir / "webview" / "assets"
        sheets = sorted(assets.glob("*-spritesheet-v4-*.webp"))
        if not sheets:
            raise SystemExit("no Codex spritesheets found in app.asar")
        for sheet in sheets:
            name = sheet.name.split("-spritesheet-v4-")[0]
            pet_id = f"codex-{name}"
            target_dir = root / pet_id
            write_package(
                source_sheet=sheet,
                target_dir=target_dir,
                pet_id=pet_id,
                name=display_name(name),
                description=BUILTIN_DESCRIPTIONS.get(name, f"Codex {display_name(name)} companion."),
                force=args.force,
            )
            print(f"Installed: {target_dir}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    list_p = sub.add_parser("list", help="List installed atlas pet packages.")
    list_p.add_argument("--json", action="store_true")
    list_p.set_defaults(func=command_list)

    validate_p = sub.add_parser("validate", help="Validate an installed pet id or package path.")
    validate_p.add_argument("pet")
    validate_p.add_argument("--fast", action="store_true", help="Skip per-cell transparency checks.")
    validate_p.add_argument("--json", action="store_true")
    validate_p.set_defaults(func=command_validate)

    install_p = sub.add_parser("install", help="Install a Hatch Pet package dir or atlas image.")
    install_p.add_argument("source")
    install_p.add_argument("--target", choices=["alkaka", "codex"], default="alkaka")
    install_p.add_argument("--id", default="")
    install_p.add_argument("--name", default="")
    install_p.add_argument("--description", default="")
    install_p.add_argument("--force", action="store_true")
    install_p.set_defaults(func=command_install)

    builtins_p = sub.add_parser("extract-builtins", help="Install Codex.app built-in pets as atlas packages.")
    builtins_p.add_argument("--target", choices=["alkaka", "codex"], default="alkaka")
    builtins_p.add_argument("--app", default="")
    builtins_p.add_argument("--force", action="store_true")
    builtins_p.set_defaults(func=command_extract_builtins)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
