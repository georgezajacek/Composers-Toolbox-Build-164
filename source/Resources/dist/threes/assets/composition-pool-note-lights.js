(() => {
  const nativePlayMaterial = typeof ve === 'function' ? ve : null;
  if (!nativePlayMaterial) return;

  let lightTimers = [];

  function clearLights() {
    lightTimers.forEach((timer) => window.clearTimeout(timer));
    lightTimers = [];
    document.querySelectorAll('.pool-note-sounding')
      .forEach((button) => button.classList.remove('pool-note-sounding'));
  }

  function noteButtons(pc) {
    const pitch = k(pc);
    return document.querySelectorAll(
      `[data-compose-motif-add="${pitch}"], ` +
      `[data-compose-scale-note="${pitch}"], ` +
      `[data-advanced-chromatic="${pitch}"]`
    );
  }

  function setLight(pc, on) {
    noteButtons(pc).forEach((button) => button.classList.toggle('pool-note-sounding', on));
  }

  function refreshScaleMembership(material) {
    if (material?.kind !== 'scale') return;
    const members = new Set(material.pcs.map(k));
    document.querySelectorAll('[data-compose-motif-add]')
      .forEach((button) => button.classList.toggle(
        'scale-member',
        members.has(k(button.dataset.composeMotifAdd))
      ));
    document.querySelectorAll('[data-compose-scale-note]')
      .forEach((button) => button.classList.toggle(
        'active',
        members.has(k(button.dataset.composeScaleNote))
      ));
  }

  function lightMaterial(material) {
    if (!material || !Array.isArray(material.pcs)) return;
    clearLights();
    refreshScaleMembership(material);

    const pitches = [...new Set(material.pcs.map(k))];
    if (material.kind === 'chord') {
      pitches.forEach((pc) => setLight(pc, true));
      lightTimers.push(window.setTimeout(clearLights, 900));
      return;
    }

    const step = 23920 / Math.max(30, Number(he) || 104);
    pitches.forEach((pc, index) => {
      lightTimers.push(window.setTimeout(() => setLight(pc, true), index * step));
      lightTimers.push(window.setTimeout(() => setLight(pc, false), index * step + Math.max(120, step * .78)));
    });
  }

  ve = (material) => {
    lightMaterial(material);
    return nativePlayMaterial(material);
  };

  function removeRetiredWheel() {
    document.querySelectorAll('.suite-stage-3 .compose-play-row > .compose-stage')
      .forEach((wheel) => wheel.remove());
  }

  new MutationObserver(removeRetiredWheel).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', removeRetiredWheel);
  window.addEventListener('pagehide', clearLights);
  removeRetiredWheel();
})();
