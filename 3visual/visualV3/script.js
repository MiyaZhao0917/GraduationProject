let phase = 0; // 0 = anxiety_1, 1 = anxiety_2, 2 = relief

let uiEl;
let uiHideTimer = 7;

// anxiety 1
let stage1Elements = [];
let stage1SpawnTimer = 0;

const SIGNAL_WORDS = [
  'viewed', 'liked', 'new replies', 'boosted', 'hidden', 'not shown', 'delivered', 'typing...'
];

// anxiety 2
let chaosLines = [];
let panicDigits = [];
let panicFlares = [];

const PLATFORM_WORDS = [
  'seen', 'delivered', 'typing...', '2 views', '3 online', 'last seen', '0 new replies',
  'sent', 'read', 'active now', 'viewed', 'processing', 'loading', 'refreshing', 'syncing'
];

const JUDGEMENT_WORDS = [
  'too much', 'embarrassing', 'why post this', 'cringe', 'again?', 'desperate',
  'annoying', 'try hard', 'not interesting', 'stop', 'who cares', 'awkward', 'weird'
];

const SELF_WORDS = [
  'is this about me', 'they saw it', 'why no reply', 'did I say too much',
  'everyone noticed', 'they mean me', "I shouldn't post", 'I knew it',
  'they are ignoring me', 'I messed up', 'why did I say that'
];

// relief
let reliefRipples = [];
let reliefBlobs = [];
let reliefPetals = [];
let reliefWords = [];
let reliefMotes = [];

const RELIEF_WORDS = [
  'drift', 'slow', 'soft', 'hush', 'air', 'water', 'light', 'bloom'
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont('monospace');
  rectMode(CENTER);
  noCursor();
  uiEl = document.getElementById('ui');
  initScene();
}

function initScene() {
  initStage1();
  initStage2();
  initRelief();
}

function initStage1() {
  stage1Elements = [];
  stage1SpawnTimer = 0;
}

function initStage2() {
  chaosLines = [];
  panicDigits = [];
  panicFlares = [];

  const lineCount = floor(map(width * height, 300000, 3000000, 90, 220, true));
  const digitCount = floor(map(width * height, 300000, 3000000, 90, 180, true));
  const flareCount = 12;

  for (let i = 0; i < lineCount; i++) chaosLines.push(new ChaosLine());
  for (let i = 0; i < digitCount; i++) panicDigits.push(new PanicDigit());
  for (let i = 0; i < flareCount; i++) panicFlares.push(new PanicFlare());
}

function initRelief() {
  reliefRipples = [];
  reliefBlobs = [];
  reliefPetals = [];
  reliefWords = [];
  reliefMotes = [];

  const rippleCount = 1;
  const blobCount = 8;
  const petalCount = floor(map(width * height, 300000, 3000000, 5, 8, true));
  const wordCount = floor(map(width * height, 300000, 3000000, 4, 7, true));
  const moteCount = floor(map(width * height, 300000, 3000000, 120, 220, true));

  for (let i = 0; i < rippleCount; i++) reliefRipples.push(new ReliefRipple(i));
  for (let i = 0; i < blobCount; i++) reliefBlobs.push(new ReliefBlob(i));
  for (let i = 0; i < petalCount; i++) reliefPetals.push(new ReliefPetal(i));
  for (let i = 0; i < wordCount; i++) reliefWords.push(new ReliefWord());
  for (let i = 0; i < moteCount; i++) reliefMotes.push(new ReliefMote());
}

function showUI(seconds = 4) {
  uiHideTimer = seconds;
  uiEl.classList.remove('hidden');
}

function getCurrentAnxietyWord() {
  if (phase === 0) {
    return random() < 0.76 ? random(PLATFORM_WORDS) : random(JUDGEMENT_WORDS);
  }
  if (phase === 1) {
    const r = random();
    if (r < 0.24) return random(PLATFORM_WORDS);
    if (r < 0.56) return random(JUDGEMENT_WORDS);
    return random(SELF_WORDS);
  }
  return '';
}

