# Do następnej wersji generatora

Zmiany, które zmieniają tekst polskich spraw. Nie wchodzą bez nowej wersji generatora (patrz „Nowe wydanie, krok po kroku” w CLAUDE.md), bo zmieniłyby bieżącą sprawę dnia.

## Zrobione w 2.2.2 (od 22.11.2026)

- „w kiosku” → „przy kiosku”: forma `in` miejsca Kiosk Ruchu (`data/i18n/pl/base.js`). EN bez zmian (`at the kiosk`).
- Listonosz: szablon „Listonosz minął [go|ją] {in} o {t}.” (świadkowie `presenceTpl` i oś czasu `timeline.obsTpl`, PL i EN) ma `at:["street","kiosk","stair","shop","office"]` i `time:["00:00","19:00"]`. Bez działek, garażu, podwórka i budowy.
- Milicja → Policja 10 maja 1990: w maju 1990 dzień losuje się z osobnego strumienia `seed/day` (dni 1–9 to MO, od 10. policja), kwiecień zawsze MO, czerwiec zawsze policja (`context()` w `engine.js`, test w `tools/test-realia.js`, pkt 7).
- Przy okazji: „protokół na przesłuchaniu [przeczytał|przeczytała] [sam|sama]” (było „przeczytała sam”).

- Szablony świadków, obecności i dowodów obecności mają listę dopuszczalnych rodzajów miejsc (`at`, PL i EN identycznie). Bez listy szablon nie jest używany (`fitsAt` w `engine.js`). Drobniejsze rodzaje miejsc (`pt`): street, kiosk, marina, park, yard, garage, site, field, shop, office, stair, cellar, flat, work, plant. Opcjonalne `time:["od","do"]` na szablonie (pora obserwacji).
- Relacja „współpracownik” tylko wtedy, gdy wszyscy z tą relacją mają rolę z tym samym `wp` (rodzaj miejsca pracy: adm, przychodnia, mpk, hotel, szkola, bazar, kopalnia, przedzalnia…), inaczej inna relacja. Zdania neutralne („w tym samym miejscu pracy”), bez zakładu i portierni.
- Świadkowie: kioskarz „zamykał okienko” tylko przy kiosku, „z naprzeciwka” tylko na ulicy; emerytka i sąsiadka „z okna” tylko ulica, podwórko, klatka; pani z wózkiem tylko ulica i podwórko, do 20:00; dzieci w kapsle do 20:30; listonosz do 19:00; dzielnicowy wszędzie poza zakładem, warsztatem, piwnicą i mieszkaniem; nowi świadkowie na przystani (bosman, wędkarz).
- Sezon (`base.placeTypes`): przystań, działki i park od listopada do marca po 17:00 nie trafiają do spraw (miejsca, sceny osi czasu).
- Książka wejść z portierni i lista obecności tylko w zakładach z portiernią (`plant`: przędzalnia, zajezdnia, magazyn portowy, lampownia, w osi czasu księgowość i brama zakładu…). Nowe dowody obecności dla kiosku, biura, przystani, działek, zaplecza i sklepu.
- Test: `tools/test-realia.js`, pkt 8 (2000 spraw: świadek i dowód tylko w swoich rodzajach miejsc i porach, zero miejsc sezonowych zimą).

## Do decyzji (z przeglądu 400 spraw 2.2.2 po zmianach)

### 1. „Współpracownik” prawie nie wypada

- Zasada z `wp` działa (0 niezgodnych), ale w 3000 spraw L–XL relacja to zawsze klatka albo szwagrostwo, a w S–M „współpracownik” wypadł raz na 338. Losowe role rzadko mają ten sam `wp`.
- Możliwość: przy regule relacji „współpracownik” dobierać role osób z tą relacją z jednego `wp` (wtedy częściej mpk, adm, bazar).

### 2. Szczęka na bazarze jako ulica

- Przykłady: „Pani z wózkiem minęła ją w szczęce na bazarze o 16:35.”, „Emerytka z parteru widziała go w szczęce na bazarze…, kiedy w radiu nadawali sygnał czasu.”, „…w szczęce na bazarze. Widział ją mechanik, który pchał Malucha pod górkę.”
- Forma `in` „w szczęce” to wnętrze budki. Albo osobny rodzaj (`stall`: klient, sąsiedni handlarz, dzielnicowy), albo forma „przy szczęce”.

### 3. Godziny otwarcia lokali

- Przykłady: „Dzielnicowy zanotował w notesie: 23:35, w zakładzie fryzjerskim.”, „Obsługa zapamiętała, że o 20:55 była w zakładzie fryzjerskim.”, „Listonosz minął go w piwnicy jazzowej o 17:55.”
- Lokale nie mają godzin. Możliwość: `hours` na miejscu (fryzjer, apteka, biuro do 18–19, piwnica jazzowa od 19) i obecności tylko w tych godzinach; listonosz tylko „przy” lokalu.

### 4. Rodzaj `work` za szeroki

- Przykłady: „Kierownik zmiany przyznaje, że o 18:55 widział ją w szopie rybackiej.”, „Szef zmiany zanotował: 21:15, w stajni.”, „Kwit wypisany ręcznie w kotłowni, z godziną 21:35 w rogu.”
- `work` łączy warsztat, zaplecze sklepu, kotłownię, stajnię i szopę rybacką. „Zmiana” i „kwit” pasują tylko do części. Możliwość: `shed` (kotłownia, stajnia, szopa) z własnymi świadkami (stróż, stajenny, rybak).
