/* Distance-model math and an accessible drawer shared by Threes and Infinity. */
(function (host) {
  'use strict';
  const names = ['C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B'];
  const modulo = (value, period) => ((value % period) + period) % period;
  const clone = value => JSON.parse(JSON.stringify(value));
  function ratioValue(value) {
    const parts = String(value).trim().split('/');
    if (parts.length > 2 || parts.some(part => !part.trim())) throw Error('Use a positive ratio, such as 3/2 or 1.5.');
    const ratio = Number(parts[0]) / (parts.length === 2 ? Number(parts[1]) : 1);
    if (!Number.isFinite(ratio) || ratio <= 0) throw Error('Ratios must be finite and greater than zero.');
    return ratio;
  }
  function ratioLabel(value) {
    for (let denominator = 1; denominator <= 4096; denominator++) {
      const numerator = Math.round(value * denominator);
      if (numerator > 0 && Math.abs(numerator / denominator - value) < 1e-10) return `${numerator}/${denominator}`;
    }
    return `≈ ${value.toFixed(6)}`;
  }
  function sequence({ root, a, b, count, period, fold = true, phase = 'ab' }) {
    if (![root, a, b, count, period].every(Number.isFinite) || period <= 0 || count < 1 || count > 24 || !Number.isInteger(count)) throw Error('Choose 1–24 notes and finite distances.');
    const steps = phase === 'ba' ? [b, a] : [a, b];
    const result = [], states = new Set();
    let pitch = root;
    for (let index = 0; index < count; index++) {
      if (!Number.isFinite(pitch)) throw Error('These distances exceed the supported numeric range. Use smaller distances or fold the result.');
      const folded = modulo(pitch, period);
      const normalized = Math.abs(folded - period) < 1e-7 || Math.abs(folded) < 1e-7 ? 0 : folded;
      const key = `${normalized.toFixed(7)}:${index % 2}`;
      if (fold && states.has(key)) break;
      states.add(key); result.push(fold ? normalized : pitch); pitch += steps[index % 2];
    }
    return result;
  }
  function vector(pitches) {
    const pcs = [...new Set(pitches.map(pitch => modulo(Math.round(pitch), 12)))];
    const counts = [0, 0, 0, 0, 0, 0];
    pcs.forEach((pitch, index) => pcs.slice(index + 1).forEach(other => {
      const distance = modulo(other - pitch, 12); counts[Math.min(distance, 12 - distance) - 1]++;
    }));
    return counts;
  }
  function tuningResult(source, settings) {
    const start = source.tones[Number(settings.root)];
    if (!start) throw Error('Select a starting pitch from the current tuning.');
    const interval = value => settings.unit === 'ratios' ? 1200 * Math.log2(ratioValue(value)) : Number(String(value).trim() || NaN);
    const a = interval(settings.a), b = interval(settings.b);
    const pitches = sequence({ ...settings, root: start.cents, a, b, period: source.equave });
    const label = `Distance ${settings.a} / ${settings.b} ${settings.unit} · ${source.name}`;
    const tones = pitches.map(cents => {
      const ratio = 2 ** (cents / 1200);
      if (!Number.isFinite(ratio) || ratio <= 0 || !Number.isFinite(source.baseHz * ratio) || source.baseHz * ratio <= 0) throw Error('These distances exceed the supported pitch range. Use smaller distances or fold the result.');
      return { cents, ratio, fraction: ratioLabel(ratio), raw: `${cents.toFixed(4)} cents` };
    });
    return { kind: 'infinity', label, baseHz: source.baseHz, equave: source.equave, tones, settings: clone(settings) };
  }
  function chromaticResult(settings) {
    if (![settings.a, settings.b, settings.root].every(value => String(value).trim() && Number.isInteger(Number(value)))) throw Error('Threes distances are whole semitones.');
    const pitches = sequence({ ...settings, root: Number(settings.root), a: Number(settings.a), b: Number(settings.b), period: 12 });
    return { kind: 'threes', label: `${names[modulo(Number(settings.root), 12)]} · Distance ${settings.a} / ${settings.b} · ${settings.phase.toUpperCase()}`, pitches, pcs: [...new Set(pitches.map(pitch => modulo(pitch, 12)))], vector: vector(pitches), settings: clone(settings) };
  }
  function defaults(source) {
    const first = source.tones[0]?.cents || 0;
    const a = (source.tones[1]?.cents ?? source.equave) - first;
    const b = (source.tones[2]?.cents ?? source.equave + first) - (source.tones[1]?.cents ?? first);
    return { root: 0, a: String(a), b: String(b || a), unit: 'cents', phase: 'ab', count: 8, fold: true };
  }
  const core = { names, modulo, clone, ratioValue, ratioLabel, sequence, vector, tuningResult, chromaticResult, defaults };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (!host.document) return;
  const document = host.document;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function mount(kind, adapter) {
    const infinity = kind === 'infinity';
    let overlay, source, settings, result, expanded = false, opener, generation = 0, statusText = '';
    function status(message) { statusText = message; const node = overlay?.querySelector('[data-distance-status]'); if (node) node.textContent = message; }
    function stop() { generation++; adapter.stop(); overlay?.querySelectorAll('.sounding').forEach(node => node.classList.remove('sounding')); }
    function close() { stop(); overlay?.remove(); overlay = null; document.body.classList.remove('ct-distance-open'); opener?.focus(); }
    function build() { return infinity ? tuningResult(source, settings) : chromaticResult(settings); }
    function describe(item) { return infinity ? item.tones.map(tone => `${tone.fraction} · ${tone.cents.toFixed(2)}¢`) : item.pitches.map(pitch => `${names[modulo(pitch, 12)]}${settings.fold ? '' : ' ' + (4 + Math.floor(pitch / 12))}`); }
    async function play() {
      update();
      if (!result) return;
      stop(); const token = generation;
      try {
        result = build(); status('Starting sound…');
        await adapter.play(clone(result), {
          active: () => token === generation,
          note(index) { if (token !== generation) return; overlay?.querySelectorAll('[data-distance-pitch]').forEach(node => node.classList.toggle('sounding', Number(node.dataset.distancePitch) === index)); status(`Playing note ${index + 1} of ${infinity ? result.tones.length : result.pitches.length}`); },
          done() { if (token === generation) { stop(); status('Finished. Keep this result in your pool, or try another distance.'); } },
          error(message) { if (token === generation) { stop(); status(message); } }
        });
      } catch (error) { if (token === generation) { stop(); status(error.message || 'Sound could not start. Tap Play to retry.'); } }
    }
    function update() {
      stop();
      const form = overlay.querySelector('form');
      settings = { ...settings, root: Number(form.elements.root.value), a: form.elements.a.value, b: form.elements.b.value, count: Number(form.elements.count.value), phase: form.elements.phase.value, fold: form.elements.fold.checked };
      try { result = build(); statusText = ''; } catch (error) { result = null; statusText = error.message; }
      renderResult();
    }
    function renderResult() {
      const container = overlay.querySelector('[data-distance-result]');
      container.innerHTML = result ? `<div class="ct-distance-pitches">${describe(result).map((text, index) => `<div data-distance-pitch="${index}"><small>Note ${index + 1}</small>${infinity ? `<strong class="ct-distance-ratio">${esc(result.tones[index].fraction)}</strong><span>${result.tones[index].cents.toFixed(2)}¢</span>` : `<strong>${esc(text)}</strong>`}</div>`).join('')}</div>${!infinity ? `<p>Interval-class vector: <b>⟨${result.vector.join(', ')}⟩</b></p>` : ''}` : '<p>Adjust the distances above to see your result.</p>';
      overlay.querySelectorAll('[data-needs-distance]').forEach(button => { button.disabled = !result; });
      status(statusText);
    }
    function render() {
      overlay.className = `ct-distance-overlay ${expanded ? 'expanded' : ''}`;
      overlay.innerHTML = `<section class="ct-distance-drawer" role="dialog" aria-modal="true" aria-labelledby="ct-distance-title"><header><div><p>Circle of ${infinity ? 'Infinity' : 'Threes'}</p><h2 id="ct-distance-title">Distance Model</h2></div><div><button type="button" data-distance-expand>${expanded ? 'Back to drawer' : '↗ Pop out'}</button><button type="button" data-distance-close aria-label="Close Distance Model">×</button></div></header><p class="ct-distance-intro">Two distances. A trail of notes. Change A and B and hear where they take you.</p>${infinity ? `<p class="ct-distance-source">Current tuning: <b>${esc(source.name)}</b><br>Repeat span: ${source.equave.toFixed(3)}¢ · ${esc(ratioLabel(2 ** (source.equave / 1200)))}. No 12-note rounding.</p>` : '<p class="ct-distance-source">12 note names · distances in semitones</p>'}
        <form><label>Starting ${infinity ? 'pitch' : 'note'}<select name="root">${(infinity ? source.tones.map((tone, index) => `Pitch ${index + 1} · ${ratioLabel(tone.ratio)} · ${tone.cents.toFixed(2)}¢`) : names).map((name, index) => `<option value="${index}" ${index === Number(settings.root) ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>${infinity ? `<label>Distances in<select name="unit"><option value="cents" ${settings.unit === 'cents' ? 'selected' : ''}>Cents</option><option value="ratios" ${settings.unit === 'ratios' ? 'selected' : ''}>Ratios</option></select></label>` : ''}<label>Distance A<input name="a" value="${esc(settings.a)}" ${settings.unit === 'ratios' ? 'type="text"' : 'type="number" step="' + (infinity ? 'any' : '1') + '"'} required></label><label>Distance B<input name="b" value="${esc(settings.b)}" ${settings.unit === 'ratios' ? 'type="text"' : 'type="number" step="' + (infinity ? 'any' : '1') + '"'} required></label><label>First step<select name="phase"><option value="ab" ${settings.phase === 'ab' ? 'selected' : ''}>A then B</option><option value="ba" ${settings.phase === 'ba' ? 'selected' : ''}>B then A</option></select></label><label>Up to this many notes<input name="count" type="number" min="1" max="24" step="1" value="${settings.count}"></label><label class="ct-distance-fold"><input name="fold" type="checkbox" ${settings.fold ? 'checked' : ''}>Fold into ${infinity ? 'this tuning’s repeat span' : 'one octave'}</label></form>
        <div class="ct-distance-actions"><button type="button" data-distance-play data-needs-distance>▶ Play result</button><button type="button" data-distance-stop>■ Stop</button><button type="button" data-distance-pool data-needs-distance>＋ Add to Pool</button><button type="button" data-distance-use data-needs-distance>Use as Working</button></div><p role="status" data-distance-status></p><section data-distance-result aria-label="Generated notes"></section><details><summary title="See how the trail is made">⌕ Examine the mechanics</summary><p>Start on the selected pitch, take one step of A, then one of B, and repeat. “B then A” swaps their order. Fold wraps the trail into the repeat span and stops when both pitch and next step repeat. Unfold keeps the rising or falling trail.</p><p>${infinity ? 'Cents add to the pitch; frequency ratios multiply it. For example, 3/2 is about 701.955 cents, not 700. Changing units converts the same intervals. Generated pitches need not be members of the starting tuning. Your pool keeps the exact cents, ratios, base frequency and repeat span.' : 'Each semitone moves by one position in the 12-note circle. The vector counts all unordered pitch-class pairs in the six interval classes. Enharmonic names share one pitch class. Add to Pool keeps this set in your composition material pool.'}</p><p>Play uses this app’s existing audio engine. An unfolded trail outside its supported register asks you to fold or shorten it, rather than silently changing the intervals.</p></details></section>`;
      const form = overlay.querySelector('form');
      const earlier = adapter.legacy?.() || [];
      if (earlier.length) {
        const drawer = overlay.querySelector('.ct-distance-drawer');
        const history = document.createElement('details');
        history.innerHTML = `<summary>Earlier note-name results (${earlier.length})</summary><p>Your earlier Distance pool is preserved. Bring any of these sets into the Threes composition pool.</p>${earlier.map((item, index) => `<p>${esc(item.label)} <button type="button" data-distance-import="${index}">＋ Add this set to Pool</button></p>`).join('')}`;
        drawer.append(history);
        history.querySelectorAll('[data-distance-import]').forEach(button => button.onclick = () => {
          try { adapter.add(earlier[Number(button.dataset.distanceImport)]); status('Earlier set added to the Threes composition pool. The original is preserved.'); } catch (error) { status(error.message); }
        });
      }
      form.onsubmit = event => { event.preventDefault(); update(); };
      // Keep typed values, the visible result, and auditions in sync before blur.
      form.oninput = event => { if (event.target.matches('input')) update(); };
      form.onchange = event => {
        if (event.target.name === 'unit') {
          stop(); const unit = event.target.value;
          try {
            const convert = value => unit === 'ratios' ? String(2 ** (Number(value) / 1200)) : String(1200 * Math.log2(ratioValue(value)));
            settings = { ...settings, a: convert(settings.a), b: convert(settings.b), unit }; result = build(); statusText = ''; render();
          } catch (error) { event.target.value = settings.unit; status(error.message); }
        } else update();
      };
      overlay.querySelector('[data-distance-close]').onclick = close;
      overlay.querySelector('[data-distance-expand]').onclick = () => { stop(); expanded = !expanded; render(); overlay.querySelector('[data-distance-expand]').focus(); };
      overlay.querySelector('[data-distance-play]').onclick = play;
      overlay.querySelector('[data-distance-stop]').onclick = () => { stop(); status('Stopped.'); };
      overlay.querySelector('[data-distance-pool]').onclick = () => { update(); if (!result) return; try { adapter.add(clone(result)); status('Added to your pool. The copy is saved in this browser.'); } catch (error) { status(error.message); } };
      overlay.querySelector('[data-distance-use]').onclick = () => { update(); if (!result) return; try { adapter.use(clone(result)); close(); } catch (error) { status(error.message); } };
      renderResult();
    }
    function open(button) {
      if (overlay) return;
      opener = button; source = infinity ? adapter.source() : null;
      settings = infinity ? defaults(source) : { root: 0, a: 1, b: 3, count: 12, phase: 'ba', fold: true, unit: 'semitones' };
      statusText = ''; result = build(); stop();
      overlay = document.createElement('div'); document.body.append(overlay); document.body.classList.add('ct-distance-open'); render();
      overlay.onclick = event => { if (event.target === overlay) close(); };
      overlay.onkeydown = event => {
        if (event.key === 'Escape') { event.stopPropagation(); close(); }
        if (event.key === 'Tab') {
          const controls = [...overlay.querySelectorAll('button:not(:disabled),input,select,summary')];
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      };
      overlay.querySelector('[data-distance-close]').focus();
    }
    function insert() {
      const actions = document.querySelector('.top-actions');
      if (!actions || actions.querySelector('[data-ct-distance-open]')) return;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.ctDistanceOpen = ''; button.textContent = 'Distance Model'; button.setAttribute('aria-haspopup', 'dialog'); button.onclick = () => open(button); actions.append(button);
    }
    new MutationObserver(insert).observe(document.body, { childList: true, subtree: true }); insert();
    host.addEventListener('pagehide', stop);
    document.addEventListener('visibilitychange', () => { if (document.hidden && overlay) { stop(); status('Stopped while the page was hidden.'); } });
    return { open, close, stop };
  }
  host.CTDistance = { ...core, mount };
})(typeof window !== 'undefined' ? window : globalThis);
