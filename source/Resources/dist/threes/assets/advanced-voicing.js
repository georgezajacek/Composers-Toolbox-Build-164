(() => {
  const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

  const mod = (value) => ((Number(value) % 12) + 12) % 12;
  const unique = (values) => [...new Set(values.map(mod))];

  const style = document.createElement('style');
  style.textContent = `
    .compose-advanced-voicing {
      display: grid;
      gap: 7px;
      margin-top: 8px;
      padding: 8px;
      border: 1px solid #343d47;
      border-radius: 9px;
      background: #0b0f14;
    }
    .compose-advanced-group {
      display: grid;
      grid-template-columns: minmax(118px,.72fr) minmax(0,1.28fr);
      gap: 7px;
      align-items: center;
    }
    .compose-advanced-group > strong {
      color: #e8cb78;
      font-size: 8px;
      letter-spacing: .11em;
      line-height: 1.25;
    }
    .compose-advanced-controls {
      display: grid;
      grid-template-columns: repeat(3,minmax(0,1fr));
      gap: 4px;
    }
    .compose-advanced-controls.two {
      grid-template-columns: auto minmax(0,1fr);
    }
    .compose-advanced-controls button,
    .compose-advanced-controls select {
      min-width: 0;
      min-height: 30px;
      padding: 4px 6px;
      border: 1px solid #46515d;
      border-radius: 6px;
      background: #151b22;
      color: #f4f1ea;
      font-size: 8px;
      font-weight: 900;
    }
    .compose-advanced-controls button.active {
      border-color: #e8cb78;
      background: #2a230f;
      color: #f4d984;
    }
    .compose-advanced-controls select:disabled {
      opacity: .42;
    }
    .compose-chromatic-bank {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 3px;
    }
    .compose-chromatic-bank button {
      min-width: 0;
      min-height: 30px;
      padding: 3px 1px;
      border: 1px solid #46515d;
      border-radius: 6px;
      background: #151b22;
      color: #f4f1ea;
      font-size: 8px;
      font-weight: 900;
    }
    .compose-chromatic-bank button.present {
      border-color: #527267;
      background: #162820;
      color: #bfe7d2;
    }
    .compose-chromatic-bank button.active {
      border-color: #e8cb78;
      background: #5a4a1f;
      color: #fff7d6;
      box-shadow: 0 0 0 1px #8f7740;
    }
    .compose-advanced-result {
      display: grid;
      gap: 2px;
      padding-top: 6px;
      border-top: 1px solid #29313a;
    }
    .compose-advanced-result small {
      color: #929ba5;
      font-size: 7px;
      font-weight: 950;
      letter-spacing: .12em;
    }
    .compose-advanced-result strong {
      color: #f4f1ea;
      font-size: 11px;
      line-height: 1.25;
    }
    .compose-advanced-result span {
      color: #b8c0ca;
      font-size: 8px;
      line-height: 1.3;
    }
    @media (max-width: 760px) {
      .compose-advanced-group { grid-template-columns: 1fr; }
      .compose-chromatic-bank { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    }
  `;
  document.head.append(style);

  function ensureState() {
    if (typeof V !== 'object' || !V) return false;
    if (!['tertian', 'quartal', 'quintal'].includes(V.advancedStacking)) {
      V.advancedStacking = 'tertian';
    }
    if (!['none', 'sus2', 'sus4', 'sus4(add2)'].includes(V.advancedSuspension)) {
      V.advancedSuspension = V.quality === 'Suspended 2' ? 'sus2' : V.quality === 'Suspended 4' ? 'sus4' : 'none';
    }
    if (!['none', 'major', 'minor'].includes(V.advancedUpperType)) {
      V.advancedUpperType = 'none';
    }
    if (!Number.isInteger(V.advancedUpperRoot)) V.advancedUpperRoot = mod(V.root + 2);
    if (!Array.isArray(V.advancedAddedPcs)) V.advancedAddedPcs = [];
    V.advancedAddedPcs = unique(V.advancedAddedPcs.filter(Number.isFinite));
    if (typeof V.advancedSlashOn !== 'boolean') V.advancedSlashOn = false;
    if (!Number.isInteger(V.advancedSlashBass)) V.advancedSlashBass = mod(V.root + 7);
    return true;
  }

  function midiAbove(pc, floor) {
    let midi = 60 + mod(pc);
    while (midi <= floor) midi += 12;
    return midi;
  }

  function buildAdvancedChord(voicing = V.voicing) {
    if (!ensureState()) return null;

    const nativeChord = Ei();
    let chordPcs = [...nativeChord.pcs];
    let chordLabel = nativeChord.label;

    if (V.advancedStacking !== 'tertian') {
      const count = V.extent===3?3:V.extent===7?4:V.extent===9?5:V.extent===11?6:7;
      const step = V.advancedStacking === 'quartal' ? 5 : 7;
      chordPcs = Array.from({length:count},(_,i)=>mod(V.root+i*step));
      if(V.flat9 && count>=5)chordPcs[4]=mod(V.root+1);
      if(V.sharp11 && count>=6)chordPcs[5]=mod(V.root+6);
      if(V.flat13 && count>=7)chordPcs[6]=mod(V.root+8);
      chordPcs=unique(chordPcs);
      chordLabel = `${NOTE_NAMES[V.root]} ${V.advancedStacking}${V.extent===3?'':' '+V.extent}${V.flat9?' ♭9':''}${V.sharp11?' ♯11':''}${V.flat13?' ♭13':''}`;
    }

    if (V.advancedSuspension !== 'none') {
      const suspended = V.advancedSuspension === 'sus2' ? [2] : V.advancedSuspension === 'sus4' ? [5] : [2, 5];
      chordPcs = chordPcs.filter(pc => {
        const interval = mod(pc - V.root);
        return interval !== 3 && interval !== 4 &&
          !(V.quality === 'Suspended 2' && interval === 2) &&
          !(V.quality === 'Suspended 4' && interval === 5);
      });
      chordPcs = unique([...chordPcs, ...suspended.map(n => V.root + n)]);
      const majorSeventh = V.extent !== 3 && chordPcs.includes(mod(V.root + 11));
      chordLabel = `${NOTE_NAMES[V.root]}${majorSeventh ? 'maj' : ''}${V.extent === 3 ? '' : V.extent}${V.advancedSuspension}${V.flat9 ? ' ♭9' : ''}${V.sharp11 ? ' ♯11' : ''}${V.flat13 ? ' ♭13' : ''}${V.advancedStacking === 'tertian' ? '' : ' · ' + V.advancedStacking}`;
    }
    let midis = w.traditionalVoicing(chordPcs, voicing, V.omit5);
    if (V.advancedSlashOn && midis.length) {
      // Match the selected scale's reference position, then ascend by degree.
      // Use the actual root voice so drop voicings retain their intervals.
      const referenceRoot = h.get().reference.root;
      const tonic = Number.isInteger(V.advancedRegisterTonic) ? V.advancedRegisterTonic : V.root;
      let tonicMidi = w.middleMidi(referenceRoot, 60) + mod(tonic - referenceRoot);
      const droppedVoice = chordPcs.length > 3 && ['drop2', 'drop3', 'drop24'].includes(voicing) ? 12 : 0;
      // Lift the scale as a unit; lifting individual degrees creates another wrap.
      while (tonicMidi - droppedVoice <= 48 + mod(V.advancedSlashBass)) tonicMidi += 12;
      const rootMidi = tonicMidi + mod(V.root - tonic);
      const voicedRoot = midis.find(midi => mod(midi) === mod(V.root));
      if (Number.isFinite(voicedRoot)) midis = midis.map(midi => midi + rootMidi - voicedRoot);
    }
    const details = [];

    if (V.advancedUpperType !== 'none') {
      const intervals = V.advancedUpperType === 'major' ? [0, 4, 7] : [0, 3, 7];
      const upperPcs = intervals.map((interval) => mod(V.advancedUpperRoot + interval));
      let floor = midis.length ? Math.max(...midis) : 59;
      const upperMidis = upperPcs.map((pc) => {
        const midi = midiAbove(pc, floor);
        floor = midi;
        return midi;
      });
      chordPcs = unique([...chordPcs, ...upperPcs]);
      midis = [...midis, ...upperMidis];
      const upperName = `${NOTE_NAMES[V.advancedUpperRoot]} ${V.advancedUpperType}`;
      chordLabel += ` + ${upperName} upper triad`;
      details.push(`${upperName} triad above`);
    }

    const basePcs = unique(midis);
    const addedPcs = V.advancedAddedPcs.filter((pc) => !basePcs.includes(mod(pc))).map(mod);
    if (addedPcs.length) {
      let floor = midis.length ? Math.max(...midis) : 59;
      const addedMidis = addedPcs.map((pc) => {
        const midi = midiAbove(pc, floor);
        floor = midi;
        return midi;
      });
      chordPcs = unique([...chordPcs, ...addedPcs]);
      midis = [...midis, ...addedMidis];
      details.push(`Added ${addedPcs.map((pc) => NOTE_NAMES[pc]).join(' · ')}`);
    }

    if (V.advancedSlashOn) {
      const bassPc = mod(V.advancedSlashBass);
      chordPcs = unique([...chordPcs, bassPc]);
      // Keep LOW BASS in C3-B3, independent of the chord's average pitch.
      const bassMidi = 48 + bassPc;
      const lowest = midis.length ? Math.min(...midis) : bassMidi + 1;
      const lift = Math.max(0, Math.floor((bassMidi - lowest) / 12) + 1) * 12;
      if (lift) midis = midis.map(midi => midi + lift);
      midis = [bassMidi, ...midis.filter((midi) => midi !== bassMidi)].sort((a, b) => a - b);
      if (bassPc !== mod(V.root)) chordLabel += ` / ${NOTE_NAMES[bassPc]}`;
      details.push(`${NOTE_NAMES[bassPc]} in the low bass`);
    }

    midis = [...new Set(midis)].filter((midi) => midi >= 0 && midi <= 127).sort((a, b) => a - b);
    if (!V.advancedSlashOn) midis = ctThreesStartingRegister(midis, chordPcs.length);
    const inversionBase = [...midis];
    const inversionOrder = ctThreesInversionOrder({inversionBase, sourcePcs:chordPcs});
    midis = ctThreesInvertVoicing(midis, inversionOrder, V.inversion);
    const signature = [
      V.inversion || 0,
      V.advancedStacking,
      V.advancedSuspension,
      V.advancedUpperType,
      mod(V.advancedUpperRoot),
      [...V.advancedAddedPcs].sort((a, b) => a - b).join(','),
      V.advancedSlashOn ? mod(V.advancedSlashBass) : 'off',
      V.root,
      V.quality,
      V.extent,
      voicing,
      V.flat9,
      V.sharp11,
      V.flat13,
      V.omit5,
    ].join('|');

    return {
      id: 'draft',
      kind: 'chord',
      label: chordLabel,
      pcs: U(chordPcs, V.root),
      midis,
      inversion: ctInversions.index(V.inversion, inversionOrder.length),
      inversionOrder,
      inversionBase,
      voicing,
      sourcePcs: U(chordPcs, V.root),
      chordRoot: mod(V.root),
      preserveRegister: true,
      advancedSignature: signature,
      editorState: JSON.parse(JSON.stringify(V)),
      playback: Tt(),
      advancedDetails: details.join(' · '),
      advancedBasePcs: basePcs,
    };
  }

  window.ctBuildAdvancedChord = buildAdvancedChord;

  function advancedIsActive() {
    return ensureState() && (
      V.advancedStacking !== 'tertian' ||
      V.advancedSuspension !== 'none' ||
      V.advancedUpperType !== 'none' ||
      V.advancedAddedPcs.length > 0 ||
      V.advancedSlashOn
    );
  }

  function applyAdvanced({ hear = false } = {}) {
    const chord = buildAdvancedChord();
    if (!chord) return;
    ctRememberChordEditor();
    ne = chord;
    ctComp().draftChord = chord;
    ctCompSave();
    de = 'draft';
    Se = 'chord';
    Z = V.voicing;
    fe = 'voicing';
    q();
    if (hear) window.setTimeout(() => ve(chord), 0);
  }

  function optionMarkup(selected) {
    return NOTE_NAMES.map((name, pc) =>
      `<option value="${pc}" ${pc === mod(selected) ? 'selected' : ''}>${name}</option>`
    ).join('');
  }

  function renderControls(panel) {
    if (!ensureState() || panel.querySelector('.ct-advanced-rails')) return;
    const host = panel.querySelector('.ct-voicing-selector');
    if (!host) return;
    const section = document.createElement('div');
    section.className = 'ct-advanced-rails';
    const option = (value, label, selected=false) => `<option value="${value}" ${selected?'selected':''}>${label}</option>`;
    const triads = (prefix='') => NOTE_NAMES.map((name, pc) => ['major','minor'].map(type => option(`${prefix}${pc}:${type}`,`${name} ${type}`,prefix==='' && V.advancedUpperType===type && V.advancedUpperRoot===pc)).join('')).join('');
    const candidates=ctUpperCandidates(V);
    const commonUpperOptions=candidates.map(([offset,type])=>{
      const pc=mod(V.root+offset);
      return option(`${pc}:${type}`,`${NOTE_NAMES[pc]} ${type}`,V.advancedUpperType===type&&V.advancedUpperRoot===pc);
    }).join('');
    section.innerHTML = `
      <label>VOICING STACK<select data-rail-stack>${[['tertian','Thirds'],['quartal','Fourths'],['quintal','Fifths']].map(([value,label])=>option(value,label,V.advancedStacking===value)).join('')}</select></label>
      <label>SUSPENSION<select data-rail-suspension aria-label="Suspension">${[['none','None'],['sus2','sus2'],['sus4','sus4'],['sus4(add2)','sus4(add2)']].map(([value,label])=>option(value,label,V.advancedSuspension===value)).join('')}</select></label>
      <label>EXTENSIONS / ALTERATIONS<select data-rail-extensions><option value="">${V.extent===3?'Triad':V.extent}${V.flat9?' · ♭9':''}${V.sharp11?' · ♯11':''}${V.flat13?' · ♭13':''}${V.omit5?' · omit 5':''}</option><optgroup label="Extensions">${[3,7,9,11,13].map(size=>option(`extent:${size}`,size===3?'Triad':String(size))).join('')}</optgroup><optgroup label="Toggle alterations">${[['flat9','♭9'],['sharp11','♯11'],['flat13','♭13'],['omit5','Omit 5']].map(([key,label])=>option(key,`${V[key]?'✓ ':''}${label}`)).join('')}</optgroup></select></label>
      <label>UPPER STRUCTURE TRIAD<select data-rail-upper>${option('none','None',V.advancedUpperType==='none')}<optgroup label='Suggested for ${NOTE_NAMES[V.root]} ${V.quality}'>${commonUpperOptions}</optgroup><optgroup label='All major / minor triads'>${triads()}</optgroup></select></label>
      <label>CHROMATIC TONE / CHORD<select data-rail-chromatic><option value="">Add or remove…</option><optgroup label="Individual tones">${NOTE_NAMES.map((name,pc)=>option(`tone:${pc}`,`${V.advancedAddedPcs.includes(pc)?'Remove':'Add'} ${name}`)).join('')}</optgroup><optgroup label="Add chord">${triads('chord:')}</optgroup><option value="clear">Clear added tones</option></select></label>
      <label>LOW BASS<select data-rail-bass>${option('none','None',!V.advancedSlashOn)}${NOTE_NAMES.map((name,pc)=>option(String(pc),name,V.advancedSlashOn&&V.advancedSlashBass===pc)).join('')}</select></label>`;
    host.prepend(section);
    section.addEventListener('change', event => {
      const target=event.target, value=target.value;
      if(target.matches('[data-rail-stack]')) V.advancedStacking=value;
      else if(target.matches('[data-rail-suspension]')) {
        V.advancedSuspension=value;
        if(value==='none' && ['Suspended 2','Suspended 4'].includes(V.quality)) V.quality='Major';
      }
      else if(target.matches('[data-rail-upper]')) { const [root,type]=value.split(':');V.advancedUpperType=value==='none'?'none':type;if(type)V.advancedUpperRoot=Number(root); }
      else if(target.matches('[data-rail-bass]')) {V.advancedSlashOn=value!=='none';if(V.advancedSlashOn)V.advancedSlashBass=Number(value);}
      else if(target.matches('[data-rail-chromatic]')) {
        if(!value)return;
        if(value==='clear')V.advancedAddedPcs=[];
        else {const [kind,root,type]=value.split(':');const pc=Number(root);
          if(kind==='tone')V.advancedAddedPcs=V.advancedAddedPcs.includes(pc)?V.advancedAddedPcs.filter(p=>p!==pc):[...V.advancedAddedPcs,pc];
          else V.advancedAddedPcs=unique([...V.advancedAddedPcs,...[0,type==='minor'?3:4,7].map(n=>pc+n)]);
        }
      } else if(target.matches('[data-rail-extensions]')) {
        if(!value)return;
        if(value.startsWith('extent:'))V.extent=Number(value.split(':')[1]);else {V[value]=!V[value];if(V[value])V.extent=Math.max(V.extent,({flat9:9,sharp11:11,flat13:13})[value]||3);}
      } else return;
      applyAdvanced({hear:true});
    });
  }
  function sync() {
    if(typeof V==='undefined'||typeof q!=='function')return;
    const panel=document.querySelector('.compose-voicing-panel');
    if(panel)renderControls(panel);
  }

  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', sync);
  sync();
})();
