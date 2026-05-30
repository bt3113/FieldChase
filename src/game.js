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
  const DRONE_SPEED = 224;
  const BRAKE_DECEL = 185;
  const BRAKE_DRAG = 10;
  const GAME_TIMER_MAX = 59;
  const ALIGN_THRESHOLD = 0.62;

  const menuBg = new Image();
  let menuBgReady = false;
  fetch('assets/menu-bg.txt')
    .then(r => r.text())
    .then(src => {
      menuBg.onload = () => { menuBgReady = true; };
      menuBg.src = src.trim();
    })
    .catch(() => { menuBgReady = false; });

  const state = {
    mode: 'law',
    lawStartedAt: performance.now(),
    transitionStartedAt: 0,
    startedAt: 0,
    last: 0,
    carX: 112,
    carY: 0,
    droneWorldY: 1280,
    speed: CRUISE_SPEED,
    steer: 0,
    braking: false,
    gameTimer: GAME_TIMER_MAX,
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
    black: '#000000', cream: '#f4eddc', dim: '#9b968a', gold: '#e7c06d', red: '#8f1f30',
    cornBase: '#162914', cornDeep: '#203d1c', cornMid: '#3d6428', cornLight: '#7f9143', cornTip: '#c8ad4f',
    road: '#ba8b4b', roadLight: '#d0a666', roadDark: '#785931', hedge: '#243d1b',
    trailCorn: '#987239', dry: '#bc8134', dryLight: '#d19d4d', dryDark: '#8a612d', dryGreen: '#6f7430',
    water: '#367f94', waterDeep: '#1d5d74', waterLight: '#7cc1c4', sparkle: '#ffeeb5',
    truck: '#11181e', truck2: '#273340', truckHi: '#75868a', rack: '#d7cdbb', tail: '#cf563b',
    drone: '#0b0d12', droneHi: '#333844', droneEdge: '#5d6270', ui: '#ffe8a6', danger: '#d66b4d'
  };

  const buttons = {
    play: { x: 104, y: 590, w: 242, h: 48 },
    how: { x: 104, y: 650, w: 242, h: 48 },
    howClose: { x: 72, y: 694, w: 138, h: 42 },
    howPlay: { x: 240, y: 694, w: 138, h: 42 }
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function terrainAt(worldY) { return worldY >= WATER_START ? 'water' : worldY >= CORN_END ? 'dry' : 'corn'; }
  function brakesUnlocked() { return state.carY >= CORN_END; }
  function cliffDistance() { return Math.max(0, Math.floor(WATER_START - state.carY)); }
  function worldToScreenY(worldY) { return CAR_SCREEN_Y - (worldY - state.carY) * PX_PER_METER; }
  function screenToWorldY(screenY) { return state.carY + (CAR_SCREEN_Y - screenY) / PX_PER_METER; }
  function hash(ix, iy) {
    let n = Math.imul(ix | 0, 374761393) + Math.imul(iy | 0, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function stroke(x, y, w, h, c, line = 1) { ctx.strokeStyle = c; ctx.lineWidth = line; ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)); }
  function rrect(x, y, w, h, a, c) { ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a); ctx.fillStyle = c; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore(); }
  function inRect(pt, b) { return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h; }

  function beginGameTransition(now = performance.now()) {
    state.mode = 'startFade';
    state.transitionStartedAt = now;
    input.pointers.clear();
    input.keys.left = input.keys.right = input.keys.brake = false;
    refreshInput();
  }

  function startGame(now = performance.now()) {
    state.mode = 'intro';
    state.startedAt = now;
    state.last = now;
    state.carX = 108;
    state.carY = 0;
    state.droneWorldY = 1280;
    state.speed = CRUISE_SPEED;
    state.steer = 0;
    state.braking = false;
    state.gameTimer = GAME_TIMER_MAX;
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
    state.droneWorldY = 1280;
    state.speed = CRUISE_SPEED;
    state.gameTimer = GAME_TIMER_MAX;
    state.trail = [];
    state.dust = [];
    state.result = '';
    state.nextTrailAt = 0;
  }

  function droneX() {
    const y = state.droneWorldY;
    const drift = Math.sin((y + 420) * 0.00225) * 88 + Math.sin(y * 0.0008) * 28;
    return clamp(255 + drift, FIELD_LEFT + 78, FIELD_RIGHT - 36);
  }
  function droneY() { return state.droneWorldY; }
  function alignmentScore() { return clamp(1 - Math.abs(state.carX - droneX()) / 138, 0, 1); }

  function pushTrail() {
    const last = state.trail[state.trail.length - 1];
    const y = state.carY - 20;
    const x = state.carX;
    const dx = last ? x - last.x : 0;
    const dy = last ? y - last.y : 1;
    const terrain = terrainAt(y);
    state.trail.push({ x, y, terrain, angle: Math.atan2(dx, -dy), width: terrain === 'corn' ? 48 : 34, seed: Math.floor(y * 7 + x * 11) });
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
    if (state.mode === 'law') {
      if (now - state.lawStartedAt > 5200) state.mode = 'menu';
      return;
    }
    if (state.mode === 'startFade') {
      if (now - state.transitionStartedAt > 1600) startGame(now);
      return;
    }
    if (state.mode !== 'intro' && state.mode !== 'play') return;

    refreshInput();
    let desiredSteer = 0;
    if (input.left) desiredSteer -= 1;
    if (input.right) desiredSteer += 1;
    state.steer = lerp(state.steer, desiredSteer, Math.min(1, dt * 6.3));
    state.braking = input.brake;
    state.gameTimer = Math.max(0, state.gameTimer - dt);
    state.droneWorldY += DRONE_SPEED * dt;

    if (state.mode === 'intro') {
      const t = clamp((now - state.startedAt) / 4700, 0, 1);
      state.carX = lerp(108, state.roadExitX, smooth(t));
      const introSpeed = lerp(CRUISE_SPEED * 0.35, CRUISE_SPEED, smooth(t));
      state.carY += introSpeed * dt;
      state.speed = introSpeed;
      if (t >= 1) state.mode = 'play';
    } else {
      const brakeActive = state.braking && brakesUnlocked();
      state.carX += state.steer * (brakeActive ? 115 : 150) * dt;
      state.carX = clamp(state.carX, FIELD_LEFT + 40, FIELD_RIGHT - 30);
      state.speed = brakeActive ? Math.max(0, state.speed - BRAKE_DECEL * dt) : Math.min(CRUISE_SPEED, state.speed + BRAKE_DRAG * dt);
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
    addDust(dt);
  }

  function drawWorld() {
    rect(0, 0, W, H, palette.cornBase);
    const horizon = 54;
    const yCornEnd = worldToScreenY(CORN_END);
    const yWater = worldToScreenY(WATER_START);
    if (yWater < H) drawWater(horizon, clamp(yWater, horizon, H));
    const dryTop = clamp(yWater, horizon, H);
    const dryBottom = clamp(yCornEnd, horizon, H);
    if (dryTop < dryBottom) drawDryField(dryTop, dryBottom);
    const cornTop = clamp(yCornEnd, horizon, H);
    if (cornTop < H) drawCornfield(cornTop, H);
    drawFarSky(horizon);
    drawRoad();
  }

  function drawFarSky(horizon) {
    for (let y = 0; y < horizon; y += 3) rect(0, y, W, 3, y < horizon * 0.55 ? '#f4d889' : '#d7a757');
    if (state.carY > CORN_END - 650) return;
    rect(0, horizon, W, 18, '#c4934c');
    for (let i = 0; i < 8; i++) rect(0, horizon + 4 + i * 3, W, 1, i % 2 ? '#d2a353' : '#b77e37');
    rect(346, horizon - 12, 12, 20, '#6d6241');
    rect(360, horizon - 20, 9, 28, '#786b45');
  }

  function drawCornfield(y0, y1) {
    rect(0, y0, W, y1 - y0, palette.cornBase);
    const worldStart = Math.floor(screenToWorldY(y1) / 16) - 3;
    const worldEnd = Math.ceil(screenToWorldY(y0) / 16) + 4;
    for (let gy = worldStart; gy <= worldEnd; gy++) {
      const sy = worldToScreenY(gy * 16);
      if (sy < y0 - 18 || sy > y1 + 18) continue;
      const perspective = clamp(1.12 - sy / H * 0.46, 0.72, 1.06);
      for (let x = FIELD_LEFT - 30 + (gy % 3) * 2; x < W + 20; x += 7) {
        const r = hash(Math.floor(x / 7), gy);
        if (r < 0.09) continue;
        const h = Math.floor((6 + r * 10) * perspective);
        rect(x, sy - h, 2, h, r > 0.72 ? palette.cornLight : r > 0.35 ? palette.cornMid : palette.cornDeep);
        if (r > 0.5) rect(x + 1, sy - h - 1, 2, 2, palette.cornTip);
        if (r > 0.82) rect(x - 2, sy - Math.floor(h * 0.45), 3, 2, '#284a20');
      }
    }
  }

  function drawDryField(y0, y1) {
    rect(0, y0, W, y1 - y0, palette.dry);
    const worldStart = Math.floor(screenToWorldY(y1) / 26) - 3;
    const worldEnd = Math.ceil(screenToWorldY(y0) / 26) + 4;
    for (let gy = worldStart; gy <= worldEnd; gy++) {
      const sy = worldToScreenY(gy * 26);
      if (sy < y0 - 16 || sy > y1 + 16) continue;
      rect(0, sy, W, 2, gy % 2 ? palette.dryLight : '#ae742e');
      for (let x = 0; x < W; x += 16) {
        const r = hash(Math.floor(x / 16), gy + 99);
        if (r > 0.66) {
          rect(x + r * 7, sy - 3, 8, 2, palette.dryDark);
          if (r > 0.86) rect(x + 2, sy - 8, 2, 7, palette.dryGreen);
        }
      }
    }
  }

  function drawWater(y0, y1) {
    rect(0, y0, W, y1 - y0, palette.waterDeep);
    for (let y = Math.floor(y0); y < y1; y += 6) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      rect(0, y, W, 6, t > 0.48 ? palette.water : '#2a6c84');
      for (let x = 0; x < W; x += 14) {
        const r = hash(Math.floor(x / 14), Math.floor(screenToWorldY(y) / 19));
        const sun = Math.max(0, 1 - Math.abs(x - W * 0.53) / (120 - t * 44));
        if (r > 0.8 || sun > 0.42) rect(x + r * 5, y + 2, 4 + Math.floor((r + sun) * 12), 2, sun > 0.4 ? palette.sparkle : palette.waterLight);
      }
    }
    const shore = worldToScreenY(WATER_START);
    if (shore > -8 && shore < H + 8) {
      rect(0, shore - 3, W, 3, '#e5bd67');
      rect(0, shore, W, 2, '#f0d28a');
      rect(0, shore + 3, W, 2, '#b97c36');
    }
  }

  function drawRoad() {
    if (state.carY > ROAD_END + 680) return;
    const top = clamp(worldToScreenY(ROAD_END), 0, H);
    rect(18, top, 52, H - top, palette.road);
    rect(18, top, 3, H - top, '#4d612d');
    rect(70, top, 5, H - top, palette.hedge);
    for (let y = Math.floor(top); y < H; y += 9) {
      rect(29, y, 2, 7, palette.roadDark);
      rect(55, y + 2, 2, 5, palette.roadDark);
      if (hash(4, y) > 0.58) rect(22 + hash(y, 2) * 42, y + 1, 3, 2, palette.roadLight);
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
      rrect(p.x, sy, w, h, p.angle, corn ? palette.trailCorn : '#b9813a');
      rrect(p.x - w * 0.27, sy, 5, h + 5, p.angle, corn ? '#d0a057' : '#d4a45a');
      rrect(p.x + w * 0.27, sy, 5, h + 5, p.angle, corn ? '#d0a057' : '#d4a45a');
      rrect(p.x, sy + 2, w * 0.42, 4, p.angle, corn ? '#6a522c' : '#986b31');
      for (let n = 0; n < (corn ? 10 : 6); n++) {
        const r1 = hash(p.seed + n * 3, i);
        const r2 = hash(p.seed - n * 5, i + 17);
        const lx = p.x + (r1 - 0.5) * w;
        const ly = sy + (r2 - 0.5) * h;
        rect(lx, ly, corn && r1 > 0.4 ? 6 : 4, 2, corn ? '#263f1b' : '#835d2a');
        if (corn && r2 > 0.43) rect(lx + 2, ly - 5, 2, 6, r1 > 0.5 ? '#4c6f2b' : '#789042');
      }
    }
  }

  function drawDust() {
    for (const p of state.dust) {
      const sy = worldToScreenY(p.y);
      if (sy < -30 || sy > H + 30) continue;
      const alpha = 1 - p.age / p.life;
      ctx.globalAlpha = alpha * 0.72;
      rect(p.x - p.size / 2, sy - p.size / 2, p.size, p.size, '#d9aa62');
      if (p.size > 5) rect(p.x + 3, sy, p.size * 0.65, 2, '#e2bf7a');
      ctx.globalAlpha = 1;
    }
  }

  function drawTruckAt(x, y, scale = 1, steer = 0) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    ctx.rotate(steer * 0.11);
    rect(-19, 22, 38, 9, 'rgba(0,0,0,0.35)');
    rect(-18, -31, 36, 54, palette.truck);
    rect(-15, -28, 30, 13, palette.truck2);
    rect(-14, -12, 28, 26, '#10161b');
    rect(-12, -24, 24, 5, palette.truckHi);
    rect(-16, -18, 4, 34, '#07090b');
    rect(12, -18, 4, 34, '#07090b');
    rect(-16, 18, 10, 4, palette.tail);
    rect(6, 18, 10, 4, palette.tail);
    rect(-15, -36, 30, 4, palette.rack);
    rect(-15, -32, 3, 14, palette.rack);
    rect(12, -32, 3, 14, palette.rack);
    rect(-9, -31, 18, 2, palette.rack);
    ctx.restore();
  }

  function drawDroneAt(x, y, scale = 1, showShadow = true) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(scale, scale);
    if (showShadow) rect(-12, 45, 24, 5, 'rgba(0,0,0,0.32)');
    rect(-40, 1, 80, 5, palette.drone);
    rect(-34, -3, 68, 4, palette.droneHi);
    rect(-20, -9, 40, 17, '#151922');
    rect(-6, -15, 12, 23, '#343a46');
    rect(-37, 6, 18, 4, '#080a0d');
    rect(19, 6, 18, 4, '#080a0d');
    rect(-2, 8, 4, 4, '#b94e32');
    ctx.restore();
  }

  function drawTruck() { drawTruckAt(state.carX, CAR_SCREEN_Y, 1, state.steer); }
  function drawDrone() {
    const y = worldToScreenY(droneY());
    if (y < -90 || y > H + 90) return;
    drawDroneAt(droneX(), y, 1, true);
  }

  function drawHud() {
    const dist = cliffDistance();
    const align = alignmentScore();
    ctx.fillStyle = 'rgba(7,10,7,0.70)';
    ctx.fillRect(8, 10, W - 16, 70);
    stroke(8, 10, W - 16, 70, 'rgba(255,232,166,0.28)', 2);
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
    ctx.fillText(Math.max(0, state.gameTimer).toFixed(1) + 's', 8 + colW * 1.5, 56);
    const barX = 8 + colW * 2 + 18;
    rect(barX, 49, colW - 36, 8, '#49341d');
    rect(barX, 49, (colW - 36) * align, 8, align > ALIGN_THRESHOLD ? '#f2d46d' : palette.danger);
    ctx.textAlign = 'left';
    if (!brakesUnlocked()) {
      rect(112, 86, 226, 22, 'rgba(7,10,7,0.58)');
      ctx.fillStyle = palette.dim;
      ctx.font = '10px monospace';
      ctx.fillText('BRAKES LOCKED UNTIL DRY FIELD', 128, 101);
    }
    drawControls();
  }

  function drawControls() {
    if (state.mode !== 'intro' && state.mode !== 'play') return;
    const y = H - 83;
    const locked = !brakesUnlocked();
    rect(18, y, 118, 52, input.left ? 'rgba(255,232,166,0.24)' : 'rgba(8,10,7,0.42)');
    rect(156, y, 138, 52, locked ? 'rgba(80,80,70,0.32)' : input.brake ? 'rgba(255,232,166,0.34)' : 'rgba(8,10,7,0.42)');
    rect(314, y, 118, 52, input.right ? 'rgba(255,232,166,0.24)' : 'rgba(8,10,7,0.42)');
    ctx.fillStyle = palette.ui;
    ctx.font = '12px monospace';
    ctx.fillText('LEFT', 60, y + 31);
    ctx.fillText(locked ? 'LOCKED' : 'BRAKE', locked ? 204 : 207, y + 31);
    ctx.fillText('RIGHT', 353, y + 31);
  }

  function drawMurphyLaw(now) {
    const t = clamp((now - state.lawStartedAt) / 5200, 0, 1);
    rect(0, 0, W, H, '#000');
    const glow = ctx.createRadialGradient(W / 2, H * 0.48, 20, W / 2, H * 0.48, 250);
    glow.addColorStop(0, 'rgba(120,154,172,0.22)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 3) rect(0, y, W, 1, 'rgba(105,135,150,0.06)');
    for (let i = 0; i < 32; i++) {
      const x = hash(i, 11) * W;
      const y = hash(i, 21) * H;
      ctx.globalAlpha = 0.18 + hash(i, 31) * 0.26;
      rect(x, y, hash(i, 33) > 0.65 ? 2 : 1, 1, '#d8f0ef');
    }
    ctx.globalAlpha = 1;
    const titleAlpha = clamp((t - 0.10) / 0.16, 0, 1) * clamp((0.72 - t) / 0.20, 0, 1);
    const lineAlpha = clamp((t - 0.32) / 0.16, 0, 1) * clamp((0.92 - t) / 0.16, 0, 1);
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255,255,255,0.18)';
    ctx.shadowBlur = 18;
    ctx.globalAlpha = titleAlpha * 0.7;
    ctx.fillStyle = '#f1ead3';
    ctx.font = '13px Arial, sans-serif';
    ctx.fillText('in the field', W / 2, H * 0.35);
    ctx.globalAlpha = titleAlpha;
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText("Murphy's Law", W / 2, H * 0.43);
    ctx.globalAlpha = lineAlpha;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#c9c3b4';
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText('Anything that can happen, will happen.', W / 2, H * 0.50);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawMenuBackground() {
    rect(0, 0, W, H, '#000');
    if (menuBgReady) {
      const scale = Math.max(W / menuBg.width, H / menuBg.height);
      const dw = menuBg.width * scale;
      const dh = menuBg.height * scale;
      ctx.drawImage(menuBg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      rect(0, 0, W, H, '#070908');
    }
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, H * 0.50, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.50, W, H * 0.50);
  }

  function drawButton(b, label) {
    rect(b.x, b.y, b.w, b.h, 'rgba(0,0,0,0.78)');
    stroke(b.x, b.y, b.w, b.h, 'rgba(255,255,255,0.22)', 1.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f3eee2';
    ctx.font = '15px Arial, sans-serif';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    ctx.textAlign = 'left';
  }

  function drawPosterTitle() {
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#f4e7c8';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('CHASE FIELD', W / 2, 108);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b7aa8d';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText('A cinematic pixel pursuit', W / 2, 138);
    ctx.textAlign = 'left';
  }

  function drawMenu() {
    drawMenuBackground();
    drawPosterTitle();
    drawButton(buttons.play, 'PLAY');
    drawButton(buttons.how, 'HOW TO PLAY');
  }

  function drawStartFade(now) {
    drawMenu();
    const t = clamp((now - state.transitionStartedAt) / 1600, 0, 1);
    ctx.globalAlpha = smooth(t);
    rect(0, 0, W, H, '#000');
    ctx.globalAlpha = 1;
  }

  function drawHowTo() {
    drawMenuBackground();
    rect(34, 70, W - 68, 650, 'rgba(0,0,0,0.82)');
    stroke(34, 70, W - 68, 650, 'rgba(255,255,255,0.18)', 1.5);
    ctx.fillStyle = palette.cream;
    ctx.textAlign = 'center';
    ctx.font = '22px Georgia, serif';
    ctx.fillText('HOW TO PLAY', W / 2, 116);
    ctx.font = '11px monospace';
    ctx.fillStyle = palette.dim;
    ctx.fillText('OBJECTS AND RULES', W / 2, 138);
    drawTruckAt(102, 205, 0.72, 0);
    drawDroneAt(104, 312, 0.58, true);
    rect(80, 390, 48, 18, palette.trailCorn);
    for (let x = 72; x < 132; x += 8) {
      rect(x, 384 + hash(x, 9) * 22, 2, 12, palette.cornMid);
      rect(x + 2, 384 + hash(x, 6) * 22, 5, 2, palette.cornTip);
    }
    rect(76, 493, 54, 24, palette.dry);
    rect(76, 520, 54, 34, palette.water);
    ctx.textAlign = 'left';
    ctx.fillStyle = palette.ui;
    ctx.font = '12px monospace';
    ctx.fillText('TRUCK', 156, 194);
    ctx.fillStyle = palette.dim;
    ctx.fillText('Steer through the long', 156, 214);
    ctx.fillText('cornfield.', 156, 232);
    ctx.fillStyle = palette.ui;
    ctx.fillText('DRONE', 156, 302);
    ctx.fillStyle = palette.dim;
    ctx.fillText('Stay aligned under it.', 156, 322);
    ctx.fillText('It keeps flying forward.', 156, 340);
    ctx.fillStyle = palette.ui;
    ctx.fillText('TRAIL', 156, 394);
    ctx.fillStyle = palette.dim;
    ctx.fillText('Your path crushes stalks', 156, 414);
    ctx.fillText('and leaves damaged rows.', 156, 432);
    ctx.fillStyle = palette.ui;
    ctx.fillText('DRY FIELD / CLIFF', 156, 505);
    ctx.fillStyle = palette.dim;
    ctx.fillText('Brakes unlock in the dry', 156, 525);
    ctx.fillText('field. Stop before water.', 156, 543);
    ctx.fillStyle = palette.cream;
    ctx.textAlign = 'center';
    ctx.font = '11px monospace';
    ctx.fillText('HUD: CLIFF DISTANCE | TIME | ALIGNMENT', W / 2, 612);
    ctx.fillText('BRAKES ARE LOCKED UNTIL THE DRY FIELD.', W / 2, 636);
    drawButton(buttons.howClose, 'CLOSE');
    drawButton(buttons.howPlay, 'PLAY');
    ctx.textAlign = 'left';
  }

  function drawResult() {
    drawWorld();
    drawTrail();
    drawDust();
    drawDrone();
    drawTruck();
    drawHud();
    rect(0, 238, W, 238, 'rgba(5,8,5,0.72)');
    ctx.fillStyle = state.mode === 'win' ? '#f6e081' : '#ef986e';
    ctx.textAlign = 'center';
    ctx.font = '18px monospace';
    ctx.fillText(state.mode === 'win' ? 'MISSION COMPLETE' : 'CHASE FAILED', W / 2, 292);
    ctx.font = '12px monospace';
    wrapText(state.result, 36).forEach((line, i) => ctx.fillText(line, W / 2, 330 + i * 18));
    drawButton({ x: 118, y: 394, w: 214, h: 44 }, 'MAIN MENU');
    ctx.textAlign = 'left';
  }

  function wrapText(text, max) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      if ((line + word).length > max) { lines.push(line.trim()); line = word + ' '; }
      else line += word + ' ';
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  function draw(now) {
    if (state.mode === 'law') { drawMurphyLaw(now); return; }
    if (state.mode === 'menu') { drawMenu(); return; }
    if (state.mode === 'how') { drawHowTo(); return; }
    if (state.mode === 'startFade') { drawStartFade(now); return; }
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
    draw(now);
    requestAnimationFrame(loop);
  }

  function pointToCanvas(e) {
    const rectBox = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rectBox.left) / rectBox.width) * W, y: ((e.clientY - rectBox.top) / rectBox.height) * H };
  }

  function pointerControlFromPoint(pt) {
    const brake = pt.y > H - 126 && pt.x > 132 && pt.x < 318;
    return { brake, left: !brake && pt.x < W / 2, right: !brake && pt.x >= W / 2 };
  }

  function handleMenuTap(pt) {
    if (state.mode === 'law') { state.mode = 'menu'; return true; }
    if (state.mode === 'menu') {
      if (inRect(pt, buttons.play)) { beginGameTransition(); return true; }
      if (inRect(pt, buttons.how)) { state.mode = 'how'; return true; }
    }
    if (state.mode === 'how') {
      if (inRect(pt, buttons.howClose)) { state.mode = 'menu'; return true; }
      if (inRect(pt, buttons.howPlay)) { beginGameTransition(); return true; }
    }
    if (state.mode === 'win' || state.mode === 'fail') { restartToMenu(); return true; }
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
    if (state.mode === 'law' && (key === 'enter' || key === ' ')) state.mode = 'menu';
    else if (state.mode === 'menu' && (key === 'enter' || key === ' ')) beginGameTransition();
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
