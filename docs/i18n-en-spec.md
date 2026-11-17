# Specyfikacja tłumaczenia treści spraw na angielski (data/i18n/en/base.js, cities.js)

Stan: interfejs i teksty składane w kodzie (`gen.*`) są po angielsku (`data/i18n/en.js`). Treści spraw (role, cechy, alibi,
sceny, dowody, miasta) są jeszcze polskie. Ten dokument opisuje, jak odmiana polskich szablonów przekłada się na angielski.

## Zasady ogólne

- Silnik składa zdanie w trzech krokach (`tx` w gramatyce języka): (1) wstawki `{nazwa}`, (2) warianty `[a|b|c|d]` wg rodzaju
  (indeksy: m=0, f=1, n=2, pl=3, z pominiętymi ostatnimi: brak wariantu = ostatni podany), (3) znaczniki Kartoteki `{g:hasło|tekst}`.
- Angielski używa tych samych indeksów: `[he|she|it|they]`. Osoby to m/f (`[he|she]`, `[his|her]`, `[him|her]`), przedmioty m/f/n/pl
  (`[it|it|it|they]`, `[was|was|was|were]`). Przedmioty w polskim mają rodzaj gramatyczny, w angielskim liczy się tylko liczba:
  dla `g:"pl"` (widły, nożyce, nożyczki, obcęgi, ale też „scissors”, „pliers”) używaj `they/were`, dla reszty `it/was`.
  Rodzaje polskie m/f/n zostają w danych jako `g`, ale w angielskim tekście wszystkie trzy dają to samo (`[X|X|X|Y]`).
- Przedimki: `a/an` dopasowuje gramatyka (`en.js`, `tx`), więc w treściach pisz po prostu `a`. Wyjątek: `the` i `a` przed nazwą
  własną ustala pole danych (patrz niżej), nie szablon.
- Polskie nazwy własne, miejsca, marki zostają polskie („Pewex”, „Społem”, „Kiosk Ruchu”).
- Nowe teksty w kodzie: klucz w `pl.js` i `en.js`, nie polskie słowa w kodzie (ostatnio przeniesione: „O {toHM}”, „Od … do …”,
  „… i …:”, „… to …”, „Do tego …”, „m. {n}”).

## Pola odmiany w szablonach

Kolumna „użyć” to liczba wystąpień wstawki w `pl/base.js` + `pl/cities.js`.

### Miejsca (`locations`, każde miejsce w base i w paczkach miast)

| Pole | PL (przykład) | Gdzie | EN (propozycja) | Uwagi |
|---|---|---|---|---|
| `name` | „Apteka „Pod Orłem”” | nazwa na karcie | „The Pod Orłem pharmacy” albo „Apteka Pod Orłem pharmacy” | nazwa własna zostaje, dopisz rodzaj miejsca |
| `label` | „Apteka” | polaroid | „Pharmacy” | krótko |
| `gen` | „apteki” (`{gen}`, 12) | „Ma klucz do {gen}” | „the pharmacy” | angielski nie ma dopełniacza: `gen` = „the X” (po „key to”, „keys to”) |
| `in` | „w aptece” (`{in}`, 56) | obecność, alibi, trasy | „at the pharmacy” / „in the cellar” / „on the allotments” | dobierz przyimek do miejsca: **in** (piwnica, garaż, kotłownia, warsztat), **at** (kiosk, sklep, apteka, zakład), **on** (podwórko → „in the yard”, ulica, targ) |
| `from` | „z apteki” (`{from}` w opisach przedmiotów, 69 z `{from}` alibi) | „zniknęło z …” | „from the pharmacy” | |
| `to` (nowe, tylko EN) | — | „poszedł do …” | „to the pharmacy” | polskie szablony mają je wpisane w treść; w EN pole `to` pozwoli składać „went to {to}” |
| `the` (nowe) | — | „the pharmacy” bez przyimka | „the pharmacy” | podmiot lub dopełnienie: „The pharmacy was locked” |
| `pt` | `shop`, `yard`… | filtr świadków | bez zmian | nie tłumaczyć |

