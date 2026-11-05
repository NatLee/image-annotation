"""Write docs/demo-annotations.json: boxes for the bundled sample pictures.

Heads (the app's "anime_face" class: the whole head, hair included) and people
are found with the MIT-licensed deepghs detectors through dghs-imgutils (CPU is
enough), then a person checks the drawn review images before the file is
committed. Run it in a throwaway container, e.g.

  docker run --rm -v <repo>:/repo -v <scratch>:/work python:3.12-slim sh -c \
    "pip install --target /work/py dghs-imgutils onnxruntime && PYTHONPATH=/work/py \
     python /repo/scripts/samples/annotate.py --samples /repo/src/assets/samples \
     --out /repo/docs/demo-annotations.json --review /work/review"
"""

import argparse
import json
import pathlib
from datetime import datetime, timedelta, timezone

from imgutils.detect import detect_heads, detect_person
from PIL import Image, ImageDraw

LABELS = {"head": "anime_face", "person": "person"}
MIN_SCORE = 0.5
ANNOTATORS = ["nat", "mika", "nat", "yuki", "mika", "nat"]  # the demo leaderboard
START = datetime(2026, 11, 4, 8, 0, tzinfo=timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--samples", default="/samples", type=pathlib.Path)
    parser.add_argument("--out", default="/docs/demo-annotations.json", type=pathlib.Path)
    parser.add_argument("--review", default="/work/review", type=pathlib.Path)
    args = parser.parse_args()
    args.review.mkdir(parents=True, exist_ok=True)

    records = []
    for i, path in enumerate(sorted(args.samples.glob("*.webp"))):
        image = Image.open(path).convert("RGB")
        found = [(LABELS["head"], d) for d in detect_heads(image)] + [(LABELS["person"], d) for d in detect_person(image)]
        stamp = START + timedelta(minutes=3 * i)
        ms = int(stamp.timestamp() * 1000)
        boxes = []
        draw = ImageDraw.Draw(image)
        for j, (label, ((x0, y0, x1, y1), _kind, score)) in enumerate(d for d in found if d[1][2] >= MIN_SCORE):
            x0, y0, x1, y1 = (round(v) for v in (x0, y0, x1, y1))
            boxes.append({"id": f"box_{ms}_{path.stem[3:7]}{j}", "x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0, "label": label})
            draw.rectangle((x0, y0, x1, y1), outline="#22c55e" if label == LABELS["head"] else "#f97316", width=4)
            draw.text((x0 + 6, y0 + 4), f"{label} {score:.2f}", fill="white")
        image.save(args.review / f"{path.stem}.jpg", quality=80)
        records.append(
            {
                "session_id": f"session_{ms}",
                "image_url": f"samples/{path.name}",
                "original_size": {"width": image.width, "height": image.height},
                "display_size": {"width": image.width, "height": image.height},
                "scale_factor": 1,
                "annotator": ANNOTATORS[i % len(ANNOTATORS)],
                "timestamp": stamp.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "bounding_boxes": boxes,
            }
        )
        print(f"{path.name}: {sum(b['label'] == LABELS['head'] for b in boxes)} heads, {sum(b['label'] == LABELS['person'] for b in boxes)} people")

    total = sum(len(r["bounding_boxes"]) for r in records)
    export = {
        "export_info": {
            "export_date": records[-1]["timestamp"],
            "total_images": len(records),
            "total_annotations": total,
            "data_range": {"first_annotation": records[0]["timestamp"], "last_annotation": records[-1]["timestamp"]},
        },
        "annotation_records": records,
    }
    args.out.write_text(json.dumps(export, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(records)} records with {total} boxes")


if __name__ == "__main__":
    main()
