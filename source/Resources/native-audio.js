(() => {
  const contexts = new Set();
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Original = window[name];
    if (Original) window[name] = new Proxy(Original, {
      construct(target, args) {
        const context = Reflect.construct(target, args);
        contexts.add(context);
        return context;
      }
    });
  }
  window.ctNativeStopAudio = async () => {
    document.querySelectorAll('audio,video').forEach(media => media.pause());
    await Promise.allSettled([...contexts].map(context => context.state === 'closed' ? Promise.resolve() : context.close()));
    return [...contexts].every(context => context.state === 'closed');
  };
})();
