let phase = 0;              // 0 = anxiety_1, 1 = anxiety_2, 2 = relief
let phaseBlend = 0;         // 0~1 for smooth change
let targetBlend = 0;

let chaosLines = [];
let panicDigits = [];

// 3 themes of words
const PLATFORM_WORDS = [
  'seen',
  'delivered',
  'typing...',
  '2 views',
  '3 online',
  'last seen',
  '0 new replies',
  'sent',
  'read',
  'active now',
  'viewed',
  'processing',
  'loading',
  'refreshing',
  'syncing'
];

const JUDGEMENT_WORDS = [
  'too much',
  'embarrassing',
  'why post this',
  'cringe',
  'again?',
  'desperate',
  'annoying',
  'try hard',
  'not interesting',
  'stop',
  'who cares',
  'awkward',
  'weird'
];

const SELF_WORDS = [
  'is this about me',
  'they saw it',
  'why no reply',
  'did I say too much',
  'everyone noticed',
  'they mean me',
  "I shouldn't post",
  'I knew it',
  'they are ignoring me',
  'I messed up',
  'why did I say that'
];
let panicFlares = [];
let driftingBlobs = [];
let dustParticles = [];


function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont('monospace');
  rectMode(CENTER);
  noCursor();
  initScene();
}

function initScene() {
  chaosLines = [];
  panicDigits = [];
  panicFlares = [];
  driftingBlobs = [];
  dustParticles = [];

  const lineCount = floor(map(width * height, 300000, 3000000, 90, 220, true));
  const digitCount = floor(map(width * height, 300000, 3000000, 90, 180, true));
  const flareCount = 12;
  const blobCount = 7;
  const dustCount = 180;

  for (let i = 0; i < lineCount; i++) chaosLines.push(new ChaosLine());
  for (let i = 0; i < digitCount; i++) panicDigits.push(new PanicDigit());
  for (let i = 0; i < flareCount; i++) panicFlares.push(new PanicFlare());
  for (let i = 0; i < blobCount; i++) driftingBlobs.push(new ReliefBlob(i));
  for (let i = 0; i < dustCount; i++) dustParticles.push(new DustParticle());
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
  targetBlend = phase === 2 ? 1 : 0;
  phaseBlend = lerp(phaseBlend, targetBlend, 0.035);

  drawBaseBackground();
  drawAnxietyPhase(1 - phaseBlend);
  drawReliefPhase(phaseBlend);
  drawTransitionVeil();
}

function drawBaseBackground() {
  let c1 = color(7, 4, 10);
  let c2 = color(2, 3, 5);
  if (phaseBlend > 0.1) {
    c1 = lerpColor(color(7, 4, 10), color(10, 18, 26), phaseBlend);
    c2 = lerpColor(color(2, 3, 5), color(2, 10, 16), phaseBlend);
  }

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

  // slight flicker, creating a sense of instability
  let flicker = random() < 0.08 ? random(8, 20) : 0;
  noStroke();
  fill(255, 20 * alphaFactor + flicker);
  rect(width / 2, height / 2, width, height);

  // oppressive dark red halo in the center
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

  blendMode(ADD);
  for (const flare of panicFlares) {
    flare.update(alphaFactor);
    flare.display(alphaFactor);
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

function drawReliefPhase(alphaFactor) {
  if (alphaFactor < 0.01) return;

  push();

  // soft mist
  noStroke();
  for (let i = 0; i < 7; i++) {
    fill(220, 245, 255, 5 * alphaFactor);
    ellipse(width * random(), height * random(), width * 0.25, width * 0.12);
  }

  // floating particles
  for (const d of dustParticles) {
    d.update(alphaFactor);
    d.display(alphaFactor);
  }

  // large colourful glow
  blendMode(SCREEN);
  for (const b of driftingBlobs) {
    b.update(alphaFactor);
    b.display(alphaFactor);
  }
  blendMode(BLEND);

  // soft breathing light
  let breathe = map(sin(frameCount * 0.035), -1, 1, 0.92, 1.08);
  noFill();
  stroke(220, 240, 255, 18 * alphaFactor);
  strokeWeight(22);
  ellipse(width * 0.5, height * 0.55, width * 0.36 * breathe, width * 0.22 * breathe);

  pop();
}

function drawTransitionVeil() {
  // slight particles and gradually darkened edges, make the picture more like a projection layer
  push();
  noStroke();

  for (let i = 0; i < 60; i++) {
    fill(255, 7);
    rect(random(width), random(height), random(1, 2), random(1, 2));
  }

  let margin = min(width, height) * 0.16;
  for (let i = 0; i < 16; i++) {
    let a = map(i, 0, 15, 0, 18);
    fill(0, a);
    rect(width / 2, -margin / 2 + i * 8, width, margin);
    rect(width / 2, height + margin / 2 - i * 8, width, margin);
    rect(-margin / 2 + i * 8, height / 2, margin, height);
    rect(width + margin / 2 - i * 8, height / 2, margin, height);
  }
  pop();
}

function drawScanningBars(alphaFactor) {
  push();
  let speed1 = frameCount * 0.024;
  let speed2 = frameCount * 0.045;

  noStroke();
  fill(255, 24 * alphaFactor);
  rect((noise(speed1) * width), height * 0.3, random(width * 0.18, width * 0.28), random(1, 3));

  fill(255, 10 * alphaFactor);
  rect((noise(100 + speed2) * width), height * 0.72, random(width * 0.24, width * 0.42), random(2, 5));

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
  constructor() {
    this.reset(true);
  }

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

    if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
      this.reset();
    }
  }

  display(alphaFactor) {
    let n = noise(this.wobble * 3.0);
    let pulse = random() < 0.03 ? random(80, 150) : 0;

    strokeWeight(this.weight + n * 1.1);
    stroke(180 + pulse, 22 + n * 40, 38 + n * 90, (this.alpha + pulse * 0.25) * alphaFactor);

    let x2 = this.x + cos(this.ang) * this.len;
    let y2 = this.y + sin(this.ang) * this.len;
    line(this.x, this.y, x2, y2);

    // occasional "guiding line" refers to the uploaded mouse convergence logic
    if (random() < 0.05) {
      stroke(255, 255 * alphaFactor * 0.12);
      line(this.x, this.y, mouseX, mouseY);
    }
  }
}

