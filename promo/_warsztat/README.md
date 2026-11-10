# Warsztat promo

Źródła i skrypty do filmów promocyjnych Siatki Powiązań. Gotowe pliki do publikacji leżą obok, w `promo/<data>-<nazwa>/`. Ustalenia (styl, workflow, opisy) są w dokumencie projektu `claude/promocja-materialy.md`.

Wymagania: Python 3 z Pillow i numpy, ffmpeg. Wyniki (`*.mp4`, `*.wav`, `chk/`) są w `.gitignore`.

## Struktura

- `fonts/`: Pixelify Sans, Special Elite, Courier Prime Bold (licencja OFL).
- `muzyka/`: `mus1.mp3` (reklama), `mus2.mp3` (zagadki). Muzyka z ElevenLabs, plan Starter z licencją komercyjną.
- `zagadka-1/`: zagadka „Czyje alibi się sypie?” (Wrocław 1993).
  - `zag.py`: pierwsza wersja, jasna. Daje też okładkę (`okladka.jpg`) i relację z rozwiązaniem (`relacja_rozwiazanie.png`).
  - **`zag2.py`: wersja wzorcowa w mrocznym stylu** (latarka, ziarno, dym, wywoływane polaroidy, zaczernienia odsłaniane z lektorem, tablica z podsumowaniem w czasie odliczania). Korzysta z funkcji z `zag.py`.
  - `case.json`: sprawa z generatora. Portrety: `*.svg` z `SiatkaSprites`, a `*.png` to ich render 560×560.
  - `vo.mp3`: lektor (ElevenLabs, głos Patryk `6NJSmKqvyC5gS4qslstw`, model eleven_v4). `clips.json`: granice zdań w sekundach (z transkrypcji scribe).
- `reklama/`: reklama 30 s i 15 s (hook z pagerem). Pliki: `lib.py`, `ad.py`, lektor `vo1/vo2/end1.mp3`.
- `reels-krawcowa/`: pierwszy Reels z nagrania gry. `edit.py` bierze ścieżkę do fontów jako argument, a `cover.py` robi okładkę.

## Zagadka #2 w tym samym stylu

1. Skopiuj `zagadka-1/` do `zagadka-2/`.
2. Wylosuj sprawę S z generatora, na której da się zbudować pytanie z jedną odpowiedzią:
   ```js
   require("./engine/sprites.js"); const S = require("./engine/engine.js")
   const W = {base: require("./data/base.js"), cities: require("./data/cities.js")}
   const c = S.generateCase(W, seed, {size: "S"}); S.solve(c)
   ```
   Sprawdź solverem, że rozwiązanie jest jedno. **Nie bierz sprawy dnia**, żeby nie spoilerować graczom.
3. Wyrenderuj portrety ze `SiatkaSprites.svg(node.sprite)`, np. Playwrightem, do PNG 560×560.
4. Napisz tekst lektora, wygeneruj go w ElevenLabs i przetranskrybuj (scribe, bez kosztów), żeby dostać czasy słów. Uzupełnij `clips.json` i czasy w `T` oraz `rel(...)` w `zag2.py`.
5. Podmień teksty w `s_card(...)`, `SUM` (tablica z podsumowaniem) i `s_place` (miasto i rok).
6. Uruchom `python3 zag2.py`.
7. Przekoduj wynik do ok. 7 Mb/s, bo ziarno przy crf 20 daje ponad 200 MB, a GitHub przyjmuje do 100 MB:
   ```
   ffmpeg -i zagadka1_v2.mp4 -c:v libx264 -preset veryfast -b:v 7M -maxrate 9M -bufsize 14M -pix_fmt yuv420p -c:a copy -movflags +faststart reels.mp4
   ```
8. Gotowy plik wrzuć do `promo/<data>-zagadka-2/`.

Dźwięk zawsze kończ `apad=whole_dur` i `amix` z `duration=longest`, inaczej lektor urywa się przed końcem. Docelowa głośność to −15 LUFS.
