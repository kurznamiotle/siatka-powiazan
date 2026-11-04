/*
 * Siatka Powiązań — ustawienia (zębatka w nagłówku) i instalacja gry.
 * Okno: Jak grać, Statystyki, Osiągnięcia, efekty dźwiękowe, muzyka, wibracje, instalacja.
 * Pełny ekran: osobny przycisk w nagłówku (tylko w przeglądarce, która go obsługuje).
 * Instalacja: Android i Chrome na komputerze — systemowe okno (beforeinstallprompt);
 * iPhone/iPad — instrukcja (Safari nie ma przycisku instalacji); zainstalowana — informacja.
 * API: SiatkaPrefs.haptic, SiatkaInstall.{available(), installed(), ios, run(), hintHtml()}
 */
(() => {
const $ = id => document.getElementById(id);
const AU = window.SiatkaAudio || { pref: {}, setSfx() {}, setMusic() {}, sfx() {} };
const track = (p, t) => { if (window.SiatkaTrack) window.SiatkaTrack(p, t); };
const tap = p => { if (window.SiatkaGame) window.SiatkaGame.haptic(p); };

/* ---------- preferencje poza dźwiękiem ---------- */
const PKEY = "siatka-prefs";
const prefs = (() => { try { return Object.assign({ haptic: true }, JSON.parse(localStorage.getItem(PKEY) || "{}")); } catch (_) { return { haptic: true }; } })();
const savePrefs = () => { try { localStorage.setItem(PKEY, JSON.stringify(prefs)); } catch (_) {} };
window.SiatkaPrefs = prefs;

/* ---------- instalacja ---------- */
const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const installed = () => matchMedia("(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)").matches || navigator.standalone === true;
let deferred = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; refresh(); });
window.addEventListener("appinstalled", () => { deferred = null; track("instalacja/zainstalowana", "Gra zainstalowana"); refresh(); paintFs(); });
const available = () => !installed() && (!!deferred || !!hint());
async function run(where) {
  if (deferred) {
    const d = deferred; deferred = null;
    d.prompt();
    try { const c = await d.userChoice; track(`instalacja/${c.outcome === "accepted" ? "zgoda" : "odmowa"}-${where}`, `Instalacja: ${c.outcome === "accepted" ? "zgoda" : "odmowa"} (${where})`); } catch (_) {}
    refresh();
    return true;
  }
  return false;
}
const IOS_HINT = `W Safari stuknij <b>Udostępnij</b> <span class="ios-ico" aria-hidden="true">⬆</span>, a potem <b>„Do ekranu początkowego”</b>.`;
/* Gdy przeglądarka nie wyśle beforeinstallprompt (gra już zainstalowana, okno wcześniej odrzucone
 * albo przeglądarka go nie ma), pokazujemy, gdzie w jej menu jest instalacja. Bez wskazówki: "". */
