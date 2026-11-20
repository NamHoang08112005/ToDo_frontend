import gzip
import csv
import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
import server
from pipeline.evaluate import evaluate


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.override = patch.object(server, "RUNTIME", Path(self.tmp.name))
        self.override.start()
        server.initialize()

    def tearDown(self):
        self.override.stop()
        self.tmp.cleanup()

    def send(self, viewer, action, mid="kite", eid=None):
        with server.database() as db:
            server.event(
                db,
                viewer,
                {"id": eid or str(uuid.uuid4()), "item": mid, "action": action},
            )

    def get(self, viewer):
        with server.database() as db:
            return server.feed(db, viewer)

    def test_idempotent_events_and_isolated_tastes(self):
        eid = str(uuid.uuid4())
        self.send("me", "open", eid=eid)
        self.send("me", "open", eid=eid)
        self.send("me", "like")
        result = self.get("me")
        self.assertEqual(result["stats"]["events"], {"open": 1, "like": 1})
        self.assertNotEqual(result["items"][0]["id"], "kite")
        self.assertEqual(result["items"][0]["topic"], "Biển & nước")
        self.assertTrue(next(m for m in result["items"] if m["id"] == "kite")["liked"])
        self.assertFalse(any(m["liked"] for m in self.get("other")["items"]))
        self.send("me", "unlike")
        self.send("me", "skip")
        self.assertTrue(
            next(m for m in self.get("me")["items"] if m["id"] == "kite")["skipped"]
        )

    def test_reject_unknown_events_and_missing_media(self):
        for action, mid in [("imaginary", "kite"), ("like", "missing")]:
            with self.assertRaises(ValueError):
                self.send("v", action, mid)
        self.assertEqual(self.get("v")["stats"]["events"], {})

    def test_real_frame_batch_and_catalog_integrity(self):
        with gzip.open(server.ROOT / "data/source-frames.csv.gz", "rt") as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), server.SEED["source_frames"])
        self.assertEqual(int(rows[-1]["frame"]) + 1, len(rows))
        for m in server.SEED["items"]:
            self.assertTrue((server.WEB / m["src"][1:]).is_file())
            self.assertEqual(len(m["hist"]), 12)
            self.assertAlmostEqual(sum(m["hist"]), 3, places=3)
            self.assertGreater(m["frames"], 0)

    def test_evaluation_matches_saved_report(self):
        report = evaluate(server.SEED["items"])
        self.assertEqual(
            report, json.loads((server.WEB / "evaluation.json").read_text())
        )
        self.assertTrue(all(r["query"] not in r["nearest"] for r in report["rows"]))


if __name__ == "__main__":
    unittest.main()
