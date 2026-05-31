(async () => {
  const baseUrl = 'src/game.js?base=15';
  const response = await fetch(baseUrl, { cache: 'no-store' });
  let code = await response.text();

  code = code.replace(
`  const W = canvas.width;
  const H = canvas.height;
  ctx.imageSmoothingEnabled = false;`,
`  const LOGICAL_W = 450;
  const LOGICAL_H = 800;
  const RENDER_SCALE = Math.min(Math.max(window.devicePixelRatio || 2, 2), 3);
  canvas.width = Math.round(LOGICAL_W * RENDER_SCALE);
  canvas.height = Math.round(LOGICAL_H * RENDER_SCALE);
  canvas.style.width = 'min(100vw, 56.25svh)';
  canvas.style.height = 'min(100svh, 177.78vw)';
  const W = LOGICAL_W;
  const H = LOGICAL_H;
  ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
  ctx.imageSmoothingEnabled = true;`
  );

  code = code.replace(
    /fetch\('assets\/menu-bg\.txt\?v=15', \{ cache: 'no-store' \}\)[\s\S]*?\.catch\(\(\) => \{ menuBgReady = false; \}\);/,
`menuBg.onload = () => { menuBgReady = true; };
  menuBg.src = 'assets/70282CA7-7E9E-472D-A931-2D9E3FAF72AF.jpg?v=38';`
  );

  code = code.replace(
`  ctx.imageSmoothingEnabled = true;

  const CAR_SCREEN_Y`,
`  ctx.imageSmoothingEnabled = true;

  const GREEN_FIELD_LOOP_START = 3.0;
  const GREEN_FIELD_LOOP_END = 10.0;
  const gameAudio = {
    green: null,
    dry: null,
    brakes: null,
    bg: null,
    current: null,
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

  function initGameAudio() {
    if (gameAudio.green) return;
    gameAudio.green = makeGameAudio('assets/Green%20Field.mp3?v=38', false, 0.30);
    gameAudio.dry = makeGameAudio('assets/Dry%20Field.mp3?v=38', true, 0.30);
    gameAudio.brakes = makeGameAudio('assets/Brakes.mp3?v=38', true, 0.30);
    gameAudio.bg = makeGameAudio('assets/Background%20Music.mp3?v=38', true, 1.0);
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
    const next = field === 'dry' ? gameAudio.dry : gameAudio.green;
    if (gameAudio.current && gameAudio.current !== next) pauseAudioTrack(gameAudio.current, true);
    gameAudio.current = next;
    gameAudio.field = field;
    if (next === gameAudio.green) setAudioTime(next, GREEN_FIELD_LOOP_START);
    if (next === gameAudio.dry) setAudioTime(next, 0);
    playAudioTrack(next);
  }

  function startGameAudio() {
    initGameAudio();
    startGameBackgroundMusic();
    gameAudio.active = true;
    gameAudio.field = '';
    switchFieldAudio('green');
  }

  function updateGameAudio() {
    if (!gameAudio.active) return;
    switchFieldAudio(state.carY >= CORN_END ? 'dry' : 'green');
    if (gameAudio.current === gameAudio.green && gameAudio.green.currentTime >= GREEN_FIELD_LOOP_END) {
      setAudioTime(gameAudio.green, GREEN_FIELD_LOOP_START);
      playAudioTrack(gameAudio.green);
    }
    const brakingNow = state.braking && brakesUnlocked() && state.speed > 4 && (state.mode === 'intro' || state.mode === 'play');
    if (gameAudio.current) gameAudio.current.volume = 0.30;
    if (brakingNow) playAudioTrack(gameAudio.brakes);
    else pauseAudioTrack(gameAudio.brakes, true);
  }

  function stopGameAudio() {
    if (!gameAudio.green) return;
    gameAudio.active = false;
    gameAudio.field = '';
    pauseAudioTrack(gameAudio.green, true);
    pauseAudioTrack(gameAudio.dry, true);
    pauseAudioTrack(gameAudio.brakes, true);
    stopBackgroundMusic();
    gameAudio.current = null;
  }

  initGameAudio();
  startMenuBackgroundMusic();
  window.addEventListener('pointerdown', () => {
    if (!gameAudio.gameMusic && (state.mode === 'law' || state.mode === 'menu' || state.mode === 'how')) startMenuBackgroundMusic();
  }, { passive: true });
  window.addEventListener('touchstart', () => {
    if (!gameAudio.gameMusic && (state.mode === 'law' || state.mode === 'menu' || state.mode === 'how')) startMenuBackgroundMusic();
  }, { passive: true });
  window.addEventListener('keydown', () => {
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

  const CAR_SCREEN_Y`
  );

  code = code.replace(
`  const buttons = {
    play: { x: 88, y: 348, w: 274, h: 54 },
    how: { x: 88, y: 414, w: 274, h: 48 },
    howClose: { x: 72, y: 694, w: 138, h: 42 },
    howPlay: { x: 240, y: 694, w: 138, h: 42 }
  };`,
`  const buttons = {
    play: { x: 88, y: 348, w: 274, h: 54 },
    how: { x: 88, y: 414, w: 274, h: 48 },
    howClose: { x: 72, y: 662, w: 138, h: 42 },
    howPlay: { x: 240, y: 662, w: 138, h: 42 }
  };`
  );

  code = code.replace(
`    state.transitionStartedAt = now;
    input.pointers.clear();`,
`    state.transitionStartedAt = now;
    trackGameEvent('game_start', { event_category: 'game' });
    startGameAudio();
    input.pointers.clear();`
  );

  code = code.replace(
`        state.result = 'TRUCK STOPPED BEFORE THE SHORELINE';`,
`        state.result = 'TRUCK STOPPED BEFORE THE CLIFF';
        trackGameEvent('game_finish', buildGameAnalyticsPayload('win'));
        stopGameAudio();`
  );
  code = code.replace(
`        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';`,
`        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';
        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_alignment'));
        stopGameAudio();`
  );
  code = code.replace(
`        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';`,
`        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';
        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_early_stop'));
        stopGameAudio();`
  );
  code = code.replace(
`        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';`,
`        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';
        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_cliff'));
        stopGameAudio();`
  );
  code = code.replace(
`        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';`,
`        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';
        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_timeout'));
        stopGameAudio();`
  );

  code = code.replace(
`    addDust(dt);
  }`,
`    updateGameAudio();
    addDust(dt);
  }`
  );

  code = code.replace(
`    state.mode = 'menu';
    state.carX = 112;`,
`    stopGameAudio();
    startMenuBackgroundMusic();
    state.mode = 'menu';
    state.carX = 112;`
  );

  code = code.replace(
    /function drawMenuBackground\(\) \{[\s\S]*?\n  \}\n\n  function drawButton/,
`function drawMenuBackground() {
    rect(0, 0, W, H, '#000');
    if (menuBgReady) {
      const scale = Math.max(W / menuBg.width, H / menuBg.height);
      const dw = menuBg.width * scale;
      const dh = menuBg.height * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(menuBg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      const g0 = ctx.createLinearGradient(0, 0, 0, H);
      g0.addColorStop(0, '#050609');
      g0.addColorStop(0.52, '#162019');
      g0.addColorStop(1, '#050505');
      ctx.fillStyle = g0;
      ctx.fillRect(0, 0, W, H);
    }
    const menuBorder = 7;
    rect(0, 0, W, menuBorder, '#020b17');
    rect(0, H - menuBorder, W, menuBorder, '#020b17');
    rect(0, 0, menuBorder, H, '#020b17');
    rect(W - menuBorder, 0, menuBorder, H, '#020b17');
  }

  function drawButton`
  );

  code = code.replace(
    /function drawButton\(b, label, primary = false\) \{[\s\S]*?\n  \}\n\n  function drawPosterTitle/,
`function drawButton(b, label, primary = false) {
    const fill = primary ? '#000000' : 'rgba(0,0,0,0.66)';
    rect(b.x, b.y, b.w, b.h, fill);
    if (primary) {
      stroke(b.x, b.y, b.w, b.h, '#061b36', 4);
    } else if (label !== 'HOW TO PLAY') {
      stroke(b.x, b.y, b.w, b.h, 'rgba(246,237,214,0.42)', 2);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f6edd6';
    ctx.shadowColor = 'rgba(0,0,0,0.60)';
    ctx.shadowBlur = 3;
    ctx.font = '700 15px Montserrat, Arial, sans-serif';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
  }

  function drawPosterTitle`
  );

  code = code.replace(
`    drawButton(buttons.how, 'HOW TO PLAY', false);`,
`    drawButton(buttons.how, 'HOW TO PLAY', false);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(216,200,168,0.86)';
    ctx.font = '700 9px Montserrat, Arial, sans-serif';
    ctx.fillText('Maker: QuantumPikachu (Reddit)', W / 2, H - 42);
    ctx.font = '500 9px Montserrat, Arial, sans-serif';
    ctx.fillText('Copyright: Paramount Pictures, Warner Bros. Entertainment, and Legendary Pictures', W / 2, H - 27);
    ctx.textAlign = 'left';`
  );

  code = code.replace(
    /function drawBrakeSignal\(\) \{[\s\S]*?\n  \}\n\n  function drawControls/,
`function drawBrakeSignal() {
    const flash = Math.floor(performance.now() / 180) % 2 === 0;
    rect(111, 130, 228, 54, flash ? 'rgba(214,67,61,0.90)' : 'rgba(13,45,77,0.90)');
    stroke(111, 130, 228, 54, '#fff0bd', 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff0bd';
    ctx.font = 'bold 26px Montserrat, Arial, sans-serif';
    ctx.fillText('TOM', W / 2, 156);
    ctx.font = '700 11px Montserrat, Arial, sans-serif';
    ctx.fillText('Hit the brake!', W / 2, 172);
    ctx.textAlign = 'left';
  }

  function drawControls`
  );

  code = code.replaceAll('SHORELINE', 'CLIFF').replaceAll('shoreline', 'cliff');

  (0, eval)(code + '\n//# sourceURL=fieldchase-runtime.js');
})();