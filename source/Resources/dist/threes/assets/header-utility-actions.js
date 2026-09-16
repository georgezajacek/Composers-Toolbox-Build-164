(() => {
  const adjustStyles = document.createElement('style');
  adjustStyles.textContent = `
    .compose-voicing-meta > [data-ct-adjust-proxy="chord"] {
      width: 100%;
      min-height: 34px;
      margin-top: 2px;
      border: 1px solid #8f7740;
      border-radius: 7px;
      background: #201b0e;
      color: #f4d984;
      font-size: 9px;
      font-weight: 950;
      letter-spacing: .08em;
    }
    .compose-voicing-adjust-hint {
      display: block;
      margin-top: -2px;
      color: #929ba5;
      font-size: 7px;
      font-weight: 850;
      letter-spacing: .05em;
      line-height: 1.25;
      text-align: center;
    }
    .compose-motif-scale-line > [data-ct-adjust-proxy="scale"] {
      flex: 0 0 auto;
      min-height: 28px;
      margin-left: 2px;
      padding: 4px 8px;
      border: 1px solid #8f7740;
      border-radius: 6px;
      background: #201b0e;
      color: #f4d984;
      font-size: 8px;
      font-weight: 950;
      letter-spacing: .07em;
    }
    .compose-adjust-purpose {
      margin: -1px 0 7px;
      color: #aeb5bf;
      font-size: 9px;
      line-height: 1.35;
    }
    .compose-adjust-group-label {
      display: block;
      margin: 8px 0 4px;
      color: #e8cb78;
      font-size: 8px;
      font-weight: 950;
      letter-spacing: .12em;
    }
    .top-actions > .ct-compose-top-action {
      min-height: 26px !important;
      height: 26px !important;
      padding: 2px 6px !important;
      border-radius: 7px !important;
      font-size: 8px !important;
      letter-spacing: .02em !important;
    }
    .ct-later-tools {
      position: relative;
      flex: 0 0 auto;
    }
    .ct-later-tools > button {
      display: flex;
      align-items: center;
      min-height: 26px;
      padding: 2px 7px;
      border: 1px solid #59616b;
      border-radius: 7px;
      background: #11151b;
      color: #f4f1ea;
      cursor: not-allowed;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: .04em;
      opacity: .72;
      white-space: nowrap;
    }
    .ct-later-tools > button::after {
      content: ' 🔒';
      margin-left: 4px;
      color: #d8c7a1;
    }
    .ct-later-tools-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 5px);
      z-index: 90;
      display: none;
      gap: 4px;
      width: max-content;
      min-width: 190px;
      padding: 6px;
      border: 1px solid #59616b;
      border-radius: 9px;
      background: #0b0e12;
      box-shadow: 0 12px 30px #000b;
    }
    .ct-later-tools-menu > button {
      width: 100%;
      min-height: 30px !important;
      padding: 4px 8px !important;
      text-align: left;
      font-size: 9px !important;
      white-space: nowrap;
    }
    @media (min-width: 1000px) {
      .suite-stage-3 .rebuild-topbar {
        margin-bottom: 1px !important;
        padding-top: 0 !important;
        padding-bottom: 3px !important;
      }
      .suite-stage-3 .rebuild-topbar > div:first-child {
        top: 0 !important;
      }
      .suite-stage-3 .rebuild-topbar > div:first-child > .suite-workflow {
        margin-top: 1px !important;
      }
      .suite-stage-3 .compose-play-row {
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 6px !important;
      }
      .suite-stage-3 .compose-play-row > .compose-stage {
        display: none !important;
      }
      .suite-stage-3 .compose-workspace {
        gap: 6px !important;
      }
      .suite-stage-3 .compose-adjust {
        width: 100%;
      }
      .suite-stage-3 .compose-adjust > header nav {
        align-items: center;
      }
      .suite-stage-3 .compose-adjust [data-compose-hear].ct-current-audition {
        min-height: 30px !important;
        padding: 4px 9px !important;
        border-color: #8f7740 !important;
        background: #201b0e !important;
        color: #f4d984 !important;
        white-space: nowrap;
      }
    }
  `;
  document.head.appendChild(adjustStyles);

  function sync() {
    const topbar = document.querySelector('.rebuild-topbar');
    const titleBlock = topbar?.firstElementChild;
    const title = titleBlock?.querySelector('h1');
    if (!topbar || !titleBlock || !title) return;

    const workflow = topbar.querySelector('.suite-workflow');
    if (workflow && workflow.parentElement !== titleBlock) {
      title.insertAdjacentElement('afterend', workflow);
    }

    const actions = topbar.querySelector('.top-actions');
    const prompt = topbar.querySelector('.suite-stage-prompt');
    if (actions && prompt && prompt.parentElement !== actions) {
      actions.prepend(prompt);
    }

    const revealHead = document.querySelector('.transform-chord-reveal-head');
    const revealPlayback = document.querySelector('.page2-transform-playback');
    if (revealHead && revealPlayback) {
      revealHead.querySelector(':scope > small')?.remove();
      if (revealPlayback.parentElement !== revealHead) {
        revealHead.prepend(revealPlayback);
      }
    }

    titleBlock.querySelector('.ct-title-tools')?.remove();

    const testSound = actions?.querySelector(':scope > [data-audio-test]');
    const setLab = actions?.querySelector('[data-set-lab-open]');
    const distance = actions?.querySelector('[data-ct-distance-open]');
    const laterButtons = [setLab, distance].filter(Boolean);
    laterButtons.forEach((button) => button.classList.remove('ct-title-tool-source'));
    let laterDrawer = actions?.querySelector('.ct-later-tools');
    if (actions && laterButtons.length && !laterDrawer) {
      laterDrawer = document.createElement('div');
      laterDrawer.className = 'ct-later-tools';
      laterDrawer.innerHTML = '<button type="button" disabled aria-disabled="true" title="Reserved for later versions">FOR LATER VERSIONS</button><div class="ct-later-tools-menu" hidden></div>';
      (testSound || actions.lastElementChild)?.insertAdjacentElement('afterend', laterDrawer);
    }
    const laterMenu = laterDrawer?.querySelector('.ct-later-tools-menu');
    if (laterMenu) {
      laterButtons.forEach((button) => {
        if (button.parentElement !== laterMenu) laterMenu.appendChild(button);
      });
    }

    const sound = topbar.querySelector('.top-actions > [data-sound]');
    const history = actions?.querySelector(':scope > [data-history]');
    const beforeSound = [testSound, history, laterDrawer].filter(Boolean);
    if (sound && beforeSound.length &&
        (beforeSound.at(-1).nextElementSibling !== sound ||
         beforeSound.some((button, index) => index > 0 && beforeSound[index - 1].nextElementSibling !== button))) {
      sound.before(...beforeSound);
    }
    const composeLibrary = topbar.querySelector('.top-actions > [data-compose-library]');
    const composeNotation = topbar.querySelector('.top-actions > [data-compose-notation]');
    const composeLesson = topbar.querySelector('.top-actions > [data-compose-lesson]');
    const composeGroup = [composeLibrary, composeNotation, composeLesson].filter(Boolean);
    composeGroup.forEach((button) => button.classList.add('ct-compose-top-action'));
    const reset = topbar.querySelector('.top-actions > [data-reset]');
    const readMe = topbar.querySelector('.top-actions > .ct-read-me:not(.ct-why-button):not(.ct-chord-mode)');
    const why = topbar.querySelector('.top-actions > .ct-why-button');
    const undo = topbar.querySelector('.top-actions > [data-undo]');
    const redo = topbar.querySelector('.top-actions > [data-redo]');
    const soundGroup = [readMe, why, reset, undo, redo].filter(Boolean);
    const soundAnchor = composeGroup.at(-1) || sound;
    if (soundAnchor && soundGroup.length &&
        soundGroup.some((button, index) =>
          (index === 0 ? soundAnchor : soundGroup[index - 1]).nextElementSibling !== button)) {
      soundAnchor.after(...soundGroup);
    }

    // Keep contextual entry points beside the material they affect while the
    // four native workspace controls remain available in the top toolbar.
    const adjustPanel = document.querySelector('.compose-adjust');
    if (adjustPanel) {
      const isScaleAdjust = Boolean(adjustPanel.querySelector('[data-compose-scale-root]'));
      const heading = adjustPanel.querySelector(':scope > header strong');
      const headingText = isScaleAdjust ? 'ADJUST SCALE' : 'ADJUST CHORD';
      if (heading && heading.textContent !== headingText) heading.textContent = headingText;

      const chordSelect = adjustPanel.querySelector('[data-compose-chord-quality]');
      const chordLabel = chordSelect?.closest('label');
      if (chordLabel && chordLabel.firstChild?.nodeType === Node.TEXT_NODE &&
          chordLabel.firstChild.textContent !== 'Chord Shape') {
        chordLabel.firstChild.textContent = 'Chord Shape';
      }

      const panelHeader = adjustPanel.querySelector(':scope > header');
      const panelNav = panelHeader?.querySelector('nav');
      const hear = adjustPanel.querySelector('[data-compose-hear]');
      if (hear && panelNav) {
        const hearText = isScaleAdjust ? '▶ HEAR CURRENT SCALE' : '▶ PLAY CURRENT CHORD';
        if (hear.textContent !== hearText) hear.textContent = hearText;
        hear.classList.add('ct-current-audition');
        if (hear.parentElement !== panelNav) panelNav.prepend(hear);
      }
      if (panelHeader && !adjustPanel.querySelector('.compose-adjust-purpose')) {
        const purpose = document.createElement('p');
        purpose.className = 'compose-adjust-purpose';
        purpose.textContent = isScaleAdjust
          ? 'Change the source scale here. The updated notes will inform the new motif and can be heard or saved to your Pool.'
          : 'Choose the chord shape, then add upper tones. Hear it here or save the result to your Pool.';
        panelHeader.insertAdjacentElement('afterend', purpose);
      }

      const choices = adjustPanel.querySelector('.compose-choice-row');
      if (choices && !adjustPanel.querySelector('.compose-adjust-group-label')) {
        const label = document.createElement('span');
        label.className = 'compose-adjust-group-label';
        label.textContent = 'EXTENSIONS / ALTERATIONS';
        choices.insertAdjacentElement('beforebegin', label);
      }

      const save = adjustPanel.querySelector('[data-compose-save]');
      if (save && save.textContent !== 'SAVE TO POOL') save.textContent = 'SAVE TO POOL';
    }
    ctCleanGenerateHeader();
  }

  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', sync);

  // Generate Material's literal chord buttons normally use the block-only
  // audition path. When Arpeggio is selected, let the main handler route the
  // same chord through its preference-aware audition method instead.
  window.addEventListener('click', (event) => {
    const clicked = event.target instanceof Element ? event.target : null;
    const playback = clicked?.closest('[data-transform-chord-playback]');
    if (playback) {
      const mode = playback.dataset.transformChordPlayback === 'arpeggio' ? 'arpeggio' : 'block';
      localStorage.setItem('composer-toolbox-chord-playback', mode);
    }

    const target = clicked?.closest([
      '.chord-audition[data-audition-chord]',
      '[data-working-chord-degree]',
      '[data-working-synthetic-degree]',
      '[data-advanced-chord]',
      '[data-select-chord]'
    ].join(','));
    if (!target || localStorage.getItem('composer-toolbox-chord-playback') !== 'arpeggio') return;
    if (target.hasAttribute('data-literal-chord')) {
      target.removeAttribute('data-literal-chord');
      queueMicrotask(() => {
        if (target.isConnected) target.setAttribute('data-literal-chord', '');
      });
    }
  }, true);

  sync();
})();
