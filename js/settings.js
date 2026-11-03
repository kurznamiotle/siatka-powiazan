/*
 * Siatka Powiązań — ustawienia (zębatka w nagłówku) i instalacja gry.
 * Okno: Jak grać, Statystyki, efekty dźwiękowe, muzyka, wibracje, pełny ekran, instalacja.
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
window.addEventListener("appinstalled", () => { deferred = null; track("instalacja/zainstalowana", "Gra zainstalowana"); refresh(); });
const available = () => !installed() && (!!deferred || ios);
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
window.SiatkaInstall = { available, installed, ios, run, hintHtml: () => IOS_HINT };

/* ---------- pełny ekran ---------- */
const root = document.documentElement;
const fsSupported = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
const fsActive = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFs() {
  if (fsActive()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  const r = root.requestFullscreen ? root.requestFullscreen({ navigationUI: "hide" }) : root.webkitRequestFullscreen && root.webkitRequestFullscreen();
  if (r && r.then) r.then(() => { try { screen.orientation.lock("portrait").catch(() => {}); } catch (_) {} }).catch(() => {});
}
["fullscreenchange", "webkitfullscreenchange"].forEach(ev => document.addEventListener(ev, refresh));

/* ---------- okno ustawień ---------- */
const hapticAvailable = typeof navigator.vibrate === "function" || ios;
const sw = (id, label, on, sub) => `<div class="set-row"><span><span class="set-l">${label}</span>${sub ? `<small>${sub}</small>` : ""}</span>
  <button class="switch" id="${id}" role="switch" aria-checked="${on}" aria-label="${label}"><i></i></button></div>`;
function render() {
  let app;
  if (installed()) app = `<p class="set-note">Gra jest zainstalowana na tym urządzeniu.</p>`;
  else if (deferred) app = `<button class="btn red set-install" id="setInstall">Zainstaluj grę</button><p class="set-note">Ikona na ekranie głównym, pełny ekran i gra bez internetu.</p>`;
  else if (ios) app = `<p class="set-note">${IOS_HINT}</p>`;
  else app = "";
  $("menuCard").innerHTML = `<h3>Ustawienia</h3>
    <div class="set-go"><button class="pick" id="setHowto">Jak grać</button><button class="pick" id="setStats">Statystyki</button></div>
    <div class="lbl">Dźwięk</div>
    ${sw("swSfx", "Efekty dźwiękowe", !!AU.pref.sfx)}
    ${sw("swMusic", "Muzyka w tle", !!AU.pref.music, "Spokojny jazz z płyty")}
    ${hapticAvailable ? sw("swHaptic", "Wibracje", !!prefs.haptic) : ""}
    ${fsSupported && !installed() ? `<div class="lbl">Ekran</div>${sw("swFs", "Pełny ekran", fsActive())}` : ""}
    ${app ? `<div class="lbl">Aplikacja</div>${app}` : ""}
    <div class="foot"><button class="btn ghost" id="menuClose">Zamknij</button></div>
    <p class="set-foot">siatkapowiazan.pl</p>`;
  $("menuClose").onclick = close;
  $("setHowto").onclick = () => { close(); if (window.SiatkaGame) window.SiatkaGame.openHowto(); };
  $("setStats").onclick = () => { close(); if (window.SiatkaStats) window.SiatkaStats.open(); };
  $("swSfx").onclick = () => { AU.setSfx(!AU.pref.sfx); AU.sfx("tick"); tap(6); render(); };
  $("swMusic").onclick = () => { AU.setMusic(!AU.pref.music); tap(6); track(`ustawienia/muzyka-${AU.pref.music ? "wl" : "wyl"}`); render(); };
  if ($("swHaptic")) $("swHaptic").onclick = () => { prefs.haptic = !prefs.haptic; savePrefs(); tap(12); render(); };
  if ($("swFs")) $("swFs").onclick = () => { tap(6); toggleFs(); };
  if ($("setInstall")) $("setInstall").onclick = () => run("ustawienia");
}
function refresh() { if (!$("menu").hidden) render(); }
function open() { render(); $("menu").hidden = false; AU.sfx("paper"); }
function close() { $("menu").hidden = true; }
$("menuBtn").onclick = () => { tap(6); open(); };
$("menu").addEventListener("click", e => { if (e.target.id === "menu") close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("menu").hidden) close(); });
})();
