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

- Akta (2.2.2, druga tura): kolejne obserwacje tej samej osoby w tym samym miejscu w jednym zdaniu z `presence2Tpl` („o 20:50 i jeszcze raz o 21:10” / “at 20:50 and again at 21:10”, `timesPhrase`); szablon świadka najwyżej raz w aktach osoby (po obiekcie szablonu, przy braku sprawa się losuje od nowa); etykieta polaroidu w każdej formie miejsca (magazyn w porcie: „Magazyn” / “Warehouse” zamiast „Nabrzeże” / “Quay”; klub jazzowy: „w klubie jazzowym” zamiast „w piwnicy jazzowej”).
- Współpracownik: gdy reguła relacji wylosuje „współpracownika”, osoby z tą relacją biorą role z jednego `wp` (kolejne próby po rodzajach pracy, potem inna relacja); grupy `wp` poszerzone (administracja: hydraulik, elektryk, malarz; bazar: kwiaciarka). Udział ok. 29% reguł relacji (przed 2.2.2 ok. 1/3).
- Stragan (`stall`): szczęka na bazarze „przy szczęce na bazarze” / “by the stall in the bazaar”, budki i stragany w osi czasu; świadkowie: handlarka z sąsiedniej budki, klient w kolejce, dzielnicowy, inkasent targowy (dowód). Bez godzin, więc bez świadków ulicznych.
- Godziny otwarcia: `placeTypes.<pt>.open` (shop 9–19, office 8–18, kiosk 6–19) albo `hours` na miejscu (apteka 8–20, świetlica 15–21, klub jazzowy 18–24, sklep 6–19). Obecność „w środku” tylko w godzinach + 30 min, poza nimi forma `out` („przed apteką”) i świadkowie uliczni (`placeAt` w `engine.js`).
- Miejsce pracy: szef i kierownik zmiany tylko w zakładach (`plant`), kwity w zakładach i lokalach; kotłownia, stajnia i szopa rybacka to `boiler`, `stable`, `shed` z palaczem, stajennym i rybakiem oraz sąsiadem i dzielnicowym; warsztat i zaplecze: klient po zamówienie, zeszyt zamówień.
- Test: `tools/test-realia.js` pkt 8 (A1–A3, B, C, D, E na 2000 + 1600 spraw).

- Decyzje z przeglądu 400 spraw (trzecia tura):
  - Kotwice czasu (oś czasu): `mins:[0]` = sygnał czasu w radiu i dzwony tylko o pełnej godzinie; `times:["HH:MM"]` = program w godzinie emisji: „Teleexpress” o 17:00, „Wiadomości” o 19:30 (1990–1999). Obserwacja o innej minucie bierze inną kotwicę albo zdanie bez kotwicy. Hejnału nie ma wśród szablonów (wszystkie szablony są wspólne dla miast); gdyby wszedł, też `mins:[0]`.
  - Raport stróża nocnego (classic i oś czasu) tylko 20:00–6:00 (`time:["20:00","06:00"]`, `fitsAt` obsługuje przedział przez północ). W dzień inne dowody z listy miejsca: zeszyt dozorcy, dziennik budowy (nowy, `site`), rejestr stróża ogródków, zeszyt dyżurów (w osi czasu nowe).
  - Cechy miejsca `feat` i warunek `need` na szablonie: `queue` (lada albo okienko: apteka, kiosk, szczęka, w osi czasu sklepy, kantory, poczta, kasy, bar mleczny, cukiernia, budki i stragany poza budką dozorcy), `tab` (zeszyt na kreskę: kiosk, szczęka, sklep spożywczy, bar mleczny, budki z towarem), `appt` (fryzjer: „Zeszyt zapisów u fryzjera”). Świetlica, klub jazzowy i fryzjer bez kolejki i kreski. Kwit z godziną także w classic (lokale bez kolejki miałyby jeden dowód obecności). Biuro w osi czasu: sprzątaczka zamiast klienta w kolejce.
  - `generate.js` liczy szablony dla każdego miejsca z jego cechami; test: `tools/test-realia.js` pkt 9 (dane + 2400 spraw).

## Do decyzji

(nic)
