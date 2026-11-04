# Siatka Powiązań: duża aktualizacja spraw (v2)

Dokument projektowy dla Claude Code. Wdrażaj **etapami**, w podanej kolejności. Każdy etap kończy się działającą grą, testem generatora i commitem. Nie zaczynaj następnego etapu, dopóki poprzedni nie przechodzi testów.

## Dlaczego

Testerzy zgłaszają, że po kilku sprawach gra robi się powtarzalna. Są dwa źródła:

1. **Schemat.** Każda sprawa ma dziś tę samą budowę: jeden sprawca, każdy niewinny odpada z dokładnie jednej reguły, a gracz przechodzi reguły po kolei i skreśla. Po kilku sprawach gracz wyczuwa algorytm.
2. **Teksty i postacie.** Pule zdań, ról i scen są za małe na kogoś, kto gra codziennie i bierze 5 spraw z archiwum.

Cel aktualizacji: **gracz nie wie z góry, jak rozwiąże sprawę.** Różne typy spraw, fakty, które trzeba łączyć między teczkami, bogatsza logika reguł, różne pytania i ciągłość między sprawami.

## Zasady, których nie wolno złamać

- **Solver jest sędzią.** Każda wygenerowana sprawa ma dokładnie jedno rozwiązanie, każda reguła jest potrzebna, a fakty nie są sprzeczne. Sprawa, która nie przechodzi, jest odrzucana i losowana ponownie.
- **Tekst powstaje z faktów, nigdy odwrotnie.** LLM (jeśli w ogóle) tylko offline do pisania pul treści, z ręczną kontrolą. **LLM nigdy nie układa logiki.**
- **Reguły nie podają wniosku wprost.** Gracz sam wyciąga wniosek, ale reguła musi prowadzić do jednego wniosku.
- **Sprawa dnia jest ta sama dla wszystkich** (seed z daty) i działa bez konta.
- **Zapis postępu, limit 5 spraw, ptaszek i obrazek wyniku** muszą działać dla wszystkich nowych typów spraw.

---

## Etap 0. Architektura archetypów (fundament)

Dziś generator to jedna funkcja `build()` dla jednego typu sprawy. Rozbij to na moduły:

```
engine/
  engine.js            RNG, tekst, wspólne narzędzia, rejestr archetypów, sprawa dnia
  solver.js            ogólny solver: przestrzeń hipotez + reguły
  archetypes/
    classic.js         obecny typ (jeden sprawca, każdy odpada z jednej reguły)
    timeline.js        etap 3
    planted.js         etap 4
    chain.js           etap 5
    accomplices.js     etap 6
```

**Wspólny interfejs archetypu:**

```js
{
  id: "classic",
  name: "Klasyczna sprawa",
  minSize: "S",              // od jakiej wielkości ma sens
  weight: 3,                 // waga w losowaniu
  question: "culprit_weapon", // patrz etap 7
  build(ctx) → caseObject | null,   // ctx = { R, B, city, year, size, V, T, pickU, ... }
  hypotheses(caseObject) → [...],   // lista wszystkich możliwych odpowiedzi
  holds(rule, hyp, ix, caseObject) → bool
}
```

**Ogólny solver** (`solver.js`): dla sprawy bierze `hypotheses()` z archetypu i sprawdza, które spełniają wszystkie reguły (`holds`). Raportuje to samo co dziś: liczbę rozwiązań, potrzebność każdej reguły i `ok`. Obecne typy reguł (alibi, trait, window, key, fate, dump) przenieś do wspólnej biblioteki predykatów, z której korzystają wszystkie archetypy.

**Pole `archetype` w JSON sprawy.** UI czyta je, żeby wiedzieć, jaki ekran oskarżenia pokazać.

**Losowanie:** sprawa dnia i archiwum losują archetyp z wag, z uwzględnieniem `minSize`. Trudność tygodnia zostaje (pon. mała → niedz. ogromna), ale archetyp też może zależeć od dnia, np. niedziela częściej trudniejsze typy.

**Test etapu 0:** po refaktorze `classic` generuje dokładnie to samo co dziś (te same seedy → te same sprawy), `npm test` przechodzi.

---

## Etap 1. Dowody rzeczowe i fakty pośrednie

**Największy zysk najmniejszym kosztem.** Pogłębia każdy typ sprawy.

Nowy typ węzła na tablicy: **`evidence`** (dowód rzeczowy). To przedmiot albo dokument, który niesie **jeden fakt strukturalny**, przeniesiony z teczki osoby lub miejsca. Gracz musi połączyć dowód z osobą, żeby wyciągnąć wniosek.

