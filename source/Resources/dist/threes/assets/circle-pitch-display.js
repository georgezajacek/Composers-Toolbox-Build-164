(() => {
  const neutralCircleNames = ["C", "D♭", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  const flatCircleNames = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
  const sharpCircleNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  let syncing = false;

  const normalize = value => String(value || "")
    .trim()
    .toLocaleUpperCase("en-US")
    .replace(/\s+/g, "");

  const pitchClassFor = element => {
    const raw = element.dataset.root ?? element.dataset.innerPc ?? element.dataset.workingToggle;
    const value = Number(raw);
    return Number.isFinite(value) ? ((value % 12) + 12) % 12 : null;
  };

  const isIncluded = element => element.classList.contains("in") || element.classList.contains("working-on");
  const hasDoubleAccidental = spelling => /♯♯|♭♭|𝄪|𝄫|##|bb/i.test(spelling);

  const generatorCircleNames = () => {
    if (typeof h !== "object" || typeof _ !== "function") return neutralCircleNames;
    const state = h.get();
    const spellings = _(state.working).names || [];
    const rootSpelling = spellings[0] || "";
    if (/♭|b/.test(rootSpelling)) return flatCircleNames;
    if (/♯|#/.test(rootSpelling)) return sharpCircleNames;

    const flatCount = spellings.filter(name => /♭|b/.test(name)).length;
    const sharpCount = spellings.filter(name => /♯|#/.test(name)).length;
    if (flatCount > sharpCount) return flatCircleNames;
    if (sharpCount > flatCount) return sharpCircleNames;
    if (flatCount) return flatCircleNames;
    return neutralCircleNames;
  };

  const syncPitch = element => {
    const pitchClass = pitchClassFor(element);
    if (pitchClass === null) return;

    if (!element.dataset.ctScaleSpelling) {
      element.dataset.ctScaleSpelling = element.textContent.trim();
      element.dataset.ctOriginalTitle = element.title || "";
    }

    const scaleSpelling = element.dataset.ctScaleSpelling;
    const isExplorePitch = element.matches(".circle-note, .circle-third");
    const fixedName = (element.matches(".work-pitch") ? generatorCircleNames() : neutralCircleNames)[pitchClass];
    const keepScaleSpelling = isExplorePitch && isIncluded(element) && !hasDoubleAccidental(scaleSpelling);
    const preferredName = keepScaleSpelling ? scaleSpelling : fixedName;
    const displayName = element.matches(".circle-third") ? preferredName.toLocaleLowerCase("en-US") : preferredName;
    const isEnharmonic = element.matches(".work-pitch") && isIncluded(element) && normalize(scaleSpelling) !== normalize(fixedName);
    const isExploreEnharmonic = isExplorePitch && isIncluded(element) && hasDoubleAccidental(scaleSpelling);

    if (element.textContent !== displayName) element.textContent = displayName;
    element.classList.toggle("ct-enharmonic-alias", isEnharmonic);
    element.classList.toggle("ct-explore-enharmonic", isExploreEnharmonic);

    const originalTitle = element.dataset.ctOriginalTitle;
    const spellingNote = keepScaleSpelling
      ? `Scale spelling ${scaleSpelling}`
      : normalize(scaleSpelling) !== normalize(fixedName)
        ? `Circle pitch ${fixedName} · scale spelling ${scaleSpelling}`
        : `Circle pitch ${fixedName}`;
    const nextTitle = originalTitle ? `${originalTitle} · ${spellingNote}` : spellingNote;
    if (element.title !== nextTitle) element.title = nextTitle;
  };

  const replaceRootName = (text, rootName) => String(text || "").replace(/^([^\s]+)(\s+)/, `${rootName}$2`);

  const syncModeFamilySpelling = () => {
    const referenceNotes = document.querySelectorAll(".suite-stage-1 .role-reference .note-cell[data-note-pc]");
    if (!referenceNotes.length) return;

    const spellingByPitch = new Map();
    referenceNotes.forEach(note => {
      const pitchClass = Number(note.dataset.notePc);
      const name = note.querySelector("b")?.textContent.trim();
      if (Number.isFinite(pitchClass) && name) spellingByPitch.set(pitchClass, name);
    });
    if (!spellingByPitch.size) return;

    document.querySelectorAll(".suite-stage-1 .mode-choice[data-modal-root]").forEach(card => {
      const root = Number(card.dataset.modalRoot);
      const rootName = spellingByPitch.get(root);
      const title = card.querySelector(".mode-choice-title strong");
      if (!rootName || !title) return;
      const corrected = replaceRootName(title.textContent, rootName);
      if (title.textContent !== corrected) title.textContent = corrected;
      card.setAttribute("aria-label", `Explore ${corrected}`);
    });

    document.querySelectorAll(".suite-stage-1 .mode-choice .note-cell[data-note-pc], .suite-stage-1 .role-source .note-cell[data-note-pc]").forEach(note => {
      const name = spellingByPitch.get(Number(note.dataset.notePc));
      const label = note.querySelector("b");
      if (name && label && label.textContent !== name) label.textContent = name;
    });

    const selected = document.querySelector(".suite-stage-1 .mode-choice.source-active[data-modal-root]");
    const selectedRootName = selected ? spellingByPitch.get(Number(selected.dataset.modalRoot)) : null;
    if (selectedRootName) {
      document.querySelectorAll(".suite-stage-1 .role-source > strong, .suite-stage-1 .educational-harmony-head h2").forEach(label => {
        const corrected = replaceRootName(label.textContent, selectedRootName);
        if (label.textContent !== corrected) label.textContent = corrected;
      });
      const continueButton = document.querySelector(".suite-stage-1 [data-continue-selection]");
      if (continueButton) {
        const corrected = continueButton.textContent.replace(/^(CONTINUE WITH )[^\s]+/i, `$1${selectedRootName.toUpperCase()}`);
        if (continueButton.textContent !== corrected) continueButton.textContent = corrected;
      }
    }

    document.querySelectorAll(".suite-stage-1 .chord-audition[data-audition-chord]").forEach(chord => {
      const pitches = String(chord.dataset.auditionChord || "").split(",").map(Number).filter(Number.isFinite);
      const chordRoot = spellingByPitch.get(pitches[0]);
      const chordName = chord.querySelector(".chord-name-full > span");
      if (chordRoot && chordName && chordName.textContent !== chordRoot) chordName.textContent = chordRoot;
      chord.querySelectorAll(".chord-tone").forEach((tone, index) => {
        const pitch = tone.dataset.chordPc === undefined ? pitches[index] : Number(tone.dataset.chordPc);
        const name = spellingByPitch.get(pitch);
        if (name && tone.textContent !== name) tone.textContent = name;
      });
    });
  };

  const syncKey = () => {
    const nav = document.querySelector(".suite-stage-nav");
    const compose = nav?.querySelector('[data-suite-stage="3"]');
    if (!nav || !compose) return;

    const colorKey = document.querySelector(".circle-tone-key");
    if (colorKey && colorKey.previousElementSibling !== compose) compose.after(colorKey);

    const circle = document.querySelector(".suite-stage-1 .circle-column .circle, .suite-stage-2 .work-circle-panel .work-circle");
    if (!circle || circle.matches(".suite-stage-1 .circle")) return;

    const showEnharmonic = circle.matches(".work-circle");
    const showExploreEnharmonic = !showEnharmonic && Boolean(document.querySelector(".ct-explore-enharmonic"));
    let key = document.querySelector(".ct-circle-display-key");
    if (!key) {
      key = document.createElement("div");
      key.className = "ct-circle-display-key";
      key.setAttribute("aria-label", "Circle pitch display key");
    }
    const keyMode = showEnharmonic ? "generate" : showExploreEnharmonic ? "explore-enharmonic" : "explore";
    if (key.dataset.ctKeyMode !== keyMode) {
      key.dataset.ctKeyMode = keyMode;
      key.innerHTML = [
        '<b>KEY</b>',
        '<span class="ct-key-root"><i></i>Root</span>',
        '<span class="ct-key-in"><i></i>Diatonic</span>',
        showEnharmonic ? '<span class="ct-key-alias"><i></i>Enharmonic spelling</span>' : '',
        showExploreEnharmonic ? '<span class="ct-key-explore-alias"><i></i>Enharmonic equivalent</span>' : '',
        '<span class="ct-key-out"><i></i>Chromatic</span>'
      ].join("");
    }
    if (key.previousElementSibling !== circle) circle.after(key);
  };

  const sync = () => {
    if (syncing) return;
    syncing = true;
    document.querySelectorAll(".circle-note[data-root], .circle-third[data-inner-pc], .work-pitch[data-working-toggle]").forEach(syncPitch);
    syncModeFamilySpelling();
    syncKey();
    syncing = false;
  };

  const observer = new MutationObserver(() => queueMicrotask(sync));
  const start = () => {
    sync();
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
