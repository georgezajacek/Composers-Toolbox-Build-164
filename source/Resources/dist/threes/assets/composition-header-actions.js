/* Approved composition toolbar placement; move existing controls with their handlers. */
(() => {
  let exploreFrame=0;
  function alignExploreUnit() {
    cancelAnimationFrame(exploreFrame);
    exploreFrame=requestAnimationFrame(()=>{
      const column=document.querySelector('.suite-stage-1 .circle-column');
      const reference=column?.querySelector(':scope > .role-reference');
      const topC=column?.querySelector(':scope > .circle .circle-note[data-root="0"]');
      if(!reference||!topC)return;
      const previous=parseFloat(column.style.getPropertyValue('--ct-explore-unit-drop'))||0;
      const drop=Math.max(0,reference.getBoundingClientRect().bottom-topC.getBoundingClientRect().top+previous);
      column.style.setProperty('--ct-explore-unit-drop',`${drop.toFixed(2)}px`);
    });
  }
  window.addEventListener('resize',alignExploreUnit);
  document.fonts?.ready.then(alignExploreUnit);
  function placeActions() {
    alignExploreUnit();
    const page = document.querySelector('.suite-stage-3 .compose-page');
    const actions = document.querySelector('.top-actions');
    if (!actions) return;
    actions.querySelector('[data-audio-test]')?.remove();
    const laterMenu=actions.querySelector('.ct-later-tools-menu');
    const history=actions.querySelector('[data-history]');
    if(history&&laterMenu&&history.parentElement!==laterMenu)laterMenu.append(history);
    const nav=document.querySelector('.suite-stage-nav');
    if(nav&&!actions.contains(nav)&&actions.parentElement!==nav)nav.append(actions);
    if(!page)return;
    const move = (node, target) => {
      if (node && target && node.parentElement !== target) target.append(node);
    };
    move(document.querySelector('[data-compose-library]'), page.querySelector('.compose-motif-panel > header'));
    page.querySelector('.ct-derived-reference')?.remove();
    actions.querySelector('.ct-derived-reference')?.remove();
    const menu = actions.querySelector('.ct-later-tools-menu');
    for (const selector of ['[data-sound]', '[data-compose-notation]', '[data-compose-lesson]']) {
      move(document.querySelector(selector), menu);
    }

  }
  new MutationObserver(placeActions).observe(document.documentElement, {childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded', placeActions);
  placeActions();
})();
