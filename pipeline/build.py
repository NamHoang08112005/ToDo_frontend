"""Rebuild the bundled demo catalog from the pinned DAVIS research preview."""

import argparse
import csv
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import urllib.request
from features import invoke, frame_rows, probe, summarize

ROOT = Path(__file__).resolve().parents[1]
SHA = "684b51e58c0af28462d6e6c56e65a8057b92577a1f2f9300ee7bbba34322309b"
URL = "https://raw.githubusercontent.com/davisvideochallenge/davisvideochallenge.github.io/30be16ff9d289f6711328c950a19c6288306ade3/images/DAVIS-2017-TrainVal.mp4"


def build(source):
    if hashlib.sha256(source.read_bytes()).hexdigest() != SHA:
        raise ValueError("SHA-256 nguồn không khớp")
    target = ROOT / "web/media"
    target.mkdir(exist_ok=True, parents=True)
    # This particular source has a constant frame rate of 20 fps.
    with gzip.open(
        ROOT / "data/source-frames.csv.gz", "wt", newline="", encoding="utf-8"
    ) as out:
        seconds = []
        writer = csv.writer(out)
        writer.writerow(["frame", "second", "motion"] + [f"rgb{i}" for i in range(12)])
        n = 0
        for n, (hist, motion) in enumerate(frame_rows(source), 1):
            writer.writerow([n - 1, (n - 1) / 20, motion, *hist])
            if (n - 1) % 20 == 0:
                seconds.append([])
            seconds[-1].append(motion)
    timeline = [round(sum(values) / len(values), 5) for values in seconds]
    (ROOT / "web/timeline.json").write_text(json.dumps(timeline), encoding="utf-8")
    if source.resolve() != (target / "davis-trainval.mp4").resolve():
        shutil.copyfile(source, target / "davis-trainval.mp4")
    items = []
    with (ROOT / "data/selections.csv").open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            start, end = float(row["start"]), float(row["end"])
            video = row["type"] == "video"
            name = row["id"]
            cover = target / (name + ".jpg")
            invoke(
                "ffmpeg",
                "-y",
                "-v",
                "error",
                "-ss",
                str((start + end) / 2),
                "-i",
                str(source),
                "-frames:v",
                "1",
                "-vf",
                "scale=854:480,setsar=1",
                "-q:v",
                "2",
                str(cover),
            )
            path = cover
            if video:
                path = target / (name + ".mp4")
                invoke(
                    "ffmpeg",
                    "-y",
                    "-v",
                    "error",
                    "-ss",
                    str(start),
                    "-i",
                    str(source),
                    "-t",
                    str(round(end - start, 3)),
                    "-an",
                    "-vf",
                    "scale=854:480,setsar=1",
                    "-c:v",
                    "libx264",
                    "-crf",
                    "20",
                    "-threads",
                    "2",
                    "-pix_fmt",
                    "yuv420p",
                    "-movflags",
                    "+faststart",
                    str(path),
                )
            items.append(
                dict(
                    id=name,
                    title=row["title"],
                    topic=row["topic"],
                    tags=row["tags"].split("|"),
                    kind=row["type"],
                    start=start,
                    end=end,
                    source="DAVIS 2017",
                    url=URL,
                    src="/media/" + path.name,
                    cover="/media/" + cover.name,
                    **probe(path),
                    **summarize(frame_rows(path)),
                )
            )
    manifest = {
        "source": URL,
        "sha256": SHA,
        "source_frames": n,
        "source_seconds": probe(source)["seconds"],
        "items": items,
    }
    (ROOT / "data/catalog.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"{len(items)} mục; {n} khung hình nguồn")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    arg = parser.parse_args()
    with tempfile.TemporaryDirectory() as folder:
        source = arg.source or Path(folder) / "davis.mp4"
        if not arg.source:
            urllib.request.urlretrieve(URL, source)
        build(source)
