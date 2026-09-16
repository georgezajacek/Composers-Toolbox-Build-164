(function () {
  "use strict";

  if (window.__composerToolboxAudio) return;

  const contexts = new Set();
  const primed = new WeakSet();
  const wrappedConstructors = new Map();
  let gestureActive = false;
  let lastPointerDown = -Infinity;

  function prime(context) {
    if (!context || primed.has(context) || context.state !== "running") return;
    try {
      const source = context.createBufferSource();
      source.onended = function () { try { source.disconnect(); } catch (_) {} };
      source.buffer = context.createBuffer(1, 1, context.sampleRate || 44100);
      source.connect(context.destination);
      source.start(0);
      primed.add(context);
    } catch (_) {
      // A later trusted gesture will retry the context.
    }
  }

  function resume(context) {
    if (!context || context.state === "closed") return;
    try {
      if (context.state === "suspended") {
        const resumed = context.resume();
        if (resumed && typeof resumed.then === "function") {
          resumed.then(function () { prime(context); }).catch(function () {});
        }
      } else {
        prime(context);
      }
    } catch (_) {
      // iOS can reject resume outside a trusted event; the next gesture retries.
    }
  }

  function resumeAll() {
    contexts.forEach(function (context) {
      if (context.state === "closed") contexts.delete(context);
      else resume(context);
    });
  }

  function register(context) {
    contexts.add(context);
    if (gestureActive) resume(context);
    return context;
  }

  function wrapConstructor(name) {
    const NativeAudioContext = window[name];
    if (typeof NativeAudioContext !== "function") return;

    let WrappedAudioContext = wrappedConstructors.get(NativeAudioContext);
    if (!WrappedAudioContext) {
      WrappedAudioContext = new Proxy(NativeAudioContext, {
        construct: function (target, args, newTarget) {
          const actualTarget = newTarget === WrappedAudioContext ? target : newTarget;
          return register(Reflect.construct(target, args, actualTarget));
        }
      });
      wrappedConstructors.set(NativeAudioContext, WrappedAudioContext);
    }

    try { window[name] = WrappedAudioContext; } catch (_) {}
  }

  function dispatchUnlock() {
    try {
      window.dispatchEvent(new CustomEvent("composer-toolbox:audio-unlock"));
    } catch (_) {
      const event = document.createEvent("Event");
      event.initEvent("composer-toolbox:audio-unlock", false, false);
      window.dispatchEvent(event);
    }
  }

  function unlockFromGesture(event) {
    if (event && event.isTrusted === false) return;

    const now = performance.now();
    const duplicateClick = event && event.type === "click" && now - lastPointerDown < 750;
    if (event && event.type === "pointerdown") lastPointerDown = now;

    gestureActive = true;
    resumeAll();
    if (!duplicateClick) dispatchUnlock();

    queueMicrotask(function () {
      resumeAll();
      gestureActive = false;
    });
  }

  wrapConstructor("AudioContext");
  wrapConstructor("webkitAudioContext");

  window.addEventListener("pointerdown", unlockFromGesture, { capture: true, passive: true });
  window.addEventListener("keydown", unlockFromGesture, { capture: true, passive: true });
  window.addEventListener("click", unlockFromGesture, { capture: true, passive: true });

  if (!("PointerEvent" in window)) {
    window.addEventListener("touchstart", unlockFromGesture, { capture: true, passive: true });
  }

  window.__composerToolboxAudio = Object.freeze({
    unlock: resumeAll,
    status: function () {
      return Array.from(contexts, function (context) { return context.state; });
    }
  });
})();
