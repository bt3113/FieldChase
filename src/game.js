(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;
  ctx.imageSmoothingEnabled = false;

  const CAR_SCREEN_Y = 618;
  const PX_PER_METER = 0.23;
  const CORN_END = 3300;
  const WATER_START = 5650;
  const STOP_START = 5200;
  const STOP_END = 5580;
  const ROAD_END = 3300;
  const FIELD_LEFT = 82;
  const FIELD_RIGHT = 428;
  const CRUISE_SPEED = 168;
  const BRAKE_DECEL = 118;
  const BRAKE_TIMER_MAX = 7.8;
  const ALIGN_THRESHOLD = 0.62;

  const state = {
    mode: 'title',
    startedAt: 0,
    last: 0,
    carX: 112,
    carY: 0,
    speed: CRUISE_SPEED,
    steer: 0,
    braking: false,
    brakeTimer: BRAKE_TIMER_MAX,
    brakeTimerActive: false,
    message: '',
    trail: [],
    dust: [],
    result: '',
    nextTrailAt: 0,
    roadExitX: 242
  };

  const input = {
    keys: { left: false, right: false, brake: false },
    pointers: new Map(),
    left: false,
    right: false,
    brake: false
  };

  const palette = {
    skyTop: '#f4d889', skyLow: '#d7a757', cloud: '#f7e4a6', haze: '#cca05c',
    cornBase: '#172b16', cornDeep: '#203d1c', cornMid: '#3d6428', cornLight: '#7f9143', cornTip: '#c8ad4f',
    road: '#ba8b4b', roadLight: '#d0a666', roadDark: '#785931', hedge: '#243d1b',
    dirt: '#c89b55', dirtDark: '#75532b', trailCorn: '#9a7438', trailDust: '#d5a65d',
    dry: '#bc8134', dryLight: '#d19d4d', dryDark: '#8a612d', dryGreen: '#6f7430',
    water: '#367f94', waterDeep: '#1d5d74', waterLight: '#7cc1c4', sparkle: '#ffeeb5',
    truck: '#12191f', truck2: '#25313c', truckHi: '#6f7f82', rack: '#d7cdbb', tail: '#cf563b',
    drone: '#0b0d12', droneHi: '#333844', droneEdge: '#5d6270', ui: '#ffe8a6'
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function terrainAt(worldY) {
    if (worldY >= WATER_START) return 'water';
    if (worldY >= CORN_END) return 'dry';
    return 'corn';
  }
  function worldToScreenY(worldY) { return CAR_SCREEN_Y - (worldY - state.carY) * PX_PER_METER; }
  function screenToWorldY(screenY) { return state.carY + (CAR_SCREEN_Y - screenY) / PX_PER_METER; }
  function hash(ix, iy) {
    let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function drawRotatedRect(x, y, w, h, angle, color) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h));
    ctx.restore();
  }

  function reset() {
    state.mode = 'intro';
    state.startedAt = performance.now();
    state.last = 0;
    state.carX = 108;
    state.carY = 0;
    state.speed = CRUISE_SPEED;
    state.steer = 0;
    state.braking = false;
    state.brakeTimer = BRAKE_TIMER_MAX;
    state.brakeTimerActive = false;
    state.message = 'ENTERING FIELD';
    state.trail = [];
    state.dust = [];
    state.result = '';
    state.nextTrailAt = 0;
  }

  function restart() {
    input.pointers.clear();
    input.keys.left = input.keys.right = input.keys.brake = false;
    refreshInput();
    state.mode = 'title';
    state.carX = 112;
    state.carY = 0;
    state.speed = CRUISE_SPEED;
    state.brakeTimer = BRAKE_TIMER_MAX;
    state.brakeTimerActive = false;
    state.trail = [];
    state.dust = [];
    state.result = '';
    state.nextTrailAt = 0;
  }

  function droneX() {
    const drift = Math.sin((state.carY + 420) * 0.0032) * 82 + Math.sin(state.carY * 0.0012) * 22;
    return clamp(255 + drift, FIELD_LEFT + 78, FIELD_RIGHT - 36);
  }

  function droneY() {
    return Math.min(WATER_START - 230, state.carY + 1120);
  }

  function alignmentScore() {
    const dx = Math.abs(state.carX - droneX());
    return clamp(1 - dx / 132, 0, 1);
  }

  function pushTrail() {
    const last = state.trail[state.trail.length - 1];
    const y = state.carY - 20;
    const x = state.carX;
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 1;
    const angle = Math.atan2(dx, -dy);
    const terrain = terrainAt(y);
    state.trail.push({
      x, y, angle,
      terrain,
      width: terrain === 'corn' ? 42 : 30,
      seed: Math.floor(y * 7 + x * 11)
    });
    if (state.trail.length > 1100) state.trail.shift();
  }

  function addDust(dt) {
    if (state.speed < 10) return;
    const terrain = terrainAt(state.carY);
    const count = terrain === 'corn' ? 4 : 5;
    for (let i = 0; i < count; i++) {
      const r = hash(Math.floor(state.carY) + i, Math.floor(state.carX));
      state.dust.push({
        x: state.carX + (r - 0.5) * (terrain === 'corn' ? 30 : 44),
        y: state.carY - 34 - hash(i, Math.floor(state.carY)) * 44,
        vx: (hash(i + 3, Math.floor(state.carY)) - 0.5) * 20,
        vy: -22 - hash(i + 9, Math.floor(state.carY)) * 22,
        age: 0,
        life: 0.8 + r * 0.85,
        size: 2 + r * (terrain === 'corn' ? 5 : 8)
      });
    }
    state.dust = state.dust.filter(p => {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 2.5;
      return p.age < p.life;
    });
  }

  function refreshInput() {
    let pointerLeft = false;
    let pointerRight = false;
    let pointerBrake = false;
    for (const p of input.pointers.values()) {
      if (p.brake) pointerBrake = true;
      if (p.left) pointerLeft = true;
      if (p.right) pointerRight = true;
    }
    input.left = input.keys.left || pointerLeft;
    input.right = input.keys.right || pointerRight;
    input.brake = input.keys.brake || pointerBrake;
  }

  function update(dt, now) {
    if (state.mode === 'title' || state.mode === 'win' || state.mode === 'fail') return;

    refreshInput();
    let desiredSteer = 0;
    if (input.left) desiredSteer -= 1;
    if (input.right) desiredSteer += 1;
    state.steer = lerp(state.steer, desiredSteer, Math.min(1, dt * 6.5));
    state.braking = input.brake;

    if (state.mode === 'intro') {
      const t = clamp((now - state.startedAt) / 3400, 0, 1);
      state.carX = lerp(108, state.roadExitX, smooth(t));
      state.carY += CRUISE_SPEED * dt;
      state.speed = CRUISE_SPEED;
      if (t >= 1) {
        state.mode = 'play';
        state.message = 'ALIGN WITH DRONE';
      }
    } else {
      const maxSteer = state.brakeTimerActive ? 118 : 146;
      state.carX += state.steer * maxSteer * dt;
      state.carX = clamp(state.carX, FIELD_LEFT + 40, FIELD_RIGHT - 30);

      if (state.carY >= STOP_START && !state.brakeTimerActive) {
        state.brakeTimerActive = true;
        state.message = 'BRAKE WINDOW';
      }

      if (state.brakeTimerActive) {
        state.brakeTimer -= dt;
        if (state.braking) state.speed = Math.max(0, state.speed - BRAKE_DECEL * dt);
        else state.speed = Math.min(CRUISE_SPEED, state.speed + 18 * dt);
      } else {
        state.speed = CRUISE_SPEED;
        if (state.braking) state.message = 'BRAKE LOCKED UNTIL SHORE';
      }

      state.carY += state.speed * dt;

      const aligned = alignmentScore() > ALIGN_THRESHOLD;
      const stopped = state.speed <= 6;
      const inStopZone = state.carY >= STOP_START && state.carY <= STOP_END;
      if (stopped && inStopZone && aligned) {
        state.mode = 'win';
        state.result = 'DRONE LOCKED - TRUCK STOPPED AT THE SHORELINE';
      } else if (stopped && inStopZone && !aligned) {
        state.mode = 'fail';
        state.result = 'STOPPED IN TIME, BUT THE TRUCK WAS NOT ALIGNED WITH THE DRONE';
      } else if (state.carY > WATER_START + 34) {
        state.mode = 'fail';
        state.result = 'TOO LATE - THE TRUCK HIT THE WATER';
      } else if (state.brakeTimerActive && state.brakeTimer <= 0 && !stopped) {
        state.mode = 'fail';
        state.result = 'BRAKE TIMER EXPIRED BEFORE THE TRUCK STOPPED';
      }
    }

    if (state.carY >= state.nextTrailAt) {
      pushTrail();
      state.nextTrailAt = state.carY + 12;
    }
    addDust(dt);
  }

  function drawWorld() {
    drawRect(0, 0, W, H, palette.cornBase);
    const horizon = 54;
    const yCornEnd = worldToScreenY(CORN_END);
    const yWater = worldToScreenY(WATER_START);

    drawSky(horizon);

    const waterBottom = clamp(yWater, horizon, H);
    if (yWater < H) drawWater(horizon, waterBottom);

    const dryTop = clamp(yWater, horizon, H);
    const dryBottom = clamp(yCornEnd, horizon, H);
    if (dryTop < dryBottom) drawDryField(dryTop, dryBottom);

    const cornTop = clamp(yCornEnd, horizon, H);
    if (cornTop < H) drawCornfield(cornTop, H);

    drawFarFarms(horizon);
    drawRoad();
  }

  function drawSky(horizon) {
    for (let y = 0; y < horizon; y += 3) {
      const t = y / horizon;
      ctx.fillStyle = t < 0.5 ? palette.skyTop : palette.skyLow;
      ctx.fillRect(0, y, W, 3);
    }
    drawRect(18, 31, 54, 3, palette.cloud);
    drawRect(98, 20, 34, 3, palette.cloud);
    drawRect(278, 17, 38, 4, palette.cloud);
    drawRect(310, 22, 78, 3, palette.cloud);
    drawRect(392, 35, 32, 3, '#efd38d');
  }

  function drawFarFarms(horizon) {
    if (state.carY > CORN_END - 200) return;
    const top = horizon;
    drawRect(0, top, W, 18, '#c4934c');
    for (let i = 0; i < 8; i++) {
      const y = top + 4 + i * 3;
      const c = i % 2 ? '#d2a353' : '#b77e37';
      drawRect(0, y, W, 1, c);
    }
    drawRect(346, horizon - 12, 12, 20, '#6d6241');
    drawRect(360, horizon - 20, 9, 28, '#786b45');
    drawRect(370, horizon - 7, 30, 10, '#6d6241');
  }

  function drawCornfield(y0, y1) {
    drawRect(0, y0, W, y1 - y0, palette.cornBase);
    const worldStart = Math.floor(screenToWorldY(y1) / 16) - 3;
    const worldEnd = Math.ceil(screenToWorldY(y0) / 16) + 4;
    for (let gy = worldStart; gy <= worldEnd; gy++) {
      const wy = gy * 16;
      const sy = worldToScreenY(wy);
      if (sy < y0 - 18 || sy > y1 + 18) continue;
      const perspective = clamp(1.1 - sy / H * 0.45, 0.72, 1.05);
      const stepX = 7;
      for (let x = FIELD_LEFT - 30 + (gy % 3) * 2; x < W + 20; x += stepX) {
        const r = hash(Math.floor(x / stepX), gy);
        if (r < 0.09) continue;
        const h = Math.floor((6 + r * 10) * perspective);
        const col = r > 0.72 ? palette.cornLight : r > 0.35 ? palette.cornMid : palette.cornDeep;
        drawRect(x, sy - h, 2, h, col);
        if (r > 0.5) drawRect(x + 1, sy - h - 1, 2, 2, palette.cornTip);
        if (r > 0.82) drawRect(x - 2, sy - Math.floor(h * 0.45), 3, 2, '#284a20');
      }
    }
  }

  function drawDryField(y0, y1) {
    drawRect(0, y0, W, y1 - y0, palette.dry);
    const worldStart = Math.floor(screenToWorldY(y1) / 26) - 3;
    const worldEnd = Math.ceil(screenToWorldY(y0) / 26) + 4;
    for (let gy = worldStart; gy <= worldEnd; gy++) {
      const sy = worldToScreenY(gy * 26);
      if (sy < y0 - 16 || sy > y1 + 16) continue;
      drawRect(0, sy, W, 2, gy % 2 ? palette.dryLight : '#ae742e');
      for (let x = 0; x < W; x += 16) {
        const r = hash(Math.floor(x / 16), gy + 99);
        if (r > 0.68) {
          drawRect(x + r * 7, sy - 3, 8, 2, palette.dryDark);
          if (r > 0.87) drawRect(x + 2, sy - 8, 2, 7, palette.dryGreen);
        }
      }
    }
  }

  function drawWater(y0, y1) {
    drawRect(0, y0, W, y1 - y0, palette.waterDeep);
    for (let y = Math.floor(y0); y < y1; y += 6) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      ctx.fillStyle = t > 0.48 ? palette.water : '#2a6c84';
      ctx.fillRect(0, y, W, 6);
      for (let x = 0; x < W; x += 14) {
        const r = hash(Math.floor(x / 14), Math.floor(screenToWorldY(y) / 19));
        const sun = Math.max(0, 1 - Math.abs(x - W * 0.53) / (120 - t * 44));
        if (r > 0.8 || sun > 0.42) {
          const len = 4 + Math.floor((r + sun) * 12);
          drawRect(x + r * 5, y + 2, len, 2, sun > 0.4 ? palette.sparkle : palette.waterLight);
        }
      }
    }
    const shore = worldToScreenY(WATER_START);
    if (shore > -8 && shore < H + 8) {
      drawRect(0, shore - 3, W, 3, '#e5bd67');
      drawRect(0, shore, W, 2, '#f0d28a');
      drawRect(0, shore + 3, W, 2, '#b97c36');
    }
  }

  function drawRoad() {
    if (state.carY > ROAD_END + 680) return;
    const top = clamp(worldToScreenY(ROAD_END), 0, H);
    drawRect(18, top, 52, H - top, palette.road);
    drawRect(18, top, 3, H - top, '#4d612d');
    drawRect(70, top, 5, H - top, palette.hedge);
    for (let y = Math.floor(top); y < H; y += 9) {
      drawRect(29, y, 2, 7, palette.roadDark);
      drawRect(55, y + 2, 2, 5, palette.roadDark);
      if (hash(4, y) > 0.58) drawRect(22 + hash(y, 2) * 42, y + 1, 3, 2, palette.roadLight);
      if (hash(7, y) > 0.82) drawRect(76 + hash(y, 3) * 9, y, 5, 5, '#2d4a20');
    }
  }

  function drawTrail() {
    for (let i = 0; i < state.trail.length; i++) {
      const p = state.trail[i];
      const sy = worldToScreenY(p.y);
      if (sy < -50 || sy > H + 50) continue;
      const corn = p.terrain === 'corn';
      const w = p.width;
      const h = corn ? 18 : 15;
      drawRotatedRect(p.x, sy, w, h, p.angle, corn ? palette.trailCorn : '#b9813a');
      drawRotatedRect(p.x - w * 0.28, sy, 5, h + 4, p.angle, corn ? '#d0a057' : '#d4a45a');
      drawRotatedRect(p.x + w * 0.28, sy, 5, h + 4, p.angle, corn ? '#d0a057' : '#d4a45a');
      const chipCount = corn ? 5 : 3;
      for (let n = 0; n < chipCount; n++) {
        const r1 = hash(p.seed + n * 3, i);
        const r2 = hash(p.seed - n * 5, i + 17);
        const lx = p.x + (r1 - 0.5) * w;
        const ly = sy + (r2 - 0.5) * h;
        drawRect(lx, ly, corn && r1 > 0.4 ? 6 : 4, 2, corn ? '#263f1b' : '#835d2a');
        if (corn && r2 > 0.54) drawRect(lx + 2, ly - 4, 2, 5, '#4c6f2b');
      }
    }
  }

  function drawDust() {
    for (const p of state.dust) {
      const sy = worldToScreenY(p.y);
      if (sy < -30 || sy > H + 30) continue;
      const alpha = 1 - p.age / p.life;
      ctx.globalAlpha = alpha * 0.7;
      drawRect(p.x - p.size / 2, sy - p.size / 2, p.size, p.size, '#d9aa62');
      if (p.size > 5) drawRect(p.x + 3, sy, p.size * 0.6, 2, '#e2bf7a');
      ctx.globalAlpha = 1;
    }
  }

  function drawTruck() {
    const x = state.carX;
    const y = CAR_SCREEN_Y;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(state.steer * 0.11);
    drawRect(-17, 20, 34, 8, 'rgba(0,0,0,0.35)');
    drawRect(-17, -29, 34, 51, palette.truck);
    drawRect(-13, -26, 26, 12, palette.truck2);
    drawRect(-12, -10, 24, 23, '#10161b');
    drawRect(-10, -22, 20, 5, palette.truckHi);
    drawRect(-15, -17, 3, 31, '#07090b');
    drawRect(12, -17, 3, 31, '#07090b');
    drawRect(-15, 17, 9, 4, palette.tail);
    drawRect(6, 17, 9, 4, palette.tail);
    drawRect(-14, -34, 28, 4, palette.rack);
    drawRect(-14, -30, 3, 13, palette.rack);
    drawRect(11, -30, 3, 13, palette.rack);
    drawRect(-8, -29, 16, 2, palette.rack);
    drawRect(-11, -5, 22, 2, '#303a43');
    ctx.restore();
  }

  function drawDrone() {
    const x = droneX();
    const y = worldToScreenY(droneY());
    if (y < -70 || y > H + 70) return;
    drawRect(x - 12, y + 45, 24, 5, 'rgba(0,0,0,0.32)');
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    drawRect(-40, 1, 80, 5, palette.drone);
    drawRect(-34, -3, 68, 4, palette.droneHi);
    drawRect(-20, -9, 40, 17, '#151922');
    drawRect(-6, -15, 12, 23, '#343a46');
    drawRect(-37, 6, 18, 4, '#080a0d');
    drawRect(19, 6, 18, 4, '#080a0d');
    drawRect(-2, 8, 4, 4, '#b94e32');
    drawRect(-26, -1, 8, 2, palette.droneEdge);
    drawRect(18, -1, 8, 2, palette.droneEdge);
    ctx.restore();
  }

  function drawHud() {
    const dist = Math.max(0, Math.floor(WATER_START - state.carY));
    const align = alignmentScore();
    const time = state.speed > 0 ? Math.max(0, (WATER_START - state.carY) / state.speed) : 0;
    ctx.fillStyle = 'rgba(7, 10, 7, 0.64)';
    ctx.fillRect(10, 10, W - 20, 82);
    ctx.fillStyle = palette.ui;
    ctx.font = '12px monospace';
    ctx.fillText('FIELD CHASE', 22, 29);
    ctx.fillText('DIST ' + dist + 'm', 22, 50);
    ctx.fillText('TIME ' + time.toFixed(1) + 's', 126, 50);
    ctx.fillText('ALIGN', 248, 50);
    drawRect(296, 42, 95, 8, '#49341d');
    drawRect(296, 42, 95 * align, 8, align > ALIGN_THRESHOLD ? '#f2d46d' : '#c86642');
    if (state.brakeTimerActive) {
      ctx.fillText('BRAKE ' + Math.max(0, state.brakeTimer).toFixed(1) + 's', 22, 72);
      drawRect(126, 64, 188, 7, '#49341d');
      drawRect(126, 64, 188 * Math.max(0, state.brakeTimer / BRAKE_TIMER_MAX), 7, '#efbd4e');
    } else {
      ctx.fillText(state.message || 'ALIGN WITH DRONE', 22, 72);
    }
    drawControls();
  }

  function drawControls() {
    if (state.mode !== 'intro' && state.mode !== 'play') return;
    const y = H - 83;
    ctx.fillStyle = input.left ? 'rgba(255,232,166,0.22)' : 'rgba(8,10,7,0.42)';
    ctx.fillRect(18, y, 118, 52);
    ctx.fillStyle = input.brake ? 'rgba(255,232,166,0.28)' : 'rgba(8,10,7,0.42)';
    ctx.fillRect(156, y, 138, 52);
    ctx.fillStyle = input.right ? 'rgba(255,232,166,0.22)' : 'rgba(8,10,7,0.42)';
    ctx.fillRect(314, y, 118, 52);
    ctx.fillStyle = palette.ui;
    ctx.font = '12px monospace';
    ctx.fillText('LEFT', 60, y + 31);
    ctx.fillText('BRAKE', 207, y + 31);
    ctx.fillText('RIGHT', 353, y + 31);
  }

  function drawTitle() {
    drawWorld();
    drawTrail();
    drawDrone();
    drawTruck();
    ctx.fillStyle = 'rgba(5,8,5,0.60)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = palette.ui;
    ctx.textAlign = 'center';
    ctx.font = '25px monospace';
    ctx.fillText('FIELD CHASE', W / 2, 246);
    ctx.font = '12px monospace';
    ctx.fillText('FOLLOW THE BLACK DRONE', W / 2, 286);
    ctx.fillText('STOP BEFORE THE WATER', W / 2, 308);
    ctx.fillText('TAP TO START', W / 2, 370);
    ctx.fillText('LEFT / RIGHT TO STEER', W / 2, 408);
    ctx.fillText('BRAKE ONLY IN THE FINAL WINDOW', W / 2, 428);
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
      } else line += word + ' ';
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function drawResult() {
    drawWorld();
    drawTrail();
    drawDust();
    drawDrone();
    drawTruck();
    drawHud();
    ctx.fillStyle = 'rgba(5,8,5,0.68)';
    ctx.fillRect(0, 250, W, 196);
    ctx.fillStyle = state.mode === 'win' ? '#f6e081' : '#ef986e';
    ctx.textAlign = 'center';
    ctx.font = '18px monospace';
    ctx.fillText(state.mode === 'win' ? 'MISSION COMPLETE' : 'CHASE FAILED', W / 2, 304);
    ctx.font = '12px monospace';
    wrapText(state.result, 36).forEach((line, i) => ctx.fillText(line, W / 2, 338 + i * 18));
    ctx.fillText('TAP TO RESTART', W / 2, 410);
    ctx.textAlign = 'left';
  }

  function draw() {
    if (state.mode === 'title') { drawTitle(); return; }
    if (state.mode === 'win' || state.mode === 'fail') { drawResult(); return; }
    drawWorld();
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

  function pointToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H
    };
  }

  function pointerControlFromPoint(pt) {
    const brake = pt.y > H - 126 && pt.x > 132 && pt.x < 318;
    return {
      brake,
      left: !brake && pt.x < W / 2,
      right: !brake && pt.x >= W / 2
    };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    if (state.mode === 'title') { reset(); return; }
    if (state.mode === 'win' || state.mode === 'fail') { restart(); return; }
    input.pointers.set(e.pointerId, pointerControlFromPoint(pointToCanvas(e)));
    refreshInput();
  }

  function handlePointerMove(e) {
    e.preventDefault();
    if (!input.pointers.has(e.pointerId)) return;
    input.pointers.set(e.pointerId, pointerControlFromPoint(pointToCanvas(e)));
    refreshInput();
  }

  function handlePointerUp(e) {
    e.preventDefault();
    input.pointers.delete(e.pointerId);
    refreshInput();
  }

  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  canvas.addEventListener('pointermove', handlePointerMove, { passive: false });
  canvas.addEventListener('pointerup', handlePointerUp, { passive: false });
  canvas.addEventListener('pointercancel', handlePointerUp, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('keydown', e => {
    if (state.mode === 'title') reset();
    else if (state.mode === 'win' || state.mode === 'fail') restart();
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') input.keys.left = true;
    if (key === 'arrowright' || key === 'd') input.keys.right = true;
    if (key === ' ' || key === 'arrowdown' || key === 's') input.keys.brake = true;
    refreshInput();
    if (['arrowleft', 'arrowright', 'arrowdown', ' ', 'a', 'd', 's'].includes(key)) e.preventDefault();
  }, { passive: false });

  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') input.keys.left = false;
    if (key === 'arrowright' || key === 'd') input.keys.right = false;
    if (key === ' ' || key === 'arrowdown' || key === 's') input.keys.brake = false;
    refreshInput();
  });

  document.addEventListener('gesturestart', e => e.preventDefault());
  requestAnimationFrame(loop);
})();
