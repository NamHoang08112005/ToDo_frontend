import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiActivity,
  FiArrowDown,
  FiArrowLeft,
  FiBookmark,
  FiCheck,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCompass,
  FiEye,
  FiFilm,
  FiGrid,
  FiHeart,
  FiImage,
  FiLayers,
  FiMenu,
  FiPlay,
  FiPlus,
  FiSearch,
  FiSliders,
  FiTrendingUp,
  FiUploadCloud,
  FiUser,
  FiVideo,
  FiX,
  FiZap,
} from "react-icons/fi";
import {
  catalog,
  clock,
  features,
  History,
  Media,
  normalize,
  recommendations,
  Signal,
  topics,
  views,
} from "./catalog";
import { loadLibrary, releaseMedia } from "./library";
import Upload from "./Upload";
import { asset } from "./assets";

type Page = "Khám phá" | "Thịnh hành" | "Đã lưu" | "Đã thích" | "Studio";
type Overlay =
  { type: "player"; id: string } | { type: "upload" | "profile" } | null;
const nav = [
  { label: "Khám phá", icon: FiCompass },
  { label: "Thịnh hành", icon: FiTrendingUp },
  { label: "Đã lưu", icon: FiBookmark },
  { label: "Đã thích", icon: FiHeart },
  { label: "Studio", icon: FiLayers },
] as const;
const colors: Record<string, string> = {
  "Du lịch": "#358277",
  "Ẩm thực": "#b57529",
  "Thiên nhiên": "#49863d",
  "Kiến trúc": "#6668a4",
  "Đời sống": "#a25768",
};
const historyKey = "frameflow.signals.v1";
function readHistory(): History {
  try {
    return JSON.parse(localStorage.getItem(historyKey) || "{}") || {};
  } catch {
    return {};
  }
}
function Modal({
  children,
  close,
  label,
}: {
  children: React.ReactNode;
  close: () => void;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      d?.close();
    };
  }, []);
  return (
    <dialog
      aria-label={label}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="modalinner">
        <button className="close icon" onClick={close} aria-label="Đóng">
          <FiX />
        </button>
        {children}
      </div>
    </dialog>
  );
}
function Card({
  item,
  open,
  save,
  saved,
}: {
  item: Media;
  open: () => void;
  save: () => void;
  saved: boolean;
}) {
  return (
    <article className="card">
      <div className="thumbwrap">
        <button
          className="thumbnail"
          onClick={open}
          aria-label={"Mở " + item.title}
        >
          <img src={item.cover} alt="" loading="lazy" />
          <span className="format">
            {item.kind === "video" ? <FiVideo /> : <FiImage />}
            {item.kind === "video" ? "VIDEO" : "ẢNH"}
          </span>
          {item.kind === "video" && (
            <span className="duration">{clock(item.duration)}</span>
          )}
        </button>
        <button
          className={"save " + (saved ? "on" : "")}
          aria-label={(saved ? "Bỏ lưu " : "Lưu ") + item.title}
          aria-pressed={saved}
          onClick={save}
        >
          <FiBookmark />
        </button>
      </div>
      <div className="cardbody">
        <div className="topic" style={{ color: colors[item.topic] }}>
          <i />
          {item.topic}
        </div>
        <button className="cardtitle" onClick={open}>
          {item.title}
        </button>
        <div className="byline">
          <span className="author">{item.author}</span>
          <span className="count">
            <FiEye />
            {views(item.views)}
          </span>
        </div>
      </div>
    </article>
  );
}
function Player({
  item,
  signal,
  reason,
  change,
  close,
}: {
  item: Media;
  signal: Signal;
  reason: string;
  change: (s: Signal) => void;
  close: () => void;
}) {
  const last = useRef(0),
    played = useRef(0);
  return (
    <>
      <div className="playmedia">
        {item.kind === "video" ? (
          <video
            src={item.src}
            poster={item.cover}
            controls
            autoPlay
            playsInline
            onSeeking={(e) => (last.current = e.currentTarget.currentTime)}
            onTimeUpdate={(e) => {
              const v = e.currentTarget,
                diff = v.currentTime - last.current;
              last.current = v.currentTime;
              if (diff > 0 && diff < 1.5) played.current += diff;
              if (!signal.watched && played.current >= v.duration * 0.75)
                change({ watched: true });
            }}
          />
        ) : (
          <img src={item.src} alt={item.title} />
        )}
      </div>
      <div className="details">
        <span className="topic" style={{ color: colors[item.topic] }}>
          <i />
          {item.topic}
        </span>
        <h2>{item.title}</h2>
        <div className="byline">
          <span>{item.author}</span>
          <span>
            <FiEye /> {views(item.views)} lượt xem
          </span>
        </div>
        <div className="actions">
          <button
            className={signal.liked ? "selected" : ""}
            aria-pressed={!!signal.liked}
            onClick={() => change({ liked: !signal.liked })}
          >
            <FiHeart />
            {signal.liked ? "Đã thích" : "Thích"}
          </button>
          <button
            className={signal.saved ? "selected" : ""}
            aria-pressed={!!signal.saved}
            onClick={() => change({ saved: !signal.saved })}
          >
            <FiBookmark />
            {signal.saved ? "Đã lưu" : "Lưu"}
          </button>
          <button
            onClick={() => {
              change({ hidden: true });
              close();
            }}
          >
            <FiArrowDown />
            Bớt nội dung tương tự
          </button>
        </div>
        <div className="why">
          <FiZap />
          <div>
            <b>Vì sao bạn thấy nội dung này?</b>
            <p>{reason}</p>
          </div>
        </div>
        <h3>Metadata</h3>
        <div className="metatags">
          <span>{item.kind === "video" ? "Video" : "Ảnh"}</span>
          <span>
            {item.width} × {item.height}
          </span>
          {item.duration > 0 && <span>{clock(item.duration)}</span>}
          {item.tags.map((t, i) => (
            <span key={i}>#{t}</span>
          ))}
        </div>
      </div>
    </>
  );
}
function App() {
  const [page, setPage] = useState<Page>("Khám phá"),
    [slide, setSlide] = useState(0),
    [query, setQuery] = useState(""),
    [topic, setTopic] = useState("Tất cả");
  const [filter, setFilter] = useState(false),
    [kind, setKind] = useState("all"),
    [drawer, setDrawer] = useState(false);
  const [history, setHistory] = useState<History>(readHistory),
    [uploads, setUploads] = useState<Media[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [shared, setShared] = useState<boolean | null>(null),
    [loadError, setLoadError] = useState(""),
    [reload, setReload] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null),
    [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null),
    localMedia = useRef<Media[]>([]);
  useEffect(() => {
    let active = true;
    setLoadError("");
    loadLibrary()
      .then((r) => {
        if (!active) {
          releaseMedia(r.items);
          return;
        }
        localMedia.current.push(...r.items);
        setUploads(r.items);
        setShared(r.shared);
        setCounts(r.counts);
      })
      .catch(() => {
        if (active) setLoadError("Chưa tải được thư viện của nhà sáng tạo.");
      });
    return () => {
      active = false;
      releaseMedia(localMedia.current);
      localMedia.current = [];
    };
  }, [reload]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !overlay &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [overlay]);
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === historyKey) setHistory(readHistory());
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2800);
    return () => clearTimeout(t);
  }, [notice]);
  function change(id: string, delta: Signal) {
    const h = readHistory(),
      next = { ...h, [id]: { ...history[id], ...h[id], ...delta } };
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {
      setNotice("Trình duyệt không lưu được sở thích sau khi đóng trang.");
    }
    setHistory(next);
  }
  const items = useMemo(
    () =>
      [...uploads, ...catalog].map((m) => ({
        ...m,
        views:
          m.views +
          (shared ? counts[m.id] || 0 : Number(!!history[m.id]?.opened)),
      })),
    [uploads, counts, history, shared],
  );
  const ranked = useMemo(
    () => recommendations(items, history),
    [items, history],
  );
  const [reason, setReason] = useState("");
  function open(m: Media) {
    if (shared)
      fetch("/api/views/" + m.id, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => {
          if (v) setCounts((c) => ({ ...c, [m.id]: v.count }));
        })
        .catch(() => {});
    setReason(ranked.find((r) => r.media.id === m.id)?.reason || "");
    change(m.id, { opened: true });
    setOverlay({ type: "player", id: m.id });
  }
  function go(p: Page) {
    setPage(p);
    setQuery("");
    setTopic("Tất cả");
    setKind("all");
    setFilter(false);
    setDrawer(false);
    window.scrollTo(0, 0);
  }
  const visible = ranked
    .map((r) => r.media)
    .filter((m) => {
      const s = history[m.id] || {};
      if (page === "Đã thích" && !s.liked) return false;
      if (page === "Đã lưu" && !s.saved) return false;
      if (page === "Studio" && m.owner !== "self") return false;
      if (["Khám phá", "Thịnh hành"].includes(page) && s.hidden) return false;
      return (
        (topic === "Tất cả" || topic === m.topic) &&
        (kind === "all" || kind === m.kind) &&
        normalize([m.title, m.author, m.topic, ...m.tags].join(" ")).includes(
          normalize(query),
        )
      );
    });
  if (page === "Thịnh hành") visible.sort((a, b) => b.views - a.views);
  if (page === "Studio") visible.sort((a, b) => b.created - a.created);
  const availableFeatures = features.filter((f) => !history[f.id]?.hidden);
  const f = availableFeatures.length
      ? availableFeatures[slide % availableFeatures.length]
      : null,
    hero = f ? catalog.find((m) => m.id === f.id)! : null;
  const showHero =
    page === "Khám phá" &&
    !query.trim() &&
    topic === "Tất cả" &&
    kind === "all" &&
    !!hero;
  const player =
    overlay?.type === "player"
      ? items.find((m) => m.id === overlay.id)
      : undefined;
  const mainTitle = query.trim()
    ? "Kết quả tìm kiếm"
    : page === "Khám phá"
      ? "Dành cho bạn"
      : page === "Studio"
        ? "Nội dung của bạn"
        : page;
  const uploadButton = (
    <button
      className="primary"
      disabled={shared === null}
      onClick={() => setOverlay({ type: "upload" })}
    >
      <FiPlus />
      Đăng nội dung
    </button>
  );
  return (
    <div className="shell">
      {drawer && (
        <button
          aria-label="Đóng menu"
          className="shade"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={drawer ? "sidebar open" : "sidebar"}>
        <button className="brand" onClick={() => go("Khám phá")}>
          <img src={asset("/frameflow.svg")} alt="" />
          Frameflow<span>.</span>
        </button>
        <nav>
          {nav.map(({ label, icon: Icon }, i) => (
            <React.Fragment key={label}>
              {[0, 2, 4].includes(i) && (
                <p className="navgroup">
                  {i === 0 ? "Bảng tin" : i === 2 ? "Thư viện" : "Nhà sáng tạo"}
                </p>
              )}
              <button
                className={"navitem " + (page === label ? "active" : "")}
                aria-current={page === label ? "page" : undefined}
                onClick={() => go(label)}
              >
                <Icon />
                {label === "Studio" ? "Creator Studio" : label}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <button
          className="account"
          onClick={() => {
            setDrawer(false);
            setOverlay({ type: "profile" });
          }}
        >
          <span className="avatar">
            <FiUser />
          </span>
          <span>
            <b>Người xem</b>
            <small>Hồ sơ sở thích</small>
          </span>
          <FiChevronRight />
        </button>
      </aside>
      <div className="maincol">
        <header>
          <div className="headerleft">
            <button
              className="mobilemenu icon"
              aria-label="Mở menu"
              onClick={() => setDrawer(true)}
            >
              <FiMenu />
            </button>
            <h1>{page === "Studio" ? "Creator Studio" : page}</h1>
          </div>
          <div className="headeractions">
            <label className="search">
              <FiSearch />
              <input
                aria-label="Tìm kiếm nội dung"
                ref={input}
                placeholder="Tìm kiếm nội dung..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button aria-label="Xóa tìm kiếm" onClick={() => setQuery("")}>
                  <FiX />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </label>
            {uploadButton}
          </div>
        </header>
        <main>
          {loadError && (
            <div className="warning">
              {loadError}{" "}
              <button onClick={() => setReload((v) => v + 1)}>Thử lại</button>
            </div>
          )}
          {showHero && hero && f && (
            <section
              className="hero"
              style={{ backgroundImage: "url(" + hero.cover + ")" }}
              aria-label="Nội dung tiêu điểm"
            >
              <div className="herotext">
                <span className="featurelabel">
                  <span /> VIDEO TIÊU ĐIỂM
                </span>
                <h2>{hero.title}</h2>
                <p>{f.description}</p>
                <div className="heroactions">
                  <button className="watch" onClick={() => open(hero)}>
                    <FiPlay fill="currentColor" />
                    Xem ngay
                  </button>
                  <button
                    className={
                      "herosave " + (history[hero.id]?.saved ? "on" : "")
                    }
                    aria-label="Lưu video tiêu điểm"
                    aria-pressed={!!history[hero.id]?.saved}
                    onClick={() =>
                      change(hero.id, { saved: !history[hero.id]?.saved })
                    }
                  >
                    {history[hero.id]?.saved ? <FiCheck /> : <FiBookmark />}
                  </button>
                </div>
              </div>
              <div className="heronav">
                <span>
                  {String((slide % availableFeatures.length) + 1).padStart(
                    2,
                    "0",
                  )}{" "}
                  <em>/ {String(availableFeatures.length).padStart(2, "0")}</em>
                </span>
                <button
                  aria-label="Tiêu điểm trước"
                  onClick={() =>
                    setSlide(
                      (s) =>
                        (s + availableFeatures.length - 1) %
                        availableFeatures.length,
                    )
                  }
                >
                  <FiChevronLeft />
                </button>
                <button
                  aria-label="Tiêu điểm tiếp theo"
                  onClick={() => setSlide((s) => s + 1)}
                >
                  <FiChevronRight />
                </button>
              </div>
            </section>
          )}
          <section className="feed">
            <div className="sectionrow">
              <div>
                <div className="eyebrow">
                  {page === "Khám phá" ? (
                    <FiActivity />
                  ) : page === "Studio" ? (
                    <FiLayers />
                  ) : (
                    <FiGrid />
                  )}
                  {page === "Khám phá"
                    ? "BẢNG TIN CÁ NHÂN"
                    : page === "Studio"
                      ? "CREATOR STUDIO"
                      : "BỘ SƯU TẬP"}
                </div>
                <h2>{mainTitle}</h2>
              </div>
              <button
                className={
                  "filter " + (filter || kind !== "all" ? "chosen" : "")
                }
                aria-expanded={filter}
                onClick={() => setFilter(!filter)}
              >
                <FiSliders />
                Bộ lọc
                <FiChevronDown />
              </button>
            </div>
            {filter && (
              <div className="filterpanel">
                <span>Định dạng</span>
                {[
                  ["all", "Tất cả"],
                  ["video", "Video"],
                  ["image", "Hình ảnh"],
                ].map(([k, n]) => (
                  <button
                    className={kind === k ? "chosen" : ""}
                    key={k}
                    onClick={() => setKind(k)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
            <div className="chips">
              {["Tất cả", ...topics].map((t) => (
                <button
                  className={topic === t ? "current" : ""}
                  aria-pressed={topic === t}
                  key={t}
                  onClick={() => setTopic(t)}
                >
                  {t === "Tất cả" && <FiGrid />}
                  {t}
                </button>
              ))}
            </div>
            {page === "Studio" && (
              <p className="studiohelp">
                <FiUploadCloud />
                {shared
                  ? "Nội dung bạn đăng được chia sẻ với người xem trên máy chủ này."
                  : "Nội dung được lưu trong trình duyệt này ở chế độ tĩnh."}
              </p>
            )}
            <div className="grid">
              {visible.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  open={() => open(item)}
                  saved={!!history[item.id]?.saved}
                  save={() =>
                    change(item.id, { saved: !history[item.id]?.saved })
                  }
                />
              ))}
            </div>
            {!visible.length && (
              <div className="empty">
                <FiFilm />
                <h3>
                  {query
                    ? "Không tìm thấy nội dung"
                    : page === "Studio"
                      ? "Đăng nội dung đầu tiên"
                      : page === "Đã lưu"
                        ? "Chưa có nội dung đã lưu"
                        : page === "Đã thích"
                          ? "Chưa có nội dung đã thích"
                          : "Chưa có nội dung phù hợp"}
                </h3>
                {page === "Studio" ? (
                  uploadButton
                ) : (
                  <button onClick={() => go("Khám phá")}>
                    <FiArrowLeft />
                    Về bảng tin
                  </button>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
      {overlay && (
        <Modal
          label={
            overlay.type === "upload"
              ? "Đăng nội dung"
              : overlay.type === "profile"
                ? "Hồ sơ sở thích"
                : player?.title || "Xem nội dung"
          }
          close={() => setOverlay(null)}
        >
          {overlay.type === "upload" && (
            <Upload
              shared={!!shared}
              onPublish={(m) => {
                localMedia.current.push(m);
                setUploads((v) => [m, ...v]);
                setOverlay(null);
                go("Studio");
                setNotice("Đã đăng nội dung thành công.");
              }}
            />
          )}
          {player && (
            <Player
              item={player}
              signal={history[player.id] || {}}
              reason={reason}
              change={(delta) => change(player.id, delta)}
              close={() => setOverlay(null)}
            />
          )}
          {overlay.type === "profile" && (
            <div className="details profile">
              <span className="avatar">
                <FiUser />
              </span>
              <h2>Hồ sơ sở thích</h2>
              <p className="muted">
                Bảng tin học từ các nội dung bạn mở, xem gần hết, thích và lưu
                trên trình duyệt này.
              </p>
              <div className="profilecounts">
                {[
                  ["Đã xem", "opened"],
                  ["Đã thích", "liked"],
                  ["Đã lưu", "saved"],
                ].map(([label, k]) => (
                  <div key={k}>
                    <b>
                      {
                        Object.values(history).filter(
                          (s) => s[k as keyof Signal],
                        ).length
                      }
                    </b>
                    <small>{label}</small>
                  </div>
                ))}
              </div>
              <button
                className="filter"
                onClick={() => {
                  localStorage.removeItem(historyKey);
                  setHistory({});
                  setOverlay(null);
                  setNotice("Đã đặt lại sở thích.");
                }}
              >
                Đặt lại sở thích
              </button>
            </div>
          )}
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <FiCheck />
          {notice}
        </div>
      )}
    </div>
  );
}
export default App;