**Typy dowodów (pula w `data/base.js` → `evidence`):**

| Dowód | Niesie fakt | Przykład tekstu |
|---|---|---|
| Bilet MPK | obecność w miejscu i czasie albo obalenie alibi | „Skasowany o 19:40 w tramwaju na {street}. Znaleziony w kieszeni płaszcza Haliny.” |
| Paragon | obecność + czas | „Paragon ze sklepu „Społem”, 19:12, dwie oranżady i paczka Sportów.” |
| Zeszyt dozorcy | obecność + czas | „Wpis: «19:20, B.S. zeszła do garażu».” (inicjały, nie nazwisko) |
| Zdjęcie z imienin | alibi potwierdzone albo obalone | „Zdjęcie z imienin. Zegar na ścianie wskazuje 20:15. Na zdjęciu brakuje Romana.” |
| Rachunek z baru | alibi | „Rachunek z „{bar}” na dwie osoby, wybity o 21:05.” |
| List / kartka | motyw | „Niewysłany list: «Oddaj, co jesteś mi winien, bo pójdę na milicję».” Podpis inicjałami. |
| Klucz z przywieszką | posiadanie klucza | „Klucz z drewnianą przywieszką «garaż 3». Znaleziony w szufladzie u Edka.” |
| Pęk kluczy w portierni | kto pobrał klucz | „Książka wydań kluczy: klucz do lampowni pobrał nr 214 o 18:50.” + w teczce osoby „numer znaczka 214” |

**Zasady generowania:**
- Każdy dowód ma **właściciela albo miejsce znalezienia**. Inicjały, numer znaczka, „płaszcz z łatą na łokciu” zamiast nazwiska wymuszają połączenie z teczką osoby (np. „Nosi płaszcz z łatą na łokciu” jest w teczce osoby).
- W sprawie S–M: 1–2 dowody, L: 2–3, XL: 3–4.
- Fakt przeniesiony na dowód **znika z teczki**, w której był. Inaczej dowód nic nie wnosi.
- Część dowodów to **wabiki**: prawdziwe, ale nieistotne dla rozwiązania (np. paragon niewinnego). Solver i tak sprawdza jednoznaczność.

**Fakty łańcuchowe (dwa kroki):** alibi potwierdza świadek, który sam jest podejrzanym, a jego wiarygodność zależy od innego faktu. Albo: „Widział ją kioskarz” + teczka kioskarza: „Tego wieczoru kiosk był zamknięty od 18:00”.

**UI:**
- Nowy rząd na tablicy dla dowodów (pod przedmiotami) albo mieszany z przedmiotami. Ikony pixel art: bilet, paragon, zeszyt, zdjęcie, list, klucz.
- Przy 14+ węzłach tablica może wymagać przewijania albo zoomu. Przetestuj XL na 360 px szerokości.
- Sznurki osoba↔dowód są w `supported_connections`, gdy dowód należy do osoby.

**Test etapu 1:** w 2000 spraw średnio min. 1 dowód, w XL min. 3. W co najmniej 60% spraw rozwiązanie wymaga faktu z dowodu (sprawdź: usuń węzły dowodów i zobacz, czy rozwiązanie nadal jest jednoznaczne; nie powinno być).

---

## Etap 2. Bogatsza logika reguł

Nowe typy reguł w bibliotece predykatów, dostępne dla wszystkich archetypów:

| Typ | Przykład | Uwagi |
|---|---|---|
| **Przeczenie** | „Pies sąsiadów nie szczekał. Sprawca nie był obcy.” → sprawca zna ofiarę | wartość `no` cechy albo odwrotny predykat |
| **Porównanie** | „Sprawca jest wyższy od Haliny Morawskiej.” | wymaga liczbowego wzrostu w cm w faktach; tekst w teczce: „ma 1,68 m” |
| **Alternatywa** | „Sprawca miał klucz albo przyszedł z kimś, kto go ma.” | solver musi umieć `or`; ostrożnie, max 1 na sprawę |
| **Liczba** | „Dokładnie jedno z alibi jest fałszywe.” | wymaga umiejętności liczenia po wszystkich osobach |
| **Relacja między osobami** | „Sprawca i ofiara byli spokrewnieni.” / „Sprawca pracuje w tym samym zakładzie co świadek.” | nowe fakty `relation {a, b, type}` |
| **Nieobecność** | „Sprawcy nie widziano tego wieczoru na podwórku.” | przeczenie obecności, uważać na domknięcie świata (tylko zdarzenia z listy) |

