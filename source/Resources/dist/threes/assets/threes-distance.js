/* The note-name Distance Model belongs beside Threes' other pop-out tools. */
(function () {
  'use strict';
  const core = window.CTDistance;
  let timers = [];
  function stop() { timers.splice(0).forEach(clearTimeout); w.stop(); }
  const adapter = {
    stop,
    legacy() {
      try {
        const saved = JSON.parse(localStorage.getItem('circle-infinity-distance-pool') || '[]');
        return Array.isArray(saved) ? saved.filter(item => Array.isArray(item.pcs) && item.pcs.length && item.pcs.every(Number.isInteger)).map(item => ({ label: item.label || 'Earlier Distance set', pcs: [...new Set(item.pcs.map(pitch => core.modulo(pitch, 12)))] })) : [];
      } catch { return []; }
    },
    add(result) {
      if (j.saved.length >= 48) throw Error('Your pool is full. Remove an idea before adding another.');
      const item = { id: `distance-${Date.now()}-${j.saved.length}`, kind: 'scale', label: result.label, pcs: [...result.pcs], midis: Wt(result.pcs, result.pcs[0]), fixed: false };
      const next = { ...j, saved: [...j.saved, item] };
      localStorage.setItem(Sn, JSON.stringify(next)); j.saved = next.saved; h.setMessage('Distance Model · added to composition pool');
    },
    use(result) {
      if (result.pcs.length < 3) throw Error('Working material needs at least three distinct notes. You can still hear or pool this result.');
      h.setWorking({ root: result.pcs[0], pcs: result.pcs, label: result.label, key: 'distance-model' }, 'Distance Model');
    },
    async play(result, callbacks) {
      stop(); w.enabled = true;
      const context = w.ensure(); await context.resume();
      if (!callbacks.active()) return;
      if (context.state !== 'running') throw Error('Audio is paused by the browser. Tap Play again to allow sound.');
      const pitches = result.pitches.map(pitch => 60 + pitch);
      if (pitches.some(pitch => pitch < 36 || pitch > 96)) throw Error('This trail is outside the player’s register. Turn Fold on or shorten the trail.');
      // The context has successfully resumed: use the same native Web Audio voice.
      w.mediaMode = false;
      pitches.forEach((pitch, index) => {
        const play = () => { if (callbacks.active()) { w.midiChordNow([pitch], 0.28, w.sequence); callbacks.note(index); } };
        if (index === 0) play(); else timers.push(setTimeout(play, index * 360));
      });
      timers.push(setTimeout(() => { if (callbacks.active()) callbacks.done(); }, pitches.length * 360));
    }
  };
  window.CTThreesDistance = core.mount('threes', adapter);
  if (location.hash === '#distance') window.CTThreesDistance.open(document.querySelector('[data-ct-distance-open]'));
})();