function hint() {
  if (ios) return IOS_HINT;
  const ua = navigator.userAgent, android = /Android/.test(ua);
  if (/SamsungBrowser/.test(ua)) return `Stuknij menu <b>☰</b>, potem <b>„Dodaj stronę do”</b> → <b>„Ekran startowy”</b>.`;
  if (/Firefox/.test(ua)) return android ? `Stuknij menu <b>⋮</b>, potem <b>„Zainstaluj”</b> (albo „Dodaj do ekranu głównego”).` : "";
  if (/EdgA?\//.test(ua)) return android ? `Stuknij menu <b>…</b>, potem <b>„Dodaj do telefonu”</b>.`
    : `Kliknij ikonę instalacji w pasku adresu albo menu <b>…</b> → <b>„Aplikacje”</b> → <b>„Zainstaluj tę witrynę jako aplikację”</b>.`;
  if (/Chrome\//.test(ua)) return android ? `Stuknij menu <b>⋮</b>, potem <b>„Dodaj do ekranu głównego”</b> → <b>„Zainstaluj”</b>.`
    : `Kliknij ikonę instalacji w pasku adresu albo menu <b>⋮</b> → <b>„Przesyłaj, zapisuj i udostępniaj”</b> → <b>„Zainstaluj stronę jako aplikację”</b>.`;
  return "";
}
window.SiatkaInstall = { available, installed, ios, run, canPrompt: () => !!deferred, hintHtml: hint };

/* ---------- zgłoszenia uwag: Formularz Google z polami wypełnionymi przez grę ---------- */
const FORM = "https://docs.google.com/forms/d/e/1FAIpQLScKYARw2jVB8sYKwlY0Ue2KvTVkwWzCV5SKCSZY3tNwRsRD-w/viewform";
const F = { category: "entry.1002894547", caseInfo: "entry.866292582", device: "entry.1138988463" }; // opis i e-mail wpisuje gracz
function device() {
  const ua = navigator.userAgent, v = re => { const m = ua.match(re); return m ? m[1].replace(/_/g, ".") : ""; };
  const os = /Android/.test(ua) ? "Android " + v(/Android ([\d.]+)/)
    : /iPhone|iPad|iPod/.test(ua) ? (/iPad/.test(ua) ? "iPadOS " : "iOS ") + v(/OS ([\d_]+)/)
    : ios ? "iPadOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "inny system";
  const br = /SamsungBrowser/.test(ua) ? "Samsung Internet " + v(/SamsungBrowser\/(\d+)/)
    : /EdgA?\//.test(ua) ? "Edge " + v(/EdgA?\/(\d+)/) : /CriOS/.test(ua) ? "Chrome " + v(/CriOS\/(\d+)/)
    : /FxiOS|Firefox/.test(ua) ? "Firefox " + v(/(?:FxiOS|Firefox)\/(\d+)/) : /Chrome\//.test(ua) ? "Chrome " + v(/Chrome\/(\d+)/)
    : /Safari/.test(ua) ? "Safari " + v(/Version\/(\d+)/) : "inna przeglądarka";
  return `${os} · ${br} · ${innerWidth}×${innerHeight} · ${installed() ? "aplikacja" : "przeglądarka"}`;
}
function feedback(where, category) {
  const p = new URLSearchParams({ usp: "pp_url" });
  if (category) p.set(F.category, category);
  const info = window.SiatkaGame && window.SiatkaGame.caseInfo(); if (info) p.set(F.caseInfo, info);
  p.set(F.device, device());
  window.open(FORM + "?" + p.toString(), "_blank", "noopener");
  track("uwagi/" + where, "Zgłoszenie uwagi: " + where);
}
window.SiatkaFeedback = { open: feedback, device };

/* ---------- pełny ekran ---------- */
const root = document.documentElement;
const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFs() {
  if (fsActive()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const r = root.requestFullscreen ? root.requestFullscreen({ navigationUI: "hide" }) : root.webkitRequestFullscreen && root.webkitRequestFullscreen();
  if (r && r.then) r.then(() => { try { screen.orientation.lock("portrait").catch(() => {}); } catch (_) {} }).catch(() => {});
}
const FS_ON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z"/></svg>`;
const FS_OFF = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M4 1h2v5H1V4h3zM10 1h2v3h3v2h-5zM1 10h5v5H4v-3H1zM10 10h5v2h-3v3h-2z"/></svg>`;
function paintFs() {
  const b = $("fsBtn"), on = fsActive();
  b.hidden = !fsSupported || installed();
  b.innerHTML = on ? FS_OFF : FS_ON;
  b.title = on ? "Wyjdź z pełnego ekranu" : "Pełny ekran"; b.setAttribute("aria-label", b.title);
}
$("fsBtn").onclick = () => { tap(6); toggleFs(); };
["fullscreenchange", "webkitfullscreenchange"].forEach(ev => document.addEventListener(ev, paintFs));
paintFs();

/* ---------- okno ustawień ---------- */
const hapticAvailable = typeof navigator.vibrate === "function" || ios;
const sw = (id, label, on, sub) => `<div class="set-row"><span><span class="set-l">${label}</span>${sub ? `<small>${sub}</small>` : ""}</span>
  <button class="switch" id="${id}" role="switch" aria-checked="${on}" aria-label="${label}"><i></i></button></div>`;
function render() {
  let app;
  if (installed()) app = `<p class="set-note">Gra jest zainstalowana na tym urządzeniu.</p>`;
  else if (deferred) app = `<button class="btn red set-install" id="setInstall">Zainstaluj grę</button><p class="set-note">Ikona na ekranie głównym, pełny ekran i gra bez internetu.</p>`;
  else if (hint()) app = `<p class="set-note"><b>Zainstaluj grę:</b> ${hint()}</p>`;
  else app = "";
  $("menuCard").innerHTML = `<h3>Ustawienia</h3>
    <div class="set-go"><button class="pick" id="setHowto">Jak grać</button><button class="pick" id="setStats">Statystyki</button>
      ${window.SiatkaAch ? (c => `<button class="pick wide set-ach" id="setAch">Osiągnięcia <small>${c.got}/${c.all}</small></button>`)(window.SiatkaAch.count()) : ""}
      <button class="pick wide" id="setFeedback">Zgłoś uwagę lub błąd</button></div>
    <div class="lbl">Dźwięk</div>
    ${sw("swSfx", "Efekty dźwiękowe", !!AU.pref.sfx)}
    ${sw("swMusic", "Muzyka w tle", !!AU.pref.music, "Spokojny jazz z płyty")}
    ${hapticAvailable ? sw("swHaptic", "Wibracje", !!prefs.haptic) : ""}
    ${app ? `<div class="lbl">Aplikacja</div>${app}` : ""}
    <div class="foot"><button class="btn ghost" id="menuClose">Zamknij</button></div>
    <p class="set-foot">siatkapowiazan.pl</p>`;
  $("menuClose").onclick = close;
  $("setHowto").onclick = () => { close(); if (window.SiatkaGame) window.SiatkaGame.openHowto(); };
  $("setStats").onclick = () => { close(); if (window.SiatkaStats) window.SiatkaStats.open(); };
  if ($("setAch")) $("setAch").onclick = () => { close(); window.SiatkaAch.open(); };
  $("setFeedback").onclick = () => feedback("ustawienia");
  $("swSfx").onclick = () => { AU.setSfx(!AU.pref.sfx); AU.sfx("tick"); tap(6); render(); };
  $("swMusic").onclick = () => { AU.setMusic(!AU.pref.music); tap(6); track(`ustawienia/muzyka-${AU.pref.music ? "wl" : "wyl"}`); render(); };
  if ($("swHaptic")) $("swHaptic").onclick = () => { prefs.haptic = !prefs.haptic; savePrefs(); tap(12); render(); };
  if ($("setInstall")) $("setInstall").onclick = () => run("ustawienia");
}
function refresh() { if (!$("menu").hidden) render(); }
function open() { render(); $("menu").hidden = false; AU.sfx("paper"); }
function close() { $("menu").hidden = true; }
$("menuBtn").onclick = () => { tap(6); open(); };
$("menu").addEventListener("click", e => { if (e.target.id === "menu") close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("menu").hidden) close(); });
})();
