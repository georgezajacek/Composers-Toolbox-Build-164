(() => {
  let feedback = null;
  let feedbackTimer = 0;
  let generatorFeedback = null;
  let generatorFeedbackTimer = 0;

  const signatureFor = material => `${material.kind}:${material.pcs.join(',')}:${material.midis.join(',')}`;

  function paintFeedback(button) {
    if (!button || !feedback || Date.now() >= feedback.until) return;
    button.classList.add('is-confirmed');
    button.textContent = feedback.text;
    button.setAttribute('aria-label', feedback.label);
  }

  function showFeedback(text, label) {
    feedback = { text, label, until: Date.now() + 2200 };
    window.clearTimeout(feedbackTimer);
    paintFeedback(document.querySelector('.suite-stage-1 [data-explore-chord-pool]'));
    feedbackTimer = window.setTimeout(() => {
      feedback = null;
      const button = document.querySelector('.suite-stage-1 [data-explore-chord-pool]');
      if (!button) return;
      button.classList.remove('is-confirmed');
      button.textContent = 'ADD TO POOL';
      button.setAttribute('aria-label', 'Add selected chord to Pool');
    }, 2200);
  }

  function addSelectedChord(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof h !== 'object' || typeof Pi !== 'function' || typeof w !== 'object') return;

    const selected = h.get().selectedChord;
    if (!selected || !Array.isArray(selected.pcs) || !selected.pcs.length) {
      showFeedback('SELECT CHORD', 'Select a chord before adding it to Pool');
      h.setMessage('Select a chord first');
      return;
    }

    const pcs = [...selected.pcs];
    const material = {
      id: 'explore-chord',
      kind: 'chord',
      label: selected.label || (typeof yt === 'function' ? yt(pcs) : 'Selected chord'),
      pcs,
      midis: ctThreesChordMidis(pcs),
      inversion: ctThreesCurrentScale().voicingInversion || 0,
      voicing: 'traditional',
      sourcePcs: [...pcs],
      chordRoot: pcs[0],
    };
    const signature = signatureFor(material);
    const alreadySaved = Array.isArray(j.saved) && j.saved.some(item => signatureFor(item) === signature);

    showFeedback(
      alreadySaved ? 'IN POOL ✓' : 'ADDED ✓',
      alreadySaved ? 'Selected chord is already in the Pool' : 'Selected chord added to Pool'
    );
    if (alreadySaved) h.setMessage('That chord is already in Pool');
    else Pi(material);
    if (navigator.vibrate) navigator.vibrate(35);
  }

  function paintGeneratorFeedback(button) {
    if (!button || !generatorFeedback || Date.now() >= generatorFeedback.until) return;
    button.classList.add('is-confirmed');
    button.textContent = generatorFeedback.text;
    button.setAttribute('aria-label', generatorFeedback.label);
  }

  function showGeneratorFeedback(text, label) {
    generatorFeedback = { text, label, until: Date.now() + 2200 };
    window.clearTimeout(generatorFeedbackTimer);
    paintGeneratorFeedback(document.querySelector('.suite-stage-2 [data-generate-chord-pool]'));
    generatorFeedbackTimer = window.setTimeout(() => {
      generatorFeedback = null;
      const button = document.querySelector('.suite-stage-2 [data-generate-chord-pool]');
      if (!button) return;
      button.classList.remove('is-confirmed');
      button.textContent = 'ADD TO POOL';
      button.setAttribute('aria-label', 'Add selected generated chord to Pool');
    }, 2200);
  }

  function addGeneratedChord(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof h !== 'object' || typeof Pi !== 'function' || typeof w !== 'object') return;

    const selected = h.get().selectedChord;
    if (!selected || !Array.isArray(selected.pcs) || !selected.pcs.length) {
      showGeneratorFeedback('SELECT CHORD', 'Select a generated chord before adding it to Pool');
      h.setMessage('Select a generated chord first');
      return;
    }

    const pcs = [...selected.pcs];
    const material = {
      id: 'generated-chord',
      kind: 'chord',
      preserveRegister: true,
      label: selected.label || (typeof yt === 'function' ? yt(pcs) : 'Generated chord'),
      pcs,
      midis: ctThreesChordMidis(pcs),
      inversion: ctThreesCurrentScale().voicingInversion || 0,
      voicing: 'traditional',
      sourcePcs: [...pcs],
      chordRoot: pcs[0],
    };
    const signature = signatureFor(material);
    const alreadySaved = Array.isArray(j.saved) && j.saved.some(item => signatureFor(item) === signature);

    showGeneratorFeedback(
      alreadySaved ? 'IN POOL ✓' : 'ADDED ✓',
      alreadySaved ? 'Generated chord is already in the Pool' : 'Generated chord added to Pool'
    );
    if (alreadySaved) h.setMessage('That chord is already in Pool');
    else Pi(material);
    if (navigator.vibrate) navigator.vibrate(35);
  }

  function sync() {
    const playback = document.querySelector('.suite-stage-1 .educational-harmony-head .transform-chord-playback');
    if (!playback || playback.querySelector('[data-explore-chord-pool]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.exploreChordPool = 'true';
    button.textContent = 'ADD TO POOL';
    button.setAttribute('aria-label', 'Add selected chord to Pool');
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', addSelectedChord);
    paintFeedback(button);
    playback.appendChild(button);

    syncGenerator();
  }

  function syncGenerator() {
    const playback = document.querySelector('.suite-stage-2 .transform-chord-reveal-head > .page2-transform-playback');
    if (!playback || playback.querySelector('[data-generate-chord-pool]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.generateChordPool = 'true';
    button.textContent = 'ADD TO POOL';
    button.setAttribute('aria-label', 'Add selected generated chord to Pool');
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', addGeneratedChord);
    paintGeneratorFeedback(button);
    playback.appendChild(button);
  }

  const syncAll = () => {
    sync();
    syncGenerator();
  };

  new MutationObserver(syncAll).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', syncAll);
  syncAll();
})();
