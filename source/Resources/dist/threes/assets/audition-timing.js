(() => {
  const normalizePitch = value => ((Number(value) % 12) + 12) % 12;
  let chordMode = localStorage.getItem('composer-toolbox-chord-playback') === 'arpeggio'
    ? 'arpeggio'
    : 'block';
  const arpeggioSelected = () => localStorage.getItem('composer-toolbox-chord-playback') === 'arpeggio';

  window.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const playback = target?.closest('[data-transform-chord-playback]');
    if (!playback) return;
    chordMode = playback.dataset.transformChordPlayback === 'arpeggio' ? 'arpeggio' : 'block';
    localStorage.setItem('composer-toolbox-chord-playback', chordMode);
  }, true);

  // Keep chord tones clearly separated on every page without changing block
  // playback or composition timing.
  if (typeof w === 'object') {
    const nativeMidiChord = w.playMidiChord.bind(w);
    const playArpeggio = (player, midis) => {
      if (!player.enabled || !midis.length) return;
      player.afterUnlock(sequence => {
        midis.forEach((midi, index) => {
          const play = () => player.pianoMidiNow(
            midi,
            index === midis.length - 1 ? 1.2 : 0.85,
            sequence
          );
          if (index === 0) play();
          else player.later(sequence, play, index * 300);
        });
      });
    };

    w.playChordAudition = function (pitches, tonic = null) {
      if (!this.enabled || !Array.isArray(pitches) || !pitches.length) return;
      const midis = ctThreesChordMidis(pitches, Number.isFinite(tonic) ? tonic : (Te === 1 ? h.get().reference.root : null));
      if (arpeggioSelected()) playArpeggio(this, midis);
      else this.afterUnlock(sequence => this.midiChordNow(midis, 1.12, sequence));
    };

    // Literal Generator chords enter through the MIDI-chord route. Make that
    // route obey the same mode so it cannot silently fall back to a block.
    w.playMidiChord = function (midis, duration = 0.5, preserveRegister = false) {
      if (preserveRegister) {
        if (!this.enabled || !Array.isArray(midis) || !midis.length) return;
        if (arpeggioSelected()) playArpeggio(this, midis);
        else this.afterUnlock(sequence => this.midiChordNow(midis, duration, sequence));
        return;
      }
      if (!arpeggioSelected()) {
        nativeMidiChord(midis, duration);
        return;
      }
      if (!this.enabled || !Array.isArray(midis) || !midis.length) return;
      playArpeggio(this, this.comfortableMidis(midis));
    };

    // Slow only scale auditions so each sounding pitch can be followed on the
    // circle. The final note rings a little longer.
    w.playScale = function (pitches, direction = 1, bpm = 104, referenceTonic = null) {
      if (!this.enabled || !Array.isArray(pitches) || !pitches.length) return;
      const unique = [...new Set(pitches.map(normalizePitch))];
      const ordered = direction < 0 && unique.length > 1
        ? [unique[0], ...unique.slice(1).reverse()]
        : unique;
      if (!ordered.length) return;

      let previousPitch = ordered[0];
      let currentMidi = Number.isFinite(referenceTonic)
        ? this.middleMidi(referenceTonic, 60) + normalizePitch(previousPitch - referenceTonic)
        : this.middleMidi(previousPitch, 60);
      const contour = [currentMidi];
      ordered.slice(1).forEach(pitch => {
        const interval = direction < 0
          ? normalizePitch(previousPitch - pitch)
          : normalizePitch(pitch - previousPitch);
        currentMidi += (direction < 0 ? -1 : 1) * (interval || 12);
        contour.push(currentMidi);
        previousPitch = pitch;
      });

      const midis = Number.isFinite(referenceTonic) ? contour : this.comfortableContour(contour, 52, 76, 64);
      const tempoScale = 104 / Math.max(30, Math.min(300, bpm));
      const spacing = 330 * tempoScale;
      const sustain = Math.max(0.32, 0.48 * tempoScale);
      this.afterUnlock(sequence => {
        this.midiChordNow([midis[0]], sustain, sequence);
        midis.slice(1).forEach((midi, index) => {
          const duration = index === midis.length - 2 ? sustain * 1.25 : sustain;
          this.later(
            sequence,
            () => this.midiChordNow([midi], duration, sequence),
            (index + 1) * spacing
          );
        });
      });
    };
  }

  // Circle lights are driven by the same callbacks that start sounding notes.
  // Disable the older independent visual clocks (150ms vs 300ms arpeggios).
  if (typeof ja === 'function') ja = () => {};
  if (typeof vs === 'function') vs = () => {};
  if (typeof w === 'object') {
    let calculatorSequence = null;
    const lit = new Map();
    const timers = new Set();
    const clear = () => {
      timers.forEach(clearTimeout);
      timers.clear();
      lit.clear();
      document.querySelectorAll('.ct-sounding').forEach(el => el.classList.remove('ct-sounding'));
      if (typeof $n === 'function') $n();
      if (typeof qo === 'function') qo();
    };
    const light = (midis, duration) => {
      const elements = new Set();
      midis.forEach(midi => {
        const pc = normalizePitch(midi);
        document.querySelectorAll(`.circle-note.in[data-root="${pc}"],.circle-third.in[data-inner-pc="${pc}"],.work-pitch[data-working-toggle="${pc}"]`)
          .forEach(el => elements.add(el));
      });
      elements.forEach(el => {
        lit.set(el, (lit.get(el) || 0) + 1);
        el.classList.add('ct-sounding');
      });
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        elements.forEach(el => {
          const remaining = (lit.get(el) || 1) - 1;
          if (remaining > 0) lit.set(el, remaining);
          else { lit.delete(el); el.classList.remove('ct-sounding'); }
        });
      }, duration * 1000);
      timers.add(timer);
    };
    for (const method of ['midiChordNow', 'pianoMidiNow', 'playNote']) {
      const native = w[method].bind(w);
      w[method] = function (...args) {
        if (!this.enabled) return;
        const sequence = (method === 'playNote' ? args[3] : args[2]) ?? this.sequence;
        const midis = method === 'midiChordNow' ? args[0] : [args[0]];
        const duration = args[1] ?? (method === 'midiChordNow' ? .5 : method === 'playNote' ? .28 : .9);
        const start = () => {
          if (!this.enabled || sequence !== this.sequence) return;
          native(...args);
          if (sequence !== calculatorSequence) light(midis, duration);
        };
        if (this.mediaMode) start();
        else this.ready(start, sequence);
      };
    }
    // Interval calculator auditions stay on its keyboard, not the circle.
    for (const method of ['playInterval', 'playIntervalKey']) {
      const native = w[method].bind(w);
      w[method] = function (...args) {
        const result = native(...args);
        calculatorSequence = this.sequence;
        return result;
      };
    }
    const stop = w.stop.bind(w);
    w.stop = function () { clear(); return stop(); };
  }
})();