Wzór danych EN: `{ id:"apteka", pt:"shop", name:"…", label:"…", the:"the pharmacy", gen:"the pharmacy", in:"at the pharmacy", to:"to the pharmacy", from:"from the pharmacy" }`.
Silnik zna dziś tylko `gen/in/from`; pole `to` i `the` doda się w silniku przy tłumaczeniu (opcjonalne, brak = `in`).

### Przedmioty (`items`)

| Pole | PL | EN | Uwagi |
|---|---|---|---|
| `name` | „Żeliwny lewar” | „Cast-iron jack” | z dużej litery, bez przedimka |
| `acc` | „lewar” (biernik, po „zabrać {acc}”) | „the jack” | w EN `acc` = „the X” (też jako podmiot: „the jack was found…”) |
| `g` | m/f/n/pl | zostaje; w EN liczy się tylko `pl` vs reszta | |
| `label` | „Lewar” | „Jack” | |
| nazwa w tekstach (`lc1(name)`) | „żeliwny lewar” | „cast-iron jack” | silnik zmniejsza pierwszą literę: pisz nazwy tak, by to działało |

### Los przedmiotu (`fates`)

| Pole | PL | EN |
|---|---|---|
| `place` | „w parku”, „przy torach”, „{market_on}” | „in the park”, „by the railway”; użyte w „…turned up {place}” i „isn't {place} every day” |
| `why` | „ten przedmiot znaleziono rano w śmietniku” | „this item was found in a bin at dawn” (zdanie po „but …”) |
| `item` | „[Znaleziony|Znaleziona|Znalezione|Znalezione] rano…” | „Found in the bin early in the morning.” (bez wariantów rodzaju) |
| `rule` | „To, czego użył sprawca, ktoś znalazł rano…” | „Whatever the culprit used was found…” |

### Miasto (`cities.js`)

| Pole | PL | EN |
|---|---|---|
| `district.nom` / `gen` / `na` / `po` (`{district_gen}` 18, `{district_na}` 8, `{district_po}`) | „Praga”, „Pragi”, „na Pradze”, „po Pradze” | `nom`: „Praga”, `gen`: „Praga” (pole zostaje, ale bez odmiany), `na`: „in Praga”, `po`: „around Praga”. Gdzie PL ma „na skraju {district_gen}”, EN pisze „on the edge of {district}” |
| `streets[]` (`{street}` 360, `{street2}` 30) | dopełniacz: „Ząbkowskiej” po „przy” | „Ząbkowska Street”; szablon pisze „on {street}” / „in {street}”, więc dodaj nazwę z „Street”/„Road”/„Square” |
| `market.on` / `from` / `to` (`{market_on}` 30, `{market_from}`, `{market_to}`) | „na bazarze Różyckiego”, „z bazaru Różyckiego”, „na bazar Różyckiego” | „at the Różycki bazaar”, „from the Różycki bazaar”, „to the Różycki bazaar” |
| `church_at` (17) | „u św. Floriana”, „w farze” | „at St Florian's”, „at the parish church” |
| `teams[]` (`{team}` 9) | dopełniacz: „mecz Legii” | nazwa w mianowniku: „the Legia match” → pole `teams` = „Legia” i szablon „watched the {team} match” |
| `cinema` | „Praha” w „kina „{cinema}”” | „the Praha cinema” (szablon: „the {cinema} cinema”) |
| `gazeta` | „Express Wieczorny” | bez zmian |
| `dworzec` (11) | miejscownik: „na Dworcu Wileńskim” (po „przy”) | „Wilno station” → szablon „at {dworzec}” z nazwą „Wileński station” |
| `szpital` (4) | miejscownik: „w szpitalu praskim” | „the Praga hospital” (szablon „at {szpital}”) |
| `walk` | „nad Wisłę” (kierunek) | „to the Vistula” |
| `uni` | dopełniacz: „Student Politechniki” | „student at {uni}”: „the Polytechnic” |
| `zaklad_at` | „w zakładach Cegielskiego” | „at the Cegielski works” |
| `bars[]` (`{bar}` 13) | w cudzysłowie, nazwa własna | zostaje: „Pod Kogutem” |

### Wstawki roku i sprawy (`V` w `build()`)