- Reguły z etapu 2 dobierane tak, żeby notatnik **nie miał więcej niż jednej reguły nietypowej** w sprawach S–M i maks. dwóch w L–XL.
- Każdy nowy typ ma 2–3 warianty sformułowań, podpowiedź i wyjaśnienie na ekranie wyniku.
- **Metryka głębokości:** dodaj do solvera liczenie kroków wnioskowania (ile reguł trzeba użyć, zanim zostanie 1 hipoteza, przy najlepszej kolejności). Odrzucaj sprawy, które rozwiązuje jedna reguła albo jeden wyjątkowo mocny fakt.

---

## Etap 3. Archetyp „Oś czasu” (`timeline`)

**Idea:** nikt nie może być w dwóch miejscach naraz. Gracz rekonstruuje, kto gdzie był o której, i tylko jedna trasa pozwala dotrzeć na miejsce zbrodni w odpowiednim czasie.

- **Miejsca:** 3–5, w tym miejsce zbrodni. W notatniku **tabela czasów dojścia** między miejscami („z kiosku do kamienicy 10 minut, z dworca 25 minut”).
- **Fakty:** obserwacje „X widziany w Y o T” (w teczkach i na dowodach z etapu 1), kilka na osobę.
- **Reguła główna:** „Sprawca był na miejscu zbrodni między A a B.”
- **Logika:** dla każdej osoby solver sprawdza, czy istnieje trasa zgodna ze wszystkimi obserwacjami i czasami dojścia, która mieści pobyt na miejscu zbrodni w oknie. Dokładnie jedna osoba ma taką trasę.
- **Pułapki:** obserwacje, które wyglądają na alibi, ale zostawiają 15 minut luzu, czyli dość, żeby dobiec.
- **Pytanie:** kto (bez narzędzia) albo kto + o której był na miejscu (wybór z 3 przedziałów).
- **Tablica:** sznurki osoba↔miejsce nabierają sensu trasy. Opcjonalnie numerki godzin przy sznurkach dodawane przez gracza (później).

## Etap 4. Archetyp „Podrzucony dowód” (`planted`)

**Idea:** wszystko wskazuje na jedną osobę, a jeden fakt pokazuje, że dowód podrzucono.

- Na miejscu zbrodni leży **dowód obciążający niewinnego** (jego szalik, rękawiczka, zapalniczka z inicjałami).
- W aktach jest fakt, który go wyklucza: szalik od dwóch dni wisiał w pralni (zeszyt maglarki), a do pralni o odpowiedniej porze wchodził sprawca.
- **Pytanie:** kto naprawdę (sprawca podrzucającym) + opcjonalnie skąd wziął dowód.
- **Ekran wyniku:** zwrot akcji („Ktoś bardzo chciał, żebyś oskarżył Romana”).
- Archetyp działa tylko od wielkości M w górę.

## Etap 5. Archetyp „Łańcuch rąk” (`chain`)

**Idea:** przedmiot przechodził z rąk do rąk, a trzeba ustalić, kto miał go ostatni przed zbrodnią.

- Fakty typu „pożyczył od”, „oddał”, „zostawił w”, z godzinami, rozproszone po teczkach i dowodach (kartka „Oddaję lewar, dzięki – R.”).
- **Jeden fałszywy element:** ktoś twierdzi, że oddał, a dowód temu przeczy.
- **Pytanie:** kto miał przedmiot o godzinie zbrodni.
- Dobrze pasuje do kradzieży i otruć.

## Etap 6. Archetyp „Wspólnicy” (`accomplices`)

**Idea:** jedna osoba zdobyła narzędzie, druga dokonała czynu.

- **Dwie role:** „przyniósł” (reguły o dostępie: klucz, okno czasowe, los narzędzia) i „wykonawca” (reguły o cechach, alibi na czas zdarzenia, ślady).
- Reguła łącząca: „Wspólnicy dobrze się znają” (fakt `relation`) albo „ktoś przekazał narzędzie” (obserwacja dwóch osób w jednym miejscu).
- **UI oskarżenia:** wybór dwóch osób z przypisaniem roli. Pomyłka liczy się jak dziś.
- Tylko od L w górę.

---

## Etap 7. Zmienność pytania

Pole `question` w sprawie mówi, o co pytamy. Ekran oskarżenia buduje się z niego.