function draw() {
  uiHideTimer -= deltaTime / 1000;
  if (uiHideTimer <= 0) uiEl.classList.add('hidden');

  if (phase === 0) {
    drawStage1();
  } else if (phase === 1) {
    drawBaseBackground();
    drawAnxietyPhase(1);
    drawTransitionVeil();
  } else {
    drawReliefStage();
    drawTransitionVeil();
  }
}


// anxiety 1
function drawStage1() {
  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#08040a');
  g.addColorStop(0.45, '#12060b');
  g.addColorStop(1, '#030304');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);

  const glow = drawingContext.createRadialGradient(mouseX || width * 0.5, mouseY || height * 0.5, 0, mouseX || width * 0.5, mouseY || height * 0.5, max(width, height) * 0.45);
  glow.addColorStop(0, 'rgba(255,70,20,0.12)');
  glow.addColorStop(0.38, 'rgba(164,0,67,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = glow;
  drawingContext.fillRect(0, 0, width, height);

  drawStage1Scanlines();
  updateStage1Elements();
  drawStage1Elements();
  drawPointerDisturbance(0.8);
  drawTransitionVeil();
}

function drawStage1Scanlines() {
  push();
  noStroke();

  const beamY = (frameCount * 2.9) % (height + 180) - 90;
  const beam = drawingContext.createLinearGradient(0, beamY - 90, 0, beamY + 90);
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(0.5, 'rgba(255,70,70,0.11)');
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  drawingContext.fillStyle = beam;
  drawingContext.fillRect(0, beamY - 90, width, 180);

  for (let y = 0; y < height; y += 5) {
    fill(255, 255, 255, 4 + sin(frameCount * 0.09 + y * 0.03) * 3);
    rect(width / 2, y, width, 1);
  }
  pop();
}

function updateStage1Elements() {
  stage1SpawnTimer -= deltaTime / 1000;
  if (stage1SpawnTimer <= 0) {
    spawnStage1Burst();
    stage1SpawnTimer = random(0.08, 0.34);
  }

  for (let i = stage1Elements.length - 1; i >= 0; i--) {
    const e = stage1Elements[i];
    e.life -= deltaTime / 1000;

    if (e.type === 'loading') {
      e.progress += (deltaTime / 1000) * e.drift;
      if (e.progress > 1) e.progress -= 1;
    } else {
      e.x += e.vx * (deltaTime / 1000);
      e.y += e.vy * (deltaTime / 1000);
    }

    if (e.life <= 0) stage1Elements.splice(i, 1);
  }
}

function spawnStage1Burst() {
  const burstCount = floor(random(1, 5));
  for (let i = 0; i < burstCount; i++) {
    const r = random();
    if (r < 0.28) spawnFaceBox();
    else if (r < 0.50) spawnLoadingBar();
    else if (r < 0.78) spawnSignalText();
    else spawnNumericFlash();
  }
}

function spawnFaceBox() {
  const bw = random(70, 240);
  const bh = random(50, 170);
  const ttl = random(1.8, 4.2);
  stage1Elements.push({
    type: 'face',
    x: random(bw * 0.5, width - bw * 0.5),
    y: random(bh * 0.5, height - bh * 0.5),
    w: bw,
    h: bh,
    ttl,
    life: ttl,
    lineWidth: random(1, 2.2),
    corner: random(12, 26),
    id: nf(floor(random(9999)), 4),
    vx: random(-6, 6),
    vy: random(-4, 4)
  });
}

function spawnLoadingBar() {
  const bw = random(120, 260);
  const ttl = random(1.6, 3.4);
  stage1Elements.push({
    type: 'loading',
    x: random(bw * 0.5 + 8, width - bw * 0.5 - 8),
    y: random(24, height - 24),
    w: bw,
    h: random(6, 10),
    progress: random(0.04, 0.86),
    drift: random(0.15, 0.55),
    label: random(['loading', 'scanning', 'indexing']),
    ttl,
    life: ttl
  });
}

