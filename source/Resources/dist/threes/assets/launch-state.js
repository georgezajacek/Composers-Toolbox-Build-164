(() => {
  const stateKey = "circle5-v1-state";

  /* Every fresh visit begins at the requested reference. Other saved work is
     left intact; only the Explore reference and modal selection are reset. */
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey) || "{}");
    localStorage.setItem(stateKey, JSON.stringify({
      ...saved,
      tonic: 0,
      mode: "Lydian",
      selectedModalRoot: null,
      sourceKey: "source",
      sourceRecipe: [],
      retrograde: false
    }));
  } catch {
    localStorage.removeItem(stateKey);
  }

  /* Browsers require a user gesture for true fullscreen. The curtain controls
     provide that gesture without adding another button to the interface. */
  window.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(".ct-intro-play, .ct-intro-skip")) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return;
    try {
      const result = request.call(root);
      if (result?.catch) result.catch(() => {});
    } catch {}
  }, { capture: true });
})();
