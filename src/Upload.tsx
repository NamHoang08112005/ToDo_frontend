import React, { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiFilm, FiUploadCloud } from "react-icons/fi";
import { clock, Media, Topic, topics } from "./catalog";
import { inspectFile, mediaTypes, publish, Scan } from "./library";

export default function Upload({
  shared,
  onPublish,
}: {
  shared: boolean;
  onPublish: (item: Media) => void;
}) {
  const [file, setFile] = useState<File>();
  const [scan, setScan] = useState<Scan>();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("Nhà sáng tạo");
  const [topic, setTopic] = useState<Topic>("Du lịch");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  useEffect(
    () => () => {
      seq.current++;
    },
    [],
  );
  async function select(f?: File) {
    if (!f || busy) return;
    const version = ++seq.current;
    setFile(f);
    setScan(undefined);
    setError("");
    setReading(true);
    setTitle(
      f.name
        .replace(/\.[^.]+$/, "")
        .replace(/[-_]/g, " ")
        .slice(0, 100),
    );
    try {
      const info = await inspectFile(f);
      if (version === seq.current) setScan(info);
    } catch (e) {
      if (version === seq.current) setError((e as Error).message);
    } finally {
      if (version === seq.current) setReading(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !scan || busy) return;
    setBusy(true);
    setError("");
    try {
      const item = await publish(
        file,
        scan,
        { title: title.trim(), author: author.trim(), topic, tags },
        shared,
      );
      onPublish(item);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <form className="upload" onSubmit={submit}>
      <h2>Đăng nội dung</h2>
      <p className="muted">
        Đưa video hoặc hình ảnh của bạn vào bảng tin khám phá.
      </p>
      <input
        ref={input}
        type="file"
        hidden
        aria-label="Chọn tệp"
        accept={mediaTypes.join(",")}
        onChange={(e) => select(e.target.files?.[0])}
      />
      <button
        disabled={busy}
        type="button"
        className={"dropzone " + (drag ? "drag" : "")}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          select(e.dataTransfer.files[0]);
        }}
      >
        {scan ? <FiCheckCircle /> : <FiUploadCloud />}
        <b>
          {reading
            ? "Đang đọc metadata…"
            : file?.name || "Chọn hoặc kéo thả tệp"}
        </b>
        <small>MP4, WebM, JPG, PNG, WebP · Tối đa 32 MB</small>
      </button>
      {scan && file && (
        <div className="metadata">
          <FiFilm /> {scan.width} × {scan.height} px · {file.type} ·{" "}
          {(file.size / 1048576).toFixed(2)} MB{" "}
          {scan.duration > 0 && " · " + clock(scan.duration)}
        </div>
      )}
      <label>
        Tiêu đề
        <input
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="formrow">
        <label>
          Tác giả
          <input
            required
            maxLength={50}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </label>
        <label>
          Chủ đề
          <select
            aria-label="Chủ đề"
            value={topic}
            onChange={(e) => setTopic(e.target.value as Topic)}
          >
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Thẻ mô tả
        <input
          maxLength={180}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Ví dụ: núi cao, ngoài trời"
        />
      </label>
      <small className="muted">
        {shared
          ? "Sau khi đăng, người xem trên cùng máy chủ có thể khám phá nội dung này."
          : "Bản chạy tĩnh lưu nội dung trên trình duyệt này."}
      </small>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary"
        disabled={!scan || !title.trim() || !author.trim() || busy}
      >
        {busy ? "Đang đăng…" : "Đăng lên bảng tin"}
      </button>
    </form>
  );
}