function spawnSignalText() {
  const ttl = random(1.2, 3.2);
  stage1Elements.push({
    type: 'signal',
    x: random(70, width - 70),
    y: random(30, height - 30),
    text: random(SIGNAL_WORDS),
    size: random(12, 24),
    ttl,
    life: ttl,
    jitter: random(0.4, 2.2),
    vx: random(-10, 10),
    vy: random(-8, 8)
  });
}

function spawnNumericFlash() {
  const ttl = random(1.2, 2.8);
  const value = random() < 0.55 ? `${floor(random(9999))}` : `${random(100).toFixed(1)}%`;
  stage1Elements.push({
    type: 'numeric',
    x: random(50, width - 50),
    y: random(24, height - 24),
    text: value,
    sub: random(['CTR', 'rank', 'engagement', 'weight', 'score']),
    size: random(14, 28),
    ttl,
    life: ttl,
    vx: random(-14, 14),
    vy: random(-10, 10)
  });
}

function fadeStage1(life, ttl) {
  const inT = constrain((ttl - life) / (ttl * 0.24), 0, 1);
  const outT = constrain(life / (ttl * 0.28), 0, 1);
  return min(inT, outT);
}

function drawStage1Elements() {
  for (const e of stage1Elements) {
    const a = fadeStage1(e.life, e.ttl);

    if (e.type === 'face') {
      const left = e.x - e.w * 0.5;
      const top = e.y - e.h * 0.5;
      const right = e.x + e.w * 0.5;
      const bottom = e.y + e.h * 0.5;
      strokeWeight(e.lineWidth);
      stroke(random() < 0.08 ? color(255, 255, 255, (0.14 + a * 0.62) * 255) : color(255, 92, 76, (0.14 + a * 0.62) * 255));
      noFill();
      beginShape(); vertex(left, top + e.corner); vertex(left, top); vertex(left + e.corner, top); endShape();
      beginShape(); vertex(right - e.corner, top); vertex(right, top); vertex(right, top + e.corner); endShape();
      beginShape(); vertex(left, bottom - e.corner); vertex(left, bottom); vertex(left + e.corner, bottom); endShape();
      beginShape(); vertex(right - e.corner, bottom); vertex(right, bottom); vertex(right, bottom - e.corner); endShape();
      noStroke();
      fill(255, 220, 220, (0.18 + a * 0.5) * 255);
      textAlign(LEFT, BASELINE);
      textSize(12);
      text(`id:${e.id}`, left, top - 8);
      text(`track ${floor(78 + random(21))}%`, left, bottom + 18);
    } else if (e.type === 'loading') {
      const x = e.x - e.w * 0.5;
      const y = e.y - e.h * 0.5;
      noFill();
      stroke(255, 255, 255, (0.06 + a * 0.18) * 255);
      rect(e.x, e.y, e.w, e.h);
      noStroke();
      fill(255, 80, 54, (0.08 + a * 0.3) * 255);
      rectMode(CORNER);
      rect(x + 1, y + 1, max(1, (e.w - 2) * e.progress), e.h - 2);
      rectMode(CENTER);
      fill(255, 230, 230, (0.16 + a * 0.46) * 255);
      textAlign(LEFT, BASELINE);
      textSize(11);
      text(e.label, x, y - 8);
    } else if (e.type === 'signal') {
      const jx = random(-e.jitter, e.jitter);
      const jy = random(-e.jitter, e.jitter);
      textAlign(CENTER, CENTER);
      textSize(e.size);
      noStroke();
      fill(255, 255, 255, (0.03 + a * 0.12) * 255);
      text(e.text, e.x + 4, e.y + 4);
      fill(255, 112, 92, (0.14 + a * 0.72) * 255);
      text(e.text, e.x + jx, e.y + jy);
    } else if (e.type === 'numeric') {
      textAlign(CENTER, CENTER);
      textSize(e.size);
      noStroke();
      fill(255, 160, 120, (0.12 + a * 0.7) * 255);
      text(e.text, e.x + random(-2, 2), e.y + random(-2, 2));
      fill(255, 255, 255, (0.08 + a * 0.32) * 255);
      textSize(11);
      text(e.sub, e.x, e.y + 16 + e.size * 0.2);
    }
  }
}


