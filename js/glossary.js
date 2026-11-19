/*
 * Siatka Powiązań — Kartoteka w grze: hasła w aktach, notatniku i podpowiedziach (kropkowane podkreślenie),
 * karta hasła (fiszka z kartoteki) po stuknięciu i lista widzianych haseł w Ustawieniach.
 *
 * Skąd gra wie, gdzie jest hasło:
 *  - treści z znacznikami (EN): generator zostawia w aktach, notatniku i podpowiedziach „{g:id|tekst}” (glossaryPass w engine.js),
 *  - treści bez znaczników (PL): formy słowa z pola `forms` w data/i18n/<język>/glossary.js, wyszukiwane w tekście
 *    (całe słowa; forma z małej litery pasuje też z wielkiej). Sprawy się nie zmieniają, działa też dla starych zapisów.
 * Hasło pokazuje się w języku interfejsu (SiatkaI18n.glossaryEntry), formy biorą się z języka treści sprawy.
 * Widziane hasła (wyświetlone w aktach albo notatniku): siatka-glossary (lista id).
 * API: SiatkaGloss.html(tekst, rich, językSprawy), open(id, element), close(), seen(), listHtml(), plain(tekst)
 */
(() => {
const I = window.SiatkaI18n;
const SKEY = "siatka-glossary";
const MARK = /\{g:([\w-]+)\|([^{}]*)\}/g;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------- widziane hasła ---------- */
let SEEN = (() => { try { const a = JSON.parse(localStorage.getItem(SKEY) || "[]"); return new Set(Array.isArray(a) ? a : []); } catch (_) { return new Set(); } })();
let saveT = 0;
function see(id) {
  if (SEEN.has(id)) return;
  SEEN.add(id); clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(SKEY, JSON.stringify([...SEEN])); } catch (_) {} }, 200);
}

/* ---------- formy haseł języka bez znaczników ---------- */
const FORMS = {};
function formsRe(lang) {
  if (lang in FORMS) return FORMS[lang];
  const p = I.packs[lang], g = p && p.content && p.content.glossary, map = new Map();
  if (g) for (const [id, e] of Object.entries(g)) for (const f of e.forms || []) {
    map.set(f, id);
    if (f[0] !== f[0].toUpperCase()) map.set(f[0].toUpperCase() + f.slice(1), id);
  }
  const alts = [...map.keys()].sort((a, b) => b.length - a.length).map(reEsc);
  return (FORMS[lang] = alts.length ? { re: new RegExp(`(?<![\\p{L}\\d])(?:${alts.join("|")})(?![\\p{L}\\d])`, "gu"), map } : null);
}

/* tekst bez znaczników + odcinki z hasłami [{ a, b, id }] (pozycje w tym tekście) */
function spans(s, lang) {
  s = String(s);
  const out = [];
  if (s.indexOf("{g:") >= 0) {
    let plain = "", last = 0, m;
    MARK.lastIndex = 0;
    while ((m = MARK.exec(s))) {
      plain += s.slice(last, m.index);
      out.push({ a: plain.length, b: plain.length + m[2].length, id: m[1] });
      plain += m[2]; last = MARK.lastIndex;
    }
    return { plain: plain + s.slice(last), spans: out };
  }
  const F = formsRe(lang);
  if (F) { F.re.lastIndex = 0; let m; while ((m = F.re.exec(s))) out.push({ a: m.index, b: m.index + m[0].length, id: F.map.get(m[0]) }); }
  return { plain: s, spans: out };
}

/* HTML: rich(tekst) z podkreślonymi hasłami. rich nie zmienia znaków tekstu, tylko dokłada znaczniki <b …>, więc
   pozycje hasła liczymy w tekście, a w HTML pomijamy znaczniki; hasło przecięte znacznikiem dzieli się na dwa kawałki. */
function html(s, rich, lang) {
  const { plain, spans: sp } = spans(s, lang || I.lang);
  const h = rich ? rich(plain) : esc(plain);
  const use = sp.filter(x => I.glossaryEntry(x.id));
  if (!use.length) return h;
  use.forEach(x => see(x.id));
  const open = id => `<span class="gl" data-g="${id}" role="button" tabindex="0">`;
  let out = "", pos = 0, k = 0, cur = null;
  for (let i = 0; i < h.length; i++) {
    const ch = h[i];
    if (ch === "<") {
      const j = h.indexOf(">", i); const tag = h.slice(i, j + 1);
      out += cur ? "</span>" + tag + open(cur.id) : tag;
      i = j; continue;
    }
    if (!cur && k < use.length && pos === use[k].a) { cur = use[k]; out += open(cur.id); }
    out += ch; pos++;
    if (cur && pos === cur.b) { out += "</span>"; cur = null; k++; }
  }
  if (cur) out += "</span>";
  return out.replace(/<span class="gl"[^>]*><\/span>/g, "");
}
const plain = s => (I.glossaryPlain ? I.glossaryPlain(s) : s);

