/*
 * Siatka Powiązań — pixel art 12×12.
 * Portrety składane z warstw (twarz, fryzura, nakrycie głowy, ubranie, dodatki),
 * ikony miejsc i przedmiotów z kształtów + palet.
 * '.' = przezroczysty piksel; pozostałe znaki to klucze palety.
 */
(function (root) {
  const E = "............";
  const blank = () => Array.from({ length: 12 }, () => E);

  /* ---------------- PORTRETY ---------------- */
  const FACE = [E, E, E, "...ssssss...", "...sesses...", "...ssssss...", "...ssmmss...", "....ssss....", ".....ss.....", E, E, E];

  const CLOTHES = {
    plain:  { 9: "..cccccccc..", 10: ".cccccccccc.", 11: ".cccccccccc." },
    collar: { 9: "..cddccddc..", 10: ".cccdccdccc.", 11: ".cccccccccc." },
    apron:  { 9: "..cccccccc..", 10: ".ccddddddcc.", 11: ".ccddddddcc." },
    jacket: { 9: "..cccddccc..", 10: ".ccccddcccc.", 11: ".ccccddcccc." }
  };

  const HAIR = {
    m_short: { 1: "...hhhhhh...", 2: "..hhhhhhhh..", 3: "..h......h.." },
    m_bald:  { 3: "..h......h..", 4: "..h......h.." },
    m_side:  { 1: "....hhhhh...", 2: "..hhhhhhhhh.", 3: "..hh.....h.." },
    m_curly: { 0: "...h.hh.h...", 1: "..hhhhhhhh..", 2: ".hhhhhhhhhh.", 3: ".hh......hh." },
    f_bun:   { 0: ".....hh.....", 1: "....hhhh....", 2: "..hhhhhhhh..", 3: "..h......h..", 4: "..h......h.." },
    f_long:  { 1: "...hhhhhh...", 2: "..hhhhhhhh..", 3: "..h......h..", 4: "..h......h..", 5: "..h......h..", 6: "..h......h..", 7: "..hh....hh.." },
    f_perm:  { 0: "..hh.hh.hh..", 1: ".hhhhhhhhhh.", 2: ".hhhhhhhhhh.", 3: ".hh......hh.", 4: ".hh......hh.", 5: ".h........h." },
    f_short: { 1: "...hhhhhh...", 2: "..hhhhhhhh..", 3: "..hh....hh..", 4: "..h......h.." }
  };
  const HAIR_BY_G = { m: ["m_short", "m_bald", "m_side", "m_curly"], f: ["f_bun", "f_long", "f_perm", "f_short"] };

  const HEAD = {
    kaszkiet: { 1: "...kkkkkk...", 2: "..kkkkkkkkk." },
    chustka:  { 0: "...kkkkkk...", 1: "..kkkkkkkk..", 2: ".kkkkkkkkkk.", 3: ".kk......kk.", 4: ".kk......kk.", 5: "..k......k.." },
    beret:    { 1: "....kkkkk...", 2: "..kkkkkkkk.." },
    kolejarz: { 0: "...kkkkkk...", 1: "..kkkkkkkk..", 2: "..yyyyyyyyy." }
  };

  const ACC = {
    glasses:  { 4: "...geggeg..." },
    mustache: { 5: "....hhhh...." },
    cig:      { 6: "........wo.." }
  };

  const SKIN = ["#e7b891", "#d9a57c", "#c98f68", "#e9c3a3"];
  const HAIR_C = ["#1f1a16", "#4a2f1e", "#7a4b2a", "#8a8a8a", "#c9c2b0", "#a0522d"];
  const HEAD_C = ["#3b3f45", "#8c3b4a", "#3e4a6b", "#5d4a3a", "#4c6b3a"];

  function overlay(grid, layer) {
    for (const k in layer) {
      const y = +k, src = layer[k], row = grid[y].split("");
      for (let x = 0; x < 12; x++) if (src[x] && src[x] !== ".") row[x] = src[x];
      grid[y] = row.join("");
    }
  }

  /* desc: {g, skin, hair, hairC, head, headC, outfit:{shape,c,d}, glasses, smoker, mustache} */
  function portrait(desc) {
    const g = blank();
    overlay(g, CLOTHES[desc.outfit.shape] || CLOTHES.plain);
    overlay(g, Object.fromEntries(FACE.map((r, i) => [i, r]).filter(([, r]) => r !== E)));
    if (desc.head) overlay(g, HEAD[desc.head]); else overlay(g, HAIR[desc.hair]);
    if (desc.head && desc.head !== "chustka") overlay(g, { 3: (HAIR[desc.hair] && HAIR[desc.hair][3]) || E });
    if (desc.mustache) overlay(g, ACC.mustache);
    if (desc.glasses) overlay(g, ACC.glasses);
    if (desc.smoker) overlay(g, ACC.cig);
    const pal = {
      s: SKIN[desc.skin], e: "#1d1712", m: desc.g === "f" ? "#a5524c" : "#8d4a3a",
      h: HAIR_C[desc.hairC], k: HEAD_C[desc.headC], y: "#1f1f22",
      c: desc.outfit.c, d: desc.outfit.d, g: "#2a2a2a", w: "#eeeeee", o: "#e0662b"
    };
    return { rows: g, pal };
  }

  /* ---------------- IKONY MIEJSC ---------------- */
  const LOC = {
    garage:   { rows: [E, ".....rr.....", "...rrrrrr...", ".rrrrrrrrrr.", ".wwwwwwwwww.", ".wddddddddw.", ".wdggggggdw.", ".wddddddddw.", ".wdggggggdw.", ".wddddddddw.", ".wddddddddw.", "xxxxxxxxxxxx"],
                pal: { r: "#7b3a2c", w: "#9a8f80", d: "#5c5650", g: "#3c3833", x: "#2a2622" } },
    pharmacy: { rows: [E, ".bbbbbbbbbb.", ".bwwwwwwwwb.", ".bwwwggwwwb.", ".bwwggggwwb.", ".bwwwggwwwb.", ".bwwwwwwwwb.", ".bbbbbbbbbb.", ".bwwbddbwwb.", ".bwwbddbwwb.", ".bbbbddbbbb.", "xxxxxxxxxxxx"],
                pal: { b: "#cfc6b4", w: "#eee8dc", g: "#2f8a4c", d: "#5a4433", x: "#2a2622" } },
    cellar:   { rows: [E, ".bbbbbbbbbb.", ".bkkkkkkkkb.", ".bkkkkkkyyb.", ".bkkkkyyyyb.", ".bkkyyyyyyb.", ".byyyyyyyyb.", ".bkkkkkkkkb.", ".bkkkokkkkb.", ".bbbbbbbbbb.", E, "xxxxxxxxxxxx"],
                pal: { b: "#7a6a5a", k: "#2a2420", y: "#8a7a66", o: "#e8c34a", x: "#2a2622" } },
    workshop: { rows: [E, ".xxxxxxxxxx.", ".xyyyyyyyyx.", ".bbbbbbbbbb.", ".bwwwwbddbb.", ".bwwwwbddbb.", ".bwwwwbddbb.", ".bwwwwbddbb.", ".bbbbbbddbb.", ".bbbbbbddbb.", ".bbbbbbddbb.", "gggggggggggg"],
                pal: { x: "#6b4a2e", y: "#a5835a", b: "#8a7a66", w: "#c9d9e0", d: "#4a3423", g: "#2a2622" } },
    laundry:  { rows: [E, ".....rr.....", "...rrrrrr...", ".rrrrrrrrrr.", ".a........a.", ".aaaaaaaaaa.", ".a.ww..ww.a.", ".a.ww..ww.a.", ".a.ww..ww.a.", ".a........a.", ".a........a.", "xxxxxxxxxxxx"],
                pal: { r: "#6c7a8a", a: "#9a8f80", w: "#eeeeee", x: "#2a2622" } },
    shed:     { rows: [E, ".....rr.....", "....rrrr....", "...rrrrrr...", "..rrrrrrrr..", ".rrrrrrrrrr.", "..bbbbbbbb..", "..bwwbbddb..", "..bwwbbddb..", "..bbbbbddb..", "..bbbbbddb..", "gggggggggggg"],
                pal: { r: "#5a3a2a", b: "#9a7550", w: "#c9d9e0", d: "#4a3423", g: "#3f6b3a" } },
    kiosk:    { rows: [E, "...rrrrrr...", "..rrrrrrrr..", "..xxxxxxxx..", "..bwwwwwwb..", "..bwwwwwwb..", "..bwwwwwwb..", "..bbbbbbbb..", "..bbbbbbbb..", "..bbbbbbbb..", E, "gggggggggggg"],
                pal: { r: "#2f6b4a", x: "#c22a2a", b: "#3f8a5c", w: "#e8dcc0", g: "#2a2622" } },
    shop:     { rows: [E, ".xxxxxxxxxx.", ".xyyyyyyyyx.", ".bbbbbbbbbb.", ".bwwwwbddbb.", ".bwwwwbddbb.", ".bwwwwbddbb.", ".bwwwwbddbb.", ".bbbbbbddbb.", ".bbbbbbddbb.", ".bbbbbbddbb.", "gggggggggggg"],
                pal: { x: "#b0423a", y: "#eee8dc", b: "#cfc6b4", w: "#c9d9e0", d: "#5a4433", g: "#2a2622" } },
    barber:   { rows: [E, ".xxxxxxxxxx.", ".xyyyyyyyyx.", ".bbbbbbbbbb.", ".bwwwwbddbp.", ".bwwwwbddbq.", ".bwwwwbddbp.", ".bwwwwbddbq.", ".bbbbbbddbp.", ".bbbbbbddbb.", ".bbbbbbddbb.", "gggggggggggg"],
                pal: { x: "#d48aa8", y: "#f5e9ef", b: "#cfc6b4", w: "#c9d9e0", d: "#5a4433", p: "#c22a2a", q: "#eeeeee", g: "#2a2622" } },
    boiler:   { rows: ["........cc..", "........cc..", "..rrrrrrcc..", ".rrrrrrrrrr.", ".bbbbbbbbbb.", ".bbddddddbb.", ".bbdooooddb.", ".bbdoyyoddb.", ".bbddddddbb.", ".bbbbbbbbbb.", E, "xxxxxxxxxxxx"],
                pal: { c: "#5a5f6a", r: "#7b3a2c", b: "#8a5a44", d: "#2a2420", o: "#e0662b", y: "#f1d27a", x: "#2a2622" } },
    stall:    { rows: [E, "rrrrrrrrrrrr", "wwrrwwrrwwrr", E, ".bbbbbbbbbb.", ".bggggggggb.", ".bgyygrrggb.", ".bbbbbbbbbb.", ".bbbbbbbbbb.", ".bbbbbbbbbb.", ".b........b.", "xxxxxxxxxxxx"],
                pal: { r: "#b0423a", w: "#eee8dc", b: "#8a8f99", g: "#2a2622", y: "#c9a646", x: "#2a2622" } },
    pier:     { rows: [E, "....rrrr....", "...rrrrrr...", "..rrrrrrrr..", "..bbbbbbbb..", "..bggbbddb..", "..bbbbbddb..", "dddddddddddd", ".p..p..p..p.", "vv.vvvvv.vvv", "vvvvvvvvvvvv", "vvvvvvvvvvvv"],
                pal: { r: "#5a3a2a", b: "#8a7a66", g: "#c9d9e0", d: "#6b4a2e", p: "#4a3423", v: "#3e6b8a" } },
    factory:  { rows: ["........cc..", "........cc..", ".r.r.r..cc..", "rrrrrrrrcc..", "bbbbbbbbbbbb", "bwwbwwbwwbbb", "bwwbwwbwwbbb", "bbbbbbbbbbbb", "bwwbwwbwwddb", "bbbbbbbbbddb", "bbbbbbbbbddb", "xxxxxxxxxxxx"],
                pal: { c: "#5a3a2a", r: "#5a5f6a", b: "#9a4a32", w: "#e8c34a", d: "#2a2420", x: "#2a2622" } },
    dovecote: { rows: [E, ".....rr.....", "...rrrrrr...", ".rrrrrrrrrr.", "..bbbbbbbb..", "..bkbkbkbb..", "..bbbbbbbb..", "..bkbkbkbb..", "..bbbbbbbb..", ".....bb.....", ".....bb..ww.", "xxxxxxxxxxxx"],
                pal: { r: "#7b3a2c", b: "#c9b98f", k: "#2a2420", w: "#eeeeee", x: "#5a5f6a" } },
    stable:   { rows: [E, "....rrrr....", "..rrrrrrrr..", "rrrrrrrrrrrr", ".bbbbbbbbbb.", ".bddbbbbddb.", ".bddbyybddb.", ".bddbbbbddb.", ".bddbbbbddb.", ".bddbbbbddb.", ".bbbbbbbbbb.", "gggggggggggg"],
                pal: { r: "#5a3a2a", b: "#9a7550", d: "#4a3423", y: "#e8c34a", g: "#6b5a3a" } },
    mine:     { rows: ["....aaaa....", "...a.oo.a...", "...a.oo.a...", "....a..a....", "....aaaa....", "...a....a...", "..a......a..", ".bbbbbbbbbb.", ".bwwbbbbwwb.", ".bwwbddbwwb.", ".bbbbddbbbb.", "xxxxxxxxxxxx"],
                pal: { a: "#2b2b2e", o: "#8a8f99", b: "#7b3a2c", w: "#e8c34a", d: "#2a2420", x: "#1f1f22" } },
    depot:    { rows: [E, ".....a......", "....a.a.....", "..rrrrrrrr..", ".rwwrwwrwwr.", ".rwwrwwrwwr.", ".rrrrrrrrrr.", ".yyyyyyyyyy.", ".rrrrrrrrrr.", "..kk....kk..", "xxxxxxxxxxxx", E],
                pal: { a: "#2b2b2e", r: "#c22a2a", w: "#c9d9e0", y: "#e8c34a", k: "#2a2420", x: "#5a5f6a" } },
    office:   { rows: [E, ".bbbbbbbbbb.", ".bwwbwwbwwb.", ".bwwbwwbwwb.", ".bbbbbbbbbb.", ".bwwbwwbwwb.", ".bwwbwwbwwb.", ".bbbbbbbbbb.", ".bbbbddbbbb.", ".bbbbddbbbb.", ".bbbbddbbbb.", "xxxxxxxxxxxx"],
                pal: { b: "#9a9a90", w: "#c9d9e0", d: "#5a4433", x: "#2a2622" } },
    hall:     { rows: [E, ".rrrrrrrrrr.", ".ryyyyyyyyr.", ".rrrrrrrrrr.", ".bbbbbbbbbb.", ".bwwbbbbwwb.", ".bwwbddbwwb.", ".bbbbddbbbb.", ".bbbbddbbbb.", ".bbbbddbbbb.", ".bbbbbbbbbb.", "gggggggggggg"],
                pal: { r: "#3e4a6b", y: "#e8c34a", b: "#cfc6b4", w: "#c9d9e0", d: "#5a4433", g: "#2a2622" } }
  };

  /* ---------------- KSZTAŁTY PRZEDMIOTÓW ---------------- */
  const SHAPES = {
    bar:    ["..........al",".........ala","........ala.",".......ala..","......ala...",".....ala....","....ala.....","...ala......","..ala.......",".ala........","aaaa........","aa.........."],
    wrench: [".........a.a","........aaaa",".......aaa..","......ala...",".....ala....","....ala.....","...ala......","..ala.......",".aaa........","aaaa........","a.a.........",E],
    hammer: [E,"..hhhhhh....","..hhhhhhh...","..hhhhhh....",".....aa.....",".....aa.....",".....aa.....",".....aa.....",".....aa.....",".....aa.....",".....aa.....",E],
    axe:    [E,"...hhh......","..hhhhaa....","..hhhhaa....","...hhhaa....","......aa....","......aa....","......aa....","......aa....","......aa....","......aa....",E],
    shovel: [".....aa.....","....aaaa....",".....aa.....",".....aa.....",".....aa.....",".....aa.....","....hhhh....","...hhhhhh...","...hhhhhh...","...hhhhhh...","....hhhh....",".....hh....."],
    blade:  [E,"..........h.",".........hh.","........hh..",".......hh...","......hh....",".....hh.....","....aa......","...aa.......","..aa........",".aa.........",E],
    bottle: [".....aa.....",".....aa.....","....hhhh....","....bbbb....","...bbbbbb...","...bbbbbb...","...bwwwwb...","...bwwwwb...","...bbbbbb...","...bbbbbb...","...bbbbbb...",E],
    vial:   [E,E,".....aa.....","....bbbb....","....bbbb....","....bwwb....","....bwwb....","....bbbb....","....bbbb....","....bbbb....",E,E],
    can:    [E,"....aaa.....","...a...a....","..bbbbbbbb..","..bbbbbbbb..","..bwwwwwwb..","..bwwwwwwb..","..bbbbbbbb..","..bbbbbbbb..","..bbbbbbbb..","..bbbbbbbb..",E],
    box:    [E,E,E,"..bbbbbbbb..","..bwwwwwwb..","..bwhhhhwb..","..bwwwwwwb..","..bbbbbbbb..","..bbbbbbbb..",E,E,E],
    rope:   [E,"....aaaa....","..aa....aa..",".a..aaaa..a.",".a.a....a.a.",".a.a.aa.a.a.",".a.a.aa.a.a.",".a.a....a.a.",".a..aaaa..a.","..aa....aa..","....aaaa.a..","..........a."],
    mortar: ["........pp..",".......pp...","......pp....",".....pp.....","..yyyyyyyy..",".yyyyyyyyyy.",".yooyyyyyyy.","..yyyyyyyy..","...yyyyyy...","....yyyy....","...yyyyyy...","..yyyyyyyy.."],
    iron:   [E,E,E,"....aaaa....","...a....a...","...hhhhhhh..","..hhhhhhhhh.",".hhhhhhhhhh.",".hhhhhhhhhh.",E,E,E],
    weight: [E,E,".....aa.....","....a..a....","...hhhhhh...","..hhhhhhhh..","..hhhhhhhh..",".hhhhhhhhhh.",".hhhhhhhhhh.",".hhhhhhhhhh.",E,E],
    horseshoe: [E,"..aa....aa..","..aa....aa..","..aa....aa..","..aa....aa..","..aaa..aaa..","...aaaaaa...","....aaaa....",E,E,E,E],
    lamp:   [".....aa.....","....a..a....","....hhhh....","...hbbbbh...","...hbwwbh...","...hbwwbh...","...hbbbbh...","...hhhhhh...","...hhhhhh...","....hhhh....",E,E],
    reel:   [E,"...aaaaaa...","..aabaabaa..",".aaaaaaaaaa.",".abaahhaaba.",".aaahwwhaaa.",".aaahwwhaaa.",".abaahhaaba.",".aaaaaaaaaa.","..aabaabaa..","...aaaaaa...",E],
    /* wydanie 2.1.1: szantaż, fałszerstwo, sabotaż, wandalizm, porwanie psa */
    typewriter: [E,"...wwwwww...","...wkkkkw...","..aaaaaaaa..",".aaaaaaaaaa.",".ahhhhhhhha.",".ahahahahaa.",".aahahahaha.",".ahhhhhhhha.",".aaaaaaaaaa.",E,E],
    scissors: [E,".aa......aa.","a..a....a..a","a..a....a..a",".aa.h..h.aa.",".....hh.....",".....hh.....","....h..h....","...h....h...","..h......h..",".h........h.",E],
    stamp:  [E,"....aaaa....","...aaaaaa...","...aaaaaa...","....aaaa....",".....aa.....",".....aa.....","..hhhhhhhh..","..hhhhhhhh..","..bbbbbbbb..",E,E],
    brush:  [E,".........aa.","........aa..",".......aa...","......aa....",".....hh.....","....hhh.....","...bbbh.....","..bbbb......","..bbb.......","..b.........",E],
    pliers: [E,"...h....h...","...hh..hh...","....hhhh....",".....hh.....","....a..a....","...a....a...","...a....a...","..a......a..","..a......a..",".aa......aa.",E],
    saw:    [E,E,E,"a...........","aaaaaaaaaaaa","a.hhhhhhhhha","a.hhhhhhhhh.","aah.h.h.h.h.","a...........",E,E,E],
    cage:   [E,".....aa.....",".aaaaaaaaaa.",".a.a.aa.a.a.",".a.a.aa.a.a.",".a.a.aa.a.a.",".a.a.aa.a.a.",".a.a.aa.a.a.",".a.a.aa.a.a.",".aaaaaaaaaa.",".hhhhhhhhhh.",E],
    sack:   [E,".....aa.....","....a..a....",".....aa.....","....bbbb....","...bbbbbb...","..bbbbbbbb..","..bwbbbwbb..","..bbbbbbbb..","..bbbbbbbb..","...bbbbbb...",E],
    basket: [E,E,"...aaaaaa...","..a......a..",".bbbbbbbbbb.",".bhbhbhbhbb.",".bbbbbbbbbb.",".bhbhbhbhbb.",".bbbbbbbbbb.","..bbbbbbbb..",E,E],
    sheet:  [E,"..wwwwwww...","..wkkkkkww..","..wwwwwwwww.","..wkkkkkkkw.","..wwwwwwwww.","..wkkkkkkkw.","..wwwwwwwww.","..wkkkkwwww.","..wwwwwwwww.",E,E],
    razor:  [E,E,E,"..aaaaaaaa..","..ahhhhhha..","..ah.hh.ha..","..ahhhhhha..","..aaaaaaaa..",E,E,E,E],
    bucket: [E,"...aaaaaa...","..a......a..",".bbbbbbbbbb.",".bwwwwwwwwb.","..bbbbbbbb..","..bbbbbbbb..","..bbbbbbbb..","...bbbbbb...","...bbbbbb...",E,E]
  };

  /* ---------------- IKONY DOWODÓW RZECZOWYCH ---------------- */
  const PAPER = { w: "#e8dcc0", k: "#7a7468", r: "#b0423a" };
  const EV = {
    notebook: { rows: [E, "..bbbbbbbb..", "..bwwwwwwb..", "..bwkkkkwb..", "..bwwwwwwb..", "..bwkkkkwb..", "..bwwwwwwb..", "..bwkkkwwb..", "..bwwwwwwb..", "..bbbbbbbb..", E, E],
                pal: { b: "#3e4a6b", w: PAPER.w, k: PAPER.k } },
    keybook:  { rows: [E, ".bbbbbbbbb..", ".bwwwwwwwb..", ".bwwyywwwb..", ".bwyyyywwb..", ".bwwyywwwb..", ".bwwwyywwb..", ".bwwwyyywb..", ".bwwwyywwb..", ".bbbbbbbbb..", E, E],
                pal: { b: "#6b4a2e", w: PAPER.w, y: "#c9a646" } },
    card:     { rows: [E, "..wwwwwww...", "..wkkkkkw...", "..wwwwwww...", "..wkkkkww...", "..wwwwwww...", "..wkkkkkw...", "..wwwwwww...", "..wkkwwww...", "..wwwwwrw...", "..wwwwwww...", E],
                pal: PAPER },
    letter:   { rows: [E, E, ".wwwwwwwwww.", ".wkwwwwwwkw.", ".wwkwwwwkww.", ".wwwkwwkwww.", ".wwwwkkwwww.", ".wwwwwwwwww.", ".wwwwwwwwrw.", ".wwwwwwwwww.", E, E],
                pal: PAPER },
    ticket:   { rows: [E, E, E, ".pppppppppp.", ".pwwpwwwwwp.", ".ppppkkkkpp.", ".pwwpwwwwwp.", ".pppppppppp.", E, E, E, E],
                pal: { p: "#c9a646", w: PAPER.w, k: "#5a4433" } },
    receipt:  { rows: ["...wwwwww...", "...wkkkkw...", "...wwwwww...", "...wkkkww...", "...wwwwww...", "...wkkkkw...", "...wwwwww...", "...wkkwww...", "...wwwwww...", "...wwwwrw...", "...w.ww.w...", E],
                pal: PAPER },
    photo:    { rows: [E, ".wwwwwwwwww.", ".wbbbbbbbbw.", ".wbbbbbsbbw.", ".wbbbbsssbw.", ".wbbbbbsbbw.", ".wbbgggggbw.", ".wbgggggggw.", ".wwwwwwwwww.", ".wwwwwwwwww.", E, E],
                pal: { w: "#eeeeee", b: "#5b7a99", s: "#e8c34a", g: "#4c6b3a" } }
  };

  /* descriptor → {rows, pal} */
  function resolve(sp) {
    if (sp.kind === "portrait") return portrait(sp);
    if (sp.kind === "ev") return EV[sp.icon] || EV.card;
    if (sp.kind === "loc") return LOC[sp.icon] || LOC.shop;
    if (sp.kind === "item") return { rows: SHAPES[sp.shape] || SHAPES.box, pal: sp.pal };
    return { rows: blank(), pal: {} };
  }

  function svg(sp) {
    const { rows, pal } = resolve(sp);
    let out = "";
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (pal[ch]) out += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${pal[ch]}"/>`;
    }));
    return `<svg viewBox="-1 -1 14 14" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
  }

  /* Portret nie może zdradzać cech z reguł notatnika. Palącemu rysuje się papierosa tylko w ok. 30% przypadków
     (deterministycznie z id sprawy i osoby) i wcale, gdy palenie jest regułą. Okulary znikają z portretów,
     gdy reguła dotyczy okularów. Idempotentne: prawdziwe cechy zostają w sprite.real. Dotyczy każdej sprawy,
     też zamrożonych wersji i zapisów (wywoływane przy wczytaniu sprawy, nie w generatorze). */
  const h01 = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };
  function tidyPortraits(c) {
    const rt = new Set(((c && c.rules) || []).filter(r => r.type === "trait").map(r => r.trait));
    for (const n of (c && c.nodes) || []) {
      const d = n.type === "person" && n.sprite;
      if (!d || d.kind !== "portrait") continue;
      if (!d.real) d.real = { smoker: !!d.smoker, glasses: !!d.glasses };
      d.smoker = d.real.smoker && !rt.has("smoker") && h01(String(c.case_id) + n.id) < 0.3;
      d.glasses = d.real.glasses && !rt.has("glasses");
    }
    return c;
  }

  const api = { svg, resolve, tidyPortraits, HAIR_BY_G, SKIN, HAIR_C, HEAD_C };
  root.SiatkaSprites = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
