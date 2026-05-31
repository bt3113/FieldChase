(async () => {
  const baseUrl = 'src/game.js?base=15';
  const response = await fetch(baseUrl, { cache: 'no-store' });
  let code = await response.text();

  code = code.replace(
    /fetch\('assets\/menu-bg\.txt\?v=15', \{ cache: 'no-store' \}\)[\s\S]*?\.catch\(\(\) => \{ menuBgReady = false; \}\);/,
    "menuBg.onload = () => { menuBgReady = true; };\n  menuBg.src = 'assets/70282CA7-7E9E-472D-A931-2D9E3FAF72AF.jpg?v=24';"
  );

  code = code.replace(
    "  ctx.imageSmoothingEnabled = false;\n\n  const CAR_SCREEN_Y",
    "  ctx.imageSmoothingEnabled = false;\n\n  const chaseAudio = { ctx: null, master: null, engine: null, sub: null, seq: null, running: false };\n\n  function trackGameEvent(name, params = {}) {\n    if (typeof window.gtag === 'function') {\n      window.gtag('event', name, params);\n    }\n  }\n\n  function startChaseAudio() {\n    try {\n      const AudioCtx = window.AudioContext || window.webkitAudioContext;\n      if (!AudioCtx || chaseAudio.running) return;\n      const audioCtx = new AudioCtx();\n      chaseAudio.ctx = audioCtx;\n      audioCtx.resume();\n\n      const master = audioCtx.createGain();\n      master.gain.setValueAtTime(0.0001, audioCtx.currentTime);\n      master.gain.exponentialRampToValueAtTime(0.16, audioCtx.currentTime + 0.75);\n      master.connect(audioCtx.destination);\n\n      const engine = audioCtx.createOscillator();\n      const engineGain = audioCtx.createGain();\n      engine.type = 'sawtooth';\n      engine.frequency.setValueAtTime(56, audioCtx.currentTime);\n      engineGain.gain.setValueAtTime(0.055, audioCtx.currentTime);\n      engine.connect(engineGain);\n      engineGain.connect(master);\n      engine.start();\n\n      const sub = audioCtx.createOscillator();\n      const subGain = audioCtx.createGain();\n      sub.type = 'triangle';\n      sub.frequency.setValueAtTime(32, audioCtx.currentTime);\n      subGain.gain.setValueAtTime(0.045, audioCtx.currentTime);\n      sub.connect(subGain);\n      subGain.connect(master);\n      sub.start();\n\n      chaseAudio.master = master;\n      chaseAudio.engine = engine;\n      chaseAudio.sub = sub;\n      chaseAudio.running = true;\n\n      const notes = [43, 43, 55, 50, 48, 50, 43, 38];\n      let step = 0;\n      chaseAudio.seq = window.setInterval(() => {\n        if (!chaseAudio.running || !chaseAudio.ctx || !chaseAudio.master) return;\n        const t = chaseAudio.ctx.currentTime;\n        const note = notes[step++ % notes.length];\n        const freq = 440 * Math.pow(2, (note - 69) / 12);\n        const osc = chaseAudio.ctx.createOscillator();\n        const gain = chaseAudio.ctx.createGain();\n        osc.type = 'sine';\n        osc.frequency.setValueAtTime(freq, t);\n        gain.gain.setValueAtTime(0.0001, t);\n        gain.gain.exponentialRampToValueAtTime(0.038, t + 0.025);\n        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);\n        osc.connect(gain);\n        gain.connect(chaseAudio.master);\n        osc.start(t);\n        osc.stop(t + 0.42);\n      }, 420);\n    } catch (err) {\n      console.warn('Audio unavailable', err);\n    }\n  }\n\n  function updateChaseAudio() {\n    if (!chaseAudio.running || !chaseAudio.ctx) return;\n    const t = chaseAudio.ctx.currentTime;\n    const drive = Math.max(0, Math.min(1, state.speed / CRUISE_SPEED));\n    if (chaseAudio.engine) chaseAudio.engine.frequency.setTargetAtTime(42 + drive * 48, t, 0.08);\n    if (chaseAudio.sub) chaseAudio.sub.frequency.setTargetAtTime(26 + drive * 17, t, 0.12);\n  }\n\n  function stopChaseAudio() {\n    if (!chaseAudio.running) return;\n    chaseAudio.running = false;\n    if (chaseAudio.seq) window.clearInterval(chaseAudio.seq);\n    chaseAudio.seq = null;\n    try {\n      const ctxA = chaseAudio.ctx;\n      const t = ctxA ? ctxA.currentTime : 0;\n      if (chaseAudio.master && ctxA) {\n        chaseAudio.master.gain.cancelScheduledValues(t);\n        chaseAudio.master.gain.setValueAtTime(Math.max(chaseAudio.master.gain.value, 0.0001), t);\n        chaseAudio.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);\n      }\n      window.setTimeout(() => {\n        try { if (chaseAudio.engine) chaseAudio.engine.stop(); } catch (_) {}\n        try { if (chaseAudio.sub) chaseAudio.sub.stop(); } catch (_) {}\n        try { if (chaseAudio.ctx) chaseAudio.ctx.close(); } catch (_) {}\n        chaseAudio.ctx = chaseAudio.master = chaseAudio.engine = chaseAudio.sub = null;\n      }, 650);\n    } catch (_) {}\n  }\n\n  function buildGameAnalyticsPayload(result) {\n    const s = typeof scoreValue === 'function'\n      ? scoreValue()\n      : { align: Math.round(alignmentScore() * 100), stopGap: Math.max(0, Math.round(WATER_START - state.carY)), time: Math.max(0, state.gameTimer), score: 0 };\n    return {\n      result,\n      score: s.score,\n      alignment: s.align,\n      cliff_gap: s.stopGap,\n      time_left: Number(s.time.toFixed(1)),\n      distance_travelled: Math.round(state.carY)\n    };\n  }\n\n  const CAR_SCREEN_Y"
  );

  code = code.replace(
    "    state.transitionStartedAt = now;\n    input.pointers.clear();",
    "    state.transitionStartedAt = now;\n    trackGameEvent('game_start', { event_category: 'game' });\n    startChaseAudio();\n    input.pointers.clear();"
  );

  code = code.replace(
    "        state.result = 'TRUCK STOPPED BEFORE THE SHORELINE';",
    "        state.result = 'TRUCK STOPPED BEFORE THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('win'));\n        stopChaseAudio();"
  );

  code = code.replace(
    "        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';",
    "        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_alignment'));\n        stopChaseAudio();"
  );

  code = code.replace(
    "        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';",
    "        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_early_stop'));\n        stopChaseAudio();"
  );

  code = code.replace(
    "        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';",
    "        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_cliff'));\n        stopChaseAudio();"
  );

  code = code.replace(
    "        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';",
    "        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_timeout'));\n        stopChaseAudio();"
  );

  code = code.replace(
    "    addDust(dt);\n  }",
    "    updateChaseAudio();\n    addDust(dt);\n  }"
  );

  code = code.replace(
    "    state.mode = 'menu';\n    state.carX = 112;",
    "    stopChaseAudio();\n    state.mode = 'menu';\n    state.carX = 112;"
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