# Siatka Powiązań

Codzienna dedukcyjna gra detektywistyczna na telefon. Gracz czyta akta, łączy pinezki czerwonym sznurkiem na tablicy korkowej i oskarża sprawcę. Jedna sprawa dziennie, 3–5 minut. Język gry: polski.

Pełny opis produktu: `docs/brief.md`. Wzorcowa ręcznie ułożona sprawa: `cases/case_001.json`.

## Struktura

```
index.html            gra (ładuje skrypty poniżej; otwórz w przeglądarce)
js/game.js            interfejs: tablica, sznurki, akta, oskarżenie, wynik
engine/engine.js      RNG z seedem, solver, generator spraw, sprawa dnia
engine/sprites.js     pixel art 12×12: portrety z warstw, ikony miejsc i przedmiotów
data/base.js          warstwa epoki 1989–1999: imiona, role, miejsca, przedmioty,
                      cechy, alibi, realia lat, typy zbrodni, sceny, komentarze
data/cities.js        paczki miast: Warszawa, Poznań, Kraków, Łódź, Gdańsk,
                      Katowice, Wrocław (dzielnica, ulice, targ, kino, drużyna…)
tools/generate.js     test generatora i zapis spraw do cases/generated/
tools/bundle.js       skleja grę w jeden plik dist/siatka.html
cases/                case_001.json (wzorzec) + generated/ (próbki do przeglądu)
```

Komendy:
- `node tools/generate.js 2000` — generuje 2000 spraw (wszystkie miasta, lata i wielkości), każda sprawdzona solverem; raport + wyłapuje niewypełnione wstawki w tekście.
- `node tools/generate.js 12 out [miasto] [rok] [S|M|L|XL]` — zapisuje sprawy do `cases/generated/` do przeczytania, np. `12 out poznan 1993 XL`.
- `node tools/bundle.js` — buduje `dist/siatka.html`.
- `node tools/generate.js verify cases/case_001.json` — weryfikuje ręczną sprawę.

## Biblioteka treści (data/*.js)

- Tekst: `[męska|żeńska]` albo `[m|f|n]` dla przedmiotów, `{klucz}` dla wstawek z miasta i roku (`{street}`, `{market_on}`, `{team}`, `{church_at}`, `{money}`, `{police_dat}`…). Pełna lista: obiekt `V` w `build()` w silniku.
- Realia lat: wpis `{t:"…", years:[od,do]}` w dowolnej liście tekstów, a `years` na roli, scenie lub przedmiocie ogranicza je do tych lat. Przykłady: Pewex do 1990, denominacja 1995–96, komórki od 1996, „Klan” od 1997, milicja do kwietnia 1990 (potem policja i komisarz).
- Kwoty (`{money}`) liczą się wg roku: przed 1995 tysiące i miliony starych złotych, od 1995 nowe złote.
- Miejsca typowe dla miasta: `locations` w paczce miasta (np. lampownia i gołębnik w Katowicach, stajnia dorożkarska w Krakowie). `roles` w miejscu mówi, które role mają tam klucz. Przedmioty z takich miejsc są w `data/base.js` z `origins` wskazującym id miejsca. W miastach bez tego miejsca nigdy się nie pojawią. W ok. 60% spraw jedno z miejsc jest lokalne (jeśli pasuje do zbrodni).
- Różnorodność tekstu: w jednej sprawie to samo zdanie nie trafia do dwóch osób (`pickU` w silniku), dopóki starcza wariantów. Każda wartość cechy ma 6–9 wariantów zdań. Dopisując nowe, pilnuj, żeby było ich co najmniej 6, bo sprawa XL ma 6 osób.
- Miejsce ma `open`: zdania o tym, jak łatwo tam wejść, używane, gdy sprawa nie ma reguły o kluczach. Opisy w `desc` nie mogą wspominać o kłódkach i zamkach, bo kłóciłyby się z `open`.
- Nowe miasto = nowy wpis w `data/cities.js` (formy gramatyczne dzielnicy, ulice w dopełniaczu, targ w trzech formach, zakład pracy jako „robotnik”, własne role i smaczki).
- Rola ma `access` (miejsca, do których naturalnie ma klucz). Generator dobiera rolę do kluczy postaci, a gdy nie pasuje żadna, używa „zapasowego klucza od właściciela”.
- Przedmiot ma `tags` (tepe, ostre, sznur, wlam, trucizna, ogien) i `origins` (miejsca). Typ zbrodni wybiera tag, a generator szuka tylu miejsc z pasującymi przedmiotami, ile dowodów ma sprawa. Każdy tag potrzebuje co najmniej 4 miejsc, inaczej nie wejdzie do dużych spraw.
- Cecha ma wartości, zdania-fakty na każdą wartość, tekst reguły, podpowiedź i powód eliminacji. Nowa cecha = wpis w `traits` + nazwa w `TRAITS` w silniku + opis w `describeCulprit`.

## Ustalenia, których się trzymamy

- **Tryb gracza vs deweloperski:** gracze dostają tylko losowe sprawy („Nowa sprawa” od razu generuje). Wybór miasta, roku i wielkości działa po dopisaniu `#dev` do adresu.

