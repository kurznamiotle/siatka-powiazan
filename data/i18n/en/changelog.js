/*
 * Siatka – a Polish Crime Board — changelog ("What's new" in Settings), English.
 * Newest first. Same structure and order as data/i18n/pl/changelog.js. `v` = generator version.
 * New release = new entry on top, in BOTH files.
 */
(function (root) {
  const I18N = root.SiatkaI18n || (typeof module !== "undefined" && module.exports ? require("../i18n.js") : null);
  if (I18N) I18N.register("en", { messages: { "ui.changelog": [
    { v: "2.2.1", date: "2026-11-18", items: [
      "Motives fit the victim: a feud with the estate office only when something breaks in the building, a rival only when it's someone's business, barking only when there's a dog.",
      "Witnesses fit the place: children playing bottle caps in the courtyard, not in the spinning mill; at the works, it's the crew who give statements.",
      "The time of the crime depends on the scene: the market, shops, pharmacy and post office are hit while they're open or just after closing.",
      "Clearer relations in the explanation: “Piotr Kowal and Alicja Baran: in-laws, not neighbours from the staircase”.",
      "The commissioner's remarks follow the seasons, and the nineties details are more accurate (TV series, phones, pagers, cars, newspapers)."
    ] },
    { v: "2.2", date: "2026-11-15", items: [
      "New kinds of clues in the notebook: height comparisons, suspects' ties to other people, the caretaker's notebook, and traces that tell you what wasn't there.",
      "New case type: the timeline. Nobody can be in two places at once. Use the walking-time table and the times in the files to work out who could have reached the scene.",
      "Nineties prices are closer to the truth: parking for a few złoty, car insurance for a few hundred."
    ] },
    { v: "2.1.2", date: "2026-11-11", items: [
      "Bug fixed: a suspect is no longer in two places at the same time, or somewhere else during their own alibi.",
      "Rules about missing items are clearer: “The culprit personally took… at exactly the time it went missing. Nobody handed it over.”",
      "Portraits no longer give away notebook traits: only some smokers have a cigarette, and glasses vanish from photos when a rule is about them.",
      "Shorter tutorial: 4 steps, an easier-to-find “Skip”, and “How to play” is always in Settings.",
      "Tutorial fixed."
    ] },
    { v: "2.1.1", date: "2026-11-06", items: [
      "11 kinds of crime instead of 4: theft, animal poisoning, arson, blackmail, forgery, sabotage, robbery, vandalism, dognapping and poisoning.",
      "220 scenes, new roles, places and items with icons, and more varied sentences in the files.",
      "More accurate nineties details: ration coupons, prices, names and dates."
    ] },
    { v: "2.1", date: "2026-11-05", items: [
      "Physical evidence: polaroids of items and documents that you link to suspects by initials or flat number.",
      "Names fit the characters' ages, and the game avoids repeating names and scenes from recent cases."
    ] }
  ] } });
})(typeof window !== "undefined" ? window : globalThis);