// anxiety 2
function drawBaseBackground() {
  let c1 = color(7, 4, 10);
  let c2 = color(2, 3, 5);

  for (let y = 0; y < height; y += 4) {
    let inter = y / height;
    let c = lerpColor(c1, c2, inter);
    stroke(c);
    line(0, y, width, y);
  }
}

function drawAnxietyPhase(alphaFactor) {
  if (alphaFactor < 0.01) return;

  push();
  let flicker = random() < 0.08 ? random(8, 20) : 0;
  noStroke();
  fill(255, 20 * alphaFactor + flicker);
  rect(width / 2, height / 2, width, height);

  for (let i = 0; i < 4; i++) {
    let rr = map(i, 0, 3, width * 0.14, width * 0.55);
    noFill();
    stroke(120 + random(80), 10, 20, 12 * alphaFactor);
    strokeWeight(40);
    ellipse(width / 2 + sin(frameCount * 0.03 + i) * 30,
            height / 2 + cos(frameCount * 0.024 + i) * 18,
            rr * 2.1,
            rr * 1.15);
  }

  blendMode(BLEND);
  for (const ln of chaosLines) {
    ln.update(alphaFactor);
    ln.display(alphaFactor);
  }

  for (const dg of panicDigits) {
    dg.update(alphaFactor);
    dg.display(alphaFactor);
  }

  drawScanningBars(alphaFactor);
  drawPointerDisturbance(alphaFactor);
  pop();
}

function drawScanningBars(alphaFactor) {
  push();
  noStroke();
  for (let y = 0; y < height; y += 6) {
    fill(255, (sin(frameCount * 0.25 + y * 0.05) * 0.5 + 0.5) * 2.5 * alphaFactor);
    rect(width / 2, y, width, 1.1);
  }
  pop();
}

function drawPointerDisturbance(alphaFactor) {
  push();
  let mx = mouseX || width * 0.5;
  let my = mouseY || height * 0.5;

  noFill();
  stroke(255, 24 * alphaFactor);
  strokeWeight(1);
  for (let i = 0; i < 6; i++) {
    ellipse(mx, my, 40 + i * 22 + sin(frameCount * 0.18 + i) * 8, 40 + i * 22 + cos(frameCount * 0.14 + i) * 8);
  }

  stroke(255, 14 * alphaFactor);
  line(mx - 30, my, mx + 30, my);
  line(mx, my - 30, mx, my + 30);
  pop();
}

class ChaosLine {
  constructor() { this.reset(true); }
  reset(first = false) {
    this.x = random(width);
    this.y = random(height);
    this.len = random(50, 220);
    this.ang = random(TWO_PI);
    this.wobble = random(1000);
    this.weight = random(0.4, 1.8);
    this.speed = random(0.002, 0.012);
    this.alpha = random(20, 120);
    if (!first) this.ang = random(TWO_PI);
  }
  update(alphaFactor) {
    this.wobble += this.speed * (1.2 + alphaFactor * 3.2);
    this.ang += map(noise(this.wobble), 0, 1, -0.18, 0.18) * (0.8 + alphaFactor * 2.4);
    this.x += cos(this.ang) * random(-1.5, 1.5);
    this.y += sin(this.ang) * random(-1.5, 1.5);
    if (random() < 0.007) {
      this.x = lerp(this.x, mouseX, 0.2);
      this.y = lerp(this.y, mouseY, 0.2);
    }
    if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) this.reset();
  }
  display(alphaFactor) {
    let n = noise(this.wobble * 3.0);
    let pulse = random() < 0.03 ? random(80, 150) : 0;
    strokeWeight(this.weight + n * 1.1);
    stroke(180 + pulse, 22 + n * 40, 38 + n * 90, (this.alpha + pulse * 0.25) * alphaFactor);
    let x2 = this.x + cos(this.ang) * this.len;
    let y2 = this.y + sin(this.ang) * this.len;
    line(this.x, this.y, x2, y2);
    if (random() < 0.05) {
      stroke(255, 255 * alphaFactor * 0.12);
      line(this.x, this.y, mouseX, mouseY);
    }
  }
}

