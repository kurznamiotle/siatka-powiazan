# Siatka Powiązań

Codzienna dedukcyjna gra detektywistyczna na telefon. Gracz czyta akta, łączy pinezki czerwonym sznurkiem na tablicy korkowej i oskarża sprawcę. Jedna sprawa dziennie, 3–5 minut. Język gry: polski.

Pełny opis produktu: `docs/brief.md`. Wzorcowa ręcznie ułożona sprawa: `cases/case_001.json`.

## Struktura

```
index.html            gra (ładuje skrypty poniżej; otwórz w przeglądarce)
js/game.js            interfejs: tablica, sznurki i gesty, akta, oskarżenie, wynik,
                      zapis postępu, haptyka
js/settings.js        okno Ustawienia (zębatka): Jak grać, Statystyki, dźwięk, muzyka,
                      wibracje, osiągnięcia, instalacja gry (PWA), zgłoszenia uwag; przycisk pełnego
                      ekranu w nagłówku
js/audio.js           Web Audio bez plików: efekty + generowana muzyka noir
js/tutorial.js        samouczek „Jak grać”: 6 animowanych plansz (CSS w pliku)
js/stats.js           seria i statystyki spraw dnia (localStorage)
js/shareimg.js        wynik jako obrazek PNG 1080×1350 (canvas) bez spoilerów
js/achievements.js    osiągnięcia: lista, pikselowe odznaki, plansza z fanfarą (CSS w pliku)
js/track.js           analityka GoatCounter: zdarzenia i powroty
sw.js                 service worker (offline); nowy plik gry dopisz do SHELL
manifest.webmanifest  PWA; ikony w icons/ (rysuje je tools/icons.js)
engine/engine.js      RNG z seedem, tekst, wspólny kontekst sprawy, rejestr archetypów,
                      generateCase, sprawa dnia, avoidFrom
engine/solver.js      ogólny solver (hipotezy archetypu × reguły) + biblioteka predykatów
                      (alibi, trait, window, key, fate, dump) + kontrola dowodów rzeczowych
engine/archetypes/    archetypy spraw; classic.js = jeden sprawca, każdy odpada z jednej reguły
engine/versions/      zamrożone starsze wersje generatora (v2_0.js = commit 0879423), tylko dla spraw dnia
engine/sprites.js     pixel art 12×12: portrety z warstw, ikony miejsc, przedmiotów i dowodów
data/base.js          warstwa epoki 1989–1999: imiona, role, miejsca, przedmioty,
                      cechy, alibi, realia lat, typy zbrodni, sceny, komentarze
data/cities.js        paczki miast: Warszawa, Poznań, Kraków, Łódź, Gdańsk,
                      Katowice, Wrocław (dzielnica, ulice, targ, kino, drużyna…)
tools/generate.js     test generatora i zapis spraw do cases/generated/
tools/bundle.js       skleja grę w jeden plik dist/siatka.html
tools/freeze-version.js  zamraża generator z commita do engine/versions/
tools/test-versions.js   test wersji: sprawy dnia z cases/fixtures/ muszą się zgadzać
cases/                case_001.json (wzorzec) + generated/ (próbki do przeglądu)
                      + fixtures/daily-<wersja>.json (skróty spraw dnia z wdrożonego kodu)
```

Komendy:
- `node tools/generate.js 2000` — generuje 2000 spraw (wszystkie miasta, lata i wielkości), każda sprawdzona solverem; raport + wyłapuje niewypełnione wstawki i podwójne kropki w tekście. Raportuje też archetypy, rodzaje dowodów rzeczowych, ich liczbę na wielkość, odsetek spraw, które bez dowodów tracą jedno rozwiązanie, i powtórki imion, ról i scen z `avoid` i bez. Raportuje udział dokumentów, które obalają alibi, i kończy się błędem, gdy w sprawie z dowodami żaden dowód nie dotyczy niewinnego. Sprawdza też spójność treści: reguła o oknie bez informacji o czasie, cudze alibi zawodowe, zdanie niepasujące do wieku. Kończy się błędem przy niespójności albo poniżej progów (średnio < 1 dowód, XL < 3, dowód potrzebny w < 60% spraw, `avoid` nie zmniejsza powtórek).
- `node tools/generate.js 12 out [miasto] [rok] [S|M|L|XL]` — zapisuje sprawy do `cases/generated/` do przeczytania, np. `12 out poznan 1993 XL`.
- `node tools/bundle.js` — buduje `dist/siatka.html`.
- `node tools/generate.js verify cases/case_001.json` — weryfikuje ręczną sprawę.
- `npm test` — 1000 spraw z generatora + weryfikacja `case_001.json` + test wersji (`tools/test-versions.js`).
- `node tools/freeze-version.js <commit> <wersja>` — zamraża generator z danego commita (patrz „Wersje generatora”).
- `node tools/icons.js` — rysuje ikony PWA do `icons/`.
- `node tools/og.js` — robi grafikę podglądu linku `icons/og.jpg` (1200×630) z `tools/og.html` (wymaga Chrome).