| `question` | Gracz wskazuje | Typowe archetypy |
|---|---|---|
| `culprit_weapon` | osoba + przedmiot (dziś) | classic |
| `culprit` | tylko osoba | timeline, planted |
| `culprit_time` | osoba + przedział czasu | timeline |
| `holder` | kto miał przedmiot | chain |
| `hideout` | gdzie ukryto łup (miejsce) | kradzież w classic albo chain |
| `pair` | dwie osoby z rolami | accomplices |

- Tytuł ekranu oskarżenia zmienia się z pytaniem: „Kto to zrobił?”, „Gdzie jest łup?”, „Kto miał lewar o 20:00?”.
- Tekst do udostępnienia i obrazek PNG pokazują typ sprawy bez spoilerów (np. ikonka typu sprawy).

---

## Etap 8. Ciągłość między sprawami

**Mieszkańcy dzielnicy.** Każde miasto dostaje stałą obsadę 12–20 postaci (`data/residents/<miasto>.js`): imię, nazwisko, rola, portret i **stałe cechy** (ręka, wzrost, okulary, palenie). W ok. 40% spraw 1–2 podejrzanych to stali mieszkańcy. Gracz zaczyna ich rozpoznawać („znowu ta dozorczyni”). Stałe cechy są faktami, więc generator dobiera ich tylko tam, gdzie pasują do logiki sprawy.

**Sprawa tygodnia (niedziela).**
- Od poniedziałku do soboty w każdej sprawie dnia pojawia się **jedno zdanie wątku** (np. „Sąsiadka mówi, że od tygodnia kręci się tu mężczyzna w zielonym kapeluszu”), za każdym razem w innej teczce.
- Niedzielna sprawa dnia zbiera te wątki: tajemnicza postać jest jednym z podejrzanych, a fakty z tygodnia są w aktach jako „wcześniejsze ustalenia”.
- Wątek tygodnia generowany z seeda tygodnia, więc jest taki sam dla wszystkich.
- Ekran wyniku w niedzielę: krótki epilog całego tygodnia.

**Komisarz.** Krótkie komentarze komisarza zależne od wyniku i od serii („Trzeci tydzień bez pomyłki. Na komendzie mówią o panu”).

---

## Etap 9. Mniej powtarzalne teksty i postacie

**Większe pule (cele):**

| Pula | Dziś | Cel |
|---|---|---|
| Role wspólne | ~28 | 60 |
| Role lokalne na miasto | 0–3 | 6 |
| Sceny na typ zbrodni | 4–6 | 12 |
| Smaczki miasta | 3–5 | 15 |
| Smaczki epoki | ~13 | 40 |
| Alibi potwierdzone | 9 | 20 (z obaleniami) |
| Ramy niepotwierdzonego alibi | 5 | 12 |
| Szablony obecności | 7 | 15 |
| Warianty zdań na wartość cechy | 6–9 | 12 |
| Motywy (tak/nie) na typ zbrodni | 6/6 | 12/12 |
| Opisy i dostęp do miejsc | 2/2 | 4/4 |
| Imiona na płeć | 50 | 80 (z podziałem na pokolenia: imiona starszych i młodszych) |

- Treści pisz wsadowo z pomocą LLM w osobnym narzędziu (`tools/content/`), ale każdą partię czyta człowiek, zanim trafi do `data/`. Zapisz w `CLAUDE.md`, które pule są „przejrzane”.
- **Imiona zależne od wieku roli:** emerytka to Leokadia albo Genowefa, studentka to Agnieszka albo Monika. Dodaj do ról pole `age: "young" | "mid" | "old"` i podziel pule imion.

**Unikanie powtórek między sprawami (archiwum):**
- Zapisuj w `localStorage` ostatnio użyte: imiona, role, sceny i smaczki z ostatnich ~10 spraw gracza.
- Przekazuj je do generatora jako `opts.avoid`. Generator omija je, dopóki starcza wariantów. Seed nadal decyduje o reszcie.
- Sprawa dnia **nie** używa `avoid`, żeby była identyczna dla wszystkich.

---

## Etap 10. Strojenie i pomiary

- **Rozkład archetypów** (start): classic 35%, timeline 20%, planted 15%, chain 15%, accomplices 15% (tylko L–XL). Do korekty po danych.
- **Analityka bez ciasteczek:** zdarzenia `case_start`, `case_solved`, `case_failed` z polami `archetype`, `size`, `time`, `hints`, `mistakes`. Na tej podstawie ustawisz wagi i trudność.
- **Generator raportuje** w `tools/generate.js`: rozkład archetypów, typów reguł, liczbę dowodów, głębokość wnioskowania (średnia i rozkład) oraz odsetek odrzuconych prób.