class PanicDigit {
  constructor() { this.reset(); }
  reset() {
    this.x = random(width);
    this.y = random(height);
    this.size = random(12, 30);
    this.char = getCurrentAnxietyWord();
    this.timer = floor(random(3, 18));
    this.vx = random(-2.4, 2.4);
    this.vy = random(-1.6, 1.6);
    this.alpha = random(80, 220);
  }
  update(alphaFactor) {
    this.timer--;
    this.x += this.vx * (0.7 + alphaFactor * 0.9);
    this.y += this.vy * (0.7 + alphaFactor * 0.9);
    if (random() < 0.18) {
      this.x += random(-24, 24);
      this.y += random(-16, 16);
    }
    if (phase === 1) {
      let centerPull = 0.0018;
      this.x = lerp(this.x, width * 0.5 + sin(frameCount * 0.04 + this.y * 0.01) * 30, centerPull);
      this.y = lerp(this.y, height * 0.5 + cos(frameCount * 0.035 + this.x * 0.01) * 18, centerPull);
      this.alpha = min(255, this.alpha + 0.35);
    }
    if (this.timer <= 0) {
      this.char = getCurrentAnxietyWord();
      this.size = constrain(this.size + random(-6, 6), 12, 34);
      this.timer = floor(random(2, 10));
    }
    if (random() < 0.015) {
      this.alpha = random(60, 255);
      this.char = getCurrentAnxietyWord();
    }
    const padX = 120;
    const padY = 60;
    if (this.x < -padX) this.x = width + padX;
    if (this.x > width + padX) this.x = -padX;
    if (this.y < -padY) this.y = height + padY;
    if (this.y > height + padY) this.y = -padY;
  }
  display(alphaFactor) {
    push();
    textAlign(CENTER, CENTER);
    textSize(this.size);
    let glow = random() < 0.06 ? 120 : 0;
    fill(255, 90 + glow, 120 + glow * 0.2, this.alpha * alphaFactor);
    text(this.char, this.x, this.y);
    if (random() < 0.1) {
      fill(255, 255, 255, 26 * alphaFactor);
      text(this.char, this.x + random(-4, 4), this.y + random(-4, 4));
    }
    pop();
  }
}

class PanicFlare {
  constructor() { this.reset(); }
  reset() {
    this.x = random(width);
    this.y = random(height);
    this.len = random(width * 0.18, width * 0.52);
    this.angle = random(TWO_PI);
    this.life = random(30, 120);
    this.maxLife = this.life;
    this.thickness = random(20, 90);
  }
  update() { this.life -= 1; if (this.life <= 0) this.reset(); }
  display(alphaFactor) {
    push();
    translate(this.x, this.y);
    rotate(this.angle + sin(frameCount * 0.03 + this.x * 0.01) * 0.2);
    let a = map(this.life, 0, this.maxLife, 0, 34) * alphaFactor;
    for (let i = 0; i < 5; i++) {
      stroke(255, 210, 240 - i * 30, a * (0.9 - i * 0.15));
      strokeWeight(this.thickness * (1 - i * 0.18));
      line(-this.len * 0.12, 0, this.len, 0);
    }
    pop();
  }
}


// relief
function drawReliefStage() {
  drawReliefBackground();

  for (const blob of reliefBlobs) {
    blob.update();
    blob.display();
  }

  for (const petal of reliefPetals) {
    petal.update();
    petal.display();
  }

  drawFlowingLight();

  for (const ripple of reliefRipples) {
    ripple.update();
    ripple.display();
  }

  for (const mote of reliefMotes) {
    mote.update();
    mote.display();
  }

  for (const word of reliefWords) {
    word.update();
    word.display();
  }
}