| Wstawka | PL | EN |
|---|---|---|
| `{police_dat}` (9) | celownik: „wydać milicji” / „policji” | „report to {police_dat}”: klucze `gen.police_dat.*` dają „the Militia” / „the police” |
| `{money}`, `{ransom}` | „2 tysiące złotych”, „5 milionów” | „2 thousand złoty” (gramatyka `amount`) |
| `{money_gen}`, `{ransom_gen}` (10, 17) | dopełniacz po „żądaniem” | to samo co `{money}` (`moneyGen` zwraca bez zmian) |
| `{kwota}`, `{kwota_parking}`, `{kwota_oc}`… | drobne kwoty z cennika | „15 złoty”; liczba mnoga „złoty” bez „s” |
| `{month}`, `{year}` | „luty 1994” | „February 1994” (miesiące w `B.months`) |
| `{victim}` (207) | imię i nazwisko poszkodowanego, mianownik | bez zmian; w EN łatwiej: dopuszczalny dopisek „’s” (np. „{victim}'s kiosk”) |
| scena `to` | „do pracowni” (kierunek do miejsca zbrodni) | „to the workshop” |
| scena `where` | „w pracowni” | „in the workshop” |
| scena `vg`, `vage`, `vt` | rodzaj, wiek, rodzaj poszkodowanego | nie tłumaczyć |

### Osoby

| Wstawka | PL | EN |
|---|---|---|
| `[X|Y]` rodzaj osoby | „[był|była]”, „[go|ją]”, „[jego|jej]” | `[he|she]`, `[him|her]`, `[his|her]`, `[was|was]`; czasowniki w 3. os. są takie same dla he/she, więc `[…|…]` rzadko potrzebny poza zaimkami i rzeczownikami zawodu („waiter|waitress”) |
| `role[g]` (`Aptekarz|Aptekarka`) | „[Aptekarz|Aptekarka]” | „Pharmacist” (jeden wariant); dla „[Policjant|Policjantka]”: „Police officer” |
| `{ref}` | imię i nazwisko świadka (mianownik) | bez zmian |
| `{ref_od}` | „niej”/„niego” (po „od”) | „her”/„him” (po „than”) |
| `{ref_jego}` | „jego”/„jej” | „his”/„her” |
| `{zeznal}`, `{ktory}`, `{widzial}`, `{stal}` | „zeznał/zeznała”, „który/która”… | „stated”, „who”, „saw”, „stood” (nie zależą od płci; klucze w `en.js` są takie same dla f i m) |
| `{szw}` | „szwagier/szwagierka” | „brother-in-law”/„sister-in-law” |
| `{cm}`, `{cmm}`, `{refm}` | „172”, „1,72” | „172”, „1.72” (kropka dziesiętna; `cmm`/`refm` formatuje silnik: do zmiany, patrz niżej) |

### Wstawki liczbowe i techniczne (bez odmiany)

`{t}` godzina, `{a}` `{b}` okno czasu, `{from}` `{to}` godziny w dokumentach alibi (uwaga: w osobnych szablonach `{from}`/`{to}` to
godziny, a w opisach przedmiotów `{from}` to miejsce; sprawdź kontekst), `{ini}` inicjały, `{flat}` numer mieszkania, `{n}` numer reguły,
`{stay}` minuty pobytu, `{x}` treść alibi, `{ev}` rodzaj zdarzenia, `{v}` wartość cechy, `{where}`, `{packs}` `{cig}` `{goods}` `{film}`
`{band}` `{dogname}` `{dogbreed}` szczegóły z `details`.

## Do zmiany w silniku przy tłumaczeniu treści

1. `refm`/`cmm`: `.replace(".", ",")` na sztywno w `classic.js` (kropka dziesiętna → klucz językowy, np. `grammar.decimal`).
2. `lc1` (zmniejszanie pierwszej litery): działa dla angielskiego, ale nie może zmniejszać nazw własnych na początku zdania.
3. Dodać opcjonalne pola `to` i `the` na miejscu, a `the` w przedmiocie (zamiast `acc`).
4. `{in}` zawsze zawiera przyimek (nie składaj „in {in}”). Szablony obecności z czasownikami miejsca („was {in}”) są bezpieczne.
5. Test `tools/test-lang.js` pilnuje, że struktura sprawy w `en` jest identyczna z `pl`; po wpięciu treści EN uruchom go bez
   `genOverride` (treści EN dają inne teksty, ta sama struktura wymaga tych samych list i kolejności wpisów w `en/base.js`).
