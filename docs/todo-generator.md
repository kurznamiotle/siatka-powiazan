# Do następnej wersji generatora

Zmiany, które zmieniają tekst polskich spraw. Nie wchodzą bez nowej wersji generatora (patrz „Nowe wydanie, krok po kroku” w CLAUDE.md), bo zmieniłyby bieżącą sprawę dnia. Sprawdzone 18.11.2026 na wip/i18n.

## 1. „w kiosku” → „przy kiosku”

- Gdzie: `data/i18n/pl/base.js`, miejsce `{ id:"kiosk", name:"Kiosk Ruchu", … in:"w kiosku" }`, czyli forma `in` używana w zdaniach obecności, obserwacjach osi czasu i dowodach („był w kiosku”, „widział go w kiosku”).
- Zmiana: `in:"przy kiosku"`. Kiosk Ruchu ogląda się z zewnątrz, w środku siedzi tylko kioskarz.
- Bez zmian: scena „Kioskarz z {street}” („znaleziony martwy w swoim kiosku”, `where:"w kiosku"`) i smaczek „kupuje sobie w kiosku papierosy na sztuki”. To poprawna polszczyzna.
- EN bez zmian (`at the kiosk`).
- Po zmianie: `npm test`, przejrzeć kilka spraw z kioskiem (`node tools/generate.js 12 out`).

## 2. Listonosz na działkach

- Gdzie: szablon obecności „Listonosz minął [go|ją] {in} o {t}.” z `at:["street","yard","shop","field"]` w `presenceTpl` oraz ten sam w `timeline.obsTpl` (`data/i18n/pl/base.js` i `en/base.js`).
- Problem: przy miejscach typu `field` (altana, działki, kurnik) wychodzi „Listonosz minął ją w altanie” / „The postman passed her in the summerhouse”. Listonosz nie chodzi po działkach.
- Zmiana: usunąć `"field"` z `at` w obu szablonach, w PL i EN jednocześnie. `at` to pole logiki: `i18n-check` wymaga, żeby było identyczne w obu językach.
- Uwaga: `generate.js` sprawdza liczbę szablonów na każdy rodzaj miejsca. Po usunięciu sprawdzić, czy `field` ma ich nadal dość.