## Biblioteka treści (data/*.js)

- Tekst: `[męska|żeńska]` albo `[m|f|n]` dla przedmiotów, `{klucz}` dla wstawek z miasta i roku (`{street}`, `{market_on}`, `{team}`, `{church_at}`, `{money}`, `{police_dat}`…). Pełna lista: obiekt `V` w `build()` w silniku.
- Realia lat: wpis `{t:"…", years:[od,do]}` w dowolnej liście tekstów, a `years` na roli, scenie lub przedmiocie ogranicza je do tych lat. Przykłady: Pewex do 1990, denominacja 1995–96, komórki od 1996, „Klan” od 1997, milicja do kwietnia 1990 (potem policja i komisarz).
- Kwoty (`{money}`) liczą się wg roku: przed 1995 tysiące i miliony starych złotych, od 1995 nowe złote.
- Miejsca typowe dla miasta: `locations` w paczce miasta (np. lampownia i gołębnik w Katowicach, stajnia dorożkarska w Krakowie). `roles` w miejscu mówi, które role mają tam klucz. Przedmioty z takich miejsc są w `data/base.js` z `origins` wskazującym id miejsca. W miastach bez tego miejsca nigdy się nie pojawią. W ok. 60% spraw jedno z miejsc jest lokalne (jeśli pasuje do zbrodni).
- Różnorodność tekstu: w jednej sprawie to samo zdanie nie trafia do dwóch osób (`pickU` w silniku), dopóki starcza wariantów. Każda wartość cechy ma 6–9 wariantów zdań. Dopisując nowe, pilnuj, żeby było ich co najmniej 6, bo sprawa XL ma 6 osób.
- Miejsce ma `open`: zdania o tym, jak łatwo tam wejść, używane, gdy sprawa nie ma reguły o kluczach. Opisy w `desc` nie mogą wspominać o kłódkach i zamkach, bo kłóciłyby się z `open`.
- Nowe miasto = nowy wpis w `data/cities.js` (formy gramatyczne dzielnicy, ulice w dopełniaczu, targ w trzech formach, zakład pracy jako „robotnik”, własne role i smaczki).
- Imiona są w trzech pokoleniach (`names.m|f.old|mid|young`, ok. 80 na płeć). Rola ma `age` (jedno albo lista), z którego bierze się pula imion i kolor włosów (siwi starsi). Scena może mieć `vage` (wiek ofiary). Nowa rola bez `age` dostaje imię z dowolnego pokolenia.
- Tekst z `ages:[…]` (np. w zdaniach cech i w `habits`) trafia tylko do postaci w tym wieku, np. emeryci bez firmowego Żuka i bez dorabiania na budowie.
- Alibi zawodowe: wpis w `alibiConfirmed` z `roles:[…]` dostaje tylko pasująca rola (pielęgniarka: dyżur na izbie przyjęć, motorniczy: kurs tramwajem…). „Druga zmiana w zakładzie” ma `roles:["worker"]`, czyli tylko robotnik z miasta. Gdy rola ma własne alibi, wypada ono mniej więcej co drugi raz. Każda rola ma alibi zawodowe, a każde ma `debunk`. Do fałszywego alibi potrzebny jest `debunk` pasujący do tej pracy, a do dowodu `doc`.
- Los przedmiotu ma `why`: zdanie bezosobowe do wyjaśnienia („ten przedmiot znaleziono…”, „tego przedmiotu do dziś nie odnaleziono”).
- Rola ma `access` (miejsca, do których naturalnie ma klucz). Generator dobiera rolę do kluczy postaci, a gdy nie pasuje żadna, używa „zapasowego klucza od właściciela”.
- Przedmiot ma `tags` (tepe, ostre, sznur, wlam, trucizna, ogien) i `origins` (miejsca). Typ zbrodni wybiera tag, a generator szuka tylu miejsc z pasującymi przedmiotami, ile dowodów ma sprawa. Każdy tag potrzebuje co najmniej 4 miejsc, inaczej nie wejdzie do dużych spraw.
- Reguły w notatniku opisują ślad, a nie wniosek: „Na miejscu leżał świeży niedopałek.”, bez „Sprawca pali.”. Gracz sam wyciąga wniosek, ale musi być tylko jeden. Skracając regułę, usuwaj tylko dopowiedzenie z wnioskiem, nigdy informacji potrzebnej do logiki: reguła o oknie czasowym zawsze mówi, że sprawca był na miejscu wtedy, gdy przedmiot znikał, a reguła o kluczu, że drzwi otworzył sam sprawca. Gdy sam ślad mógłby być czyjkolwiek, zdanie przypisuje go sprawcy („świeży odcisk podeszwy sprawcy, rozmiar 44”). Wniosek wprost może paść w podpowiedzi (`hint`) i w wyjaśnieniu na ekranie wyniku.
- Cecha ma wartości, zdania-fakty na każdą wartość, tekst reguły, podpowiedź i powód eliminacji. Nowa cecha = wpis w `traits` + nazwa w `TRAITS` w `engine/archetypes/classic.js` + opis w `describeCulprit`. Ręka przy zabójstwie: `ruleMurder` (cios), `ruleStrangle` (sznur).
- Dowody rzeczowe (treści): `evidence.presence` (zapiski obecności, `{t}` `{in}`), `evidence.keys` (książka kluczy, `{gen}` `{flat}`, tylko miejsca z `keyBookLocs`), `doc` na wpisach `alibiConfirmed` (dokument alibi, `{from}` `{to}`), `evidence` na cechach shoe, car, glasses, dog, smoker i jacket oraz `letters` na typach zbrodni (motyw). Wszędzie `{ini}` = inicjały właściciela. Do tego `flatTpl` (numer mieszkania w teczce), `alibiPaperTpl` (teczka, gdy alibi potwierdza dopiero dowód) i `keyBookNote`. Etykieta (`label`) jest krótka, bo idzie na polaroid. W jednej sprawie etykiety się nie powtarzają.