class PanicDigit {
  constructor() {
    this.reset();
  }

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
      let centerPull = 0.008;
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
    if (phase === 1) {
      fill(255, 90 + glow, 120 + glow * 0.2, this.alpha * alphaFactor);
    } else {
      fill(255, 70 + glow, 90 + glow * 0.2, this.alpha * alphaFactor);
    }
    text(this.char, this.x, this.y);

    if (random() < 0.1) {
      fill(255, 255, 255, 26 * alphaFactor);
      text(this.char, this.x + random(-4, 4), this.y + random(-4, 4));
    }
    pop();
  }
}

class PanicFlare {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = random(width);
    this.y = random(height);
    this.len = random(width * 0.18, width * 0.52);
    this.angle = random(TWO_PI);
    this.life = random(30, 120);
    this.maxLife = this.life;
    this.thickness = random(20, 90);
  }

  update() {
    this.life -= 1;
    if (this.life <= 0) this.reset();
  }

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

class ReliefBlob {
  constructor(index) {
    this.index = index;
    this.baseX = map(index, 0, 6, width * 0.18, width * 0.82) + random(-80, 80);
    this.baseY = map(index % 4, 0, 3, height * 0.28, height * 0.76) + random(-80, 80);
    this.seed = random(1000);
    this.size = random(width * 0.16, width * 0.28);
    this.hueType = index % 5;
  }

  update(alphaFactor) {
    this.t = frameCount * 0.01 + this.seed;
    this.x = this.baseX + sin(this.t * 0.7) * 45 + cos(this.t * 1.1) * 22;
    this.y = this.baseY + cos(this.t * 0.65) * 38 + sin(this.t * 0.9) * 18;
    this.breathe = map(sin(frameCount * 0.03 + this.seed), -1, 1, 0.86, 1.12);
    this.currentSize = this.size * this.breathe * (0.8 + alphaFactor * 0.2);
  }

  getPalette() {
    const palettes = [
      [color(165, 230, 255, 36), color(210, 245, 255, 12)],
      [color(165, 255, 220, 34), color(220, 255, 240, 12)],
      [color(214, 205, 255, 32), color(235, 228, 255, 12)],
      [color(255, 206, 224, 28), color(255, 236, 242, 10)],
      [color(255, 246, 220, 24), color(255, 250, 238, 8)]
    ];
    return palettes[this.hueType];
  }

  display(alphaFactor) {
    let [innerC, outerC] = this.getPalette();
    innerC.setAlpha(alpha(innerC) * alphaFactor);
    outerC.setAlpha(alpha(outerC) * alphaFactor);

    noStroke();
    for (let i = 9; i >= 0; i--) {
      let inter = i / 9;
      let c = lerpColor(innerC, outerC, inter);
      fill(c);
      ellipse(this.x, this.y,
        this.currentSize * (1.2 + inter * 1.5),
        this.currentSize * (0.78 + inter * 1.12));
    }
  }
}

class DustParticle {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.s = random(1, 4);
    this.seed = random(1000);
  }

  update() {
    this.x += map(noise(this.seed, frameCount * 0.003), 0, 1, -0.45, 0.45);
    this.y += map(noise(this.seed + 100, frameCount * 0.003), 0, 1, -0.35, 0.35) - 0.03;
    if (this.x < -10) this.x = width + 10;
    if (this.x > width + 10) this.x = -10;
    if (this.y < -10) this.y = height + 10;
    if (this.y > height + 10) this.y = -10;
  }

  display(alphaFactor) {
    noStroke();
    fill(230, 245, 255, 16 * alphaFactor);
    circle(this.x, this.y, this.s);
  }
}

function keyPressed() {
  if (key === ' ') {
    phase = (phase + 1) % 3;
  } else if (key === '1') {
    phase = 0;
  } else if (key === '2') {
    phase = 1;
  } else if (key === '3') {
    phase = 2;
  } else if (key === 'r' || key === 'R') {
    initScene();
  } else if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
  }
}

function mousePressed() {
  phase = (phase + 1) % 3;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initScene();
}