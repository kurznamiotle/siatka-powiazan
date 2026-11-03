# Siatka Powiązań — brief produktu (v2)

## 1. Koncepcja

**Gatunek:** logiczna gra śledcza / dedukcyjna, micro-investigation puzzle.
**Platforma:** mobile, pionowy ekran. Najpierw PWA, potem Google Play i App Store przez Capacitor.
**Format:** jedna sprawa dziennie (3–5 minut) + archiwum i sprawy specjalne w premium.
**Stylistyka:** pixel art w estetyce retro noir / polaroid, dotykowa tablica korkowa.

**Wyróżnik:** sznurki to twierdzenia, które gracz sam stawia na tablicy. Gra ocenia nie tylko werdykt, ale też jakość rozumowania: ile połączeń ma pokrycie w faktach i czy gracz domknął obwód sprawcy. To odróżnia grę od siatek dedukcyjnych typu Murdle, gdzie zaznacza się tylko krzyżyki.

## 2. Interfejs

**Nagłówek:** nazwa sprawy, czas, pozostałe próby oskarżenia (3).

**Tablica korkowa (większość ekranu):**
- 6–8 węzłów: podejrzani (polaroidy), miejsca, przedmioty.
- Każdy węzeł ma pinezkę. Przeciągnięcie od pinezki do pinezki tworzy sznurek. Alternatywa: stuknięcie jednej pinezki, potem drugiej.
- Stuknięcie sznurka go przecina.
- Nieprzeczytane akta oznaczone kropką.
- Węzeł można wykluczyć (szary, przekreślony).

**Szuflada biurka (dół ekranu):**
- Zakładka **Akta:** wstęp do sprawy albo fakty o zaznaczonym węźle (2–3 krótkie zdania), przycisk „Wyklucz”, lista powiązań. Panel przewija się.
- Zakładka **Notatnik:** 3–4 reguły ustalone przez techników i lekarza.
- Przyciski: **Podpowiedź** (3) i **Oskarż**.

**Oskarżenie:** dostępne zawsze. Gracz wybiera sprawcę i narzędzie. Błąd zabiera jedną z 3 prób, gra nie mówi, która część jest zła.

**Ekran wyniku:** pieczątka „Sprawa zamknięta / umorzona”, gwiazdki, rozumowanie krok po kroku (dlaczego każdy niewinny odpada), ocena tablicy, tekst do udostępnienia.

## 3. Pętla rozgrywki

1. Przeczytaj wstęp i reguły w notatniku.
2. Otwieraj akta węzłów (informacje podawane porcjami).
3. Łącz sznurkami fakty, które się wspierają. Wykluczaj podejrzanych, którzy łamią reguły.
4. Oskarż. Wygrana albo kolejna próba.
5. Udostępnij wynik, wróć jutro.

**Podpowiedzi** wskazują regułę albo osobę do sprawdzenia, nigdy odpowiedź.

**Punktacja:** 3 gwiazdki minus pomyłki, minus 1 za użycie podpowiedzi, minimum 1 przy wygranej.

## 4. Generator proceduralny

Generator pracuje na ustrukturyzowanych faktach (obecność w miejscu i czasie, klucze, alibi, cechy fizyczne, pochodzenie przedmiotów, motywy) i regułach zapisanych jako warunki logiczne.

**Prawda:** motyw → sprawca → miejsce dostępu → narzędzie → ofiara. Sprawca spełnia wszystkie reguły.

**Twarde wymagania dla każdej sprawy:**
- Każdy niewinny spełnia wszystkie reguły poza jedną i każdy odpada z innej reguły. Dzięki temu każdy podejrzany wygląda groźnie, a każda reguła ma znaczenie.
- Dokładnie jedno rozwiązanie (sprawca + narzędzie).
- Usunięcie dowolnej reguły psuje jednoznaczność.
- Jeden fałszywy trop: drugi przedmiot dostępny tylko dla kogoś, kto odpada.
- Fakty nie nazywają rozwiązania wprost.

Solver weryfikuje każdą sprawę. Sprawy, które nie przechodzą, są odrzucane.

**Tekst:** generowany z faktów (szablony + ręcznie pisane pule smaczków na motyw). Ewentualny LLM tylko offline do opisów, z ponowną weryfikacją. LLM nie układa logiki.

**Archetypy:** na start jeden (każdy niewinny odpada z jednego powodu). Później kolejne: kłamiący świadek, wspólnicy, czas z zegarka ofiary, zamiana przedmiotów.

**Trudność:** liczba węzłów, liczba reguł i liczba kroków wnioskowania. Łatwiejsze sprawy na początku tygodnia, trudniejsze pod koniec.

## 5. Format danych

Wzorzec: `cases/case_001.json`. Najważniejsze pola:
- `nodes`: węzły na tablicy,
- `facts`: ustrukturyzowane fakty, z których powstaje tekst,
- `rules`: reguły z warunkiem logicznym i tekstem,
- `eliminations`: która reguła eliminuje którego niewinnego,
- `solution`: sprawca i narzędzie,
- `supported_connections`: połączenia zgodne z faktami (do oceny tablicy),
- `culprit_chain`: obwód sprawcy,
- `hints`, `flavor`.

## 6. Produkcja i skalowalność

- Stała pula grafik (portrety, miejsca, przedmioty w pixel arcie), zestawiana w różne układy.
- Motywy (Praga 1994, PRL, noir, cyberpunk) jako paczki danych: paleta, sprite'y, słowniki tekstów i smaczków, bez zmian w silniku.
- 3–4 archetypy × kilkadziesiąt elementów na motyw = setki unikalnych spraw.

## 7. Codzienny loop i monetyzacja

- Sprawa dnia wybierana z seeda daty, ta sama dla wszystkich.
- Streak i statystyki (lokalnie, później opcjonalnie konto).
- Tekst wyniku do udostępnienia, bez spoilerów.
- Powiadomienie o nowej sprawie (pełne w wersji sklepowej).

**Darmowe:** sprawa dnia, streak, udostępnianie.
**Premium** (ok. 15 zł/mies. albo 99 zł/rok): archiwum spraw, trudne sprawy, niedzielna sprawa tygodnia z fabułą, statystyki.
**Bez reklam.**

## 8. Plan MVP

1. Tydzień 1–2: dane spraw w JSON, solver, generator pierwszego archetypu.
2. Tydzień 3: sprawa dnia, streak, PWA (manifest, offline).
3. Tydzień 4: zapas ok. 60 spraw, deploy na GitHub Pages, test na znajomych i grupach z kryminałami.

**Kryterium sukcesu:** gracze wracają codziennie przez 2–3 tygodnie. Wtedy Capacitor, sklepy i premium.
