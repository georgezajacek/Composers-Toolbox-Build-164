(() => {
  const playbackMode = () => localStorage.getItem("composer-toolbox-chord-playback") || "block";

  /* The generated chord tiles carry data-literal-chord, which makes the core
     player force a block voicing. During an arpeggio click, temporarily remove
     that flag so the existing arpeggio-aware audition path is used instead. */
  window.addEventListener("click", event => {
    if (playbackMode() !== "arpeggio") return;
    const target = event.target instanceof Element ? event.target : null;
    const chord = target?.closest("[data-working-chord-degree][data-literal-chord]");
    if (!chord) return;

    chord.removeAttribute("data-literal-chord");
    queueMicrotask(() => chord.setAttribute("data-literal-chord", ""));
  }, { capture: true });
})();
