(function (host) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const boundedArray = (value, max) => Array.isArray(value) && value.length <= max;
  const validTone = tone => record(tone) && positive(tone.ratio) && typeof tone.cents === 'number' && Number.isFinite(tone.cents);
  function validBar(bar) {
    if (!record(bar)) return false;
    if (bar.tones !== undefined && (!boundedArray(bar.tones, 4096) || !bar.tones.every(validTone))) return false;
    if (bar.baseHz !== undefined && !positive(bar.baseHz)) return false;
    if (bar.notes !== undefined) {
      if (!boundedArray(bar.notes, 256) || !bar.notes.every(note => record(note) && positive(note.beats) && (note.tone === null || validTone(note.tone)))) return false;
      if (bar.performance === 'melody' && bar.notes.reduce((sum, note) => sum + note.beats, 0) > 4.000001) return false;
    }
    if (bar.layers !== undefined && (!boundedArray(bar.layers, 64) || !bar.layers.every(layer => record(layer) && Number.isInteger(layer.sides) && layer.sides > 0 && layer.sides <= 512 && ['tones', 'rests', 'pointOffsets', 'borrowedHits'].every(key => layer[key] === undefined || boundedArray(layer[key], 512))))) return false;
    if (bar.pattern !== undefined && (!boundedArray(bar.pattern, 64) || !bar.pattern.every(row => boundedArray(row, 512)))) return false;
    for (const key of ['steps', 'bpm', 'middleBpm', 'exitBpm', 'meterN', 'meterD']) if (bar[key] !== undefined && !positive(bar[key])) return false;
    if (bar.steps !== undefined && (!Number.isInteger(bar.steps) || bar.steps > 512)) return false;
    return Array.isArray(bar.tones) || (positive(bar.steps) && (Array.isArray(bar.layers) || Array.isArray(bar.pattern)));
  }
  function noteName(frequency) {
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const rounded = Math.round(midi);
    return (Math.abs(midi - rounded) > 0.00005 ? '≈ ' : '') + names[((rounded % 12) + 12) % 12] + (Math.floor(rounded / 12) - 1);
  }
  function slots(value) {
    return Array.from({ length: 4 }, (_, index) => value?.[index] ? copy(value[index]) : null);
  }
  function repeatCount(value) { return Math.max(1, Math.min(16, Math.round(Number(value) || 1))); }
  function repeatSlots(values) { return Array.from({ length: 4 }, (_, index) => repeatCount(values?.[index])); }
  const laneNames = { melody: 'Melody', harmony: 'Harmony' };
  function rhythmBar(lanes, index) {
    const melody = lanes.melody[index], harmony = lanes.harmony[index];
    // Keep both parts of older saves audible without presenting two rhythm lanes.
    return melody && harmony ? { melody, harmony } : melody || harmony || null;
  }
  function rhythmSources(bar) { return isPair(bar) ? [bar.melody, bar.harmony].filter(Boolean) : bar ? [bar] : []; }
  function timeCircleGeometry(source) {
    const steps = Math.max(1, Number(source.steps) || 16);
    const point = (position, radius) => {
      const angle = -Math.PI / 2 + position / steps * Math.PI * 2;
      return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
    };
    if (source.layers?.length) return source.layers.filter(layer => layer.enabled).map((layer, index) => {
      const radius = index < 4 ? 42 - 7 * index : 18 + (index - 4) % 8 * 3;
      // Same clock rotation, micro-offset and point offsets as the source wheel.
      const shift = ((Number(layer.hour) || 0) + (Number(layer.minute) || 0) / 60 + (Number(layer.second) || 0) / 3600) / 12 * steps
        + (Number(layer.microMs) || 0) / (60000 / (Number(source.bpm) || 104) / 4);
      return { radius, polygon: true, color: ['#f4c75f','#8ecfff','#ef7bbd','#f25f58'][index % 4],
        points: Array.from({length:layer.sides}, (_, vertex) => ({ ...point(vertex / layer.sides * steps + (Number(layer.pointOffsets?.[vertex]) || 0) + shift, radius),
          active: (!layer.rests?.[vertex] || !!layer.borrowedHits?.[vertex]) && layer.tones?.[vertex] !== 'Silent' })) };
    });
    if (source.notes?.length) {
      let beat = 0;
      const points = source.performance === 'harmony' ? [{...point(0,42),active:true}] : source.notes.map(note => { const p = {...point(beat / 4 * steps,42),active:!!note.tone}; beat += note.beats; return p; });
      return [{radius:42,polygon:false,color:'#f4c75f',points}];
    }
    return (source.pattern || []).map((row, index) => ({ radius: [44,38,32,26,20][index % 5], polygon: false,
      color: ['#f4c75f','#f17864','#6fc7bb','#62a9d8','#ae87d7'][index % 5],
      points: Array.from({length:steps}, (_, step) => ({...point(step,[44,38,32,26,20][index % 5]),active:!!row[step]})) }));
  }
  function compositionState(saved = {}) {
    saved = saved || {};
    return {
      lanes: { melody: slots(saved.lanes?.melody), harmony: slots(saved.lanes?.harmony || saved.bars) },
      repeats: repeatSlots(saved.repeats),
      tempo: Math.max(30, Math.min(240, Number(saved.tempo) || 96))
    };
  }
  function pairedBars(lanes, onlyLane) {
    return Array.from({ length: 4 }, (_, index) => ({
      melody: onlyLane && onlyLane !== 'melody' ? null : lanes.melody[index],
      harmony: onlyLane && onlyLane !== 'harmony' ? null : lanes.harmony[index]
    }));
  }
  function isPair(bar) { return !!bar && ('melody' in bar || 'harmony' in bar); }
  function numberLabel(values) { return values.every(value => (Number.isInteger(value) && value < 10) || value === 'R') ? values.join('') : values.join(' · '); }
  function buildIdea(kind, source, draft, mode, tempo) {
    if (!record(source) || !boundedArray(source.tones, 4096) || !source.tones.every(validTone) || !boundedArray(draft, 256) || !['melody', 'harmony'].includes(mode) || !draft.every(note => record(note) && positive(note.beats) && (note.index === null || (Number.isInteger(note.index) && note.index >= 0 && note.index < source.tones.length)))) throw new Error('Choose valid pitches and positive note durations.');
    const notes = draft.map(note => ({ ...note, tone: note.index === null ? null : copy(source.tones[note.index]) }));
    const tones = notes.filter(note => note.tone).map(note => ({ ...note.tone, pitchNumber: note.index + 1 }));
    if (!tones.length) throw new Error('Choose at least one pitch.');
    if (mode === 'melody' && notes.reduce((sum, note) => sum + note.beats, 0) > 4.000001) throw new Error('One bar holds four beats.');
    return { ...copy(source), kind, performance: mode, label: `${mode === 'melody' ? 'Melody' : 'Harmony'} · ${numberLabel(notes.map(note => note.tone ? note.index + 1 : 'R'))}`,
      tones, notes, steps: 16, meterN: 4, meterD: 4, bpm: tempo, middleBpm: tempo, exitBpm: tempo, curve: 'linear', layers: [], pattern: [], rudiments: {} };
  }
  function ratioText(tone) {
    if (tone.fraction) return tone.fraction;
    const value = Number(tone.ratio);
    for (let denominator = 1; denominator <= 4096; denominator++) {
      const numerator = Math.round(value * denominator);
      if (numerator > 0 && Math.abs(numerator / denominator - value) < 1e-10) return `${numerator}/${denominator}`;
    }
    return `≈ ${value.toFixed(6)}`;
  }
  function infinityPlan(bars, bpm, repeats = []) {
    const duration = 240 / Math.max(30, Math.min(240, Number(bpm) || 96));
    let cursor = 0;
    return bars.slice(0, 4).flatMap((bar, index) => Array.from({ length: repeatCount(repeats[index]) }, (_, repetition) => {
      const segment = { bar, index, repetition, repeatCount: repeatCount(repeats[index]), start: cursor, duration }; cursor += duration; return segment;
    }));
  }
  function timePlan(bars, stepDuration, layerEvents, repeats = []) {
    let cursor = 0;
    return bars.slice(0, 4).flatMap((bar, index) => {
      const shape = bar || { steps: 16, bpm: 104, middleBpm: 104, exitBpm: 104, curve: 'linear', meterN: 4, meterD: 4 };
      const durations = Array.from({ length: shape.steps }, (_, step) => stepDuration(shape, step));
      const offsets = [0];
      durations.forEach(duration => offsets.push(offsets[offsets.length - 1] + duration));
      const duration = offsets[offsets.length - 1];
      let events;
      if (bar?.previewChord) {
        const tones = bar.tones || [], step = duration / 2 / Math.max(1, tones.length);
        events = tones.map((tone, index) => ({ tone, at: index * step })).concat(tones.map(tone => ({ tone, at: duration / 2 })));
      } else if (bar?.performance === 'harmony') events = (bar.tones || []).map(tone => ({ tone, at: 0 }));
      else if (bar?.notes) {
        let beat = 0;
        events = bar.notes.flatMap(note => { const at = beat / 4 * duration; beat += note.beats; return note.tone && at < duration ? [{ tone: note.tone, at }] : []; });
      } else events = !bar ? [] : bar.layers?.length ? layerEvents(bar.layers, bar).filter(event => event.bucket >= 0 && event.bucket < shape.steps).map(event => ({ ...event, at: offsets[event.bucket] + (event.position - event.bucket) * durations[event.bucket] })) : (bar.pattern || []).flatMap((row, voice) => row.flatMap((hit, step) => hit && step < shape.steps ? [{ voice, at: offsets[step] }] : []));
      return Array.from({ length: repeatCount(repeats[index]) }, (_, repetition) => {
        const item = { bar, index, repetition, repeatCount: repeatCount(repeats[index]), start: cursor, duration, events };
        cursor += duration; return item;
      });
    });
  }
  function infinityEvents(bar, duration) {
    const pair = isPair(bar) ? bar : { harmony: bar };
    return Object.keys(laneNames).flatMap(lane => {
      const source = pair[lane], tones = source?.tones || [];
      if (source?.previewChord) {
        const step = duration / 2 / Math.max(1, tones.length);
        return tones.map((tone, index) => ({ lane, source, tone, index, at: index * step, duration: step * 0.8 }))
          .concat(tones.map((tone, index) => ({ lane, source, tone, index, at: duration / 2, duration: duration * 0.4 })));
      }
      const melodic = source?.performance ? source.performance === 'melody' : lane === 'melody';
      if (melodic && source?.notes) {
        let beat = 0;
        return source.notes.flatMap((note, index) => {
          const at = beat / 4 * duration; beat += note.beats;
          return note.tone && at < duration ? [{ lane, source, tone: note.tone, index, at, duration: Math.max(0.01, Math.min(note.beats / 4 * duration, duration - at) * 0.8) }] : [];
        });
      }
      const length = melodic ? duration / Math.max(1, tones.length) : duration;
      return tones.map((tone, index) => ({ lane, source, tone, index,
        at: melodic ? index * length : 0,
        duration: melodic ? Math.max(0.01, length * 0.8) : Math.max(0.1, duration - 0.22) }));
    });
  }
  function timeCompositionPlan(bars, stepDuration, layerEvents, repeats = []) {
    let cursor = 0;
    return bars.slice(0, 4).flatMap((bar, index) => {
      const pair = isPair(bar) ? bar : { harmony: bar };
      const parts = Object.keys(laneNames).flatMap(lane => pair[lane]
        ? [{ lane, ...timePlan([pair[lane]], stepDuration, layerEvents)[0] }] : []);
      const duration = parts.length ? Math.max(...parts.map(part => part.duration))
        : timePlan([null], stepDuration, layerEvents)[0].duration;
      const events = parts.flatMap(part => part.events.map(event => ({ ...event, lane: part.lane, source: part.bar, sourceDuration: part.duration }))).sort((a, b) => a.at - b.at);
      return Array.from({ length: repeatCount(repeats[index]) }, (_, repetition) => {
        const segment = { bar, index, repetition, repeatCount: repeatCount(repeats[index]), start: cursor, duration, events };
        cursor += duration; return segment;
      });
    });
  }
  const core = { copy, slots, repeatCount, repeatSlots, ratioText, noteName, infinityPlan, timePlan, compositionState, pairedBars, isPair, infinityEvents, timeCompositionPlan, buildIdea, numberLabel, rhythmBar, rhythmSources, timeCircleGeometry, validBar };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (!host.document) return;
  const document = host.document;
  let api, kind, page, lanes = { melody: slots([]), harmony: slots([]) }, selectedLane = 'harmony', selectedBar = 0, selectedPool = -1, tempo = 96;
  let repeats = repeatSlots([]);
  let madePool = [], draftSource = null, draftSourceKey = 'current', draft = [], draftMode = 'melody', draftBeats = 1, builderOpen = false;
  let opened = false, drawerOpen = true, playing = false, run = 0, undo = null, pinned = false, storageIssue = '';
  const unreadableKeys = new Set();
  const storageKey = () => `composer-toolbox-${kind}-four-bars-v3`;
  const legacyStorageKey = () => `composer-toolbox-${kind}-four-bars-v1`;
  const builtPoolKey = () => `composer-toolbox-${kind}-built-pool-v1`;
  const poolItems = () => api.pool().concat(madePool);
  const previewBar = bar => kind === 'infinity' && bar.performance !== 'melody' ? { ...bar, previewChord: true } : bar;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function read(key, fallback, validate) {
    try { const raw = localStorage.getItem(key); if (!raw) return fallback; const value = JSON.parse(raw); if (validate && !validate(value)) throw new Error('Invalid saved material'); return value; }
    catch { unreadableKeys.add(key); storageIssue = 'Saved material could not be read. Your stored copy has not been changed.'; return fallback; }
  }
  function write(key, value) {
    if (unreadableKeys.has(key)) { announce('The earlier saved copy could not be read, so it has not been overwritten. Keep this page open.'); return false; }
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { storageIssue = 'Changes are only in this open page: browser storage is unavailable. Keep the page open.'; announce(storageIssue); return false; }
  }
  function save() {
    const ok = write(storageKey(), { version: 3, lanes, repeats, tempo });
    const status = page?.querySelector('[data-save-state]');
    if (status) status.textContent = ok ? 'Saved in this browser' : 'Not saved — keep this page open';
    return ok;
  }
  function announce(message) {
    let status = document.getElementById('ct-four-announcement');
    if (!status) {
      status = document.createElement('div'); status.id = 'ct-four-announcement'; status.className = 'ct-four-toast'; status.setAttribute('role', 'status'); document.body.append(status);
    }
    status.textContent = message;
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => { status.textContent = ''; }, 5500);
  }
  function label(bar) { return kind === 'time' ? (bar?.performance ? `Rhythm · ${bar.meterN}/${bar.meterD}` : bar?.label || bar?.name || 'Rhythm') : bar?.performance ? `${bar.performance === 'melody' ? 'Melody' : 'Harmony'} · ${pitchLabel(bar)}` : bar?.label || bar?.name || 'Untitled idea'; }
  const selectedIdea = () => kind === 'time' ? rhythmBar(lanes, selectedBar) : lanes[selectedLane][selectedBar];
  function rhythmMarkup(bar) {
    const layers = rhythmSources(bar).flatMap(timeCircleGeometry);
    const number = value => Number(value).toFixed(4);
    return `<svg class="ct-four-rhythm-circle" viewBox="0 0 100 100" role="img" aria-label="Saved rhythm circles and geometry with a fixed 12 o’clock reference"><circle class="ct-four-circle-outline" cx="50" cy="50" r="48"/>${layers.map(layer => `<g style="color:${layer.color}">${layer.polygon ? `<polygon points="${layer.points.map(p => `${number(p.x)},${number(p.y)}`).join(' ')}"/>` : `<circle class="ct-four-circle-ring" cx="50" cy="50" r="${layer.radius}"/>`}${layer.points.map(p => `<circle class="ct-four-circle-point ${p.active ? 'active' : ''}" cx="${number(p.x)}" cy="${number(p.y)}" r="${p.active ? '1.6' : '.65'}"/>`).join('')}</g>`).join('')}<line class="ct-four-circle-origin" x1="50" y1="50" x2="50" y2="2"/></svg>`;
  }
  function ratioMarkup(bar) { return `<span class="ct-four-ratios">${(bar.tones || []).map(tone => `<span>${esc(ratioText(tone))}</span>`).join('')}</span>`; }
  function pitchLabel(bar) {
    if (bar.notes?.length) return numberLabel(bar.notes.map(note => note.tone ? note.index + 1 : 'R'));
    if (bar.tones?.length) return numberLabel(bar.tones.map((tone, index) => tone.pitchNumber || index + 1));
    return bar.label || bar.name || 'Untitled idea';
  }
  function chordStack(bar) {
    const values = bar.notes?.length ? bar.notes.filter(note => note.tone).map(note => note.index + 1) : (bar.tones || []).map((tone, index) => tone.pitchNumber || index + 1);
    return `<span class="ct-four-chord-stack" style="--pitch-count:${Math.max(1, values.length)}" aria-label="Chord ${esc(numberLabel(values))}">${values.map(value => `<span>${value}</span>`).join('')}</span>`;
  }
  function barMarkup(bar, lane) {
    if (kind === 'time') return rhythmMarkup(bar);
    if (bar.tones?.length && (bar.performance === 'harmony' || (!bar.performance && lane === 'harmony'))) return chordStack(bar);
    if (bar.notes?.length) return `<span class="ct-four-melody-line" style="--note-count:${bar.notes.length}" aria-label="Pitch numbers with durations in beats">${bar.notes.map(note => `<span><b ${note.tone ? '' : 'class="ct-four-rest-number"'}>${note.tone ? note.index + 1 : 'R'}</b><small title="${note.beats} ${note.beats === 1 ? 'beat' : 'beats'}">${note.beats}</small></span>`).join('')}</span>`;
    return `<span class="ct-four-melody-line">${esc(pitchLabel(bar))}</span>`;
  }
  function poolMarkup(item) {
    const bar = api.snapshot(item);
    if (kind === 'time') return `<span>${esc(label(bar))}</span><span class="ct-four-pool-details">${esc(subtitle(bar))}</span>`;
    const tones = bar.tones || [];
    return `<span>${esc(label(bar))}</span>${bar.performance === 'harmony' ? chordStack(bar) : ''}${tones.length ? `<span class="ct-four-pool-details">${tones.map((tone, index) => `<span><b>${tone.pitchNumber || index + 1}</b> · ${esc(ratioText(tone))}<br>${esc(tone.name || noteName((bar.baseHz || 261.63) * tone.ratio))} · ${Number(tone.cents).toFixed(2)} cents</span>`).join('')}</span>` : `<span class="ct-four-pool-details">${esc(subtitle(bar))}</span>`}`;
  }
  function builderMarkup() {
    if (kind === 'time') return '';
    if (!draftSource) draftSource = api.reference();
    const pool = poolItems();
    return `<section class="ct-four-builder"><button type="button" data-toggle-builder aria-expanded="${builderOpen}" aria-controls="ct-four-builder-content">${builderOpen ? 'Close pitch builder' : 'Build an idea from pitches'}</button><div id="ct-four-builder-content" ${builderOpen ? '' : 'hidden'}><div class="ct-four-builder-controls"><label>Build<select data-build-mode><option value="melody" ${draftMode === 'melody' ? 'selected' : ''}>Melody</option><option value="harmony" ${draftMode === 'harmony' ? 'selected' : ''}>Harmony</option></select></label><label>Pitch source<select data-build-source><option value="current">Current working pitches</option>${pool.map((item, index) => api.snapshot(item).tones?.length ? `<option value="${index}">${esc(label(api.snapshot(item)))}</option>` : '').join('')}</select></label>${draftMode === 'melody' ? `<label>Duration<select data-build-beats>${[0.25,0.5,1,2,4].map(value => `<option value="${value}" ${value === draftBeats ? 'selected' : ''}>${value} ${value === 1 ? 'beat' : 'beats'}</option>`).join('')}</select></label><button type="button" data-build-rest aria-label="R — add rest" title="R = rest">R</button>` : ''}</div><p>${draftMode === 'melody' ? 'Choose a duration, then tap a number or R (rest). Fill four beats for one bar.' : 'Select the pitches you want to sound together.'} Source: ${esc(draftSource.label)}.</p><div class="ct-four-pitch-bank">${draftSource.tones.map((tone, index) => `<button type="button" data-build-pitch="${index}" aria-label="Pitch ${index + 1}" ${draftMode === 'harmony' ? `aria-pressed="${draft.some(note => note.index === index)}"` : ''}>${index + 1}</button>`).join('')}</div><div class="ct-four-draft ${draftMode === 'harmony' ? 'harmony-draft' : ''}" aria-label="Draft idea">${draft.length ? draft.map(note => `<span>${note.index === null ? 'R' : note.index + 1}${draftMode === 'melody' ? `<small>${note.beats} ${note.beats === 1 ? 'beat' : 'beats'}</small>` : ''}</span>`).join('') : '<span>Choose a pitch to begin.</span>'}</div><footer><span>${draftMode === 'melody' ? `${draft.reduce((sum, note) => sum + note.beats, 0)} / 4 beats` : 'Harmony'}</span><button type="button" data-build-undo ${draft.length ? '' : 'disabled'}>Undo note</button><button type="button" data-build-hear ${draft.some(note => note.index !== null) ? '' : 'disabled'}>▶ Hear draft</button><button type="button" data-build-save ${draft.some(note => note.index !== null) ? '' : 'disabled'}>Save to Pool</button></footer></div></section>`;
  }
  function subtitle(bar) {
    if (!bar) return 'Empty bar. No notes play.';
    if (kind === 'infinity') return (bar.tones || []).map(tone => noteName((bar.baseHz || 261.6255653005986) * tone.ratio)).join(' · ');
    return `${bar.meterN}/${bar.meterD} · ${bar.bpm} BPM · ${bar.layers?.length ? bar.layers.filter(layer => layer.enabled).length + ' voice shapes' : 'rhythm'}`;
  }
  function examineMarkup() {
    const bar = selectedIdea();
    if (kind === 'time') return `<header><h2>Rhythm · bar ${selectedBar + 1}</h2><button type="button" data-close-examine aria-label="Close Examine">×</button></header><p>Choose material from the pool, then tap a bar to place a copy. The miniature retains the source circle positions, shapes, and rotation. Playback retains its saved timing, sounds, rests, and rudiments.</p><p>Repeat: ${repeats[selectedBar]}×. The whole bar repeats before the next bar. An empty bar stays silent. Replacing or clearing a bar does not change its pool source.</p>${rhythmSources(bar).map(source => `<p>Source: ${esc(label(source))}. ${source.steps} positions. Tempo: ${source.bpm} → ${source.middleBpm} → ${source.exitBpm} BPM.</p>`).join('')}${isPair(bar) ? '<p>This earlier save contains two rhythms. Both still play together in this one bar; neither has been removed or shortened.</p>' : ''}`;
    let detail = '<p>This bar is empty. It still takes its full measure of time during playback.</p>';
    if (bar && kind === 'infinity') detail = `<p>Source: ${esc(label(bar))}</p><p>${(bar.performance || selectedLane) === 'melody' ? (bar.notes ? 'The melody plays its saved sequence and rests inside one 4/4 bar. Each note and rest uses the duration selected when building it. Any unfilled part of the bar stays silent.' : 'Melody plays the captured pitches in order, spaced evenly inside one 4/4 bar.') : 'Harmony plays the captured pitches together as one block inside one 4/4 bar.'} Ratios and cents stay exactly as captured. Both lanes start each bar together.</p><table><thead><tr><th>Note</th><th>Ratio</th><th>Cents</th></tr></thead><tbody>${bar.tones.map(tone => `<tr><td>${esc(noteName(bar.baseHz * tone.ratio))}</td><td>${esc(ratioText(tone))}</td><td>${tone.cents.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    if (bar && kind === 'time' && bar.performance) {
      detail = `<p>Source: ${esc(label(bar))}. One 4/4 bar at the composition tempo (${tempo} BPM).</p><p>${bar.performance === 'melody' ? 'Notes play in the saved horizontal order. Each note and rest uses its chosen duration; any unfilled beats stay silent.' : 'The vertically stacked pitches sound together as one chord. Pool and draft previews play its pitches separately, then the full chord.'} Both lanes start each bar together.</p>${bar.performance === 'melody' ? `<p>Sequence: ${bar.notes.map(note => `${note.tone ? note.index + 1 : 'R'} — ${note.beats} ${note.beats === 1 ? 'beat' : 'beats'}`).join('; ')}.</p>` : ''}<table><thead><tr><th>Number</th><th>Note</th><th>Ratio</th><th>Cents</th></tr></thead><tbody>${bar.tones.map(tone => `<tr><td>${tone.pitchNumber}</td><td>${esc(tone.name || noteName((bar.baseHz || 261.63) * tone.ratio))}</td><td>${esc(ratioText(tone))}</td><td>${Number(tone.cents).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    }
    if (bar && kind === 'time' && !bar.performance) {
      const layers = bar.layers || [];
      detail = `<p>The ${laneNames[selectedLane]} lane contains this captured idea. Its ${bar.steps} positions fit inside ${bar.meterN}/${bar.meterD}. Point pitches, drums, rests, offsets, and assigned rudiments are kept. Use pitched shapes from Generate Material for a melody or chord accompaniment; Explorer rhythms keep their drum sounds.</p><p>Tempo: ${bar.bpm} → ${bar.middleBpm} → ${bar.exitBpm} BPM. ${esc(bar.grouping || '')}</p><p>Both lanes start each bar together. If their captured lengths differ, the shorter idea is followed by silence until the longer one finishes. Neither idea is stretched or cut short.</p>${layers.length ? `<ul>${layers.filter(layer => layer.enabled).map(layer => `<li>${layer.sides} points · ${esc(layer.tones.filter((tone, index) => !layer.rests?.[index] && tone !== 'Silent').join(' · ') || 'rests')}</li>`).join('')}</ul>` : `<p>${bar.pattern.flat().filter(Boolean).length} drum attacks from Explorer.</p>`}`;
    }
    return `<header><h2>${laneNames[selectedLane]} · bar ${selectedBar + 1}</h2><button type="button" data-close-examine aria-label="Close Examine">×</button></header><p>Pick an idea in the left drawer, then tap a bar in Melody or Harmony to place a copy. Replacing or removing that copy never changes your pool.</p><p>Repeat is shared by both lanes, like Threes: 1× plays once, 2× plays twice. Bar ${selectedBar + 1} is set to ${repeats[selectedBar]}×. The pair repeats before the next bar; an empty lane stays silent. The four columns remain visible even when playback contains more than four bars.</p>${detail}`;
  }
  function tracksMarkup() {
    if (kind === 'time') {
      const bars = Array.from({length:4}, (_, index) => rhythmBar(lanes, index));
      return `<div class="ct-four-repeat-row" aria-label="Rhythm repeats">${repeats.map((count, index) => `<label class="ct-four-repeat"><span>BAR ${index + 1}<small>Repeat</small></span><select data-repeat-bar="${index}" aria-label="Bar ${index + 1} total plays" ${playing ? 'disabled' : ''}>${Array.from({length:16}, (_, n) => `<option value="${n + 1}" ${count === n + 1 ? 'selected' : ''}>${n + 1}×</option>`).join('')}</select></label>`).join('')}</div><section class="ct-four-lane" aria-label="Rhythm, four bars"><div class="ct-four-bars">${bars.map((bar, index) => `<article class="ct-four-bar ${index === selectedBar ? 'selected' : ''} ${bar ? 'filled' : ''}" data-bar="${index}" data-lane="rhythm"><button type="button" class="ct-four-bar-place" data-place="${index}" data-lane="rhythm" aria-label="Rhythm bar ${index + 1}: ${bar ? 'saved rhythm' : 'empty'}${selectedPool >= 0 ? '. Place selected rhythm' : '. Select bar'}"><span class="ct-four-number">BAR <b>${index + 1}</b></span><strong>${bar ? rhythmMarkup(bar) : '<span aria-hidden="true">＋</span>'}</strong></button><div class="ct-four-bar-actions">${bar ? `<button type="button" data-hear-bar="${index}" data-lane="rhythm" aria-label="Hear rhythm bar ${index + 1}">▶ Hear</button><button type="button" data-clear-bar="${index}" data-lane="rhythm" aria-label="Clear rhythm bar ${index + 1}">× Clear</button>` : '<span>Empty bar</span>'}</div></article>`).join('')}</div></section>`;
    }
    const repeatRow = `<div class="ct-four-repeat-row" aria-label="Shared Melody and Harmony repeats">${repeats.map((count, index) => `<label class="ct-four-repeat"><span>BAR ${index + 1}<small>Repeat both lanes</small></span><select data-repeat-bar="${index}" aria-label="Bar ${index + 1} Melody and Harmony total plays" ${playing ? 'disabled' : ''}>${Array.from({length:16}, (_, n) => `<option value="${n + 1}" ${count === n + 1 ? 'selected' : ''}>${n + 1}×</option>`).join('')}</select></label>`).join('')}</div>`;
    return repeatRow + Object.keys(laneNames).map(lane => `<section class="ct-four-lane" aria-label="${laneNames[lane]} lane, four bars"><header><h2>${laneNames[lane]}</h2><button type="button" data-hear-lane="${lane}" ${playing || !lanes[lane].some(Boolean) ? 'disabled' : ''}>▶ Hear ${laneNames[lane]}</button></header><div class="ct-four-bars">${lanes[lane].map((bar, index) => `<article class="ct-four-bar ${index === selectedBar && lane === selectedLane ? 'selected' : ''} ${bar ? 'filled' : ''}" data-bar="${index}" data-lane="${lane}"><button type="button" class="ct-four-bar-place" data-place="${index}" data-lane="${lane}" aria-label="${laneNames[lane]} bar ${index + 1}: ${esc(bar ? label(bar) : 'empty')}${selectedPool >= 0 ? '. Place selected pool idea' : '. Select bar'}"><span class="ct-four-number">BAR <b>${index + 1}</b></span><strong>${bar ? barMarkup(bar, lane) : '<span aria-hidden="true">＋</span>'}</strong><span class="ct-four-bar-notes">${bar ? esc(bar.performance ? (bar.performance === 'melody' ? 'Durations below: beats' : 'Pitches together') : kind === 'infinity' ? (lane === 'melody' ? 'Pitches in order' : 'Pitches together') : subtitle(bar)) : 'Place an idea'}</span></button><div class="ct-four-bar-actions">${bar ? `<button type="button" data-hear-bar="${index}" data-lane="${lane}" aria-label="Hear ${laneNames[lane]} bar ${index + 1}">▶ Hear</button><button type="button" data-clear-bar="${index}" data-lane="${lane}" aria-label="Clear ${laneNames[lane]} bar ${index + 1}">× Clear</button>` : '<span>Empty bar</span>'}</div></article>`).join('')}</div></section>`).join('');
  }
  function render() {
    if (!opened || !api) return;
    if (!page) { page = document.createElement('main'); page.id = 'ct-four-page'; document.body.append(page); }
    page.hidden = false;
    const pool = poolItems();
    if (!pool[selectedPool]) selectedPool = -1;
    page.className = `${drawerOpen ? 'pool-open' : ''}${kind === 'time' ? ' ct-four-time' : ''}`;
    page.innerHTML = `<header class="ct-four-heading"><div><p>Circle of ${kind === 'infinity' ? 'Infinity' : 'Time'}</p><h1 tabindex="-1">Make Composition</h1></div><nav aria-label="Composition navigation"><button type="button" data-leave="explore">Explore</button><button type="button" data-leave="generate">Generate Material</button></nav></header>
      <div class="ct-four-toolbar"><button type="button" data-toggle-pool aria-expanded="${drawerOpen}" aria-controls="ct-four-pool">${drawerOpen ? 'Close pool' : 'Open pool'} <span>${pool.length}</span></button><div class="ct-four-playback"><button type="button" class="ct-four-primary" data-play-four ${![...lanes.melody, ...lanes.harmony].some(Boolean) || playing ? 'disabled' : ''}>▶ Play composition</button><button type="button" data-stop-four ${!playing ? 'disabled' : ''}>■ Stop</button>${`<label>Tempo <input type="number" data-tempo aria-label="Composition tempo in BPM" min="30" max="240" value="${tempo}" ${playing ? 'disabled' : ''}></label>`}</div><div class="ct-four-examine-wrap"><button type="button" data-examine aria-expanded="false" aria-controls="ct-four-examine">⌕ Examine</button><section id="ct-four-examine" class="ct-four-examine" role="region" aria-label="Examine this bar" hidden>${examineMarkup()}</section></div></div>
      ${builderMarkup()}<div class="ct-four-workspace"><aside id="ct-four-pool" ${drawerOpen ? '' : 'hidden'}><header><button type="button" data-close-pool aria-label="Close pool drawer">× Close</button><h2>Your pool</h2><p>Pick an idea. Tap a bar.</p></header><div class="ct-four-pool-items">${pool.length ? pool.map((item, index) => `<article class="ct-four-pool-item ${index === selectedPool ? 'selected' : ''}" draggable="true" data-drag-pool="${index}"><button type="button" class="ct-four-pick" data-pick="${index}" aria-pressed="${index === selectedPool}" title="${esc(label(api.snapshot(item)))}">${poolMarkup(item)}</button><div><button type="button" data-hear-pool="${index}" aria-label="Hear ${esc(label(api.snapshot(item)))}">▶ Hear</button><button type="button" data-remove-pool="${index}" aria-label="Remove ${esc(label(api.snapshot(item)))} from pool">Remove</button></div></article>`).join('') : '<div class="ct-four-empty-pool"><span aria-hidden="true">＋</span><p>Find something you like in Explore or Generate Material.</p><p>Tap <b>Add to Pool</b>. It will be waiting here.</p></div>'}</div></aside>
      <section class="ct-four-track" aria-label="${kind === 'time' ? 'Rhythm' : 'Melody and Harmony'} composition, four bars"><p class="ct-four-instruction">${kind === 'time' ? (selectedPool >= 0 ? 'Tap a bar to place this rhythm.' : 'Choose a rhythm from the pool. Place it in a bar.') : selectedPool >= 0 ? 'Selected idea is ready. Tap a Melody or Harmony bar.' : 'Pick or build an idea. Place a copy in either lane.'}</p>${tracksMarkup()}<footer><p role="status" data-composition-status>${kind === 'time' ? 'Rhythm' : 'Melody + Harmony'} · ${repeats.reduce((sum, count) => sum + count, 0)} bars in playback</p><button type="button" data-undo ${undo ? '' : 'disabled'}>Undo last edit</button><small data-save-state>${storageIssue || 'Saved in this browser'}</small></footer></section></div>`;
    bind();
    if (pinned) showExamine(true);
  }
  function showExamine(show) {
    const panel = page?.querySelector('#ct-four-examine');
    if (panel) panel.hidden = !show;
    page?.querySelector('[data-examine]')?.setAttribute('aria-expanded', String(show));
  }
  function stop() { run += 1; playing = false; api?.stop(); if (opened) render(); }
  async function play(list, indices, repeatValues = indices.map(index => repeats[index])) {
    stop(); const token = ++run; playing = true; render();
    const active = () => token === run;
    try {
      await api.play(copy(list), tempo, {
        active,
        bar(index, repetition = 0, repeatTotal = 1) {
          if (!active()) return;
          const pair = isPair(list[index]) ? list[index] : { [selectedLane]: list[index] };
          page?.querySelectorAll('[data-bar]').forEach(node => node.classList.toggle('sounding', Number(node.dataset.bar) === indices[index] && (kind === 'time' ? rhythmSources(list[index]).length > 0 : !!pair[node.dataset.lane])));
          const status = page?.querySelector('[data-composition-status]');
          if (status) status.textContent = `Playing bar ${indices[index] + 1} · pass ${repetition + 1} of ${repeatTotal}`;
        },
        done() { if (active()) { api.stop(); playing = false; render(); } },
        error(message) { if (active()) { stop(); announce(message); } }
      }, repeatValues);
    } catch (error) { if (active()) { stop(); announce('Sound could not start. Tap Play to retry. ' + (error.message || '')); } }
  }
  function place(index, lane) {
    stop(); selectedBar = index; selectedLane = lane;
    const item = poolItems()[selectedPool];
    if (item) { undo = copy({ lanes, repeats }); if (kind === 'time') { lanes.melody[index] = null; lanes.harmony[index] = copy(api.snapshot(item)); } else lanes[lane][index] = copy(api.snapshot(item)); save(); }
    render();
  }
  function appendDraft(index) {
    stop();
    if (draftMode === 'harmony') {
      if (draft.some(note => note.index === index)) draft = draft.filter(note => note.index !== index);
      else if (draft.length < 16) draft.push({ index, beats: 4 });
      else announce('Choose up to 16 pitches for one chord.');
    } else if (draft.reduce((sum, note) => sum + note.beats, 0) + draftBeats <= 4.000001) draft.push({ index, beats: draftBeats });
    else announce('That would exceed four beats. Choose a shorter duration or undo a note.');
    render();
  }
  function bindBuilder() {
    if (kind === 'time') return;
    page.querySelector('[data-toggle-builder]').onclick = () => { builderOpen = !builderOpen; render(); };
    const sourceSelect = page.querySelector('[data-build-source]');
    sourceSelect.value = draftSourceKey;
    if (sourceSelect.value !== draftSourceKey) sourceSelect.value = 'current';
    sourceSelect.onchange = () => {
      stop(); draftSourceKey = sourceSelect.value;
      draftSource = draftSourceKey === 'current' ? api.reference() : api.snapshot(poolItems()[Number(draftSourceKey)]);
      draft = []; render();
    };
    page.querySelector('[data-build-mode]').onchange = event => { stop(); draftMode = event.target.value; draft = []; render(); };
    page.querySelector('[data-build-beats]')?.addEventListener('change', event => { draftBeats = Number(event.target.value); });
    page.querySelectorAll('[data-build-pitch]').forEach(button => button.onclick = () => appendDraft(Number(button.dataset.buildPitch)));
    page.querySelector('[data-build-rest]')?.addEventListener('click', () => appendDraft(null));
    page.querySelector('[data-build-undo]').onclick = () => { stop(); draft.pop(); render(); };
    page.querySelector('[data-build-hear]').onclick = () => { const bar = buildIdea(kind, draftSource, draft, draftMode, tempo); play([previewBar(bar)], [selectedBar], [1]); };
    page.querySelector('[data-build-save]').onclick = () => {
      stop();
      if (poolItems().length >= 64) { announce('Remove an unused pool idea before saving another.'); return; }
      const bar = buildIdea(kind, draftSource, draft, draftMode, tempo);
      const item = { id: `built-${Date.now()}-${madePool.length}`, label: bar.label, bar };
      madePool.push(item); const saved = write(builtPoolKey(), madePool);
      selectedPool = poolItems().length - 1; selectedLane = draftMode;
      drawerOpen = true; builderOpen = false; render(); announce(saved ? 'Saved to Pool. Tap a Melody or Harmony bar to place a copy.' : 'Added to this open pool, but browser storage is unavailable. Keep the page open.');
    };
  }
  function bind() {
    page.onkeydown = event => { if (event.key === 'Escape') { builderOpen = false; pinned = false; render(); page.querySelector(kind === 'time' ? '[data-examine]' : '[data-toggle-builder]').focus(); showExamine(false); } };
    page.querySelectorAll('[data-leave]').forEach(button => button.onclick = () => leave(button.dataset.leave));
    page.querySelector('[data-toggle-pool]').onclick = () => { drawerOpen = !drawerOpen; render(); };
    page.querySelector('[data-play-four]').onclick = () => play(pairedBars(lanes), [0, 1, 2, 3]);
    page.querySelector('[data-stop-four]').onclick = stop;
    page.querySelector('[data-tempo]')?.addEventListener('change', event => { tempo = Math.max(30, Math.min(240, Number(event.target.value) || 96)); save(); render(); });
    const examine = page.querySelector('[data-examine]');
    examine.onclick = () => { pinned = !pinned; showExamine(pinned); };
    examine.onfocus = () => showExamine(true);
    const wrap = page.querySelector('.ct-four-examine-wrap');
    wrap.onpointerenter = event => { if (event.pointerType !== 'touch') showExamine(true); };
    wrap.onpointerleave = () => { if (!pinned) showExamine(false); };
    wrap.onfocusout = event => { if (!pinned && !wrap.contains(event.relatedTarget)) showExamine(false); };
    page.querySelector('[data-close-examine]').onclick = () => { pinned = false; examine.focus(); showExamine(false); };
    page.querySelectorAll('[data-pick]').forEach(button => button.onclick = () => { selectedPool = selectedPool === Number(button.dataset.pick) ? -1 : Number(button.dataset.pick); render(); });
    page.querySelectorAll('[data-place]').forEach(button => button.onclick = () => place(Number(button.dataset.place), button.dataset.lane));
    page.querySelectorAll('[data-hear-lane]').forEach(button => button.onclick = () => play(pairedBars(lanes, button.dataset.hearLane), [0,1,2,3]));
    page.querySelectorAll('[data-drag-pool]').forEach(node => node.ondragstart = event => { event.dataTransfer.setData('application/x-toolbox-pool', node.dataset.dragPool); event.dataTransfer.effectAllowed = 'copy'; });
    page.querySelectorAll('[data-bar]').forEach(node => {
      node.ondragover = event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; };
      node.ondrop = event => { event.preventDefault(); const value = event.dataTransfer.getData('application/x-toolbox-pool'); if (!/^\d+$/.test(value)) return; selectedPool = Number(value); place(Number(node.dataset.bar), node.dataset.lane); };
    });
    page.querySelectorAll('[data-remove-pool]').forEach(button => button.onclick = () => {
      stop(); const index = Number(button.dataset.removePool), nativeCount = api.pool().length;
      if (index < nativeCount) api.remove(index);
      else { madePool.splice(index - nativeCount, 1); write(builtPoolKey(), madePool); }
      selectedPool = -1; render();
    });
    page.querySelectorAll('[data-hear-pool]').forEach(button => button.onclick = () => { const item = poolItems()[Number(button.dataset.hearPool)]; if (item) play([previewBar(api.snapshot(item))], [selectedBar], [1]); });
    page.querySelectorAll('[data-hear-bar]').forEach(button => button.onclick = () => { const index = Number(button.dataset.hearBar), lane = button.dataset.lane; selectedLane = lane; selectedBar = index; play([kind === 'time' ? rhythmBar(lanes, index) : { [lane]: lanes[lane][index] }], [index]); });
    page.querySelectorAll('[data-repeat-bar]').forEach(select => select.onchange = () => {
      const index = Number(select.dataset.repeatBar), value = repeatCount(select.value);
      stop(); undo = copy({ lanes, repeats }); repeats[index] = value; save(); render();
    });
    page.querySelectorAll('[data-clear-bar]').forEach(button => button.onclick = () => { stop(); undo = copy({ lanes, repeats }); selectedBar = Number(button.dataset.clearBar); selectedLane = button.dataset.lane; if (kind === 'time') { lanes.melody[selectedBar] = null; lanes.harmony[selectedBar] = null; } else lanes[selectedLane][selectedBar] = null; save(); render(); });
    page.querySelector('[data-undo]').onclick = () => { if (!undo) return; stop(); ({ lanes, repeats } = undo); undo = null; save(); render(); };
    page.querySelector('[data-close-pool]').onclick = () => { drawerOpen = false; render(); page.querySelector('[data-toggle-pool]').focus(); };
    bindBuilder();
  }
  function open() {
    if (!api || opened) return;
    if (!page && host.matchMedia?.('(max-width:800px), (max-height:600px)').matches) drawerOpen = false;
    if (!draft.length) { draftSource = null; draftSourceKey = 'current'; }
    api.stop(); opened = true;
    document.body.classList.add('ct-four-open');
    if (location.hash !== '#compose') location.hash = 'compose';
    render(); page.querySelector('h1').focus();
  }
  function leave(stage = 'explore') {
    stop(); opened = false; pinned = false;
    if (page) page.hidden = true;
    document.body.classList.remove('ct-four-open');
    history.replaceState(null, '', location.pathname + location.search + (stage === 'generate' ? '#generate' : ''));
    api?.navigate(stage);
  }
  function register(appKind, bridge) {
    const first = !api;
    api = bridge; kind = appKind;
    if (first) {
      const validComposition = value => value === null || (record(value) && (value.lanes === undefined || record(value.lanes)) && [value.bars, value.lanes?.melody, value.lanes?.harmony].every(lane => lane === undefined || (boundedArray(lane, 4) && lane.every(bar => bar === null || validBar(bar)))));
      const saved = read(storageKey(), null, validComposition) ?? read(legacyStorageKey(), {}, validComposition);
      ({ lanes, repeats, tempo } = compositionState(saved));
      if (kind === 'time') selectedLane = 'rhythm';
      const savedPool = read(builtPoolKey(), [], value => boundedArray(value, 1024) && value.every(item => record(item) && validBar(item.bar)));
      madePool = Array.isArray(savedPool) ? savedPool.filter(item => item?.bar?.tones?.length) : [];
      if (location.hash === '#compose') setTimeout(open, 0);
    }
    if (opened && !playing) render();
  }
  function audition(item) { openItem(item); return play([previewBar(api.snapshot(item))], [selectedBar], [1]); }
  function openItem(item) { selectedPool = poolItems().findIndex(candidate => candidate.id === item.id); open(); }
  host.CTFourBars = { ...core, register, open, openItem, audition, leave, read, write, announce, isOpen: () => opened };
  document.addEventListener('click', event => {
    if (event.target.closest('[data-four-open]')) { event.preventDefault(); open(); }
    if (event.target.closest('[data-four-add]')) { event.preventDefault(); api?.capture(); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) { pinned = false; showExamine(false); } });
  window.addEventListener('hashchange', () => { if (location.hash === '#compose') open(); else if (opened) leave(location.hash === '#generate' ? 'generate' : 'explore'); });
  window.addEventListener('pagehide', () => { run += 1; playing = false; api?.stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });
})(typeof window !== 'undefined' ? window : globalThis);