/* ---------- karta hasła ---------- */
const st = document.createElement("style");
st.textContent = `
.gl{border-bottom:1.5px dotted currentColor;cursor:pointer;-webkit-tap-highlight-color:transparent;border-radius:1px}
.gl:hover,.gl:focus-visible{background:rgba(217,166,72,.28);outline:none}
.gl.on{background:rgba(217,166,72,.42)}
.gl-card{position:fixed;z-index:30;left:8px;top:8px;width:min(21em,calc(100vw - 16px));max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;
  background:#f6efdc;color:var(--ink);font-family:var(--f-type);font-size:14px;line-height:1.45;padding:.6em .9em .8em;
  border-radius:3px;box-shadow:0 6px 18px rgba(0,0,0,.55);
  background-image:linear-gradient(transparent 2.15em,rgba(179,38,30,.55) 2.15em,rgba(179,38,30,.55) calc(2.15em + 1.5px),transparent calc(2.15em + 1.5px)),
    repeating-linear-gradient(transparent 0 1.45em,rgba(70,110,160,.16) 1.45em calc(1.45em + 1px));
  background-position:0 0,0 .55em;transform-origin:50% 100%;animation:glIn .18s ease-out}
.gl-card[hidden]{display:none}
@keyframes glIn{from{opacity:0;transform:translateY(6px) rotate(-.4deg)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.gl-card{animation:none}}
.gl-card .gl-top{display:flex;align-items:center;gap:.5em;min-height:1.6em;margin-bottom:.45em}
.gl-card .gl-k{flex:1;font-family:var(--f-body);font-size:.75em;letter-spacing:.14em;text-transform:uppercase;color:var(--stamp)}
.gl-card .gl-x{flex:none;min-width:2.75em;min-height:2.75em;margin:-.5em -.6em -.5em 0;border:none;background:transparent;color:var(--ink);
  font:700 1.25em/1 var(--f-body);cursor:pointer;border-radius:50%}
.gl-card .gl-x:focus-visible{outline:2px solid var(--stamp)}
.gl-card h4{margin:0;font-family:var(--f-pixel);font-weight:600;font-size:1.15em;line-height:1.25}
.gl-card .gl-n{font-family:var(--f-body);font-size:.8em;color:var(--ink-soft);margin-top:.1em}
.gl-card p{margin:.45em 0 0}
.gl-list{display:flex;flex-direction:column;gap:10px;margin-top:8px}
.gl-list .gl-e{background:#f6efdc;color:var(--ink);padding:8px 10px;border-left:3px solid var(--stamp);font-family:var(--f-type);font-size:13.5px;line-height:1.45}
.gl-list .gl-e b{font-family:var(--f-pixel);font-weight:600;font-size:15px}
.gl-list .gl-e small{font-family:var(--f-body);color:var(--ink-soft);margin-left:6px;font-size:12px}
.gl-list .gl-e p{margin:3px 0 0}
.gl-empty{font-size:13.5px;line-height:1.45;opacity:.85}`;
document.head.appendChild(st);

