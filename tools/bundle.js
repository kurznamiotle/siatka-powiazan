#!/usr/bin/env node
/* Skleja grę w jeden plik: dist/siatka.html (do wysłania komuś albo wrzucenia gdziekolwiek). */
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => `<script>\n${fs.readFileSync(path.join(root, src), "utf8")}\n</script>`);
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "siatka.html"), html);
console.log("dist/siatka.html", (html.length / 1024).toFixed(0) + " KB");
if (process.argv[2]) { // wersja bez <html>/<head>/<body> (np. do artefaktu)
  const body = html.slice(html.indexOf("<title>")).replace("</head>\n<body>\n", "").replace("</body>\n</html>\n", "");
  fs.writeFileSync(process.argv[2], body);
}
