import json
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
import server


class AtlasTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.override = patch.object(server, "RUNTIME", Path(self.tmp.name))
        self.override.start()
        server.initialize()
        with server.database() as db:
            for mid, topic in [("a", "Thể thao"), ("b", "Thể thao"), ("c", "Khác")]:
                record = {
                    "id": mid,
                    "topic": topic,
                    "title": mid,
                    "tags": [],
                    "hist": [0.25] * 12,
                    "motion": 0,
                    "frames": 1,
                }
                db.execute(
                    "INSERT INTO media VALUES(?,?,?)",
                    (mid, json.dumps(record), "provider"),
                )

    def tearDown(self):
        self.override.stop()
        self.tmp.cleanup()

    def send(self, viewer, action, mid="a", eid=None):
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
        self.assertNotEqual(result["items"][0]["id"], "a")
        self.assertEqual(result["items"][0]["topic"], "Thể thao")
        self.assertTrue(next(m for m in result["items"] if m["id"] == "a")["liked"])
        self.assertFalse(any(m["liked"] for m in self.get("other")["items"]))
        self.send("me", "unlike")
        self.send("me", "skip")
        self.assertTrue(
            next(m for m in self.get("me")["items"] if m["id"] == "a")["skipped"]
        )

    def test_reject_unknown_events_and_missing_media(self):
        for action, mid in [("imaginary", "a"), ("like", "missing")]:
            with self.assertRaises(ValueError):
                self.send("v", action, mid)
        self.assertEqual(self.get("v")["stats"]["events"], {})

    def test_retiring_bundled_catalog_preserves_provider_uploads(self):
        with server.database() as db:
            db.execute(
                "INSERT INTO media VALUES(?,?,NULL)",
                ("legacy", json.dumps({"src": "/media/legacy.mp4"})),
            )
        self.send("v", "open", "legacy")
        self.send("v", "open", "a")
        server.initialize()
        result = self.get("v")
        self.assertEqual({item["id"] for item in result["items"]}, {"a", "b", "c"})
        self.assertEqual(result["stats"]["events"], {"open": 1})

    def test_stream_fixture_references_and_retry(self):
        path = server.ROOT / "data/examples"

        def read(name):
            return [json.loads(line) for line in (path / name).read_text().splitlines()]

        catalog = {m["video_id"] for m in read("catalog.ndjson")}
        source = {m["observation_id"] for m in read("kuairand-observations.ndjson")}
        events = read("stream-input.ndjson")
        self.assertEqual(
            [e["replay_at_ms"] for e in events],
            sorted(e["replay_at_ms"] for e in events),
        )
        self.assertTrue(
            all(
                e["video_id"] in catalog
                and e["observation_id"] in source
                and e["event_time_ms"] <= e["replay_at_ms"]
                and e["is_simulated"]
                and e["is_fixture"]
                for e in events
            )
        )
        self.assertEqual(
            len({e["event_id"] for e in events if e["event_type"] == "like"}), 1
        )
        self.assertEqual(sum(e["event_type"] == "like" for e in events), 2)


if __name__ == "__main__":
    unittest.main()
