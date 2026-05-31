(async () => {
  const response = await fetch('src/game-loader.js?v=38', { cache: 'no-store' });
  let loader = await response.text();

  const audioBlock = String.raw`  ctx.imageSmoothingEnabled = true;

  const GREEN_FIELD_LOOP_START = 3.0;
  const GREEN_FIELD_LOOP_END = 10.0;
  const DRY_FIELD_LOOP_START = 4.0;
  const FIELD_VOLUME = 0.10;
  const BRAKE_VOLUME = 0.30;
  const BG_VOLUME = 1.0;
  const gameAudio = {
    audioCtx: null,
    greenBuffer: null,
    greenSource: null,
    greenGain: null,
    greenLoading: false,
    dryBuffer: null,
    drySource: null,
    dryGain: null,
    dryLoading: false,
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
      gameAudio.greenGain.gain.value = FIELD_VOLUME;
      gameAudio.greenGain.connect(gameAudio.audioCtx.destination);
    }
    if (!gameAudio.dryGain) {
      gameAudio.dryGain = gameAudio.audioCtx.createGain();
      gameAudio.dryGain.gain.value = FIELD_VOLUME;
      gameAudio.dryGain.connect(gameAudio.audioCtx.destination);
    }
    return gameAudio.audioCtx;
  }

  function loadBuffer(src, onDone, loadingKey, bufferKey) {
    if (gameAudio[bufferKey] || gameAudio[loadingKey]) return;
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    gameAudio[loadingKey] = true;
    fetch(src, { cache: 'force-cache' })
      .then(r => r.arrayBuffer())
      .then(b => ctxA.decodeAudioData(b))
      .then(buffer => {
        gameAudio[bufferKey] = buffer;
        gameAudio[loadingKey] = false;
        if (onDone) onDone();
      })
      .catch(() => { gameAudio[loadingKey] = false; });
  }

  function loadGreenBuffer() {
    loadBuffer('assets/Green%20Field.mp3?v=40', () => {
      if (gameAudio.active && gameAudio.field === 'green' && !gameAudio.greenSource) startGreenLoop();
    }, 'greenLoading', 'greenBuffer');
  }

  function loadDryBuffer() {
    loadBuffer('assets/Dry%20Field.mp3?v=40', () => {
      if (gameAudio.active && gameAudio.field === 'dry' && !gameAudio.drySource) startDryLoop();
    }, 'dryLoading', 'dryBuffer');
  }

  function stopSource(name) {
    const source = gameAudio[name];
    if (!source) return;
    try { source.stop(); } catch (_) {}
    try { source.disconnect(); } catch (_) {}
    gameAudio[name] = null;
  }

  function stopGreenLoop() { stopSource('greenSource'); }
  function stopDryLoop() { stopSource('drySource'); }

  function startGreenLoop() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    if (!gameAudio.greenBuffer) { loadGreenBuffer(); return; }
    stopGreenLoop();
    if (gameAudio.greenGain) gameAudio.greenGain.gain.value = FIELD_VOLUME;
    const source = ctxA.createBufferSource();
    source.buffer = gameAudio.greenBuffer;
    source.loop = true;
    source.loopStart = GREEN_FIELD_LOOP_START;
    source.loopEnd = GREEN_FIELD_LOOP_END;
    source.connect(gameAudio.greenGain);
    source.start(0, GREEN_FIELD_LOOP_START);
    gameAudio.greenSource = source;
  }

  function startDryLoop() {
    const ctxA = ensureAudioContext();
    if (!ctxA) return;
    if (!gameAudio.dryBuffer) { loadDryBuffer(); return; }
    stopDryLoop();
    if (gameAudio.dryGain) gameAudio.dryGain.gain.value = FIELD_VOLUME;
    const source = ctxA.createBufferSource();
    source.buffer = gameAudio.dryBuffer;
    source.loop = true;
    source.loopStart = DRY_FIELD_LOOP_START;
    source.loopEnd = Math.max(DRY_FIELD_LOOP_START + 0.25, gameAudio.dryBuffer.duration - 0.02);
    source.connect(gameAudio.dryGain);
    source.start(0, DRY_FIELD_LOOP_START);
    gameAudio.drySource = source;
  }

  function initGameAudio() {
    if (gameAudio.bg) return;
    gameAudio.brakes = makeGameAudio('assets/Brakes.mp3?v=40', true, BRAKE_VOLUME);
    gameAudio.bg = makeGameAudio('assets/Background%20Music.mp3?v=40', true, BG_VOLUME);
    ensureAudioContext();
    loadGreenBuffer();
    loadDryBuffer();
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
    if (!gameAudio.bg || gameAudio.gameMusic || gameAudio.menuMusic) return;
    gameAudio.menuMusic = true;
    gameAudio.bg.volume = BG_VOLUME;
    setAudioTime(gameAudio.bg, 15);
    playAudioTrack(gameAudio.bg, () => { gameAudio.menuMusic = false; });
  }

  function startGameBackgroundMusic() {
    initGameAudio();
    if (!gameAudio.bg) return;
    gameAudio.menuMusic = false;
    gameAudio.gameMusic = true;
    gameAudio.bg.volume = BG_VOLUME;
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
    if (gameAudio.field === 'dry') stopDryLoop();
    gameAudio.field = field;
    if (field === 'green') startGreenLoop();
    if (field === 'dry') startDryLoop();
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
    if (gameAudio.greenGain) gameAudio.greenGain.gain.value = FIELD_VOLUME;
    if (gameAudio.dryGain) gameAudio.dryGain.gain.value = FIELD_VOLUME;
    const brakingNow = state.braking && brakesUnlocked() && state.speed > 4 && (state.mode === 'intro' || state.mode === 'play');
    if (brakingNow) {
      gameAudio.brakes.volume = BRAKE_VOLUME;
      playAudioTrack(gameAudio.brakes);
    } else {
      pauseAudioTrack(gameAudio.brakes, true);
    }
  }

  function stopGameAudio() {
    gameAudio.active = false;
    gameAudio.field = '';
    stopGreenLoop();
    stopDryLoop();
    pauseAudioTrack(gameAudio.brakes, true);
    stopBackgroundMusic();
  }

  initGameAudio();
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

  loader = loader.replace(/assets\/70282CA7-7E9E-472D-A931-2D9E3FAF72AF\.jpg\?v=38/g, 'assets/70282CA7-7E9E-472D-A931-2D9E3FAF72AF.jpg?v=40');

  loader = loader.replace(
    `function drawMenu() {\n    drawMenuBackground();`,
    `function drawMenu() {\n    startMenuBackgroundMusic();\n    drawMenuBackground();`
  );

  (0, eval)(loader + '\n//# sourceURL=fieldchase-loader-v40-runtime.js');
})();