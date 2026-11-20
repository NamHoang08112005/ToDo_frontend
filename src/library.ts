import { Media, Topic } from "./catalog";

export const mediaTypes = [
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export type Scan = {
  width: number;
  height: number;
  duration: number;
  poster: Blob;
};
export async function inspectFile(file: File): Promise<Scan> {
  if (!mediaTypes.includes(file.type))
    throw Error("Chọn ảnh JPG, PNG, WebP hoặc video MP4, WebM.");
  if (!file.size || file.size > 32 * 1024 * 1024)
    throw Error("Vui lòng chọn tệp lớn hơn 0 byte và tối đa 32 MB.");
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video/");
  const media = isVideo ? document.createElement("video") : new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(Error("Không đọc được tệp trong thời gian cho phép.")),
        15000,
      );
      const ready = () => {
        clearTimeout(timeout);
        resolve();
      };
      media.onerror = () => {
        clearTimeout(timeout);
        reject(Error("Trình duyệt không đọc được tệp này."));
      };
      if (media instanceof HTMLVideoElement) {
        media.muted = true;
        media.preload = "auto";
        media.onloadeddata = ready;
      } else media.onload = ready;
      media.src = url;
    });
    const width =
      media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
    const height =
      media instanceof HTMLVideoElement
        ? media.videoHeight
        : media.naturalHeight;
    const duration = media instanceof HTMLVideoElement ? media.duration : 0;
    if (!width || !height || !Number.isFinite(duration))
      throw Error("Metadata không hợp lệ.");
    const scale = Math.min(1, 960 / width, 640 / height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas
      .getContext("2d")!
      .drawImage(media, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(Error("Không tạo được ảnh bìa.")),
        "image/jpeg",
        0.85,
      ),
    );
    return { width, height, duration, poster };
  } finally {
    if (media instanceof HTMLVideoElement) {
      media.removeAttribute("src");
      media.load();
    }
    URL.revokeObjectURL(url);
  }
}

type LocalRecord = { item: Media; file: Blob; poster: Blob };
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("frameflow-media", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("posts", { keyPath: "item.id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function inflate(r: LocalRecord): Media {
  return {
    ...r.item,
    src: URL.createObjectURL(r.file),
    cover: URL.createObjectURL(r.poster),
  };
}
export async function loadLibrary(): Promise<{
  items: Media[];
  shared: boolean;
  counts: Record<string, number>;
}> {
  if (!window.frameflowAssets) {
    const res = await fetch("/api/catalog", { cache: "no-store" });
    if (
      res.ok &&
      res.headers.get("content-type")?.includes("application/json")
    ) {
      const result = await res.json();
      return { items: result.items, counts: result.counts, shared: true };
    }
    if (!res.ok && res.status !== 404)
      throw Error("Chưa tải được thư viện từ máy chủ.");
  }
  const db = await database();
  try {
    const records = await new Promise<LocalRecord[]>((resolve, reject) => {
      const req = db.transaction("posts").objectStore("posts").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return { items: records.map(inflate), shared: false, counts: {} };
  } finally {
    db.close();
  }
}
export function releaseMedia(items: Media[]) {
  items.forEach((m) =>
    [m.src, m.cover].forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }),
  );
}
export async function publish(
  file: File,
  scan: Scan,
  fields: { title: string; author: string; topic: Topic; tags: string },
  shared: boolean,
): Promise<Media> {
  if (shared) {
    const res = await fetch("/api/catalog?" + new URLSearchParams(fields), {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!res.ok)
      throw Error(
        (await res.json().catch(() => ({}))).message ||
          "Đăng nội dung thất bại.",
      );
    return res.json();
  }
  const item: Media = {
    ...fields,
    id: crypto.randomUUID(),
    owner: "self",
    kind: file.type.startsWith("video/") ? "video" : "image",
    width: scan.width,
    height: scan.height,
    duration: scan.duration,
    mime: file.type,
    bytes: file.size,
    src: "",
    cover: "",
    views: 0,
    created: Date.now(),
    tags: fields.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8),
  };
  const db = await database();
  const record = { item, file, poster: scan.poster };
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("posts", "readwrite");
      tx.objectStore("posts").add(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return inflate(record);
}
