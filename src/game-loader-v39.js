(async () => {
  const response = await fetch('src/game-loader.js?v=38', { cache: 'no-store' });
  let loader = await response.text();

  const audioBlock = String.raw`  ctx.imageSmoothingEnabled = true;

  const GREEN_FIELD_LOOP_START = 3.0;
  const GREEN_FIELD_LOOP_END = 10.0;
  const gameAudio = {
    audioCtx: null,
    greenBuffer: null,
    greenSource: null,
    greenGain: null,
    greenLoading: false,
    dry: null,
    brakes: null,
    bg: null,
    active: false,
    field: '',
    menuMusic: false,
    gameMusic: false
  };

  function makeGameAudio(src, loop, volume) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = volume;
    audio.preload = 'auto';
    audio.playsInline = true;
    return audio;
  }

  function ensureAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!gameAudio.audioCtx) gameAudio.audioCtx = new AudioCtx();
    if (gameAudio.audioCtx.state === 'suspended') gameAudio.audioCtx.resume().catch(() => {});
    if (!gameAudio.greenGain) {
      gameAudio.greenGain = gameAudio.audioCtx.createGain();
      gameAudio.greenGain.gain.value = 0.30;
      gameAudio.greenGain.connect(gameAudio.audioCtx.destination);
    }
    return gameAudio.audioCtx;
  }

  function loadGreenBuffer() {
    if (gameAudio.greenBuffer || gameAudio.greenLoading) return;
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    gameAudio.greenLoading = true;
    fetch('assets/Green%20Field.mp3?v=39', { cache: 'force-cache' })
      .then(r => r.arrayBuffer())
      .then(b => ctxA.decodeAudioData(b))
      .then(buffer => {
        gameAudio.greenBuffer = buffer;
        gameAudio.greenLoading = false;
        if (gameAudio.active && gameAudio.field === 'green' && !gameAudio.greenSource) startGreenLoop();
      })
      .catch(() => { gameAudio.greenLoading = false; });
  }

  function stopGreenLoop() {
    if (!gameAudio.greenSource) return;
    try { gameAudio.greenSource.stop(); } catch (_) {}
    try { gameAudio.greenSource.disconnect(); } catch (_) {}
    gameAudio.greenSource = null;
  }

  function startGreenLoop() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    if (!gameAudio.greenBuffer) { loadGreenBuffer(); return; }
    stopGreenLoop();
    gameAudio.greenGain.gain.value = 0.30;
    const source = ctxA.createBufferSource();
    source.buffer = gameAudio.greenBuffer;
    source.loop = true;
    source.loopStart = GREEN_FIELD_LOOP_START;
    source.loopEnd = GREEN_FIELD_LOOP_END;
    source.connect(gameAudio.greenGain);
    source.start(0, GREEN_FIELD_LOOP_START);
    gameAudio.greenSource = source;
  }

  function initGameAudio() {
    if (gameAudio.bg) return;
    gameAudio.dry = makeGameAudio('assets/Dry%20Field.mp3?v=39', true, 0.30);
    gameAudio.brakes = makeGameAudio('assets/Brakes.mp3?v=39', true, 0.30);
    gameAudio.bg = makeGameAudio('assets/Background%20Music.mp3?v=39', true, 1.0);
    ensureAudioContext();
    loadGreenBuffer();
  }

  function setAudioTime(track, seconds) {
    if (!track) return;
    try { track.currentTime = seconds; } catch (_) {}
  }

  function playAudioTrack(track, onBlocked) {
    if (!track) return null;
    const p = track.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { if (onBlocked) onBlocked(); });
    }
    return p;
  }

  function pauseAudioTrack(track, reset = false) {
    if (!track) return;
    track.pause();
    if (reset) setAudioTime(track, 0);
  }

  function startMenuBackgroundMusic() {
    initGameAudio();
    if (!gameAudio.bg || gameAudio.gameMusic) return;
    gameAudio.menuMusic = true;
    gameAudio.bg.volume = 1.0;
    setAudioTime(gameAudio.bg, 15);
    playAudioTrack(gameAudio.bg, () => { gameAudio.menuMusic = false; });
  }

  function startGameBackgroundMusic() {
    initGameAudio();
    if (!gameAudio.bg) return;
    gameAudio.menuMusic = false;
    gameAudio.gameMusic = true;
    gameAudio.bg.volume = 1.0;
    setAudioTime(gameAudio.bg, 40);
    playAudioTrack(gameAudio.bg);
  }

  function stopBackgroundMusic() {
    gameAudio.menuMusic = false;
    gameAudio.gameMusic = false;
    pauseAudioTrack(gameAudio.bg, true);
  }

  function switchFieldAudio(field) {
    if (!gameAudio.active || gameAudio.field === field) return;
    if (gameAudio.field === 'green') stopGreenLoop();
    if (gameAudio.field === 'dry') pauseAudioTrack(gameAudio.dry, true);
    gameAudio.field = field;
    if (field === 'green') startGreenLoop();
    if (field === 'dry') {
      gameAudio.dry.volume = 0.30;
      setAudioTime(gameAudio.dry, 0);
      playAudioTrack(gameAudio.dry);
    }
  }

  function startGameAudio() {
    initGameAudio();
    ensureAudioContext();
    startGameBackgroundMusic();
    gameAudio.active = true;
    gameAudio.field = '';
    switchFieldAudio('green');
  }

  function updateGameAudio() {
    if (!gameAudio.active) return;
    switchFieldAudio(state.carY >= CORN_END ? 'dry' : 'green');
    if (gameAudio.greenGain) gameAudio.greenGain.gain.value = 0.30;
    if (gameAudio.dry) gameAudio.dry.volume = 0.30;
    const brakingNow = state.braking && brakesUnlocked() && state.speed > 4 && (state.mode === 'intro' || state.mode === 'play');
    if (brakingNow) {
      gameAudio.brakes.volume = 0.30;
      playAudioTrack(gameAudio.brakes);
    } else {
      pauseAudioTrack(gameAudio.brakes, true);
    }
  }

  function stopGameAudio() {
    gameAudio.active = false;
    gameAudio.field = '';
    stopGreenLoop();
    pauseAudioTrack(gameAudio.dry, true);
    pauseAudioTrack(gameAudio.brakes, true);
    stopBackgroundMusic();
  }

  initGameAudio();
  startMenuBackgroundMusic();
  window.addEventListener('pointerdown', () => {
    ensureAudioContext();
    if (!gameAudio.gameMusic && (state.mode === 'law' || state.mode === 'menu' || state.mode === 'how')) startMenuBackgroundMusic();
  }, { passive: true });
  window.addEventListener('touchstart', () => {
    ensureAudioContext();
    if (!gameAudio.gameMusic && (state.mode === 'law' || state.mode === 'menu' || state.mode === 'how')) startMenuBackgroundMusic();
  }, { passive: true });
  window.addEventListener('keydown', () => {
    ensureAudioContext();
    if (!gameAudio.gameMusic && (state.mode === 'law' || state.mode === 'menu' || state.mode === 'how')) startMenuBackgroundMusic();
  }, { passive: true });

  function trackGameEvent(name, params = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  }

  function buildGameAnalyticsPayload(result) {
    const s = typeof scoreValue === 'function'
      ? scoreValue()
      : { align: Math.round(alignmentScore() * 100), stopGap: Math.max(0, Math.round(WATER_START - state.carY)), time: Math.max(0, state.gameTimer), score: 0 };
    return {
      result,
      score: s.score,
      alignment: s.align,
      cliff_gap: s.stopGap,
      time_left: Number(s.time.toFixed(1)),
      distance_travelled: Math.round(state.carY)
    };
  }

  const CAR_SCREEN_Y`;

  loader = loader.replace(
    /`  ctx\.imageSmoothingEnabled = true;\n\n  const GREEN_FIELD_LOOP_START[\s\S]*?\n\n  const CAR_SCREEN_Y`/,
    '`' + audioBlock + '`'
  );

  loader = loader.replace(/assets\/70282CA7-7E9E-472D-A931-2D9E3FAF72AF\.jpg\?v=38/g, 'assets/70282CA7-7E9E-472D-A931-2D9E3FAF72AF.jpg?v=39');

  (0, eval)(loader + '\n//# sourceURL=fieldchase-loader-v39-runtime.js');
})();