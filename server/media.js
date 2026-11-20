const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const execFile = require("util").promisify(require("child_process").execFile);
const db = process.env.FRAMEFLOW_DATA || path.join(__dirname, "../.frameflow");
const seedIds = ["alpine", "tokyo", "coffee", "surf", "walls", "sushi", "bay"];
const viewsPath = path.join(db, "views");
async function readCounts(ids) {
  const counts = await Promise.all(
    ids.map(async (id) => {
      try {
        return (await fs.readdir(path.join(viewsPath, id))).length;
      } catch (error) {
        if (error.code === "ENOENT") return 0;
        throw error;
      }
    }),
  );
  return Object.fromEntries(ids.map((id, i) => [id, counts[i]]));
}
const topics = ["Du lịch", "Ẩm thực", "Thiên nhiên", "Kiến trúc", "Đời sống"];
const formats = {
  "image/jpeg": ["mjpeg", "jpg"],
  "image/png": ["png_pipe", "png"],
  "image/webp": ["webp_pipe", "webp"],
  "video/mp4": ["mov", "mp4"],
  "video/webm": ["matroska", "webm"],
};
function provider(req, res) {
  const value = /(?:^|; )frameflow_creator=([a-f0-9-]{36})(?:;|$)/.exec(
    req.headers.cookie || "",
  );
  if (value) return value[1];
  const id = randomUUID();
  res.cookie("frameflow_creator", id, {
    httpOnly: true,
    sameSite: "strict",
    maxAge: 31536000000,
  });
  return id;
}
module.exports = function attach(app) {
  app.get("/api/catalog", async (req, res, next) => {
    try {
      const owner = provider(req, res);
      await fs.mkdir(db, { recursive: true });
      const files = (await fs.readdir(db)).filter((f) => f.endsWith(".json"));
      const items = await Promise.all(
        files.map(async (f) => {
          const { creator, ...item } = JSON.parse(
            await fs.readFile(path.join(db, f), "utf8"),
          );
          return { ...item, owner: creator === owner ? "self" : "community" };
        }),
      );
      res
        .set("Cache-Control", "no-store")
        .json({
          items,
          counts: await readCounts([...seedIds, ...items.map((i) => i.id)]),
        });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/views/:id", async (req, res, next) => {
    const id = req.params.id;
    try {
      if (!seedIds.includes(id)) {
        if (!/^[a-f0-9-]{36}$/.test(id)) return res.sendStatus(404);
        try {
          await fs.access(path.join(db, id + ".json"));
        } catch {
          return res.sendStatus(404);
        }
      }
      const folder = path.join(viewsPath, id);
      await fs.mkdir(folder, { recursive: true });
      await fs
        .writeFile(path.join(folder, provider(req, res)), "", { flag: "wx" })
        .catch((e) => {
          if (e.code !== "EEXIST") throw e;
        });
      res.json({ count: (await fs.readdir(folder)).length });
    } catch (error) {
      next(error);
    }
  });
  app.get("/frames/:id/:file", (req, res) => {
    const { id, file } = req.params;
    if (
      !/^[a-f0-9-]{36}$/.test(id) ||
      !/^(cover\.jpg|source\.(jpg|png|webp|mp4|webm))$/.test(file)
    )
      return res.sendStatus(404);
    res
      .set("X-Content-Type-Options", "nosniff")
      .sendFile(path.join(db, id, file), { dotfiles: "allow" });
  });
  app.post(
    "/api/catalog",
    express.raw({ type: Object.keys(formats), limit: "32mb" }),
    async (req, res) => {
      const mime = req.headers["content-type"];
      const { title, author, topic, tags } = req.query;
      if (
        !formats[mime] ||
        !Buffer.isBuffer(req.body) ||
        !req.body.length ||
        ![title, author, topic, tags].every((v) => typeof v === "string") ||
        !title.trim() ||
        title.length > 100 ||
        !author.trim() ||
        author.length > 50 ||
        !topics.includes(topic) ||
        tags.length > 180
      )
        return res
          .status(400)
          .json({ message: "Tệp hoặc thông tin nội dung chưa hợp lệ." });
      const [format, ext] = formats[mime];
      const id = randomUUID(),
        folder = path.join(db, id),
        file = path.join(folder, "source." + ext);
      try {
        await fs.mkdir(folder, { recursive: true });
        await fs.writeFile(file, req.body);
        const input = ["-protocol_whitelist", "file", "-f", format];
        const { stdout } = await execFile(
          "ffprobe",
          [
            "-v",
            "error",
            ...input,
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            file,
          ],
          { timeout: 15000 },
        );
        const info = JSON.parse(stdout),
          track = info.streams.find((s) => s.codec_type === "video");
        if (
          !track ||
          !track.width ||
          !track.height ||
          track.width * track.height > 40000000
        )
          throw Error("Invalid frame");
        const kind = mime.startsWith("video/") ? "video" : "image";
        const duration = kind === "video" ? Number(info.format.duration) : 0;
        if (!Number.isFinite(duration) || (kind === "video" && duration <= 0))
          throw Error("Invalid duration");
        await execFile(
          "ffmpeg",
          [
            "-v",
            "error",
            ...input,
            "-i",
            file,
            "-frames:v",
            "1",
            "-vf",
            "scale=960:540:force_original_aspect_ratio=decrease",
            "-threads",
            "1",
            path.join(folder, "cover.jpg"),
          ],
          { timeout: 20000 },
        );
        const item = {
          id,
          title: title.trim(),
          author: author.trim(),
          topic,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
          kind,
          duration,
          width: track.width,
          height: track.height,
          bytes: req.body.length,
          mime,
          src: "/frames/" + id + "/source." + ext,
          cover: "/frames/" + id + "/cover.jpg",
          views: 0,
          created: Date.now(),
        };
        const temp = path.join(folder, "record.tmp");
        await fs.writeFile(
          temp,
          JSON.stringify({ ...item, creator: provider(req, res) }),
        );
        await fs.rename(temp, path.join(db, id + ".json"));
        res.status(201).json({ ...item, owner: "self" });
      } catch (error) {
        await fs.rm(folder, { recursive: true, force: true }).catch(() => {});
        res
          .status(error.code === "ENOENT" ? 503 : 422)
          .json({
            message:
              "Không thể xử lý tệp. Kiểm tra định dạng và bộ công cụ FFmpeg của máy chủ.",
          });
      }
    },
  );
};