---

## Etap 11. Nowe typy zbrodni

Dziś są 4 typy: zabójstwo, kradzież, otrucie (zwierząt) i podpalenie. Cel: **około 12**, każdy z co najmniej 20 scenami (etap 9). Typy zbrodni losowane z **równymi szansami**, bez podziału na dni tygodnia czy wielkość sprawy. O trudności decyduje wielkość i archetyp, nie typ zbrodni.

| Typ | Narzędzie / podtyp (tag) | Przykładowe ślady i dowody |
|---|---|---|
| Szantaż | `pismo`: maszyna do pisania, nożyczki i klej, kalka | czcionka z wybitą literą, wycinki z „{gazeta}”, papier w kratkę |
| Fałszerstwo | `pieczec`: pieczątka, tusz, kalka, żyletka | podrobiony podpis, kartki i bony (1989–90), talony, świadectwo |
| Sabotaż | `sabotaz`: obcęgi, klucz nastawny, piłka do metalu | przecięte przewody, zepsuta winda, kocioł w kotłowni, rozkręcony rower |
| Zaginięcie | sceny: kto zniknął i skąd | pytanie `whereabouts`: gdzie jest zaginiony (nowy rodzaj oskarżenia) |
| Porwanie psa dla okupu | `sznur`, `trucizna` (usypiacz), klatka | list z żądaniem okupu, sierść w samochodzie |
| Napad | `tepe`, `ostre`, kominiarka | na kiosk, kantor, listonosza z rentami |
| Wandalizm | `farba`: puszka farby, spray, pędzel | graffiti, wybite szyby, zniszczona gablota spółdzielni |
| Otrucie człowieka | `trucizna` | cięższa wersja otrucia, z lekarzem i sekcją |

- Każdy typ ma własne: przyczynę (`cause`), zdanie o zniknięciu narzędzi, warianty reguł (`windowRule`, `keyRule`, `alibiRule`, `motiveRule`), motywy, zdania podejrzenia i braku motywu (min. 12/12), zakończenia (`epilogueEnd`).
- Nowe tagi narzędzi potrzebują przedmiotów w co najmniej 4 miejscach (inaczej nie wejdą do dużych spraw). Dopisz przedmioty i ikony pixel art.
- Realia epoki: kartki żywnościowe i bony tylko w 1989–1990, talony na benzynę do 1989.
- Raport generatora: rozkład typów zbrodni i scen. Żaden typ nie odbiega o więcej niż kilka punktów procentowych od równego udziału.

## Kolejność wdrożenia i wydania

| Wydanie | Etapy | Co zobaczą gracze |
|---|---|---|
| 2.1 | 0, 1, 9 (część: imiona wg wieku + `avoid`) | dowody rzeczowe, mniej powtórzeń |
| 2.2 | 2, 3 | nowe reguły, sprawy „oś czasu” |
| 2.3 | 4, 5, 7 | podrzucone dowody, łańcuch rąk, różne pytania |
| 2.4 | 6, 8 | wspólnicy, stali mieszkańcy, sprawa tygodnia |
| 2.5 | 11 | nowe typy zbrodni: szantaż, fałszerstwo, sabotaż, zaginięcie, porwanie psa, napad, wandalizm, otrucie człowieka |
| ciągle | 9, 10 | nowe treści, strojenie |

Po każdym wydaniu: `npm test` (min. 2000 spraw na archetyp, 0 błędów, 0 niewypełnionych wstawek), ręczne zagranie 3 spraw każdego nowego typu na telefonie, krótka notka „Co nowego” w grze, aktualizacja `CLAUDE.md`, commit.

## Definicja „gotowe” dla każdego archetypu

- [ ] 2000 spraw w każdej dozwolonej wielkości: 0 błędów, 0 niejednoznacznych.
- [ ] Głębokość wnioskowania: min. 3 kroki dla S, min. 5 dla XL.
- [ ] Ekran oskarżenia, wynik, wyjaśnienie („Rozumowanie”), podpowiedzi i obrazek PNG działają.
- [ ] Zapis postępu, limit spraw i ptaszek działają.
- [ ] Na 360 px szerokości tablica jest czytelna, a sznurki da się przeciągać.
- [ ] 3 sprawy zagrane ręcznie: rozwiązanie wynika z faktów, nic nie trzeba zgadywać.