## Ustalenia, których się trzymamy

- **Wersje generatora (gra ma stałych graczy).** Wydanie nie może zmienić bieżącej sprawy dnia. `GENERATOR_VERSIONS` w `engine/engine.js` podaje, od którego dnia (lokalna data sprawy dnia) obowiązuje każda wersja. `GEN_VERSION` to bieżący kod. Sprawa dnia bierze wersję ze swojego dnia (`versionFor`), a starsze wersje są zamrożone w `engine/versions/` i rejestrują się w `SiatkaLegacy`. Archiwum i rozgrzewka zawsze biorą bieżącą. Sprawa ma pole `gen` (sprawy sprzed wersjonowania nie mają go i liczą się jako 2.0). Zapis postępu ma `gen`. Zapis z inną wersją niż sprawa albo niż wersja na dziś gra pomija i zaczyna od świeżej sprawy, bez wywracania się. Synchronizacja kart (`sameCase`) też porównuje wersję. Jeśli zamrożony plik się nie wczyta, sprawa dnia pochodzi z bieżącego kodu (ostrzeżenie w konsoli).
  **Nowe wydanie, krok po kroku:**
  1. `node tools/freeze-version.js <wdrożony commit> <stara wersja>`
  2. Wpis w `GENERATOR_VERSIONS` z `frozen` oraz nowa wersja z datą **najbliższej północy po wdrożeniu**, nigdy dzisiejszą. Gdy wdrożenie się opóźni, przesuń datę.
  3. Podbij `GEN_VERSION`, dopisz plik do `index.html` i do `SHELL` w `sw.js`, podbij `VERSION` cache.
  4. Wzorzec `cases/fixtures/daily-<stara>.json` z dniem wdrożenia (skrót sprawy dnia z wdrożonego kodu).
  5. `npm test`.

- **Tryb gracza vs deweloperski:** gracze dostają tylko losowe sprawy („Nowa sprawa” od razu generuje). Wybór miasta, roku i wielkości działa po dopisaniu `#dev` do adresu.
- **Tempo dla nowych graczy:** wielkość losowej sprawy zależy od liczby ukończonych gier (sprawy dnia + losowe, z `siatka-stats`): gry 1–3 S, 4–5 S/M, 6–7 M, 8–10 M/L, od 11. pełna losowość (`rampSize` w `js/game.js`). Sprawa dnia zostaje wspólna dla wszystkich. Nowy gracz (0 gier), który trafi na dzień L/XL, dostaje najpierw „Sprawę na rozgrzewkę” (S, poza serią), a jej wynik prowadzi przyciskiem do sprawy dnia.

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

