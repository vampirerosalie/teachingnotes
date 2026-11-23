"""Download and verify Year 6 English January–October 2027 PDFs for Pages.

Source: owner-shared Drive folder 1g-Nu_DJAKkKaKIgzFsD0e5hnzXHbRRpd.
These current Drive originals replace older January and February assets in the
deployment and provide the additional eight monthly units.
"""
import hashlib
import time
from pathlib import Path
import gdown

ASSETS = (
    (1, "1pBSxjuMaPfpBt98ymglETcUzdAF8beR8", "year6-english-2027-welcome-unit1.pdf", 17_062_928),
    (2, "1ppXYWG1r3PmyIVg9f321IgMnjVvmcldU", "year6-english-2027-unit2.pdf", 11_245_207),
    (3, "1gKIRY7ity0ECXpYboNj1GGT3yZ0nSW7Y", "year6-english-2027-unit3.pdf", 20_798_596),
    (4, "1_UqJUC-gKZhfA74bdsNftpPFz94nKNui", "year6-english-2027-unit4.pdf", 12_405_362),
    (5, "1si23nzpivN5GOY1DfwmhM1wwzQawprAy", "year6-english-2027-unit5.pdf", 9_501_651),
    (6, "1uHjazKjuSAMlQSYhFLHkqYBWr2wJEFfh", "year6-english-2027-unit6.pdf", 11_466_915),
    (7, "15y4YCAng6qY6ofw-bqXiWT1FVYvwNRu_", "year6-english-2027-unit7.pdf", 8_586_199),
    (8, "1sJEata_XW3Fd5nS46k9T4FzVUM0D8Dq8", "year6-english-2027-unit8.pdf", 10_579_735),
    (9, "1VIVE571k7_ex7nrH5SNctgnlzXlAp5_w", "year6-english-2027-unit9.pdf", 7_229_329),
    (10,"1JEiXLD9SYVn04O4DKR21wmng9LWw4ymz", "year6-english-2027-unit10.pdf", 10_306_421),
)

output_dir=Path("dist/assets/materials")
output_dir.mkdir(parents=True, exist_ok=True)
for month, file_id, filename, expected in ASSETS:
    dest=output_dir/filename
    for attempt in range(1,4):
        try:
            print(f"Year 6 {month:02d}/10: downloading {filename} (attempt {attempt})",flush=True)
            result=gdown.download(id=file_id,output=str(dest),quiet=True)
            if not result or not dest.is_file():
                raise RuntimeError("Google Drive returned no file")
            size=dest.stat().st_size
            # Some PDF downloads have an additional six-byte EOF tail compared
            # with Drive metadata, while the full PDF is otherwise intact.
            if size not in (expected,expected+6):
                raise RuntimeError(f"PDF size mismatch, downloaded {size} vs metadata {expected}")
            with dest.open("rb") as f:
                header=f.read(5)
                f.seek(max(0,size-4096))
                trailer=f.read()
            if header!=b"%PDF-" or b"%%EOF" not in trailer:
                raise RuntimeError("Invalid PDF header or EOF marker")
            digest=hashlib.sha256(dest.read_bytes()).hexdigest()[:16]
            print(f"VERIFIED Year 6 month {month:02d}: {size:,} bytes; SHA256={digest}",flush=True)
            break
        except Exception as exc:
            dest.unlink(missing_ok=True)
            print(f"Year 6 month {month:02d} attempt {attempt} failed: {exc}",flush=True)
            if attempt==3:raise
            time.sleep(2*attempt)
print("SUCCESS: all ten Year 6 English January–October 2027 PDF files verified",flush=True)
