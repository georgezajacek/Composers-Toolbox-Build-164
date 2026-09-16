(() => {
  const nativePool = typeof mt === 'function' ? mt : null;
  let poolFeedback = null;
  let poolFeedbackTimer = 0;

  function asFixedScale(scale, id, prefix) {
    const material = _(scale);
    return {
      id,
      kind: 'scale',
      label: `${prefix} · ${scale.label}`,
      pcs: [...material.pcs],
      midis: Wt(material.pcs, scale.root),
      fixed: true,
    };
  }

  // Reference and Reference Mode are givens: always in the composition Pool,
  // fixed in place, and never treated as the editable Generate selection.
  if (nativePool) {
    mt = (state) => [
      asFixedScale(state.reference, 'reference-scale', 'Reference'),
      asFixedScale(state.source, 'reference-mode-scale', 'Reference Mode'),
      ...nativePool(state),
    ];
  }

  function paintPoolFeedback(button) {
    if (!button || !poolFeedback || Date.now() >= poolFeedback.until) return;
    button.classList.add('is-confirmed');
    button.textContent = poolFeedback.text;
    button.setAttribute('aria-label', poolFeedback.label);
  }

  function showPoolFeedback(text, label) {
    poolFeedback = { text, label, until: Date.now() + 2200 };
    window.clearTimeout(poolFeedbackTimer);
    paintPoolFeedback(document.querySelector('.suite-stage-2 [data-ct-generate-pool]'));
    poolFeedbackTimer = window.setTimeout(() => {
      poolFeedback = null;
      const currentButton = document.querySelector('.suite-stage-2 [data-ct-generate-pool]');
      if (!currentButton) return;
      currentButton.classList.remove('is-confirmed');
      currentButton.textContent = 'ADD TO POOL';
      currentButton.setAttribute('aria-label', 'Add generated material to Pool');
    }, 2200);
  }

  function saveGeneratedMaterial(event) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof h !== 'object' || typeof tr !== 'function' || typeof Pi !== 'function') return;
    const button = event.currentTarget;
    const state = h.get();
    const material = tr(state.working, 'generated-material-draft');
    const signature = `${material.kind}:${material.pcs.join(',')}:${material.midis.join(',')}`;
    const alreadySaved = Array.isArray(j.saved) && j.saved.some((item) =>
      `${item.kind}:${item.pcs.join(',')}:${item.midis.join(',')}` === signature
    );

    showPoolFeedback(
      alreadySaved ? 'IN POOL ✓' : 'ADDED ✓',
      alreadySaved ? 'Generated material is already in the Pool' : 'Generated material added to Pool'
    );

    if (alreadySaved) {
      h.setMessage('Generated material is already in the Pool');
    } else {
      Pi(material);
    }

    if (navigator.vibrate) navigator.vibrate(35);
  }

  function lockReferenceCard(card) {
    card.classList.remove('active');
    card.removeAttribute('aria-disabled');
    card.removeAttribute('aria-pressed');
    card.setAttribute('role','button');card.setAttribute('tabindex','0');
    card.querySelector('[data-ct-in-pool]')?.remove();
    const role=card.dataset.roleCompare;
    card.setAttribute('aria-label','Play '+(role==='reference'?'Reference':'Reference Mode')+' scale');
    if(card.dataset.ctReferenceAudition)return;
    card.dataset.ctReferenceAudition='true';
    const play=event=>{
      if(event.target.closest('.ct-inversion-picker'))return;
      if(event.type==='keydown'&&event.key!=='Enter'&&event.key!==' ')return;
      event.preventDefault();event.stopImmediatePropagation();
      const scale=role==='reference'?h.get().reference:h.get().source;
      N();W(scale);
    };
    card.addEventListener('click',play,true);card.addEventListener('keydown',play,true);
  }

  function sync() {
    const stage = document.querySelector('.suite-stage-2');
    if (!stage) return;

    stage.querySelectorAll('[data-role-compare="reference"], [data-role-compare="source"]')
      .forEach(lockReferenceCard);

    const generated = stage.querySelector('[data-role-compare="working"]');
    if (generated) {
      generated.classList.add('active');
      generated.setAttribute('aria-pressed', 'true');
    }

    const circle = stage.querySelector('.work-circle');
    if (!circle || circle.querySelector('[data-ct-generate-pool]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.ctGeneratePool = 'true';
    button.textContent = 'ADD TO POOL';
    button.setAttribute('aria-label', 'Add generated material to Pool');
    button.setAttribute('aria-live', 'polite');
    button.addEventListener('click', saveGeneratedMaterial);
    paintPoolFeedback(button);
    circle.appendChild(button);
  }

  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', sync);
  sync();
})();