function drawReliefBackground() {
  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#4f7d83');
  g.addColorStop(0.34, '#5a8d96');
  g.addColorStop(0.7, '#6b98a3');
  g.addColorStop(1, '#567f88');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);

  const glow1 = drawingContext.createRadialGradient(width * 0.25, height * 0.25, 0, width * 0.25, height * 0.25, width * 0.45);
  glow1.addColorStop(0, 'rgba(255,214,160,0.14)');
  glow1.addColorStop(1, 'rgba(255,255,255,0)');
  drawingContext.fillStyle = glow1;
  drawingContext.fillRect(0, 0, width, height);

  const glow2 = drawingContext.createRadialGradient(width * 0.72, height * 0.68, 0, width * 0.72, height * 0.68, width * 0.5);
  glow2.addColorStop(0, 'rgba(180,246,228,0.16)');
  glow2.addColorStop(1, 'rgba(255,255,255,0)');
  drawingContext.fillStyle = glow2;
  drawingContext.fillRect(0, 0, width, height);
}

function drawFlowingLight() {
  push();
  noFill();
  blendMode(SCREEN);
  for (let i = 0; i < 14; i++) {
    const yBase = map(i, 0, 13, height * 0.08, height * 0.92);
    const amp1 = 10 + i * 1.6;
    const amp2 = 6 + i * 1.1;
    const weight = 3.0 - i * 0.12;

    if (i % 3 === 0) stroke(196, 244, 232, 66 - i * 2.5);
    else if (i % 3 === 1) stroke(176, 214, 255, 58 - i * 2.2);
    else stroke(255, 222, 190, 42 - i * 1.6);

    strokeWeight(max(0.8, weight));
    beginShape();
    for (let x = -50; x <= width + 50; x += 14) {
      const y = yBase
        + sin(frameCount * (0.01 + i * 0.0007) + x * 0.008 + i * 0.6) * amp1
        + cos(frameCount * (0.007 + i * 0.0005) + x * 0.0035 + i * 9) * amp2
        + sin(frameCount * 0.004 + x * 0.017 + i * 12) * 3;
      curveVertex(x, y);
    }
    endShape();
  }
  blendMode(BLEND);
  pop();
}

class ReliefRipple {
  constructor(index) {
    this.index = index;
    this.centerX = width * 0.5;
    this.centerY = height * 0.52;
    this.rings = [];
    this.cooldown = int(random(28, 64));
  }
  spawnRing() {
    this.rings.push({
      r: random(18, 34),
      alpha: random(70, 95),
      speed: random(1.2, 2.1),
      weight: random(1.6, 3.2),
      stretch: random(0.82, 1.06)
    });
  }
  update() {
    this.centerX = lerp(this.centerX, width * 0.5, 0.02);
    this.centerY = lerp(this.centerY, height * 0.52, 0.02);

    this.cooldown -= 1;
    if (this.cooldown <= 0) {
      this.spawnRing();
      this.cooldown = int(random(80, 200));
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.r += ring.speed;
      ring.alpha *= 0.982;
      ring.weight *= 0.996;
      if (ring.alpha < 2 || ring.r > max(width, height) * 1.8) {
        this.rings.splice(i, 1);
      }
    }
  }
  display() {
    push();
    noFill();
    blendMode(SCREEN);
    for (const ring of this.rings) {
      stroke(208, 246, 236, ring.alpha);
      strokeWeight(ring.weight);
      ellipse(this.centerX, this.centerY, ring.r * 2, ring.r * 2 * ring.stretch);

      stroke(188, 220, 255, ring.alpha * 0.45);
      strokeWeight(max(0.6, ring.weight * 0.55));
      ellipse(this.centerX, this.centerY, ring.r * 2 + 18, ring.r * 2 * ring.stretch + 10);
    }
    blendMode(BLEND);
    pop();
  }
}

