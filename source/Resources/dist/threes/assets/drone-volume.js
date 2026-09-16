(() => {
  const key = 'composer-toolbox-threes-drone-volume';
  const fallback = 0.17;
  const boostMarker = `${key}-boost-v69`;
  try {
    if (!localStorage.getItem(boostMarker)) {
      const previous = Number(localStorage.getItem(key));
      const boosted = Number.isFinite(previous) && previous > 0
        ? Math.min(0.3, Math.max(fallback, previous + 0.05))
        : fallback;
      localStorage.setItem(key, String(boosted));
      localStorage.setItem(boostMarker, "1");
    }
  } catch {}
  let gain = null;
  let arm = false;
  const read = () => {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(0.3, Math.max(0.01, value)) : fallback;
  };
  const apply = () => {
    if (!gain || !gain.context) return;
    const now = gain.context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(read(), now, 0.025);
  };
  const patchGain = (AudioConstructor) => {
    if (!AudioConstructor || AudioConstructor.__ctDroneVolumePatched) return;
    const original = AudioConstructor.prototype.createGain;
    AudioConstructor.prototype.createGain = function () {
      const created = original.call(this);
      if (arm) {
        arm = false;
        gain = created;
        window.setTimeout(apply, 0);
      }
      return created;
    };
    AudioConstructor.__ctDroneVolumePatched = true;
  };
  patchGain(window.AudioContext);
  patchGain(window.webkitAudioContext);
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-drone]')) {
      arm = true;
      window.setTimeout(() => { arm = false; }, 0);
    }
  }, true);
  const addControl = () => {
    const actions = document.querySelector('.top-actions');
    const pitch = actions?.querySelector('[data-drone-pitch]');
    if (!actions || !pitch || actions.querySelector('[data-drone-volume]')) return;
    const label = document.createElement('label');
    label.className = 'drone-volume-control';
    label.textContent = 'DRONE VOL';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0.01';
    input.max = '0.3';
    input.step = '0.005';
    input.value = String(read());
    input.setAttribute('aria-label', 'Drone volume');
    input.dataset.droneVolume = 'true';
    input.addEventListener('input', () => {
      localStorage.setItem(key, input.value);
      apply();
    });
    label.append(input);
    pitch.insertAdjacentElement('afterend', label);
  };
  new MutationObserver(addControl).observe(document.documentElement, { childList: true, subtree: true });
  addControl();
})();
