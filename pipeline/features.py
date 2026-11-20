"""Streaming visual descriptors. One RGB thumbnail in memory per frame."""

import subprocess
import json
from pathlib import Path

WIDTH, HEIGHT = 32, 18
PIXELS = WIDTH * HEIGHT
CHANNEL_BINS = 4
SAFE_INPUT = [
    "-protocol_whitelist",
    "file,pipe",
    "-format_whitelist",
    "mov,matroska,webm,jpeg_pipe,mjpeg,png_pipe,webp_pipe,image2",
]


def invoke(*args, timeout=90):
    return subprocess.run(
        args,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    ).stdout


def probe(path):
    obj = json.loads(
        invoke(
            "ffprobe",
            "-v",
            "error",
            *SAFE_INPUT,
            "-select_streams",
            "v:0",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(path),
        )
    )
    stream = obj["streams"][0]
    return {
        "width": stream["width"],
        "height": stream["height"],
        "seconds": round(float(obj["format"].get("duration", 0)), 3),
        "bytes": Path(path).stat().st_size,
        "codec": stream["codec_name"],
    }


def frame_rows(path):
    cmd = [
        "ffmpeg",
        "-nostdin",
        "-v",
        "error",
        *SAFE_INPUT,
        "-i",
        str(path),
        "-map",
        "0:v:0",
        "-vf",
        f"scale={WIDTH}:{HEIGHT}",
        "-fps_mode",
        "passthrough",
        "-threads",
        "1",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        "-",
    ]
    with subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL
    ) as proc:
        prev = None
        while True:
            buf = proc.stdout.read(PIXELS * 3)
            if not buf:
                break
            if len(buf) != PIXELS * 3:
                raise ValueError("Khung hình chưa đầy đủ")
            hist = []
            for channel in range(3):
                bins = [0] * 4
                for value in buf[channel::3]:
                    bins[value // 64] += 1
                hist.extend(round(x / PIXELS, 5) for x in bins)
            motion = (
                sum(abs(a - b) for a, b in zip(buf, prev)) / (len(buf) * 255)
                if prev
                else 0.0
            )
            yield hist, round(motion, 6)
            prev = buf
        if proc.wait() != 0:
            raise ValueError("FFmpeg không giải mã được tệp")


def summarize(rows):
    total = [0.0] * 12
    movement = 0.0
    n = 0
    for hist, motion in rows:
        for i, v in enumerate(hist):
            total[i] += v
        if n:
            movement += motion
        n += 1
    if not n:
        raise ValueError("Không có khung hình")
    return {
        "hist": [round(v / n, 5) for v in total],
        "motion": round(movement / max(1, n - 1), 5),
        "frames": n,
    }
