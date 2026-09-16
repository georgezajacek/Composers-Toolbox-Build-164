(() => {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const pcsFor = (text) => text.split("·").map((part) => {
    const label = part.trim();
    const note = label.replace("♭", "b").replace("♯", "#");
    const aliases = { Db: 1, Eb: 3, Gb: 6, Ab: 8, Bb: 10, Cb: 11, Fb: 4, "E#": 5, "B#": 0 };
    const pc = aliases[note] ?? names.indexOf(note.replace("#", "♯"));
    return pc >= 0 ? { pc, label } : null;
  }).filter(Boolean);

  const qualityFor = (scale, degree, extent) => {
    const at = (step) => scale[(degree + step) % scale.length];
    const root = at(0).pc;
    const interval = (note) => (note.pc - root + 12) % 12;
    const third = interval(at(2));
    const fifth = interval(at(4));
    const seventh = interval(at(6));
    if (third === 3 && fifth === 6) return extent >= 7 && seventh === 10 ? "Half-diminished" : "Diminished";
    if (third === 4 && fifth === 8) return "Augmented";
    if (third === 3 && seventh === 11 && extent >= 7) return "Minor-major";
    if (third === 3) return "Minor";
    return seventh === 10 && extent >= 7 ? "Dominant" : "Major";
  };

  const labelFor = (scale, degree, extent) => {
    const count = extent === 3 ? 3 : extent === 7 ? 4 : extent === 9 ? 5 : extent === 11 ? 6 : 7;
    const tones = Array.from({ length: count }, (_, step) => scale[(degree + step * 2) % scale.length]);
    return { number: degree + 1, tones };
  };

  const dispatchChange = (element) => element.dispatchEvent(new Event("change", { bubbles: true }));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 90));
  let activeExtent = 3;
  let activeDegree = null;

  async function revealChordControls() {
    let rootSelect = document.querySelector("[data-compose-chord-root]");
    if (rootSelect) return rootSelect;

    const openPanel = document.querySelector('.compose-adjust');
    if (openPanel) {
      document.querySelector('[data-compose-adjust-kind="chord"]')?.click();
    } else {
      document.querySelector("[data-compose-adjust]")?.click();
    }
    await settle();

    rootSelect = document.querySelector("[data-compose-chord-root]");
    if (rootSelect) return rootSelect;
    document.querySelector('[data-compose-adjust-kind="chord"]')?.click();
    await settle();
    return document.querySelector("[data-compose-chord-root]");
  }

  async function placeChord(button) {
    const root = Number(button.dataset.root);
    const quality = button.dataset.quality;
    const extent = Number(button.dataset.extent);
    activeDegree = Number(button.dataset.degree);
    button.classList.add('active');
    const rootSelect = await revealChordControls();
    if (!rootSelect) return;
    rootSelect.value = String(root);
    dispatchChange(rootSelect);
    await settle();
    const qualitySelect = document.querySelector("[data-compose-chord-quality]");
    qualitySelect.value = quality;
    dispatchChange(qualitySelect);
    await settle();
    const extentButton = document.querySelector(`[data-compose-extent="${extent}"]`);
    extentButton?.click();
    await settle();
    const slot = [...document.querySelectorAll('[data-compose-slot^="harmony:"]')]
      .find((candidate) => !candidate.closest('.compose-slot')?.classList.contains('filled'));
    if (!slot) return;
    const position = slot.dataset.composeSlot;
    slot.click();
    await settle();
    const inserted = document.querySelector(`[data-compose-slot="${position}"]`);
    const label = inserted?.textContent || '';
    const unwanted = [["♭9", "flat9"], ["♯11", "sharp11"], ["♭13", "flat13"]]
      .filter(([symbol]) => label.includes(symbol));
    if (!unwanted.length) return;
    document.querySelector(`[data-compose-clear="${position}"]`)?.click();
    await settle();
    unwanted.forEach(([, key]) => document.querySelector(`[data-compose-alter="${key}"]`)?.click());
    await settle();
    document.querySelector(`[data-compose-slot="${position}"]`)?.click();
  }

  function render() {
    const source = document.querySelector('.suite-stage-3 .compose-motif-scale-line');
    const resource = document.querySelector('.suite-stage-3 .compose-motif-resource');
    const host = resource?.closest('.compose-motif-source');
    if (!source || !resource || !host || host.querySelector('.compose-chord-starters')) return;
    const scale = pcsFor(source.querySelector('span')?.textContent || '');
    if (scale.length < 7) return;
    const panel = document.createElement('section');
    panel.className = 'compose-chord-starters';
    panel.innerHTML = `<header><strong>CHORD STARTERS</strong></header><div class="compose-chord-starter-extents"></div><div class="compose-chord-starter-list"></div>`;
    const redraw = () => {
      panel.querySelector('.compose-chord-starter-extents').innerHTML = [3, 7, 9, 11, 13].map((value) =>
        `<button type="button" data-starter-extent="${value}" class="${value === activeExtent ? 'active' : ''}">${value === 3 ? 'Triad' : value}</button>`
      ).join('');
      panel.querySelector('.compose-chord-starter-list').innerHTML = scale.map((root, degree) => {
        const { number, tones } = labelFor(scale, degree, activeExtent);
        return `<button type="button" data-starter-chord data-degree="${degree}" data-root="${root.pc}" data-quality="${qualityFor(scale, degree, activeExtent)}" data-extent="${activeExtent}" class="${degree === activeDegree ? 'active' : ''}" aria-pressed="${degree === activeDegree}"><b>${number}</b><small>${tones.map((note) => note.label).join(' · ')}</small></button>`;
      }).join('');
      panel.querySelectorAll('[data-starter-extent]').forEach((button) => button.onclick = () => {
        activeExtent = Number(button.dataset.starterExtent);
        activeDegree = null;
        redraw();
      });
      panel.querySelectorAll('[data-starter-chord]').forEach((button) => button.onclick = () => placeChord(button));
    };
    redraw();
    host.append(panel);
  }

  new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', render);
  render();
})();
