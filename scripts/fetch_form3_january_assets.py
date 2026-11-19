"""Fetch user-shared teaching PDF and audio materials for GitHub Pages.

These Google Drive files have been shared by the owner as anyone-with-link readers.
Downloads are verified against expected file sizes so broken HTML/Drive
confirmation pages never get published as PDF or audio.
"""
from pathlib import Path
import os
import time

import gdown

ASSETS = (
    (
        "1N10lvS3abuebqILCs6ufVS_61hQh16ym",
        Path("dist/assets/materials/f3-bi-units1-2-complete.pdf"),
        37_522_640,
        b"%PDF-",
    ),
    (
        "1sUAA4PnQCwH0MkWGamt6lPt_jp4I4wMU",
        Path("dist/assets/materials/f3-bi-units1-2-listening.mp3"),
        19_446_380,
        None,
    ),
    (
        "1m4wvtzLJEy0cCfDbEdkMsuQ9B8YUO4D8",
        Path("dist/assets/materials/f3-bi-september-2026-no-cover.pdf"),
        126_270,
        b"%PDF-",
    ),
    (
        "18cKJJsgJUFnoe0XPSVEKZfn4jhR5gZ7B",
        Path("dist/assets/materials/f2-bm-novel-2027.pdf"),
        55_446_969,
        b"%PDF-",
    ),
)

for drive_id, destination, expected_size, signature in ASSETS:
    destination.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, 4):
        try:
            print(f"Downloading {destination.name} (attempt {attempt})", flush=True)
            downloaded = gdown.download(id=drive_id, output=str(destination), quiet=True)
            if not downloaded or not destination.is_file():
                raise RuntimeError("The Drive download returned no file")
            actual = destination.stat().st_size
            if actual != expected_size:
                raise RuntimeError(f"Unexpected file size: {actual} vs {expected_size}")
            if signature and destination.open("rb").read(len(signature)) != signature:
                raise RuntimeError("PDF header mismatch")
            print(f"Verified {destination}: {actual:,} bytes", flush=True)
            break
        except Exception as exc:
            print(f"Download check failed: {exc}", flush=True)
            destination.unlink(missing_ok=True)
            if attempt == 3:
                raise
            time.sleep(attempt * 2)
