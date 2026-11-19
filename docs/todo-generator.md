# Do następnej wersji generatora

Zmiany, które zmieniają tekst polskich spraw. Nie wchodzą bez nowej wersji generatora (patrz „Nowe wydanie, krok po kroku” w CLAUDE.md), bo zmieniłyby bieżącą sprawę dnia.

## Zrobione w 2.2.2 (od 22.11.2026)

- „w kiosku” → „przy kiosku”: forma `in` miejsca Kiosk Ruchu (`data/i18n/pl/base.js`). EN bez zmian (`at the kiosk`).
- Listonosz: szablon „Listonosz minął [go|ją] {in} o {t}.” (świadkowie `presenceTpl` i oś czasu `timeline.obsTpl`, PL i EN) ma `at:["street","stair","shop"]`. Bez działek (`field`) i bez `yard` (w sprawach klasycznych to tylko garaż, w osi czasu także barak, plac budowy, stodoła).
- Milicja → Policja 10 maja 1990: w maju 1990 dzień losuje się z osobnego strumienia `seed/day` (dni 1–9 to MO, od 10. policja), kwiecień zawsze MO, czerwiec zawsze policja (`context()` w `engine.js`, test w `tools/test-realia.js`, pkt 7).
- Przy okazji: „protokół na przesłuchaniu [przeczytał|przeczytała] [sam|sama]” (było „przeczytała sam”).

## Do decyzji (z przeglądu spraw dnia 22–28.11 w 2.2.2)

### 1. Relacja „współpracownik” bez względu na zawód

- Przykład (#26, 26.11): bibliotekarka, lekarka z przychodni i wioślarka z klubu „są na jednej zmianie w tym samym zakładzie” co Cecylia Adamczyk.
- Gdzie: `relation.workmate.fact` w `data/i18n/pl/base.js` (i EN). Zdania mają `k:["job"]`, ale nie patrzą na rolę.
- Możliwości: ogólniejsze zdania („zna ją z pracy, pracowały kiedyś w jednym zakładzie”) albo zdania z `roles` (zakład, szpital, biblioteka) i dobór relacji do ról.

### 2. Miejsca pod gołym niebem zimą wieczorem

- Przykład (#23, 23.11, Poznań, styczeń 1989, 19:00–21:00): przystań nad Wartą pełna świadków: kioskarz „zamykał okienko” na przystani, pani z wózkiem, listonosz o 20:10.
- Możliwości: `months` na miejscach typu przystań (kwiecień–październik) albo na szablonach świadków („pani z wózkiem”, „chłopak wracał z treningu”) w miejscach `street` zimą po zmroku. Listonosz po 19:00 też jest wątpliwy: szablon mógłby mieć godziny (`time`).

### 3. Książka wejść z portierni zapisuje cudze miejsca

- Przykłady: «17:25 — I.N., w biurze administracji», «16:40 — M.S., w aptece» (portier hotelowy?), w osi czasu „Książka wejść prowadzona przez portiera przy kiosku”, „Kwit wypisany ręcznie przy kiosku”.
- Gdzie: `evidence.presence` i `timeline.evidence` z `{in}`. Portiernia ma sens przy `work` (zakład, zajezdnia) i może przy `shop` typu biuro, nie przy kiosku i aptece. Do dodania `at` na tych dowodach.

### 4. Świadkowie z podwórka w garażu

- Przykłady: „Pani z wózkiem minęła go w garażu o 19:35”, „Emerytka z parteru widziała ją w garażu…, kiedy wyglądała przez okno, czy idzie listonosz”.
- Rodzaj `yard` łączy podwórko i garaż. Albo osobny rodzaj dla garażu (np. `garage`), albo forma „przy garażu” (jak „przy kiosku”).
