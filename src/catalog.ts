import { asset } from "./assets";
export const topics = [
  "Du lịch",
  "Ẩm thực",
  "Thiên nhiên",
  "Kiến trúc",
  "Đời sống",
] as const;
export type Topic = (typeof topics)[number];
export type Media = {
  id: string;
  title: string;
  author: string;
  topic: Topic;
  tags: string[];
  kind: "video" | "image";
  src: string;
  cover: string;
  duration: number;
  width: number;
  height: number;
  views: number;
  created: number;
  bytes?: number;
  mime?: string;
  owner?: string;
};
function sample(
  id: string,
  title: string,
  author: string,
  topic: Topic,
  tags: string[],
  views: number,
  duration = 0,
): Media {
  const cover = asset("/media/" + id + ".jpg");
  return {
    id,
    title,
    author,
    topic,
    tags,
    views,
    duration,
    cover,
    width: duration ? 960 : 768,
    height: duration ? 540 : id === "walls" ? 342 : 341,
    created: 0,
    kind: duration ? "video" : "image",
    src: duration ? asset("/media/" + id + ".mp4") : cover,
  };
}
export const catalog = [
  sample(
    "tokyo",
    "Tokyo sau ánh đèn neon",
    "Minh Nhật",
    "Du lịch",
    ["tokyo", "phố đêm", "đô thị"],
    18400,
    12,
  ),
  sample(
    "coffee",
    "Một buổi sáng pour-over",
    "An Nhiên",
    "Ẩm thực",
    ["cà phê", "thủ công", "chậm rãi"],
    12800,
    10,
  ),
  sample(
    "surf",
    "Đón sóng ngoài khơi",
    "Hải Nam",
    "Thiên nhiên",
    ["đại dương", "ngoài trời", "thể thao"],
    9400,
    12,
  ),
  sample(
    "walls",
    "Hình khối dưới nắng",
    "Linh Đan",
    "Kiến trúc",
    ["hình khối", "đô thị", "ánh sáng"],
    7300,
  ),
  sample(
    "sushi",
    "Nghệ thuật trong từng miếng sushi",
    "An Nhiên",
    "Ẩm thực",
    ["nhật bản", "thủ công", "ẩm thực"],
    6100,
  ),
  sample(
    "bay",
    "Sớm mai trên vịnh",
    "Hải Nam",
    "Du lịch",
    ["đại dương", "ngoài trời", "chậm rãi"],
    5300,
  ),
  sample(
    "alpine",
    "Phía trên tầng mây",
    "Minh Trần",
    "Thiên nhiên",
    ["núi cao", "ngoài trời", "khám phá"],
    4100,
    14,
  ),
];
export const features = [
  {
    id: "alpine",
    description: "Theo dấu chân người lữ hành giữa những dãy núi trùng điệp.",
  },
  {
    id: "tokyo",
    description: "Qua những con hẻm nhỏ khi thành phố vừa lên đèn.",
  },
  { id: "coffee", description: "Một nhịp sống chậm bên giọt cà phê đầu ngày." },
];
export type Signal = {
  liked?: boolean;
  saved?: boolean;
  opened?: boolean;
  watched?: boolean;
  hidden?: boolean;
};
export type History = Record<string, Signal>;
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .trim();
function keys(m: Media) {
  return [m.topic, ...m.tags].map(normalize);
}
export function recommendations(items: Media[], history: History) {
  const profile = new Map<string, number>();
  const weights = new Map<string, number>();
  for (const item of items) {
    const s = history[item.id];
    if (!s) continue;
    const weight =
      Number(!!s.opened) +
      2 * Number(!!s.watched) +
      3 * Number(!!s.liked) +
      4 * Number(!!s.saved) -
      7 * Number(!!s.hidden);
    weights.set(item.id, weight);
    new Set(keys(item)).forEach((k) =>
      profile.set(k, (profile.get(k) || 0) + weight),
    );
  }
  return items
    .map((media) => {
      const matches = keys(media).map((key, i) => ({
        value:
          ((profile.get(key) || 0) - (weights.get(media.id) || 0)) *
          (i === 0 ? 2 : 1),
        label: i === 0 ? media.topic : media.tags[i - 1],
      }));
      const best = [...matches].sort((a, b) => b.value - a.value)[0];
      const score =
        matches.reduce((n, m) => n + m.value, 0) +
        Math.log10(1 + media.views) +
        (media.owner ? 5 : 0) -
        (history[media.id]?.opened ? 5 : 0);
      const reason =
        best.value > 0
          ? "Liên quan đến sở thích của bạn: " + best.label
          : media.owner
            ? "Nội dung mới từ nhà sáng tạo."
            : "Được đề xuất theo lượt xem trong bộ sưu tập mẫu.";
      return { media, score, reason };
    })
    .sort((a, b) => b.score - a.score);
}
export function clock(seconds: number) {
  return (
    Math.floor(seconds / 60) +
    ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0")
  );
}
export function views(n: number) {
  return n >= 1000
    ? (n / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "K"
    : String(n);
}
