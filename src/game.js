(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.imageSmoothingEnabled = false;

  const CAR_SCREEN_Y = 610;
  const PX_PER_METER = 0.34;
  const CORN_END = 1840;
  const DRY_END = 3180;
  const WATER_START = 3180;
  const STOP_START = 2860;
  const STOP_END = 3170;
  const ROAD_END = 1820;
  const FIELD_LEFT = 94;
  const FIELD_RIGHT = 430;
  const START_SPEED = 185;
  const BRAKE_DECEL = 185;
  const BRAKE_TIMER_MAX = 5.6;

  const state = {
    mode: 'title',
    startedAt: 0,
    last: 0,
    carX: 132,
    carY: 0,
    speed: START_SPEED,
    steer: 0,
    braking: false,
    brakeTimer: BRAKE_TIMER_MAX,
    brakeTimerActive: false,
    message: '',
    trail: [],
    particles: [],
    droneOffset: 0,
    shake: 0,
    bestDistance: 0,
    result: ''
  };

  const input = {
    left: false,
    right: false,
    brake: false,
    pointerId: null
  };

  const palette = {
    skyA: '#e5bf6a', skyB: '#d69a3f',
    cornDark: '#1f391d', cornMid: '#365e25', cornLight: '#76934a', cornTip: '#c0a94e',
    road: '#b98a4c', roadDark: '#806035', dirt: '#c19a58',
    dry: '#bf8836', dry2: '#d0a048', dryDark: '#8b692f',
    water: '#377f93', waterDark: '#1e586b', foam: '#f8eab0',
    truck: '#182027', truck2: '#2b3540', rack: '#d3cab8', red: '#c95536',
    drone: '#101217', drone2: '#30323a', ui: '#f9e7b1'
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function worldToScreenY(worldY) { return CAR_SCREEN_Y - (worldY - state.carY) * PX_PER_METER; }
  function screenToWorldY(screenY) { return state.carY + (CAR_SCREEN_Y - screenY) / PX_PER_METER; }
  function hash(ix, iy) {
    let n = (ix * 374761393 + iy * 668265263) ^ (ix * iy * 1442695041);
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  function terrainAt(worldY) {
    if (worldY >= WATER_START) return 'water';
    if (worldY >= CORN_END) return 'dry';
    return 'corn';
  }

  function reset() {
    state.mode = 'intro';
    state.startedAt = performance.now();
    state.carX = 132;
    state.carY = 0;
    state.speed = START_SPEED;
    state.steer = 0;
    state.braking = false;
    state.brakeTimer = BRAKE_TIMER_MAX;
    state.brakeTimerActive = false;
    state.message = 'ENTERING FIELD';
    state.trail = [];
    state.particles = [];
    state.droneOffset = 0;
    state.shake = 0;
    state.result = '';
  }

  function restart() {
    state.mode = 'title';
    state.carX = 132;
    state.carY = 0;
    state.speed = START_SPEED;
    state.trail = [];
    state.particles = [];
    state.brakeTimer = BRAKE_TIMER_MAX;
    state.brakeTimerActive = false;
    state.result = '';
  }

  function droneX() {
    const base = 284 + Math.sin((state.carY + 260) * 0.004) * 62;
    return clamp(base, FIELD_LEFT + 70, FIELD_RIGHT - 38);
  }

  function droneY() {
    return Math.min(WATER_START - 170, state.carY + 830);
  }

  function alignmentScore() {
    const dx = Math.abs(state.carX - droneX());
    return clamp(1 - dx / 125, 0, 1);
  }

  function addTrail() {
    const terrain = terrainAt(state.carY);
    state.trail.push({ x: state.carX, y: state.carY, terrain, w: terrain === 'corn' ? 34 : 24 });
    if (state.trail.length > 620) state.trail.shift();
  }

  function addDust(dt) {
    const amount = state.speed > 18 ? 3 : 1;
    for (let i = 0; i < amount; i++) {
      const spread = terrainAt(state.carY) === 'corn' ? 24 : 36;
      state.particles.push({
        x: state.carX + (hash(Math.floor(state.carY + i * 3), i) - 0.5) * spread,
        y: state.carY - 24 - hash(i, Math.floor(state.carY)) * 22,
        life: 0.9 + hash(i + 4, Math.floor(state.carY)) * 0.5,
        age: 0,
        size: 2 + hash(i + 8, Math.floor(state.carY)) * 5
      });
    }
    state.particles = state.particles.filter(p => {
      p.age += dt;
      p.y -= 35 * dt;
      p.x += (hash(Math.floor(p.y), Math.floor(p.x)) - 0.5) * 15 * dt;
      return p.age < p.life;
    });
  }

  function update(dt, now) {
    if (state.mode === 'title' || state.mode === 'win' || state.mode === 'fail') return;

    let desiredSteer = 0;
    if (input.left) desiredSteer -= 1;
    if (input.right) desiredSteer += 1;
    state.steer = lerp(state.steer, desiredSteer, Math.min(1, dt * 7));
    state.braking = input.brake;

    if (state.mode === 'intro') {
      const t = clamp((now - state.startedAt) / 2600, 0, 1);
      state.carX = lerp(132, 246, ease(t));
      state.carY += START_SPEED * dt;
      if (t >= 1) {
        state.mode = 'play';
        state.message = 'ALIGN WITH DRONE';
      }
    } else {
      state.carX += state.steer * 150 * dt;
      state.carX = clamp(state.carX, FIELD_LEFT + 38, FIELD_RIGHT - 34);

      if (state.carY >= STOP_START && !state.brakeTimerActive) {
        state.brakeTimerActive = true;
        state.message = 'BRAKE WINDOW';
      }

      if (state.brakeTimerActive) {
        state.brakeTimer -= dt;
        if (state.braking) state.speed = Math.max(0, state.speed - BRAKE_DECEL * dt);
      } else {
        state.speed = START_SPEED;
      }

      if (!state.brakeTimerActive && state.braking) {
        state.message = 'BRAKES LOCK AFTER TIMER';
      }

      state.carY += state.speed * dt;
      state.bestDistance = Math.max(state.bestDistance, state.carY);

      const aligned = alignmentScore() > 0.62;
      const stopped = state.speed <= 7;
      const inStopZone = state.carY >= STOP_START && state.carY <= STOP_END;

      if (stopped && inStopZone && aligned) {
        state.mode = 'win';
        state.result = 'DRONE LOCKED - CAR STOPPED AT THE EDGE';
      } else if (stopped && inStopZone && !aligned) {
        state.mode = 'fail';
        state.result = 'STOPPED, BUT DRONE ALIGNMENT WAS OFF';
      } else if (state.carY > WATER_START + 12) {
        state.mode = 'fail';
        state.result = 'TOO LATE - THE TRUCK REACHED THE WATER';
      } else if (state.brakeTimerActive && state.brakeTimer <= 0 && !stopped) {
        state.mode = 'fail';
        state.result = 'BRAKE TIMER EXPIRED';
      }
    }

    addTrail();
    addDust(dt);
  }

  function drawPixelRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawTerrainBand() {
    ctx.fillStyle = palette.cornDark;
    ctx.fillRect(0, 0, W, H);

    const horizon = 52;
    const yCornEnd = worldToScreenY(CORN_END);
    const yWater = worldToScreenY(WATER_START);

    drawSky(horizon);

    const cornTop = clamp(yCornEnd, horizon, H);
    if (cornTop < H) drawCorn(cornTop, H);

    const dryTop = clamp(yWater, horizon, H);
    const dryBottom = clamp(yCornEnd, horizon, H);
    if (dryTop < dryBottom) drawDry(dryTop, dryBottom);

    if (yWater < H) drawWater(horizon, clamp(yWater, horizon, H));

    drawRoad();
  }

  function drawSky(horizon) {
    for (let y = 0; y < horizon; y += 4) {
      const t = y / horizon;
      ctx.fillStyle = t < 0.45 ? '#eecb7c' : '#d7a555';
      ctx.fillRect(0, y, W, 4);
    }
    drawPixelRect(36, 26, 52, 3, '#f6e6a9');
    drawPixelRect(300, 18, 38, 4, '#f6e6a9');
    drawPixelRect(320, 22, 72, 3, '#f6e6a9');
    drawPixelRect(376, 34, 28, 3, '#eed08d');
  }

  function drawCorn(y0, y1) {
    drawPixelRect(0, y0, W, y1 - y0, palette.cornDark);
    const stepY = 12;
    const stepX = 8;
    const worldStart = Math.floor(screenToWorldY(y1) / 18) - 2;
    const worldEnd = Math.ceil(screenToWorldY(y0) / 18) + 3;
    for (let gy = worldStart; gy <= worldEnd; gy++) {
      const wy = gy * 18;
      const sy = worldToScreenY(wy);
      if (sy < y0 - 16 || sy > y1 + 16) continue;
      const offset = (gy % 2) * 3;
      for (let x = FIELD_LEFT - 24 + offset; x < W + 12; x += stepX) {
        const r = hash(Math.floor(x / stepX), gy);
        if (r < 0.14) continue;
        const h = 7 + Math.floor(r * 7);
        const c = r > 0.68 ? palette.cornLight : r > 0.34 ? palette.cornMid : '#27491f';
        drawPixelRect(x, sy - h, 2, h, c);
        if (r > 0.53) drawPixelRect(x + 1, sy - h - 1, 2, 2, palette.cornTip);
      }
    }
  }

  function drawDry(y0, y1) {
    drawPixelRect(0, y0, W, y1 - y0, palette.dry);
    const worldStart = Math.floor(screenToWorldY(y1) / 22) - 2;
    const worldEnd = Math.ceil(screenToWorldY(y0) / 22) + 3;
    for (let gy = worldStart; gy <= worldEnd; gy++) {
      const wy = gy * 22;
      const sy = worldToScreenY(wy);
      if (sy < y0 - 10 || sy > y1 + 10) continue;
      ctx.fillStyle = gy % 2 ? '#d0a04a' : '#b77e31';
      ctx.fillRect(0, Math.round(sy), W, 2);
      for (let x = 0; x < W; x += 18) {
        const r = hash(Math.floor(x / 18), gy + 91);
        if (r > 0.72) {
          drawPixelRect(x + r * 5, sy - 2, 7, 2, palette.dryDark);
          drawPixelRect(x + 2, sy - 6, 2, 5, '#6f6b2a');
        }
      }
    }
  }

  function drawWater(y0, y1) {
    drawPixelRect(0, y0, W, y1 - y0, palette.waterDark);
    for (let y = Math.floor(y0); y < y1; y += 8) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      ctx.fillStyle = t > 0.52 ? palette.water : '#2d7188';
      ctx.fillRect(0, y, W, 8);
      for (let x = 0; x < W; x += 18) {
        const r = hash(Math.floor(x / 18), Math.floor(screenToWorldY(y) / 20));
        if (r > 0.72 || Math.abs(x - W / 2) < 54 * (1 - t)) {
          drawPixelRect(x + r * 7, y + 2, 8 + r * 14, 2, palette.foam);
        }
      }
    }
    const shoreY = worldToScreenY(WATER_START);
    if (shoreY > 0 && shoreY < H) {
      drawPixelRect(0, shoreY - 3, W, 3, '#e4bc61');
      drawPixelRect(0, shoreY + 1, W, 2, '#c99a52');
    }
  }

  function drawRoad() {
    if (state.carY > ROAD_END + 650) return;
    const visibleRoadTop = worldToScreenY(ROAD_END);
    const y0 = clamp(visibleRoadTop, 0, H);
    drawPixelRect(18, y0, 54, H - y0, palette.road);
    drawPixelRect(18, y0, 3, H - y0, '#4d5f29');
    drawPixelRect(72, y0, 5, H - y0, '#365021');
    for (let y = Math.floor(y0); y < H; y += 10) {
      drawPixelRect(31, y, 2, 6, palette.roadDark);
      drawPixelRect(58, y + 2, 2, 5, palette.roadDark);
      if (hash(1, y) > 0.68) drawPixelRect(75 + hash(y, 2) * 10, y, 5, 4, '#293e1e');
    }
  }

  function drawTrail() {
    for (const p of state.trail) {
      const sy = worldToScreenY(p.y);
      if (sy < -40 || sy > H + 40) continue;
      const t = terrainAt(p.y);
      const w = t === 'corn' ? p.w : 18;
      drawPixelRect(p.x - w / 2, sy - 5, w, 10, t === 'corn' ? '#8b6f38' : '#b7853f');
      drawPixelRect(p.x - w / 2 + 4, sy - 7, 4, 14, '#d0a057');
      drawPixelRect(p.x + w / 2 - 8, sy - 7, 4, 14, '#d0a057');
      if (t === 'corn') {
        drawPixelRect(p.x - w / 2 - 3, sy - 2, 8, 3, '#243f1b');
        drawPixelRect(p.x + w / 2 - 4, sy + 1, 8, 3, '#243f1b');
      }
    }
  }

  function drawDust() {
    for (const p of state.particles) {
      const sy = worldToScreenY(p.y);
      if (sy < -20 || sy > H + 20) continue;
      const alpha = 1 - p.age / p.life;
      ctx.globalAlpha = alpha * 0.7;
      drawPixelRect(p.x - p.size / 2, sy - p.size / 2, p.size, p.size, '#d6ac62');
      ctx.globalAlpha = 1;
    }
  }

  function drawTruck() {
    const x = state.carX;
    const y = CAR_SCREEN_Y;
    const lean = state.steer * 5;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(lean * Math.PI / 180);
    drawPixelRect(-16, -28, 32, 48, palette.truck);
    drawPixelRect(-13, -24, 26, 12, palette.truck2);
    drawPixelRect(-12, -7, 24, 21, '#11171c');
    drawPixelRect(-10, -20, 20, 4, '#6a7474');
    drawPixelRect(-14, 17, 8, 3, palette.red);
    drawPixelRect(6, 17, 8, 3, palette.red);
    drawPixelRect(-17, -18, 3, 31, '#0c1012');
    drawPixelRect(14, -18, 3, 31, '#0c1012');
    drawPixelRect(-13, -31, 26, 4, palette.rack);
    drawPixelRect(-13, -28, 3, 12, palette.rack);
    drawPixelRect(10, -28, 3, 12, palette.rack);
    drawPixelRect(-8, -28, 16, 2, palette.rack);
    ctx.restore();
  }

  function drawDrone() {
    const x = droneX();
    const y = worldToScreenY(droneY());
    if (y < -50 || y > H + 50) return;
    drawPixelRect(x - 9, y + 42, 18, 5, 'rgba(0, 0, 0, 0.28)');
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    drawPixelRect(-38, 0, 76, 5, palette.drone);
    drawPixelRect(-30, -4, 60, 4, palette.drone2);
    drawPixelRect(-18, -10, 36, 18, '#161a20');
    drawPixelRect(-5, -15, 10, 22, '#343944');
    drawPixelRect(-34, 5, 18, 4, '#0a0d10');
    drawPixelRect(16, 5, 18, 4, '#0a0d10');
    drawPixelRect(-2, 7, 4, 4, '#b24b32');
    ctx.restore();
  }

  function drawHud() {
    const dist = Math.max(0, Math.floor(WATER_START - state.carY));
    const align = alignmentScore();
    const timeToEdge = state.speed > 0 ? Math.max(0, (WATER_START - state.carY) / state.speed) : 0;

    ctx.fillStyle = 'rgba(9, 13, 8, 0.66)';
    ctx.fillRect(12, 12, 426, 72);
    ctx.fillStyle = palette.ui;
    ctx.font = '12px monospace';
    ctx.fillText('FIELD CHASE', 24, 30);
    ctx.fillText('DIST ' + dist + 'm', 24, 50);
    ctx.fillText('TIME ' + timeToEdge.toFixed(1) + 's', 126, 50);
    ctx.fillText('ALIGN', 244, 50);
    drawPixelRect(292, 42, 94, 8, '#44351f');
    drawPixelRect(292, 42, 94 * align, 8, align > 0.62 ? '#f2d46d' : '#c95b3d');

    if (state.brakeTimerActive) {
      ctx.fillText('BRAKE ' + Math.max(0, state.brakeTimer).toFixed(1) + 's', 24, 70);
      drawPixelRect(126, 62, 184, 7, '#44351f');
      drawPixelRect(126, 62, 184 * Math.max(0, state.brakeTimer / BRAKE_TIMER_MAX), 7, '#f0bc4c');
    } else {
      ctx.fillText(state.message || 'HOLD LEFT / RIGHT TO STEER', 24, 70);
    }

    if (state.mode === 'play' || state.mode === 'intro') {
      ctx.fillStyle = 'rgba(9, 13, 8, 0.42)';
      ctx.fillRect(20, H - 78, 118, 46);
      ctx.fillRect(W - 138, H - 78, 118, 46);
      ctx.fillRect(160, H - 78, 130, 46);
      ctx.fillStyle = palette.ui;
      ctx.font = '11px monospace';
      ctx.fillText('LEFT', 61, H - 50);
      ctx.fillText('BRAKE', 204, H - 50);
      ctx.fillText('RIGHT', W - 99, H - 50);
    }
  }

  function drawTitle() {
    drawTerrainBand();
    drawTrail();
    drawTruck();
    drawDrone();
    ctx.fillStyle = 'rgba(5, 8, 5, 0.58)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = palette.ui;
    ctx.textAlign = 'center';
    ctx.font = '25px monospace';
    ctx.fillText('FIELD CHASE', W / 2, 260);
    ctx.font = '12px monospace';
    ctx.fillText('ALIGN WITH THE DRONE', W / 2, 296);
    ctx.fillText('REACH THE SHORE AND STOP IN TIME', W / 2, 318);
    ctx.fillText('TAP TO START', W / 2, 382);
    ctx.fillText('A/D OR ARROWS TO STEER  SPACE TO BRAKE', W / 2, 420);
    ctx.textAlign = 'left';
  }

  function drawResult() {
    drawTerrainBand();
    drawTrail();
    drawDust();
    drawTruck();
    drawDrone();
    drawHud();
    ctx.fillStyle = 'rgba(5, 8, 5, 0.64)';
    ctx.fillRect(0, 255, W, 184);
    ctx.fillStyle = state.mode === 'win' ? '#f4df83' : '#ef9a70';
    ctx.textAlign = 'center';
    ctx.font = '18px monospace';
    ctx.fillText(state.mode === 'win' ? 'MISSION COMPLETE' : 'CHASE FAILED', W / 2, 310);
    ctx.font = '12px monospace';
    const lines = wrapText(state.result, 34);
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 342 + i * 18));
    ctx.fillText('TAP TO RESTART', W / 2, 402);
    ctx.textAlign = 'left';
  }

  function wrapText(text, max) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + word).length > max) {
        lines.push(line.trim());
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function draw() {
    if (state.mode === 'title') {
      drawTitle();
      return;
    }
    if (state.mode === 'win' || state.mode === 'fail') {
      drawResult();
      return;
    }
    drawTerrainBand();
    drawTrail();
    drawDust();
    drawDrone();
    drawTruck();
    drawHud();
  }

  function loop(now) {
    if (!state.last) state.last = now;
    const dt = Math.min(0.033, (now - state.last) / 1000);
    state.last = now;
    update(dt, now);
    draw();
    requestAnimationFrame(loop);
  }

  function setPointerControls(e, down) {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    if (!down) {
      input.left = false;
      input.right = false;
      input.brake = false;
      input.pointerId = null;
      return;
    }
    if (state.mode === 'title') {
      reset();
      return;
    }
    if (state.mode === 'win' || state.mode === 'fail') {
      restart();
      return;
    }
    input.pointerId = e.pointerId;
    input.brake = y > H - 120 && x > 150 && x < 305;
    input.left = !input.brake && x < W / 2;
    input.right = !input.brake && x >= W / 2;
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    setPointerControls(e, true);
  });
  canvas.addEventListener('pointermove', e => {
    if (input.pointerId === e.pointerId) setPointerControls(e, true);
  });
  canvas.addEventListener('pointerup', e => setPointerControls(e, false));
  canvas.addEventListener('pointercancel', e => setPointerControls(e, false));

  window.addEventListener('keydown', e => {
    if (state.mode === 'title') reset();
    if (state.mode === 'win' || state.mode === 'fail') restart();
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') input.left = true;
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') input.right = true;
    if (e.key === ' ' || e.key === 'ArrowDown' || e.key.toLowerCase() === 's') input.brake = true;
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') input.left = false;
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') input.right = false;
    if (e.key === ' ' || e.key === 'ArrowDown' || e.key.toLowerCase() === 's') input.brake = false;
  });

  requestAnimationFrame(loop);
})();
