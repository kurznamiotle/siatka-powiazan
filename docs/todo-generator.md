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

## 3. Milicja → Policja: maj 1990 (na wersję 2.2.2)

- Stan: `context()` w `engine/engine.js`: `const milicja = year === 1989 || (year === 1990 && monthIdx < 4);`. Sprawa ma tylko miesiąc (bez dnia), więc styczeń–kwiecień 1990 to MO („porucznik … z MO”, `{police_dat}` = milicji), a od maja policja i komisarz. Przełączenie wypada w praktyce 1 maja 1990.
- Historycznie: ustawa o Policji z 6 kwietnia 1990, Policja powstała 10 maja 1990 (MO do 9 maja). Kartoteka mówi „do V 1990” / „until May 1990”.
- Rozbieżność: sprawy z maja 1990 mają już policję, choć przez pierwsze 9 dni maja była jeszcze milicja. Czas zbrodni nie ma dnia, więc maj jest z natury niejednoznaczny.
- Do decyzji: (a) zostawić (maj = policja, większość miesiąca), (b) maj 1990 jako milicja (`monthIdx < 5`), (c) dodać dzień miesiąca do sprawy (większa zmiana). Każda zmiana warunku zmienia polskie (i angielskie) sprawy z maja 1990, więc tylko z nową wersją generatora.
- Po zmianie: `npm test`, `node tools/generate.js 12 out warszawa 1990` i sprawdzić sprawy z kwietnia, maja i czerwca.
