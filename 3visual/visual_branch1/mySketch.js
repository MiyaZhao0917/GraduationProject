// input layer
const input = {
  proximity: 0,
  touch: 0,
  noiseLevel: 0,
  phase: "anxiety",
  autoPlay: false
};


// state layer
const state = {
  phase: "anxiety",
  phaseBlend: 0,        // 0 = anxiety, 1 = relief
  disturbance: 1,
  flicker: 1,
  density: 1,
  numberEnergy: 1,
  coreEnergy: 1,
  breath: 0,
  calmOpacity: 0,
  calmSpeed: 0.12
};


// visual layer data
let anxietyLayer, reliefLayer;
let scribblers = [];
let numbersCloud = [];
let flares = [];
let softBlobs = [];
let mist = [];

const DIGITS = "0123456789";

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  initLayers();
  initSystems();
}

function initLayers() {
  anxietyLayer = createGraphics(windowWidth, windowHeight);
  reliefLayer = createGraphics(windowWidth, windowHeight);
  anxietyLayer.pixelDensity(1);
  reliefLayer.pixelDensity(1);
  anxietyLayer.background(0);
  reliefLayer.clear();
}

function initSystems() {
  initAnxietySystem();
  initReliefSystem();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initLayers();
  initSystems();
}

function draw() {
  updateInput();
  updateState();
  drawBaseBackground();

  updateAnxietyLayer();
  updateReliefLayer();

  push();
  tint(255, 255 * (1 - state.phaseBlend));
  image(anxietyLayer, 0, 0);
  pop();

  push();
  tint(255, 255 * state.phaseBlend);
  image(reliefLayer, 0, 0);
  pop();

  drawTransitionWash();
}


// input/state
function updateInput() {
  let mx = constrain(mouseX / max(width, 1), 0, 1);
  let my = constrain(mouseY / max(height, 1), 0, 1);

  input.proximity = mx;
  input.noiseLevel = my;
  input.touch = mouseIsPressed ? 1 : 0;

  if (input.autoPlay) {
    let t = millis() * 0.00022;
    input.proximity = map(sin(t * 1.3), -1, 1, 0.15, 0.95);
    input.noiseLevel = map(cos(t * 1.8), -1, 1, 0.12, 0.92);
    let s = sin(t * 0.33);
    if (s > 0.35) input.phase = "anxiety";
    else if (s < -0.35) input.phase = "relief";
    else input.phase = "transition";
  }

  state.phase = input.phase;
}

function updateState() {
  let targetBlend = 0;
  if (state.phase === "transition") targetBlend = 0.5;
  if (state.phase === "relief") targetBlend = 1;

  state.phaseBlend = lerp(state.phaseBlend, targetBlend, 0.03);

  const anxietyAmt = 1 - state.phaseBlend;
  state.disturbance = lerp(0.12, 1.55, anxietyAmt + input.noiseLevel * 0.22 + input.touch * 0.08);
  state.flicker = lerp(0.08, 1.25, anxietyAmt + input.proximity * 0.15);
  state.density = lerp(0.15, 1.15, anxietyAmt + input.proximity * 0.18);
  state.numberEnergy = lerp(0.08, 1.2, anxietyAmt);
  state.coreEnergy = lerp(0.18, 1.2, anxietyAmt + input.proximity * 0.16);

  state.breath = map(sin(millis() * 0.0014), -1, 1, 0, 1);
  state.calmOpacity = smoothstep(0.28, 1.0, state.phaseBlend);
  state.calmSpeed = lerp(0.32, 0.05, state.phaseBlend);
}

function drawBaseBackground() {
  const start = color(0, 0, 0);
  const end = color(5, 13, 18);
  const bg = lerpColor(start, end, state.phaseBlend * 0.9);
  background(bg);

  noStroke();
  for (let i = 0; i < 9; i++) {
    fill(0, map(i, 0, 8, 3, 14));
    rectMode(CENTER);
    rect(width / 2, height / 2, width * (1.03 + i * 0.03), height * (1.03 + i * 0.03));
  }
}

