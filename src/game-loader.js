(async () => {
  const baseUrl = 'src/game.js?base=15';
  const response = await fetch(baseUrl, { cache: 'no-store' });
  let code = await response.text();

  code = code.replace(
    /fetch\('assets\/menu-bg\.txt\?v=15', \{ cache: 'no-store' \}\)[\s\S]*?\.catch\(\(\) => \{ menuBgReady = false; \}\);/,
    "menuBg.onload = () => { menuBgReady = true; };\n  menuBg.src = 'assets/70282CA7-7E9E-472D-A931-2D9E3FAF72AF.jpg?v=22';"
  );

  code = code.replace(
    "  ctx.imageSmoothingEnabled = false;\n\n  const CAR_SCREEN_Y",
    "  ctx.imageSmoothingEnabled = false;\n\n  function trackGameEvent(name, params = {}) {\n    if (typeof window.gtag === 'function') {\n      window.gtag('event', name, params);\n    }\n  }\n\n  function buildGameAnalyticsPayload(result) {\n    const s = typeof scoreValue === 'function'\n      ? scoreValue()\n      : { align: Math.round(alignmentScore() * 100), stopGap: Math.max(0, Math.round(WATER_START - state.carY)), time: Math.max(0, state.gameTimer), score: 0 };\n    return {\n      result,\n      score: s.score,\n      alignment: s.align,\n      cliff_gap: s.stopGap,\n      time_left: Number(s.time.toFixed(1)),\n      distance_travelled: Math.round(state.carY)\n    };\n  }\n\n  const CAR_SCREEN_Y"
  );

  code = code.replace(
    "    state.transitionStartedAt = now;\n    input.pointers.clear();",
    "    state.transitionStartedAt = now;\n    trackGameEvent('game_start', { event_category: 'game' });\n    input.pointers.clear();"
  );

  code = code.replace(
    "        state.result = 'TRUCK STOPPED BEFORE THE SHORELINE';",
    "        state.result = 'TRUCK STOPPED BEFORE THE SHORELINE';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('win'));"
  );

  code = code.replace(
    "        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';",
    "        state.result = 'STOPPED IN TIME, BUT DRONE ALIGNMENT WAS OFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_alignment'));"
  );

  code = code.replace(
    "        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';",
    "        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_early_stop'));"
  );

  code = code.replace(
    "        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';",
    "        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_cliff'));"
  );

  code = code.replace(
    "        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';",
    "        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';\n        trackGameEvent('game_finish', buildGameAnalyticsPayload('fail_timeout'));"
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

  (0, eval)(code + '\n//# sourceURL=fieldchase-runtime.js');
})();