- **Platforma:** najpierw PWA na GitHub Pages (walidacja przez link). Do sklepów: opakowanie tego samego kodu w Capacitora, bez przepisywania na Fluttera.
- **Stack:** czysty HTML/CSS/JS, bez frameworka, dopóki nie będzie realnej potrzeby. Tablica to DOM + SVG. Generator i solver w JS (Node), żeby jeden kod działał w przeglądarce i w skryptach.
- **Sznurek to twierdzenie, nie klucz odpowiedzi.** Gra nie porównuje sznurków z listą „wymaganych połączeń”. Ocenia, czy każde połączenie ma pokrycie w faktach (`supported_connections`) i czy gracz domknął obwód sprawcy (`culprit_chain`).
- **Wykluczanie** to stan węzła (szary, przekreślony), a nie rodzaj sznurka.
- **Oskarżenie jest dostępne zawsze.** Przycisk nigdy nie podpowiada, czy tablica jest poprawna. 3 próby.
- **Podpowiedzi** wskazują regułę do sprawdzenia, nigdy odpowiedź. Maks. 3.
- **Wynik:** gwiazdki (3 minus pomyłki, minus 1 za użycie podpowiedzi, min. 1 przy wygranej), tekst do udostępnienia bez spoilerów.
- **Bez reklam.** Monetyzacja: darmowa sprawa dnia + premium (archiwum, trudne sprawy, sprawa tygodnia).

## Zasady generatora spraw

Generator buduje sprawę z ustrukturyzowanych faktów (`facts`), a cały tekst widoczny dla gracza powstaje z faktów. Nigdy odwrotnie.

1. Losuj miasto, rok i wielkość (`SIZES`: S = 3 osoby / 2 dowody, M = 4 / 2–3, L = 5 / 3, XL = 6 / 3–4). Liczba miejsc = liczba dowodów.
2. Wybierz sprawcę i narzędzie. Sprawca spełnia wszystkie reguły.
3. Każdy pozostały dowód to fałszywy trop: sprawcy brakuje do niego klucza albo był tam o złej porze.
4. Reguły o dowodzie losuje się z zestawów (`ITEM_PATTERNS`): okno czasowe (w), klucz (k), los przedmiotu (f: śmietnik, tory, studzienka, odniesiony, nieodnaleziony). Alibi jest w ok. 60% spraw, w pozostałych zastępują je cechy (w tym pies, ortalion, motyw). Każda reguła ma 2–3 sformułowania.
5. W ok. 35% spraw dwa dowody pochodzą z jednego miejsca. Rozróżnia je wtedy tylko godzina zniknięcia albo los przedmiotu (klucz do miejsca jest wspólny).
- Reguła pośrednia „dump” (ok. 20% spraw): narzędzie porzucono tam, gdzie sprawca bywa codziennie. Akta przedmiotu mówią, gdzie go znaleziono (śmietnik, tory, park, budowa, targ), a akta osób, gdzie kto bywa (`habits`). Trzeba połączyć dwa węzły.
- Zmyłka „fałszywe alibi” (ok. 40% spraw): ktoś ma alibi, które brzmi jak potwierdzone, ale zdanie w aktach innej osoby je obala (bar zamknięty, msza odwołana, mecz przełożony…). Najczęściej kłamie sprawca, czasem niewinny, który odpada z innego powodu. Fakt `alibi_debunked`, teksty w `alibiConfirmed[].debunk`.
6. Każdy niewinny spełnia wszystkie reguły **oprócz jednej**. Każda reguła musi kogoś wyeliminować (albo odciąć sprawcę od fałszywego tropu). Przy dużych sprawach dwie osoby mogą odpaść z tej samej reguły. Notatnik ma 3–6 reguł.
5. Solver musi potwierdzić:
   - dokładnie jedno rozwiązanie (sprawca + narzędzie),
   - usunięcie dowolnej reguły psuje jednoznaczność (każda reguła jest potrzebna),
   - fakty nie są ze sobą sprzeczne.
   Sprawę, która nie przechodzi, odrzuć i losuj ponownie.
6. Tekst: na start szablony z wariantami + ręcznie pisane pule „smaczków” na motyw (`flavor`). LLM, jeśli w ogóle, tylko offline do opisów, z ponowną weryfikacją, że tekst nie dodaje ani nie zmienia faktów. **LLM nigdy nie układa logiki.**
7. Fakty w tekście nie mogą nazywać rozwiązania wprost (np. „to jest narzędzie zbrodni”).

Docelowo kilka archetypów spraw (kłamiący świadek, wspólnicy, czas z zegarka ofiary, zamiana przedmiotów), każdy jako osobny moduł, żeby gracze nie wyczuli jednego wzoru.

## Stan

Zrobione: warstwa epoki 1989–1999 + 7 miast, solver, generator archetypu `single_culprit_one_reason_each` ze zmienną wielkością (3–6 podejrzanych, 2–4 miejsca i dowody, 3–6 reguł), 4 typy zbrodni, 20 scen, 6 cech, modułowe portrety, dynamiczny układ tablicy, ekran „Nowa sprawa” (miasto, rok, wielkość), sprawa dnia z seeda daty (#1 = 3.11.2026), rosnąca w tygodniu (pon.–wt. S, śr.–czw. M, pt.–sob. L, niedz. XL). Każde miasto ma 2 własne miejsca z własnymi dowodami. Uduszenia działają we wszystkich wielkościach. Test: 4000/4000 spraw poprawnych.

## Najbliższe kroki

1. Przeczytać 12 spraw z `cases/generated/` i poprawić teksty, które brzmią sztucznie.
2. Streak i statystyki w localStorage, zapis postępu bieżącej sprawy.
3. Manifest i service worker (PWA, offline).
4. Deploy na GitHub Pages.
5. Kolejne archetypy: fakty pośrednie (alibi potwierdzone w aktach innej osoby), kłamiący świadek, wspólnicy.
7. Sprawdzić realia lat i nazwy miejsc w paczkach miast (to fikcja, ale ma brzmieć wiarygodnie).

## Styl

- Klimat: retro noir, pixel art, korek, polaroidy, maszynopis. Fonty: Pixelify Sans, Special Elite, Courier Prime.
- Mobile first, pionowy ekran, duże strefy dotyku dla pinezek.
- Teksty dla gracza: krótkie zdania, konkretne godziny i szczegóły z epoki.