function smoothstep(a, b, x) {
  let t = constrain((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}


// anxiety system
function initAnxietySystem() {
  scribblers = [];
  numbersCloud = [];
  flares = [];

  const cx = width * 0.5;
  const cy = height * 0.52;
  const minDim = min(width, height);

  for (let i = 0; i < 150; i++) {
    let a = random(TWO_PI);
    let r = random(minDim * 0.12, minDim * 0.38);
    let x = cx + cos(a) * r;
    let y = cy + sin(a) * r;
    scribblers.push({
      x, y,
      px: x,
      py: y,
      angle: a,
      orbit: r,
      jitter: random(0.8, 2.8),
      drift: random(0.6, 1.8),
      weight: random(0.7, 2.3),
      speed: random(0.004, 0.022) * random([-1, 1]),
      seed: random(10000),
      tone: random(["white", "white", "yellow", "orange", "red"])
    });
  }

  for (let i = 0; i < 16; i++) {
    flares.push({
      angle: random(TWO_PI),
      len: random(minDim * 0.16, minDim * 0.34),
      seed: random(10000)
    });
  }

  for (let i = 0; i < 110; i++) {
    let a = random(TWO_PI);
    let ring = random(minDim * 0.24, minDim * 0.48);
    numbersCloud.push({
      a,
      ring,
      value: floor(random(0, 9999)),
      size: random(10, 32),
      seed: random(10000),
      alpha: random(50, 180)
    });
  }
}

function updateAnxietyLayer() {
  const cx = width * 0.5;
  const cy = height * 0.52;
  const minDim = min(width, height);

  anxietyLayer.noStroke();
  anxietyLayer.fill(0, 16 + 34 * state.phaseBlend);
  anxietyLayer.rect(0, 0, width, height);

  drawAnxietyCore(cx, cy, minDim);
  drawAnxietyScribbles(cx, cy, minDim);
  drawAnxietyStrings(cx, cy, minDim);
  drawAnxietyFlares(cx, cy, minDim);
  drawAnxietyNumbers(cx, cy);
  drawAnxietyScan(cx, cy, minDim);
}

function drawAnxietyCore(cx, cy, minDim) {
  anxietyLayer.push();
  anxietyLayer.blendMode(ADD);
  anxietyLayer.noStroke();

  const pulse = map(sin(millis() * 0.006), -1, 1, 0.95, 1.08);
  const hotR = minDim * (0.11 + state.coreEnergy * 0.08) * pulse;

  const rings = [
    [255, 30, 0, 6, 4.6],
    [255, 120, 0, 10, 3.6],
    [255, 210, 30, 14, 2.7],
    [255, 245, 170, 18, 1.9],
    [255, 255, 235, 26, 1.35],
    [255, 255, 255, 48, 0.95]
  ];

  for (const [r, g, b, a, mul] of rings) {
    anxietyLayer.fill(r, g, b, a * (0.75 + state.coreEnergy * 0.5));
    anxietyLayer.ellipse(cx, cy, hotR * mul, hotR * mul);
  }

  for (let i = 0; i < 18; i++) {
    const ang = random(TWO_PI);
    const rr = hotR * random(0.5, 1.55);
    const x = cx + cos(ang) * rr * random(0.3, 0.9);
    const y = cy + sin(ang) * rr * random(0.3, 0.9);
    anxietyLayer.fill(255, 250, 220, random(8, 20) * state.flicker);
    anxietyLayer.ellipse(x, y, random(hotR * 0.08, hotR * 0.36));
  }

  anxietyLayer.pop();
}

function drawAnxietyScribbles(cx, cy, minDim) {
  anxietyLayer.push();
  anxietyLayer.blendMode(ADD);
  anxietyLayer.noFill();

  for (let s of scribblers) {
    s.px = s.x;
    s.py = s.y;

    let t = frameCount * 0.01;
    s.angle += s.speed * (0.6 + state.disturbance * 0.8);

    let orbitJitter = map(noise(s.seed, t), 0, 1, -minDim * 0.06, minDim * 0.06) * state.disturbance;
    let pull = s.orbit + orbitJitter;

    let nx = map(noise(s.seed + 40, t * 1.7), 0, 1, -38, 38) * s.jitter * state.disturbance;
    let ny = map(noise(s.seed + 80, t * 1.7), 0, 1, -38, 38) * s.jitter * state.disturbance;

    s.x = cx + cos(s.angle) * pull + nx;
    s.y = cy + sin(s.angle) * pull + ny;

    let col = scribbleColor(s.tone);
    let alpha = random(40, 90) * state.flicker;

    anxietyLayer.stroke(col[0], col[1], col[2], alpha);
    anxietyLayer.strokeWeight(s.weight * (0.8 + state.density * 0.55));
    anxietyLayer.line(s.px, s.py, s.x, s.y);

    if (random() < 0.24 * state.density) {
      anxietyLayer.stroke(255, 250, 220, alpha * 0.75);
      anxietyLayer.strokeWeight(s.weight * 0.5);
      anxietyLayer.point(s.x, s.y);
    }
  }

  anxietyLayer.pop();
}

function drawAnxietyStrings(cx, cy, minDim) {
  anxietyLayer.push();
  anxietyLayer.blendMode(ADD);
  anxietyLayer.noFill();

  for (let k = 0; k < 5; k++) {
    let amp = minDim * (0.035 + k * 0.008) * state.disturbance;
    let baseY = cy + map(k, 0, 4, -minDim * 0.16, minDim * 0.16) + sin(frameCount * 0.015 + k) * 20;
    let hueType = k % 2 === 0 ? [255, 245, 220] : [255, 190, 60];
    anxietyLayer.stroke(hueType[0], hueType[1], hueType[2], 28 * state.flicker);
    anxietyLayer.strokeWeight(1.2 + k * 0.15);
    anxietyLayer.beginShape();
    for (let x = 0; x <= width; x += 18) {
      let wave = sin(x * 0.012 + frameCount * 0.04 + k * 1.6) * amp;
      let noiseWave = map(noise(k * 200 + x * 0.01, frameCount * 0.015), 0, 1, -amp, amp);
      anxietyLayer.curveVertex(x, baseY + wave + noiseWave);
    }
    anxietyLayer.endShape();
  }

  anxietyLayer.pop();
}

function drawAnxietyFlares(cx, cy, minDim) {
  anxietyLayer.push();
  anxietyLayer.blendMode(ADD);
  anxietyLayer.noFill();

  for (let f of flares) {
    let strength = map(noise(f.seed, frameCount * 0.035), 0, 1, 0, 1);
    if (strength < 0.52) continue;

    let a = f.angle + sin(frameCount * 0.008 + f.seed) * 0.3;
    let inner = minDim * 0.05;
    let outer = inner + f.len * (0.6 + strength * 0.6);

    let x1 = cx + cos(a) * inner;
    let y1 = cy + sin(a) * inner;
    let x2 = cx + cos(a) * outer;
    let y2 = cy + sin(a) * outer;

    anxietyLayer.stroke(255, 245, 200, 24 * strength * state.flicker);
    anxietyLayer.strokeWeight(2.4 * strength);
    anxietyLayer.line(x1, y1, x2, y2);

    anxietyLayer.stroke(255, 120, 30, 18 * strength * state.flicker);
    anxietyLayer.strokeWeight(5 * strength);
    anxietyLayer.line(x1, y1, x2, y2);
  }

  anxietyLayer.pop();
}

function drawAnxietyNumbers(cx, cy) {
  anxietyLayer.push();
  anxietyLayer.blendMode(ADD);
  anxietyLayer.noStroke();
  anxietyLayer.textAlign(CENTER, CENTER);
  anxietyLayer.textFont('monospace');

  for (let d of numbersCloud) {
    let t = frameCount * 0.014;
    let a = d.a + sin(t + d.seed) * 0.14 + noise(d.seed, t) * 0.55;
    let rr = d.ring + map(noise(d.seed + 60, t * 1.5), 0, 1, -26, 26) * state.disturbance;
    let x = cx + cos(a) * rr;
    let y = cy + sin(a) * rr;

    if (random() < 0.07 + 0.05 * state.numberEnergy) {
      d.value = floor(random(0, 9999));
    }

    anxietyLayer.fill(255, random(120, 240), random(40, 110), d.alpha * state.numberEnergy);
    anxietyLayer.textSize(d.size * random(0.9, 1.15));
    anxietyLayer.text(nf(d.value, 4), x, y);
  }

  anxietyLayer.pop();
}

function drawAnxietyScan(cx, cy, minDim) {
  anxietyLayer.push();
  anxietyLayer.noStroke();

  for (let y = 0; y < height; y += 5) {
    anxietyLayer.fill(255, 20, 20, random(0, 4) * state.flicker);
    anxietyLayer.rect(0, y, width, 1);
  }

  if (random() < 0.12 * state.flicker) {
    let barY = cy + random(-minDim * 0.28, minDim * 0.28);
    anxietyLayer.fill(255, 255, 255, random(20, 40));
    anxietyLayer.rect(0, barY, width, random(2, 8));
  }

  anxietyLayer.pop();
}

function scribbleColor(kind) {
  if (kind === "white") return [255, 250, 240];
  if (kind === "yellow") return [255, 240, 60];
  if (kind === "orange") return [255, 170, 20];
  return [255, 40, 25];
}


// relief system
function initReliefSystem() {
  softBlobs = [];
  mist = [];
  const minDim = min(width, height);

  for (let i = 0; i < 10; i++) {
    softBlobs.push({
      x: random(width),
      y: random(height),
      r: random(minDim * 0.16, minDim * 0.33),
      dx: random(-0.16, 0.16),
      dy: random(-0.08, 0.08),
      seed: random(10000),
      palette: random([0, 1, 2, 3])
    });
  }

  for (let i = 0; i < 18; i++) {
    mist.push({
      seed: random(10000),
      scale: random(120, 420)
    });
  }
}

function updateReliefLayer() {
  reliefLayer.clear();
  drawReliefBlobs();
  drawReliefBreath();
  drawReliefMist();
}

function drawReliefBlobs() {
  reliefLayer.push();
  reliefLayer.blendMode(SCREEN);
  reliefLayer.noStroke();

  for (let b of softBlobs) {
    let t = millis() * 0.00022;
    let bx = b.x + sin(t * 1.1 + b.seed) * 60 + b.dx * frameCount * state.calmSpeed;
    let by = b.y + cos(t * 0.9 + b.seed) * 40 + b.dy * frameCount * state.calmSpeed;
    let breathScale = 0.92 + 0.16 * sin(t * TWO_PI * 1.1 + b.seed);
    let rr = b.r * breathScale;
    let col = reliefPalette(b.palette);
    drawSoftBlob(reliefLayer, bx, by, rr, col);
  }

  reliefLayer.pop();
}

function reliefPalette(i) {
  if (i === 0) return [178, 224, 255, 26];
  if (i === 1) return [182, 245, 226, 24];
  if (i === 2) return [240, 221, 255, 22];
  return [255, 232, 244, 20];
}

function drawSoftBlob(g, x, y, radius, col) {
  for (let i = 1; i >= 0; i -= 0.055) {
    let rr = radius * i;
    let alpha = col[3] * (1 - i) * 1.8 * state.calmOpacity;
    g.fill(col[0], col[1], col[2], alpha);
    g.ellipse(x, y, rr * 1.18, rr);
  }
}

function drawReliefBreath() {
  reliefLayer.push();
  reliefLayer.blendMode(SCREEN);
  reliefLayer.noStroke();

  let s = map(state.breath, 0, 1, 0.92, 1.08);
  let cx = width * 0.5;
  let cy = height * 0.54;

  for (let i = 0; i < 8; i++) {
    reliefLayer.fill(225, 245, 255, (16 - i * 1.4) * state.calmOpacity);
    reliefLayer.ellipse(cx, cy, width * 0.42 * s + i * 90, height * 0.24 * s + i * 60);
  }

  reliefLayer.pop();
}

function drawReliefMist() {
  reliefLayer.push();
  reliefLayer.noStroke();
  reliefLayer.blendMode(SCREEN);

  for (let i = 0; i < mist.length; i++) {
    let m = mist[i];
    let t = millis() * 0.00012;
    let x = map(noise(m.seed, t), 0, 1, -80, width + 80);
    let y = map(noise(m.seed + 30, t), 0, 1, -40, height + 40);
    let w = m.scale * map(noise(m.seed + 80, t), 0, 1, 0.7, 1.4);
    let h = w * 0.34;
    reliefLayer.fill(230, 238, 255, 10 * state.calmOpacity);
    reliefLayer.ellipse(x, y, w, h);
  }

  reliefLayer.pop();
}


// transition overlay
function drawTransitionWash() {
  if (state.phase !== "transition") return;
  push();
  noStroke();
  blendMode(ADD);
  let pulse = map(sin(millis() * 0.003), -1, 1, 0.4, 1.0);
  for (let i = 0; i < 5; i++) {
    fill(255, 200 + i * 8, 220 + i * 6, 9 * pulse);
    ellipse(width * (0.25 + i * 0.14), height * (0.45 + sin(frameCount * 0.01 + i) * 0.04), 220 + i * 120, 90 + i * 55);
  }
  pop();
}


// controls
function keyPressed() {
  if (key === '1') {
    input.phase = "anxiety";
    input.autoPlay = false;
  }
  if (key === '2') {
    input.phase = "relief";
    input.autoPlay = false;
  }
  if (key === '3') {
    input.phase = "transition";
    input.autoPlay = false;
  }
  if (key === 'a' || key === 'A') {
    input.autoPlay = !input.autoPlay;
  }
}