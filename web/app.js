"use strict";
const $ = (s) => document.querySelector(s);
const main = $("#main"),
  dialog = $("#dialog"),
  body = $("#dialog-body");
const svgPaths = {
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  heart:
    '<path d="M20 5c-3-3-7-1-8 1-2-3-6-4-9-1-4 4 2 9 9 15 7-6 13-12 8-15z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v13c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  bulb: '<path d="m13 2-8 12h6l-1 8 9-13h-6z"/>',
  filter:
    '<path d="M3 7h10m4 0h4M3 17h4m4 0h10"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  code: '<path d="m7 7-5 5 5 5m10-10 5 5-5 5m-4-14-2 18"/>',
};
const icon = (name) =>
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
  svgPaths[name] +
  "</svg>";
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmt = (n) => Number(n).toLocaleString("vi-VN");
const norm = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
const duration = (n) =>
  Math.floor(n / 60) + ":" + String(Math.ceil(n % 60)).padStart(2, "0");
const types = { video: "Video", image: "Ảnh" };
let store,
  page = "feed",
  topic = "",
  kind = "",
  query = "",
  search = false,
  slide = 0,
  selected = null,
  busy = false;
let toastTimer,
  revision = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3200);
}
async function api(url, opts = {}) {
  const res = await fetch(url, { cache: "no-store", ...opts });
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Không thể kết nối máy chủ.");
  return data;
}
async function refresh() {
  const rev = ++revision;
  const data = await api("/api/feed");
  if (rev === revision) {
    store = data;
    render();
  }
}
async function signal(id, action) {
  const payload = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
          (
            +c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
          ).toString(16),
        ),
    item: id,
    action,
  };
  const opts = {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Atlas": "1" },
    body: JSON.stringify(payload),
  };
  try {
    await api("/api/events", opts);
  } catch (e) {
    if (e instanceof TypeError) await api("/api/events", opts);
    else throw e;
  }
  await refresh();
}
function go(next) {
  if (!store) return;
  page = next;
  topic = "";
  kind = "";
  query = "";
  search = false;
  render();
  window.scrollTo({ top: 0 });
}
function card(m) {
  return (
    '<button class="card" data-open="' +
    esc(m.id) +
    '"><div class="thumb"><img loading="lazy" src="' +
    esc(m.cover) +
    '" alt=""><span class="type">' +
    icon(m.kind === "video" ? "film" : "image") +
    types[m.kind] +
    '</span><span class="time">' +
    (m.kind === "video" ? duration(m.seconds) : "JPG") +
    '</span></div><div class="cardtext"><small><i></i>' +
    esc(m.topic) +
    "</small><h3>" +
    esc(m.title) +
    '</h3><div class="by"><span>' +
    esc(m.source) +
    "</span><span>" +
    icon("eye") +
    fmt(m.views) +
    "</span></div></div></button>"
  );
}
function hero() {
  const available = store.items.filter((item) => !item.skipped && item.kind === "video").slice(0, 3);
  if (!available.length) return "";
  const i = slide % available.length;
  const m = available[i];
  return (
    '<section class="hero"><img class="heroimg" src="' +
    esc(m.cover) +
    '" alt="' +
    esc(m.title) +
    '"><div class="heroshade"></div><div class="herocopy"><span class="hero-label"><i></i> PHIM TIÊU ĐIỂM</span><h1>' +
    esc(m.title) +
    "</h1><p>" +
    esc(m.topic) +
    '</p><button class="lime" data-open="' +
    esc(m.id) +
    '">' +
    icon("play") +
    'Xem thước phim</button></div><div class="herofoot"><span>' + esc(m.source) + '</span><div><b>0' +
    (i + 1) +
    "</b> / 0" +
    available.length +
    ' <button aria-label="Tiêu điểm trước" data-slide="' +
    ((i + available.length - 1) % available.length) +
    '">' +
    icon("left") +
    '</button><button aria-label="Tiêu điểm sau" data-slide="' +
    ((i + 1) % available.length) +
    '">' +
    icon("right") +
    "</button></div></div></section>"
  );
}
function feed() {
  return (
    '<div class="pageline"><span><i class="status"></i> KHO TƯ LIỆU</span><span>' +
    fmt(store.items.length) +
    " TƯ LIỆU</span></div>" +
    (!search ? hero() : "") +
    '<section class="feed"><div class="secthead"><div class="titlewrap"><div class="sectionmark"></div><h2>Dành cho bạn</h2></div><label class="select">' +
    icon("filter") +
    '<select id="format" aria-label="Lọc định dạng"><option value="">Mọi định dạng</option><option value="video">Video</option><option value="image">Hình ảnh</option></select></label></div>' +
    (search
      ? '<div class="searchbox">' +
        icon("search") +
        '<input id="query" placeholder="Tìm theo tiêu đề, chủ đề hoặc thẻ" aria-label="Tìm tư liệu"><button id="end-search" aria-label="Đóng tìm kiếm">×</button></div>'
      : "") +
    '<div class="chips">' +
    ["", ...store.topics.filter((t) => store.items.some((m) => m.topic === t))]
      .map(
        (t) =>
          '<button data-topic="' +
          esc(t) +
          '" aria-pressed="' +
          (topic === t) +
          '" class="' +
          (topic === t ? "active" : "") +
          '">' +
          (!t ? icon("grid") : "") +
          esc(t || "Tất cả") +
          "</button>",
      )
      .join("") +
    '</div><div id="results" class="cards"></div></section>'
  );
}
function results() {
  const shown = store.items.filter(
    (m) =>
      !m.skipped &&
      (!topic || m.topic === topic) &&
      (!kind || kind === m.kind) &&
      norm([m.title, m.topic, ...m.tags].join(" ")).includes(norm(query)),
  );
  $("#results").innerHTML = shown.length
    ? shown.map(card).join("")
    : '<div class="empty">Chưa có tư liệu phù hợp với lựa chọn này.</div>';
}
function studio() {
  const own = store.items.filter((m) => m.mine);
  return (
    '<section class="intro"><div class="kicker">' +
    icon("upload") +
    ' NHÀ CUNG CẤP</div><h1>Provider Studio</h1><p>Đăng tư liệu để đưa vào thư viện chung. Máy chủ đọc tệp, tạo ảnh bìa và tính đặc trưng cho hệ thống đề xuất.</p><button class="dark" data-upload> ' +
    icon("plus") +
    ' Đăng tư liệu</button></section><div class="secthead"><h2>Tư liệu của bạn</h2><span>' +
    own.length +
    ' mục</span></div><div class="cards">' +
    (own.map(card).join("") ||
      '<div class="empty">' +
        icon("layers") +
        "<h3>Bạn chưa đăng tư liệu nào</h3><p>Chọn một video hoặc ảnh để thử luồng xử lý dữ liệu.</p></div>") +
    "</div>"
  );
}
function dataPage() {
  const s = store.stats,
    e = s.events,
    total = Object.values(e).reduce((a, b) => a + b, 0);
  return (
    '<section class="intro"><div class="kicker">' +
    icon("db") +
    ' DATA EXPLORER</div><h1>Dữ liệu & kiến trúc</h1><p>Số liệu từ danh mục và nhật ký trực tiếp của phiên bản web.</p></section><div class="metrics">' +
    [
      [s.analyzedFrames, "Khung hình đã phân tích"],
      [store.items.length, "Tư liệu trong kho"],
      [total, "Sự kiện đã ghi"],
      [s.viewers, "Hồ sơ đã tương tác"],
    ]
      .map(
        ([v, l]) =>
          "<div><strong>" + fmt(v) + "</strong><span>" + l + "</span></div>",
      )
      .join("") +
    '</div><section class="panel"><h2>Luồng xử lý</h2><div class="pipeline">' +
    [
      ["01", "Tiếp nhận", "Tiếp nhận tệp do provider đăng."],
      ["02", "Trích xuất", "FFmpeg giải mã khung hình, đo màu và chuyển động."],
      [
        "03",
        "Lưu trữ",
        "SQLite lưu metadata, sự kiện và trạng thái từng người xem.",
      ],
      [
        "04",
        "Đề xuất",
        "Xếp hạng theo đặc trưng nội dung và phản hồi của người xem.",
      ],
    ]
      .map(
        ([n, t, p]) =>
          "<article><small>" +
          n +
          "</small><h3>" +
          t +
          "</h3><p>" +
          p +
          "</p></article>",
      )
      .join("") +
    '</div></section><div class="twocol"><section class="panel"><h2>Nguồn dữ liệu nghiên cứu</h2><p>MicroLens cung cấp nội dung video. KuaiRand cung cấp log để hiệu chỉnh hành vi mô phỏng. Tệp phát lại được thiết kế riêng cho pipeline streaming.</p><p><a href="https://github.com/westlake-repl/MicroLens" target="_blank" rel="noreferrer">MicroLens</a> · <a href="https://github.com/chongminggao/KuaiRand" target="_blank" rel="noreferrer">KuaiRand</a></p></section><section class="panel"><h2>Nhật ký tương tác</h2>' +
    [
      ["open", "Mở tư liệu"],
      ["complete", "Xem ít nhất 75%"],
      ["like", "Thích"],
      ["unlike", "Bỏ thích"],
      ["skip", "Bỏ qua"],
    ]
      .map(
        ([k, l]) =>
          '<div class="statrow"><span>' +
          l +
          "</span><b>" +
          fmt(e[k] || 0) +
          "</b></div>",
      )
      .join("") +
    "</section></div>"
  );
}
function render() {
  document
    .querySelectorAll("nav [data-page]")
    .forEach((el) =>
      el.setAttribute(
        "aria-current",
        el.dataset.page === page ? "page" : "false",
      ),
    );
  main.innerHTML =
    page === "data"
      ? dataPage()
      : page === "studio"
        ? studio()
        : feed();
  if (page === "feed") {
    $("#format").value = kind;
    $("#format").onchange = (e) => {
      kind = e.target.value;
      results();
    };
    if (search) {
      $("#query").value = query;
      $("#query").oninput = (e) => {
        query = e.target.value;
        results();
      };
      $("#end-search").onclick = () => {
        query = "";
        search = false;
        render();
      };
    }
    results();
  }
}
function show(markup) {
  body.innerHTML = markup;
  if (!dialog.open) dialog.showModal();
}
function close() {
  if (busy) return;
  dialog.close();
}
dialog.onclose = () => {
  body.innerHTML = "";
  selected = null;
};
dialog.oncancel = (e) => {
  if (busy) e.preventDefault();
};
dialog.onclick = (e) => {
  if (e.target === dialog) close();
};
$("#close").onclick = close;
function openItem(id) {
  const m = store.items.find((it) => it.id === id);
  if (!m) return;
  selected = id;
  show(
    '<div class="player">' +
      (m.kind === "video"
        ? '<video src="' +
          esc(m.src) +
          '" poster="' +
          esc(m.cover) +
          '" controls autoplay playsinline></video>'
        : '<img src="' + esc(m.src) + '" alt="' + esc(m.title) + '">') +
      '</div><div class="detail"><div class="kicker">' +
      esc(m.topic) +
      " / " +
      types[m.kind] +
      "</div><h2>" +
      esc(m.title) +
      '</h2><div class="reason">' +
      icon("bulb") +
      "<div><b>Vì sao bạn thấy tư liệu này?</b><p>" +
      esc(m.reason) +
      '</p></div></div><div class="actions"><button id="like" class="dark">' +
      icon("heart") +
      (m.liked ? "Đã thích" : "Thích") +
      '</button><button id="skip" class="outline">Bỏ qua</button></div><details><summary>Metadata và nguồn</summary><div class="detailmeta">' +
      [
        ["Nguồn", m.source],
        ["Độ phân giải", m.width + " × " + m.height],
        ["Số khung hình", m.frames],
        ["Chuyển động trung bình", fmt(m.motion)],
        ["Thẻ ngữ nghĩa", m.tags.join(", ") || "—"],
        ...(m.url
          ? [
              [
                "Vị trí trong video gốc",
                fmt(m.start) + " – " + fmt(m.end) + " giây",
              ],
            ]
          : []),
      ]
        .map(
          ([k, v]) =>
            '<div class="statrow"><span>' +
            k +
            "</span><b>" +
            esc(v) +
            "</b></div>",
        )
        .join("") +
      "</div></details></div>",
  );
  signal(id, "open").catch((e) => toast(e.message));
  const like = $("#like");
  like.onclick = async () => {
    like.disabled = true;
    const liked = store.items.find((x) => x.id === id).liked;
    try {
      await signal(id, liked ? "unlike" : "like");
      like.innerHTML = icon("heart") + (liked ? "Thích" : "Đã thích");
      toast("Đã cập nhật bảng tin.");
    } catch (e) {
      toast(e.message);
    } finally {
      like.disabled = false;
    }
  };
  $("#skip").onclick = async () => {
    try {
      await signal(id, "skip");
      close();
      toast("Đã giảm đề xuất tương tự.");
    } catch (e) {
      toast(e.message);
    }
  };
  const video = body.querySelector("video");
  if (video) {
    let completed = false;
    const check = () => {
      if (completed || !video.duration) return;
      let played = 0;
      for (let j = 0; j < video.played.length; j++)
        played += video.played.end(j) - video.played.start(j);
      if (played >= video.duration * 0.75) {
        completed = true;
        signal(id, "complete").catch(() => {
          completed = false;
        });
      }
    };
    video.ontimeupdate = check;
    video.onended = check;
  }
}
function upload() {
  if (!store) return;
  show(
    '<form id="upload-form" class="detail uploadform"><div class="kicker">' +
      icon("upload") +
      ' PROVIDER STUDIO</div><h2>Đăng tư liệu</h2><p>Máy chủ sẽ trích metadata và thêm tư liệu vào bảng tin.</p><label class="filefield">Chọn ảnh hoặc video<input required type="file" id="file" accept="video/mp4,video/webm,image/jpeg,image/png,image/webp"><small>Tối đa 32 MB · Video tối đa 90 giây</small></label><label>Tiêu đề<input id="title" required maxlength="100"></label><label>Chủ đề<select id="topic" aria-label="Chủ đề">' +
      store.topics.map((t) => "<option>" + esc(t) + "</option>").join("") +
      '</select></label><label>Thẻ mô tả<input id="tags" maxlength="160" placeholder="Ví dụ: biển, thể thao"></label><div id="formmsg" role="status"></div><button class="dark" id="post">Đăng và xử lý ' +
      icon("arrow") +
      "</button></form>",
  );
  $("#file").onchange = () => {
    if (!$("#title").value)
      $("#title").value =
        $("#file")
          .files[0]?.name.replace(/\.[^.]+$/, "")
          .slice(0, 100) || "";
  };
  $("#upload-form").onsubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const f = $("#file").files[0];
    const msg = $("#formmsg");
    if (!f || f.size > 32 * 1024 * 1024) {
      msg.textContent = "Tệp tối đa 32 MB.";
      return;
    }
    busy = true;
    $("#post").disabled = true;
    $("#close").disabled = true;
    msg.textContent = "Đang đọc khung hình và tạo ảnh bìa…";
    try {
      await api(
        "/api/media?" +
          new URLSearchParams({
            title: $("#title").value,
            topic: $("#topic").value,
            tags: $("#tags").value,
          }),
        {
          method: "POST",
          headers: { "Content-Type": f.type, "X-Atlas": "1" },
          body: f,
        },
      );
      await refresh();
      busy = false;
      close();
      go("studio");
      toast("Đã đăng tư liệu.");
    } catch (err) {
      msg.textContent = err.message;
    } finally {
      busy = false;
      $("#close").disabled = false;
      if ($("#post")) $("#post").disabled = false;
    }
  };
}
document.onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.hasAttribute("data-page")) go(b.dataset.page);
  if (b.hasAttribute("data-open")) openItem(b.dataset.open);
  if (b.hasAttribute("data-topic")) {
    topic = b.dataset.topic;
    render();
  }
  if (b.hasAttribute("data-upload")) upload();
  if (b.hasAttribute("data-slide")) {
    slide = Number(b.dataset.slide);
    render();
  }
};
$("#upload-trigger").onclick = upload;
$("#search-trigger").onclick = () => {
  if (!store) return;
  go("feed");
  search = true;
  render();
  $("#query").focus();
};
refresh().catch((e) => {
  main.textContent =
    "Chưa tải được thư viện. Hãy kiểm tra máy chủ rồi tải lại trang. " +
    e.message;
});
