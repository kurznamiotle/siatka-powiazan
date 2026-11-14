/*
 * Siatka Powiązań — samouczek „Jak grać”: 4 animowane plansze na miniaturze tablicy.
 * Portrety i nazwy pochodzą z prawdziwej sprawy demonstracyjnej z generatora (seed „samouczek”).
 * Bez animacji (prefers-reduced-motion) każda plansza pokazuje stan końcowy.
 * API: SiatkaHowto.open(poZamknieciu), SiatkaHowto.seen()
 */
(() => {
const $ = id => document.getElementById(id);
const AU = window.SiatkaAudio || { sfx() {} };
const KEY = "siatka-howto";
const sprite = window.SiatkaSprites.svg;

let D = null;
function demo() {
  if (D) return D;
  // plansze potrzebują 3 osób, 2 miejsc i 2 przedmiotów; kolejne seedy, aż układ pasuje (zmiana generatora zmienia sprawę)
  let c;
  for (let k = 0; k < 40; k++) {
    c = Siatka.generateCase(SiatkaI18n.world(), k ? "samouczek-" + k : "samouczek", { size: "S", city: "warszawa", year: 1994, archetype: "classic" });
    const n = t => c.nodes.filter(x => x.type === t).length;
    if (n("person") >= 3 && n("location") >= 2 && n("item") >= 2) break;
  }
  window.SiatkaSprites.tidyPortraits(c);
  const of = t => c.nodes.filter(n => n.type === t);
  D = { P: of("person"), L: of("location"), I: of("item") };
  return D;
}
const form = (loc, i, fb) => (loc && loc.forms && loc.forms[i]) || fb;
/* polaroid + pinezka; x, y = lewy górny róg, w = szerokość */
function pol(n, x, y, o = {}) {
  const w = o.w || 52, r = o.r ?? 0, room = w - 8;
  const fit = s => Math.min(8, Math.floor(room / (s.length * 0.62) * 10) / 10);
  let lb = n.label, fs = fit(lb);
  if (fs < 7) { lb = n.label.split(" ")[0]; fs = Math.max(6, fit(lb)); }
  return `<div class="hw-p ${n.type === "person" ? "" : "thing"} ${o.cls || ""}" style="left:${x}px;top:${y}px;width:${w}px;--r:${r}deg">` +
    `<span class="ph">${sprite(n.sprite)}</span>${o.nolabel ? '<span class="lb"></span>' : `<span class="lb" style="font-size:${fs}px">${lb}</span>`}${o.x ? `<i class="hw-x"></i>` : ""}</div>` +
    (o.pin === false ? "" : `<i class="hw-pin" style="left:${x + w / 2}px;top:${y + 3}px"></i>`);
}
const F = `<i class="hw-f"></i>`;
const fxT = s => `<b class="fx fx-t">${s}</b>`, l = s => `<b class="fx fx-l">${s}</b>`, k = s => `<b class="fx fx-k">${s}</b>`;

const SLIDES = [
  {
    s: 2,
    title: t("ui.tutorial.tablica_i_akta"),
    text: t("ui.tutorial.codziennie_nowa_sprawa_z_lat_90"),
    tip: t("ui.tutorial.na_tablicy_wisza_podejrzani_miejsca_i"),
    scene() {
      const { P, L } = demo(), p = P[0], f = p.g === "f";
      return t("ui.tutorial.widziano_o_ma_do_od_html", { pol: pol(p, 20, 50, { w: 66, r: -2, cls: "pick" }), name: p.name, v: f ? t("ui.tutorial.ja") : "go", l: l(form(L[0], 1, t("ui.tutorial.na_miejscu"))), fxT: fxT("19:40"), k: k(t("ui.tutorial.klucz")), l2: l(form(L[1], 0, t("ui.tutorial.piwnicy"))), fxT2: fxT("19:00"), v2: f ? t("ui.tutorial.spala") : t("ui.tutorial.spal"), k2: k(t("ui.tutorial.swiadkow")) });
    }
  },
  {
    s: 4,
    title: t("ui.tutorial.sznurek"),
    text: t("ui.tutorial.przeciagnij_sznurek_od_pinezki_do_pinezki"),
    tip: t("ui.tutorial.sznurki_to_twoje_notatki_gra_nie"),
    scene() {
      const { P, L, I } = demo();
      return `<div class="hw-cork"></div>${pol(P[0], 21, 18, { r: -2 })}${pol(L[0], 177, 62, { r: 2 })}${pol(I[0], 97, 116, { r: -1 })}
        <i class="hw-ring g1" style="left:203px;top:65px"></i><i class="hw-ring g1" style="left:123px;top:119px"></i><i class="hw-ring g2" style="left:123px;top:119px"></i>
        <svg class="hw-str" viewBox="0 0 264 196"><path class="s1" pathLength="1" d="M47,21 Q125,56 203,65"/><path class="s2" pathLength="1" d="M203,65 Q163,104 123,119"/></svg>${F}`;
    }
  },
  {
    s: 3,
    title: t("ui.tutorial.notatnik_i_wykluczanie"),
    text: t("ui.tutorial.sprawca_spelnia_wszystkie_reguly_z_notatnika"),
    tip: t("ui.tutorial.ten_kto_nie_lamie_zadnej_reguly"),
    scene() {
      const { P, L } = demo();
      const tag = (txt, y, cls) => `<span class="hw-tag2 ${cls}" style="top:${y}px">${txt}</span>`;
      return t("ui.tutorial.notatnik_sprawca_ma_do_nie_html", { k: k(t("ui.tutorial.klucz")), l: l(form(L[0], 0, t("ui.tutorial.garazu"))), k2: k(t("ui.tutorial.alibi")), fxT: fxT("19:00"), fxT2: fxT("19:30"), join: P.map((n, i) => pol(n, 178, 12 + i * 62, { w: 36, pin: false, nolabel: true, cls: i === 2 ? "win" : "" })).join(""), tag: tag(t("ui.tutorial.lamie_br_1"), 22, "a1"), tag2: tag(t("ui.tutorial.lamie_br_3"), 84, "a2"), tag3: tag(t("ui.tutorial.spelnia_br_wszystkie"), 146, "a3 ok") });
    }
  },
  {
    s: 6,
    title: t("ui.tutorial.oskarzenie"),
    text: t("ui.tutorial.gdy_wiesz_kto_i_czym_stuknij"),
    tip: t("ui.tutorial.podpowiedz_nie_zdradza_odpowiedzi_wskazuje_r"),
    scene() {
      const { P, I } = demo();
      return t("ui.tutorial.oskarz_akt_oskarzenia_sprawca_narzedzie_html", { name: P[2].name, toLowerCase: I[1].name.toLowerCase(), F });
    }
  }
];

const CSS = `
.overlay.howto{align-items:center}
.hw-card{max-width:420px;padding:14px 16px 16px}
.hw-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.hw-step{font-family:var(--f-pixel);font-size:13px;color:var(--ink-soft);letter-spacing:.06em}
.hw-skip{background:rgba(0,0,0,.06);border:1px solid var(--ink-soft);border-radius:4px;font-family:var(--f-body);font-size:14px;color:var(--ink);padding:6px 12px;min-height:34px}
.hw-stage{position:relative;width:264px;height:196px;max-width:100%;margin:0 auto 12px;overflow:hidden;border-radius:3px;touch-action:pan-y;user-select:none}
.hw-card h3{margin:0 0 4px}
.hw-txt{margin:0;font-size:14.5px;line-height:1.45;min-height:4.4em}
.hw-tip{margin:8px 0 0;font-family:var(--f-body);font-size:12.5px;color:var(--ink-soft);border-top:1px dashed var(--paper-shade);padding-top:8px}
.hw-dots{display:flex;justify-content:center;gap:8px;margin-top:12px}
.hw-dots button{width:10px;height:10px;padding:0;border:2px solid var(--ink);background:transparent}
.hw-dots button[aria-current="step"]{background:var(--stamp);border-color:var(--stamp)}
.hw-cork,.hw-desk{position:absolute;inset:0}
.hw-cork{background:radial-gradient(circle at 20% 30%,rgba(0,0,0,.13) 0 1.5px,transparent 2px) 0 0/9px 11px,radial-gradient(circle at 70% 60%,rgba(255,230,190,.1) 0 1px,transparent 1.6px) 0 0/7px 8px,radial-gradient(ellipse at 50% 40%,var(--cork) 0%,var(--cork-deep) 120%);box-shadow:inset 0 0 0 4px #4a3423,inset 0 0 0 5px #2c1f15,inset 0 0 26px rgba(0,0,0,.45)}
.hw-desk{background:var(--desk);box-shadow:inset 0 0 0 3px var(--desk-edge)}
.hw-p{position:absolute;padding:4px 4px 0;background:var(--paper);box-shadow:0 2px 4px rgba(0,0,0,.45);transform:rotate(var(--r));text-align:center}
.hw-p .ph{display:block;aspect-ratio:1/1;background:#2a2622;image-rendering:pixelated}
.hw-p.thing .ph{background:#3b4a52}
.hw-p .ph svg{display:block;width:100%;height:100%}
.hw-p .lb{display:block;font-family:var(--f-type);font-size:8px;line-height:11px;height:17px;padding:3px 0 3px;color:var(--ink);white-space:nowrap;overflow:hidden}
.hw-pin{position:absolute;z-index:3;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff3c4 0 1px,var(--brass) 2px,#8a6420 100%);box-shadow:0 1px 1px rgba(0,0,0,.5)}
.hw-ring{position:absolute;z-index:2;width:20px;height:20px;margin:-10px 0 0 -10px;border:2px solid var(--brass);border-radius:50%;opacity:0}
.hw-f{position:absolute;z-index:6;left:0;top:0;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:rgba(255,243,196,.5);border:2px solid #fff3c4;box-shadow:0 0 0 4px rgba(255,243,196,.18),0 2px 6px rgba(0,0,0,.4);opacity:0;pointer-events:none}
.hw-tag{position:absolute;font-family:var(--f-pixel);font-size:11px;letter-spacing:.04em;color:var(--ink);background:var(--paper-shade);padding:2px 6px;transform:rotate(-3deg);box-shadow:0 1px 2px rgba(0,0,0,.45)}
.hw-sheet{position:absolute;left:104px;top:14px;width:150px;height:168px;background:var(--paper);color:var(--ink);font-family:var(--f-type);font-size:9.5px;line-height:1.4;padding:8px 9px;box-shadow:0 3px 8px rgba(0,0,0,.5)}
.hw-sheet .h,.hw-note .h,.hw-acc .h{display:block;font-family:var(--f-pixel);font-size:11.5px;margin-bottom:4px}
.hw-sheet ul,.hw-note ol{margin:0;padding-left:12px;display:flex;flex-direction:column;gap:4px}
.hw-stage .fx-l{background:linear-gradient(transparent 58%,rgba(217,166,72,.55) 58% 92%,transparent 92%) no-repeat 0 0/100% 100%}
.hw-note{position:absolute;left:8px;top:10px;width:166px;height:176px;background:var(--paper);color:var(--ink);font-family:var(--f-type);font-size:9.5px;line-height:1.4;padding:9px 10px;box-shadow:0 3px 8px rgba(0,0,0,.5);background-image:repeating-linear-gradient(transparent 0 15px,rgba(90,120,160,.16) 15px 16px)}
.hw-note li{padding:1px 2px}
.hw-tag2{position:absolute;left:217px;width:41px;font-family:var(--f-pixel);font-size:8px;line-height:1.1;color:#fff4ea;background:var(--stamp);padding:2px 3px;text-align:center}
.hw-tag2.ok{background:var(--ok)}
.hw-p.win{box-shadow:0 0 0 2px var(--brass),0 2px 4px rgba(0,0,0,.45)}
.hw-str{position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none}
.hw-str path{fill:none;stroke:var(--string);stroke-width:2;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))}
.hw-x{position:absolute;inset:4px 4px 16px;background:linear-gradient(45deg,transparent 45%,var(--stamp) 45% 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,var(--stamp) 45% 55%,transparent 55%)}
.hw-p.gray{filter:grayscale(1) brightness(.8)}
.hw-sheet.small{left:118px;top:30px;width:128px;height:136px}
.hw-sheet .ln{display:block;height:5px;margin:7px 0;background:var(--paper-shade)}
.hw-sheet .ln.s{width:70%}
.hw-chip{position:absolute;left:10px;bottom:12px;width:66px;height:22px;border:2px solid var(--ink);font-family:var(--f-pixel);font-size:10px}
.hw-chip span{position:absolute;inset:0;display:grid;place-items:center}
.hw-chip .c-a{opacity:0}
.hw-chip .c-b{background:var(--ink);color:var(--paper)}
.hw-lives{position:absolute;left:12px;top:12px;display:flex;gap:4px}
.hw-lives i{width:10px;height:10px;background:var(--string);box-shadow:inset -2px -2px 0 rgba(0,0,0,.3)}
.hw-btn{position:absolute;left:150px;top:158px;width:100px;height:28px;display:grid;place-items:center;background:var(--stamp);color:#fff4ea;font-family:var(--f-pixel);font-weight:600;font-size:13px;box-shadow:inset 0 -3px 0 rgba(0,0,0,.3)}
.hw-acc{position:absolute;left:20px;top:30px;width:224px;height:118px;background:var(--paper);color:var(--ink);font-family:var(--f-type);font-size:10.5px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;box-shadow:0 6px 16px rgba(0,0,0,.6)}
.hw-stamp{position:absolute;left:12px;top:78px;width:142px;text-align:center;font-family:var(--f-pixel);font-weight:700;font-size:12px;letter-spacing:.05em;color:var(--ok);border:3px solid var(--ok);padding:1px 4px;rotate:-5deg;background:rgba(236,227,207,.6)}
.hw-stars{position:absolute;right:12px;bottom:10px;font-family:var(--f-pixel);font-size:20px;color:var(--brass);letter-spacing:2px}

/* plansza 2: stuknięcie zdjęcia, akta wjeżdżają, marker zaznacza */
.hw-s2 .hw-f{animation:hw-tap2 4.5s infinite}
@keyframes hw-tap2{0%{opacity:0;translate:var(--x) var(--y);scale:1}10%{opacity:1;scale:1}16%{scale:.75}22%{scale:1;opacity:1}30%,100%{opacity:0;translate:var(--x) var(--y)}}
.hw-s2 .pick{animation:hw-sel 4.5s infinite}
@keyframes hw-sel{0%,15%{box-shadow:0 2px 4px rgba(0,0,0,.45)}18%,94%{box-shadow:0 0 0 3px var(--brass),0 3px 8px rgba(0,0,0,.5)}100%{box-shadow:0 2px 4px rgba(0,0,0,.45)}}
.hw-s2 .hw-sheet{animation:hw-slide 4.5s infinite}
@keyframes hw-slide{0%,18%{translate:170px 0;opacity:1}28%{translate:-5px 0}32%,92%{translate:0 0;opacity:1}100%{translate:0 0;opacity:0}}
.hw-s2 .fx-l{animation:hw-mark 4.5s infinite}
@keyframes hw-mark{0%,36%{background-size:0 100%}50%,100%{background-size:100% 100%}}
.hw-s2 .fx-t{animation:hw-ink 4.5s infinite}
@keyframes hw-ink{0%,40%{color:var(--ink)}52%,100%{color:#8e1d1d}}
/* plansza 3: reguły i kto którą łamie */
.hw-s3 .q1{animation:hw-q1 6s infinite}.hw-s3 .q2{animation:hw-q2 6s infinite}.hw-s3 .q3{animation:hw-q3 6s infinite}
@keyframes hw-q1{0%,13%{background:transparent}17%,27%{background:rgba(194,42,42,.2)}31%,54%{background:transparent}58%,74%{background:rgba(63,122,74,.2)}80%,100%{background:transparent}}
@keyframes hw-q2{0%,54%{background:transparent}58%,74%{background:rgba(63,122,74,.2)}80%,100%{background:transparent}}
@keyframes hw-q3{0%,33%{background:transparent}37%,47%{background:rgba(194,42,42,.2)}51%,54%{background:transparent}58%,74%{background:rgba(63,122,74,.2)}80%,100%{background:transparent}}
.hw-s3 .a1{animation:hw-a1 6s infinite}.hw-s3 .a2{animation:hw-a2 6s infinite}.hw-s3 .a3{animation:hw-a3 6s infinite}
@keyframes hw-a1{0%,15%{opacity:0;scale:.5}19%{scale:1.15}22%,94%{opacity:1;scale:1}100%{opacity:0}}
@keyframes hw-a2{0%,35%{opacity:0;scale:.5}39%{scale:1.15}42%,94%{opacity:1;scale:1}100%{opacity:0}}
@keyframes hw-a3{0%,56%{opacity:0;scale:.5}60%{scale:1.15}63%,94%{opacity:1;scale:1}100%{opacity:0}}
.hw-s3 .win{animation:hw-win 6s infinite}
@keyframes hw-win{0%,56%{box-shadow:0 2px 4px rgba(0,0,0,.45)}60%,94%{box-shadow:0 0 0 2px var(--brass),0 2px 4px rgba(0,0,0,.45)}100%{box-shadow:0 2px 4px rgba(0,0,0,.45)}}
/* plansza 4: dwa sznurki przeciągnięte palcem */
.hw-s4 .hw-f{animation:hw-drag 5.5s infinite}
@keyframes hw-drag{0%{opacity:0;translate:47px 21px;scale:1}6%{opacity:1;translate:47px 21px;scale:1}10%{translate:47px 21px;scale:.8}38%{translate:203px 65px;scale:.8}42%{translate:203px 65px;scale:1}50%{translate:203px 65px;scale:.8}78%{translate:123px 119px;scale:.8}82%{opacity:1;translate:123px 119px;scale:1}90%,100%{opacity:0;translate:123px 119px;scale:1}}
.hw-s4 .s1{animation:hw-s1 5.5s infinite}.hw-s4 .s2{animation:hw-s2 5.5s infinite}
@keyframes hw-s1{0%,10%{stroke-dashoffset:1;opacity:1}38%,94%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
@keyframes hw-s2{0%,50%{stroke-dashoffset:1;opacity:1}78%,94%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:0;opacity:0}}
.hw-s4 .g1{animation:hw-g1 5.5s infinite}.hw-s4 .g2{animation:hw-g2 5.5s infinite}
@keyframes hw-g1{0%,10%{opacity:0;scale:.5}11%{opacity:.95;scale:.5}24%{opacity:0;scale:1.7}24.5%{opacity:.95;scale:.5}37%{opacity:0;scale:1.7}100%{opacity:0}}
@keyframes hw-g2{0%,50%{opacity:0;scale:.5}51%{opacity:.95;scale:.5}64%{opacity:0;scale:1.7}64.5%{opacity:.95;scale:.5}77%{opacity:0;scale:1.7}100%{opacity:0}}
/* plansza 6: oskarżenie, pieczątka, gwiazdki */
.hw-s6 .hw-f{animation:hw-tap6 6s infinite}
@keyframes hw-tap6{0%,4%{opacity:0;translate:200px 172px;scale:1}8%{opacity:1;scale:1}12%{scale:.75}16%{scale:1;opacity:1}22%,100%{opacity:0;translate:200px 172px}}
.hw-s6 .hw-acc{animation:hw-acc 6s infinite}
@keyframes hw-acc{0%,16%{translate:0 210px;opacity:1}24%{translate:0 -6px}28%,94%{translate:0 0;opacity:1}100%{translate:0 0;opacity:0}}
.hw-s6 .hw-stamp{animation:hw-slam 6s infinite}
@keyframes hw-slam{0%,42%{opacity:0;scale:2.4}48%{opacity:1;scale:.9}52%,94%{opacity:1;scale:1}100%{opacity:0}}
.hw-s6 .hw-stars{animation:hw-star 6s infinite}
@keyframes hw-star{0%,58%{opacity:0;scale:.3}64%{opacity:1;scale:1.3}68%,94%{opacity:1;scale:1}100%{opacity:0}}
`;

let i = 0, after = null, styled = false, withInstall = false, quitSent = false;
function render() {
  const s = SLIDES[i], stage = $("hwStage");
  stage.className = "hw-stage hw-s" + s.s; // s = numer sceny (CSS animacji)
  stage.innerHTML = s.scene();
  stage.setAttribute("aria-label", t("ui.tutorial.ilustracja_title", { title: s.title }));
  $("hwTitle").textContent = s.title; $("hwTxt").textContent = s.text; $("hwTip").textContent = s.tip;
  $("hwStep").textContent = t("ui.tutorial.krok_v_z_length", { v: i + 1, length: SLIDES.length });
  $("hwPrev").disabled = i === 0;
  $("hwNext").textContent = i === SLIDES.length - 1 ? t("ui.tutorial.do_roboty") : t("ui.tutorial.dalej");
  // ostatnia plansza przy pierwszym uruchomieniu: zaproszenie do instalacji (jeśli możliwa)
  const box = $("hwInstall"), I = window.SiatkaInstall, last = i === SLIDES.length - 1;
  box.hidden = !(withInstall && last && I && I.available());
  if (!box.hidden) {
    box.innerHTML = !I.canPrompt() ? t("ui.tutorial.graj_jak_w_aplikacji_html", { hintHtml: I.hintHtml() })
      : t("ui.tutorial.zainstaluj_gre_na_telefonie_ikona_html");
    const b = $("hwInstallBtn"); if (b) b.onclick = async () => { if (await I.run("samouczek")) render(); };
  }
  $("hwDots").innerHTML = SLIDES.map((x, j) => t("ui.tutorial.krok_html", { j, v: j + 1, title: x.title, v2: j === i ? ' aria-current="step"' : "" })).join("");
}
function go(d) {
  const j = i + d;
  if (j < 0) return;
  if (j >= SLIDES.length) return close(true);
  i = j; AU.sfx("paper"); render();
}
function open(cb, opts = {}) {
  withInstall = !!opts.install;
  if (!styled) { const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  after = cb || null; i = 0; quitSent = false; render();
  // 2.1.2: samouczek otwiera się sam tylko przy pierwszej wizycie; flaga od razu przy otwarciu, nie dopiero przy zamknięciu
  try { localStorage.setItem(KEY, "1"); } catch (_) {}
  $("howto").hidden = false; $("hwNext").focus({ preventScroll: true });
}
const dev = () => (window.SiatkaTrack && window.SiatkaTrack.device) ? window.SiatkaTrack.device() : "mobile";
const track = (p, t) => { if (window.SiatkaTrack) window.SiatkaTrack(p, t); };
function close(done) {
  if ($("howto").hidden) return;
  $("howto").hidden = true;
  track(done === true ? "samouczek/ukonczony" : `tutorial_skip/krok-${i + 1}/${dev()}`, done === true ? t("ui.tutorial.samouczek_ukonczony") : t("ui.tutorial.samouczek_pominiety_na_kroku_v", { v: i + 1 }));
  try { localStorage.setItem(KEY, "1"); } catch (_) {}
  const cb = after; after = null; if (cb) cb();
}
/* wyjście z gry w trakcie samouczka (pagehide, schowanie karty): raz na otwarcie, z numerem kroku */
function quitting() {
  if ($("howto").hidden || quitSent) return;
  quitSent = true; track(`tutorial_quit/krok-${i + 1}/${dev()}`, t("ui.tutorial.samouczek_wyjscie_z_gry_na_kroku", { v: i + 1 }));
}
window.addEventListener("pagehide", quitting);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") quitting(); });
$("hwNext").onclick = () => go(1);
$("hwPrev").onclick = () => go(-1);
$("hwSkip").onclick = () => close();
$("hwDots").addEventListener("click", e => { const b = e.target.closest("[data-j]"); if (b) { i = +b.dataset.j; AU.sfx("paper"); render(); } });
document.addEventListener("keydown", e => {
  if ($("howto").hidden) return;
  if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") close();
});
/* przesunięcie palcem po planszy: w lewo dalej, w prawo wstecz */
let sx = null;
$("hwCard").addEventListener("pointerdown", e => { sx = e.clientX; });
$("hwCard").addEventListener("pointerup", e => {
  if (sx === null) return; const dx = e.clientX - sx; sx = null;
  if (Math.abs(dx) > 50 && !e.target.closest("button")) go(dx < 0 ? 1 : -1);
});

window.SiatkaHowto = {
  open,
  seen() { try { return localStorage.getItem(KEY) === "1"; } catch (_) { return true; } }
};
})();
