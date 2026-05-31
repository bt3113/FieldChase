(async () => {
  const baseUrl = 'src/game.js?base=15';
  const response = await fetch(baseUrl, { cache: 'no-store' });
  let code = await response.text();

  code = code.replace(
    /fetch\('assets\/menu-bg\.txt\?v=15', \{ cache: 'no-store' \}\)[\s\S]*?\.catch\(\(\) => \{ menuBgReady = false; \}\);/,
    "menuBg.onload = () => { menuBgReady = true; };\n  menuBg.src = 'assets/70282CA7-7E9E-472D-A931-2D9E3FAF72AF.jpg?v=27';"
  );

  code = code.replace(
    "  ctx.imageSmoothingEnabled = false;\n\n  const CAR_SCREEN_Y",
    "  ctx.imageSmoothingEnabled = false;\n\n  const GREEN_FIELD_LOOP_END = 13.0;\n  const gameAudio = { green: null, dry: null, brakes: null, current: null, active: false, field: '' };\n\n  function makeGameAudio(src, loop, volume) {\n    const audio = new Audio(src);\n    audio.loop = loop;\n    audio.volume = volume;\n    audio.preload = 'auto';\n    return audio;\n  }\n\n  function initGameAudio() {\n    if (gameAudio.green) return;\n    gameAudio.green = makeGameAudio('assets/Green%20Field.mp3?v=27', false, 0.54);\n    gameAudio.dry = makeGameAudio('assets/Dry%20Field.mp3?v=27', true, 0.54);\n    gameAudio.brakes = makeGameAudio('assets/Brakes.mp3?v=27', true, 0.68);\n  }\n\n  function playAudioTrack(track) {\n    if (!track) return;\n    const p = track.play();\n    if (p && typeof p.catch === 'function') p.catch(() => {});\n  }\n\n  function pauseAudioTrack(track, reset = false) {\n    if (!track) return;\n    track.pause();\n    if (reset) {\n      try { track.currentTime = 0; } catch (_) {}\n    }\n  }\n\n  function switchFieldAudio(field) {\n    if (!gameAudio.active || gameAudio.field === field) return;\n    const next = field === 'dry' ? gameAudio.dry : gameAudio.green;\n    if (gameAudio.current && gameAudio.current !== next) pauseAudioTrack(gameAudio.current, true);\n    gameAudio.current = next;\n    gameAudio.field = field;\n    if (next === gameAudio.green) { try { next.currentTime = 0; } catch (_) {} }\n    playAudioTrack(next);\n  }\n\n  function startGameAudio() {\n    initGameAudio();\n    gameAudio.active = true;\n    gameAudio.field = '';\n    switchFieldAudio('green');\n  }\n\n  function updateGameAudio() {\n    if (!gameAudio.active) return;\n    switchFieldAudio(state.carY >= CORN_END ? 'dry' : 'green');\n    if (gameAudio.current === gameAudio.green && gameAudio.green.currentTime >= GREEN_FIELD_LOOP_END) {\n      try { gameAudio.green.currentTime = 0; } catch (_) {}\n      playAudioTrack(gameAudio.green);\n    }\n    const brakingNow = state.braking && brakesUnlocked() && state.speed > 4 && (state.mode === 'intro' || state.mode === 'play');\n    if (brakingNow) {\n      if (gameAudio.current) gameAudio.current.volume = 0.32;\n      playAudioTrack(gameAudio.brakes);\n    } else {\n      if (gameAudio.current) gameAudio.current.volume = 0.54;\n      pauseAudioTrack(gameAudio.brakes, true);\n    }\n  }\n\n  function stopGameAudio() {\n    if (!gameAudio.green) return;\n    gameAudio.active = false;\n    gameAudio.field = '';\n    pauseAudioTrack(gameAudio.green, true);\n    pauseAudioTrack(gameAudio.dry, true);\n    pauseAudioTrack(gameAudio.brakes, true);\n    gameAudio.current = null;\n  }\n\n  function trackGameEvent(name, params = {}) {\n    if (typeof window.gtag === 'function') {\n      window.gtag('event', name, params);\n    }\n  }\n\n  function buildGameAnalyticsPayload(result) {\n    const s = typeof scoreValue === 'function'\n      ? scoreValue()\n      : { align: Math.round(alignmentScore() * 100), stopGap: Math.max(0, Math.round(WATER_START - state.carY)), time: Math.max(0, state.gameTimer), score: 0 };\n    return {\n      result,\n      score: s.score,\n      alignment: s.align,\n      cliff_gap: s.stopGap,\n      time_left: Number(s.time.toFixed(1)),\n      distance_travelled: Math.round(state.carY)\n    };\n  }\n\n  const CAR_SCREEN_Y"
  );

  code = code.replace(
    "    state.transitionStartedAt = now;\n    input.pointers.clear();",
    "    state.transitionStartedAt = now;\n    trackGameEvent('game_start', { event_category: 'game' });\n    startGameAudio();\n    input.pointers.clear();"
  );

  code = code.replace(
    "        state.result = 'TRUCK STOPPED BEFORE THE SHORELINE';",
    "        state.result = 'TRUCK STOPPED BEFORE THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('win'));\n        stopGameAudio();"
  );

  code = code.replace(
    "        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';",
    "        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_alignment'));\n        stopGameAudio();"
  );

  code = code.replace(
    "        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';",
    "        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_early_stop'));\n        stopGameAudio();"
  );

  code = code.replace(
    "        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';",
    "        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_cliff'));\n        stopGameAudio();"
  );

  code = code.replace(
    "        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';",
    "        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_timeout'));\n        stopGameAudio();"
  );

  code = code.replace(
    "    addDust(dt);\n  }",
    "    updateGameAudio();\n    addDust(dt);\n  }"
  );

  code = code.replace(
    "    state.mode = 'menu';\n    state.carX = 112;",
    "    stopGameAudio();\n    state.mode = 'menu';\n    state.carX = 112;"
  );

  code = code.replace(
    "    stroke(16, 36, W - 32, H - 82, 'rgba(246,237,214,0.58)', 2);\n    stroke(24, 44, W - 48, H - 98, 'rgba(246,237,214,0.20)', 1);",
    "    const menuBorder = 7;\n    rect(0, 0, W, menuBorder, '#020b17');\n    rect(0, H - menuBorder, W, menuBorder, '#020b17');\n    rect(0, 0, menuBorder, H, '#020b17');\n    rect(W - menuBorder, 0, menuBorder, H, '#020b17');"
  );

  code = code.replace(
    "    const fill = primary ? 'rgba(2,11,23,0.95)' : 'rgba(0,0,0,0.66)';\n    rect(b.x, b.y, b.w, b.h, fill);\n    stroke(b.x, b.y, b.w, b.h, primary ? '#0a2542' : 'rgba(246,237,214,0.42)', 2);\n    if (primary) stroke(b.x + 5, b.y + 5, b.w - 10, b.h - 10, 'rgba(246,237,214,0.13)', 1);",
    "    const fill = primary ? '#000000' : 'rgba(0,0,0,0.66)';\n    rect(b.x, b.y, b.w, b.h, fill);\n    stroke(b.x, b.y, b.w, b.h, primary ? '#061b36' : 'rgba(246,237,214,0.42)', primary ? 4 : 2);"
  );

  code = code.replace(
    "      ctx.imageSmoothingEnabled = false;\n      ctx.drawImage(menuBg, (W - dw) / 2, (H - dh) / 2, dw, dh);\n      ctx.imageSmoothingEnabled = false;",
    "      ctx.imageSmoothingEnabled = true;\n      ctx.drawImage(menuBg, (W - dw) / 2, (H - dh) / 2, dw, dh);\n      ctx.imageSmoothingEnabled = false;"
  );

  code = code.replaceAll('SHORELINE', 'CLIFF').replaceAll('shoreline', 'cliff');

  (0, eval)(code + '\n//# sourceURL=fieldchase-runtime.js');
})();