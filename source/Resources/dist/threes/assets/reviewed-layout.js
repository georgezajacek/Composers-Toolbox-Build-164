(() => {
  function applyReviewedLayout() {
    document.querySelectorAll('.suite-stage-1 .chord-roman').forEach((label) => {
      const current = (label.textContent || '').trim();
      const functionOnly = current.match(/^([♭♯]*(?:[ivIV]+))/u)?.[1];
      if (functionOnly && current !== functionOnly) {
        label.dataset.fullFunction = current;
        label.textContent = functionOnly;
      }
    });
  }

  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      applyReviewedLayout();
    });
  }).observe(document.body, { childList: true, subtree: true });

  applyReviewedLayout();
})();