**Dowody rzeczowe (wydanie 2.1).** Węzeł `evidence` niesie jeden fakt strukturalny przeniesiony z teczki osoby albo z akt miejsca. Fakt dostaje `src` = id dowodu i znika z teczki. Właściciela wskazuje znak: inicjały (fakt `mark` kind `initials`, czytelne z nazwiska) albo numer mieszkania (`flat`, wtedy numer ma w teczce każdy podejrzany). Fakt `evidence {id, kind, owner, mark}` łączy dowód ze znakiem. Solver (`checkEvidence`) wymaga, żeby znak pasował do dokładnie jednej osoby. Liczba: S i M 1–2, L 2–3, XL 3–4 (`EV_COUNT`). Zwykle jeden dowód jest potrzebny do rozwiązania (fakt sprawcy albo alibi niewinnego), reszta to wabiki. W ok. 30% spraw (`LIE_DOCS`) dokumenty alibi obalają alibi zamiast je potwierdzać: dostaje je ktoś bez alibi (sprawca albo niewinny odpadający z innej reguły), teczka podaje godziny z zeznania, a dokument inne godziny (fakt `alibi` z godzinami dokumentu, `lie: "hours"`; przy „ostatnim seansie” i nocnych zmianach godziny wypadają po zbrodni) albo inny dzień (`lie: "day"`, dopisek z `docOtherDay`, tylko w dokumentach bez „tamtego dnia/wieczoru”). Ton teczki jest ten sam co przy prawdziwym dokumencie. W każdej sprawie z dowodami co najmniej jeden dowód dotyczy niewinnego. Klucz trafia na dowód tylko wtedy, gdy jest zapasowy, bo klucz z urzędu zdradza rola. Dowody losują się z osobnego strumienia RNG (`seed/ev`). Na tablicy mają własny rząd pod przedmiotami. Sznurki osoba↔dowód i miejsce↔dowód są w `supported_connections`. Dowodu nie da się wykluczyć.

**Archetypy.** Archetyp to moduł w `engine/archetypes/`, który rejestruje się przez `Siatka.register({id, name, minSize, weight, question, build(ctx), hypotheses(c), holds(rule, hyp, ix, c)})`. `build` dostaje od silnika wspólny kontekst (`context()`: RNG, miasto, rok, wielkość, `V`, `T`, `pickU`; kolejność losowań jest częścią formatu). Archetyp losuje się z wag z osobnego strumienia (`seed/arch`), z uwzględnieniem `minSize` (`opts.archetype` wymusza). Sprawa ma pola `archetype` i `question`. Stare nazwy w ręcznych sprawach obsługują `aliases`. Nowy plik archetypu dopisz do `index.html`, `SHELL` w `sw.js` i do `require` na końcu `engine.js`.

**Unikanie powtórek (`opts.avoid`).** Sprawa zwraca `used` (imiona, nazwiska, role, sceny, smaczki). Gra trzyma `used` z ostatnich 10 spraw w `siatka-recent` i podaje `Siatka.avoidFrom(...)` sprawom z archiwum i rozgrzewce. Generator omija te treści, dopóki starcza innych. Sprawa dnia nigdy nie dostaje `avoid`. Pusty `avoid` daje te same losowania co brak `avoid`.

Docelowo kilka archetypów spraw (kłamiący świadek, wspólnicy, czas z zegarka ofiary, zamiana przedmiotów), każdy jako osobny moduł, żeby gracze nie wyczuli jednego wzoru.

## Stan

Wydanie 2.1 (wg `docs/update-spraw-v2.md`): etap 0 (archetypy w modułach, ogólny solver; refaktor dał bajt w bajt te same sprawy co wcześniej), etap 1 (dowody rzeczowe: w 4000 sprawach średnio 2,24, XL min. 3, rozwiązanie wymaga dowodu w ok. 95%) i z etapu 9 imiona wg wieku roli oraz `opts.avoid` (powtórki imion z ostatnich 10 spraw: 28% → 0%, scen 41% → 10%). Przy okazji: „ze” przed zbitką spółgłosek („ze Słowiańskiej”) w `tx`, osobne reguły ręki przy uduszeniu. Treści do przejrzenia przez człowieka (napisane w 2.1, jeszcze nieprzejrzane): imiona w pokoleniach, `age` ról, wszystkie teksty dowodów rzeczowych. Przejrzane: nic z 2.1.