let card = null, anchor = null;
function ensureCard() {
  if (card) return card;
  card = document.createElement("div");
  card.className = "gl-card"; card.id = "glCard"; card.hidden = true;
  card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "false"); card.setAttribute("aria-labelledby", "glTerm");
  document.body.appendChild(card);
  return card;
}
function close() {
  if (!card || card.hidden) return;
  card.hidden = true;
  if (anchor) { anchor.classList.remove("on"); if (document.body.contains(anchor)) try { anchor.focus({ preventScroll: true }); } catch (_) {} }
  anchor = null;
}
function place(el) {
  const r = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight, M = 8;
  // przyciski akcji (Podpowiedź, Oskarż) i pasek wyniku zostają odkryte: karta kończy się nad nimi
  const acts = [...document.querySelectorAll(".actions")].map(a => a.getBoundingClientRect()).filter(a => a.height && a.top > 0);
  const floor = Math.min(vh - M, ...acts.map(a => a.top - M));
  card.style.maxHeight = ""; card.style.left = M + "px"; card.style.top = M + "px";
  const w = card.offsetWidth;
  card.style.left = Math.max(M, Math.min(vw - w - M, r.left + r.width / 2 - w / 2)) + "px";
  let h = card.offsetHeight, top;
  if (r.top - M - h >= M) top = r.top - M - h;                        // nad hasłem (zwykle nad aktami, na tablicy)
  else if (r.bottom + M + h <= floor) top = r.bottom + M;             // pod hasłem
  else { top = M; const room = Math.max(120, Math.min(r.top - 2 * M, floor - M)); card.style.maxHeight = room + "px"; h = Math.min(h, room); if (r.top - M - h >= M) top = r.top - M - h; }
  card.style.top = Math.max(M, top) + "px";
}
function open(id, el) {
  const e = I.glossaryEntry(id);
  if (!e) return;
  ensureCard();
  if (anchor) anchor.classList.remove("on");
  anchor = el || null; if (anchor) anchor.classList.add("on");
  see(id);
  card.innerHTML = `<div class="gl-top"><span class="gl-k">${esc(t("ui.gloss.title"))}</span>`
    + `<button class="gl-x" id="glClose" aria-label="${esc(t("ui.gloss.close"))}" title="${esc(t("ui.gloss.close"))}">×</button></div>`
    + `<h4 id="glTerm">${esc(e.term)}</h4>${e.note ? `<div class="gl-n">${esc(e.note)}</div>` : ""}<p>${esc(e.text)}</p>`;
  card.dataset.g = id;
  card.hidden = false;
  if (el) place(el); else { card.style.left = "8px"; card.style.top = "8px"; }
  card.querySelector("#glClose").onclick = ev => { ev.stopPropagation(); close(); };
  if (window.SiatkaAudio && window.SiatkaAudio.sfx) window.SiatkaAudio.sfx("paper");
  if (window.SiatkaTrack) window.SiatkaTrack("kartoteka/" + id);
}

/* stuknięcie albo klik w hasło (myszka i dotyk dają click), Enter/spacja z klawiatury; poza kartą zamyka */
document.addEventListener("click", ev => {
  const g = ev.target.closest && ev.target.closest(".gl");
  if (g) { ev.stopPropagation(); ev.preventDefault(); if (card && !card.hidden && anchor === g) close(); else open(g.dataset.g, g); return; }
  if (card && !card.hidden && !card.contains(ev.target)) close();
}, true);
document.addEventListener("keydown", ev => {
  if (ev.key === "Escape" && card && !card.hidden) { ev.stopPropagation(); close(); return; }
  const g = ev.target.closest && ev.target.closest(".gl");
  if (g && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); open(g.dataset.g, g); }
}, true);
addEventListener("resize", close);
document.addEventListener("scroll", ev => { if (card && !card.hidden && !card.contains(ev.target)) close(); }, true);

/* ---------- lista w Ustawieniach ---------- */
function listHtml() {
  const all = [...SEEN].map(id => ({ id, e: I.glossaryEntry(id) })).filter(x => x.e);
  const coll = (() => { try { return new Intl.Collator(I.lang); } catch (_) { return null; } })();
  const key = s => s.replace(/^[„“"«»]+/, "");
  all.sort((a, b) => coll ? coll.compare(key(a.e.term), key(b.e.term)) : key(a.e.term) < key(b.e.term) ? -1 : 1);
  const total = Object.keys((I.packs.pl.content && I.packs.pl.content.glossary) || {}).length;
  const body = all.length
    ? `<p class="gl-empty">${esc(t("ui.gloss.count", { n: all.length, all: total }))}</p><div class="gl-list">` + all.map(({ id, e }) =>
      `<div class="gl-e" data-g="${id}"><b>${esc(e.term)}</b>${e.note ? `<small>${esc(e.note)}</small>` : ""}<p>${esc(e.text)}</p></div>`).join("") + "</div>"
    : `<p class="gl-empty">${esc(t("ui.gloss.empty"))}</p>`;
  return t("ui.gloss.list_html", { body });
}

window.SiatkaGloss = { html, spans, open, close, seen: () => [...SEEN], listHtml, plain };
})();