class ReliefBlob {
  constructor(index) {
    this.index = index;
    this.baseX = map(index, 0, 7, width * 0.14, width * 0.86) + random(-80, 80);
    this.baseY = map(index % 4, 0, 3, height * 0.2, height * 0.8) + random(-60, 60);
    this.seed = random(1000);
    this.size = random(width * 0.1, width * 0.22);
    this.palette = [
      color(255, 210, 165, 96),
      color(166, 223, 255, 102),
      color(160, 255, 220, 96),
      color(220, 200, 255, 84)
    ][index % 4];
  }
  update() {
    this.t = frameCount * 0.01 + this.seed;
    this.x = this.baseX + sin(this.t * 0.7) * 45 + cos(this.t * 1.1) * 22;
    this.y = this.baseY + cos(this.t * 0.65) * 38 + sin(this.t * 0.9) * 18;
    this.breathe = map(sin(frameCount * 0.018 + this.seed), -1, 1, 0.9, 1.1);
    this.currentSize = this.size * this.breathe;
  }
  display() {
    const ctx = drawingContext;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const r = red(this.palette);
    const gCol = green(this.palette);
    const b = blue(this.palette);
    const a = alpha(this.palette) / 255;

    const grad = ctx.createRadialGradient(
      this.x - this.currentSize * 0.08,
      this.y - this.currentSize * 0.06,
      this.currentSize * 0.08,
      this.x,
      this.y,
      this.currentSize * 1.05
    );
    grad.addColorStop(0, `rgba(${r}, ${gCol}, ${b}, ${Math.min(1, a * 1.15)})`);
    grad.addColorStop(0.24, `rgba(${r}, ${gCol}, ${b}, ${a * 0.82})`);
    grad.addColorStop(0.55, `rgba(${r}, ${gCol}, ${b}, ${a * 0.34})`);
    grad.addColorStop(1, `rgba(${r}, ${gCol}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.currentSize * 1.25, this.currentSize * 0.82, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad2 = ctx.createRadialGradient(
      this.x + this.currentSize * 0.06,
      this.y + this.currentSize * 0.03,
      this.currentSize * 0.04,
      this.x + this.currentSize * 0.08,
      this.y + this.currentSize * 0.02,
      this.currentSize * 0.7
    );
    grad2.addColorStop(0, `rgba(255,255,255,${a * 0.24})`);
    grad2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.ellipse(this.x + this.currentSize * 0.08, this.y + this.currentSize * 0.02, this.currentSize * 0.9, this.currentSize * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class ReliefPetal {
  constructor(index) {
    this.index = index;
    this.buffer = createGraphics(windowWidth, windowHeight);
    this.buffer.pixelDensity(1);
    this.palette = [
      '#dceff1', '#c7ebe5', '#b7d8ff', '#5a8d96', '#fbe7d6', '#c7bddd', '#b7cfc8'
    ];
    this.backgroundColor = '#5a8d96';
    this.bs = min(width, height);
    this.reset(true);
  }

  reset(first = false) {
    this.buffer.clear();
    this.x = random(0.12, 0.88) * width;
    this.y = random(0.14, 0.86) * height;
    this.d = 0;
    this.dMax = random(this.bs * 0.2, this.bs * 0.35);
    this.col = random(this.palette.filter(c => c !== this.backgroundColor));
    this.fr = random(10284701987);
    this.t = first ? -int(this.index * random(20, 36)) : -int(random(20, 100));
    this.state = 'grow';
    this.holdFrames = 150;
    this.holdCounter = 0;
    this.opacity = 255;
  }

  showToBuffer() {
    this.buffer.noFill();
    let c = color(this.col);
    c.setAlpha(255);
    this.buffer.strokeWeight(this.bs * 0.00007);
    this.buffer.stroke(c);
    this.buffer.beginShape();
    for (let i = 0; i < 30; i++) {
      let a = map(i, 0, 30, 0, TAU);
      let xx = this.x + this.d * 0.5 * cos(a);
      let yy = this.y + this.d * 0.5 * sin(a);
      let nScl = 10 / this.bs;
      let theta = noise(xx * nScl, yy * nScl, this.fr) * TAU * 2;
      xx += cos(theta) * this.d * 0.0002 * this.bs;
      yy += sin(theta) * this.d * 0.0002 * this.bs;
      this.buffer.vertex(xx, yy);
    }
    this.buffer.endShape(CLOSE);
  }

  move() {
    this.d += noise(frameCount * 0.1 * this.bs, this.x, this.y) * this.bs * 0.00075;
  }

  update() {
    if (this.t < 0) {
      this.t++;
      return;
    }

    if (this.state === 'grow') {
      for (let i = 0; i < 6; i++) {
        if (this.d < this.dMax) {
          this.showToBuffer();
          this.move();
        }
      }
      if (this.d >= this.dMax) {
        this.state = 'hold';
      }
      return;
    }

    if (this.state === 'hold') {
      this.holdCounter++;
      if (this.holdCounter >= this.holdFrames) {
        this.state = 'fade';
      }
      return;
    }

    if (this.state === 'fade') {
      this.opacity -= 18;
      if (this.opacity <= 0) {
        this.reset(false);
      }
    }
  }

  display() {
    push();
    tint(255, this.opacity);
    image(this.buffer, 0, 0, width, height);
    noTint();
    pop();
  }
}

class ReliefWord {
  constructor() { this.reset(); }
  reset() {
    this.text = random(RELIEF_WORDS);
    this.x = random(width * 0.08, width * 0.92);
    this.y = random(height * 0.15, height * 0.88);
    this.size = random(16, 26);
    this.life = random(2.6, 5.6);
    this.ttl = this.life;
    this.vx = random(-8, 8);
    this.vy = random(-6, -1);
  }
  update() {
    this.life -= deltaTime / 1000;
    this.x += this.vx * deltaTime / 1000;
    this.y += this.vy * deltaTime / 1000;
    if (this.life <= 0) this.reset();
  }
  display() {
    const aIn = constrain((this.ttl - this.life) / (this.ttl * 0.3), 0, 1);
    const aOut = constrain(this.life / (this.ttl * 0.3), 0, 1);
    const a = min(aIn, aOut);
    push();
    textAlign(CENTER, CENTER);
    textSize(this.size);
    fill(214, 236, 240, 26 * a);
    text(this.text, this.x + 4, this.y + 4);
    fill(220, 242, 246, 82 * a);
    text(this.text, this.x, this.y);
    pop();
  }
}

class ReliefMote {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.s = random(1, 4);
    this.seed = random(1000);
  }
  update() {
    this.x += map(noise(this.seed, frameCount * 0.003), 0, 1, -0.35, 0.35);
    this.y += map(noise(this.seed + 100, frameCount * 0.003), 0, 1, -0.28, 0.28) - 0.02;
    if (this.x < -10) this.x = width + 10;
    if (this.x > width + 10) this.x = -10;
    if (this.y < -10) this.y = height + 10;
    if (this.y > height + 10) this.y = -10;
  }
  display() {
    noStroke();
    fill(220, 242, 246, 28);
    circle(this.x, this.y, this.s);
  }
}

function drawTransitionVeil() {
  push();
  noStroke();
  for (let i = 0; i < 60; i++) {
    fill(255, 7);
    rect(random(width), random(height), random(1, 2), random(1, 2));
  }
  pop();
}

function setPhase(nextPhase) {
  phase = nextPhase;
  if (phase === 2) initRelief();
  showUI();
}

function keyPressed() {
  if (key === ' ') {
    setPhase((phase + 1) % 3);
  } else if (key === '1') {
    setPhase(0);
  } else if (key === '2') {
    setPhase(1);
  } else if (key === '3') {
    setPhase(2);
  } else if (key === 'r' || key === 'R') {
    initScene(); showUI();
  } else if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
    showUI();
  } else if (key === 'h' || key === 'H') {
    uiEl.classList.toggle('hidden');
  }
}

function mousePressed() {
  setPhase((phase + 1) % 3);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initScene();
}