(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const W = canvas.width;
  const H = canvas.height;
  ctx.imageSmoothingEnabled = false;

  const CAR_SCREEN_Y = 622;
  const PX_PER_METER = 0.19;
  const CORN_END = 7000;
  const WATER_START = 9600;
  const STOP_START = 9050;
  const STOP_END = 9560;
  const ROAD_END = 7000;
  const FIELD_LEFT = 82;
  const FIELD_RIGHT = 428;
  const CRUISE_SPEED = 202;
  const BRAKE_DECEL = 185;
  const BRAKE_DRAG = 10;
  const GAME_TIMER_MAX = 59;
  const ALIGN_THRESHOLD = 0.62;

  const state = {
    mode: 'menu',
    startedAt: 0,
    last: 0,
    carX: 112,
    carY: 0,
    speed: CRUISE_SPEED,
    steer: 0,
    braking: false,
    gameTimer: GAME_TIMER_MAX,
    message: '',
    trail: [],
    dust: [],
    result: '',
    nextTrailAt: 0,
    roadExitX: 246
  };

  const input = {
    keys: { left: false, right: false, brake: false },
    pointers: new Map(),
    left: false,
    right: false,
    brake: false
  };

  const palette = {
    black: '#050604', panel: '#11170f', panel2: '#1b2315',
    gold: '#ffd982', gold2: '#b9823e', cream: '#fff0bd', muted: '#9c8b62',
    skyTop: '#f4d889', skyLow: '#d7a757', cloud: '#f7e4a6',
    cornBase: '#162914', cornDeep: '#203d1c', cornMid: '#3d6428', cornLight: '#7f9143', cornTip: '#c8ad4f',
    road: '#ba8b4b', roadLight: '#d0a666', roadDark: '#785931', hedge: '#243d1b',
    trailCorn: '#987239', trailDust: '#d5a65d',
    dry: '#bc8134', dryLight: '#d19d4d', dryDark: '#8a612d', dryGreen: '#6f7430',
    water: '#367f94', waterDeep: '#1d5d74', waterLight: '#7cc1c4', sparkle: '#ffeeb5',
    truck: '#11181e', truck2: '#273340', truckHi: '#75868a', rack: '#d7cdbb', tail: '#cf563b',
    drone: '#0b0d12', droneHi: '#333844', droneEdge: '#5d6270', ui: '#ffe8a6', danger: '#d66b4d'
  };

  const buttons = {
    play: { x: 104, y: 548, w: 242, h: 54 },
    how: { x: 118, y: 620, w: 214, h: 44 },
    howClose: { x: 72, y: 694, w: 138, h: 42 },
    howPlay: { x: 240, y: 694, w: 138, h: 42 }
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function terrainAt(worldY) {
    if (worldY >= WATER_START) return 'water';
    if (worldY >= CORN_END) return 'dry';
    return 'corn';
  }
  function brakesUnlocked() { return state.carY >= CORN_END; }
  function cliffDistance() { return Math.max(0, Math.floor(WATER_START - state.carY)); }
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
  function drawStrokeRect(x, y, w, h, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
  }
  function drawRotatedRect(x, y, w, h, angle, color) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(-w / 2), Math.round(-h / 2), Math.round(w), Math.round(h));
    ctx.restore();
  }
  function inRect(pt, b) { return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h; }

  function startGame() {
    state.mode = 'intro';
    state.startedAt = performance.now();
    state.last = 0;
    state.carX = 108;
    state.carY = 0;
    state.speed = CRUISE_SPEED;
    state.steer = 0;
    state.braking = false;
    state.gameTimer = GAME_TIMER_MAX;
    state.message = 'ENTERING FIELD';
    state.trail = [];
    state.dust = [];
    state.result = '';
    state.nextTrailAt = 0;
    input.pointers.clear();
    input.keys.left = input.keys.right = input.keys.brake = false;
    refreshInput();
  }

  function restartToMenu() {
    input.pointers.clear();
    input.keys.left = input.keys.right = input.keys.brake = false;
    refreshInput();
    state.mode = 'menu';
    state.carX = 112;
    state.carY = 0;
    state.speed = CRUISE_SPEED;
    state.gameTimer = GAME_TIMER_MAX;
    state.trail = [];
    state.dust = [];
    state.result = '';
    state.nextTrailAt = 0;
  }

  function droneX() {
    const drift = Math.sin((state.carY + 420) * 0.00225) * 88 + Math.sin(state.carY * 0.0008) * 28;
    return clamp(255 + drift, FIELD_LEFT + 78, FIELD_RIGHT - 36);
  }

  function droneY() {
    return state.carY + 1210;
  }

  function alignmentScore() {
    const dx = Math.abs(state.carX - droneX());
    return clamp(1 - dx / 138, 0, 1);
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
      width: terrain === 'corn' ? 48 : 34,
      seed: Math.floor(y * 7 + x * 11),
      age: 0
    });
    if (state.trail.length > 1800) state.trail.shift();
  }

  function addDust(dt) {
    if (state.speed < 8) return;
    const terrain = terrainAt(state.carY);
    const count = terrain === 'corn' ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const r = hash(Math.floor(state.carY) + i, Math.floor(state.carX));
      state.dust.push({
        x: state.carX + (r - 0.5) * (terrain === 'corn' ? 34 : 48),
        y: state.carY - 34 - hash(i, Math.floor(state.carY)) * 46,
        vx: (hash(i + 3, Math.floor(state.carY)) - 0.5) * 24,
        vy: -20 - hash(i + 9, Math.floor(state.carY)) * 26,
        age: 0,
        life: 0.85 + r * 0.95,
        size: 2 + r * (terrain === 'corn' ? 6 : 10)
      });
    }
    state.dust = state.dust.filter(p => {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 2.8;
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
    if (state.mode !== 'intro' && state.mode !== 'play') return;

    refreshInput();
    let desiredSteer = 0;
    if (input.left) desiredSteer -= 1;
    if (input.right) desiredSteer += 1;
    state.steer = lerp(state.steer, desiredSteer, Math.min(1, dt * 6.3));
    state.braking = input.brake;
    state.gameTimer = Math.max(0, state.gameTimer - dt);

    if (state.mode === 'intro') {
      const t = clamp((now - state.startedAt) / 3700, 0, 1);
      state.carX = lerp(108, state.roadExitX, smooth(t));
      state.carY += CRUISE_SPEED * dt;
      state.speed = CRUISE_SPEED;
      if (t >= 1) {
        state.mode = 'play';
        state.message = 'ALIGN WITH DRONE';
      }
    } else {
      const brakeActive = state.braking && brakesUnlocked();
      const maxSteer = brakeActive ? 115 : 150;
      state.carX += state.steer * maxSteer * dt;
      state.carX = clamp(state.carX, FIELD_LEFT + 40, FIELD_RIGHT - 30);

      if (brakeActive) {
        state.speed = Math.max(0, state.speed - BRAKE_DECEL * dt);
      } else {
        state.speed = Math.min(CRUISE_SPEED, state.speed + BRAKE_DRAG * dt);
        if (state.braking && !brakesUnlocked()) state.message = 'BRAKES LOCKED UNTIL DRY FIELD';
      }

      state.carY += state.speed * dt;

      const aligned = alignmentScore() > ALIGN_THRESHOLD;
      const stopped = state.speed <= 4;
      const inStopZone = state.carY >= STOP_START && state.carY <= STOP_END;
      if (stopped && inStopZone && aligned) {
        state.mode = 'win';
        state.result = 'DRONE LOCKED - TRUCK STOPPED BEFORE THE SHORELINE';
      } else if (stopped && inStopZone && !aligned) {
        state.mode = 'fail';
        state.result = 'STOPPED IN TIME, BUT THE TRUCK WAS NOT ALIGNED WITH THE DRONE';
      } else if (stopped && state.carY < STOP_START) {
        state.mode = 'fail';
        state.result = 'STOPPED TOO EARLY - THE CLIFF IS STILL AHEAD';
      } else if (state.carY > WATER_START + 22) {
        state.mode = 'fail';
        state.result = 'NO BRAKE - THE TRUCK DROVE OFF THE CLIFF INTO THE WATER';
      } else if (state.gameTimer <= 0) {
        state.mode = 'fail';
        state.result = 'TIME EXPIRED BEFORE THE TRUCK REACHED THE CLIFF';
      }
    }

    if (state.carY >= state.nextTrailAt) {
      pushTrail();
      state.nextTrailAt = state.carY + 10;
    }
    for (const t of state.trail) t.age += dt;
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
    if (state.carY > CORN_END - 650) return;
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
      const perspective = clamp(1.12 - sy / H * 0.46, 0.72, 1.06);
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
        if (r > 0.66) {
          drawRect(x + r * 7, sy - 3, 8, 2, palette.dryDark);
          if (r > 0.86) drawRect(x + 2, sy - 8, 2, 7, palette.dryGreen);
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
      const h = corn ? 20 : 17;
      drawRotatedRect(p.x, sy, w, h, p.angle, corn ? palette.trailCorn : '#b9813a');
      drawRotatedRect(p.x - w * 0.27, sy, 5, h + 5, p.angle, corn ? '#d0a057' : '#d4a45a');
      drawRotatedRect(p.x + w * 0.27, sy, 5, h + 5, p.angle, corn ? '#d0a057' : '#d4a45a');
      drawRotatedRect(p.x, sy + 2, w * 0.42, 4, p.angle, corn ? '#6a522c' : '#986b31');
      const chipCount = corn ? 10 : 6;
      for (let n = 0; n < chipCount; n++) {
        const r1 = hash(p.seed + n * 3, i);
        const r2 = hash(p.seed - n * 5, i + 17);
        const lx = p.x + (r1 - 0.5) * w;
        const ly = sy + (r2 - 0.5) * h;
        drawRect(lx, ly, corn && r1 > 0.4 ? 6 : 4, 2, corn ? '#263f1b' : '#835d2a');
        if (corn && r2 > 0.43) drawRect(lx + 2, ly - 5, 2, 6, r1 > 0.5 ? '#4c6f2b' : '#789042');
        if (corn && r1 > 0.78) drawRect(lx - 2, ly + 3, 5, 2, '#c3a94a');
      }
    }
  }

  function drawDust() {
    for (const p of state.dust) {
      const sy = worldToScreenY(p.y);
      if (sy < -30 || sy > H + 30) continue;
      const alpha = 1 - p.age / p.life;
      ctx.globalAlpha = alpha * 0.72;
      drawRect(p.x - p.size / 2, sy - p.size / 2, p.size, p.size, '#d9aa62');
      if (p.size > 5) drawRect(p.x + 3, sy, p.size * 0.65, 2, '#e2bf7a');
      ctx.globalAlpha = 1;
    }
  }

  function drawTruckAt(x, y, scale = 1, steer = 0) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.rotate(steer * 0.11);
    drawRect(-19, 22, 38, 9, 'rgba(0,0,0,0.35)');
    drawRect(-18, -31, 36, 54, palette.truck);
    drawRect(-15, -28, 30, 13, palette.truck2);
    drawRect(-14, -12, 28, 26, '#10161b');
    drawRect(-12, -24, 24, 5, palette.truckHi);
    drawRect(-16, -18, 4, 34, '#07090b');
    drawRect(12, -18, 4, 34, '#07090b');
    drawRect(-16, 18, 10, 4, palette.tail);
    drawRect(6, 18, 10, 4, palette.tail);
    drawRect(-15, -36, 30, 4, palette.rack);
    drawRect(-15, -32, 3, 14, palette.rack);
    drawRect(12, -32, 3, 14, palette.rack);
    drawRect(-9, -31, 18, 2, palette.rack);
    drawRect(-12, -5, 24, 2, '#303a43');
    drawRect(-7, 0, 14, 10, '#18222b');
    ctx.restore();
  }

  function drawTruck() { drawTruckAt(state.carX, CAR_SCREEN_Y, 1, state.steer); }

  function drawDroneAt(x, y, scale = 1, showShadow = true) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (showShadow) drawRect(-12, 45, 24, 5, 'rgba(0,0,0,0.32)');
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

  function drawDrone() {
    const x = droneX();
    const y = worldToScreenY(droneY());
    if (y < -90 || y > H + 90) return;
    drawDroneAt(x, y, 1, true);
  }

  function drawHud() {
    const dist = cliffDistance();
    const align = alignmentScore();
    const time = Math.max(0, state.gameTimer);
    ctx.fillStyle = 'rgba(7, 10, 7, 0.70)';
    ctx.fillRect(8, 10, W - 16, 70);
    drawStrokeRect(8, 10, W - 16, 70, 'rgba(255,232,166,0.28)');
    const colW = (W - 16) / 3;
    ctx.fillStyle = 'rgba(255,232,166,0.10)';
    ctx.fillRect(8 + colW, 10, 1, 70);
    ctx.fillRect(8 + colW * 2, 10, 1, 70);
    ctx.fillStyle = palette.ui;
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CLIFF', 8 + colW * 0.5, 30);
    ctx.fillText('TIME', 8 + colW * 1.5, 30);
    ctx.fillText('ALIGN', 8 + colW * 2.5, 30);
    ctx.font = '15px monospace';
    ctx.fillText(dist + 'm', 8 + colW * 0.5, 56);
    ctx.fillText(time.toFixed(1) + 's', 8 + colW * 1.5, 56);
    const barX = 8 + colW * 2 + 18;
    const barY = 49;
    drawRect(barX, barY, colW - 36, 8, '#49341d');
    drawRect(barX, barY, (colW - 36) * align, 8, align > ALIGN_THRESHOLD ? '#f2d46d' : palette.danger);
    ctx.textAlign = 'left';
    if (!brakesUnlocked()) {
      ctx.fillStyle = 'rgba(7,10,7,0.58)';
      ctx.fillRect(112, 86, 226, 22);
      ctx.fillStyle = palette.muted;
      ctx.font = '10px monospace';
      ctx.fillText('BRAKES LOCKED UNTIL DRY FIELD', 128, 101);
    }
    drawControls();
  }

  function drawControls() {
    if (state.mode !== 'intro' && state.mode !== 'play') return;
    const y = H - 83;
    const locked = !brakesUnlocked();
    ctx.fillStyle = input.left ? 'rgba(255,232,166,0.24)' : 'rgba(8,10,7,0.42)';
    ctx.fillRect(18, y, 118, 52);
    ctx.fillStyle = locked ? 'rgba(80,80,70,0.32)' : input.brake ? 'rgba(255,232,166,0.34)' : 'rgba(8,10,7,0.42)';
    ctx.fillRect(156, y, 138, 52);
    ctx.fillStyle = input.right ? 'rgba(255,232,166,0.24)' : 'rgba(8,10,7,0.42)';
    ctx.fillRect(314, y, 118, 52);
    ctx.fillStyle = palette.ui;
    ctx.font = '12px monospace';
    ctx.fillText('LEFT', 60, y + 31);
    ctx.fillText(locked ? 'LOCKED' : 'BRAKE', locked ? 204 : 207, y + 31);
    ctx.fillText('RIGHT', 353, y + 31);
  }

  function drawMenuBackground() {
    drawRect(0, 0, W, H, palette.black);
    for (let y = 0; y < H; y += 4) {
      const t = y / H;
      const c = t < 0.38 ? '#050606' : t < 0.72 ? '#0d110c' : '#151c10';
      drawRect(0, y, W, 4, c);
    }
    for (let i = 0; i < 95; i++) {
      const x = hash(i, 10) * W;
      const y = hash(i, 19) * H;
      const a = hash(i, 27);
      ctx.globalAlpha = 0.10 + a * 0.20;
      drawRect(x, y, a > 0.65 ? 2 : 1, 1, palette.gold);
      ctx.globalAlpha = 1;
    }
    drawRect(0, H - 220, W, 220, '#0d1d0d');
    for (let x = 0; x < W; x += 6) {
      const h = 26 + hash(x, 3) * 72;
      drawRect(x, H - h, 2, h, hash(x, 4) > 0.5 ? palette.cornMid : palette.cornDeep);
      if (hash(x, 5) > 0.45) drawRect(x + 1, H - h - 1, 2, 2, palette.cornTip);
    }
    drawDroneAt(W / 2 + 92, 144, 0.78, false);
    drawTruckAt(W / 2 - 84, H - 154, 0.92, 0);
  }

  function drawButton(b, label, primary = false) {
    drawRect(b.x + 4, b.y + 5, b.w, b.h, 'rgba(0,0,0,0.46)');
    drawRect(b.x, b.y, b.w, b.h, primary ? '#322613' : '#11170f');
    drawStrokeRect(b.x, b.y, b.w, b.h, primary ? palette.gold : '#6f613d');
    if (primary) drawStrokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10, 'rgba(255,217,130,0.35)');
    ctx.fillStyle = primary ? palette.cream : palette.ui;
    ctx.textAlign = 'center';
    ctx.font = primary ? '17px Georgia, serif' : '13px Georgia, serif';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    ctx.textAlign = 'left';
  }

  function drawTitleLetters(text, y, size, spread) {
    ctx.textAlign = 'center';
    ctx.font = size + 'px Georgia, serif';
    drawRect(58, y - size + 9, W - 116, 2, 'rgba(255,217,130,0.24)');
    ctx.fillStyle = '#3f2b13';
    ctx.fillText(text, W / 2 + 3, y + 4);
    ctx.fillStyle = palette.gold;
    ctx.fillText(text, W / 2, y);
    ctx.fillStyle = palette.cream;
    ctx.font = Math.floor(size * 0.42) + 'px Georgia, serif';
    ctx.fillText(spread, W / 2, y + 28);
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    drawMenuBackground();
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.muted;
    ctx.font = '12px Georgia, serif';
    ctx.fillText('AN OVERHEAD PIXEL-ART CHASE', W / 2, 230);
    drawTitleLetters('CORNFIELD', 304, 43, 'CHASE');
    drawRect(72, 374, 306, 2, palette.gold2);
    drawRect(118, 384, 214, 1, 'rgba(255,240,189,0.34)');
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = palette.cream;
    ctx.fillText('Follow the drone. Reach the dry field.', W / 2, 430);
    ctx.fillText('Brake before the shoreline.', W / 2, 452);
    drawButton(buttons.play, 'PLAY', true);
    drawButton(buttons.how, 'HOW TO PLAY', false);
    ctx.fillStyle = '#796c4e';
    ctx.font = '10px monospace';
    ctx.fillText('MOBILE: LEFT / LOCKED BRAKE / RIGHT', W / 2, 700);
    ctx.textAlign = 'left';
  }

  function drawHowTo() {
    drawMenuBackground();
    drawRect(34, 70, W - 68, 650, 'rgba(8,10,7,0.92)');
    drawStrokeRect(34, 70, W - 68, 650, palette.gold2);
    ctx.fillStyle = palette.cream;
    ctx.textAlign = 'center';
    ctx.font = '22px Georgia, serif';
    ctx.fillText('HOW TO PLAY', W / 2, 116);
    ctx.font = '11px monospace';
    ctx.fillStyle = palette.muted;
    ctx.fillText('OBJECTS AND RULES', W / 2, 138);

    drawTruckAt(102, 205, 0.72, 0);
    drawDroneAt(104, 312, 0.58, true);
    drawRect(80, 390, 48, 18, palette.trailCorn);
    for (let x = 72; x < 132; x += 8) {
      drawRect(x, 384 + hash(x, 9) * 22, 2, 12, palette.cornMid);
      drawRect(x + 2, 384 + hash(x, 6) * 22, 5, 2, palette.cornTip);
    }
    drawRect(76, 493, 54, 24, palette.dry);
    drawRect(76, 493, 54, 2, palette.dryLight);
    drawRect(76, 520, 54, 34, palette.water);
    for (let x = 78; x < 126; x += 9) drawRect(x, 532 + hash(x, 2) * 12, 8, 2, palette.sparkle);

    ctx.textAlign = 'left';
    ctx.fillStyle = palette.ui;
    ctx.font = '12px monospace';
    ctx.fillText('TRUCK', 156, 194);
    ctx.fillStyle = palette.muted;
    ctx.fillText('Steer left or right through', 156, 214);
    ctx.fillText('the long cornfield.', 156, 232);

    ctx.fillStyle = palette.ui;
    ctx.fillText('DRONE', 156, 302);
    ctx.fillStyle = palette.muted;
    ctx.fillText('Stay aligned under the', 156, 322);
    ctx.fillText('black drone as it flies on.', 156, 340);

    ctx.fillStyle = palette.ui;
    ctx.fillText('TRAIL', 156, 394);
    ctx.fillStyle = palette.muted;
    ctx.fillText('Every move crushes stalks', 156, 414);
    ctx.fillText('and leaves damaged rows.', 156, 432);

    ctx.fillStyle = palette.ui;
    ctx.fillText('DRY FIELD / CLIFF', 156, 505);
    ctx.fillStyle = palette.muted;
    ctx.fillText('Brakes unlock in the dry', 156, 525);
    ctx.fillText('field. Stop before water.', 156, 543);

    ctx.fillStyle = palette.cream;
    ctx.textAlign = 'center';
    ctx.font = '11px monospace';
    ctx.fillText('HUD: CLIFF DISTANCE  |  TIME LEFT  |  ALIGNMENT', W / 2, 612);
    ctx.fillText('BRAKES ARE LOCKED UNTIL THE DRY FIELD.', W / 2, 636);
    drawButton(buttons.howClose, 'CLOSE', false);
    drawButton(buttons.howPlay, 'PLAY', true);
    ctx.textAlign = 'left';
  }

  function drawResult() {
    drawWorld();
    drawTrail();
    drawDust();
    drawDrone();
    drawTruck();
    drawHud();
    ctx.fillStyle = 'rgba(5,8,5,0.72)';
    ctx.fillRect(0, 238, W, 238);
    ctx.fillStyle = state.mode === 'win' ? '#f6e081' : '#ef986e';
    ctx.textAlign = 'center';
    ctx.font = '18px monospace';
    ctx.fillText(state.mode === 'win' ? 'MISSION COMPLETE' : 'CHASE FAILED', W / 2, 292);
    ctx.font = '12px monospace';
    wrapText(state.result, 36).forEach((line, i) => ctx.fillText(line, W / 2, 330 + i * 18));
    drawButton({ x: 118, y: 394, w: 214, h: 44 }, 'MAIN MENU', true);
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

  function draw() {
    if (state.mode === 'menu') { drawMenu(); return; }
    if (state.mode === 'how') { drawHowTo(); return; }
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

  function handleMenuTap(pt) {
    if (state.mode === 'menu') {
      if (inRect(pt, buttons.play)) { startGame(); return true; }
      if (inRect(pt, buttons.how)) { state.mode = 'how'; return true; }
    }
    if (state.mode === 'how') {
      if (inRect(pt, buttons.howClose)) { state.mode = 'menu'; return true; }
      if (inRect(pt, buttons.howPlay)) { startGame(); return true; }
    }
    if (state.mode === 'win' || state.mode === 'fail') {
      restartToMenu();
      return true;
    }
    return false;
  }

  function handlePointerDown(e) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const pt = pointToCanvas(e);
    if (handleMenuTap(pt)) return;
    input.pointers.set(e.pointerId, pointerControlFromPoint(pt));
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
    const key = e.key.toLowerCase();
    if (state.mode === 'menu' && (key === 'enter' || key === ' ')) startGame();
    else if (state.mode === 'how' && key === 'escape') state.mode = 'menu';
    else if ((state.mode === 'win' || state.mode === 'fail') && (key === 'enter' || key === ' ')) restartToMenu();
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
