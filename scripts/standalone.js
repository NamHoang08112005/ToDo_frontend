// Package the production build for opening directly in a browser during a presentation.
const fs = require("node:fs");
const path = require("node:path");
const build = path.resolve(__dirname, "../build");
const read = (file) => fs.readFileSync(path.join(build, file));
const data = (file, mime) =>
  "data:" + mime + ";base64," + read(file).toString("base64");
const files = JSON.parse(read("asset-manifest.json")).files;
const assets = { "/frameflow.svg": data("frameflow.svg", "image/svg+xml") };
for (const name of fs.readdirSync(path.join(build, "media"))) {
  assets["/media/" + name] = data(
    "media/" + name,
    name.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
  );
}
const fonts = read("fonts/fonts.css")
  .toString()
  .replace(
    /url\(([^)]+)\)/g,
    (_, file) => "url(" + data("fonts/" + file, "font/woff2") + ")",
  );
const script = read(files["main.js"])
  .toString()
  .replace(/<\/script/gi, "<\\/script");
const licenses = [
  read("fonts/LICENSE"),
  read(files["main.js"] + ".LICENSE.txt"),
].join("\n");
const html =
  '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Frameflow · Khám phá</title><link rel="icon" href="' +
  assets["/frameflow.svg"] +
  '"><style>' +
  fonts +
  "\n" +
  read(files["main.css"]) +
  '</style><body><div id="root"></div><script>window.frameflowAssets=' +
  JSON.stringify(assets) +
  ";<\/script><script>" +
  script +
  "<\/script><script type='application/json' id='licenses'>" +
  JSON.stringify(licenses).replace(/</g, "\\u003c") +
  "</script></body></html>";
const dest = process.argv[2] || path.join(build, "Frameflow.html");
fs.writeFileSync(dest, html);
console.log(dest);