Zrobione wcześniej: warstwa epoki 1989–1999 + 7 miast, solver, generator archetypu `classic` (dawniej `single_culprit_one_reason_each`) ze zmienną wielkością (3–6 podejrzanych, 2–4 miejsca i dowody, 3–6 reguł), 4 typy zbrodni, 20 scen, 6 cech, modułowe portrety, dynamiczny układ tablicy, ekran „Nowa sprawa” (miasto, rok, wielkość), sprawa dnia z seeda daty (#1 = 3.11.2026), rosnąca w tygodniu (pon.–wt. S, śr.–czw. M, pt.–sob. L, niedz. XL). Każde miasto ma 2 własne miejsca z własnymi dowodami. Uduszenia działają we wszystkich wielkościach. Test: 4000/4000 spraw poprawnych (też po 2.1).

Interfejs: PWA (manifest, offline przez service worker), deploy na GitHub Pages. Zapis postępu w localStorage: osobno sprawa dnia i ostatnia losowa, razem z całym JSON-em sprawy. Zegar stoi, gdy gra jest w tle. Pinezka ma strefę dotyku 46 px, a sznurek przyciąga się do pinezki w promieniu 44 px. Po dotknięciu pinezki pulsują węzły innego typu (nigdy tylko te z pokryciem w faktach, bo to zdradzałoby odpowiedź). Połączenia w obrębie jednego typu są zablokowane. W aktach i notatniku wyróżnione są godziny, miejsca (`forms` na węźle miejsca), klucze, alibi, auta oraz inicjały i numery mieszkań (do łączenia dowodów rzeczowych z teczkami). Haptyka: `navigator.vibrate` na Androidzie, trik z `<input switch>` na iOS 18+, a wszędzie sprężyste animacje CSS. Dźwięk i muzyka są domyślnie: efekty włączone, muzyka wyłączona. Limit: 5 nowych spraw dziennie (`DAILY_NEW_CASES` w `js/game.js`), licznik z lokalną datą w `siatka-quota`, zeruje się o północy. Sprawa dnia i rozgrzewka się nie liczą, `#dev` omija limit. Przycisk pokazuje „Nowa sprawa · 3/5”, przy 0/5 jest wyszarzony, ale klikalny i otwiera kartkę „Na dziś archiwum zamknięte” z zapowiedzią premium (bez płatności). Przycisk „Sprawa dnia” ma znaczek: zielony ✓ po rozwiązaniu, szary ✗ po umorzeniu (z zapisu sprawy dnia). Licznik i znaczek odświeżają się po każdej sprawie, po powrocie do karty i o północy.

Nagłówek: zegar, próby, pełny ekran (tylko w przeglądarce, która go obsługuje, nie w zainstalowanej grze) i zębatka. Reszta jest w oknie Ustawienia. Instalacja: na Androidzie i w Chrome na komputerze przycisk wywołuje systemowe okno (`beforeinstallprompt`), na iOS jest instrukcja (Udostępnij → Do ekranu początkowego), a w zainstalowanej grze informacja. Gdy przeglądarka nie wyśle `beforeinstallprompt` (gra już zainstalowana, okno wcześniej odrzucone), Ustawienia i samouczek pokazują, gdzie w menu danej przeglądarki jest instalacja (`hint()` w `js/settings.js`: Chrome, Edge, Samsung Internet, Firefox na Androidzie). Firefox na komputerze nie dostaje nic. Preferencje poza dźwiękiem: `siatka-prefs` (`haptic`).

Zgłoszenia uwag: Formularz Google (odpowiedzi w arkuszu autora), otwierany z Ustawień i spod wyniku sprawy. Gra sama wypełnia pola „Sprawa” (etykieta, miasto, rok, wielkość, seed i stan, wystarczy do odtworzenia) i „Urządzenie”, a spod wyniku także kategorię „Błąd w sprawie/logice”. Identyfikatory pól (`entry.…`) są w `js/settings.js`. Po zmianie pytań w formularzu trzeba je pobrać na nowo (link do wypełnionego wstępnie formularza).

Samouczek: otwiera się sam przy pierwszym uruchomieniu (flaga `siatka-howto` w localStorage) i z Ustawień („Jak grać”). Przy pierwszym uruchomieniu ostatnia plansza zaprasza do instalacji, gdy jest możliwa. Zegar sprawy stoi, gdy jest otwarty. Portrety i nazwy pochodzą ze sprawy demonstracyjnej (seed `samouczek`, Warszawa 1994, S). Gdy zmienisz zasady gry (gwiazdki, próby, podpowiedzi), popraw też teksty plansz.

Analityka: GoatCounter (https://kurznamiotle.goatcounter.com), bez ciasteczek i danych osobowych. Wyłączona na localhost, z pliku i w `#dev`. Zdarzenia wysyła `SiatkaTrack(ścieżka, tytuł)`: `gracz/nowy`, `sprawa/start|wygrana|przegrana/…`, `wynik/N-gwiazdki`, `wynik/kopiuj|udostepnij|obrazek`, `limit/wyczerpany`, `podpowiedz/N`, `samouczek/start-auto|start-przycisk|ukonczony|pominiety-krok-N`, `statystyki/otwarte`, `instalacja/zgoda|odmowa-samouczek|ustawienia`, `instalacja/zainstalowana`, `ustawienia/muzyka-wl|wyl`, `uwagi/ustawienia|wynik`, `seria/N` (3, 7, 14, 30…), `osiagniecie/<id>`, `osiagniecia/otwarte`, `powrot/po-N-dniach` (raz na przeglądarkę, gdy gracz wróci co najmniej N dni po pierwszej wizycie). Retencja ≈ `powrot/…` ÷ `gracz/nowy`.

Obrazek wyniku: przycisk „Zapisz obrazek” pod wynikiem. Nazwa gry, sprawa, miasto i rok, pieczątka, gwiazdki, czas, pomyłki, podpowiedzi, seria, adres. Tablica gracza jest pomniejszona, ze sznurkami i wykluczeniami, ale bez podpisów i portretów (zdjęcia zastępcze), a karty w rzędach są przetasowane, żeby z układu nie dało się odczytać sprawcy sprawy dnia. Obrazek rysuje się w tle zaraz po otwarciu wyniku, bo „Udostępnij” musi ruszyć od razu po stuknięciu. Telefon z udostępnianiem plików dostaje systemowe „Udostępnij”, reszta pobiera plik.

Seria i statystyki: tylko sprawy dnia, zapis po numerze sprawy (`siatka-stats`). Sprawa dnia jeszcze nierozegrana nie przerywa serii. Tekst wyniku kończy się adresem `siatkapowiazan.pl` i serią od 2 dni. Na telefonie przycisk to systemowe „Udostępnij”.

Osiągnięcia: 18 odznak w trzech klasach (brąz, srebro, złoto), lista `ACH` w `js/achievements.js`, zapis w `siatka-ach` (zdobyte z datą + zebrane miasta, lata i typy zbrodni). Liczba rozwiązanych spraw i seria pochodzą z `siatka-stats`. Po zamkniętej sprawie `game.js` woła `SiatkaAch.onFinish(...)`, a nowe odznaki pokazują się kolejno na planszy (dźwięk `medal`, iskry, wibracja) nad wynikiem. Lista z postępem jest w Ustawieniach.

## Najbliższe kroki

1. Przeczytać 12 spraw z `cases/generated/` i poprawić teksty, które brzmią sztucznie. Przejrzeć teksty dowodów rzeczowych i imiona z 2.1.
2. Wydanie 2.2: etap 2 (bogatsza logika reguł, metryka głębokości) i etap 3 (archetyp „Oś czasu”). Potem 2.3 i 2.4 wg `docs/update-spraw-v2.md`.
3. Notka „Co nowego” w grze dla wydania 2.1 (dowody rzeczowe) i ręczne zagranie 3 spraw z dowodami na telefonie.
5. Kolejne archetypy: fakty pośrednie (alibi potwierdzone w aktach innej osoby), kłamiący świadek, wspólnicy.
7. Sprawdzić realia lat i nazwy miejsc w paczkach miast (to fikcja, ale ma brzmieć wiarygodnie).

## Styl

- Klimat: retro noir, pixel art, korek, polaroidy, maszynopis. Fonty: Pixelify Sans, Special Elite, Courier Prime.
- Mobile first, pionowy ekran, duże strefy dotyku dla pinezek.
- Teksty dla gracza: krótkie zdania, konkretne godziny i szczegóły z epoki.
