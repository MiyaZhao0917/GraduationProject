let phase = 0; // 0 = anxiety_1, 1 = anxiety_2, 2 = relief

let uiEl;
let uiHideTimer = 7;

// anxiety 1
let stage1Elements = [];
let stage1SpawnTimer = 0;
let stage1GhostOffset = 0;
let stage1Tides = [];
let stage1TideSeed = 0;

const FEED_BADGES = [
  '9 new posts', '2 unread', 'new replies', 'viewed by 23', 'posted just now',
  'suggested for you', 'active now', 'seen', 'delivered', 'because you watched',
  '3 mutuals', '@mentions', '5 stories', '1 new message', 'updated now'
];

const FEED_METRICS = ['likes', 'views', 'shares', 'saved', 'replies'];
const FEED_ACTIONS = ['typing...', 'seen', 'delivered', 'active now', 'new post'];
const FEED_ICON_TYPES = ['heart', 'eye'];

// anxiety 2
let phase2Cards = [];
let phase2Words = [];
let phase2GazeMarks = [];
let phase2FlowDust = [];
let phase2Eye;
let phase2SpawnTimer = 0;
let phase2Age = 0;

const PLATFORM_WORDS = [
  'left on seen', 'seen / no reply', 'typing stopped', 'looked and left',
  'paused there', 'went quiet', 'no reply yet', 'saw enough',
  'still online', 'read at 02:13', 'delivered', 'not opened'
];

const JUDGEMENT_WORDS = [
  'too much', 'embarrassing', 'why post this', 'cringe', 'again?', 'desperate',
  'attention seeking', 'nobody asked', 'pathetic', 'delete this', 'so embarrassing',
  'what is this', 'who even cares', 'try harder', 'not this again', 'hard to watch',
  'stop posting', 'they are laughing', 'so obvious', 'everyone can see it'
];

const SELF_WORDS = [
  'is this about me', 'they saw it', 'why no reply', 'did I say too much',
  'everyone noticed', 'they mean me', "I shouldn't post", 'I knew it',
  'they are ignoring me on purpose', 'I messed up', 'why did I say that',
  'I should delete it', 'they are talking about me', 'I made it worse',
  'they all noticed', 'I should not have posted that', 'they think it is me'
];

const PHASE2_CHIPS = ['again?', 'too much', 'delete', 'seriously?', 'noticed', 'why?', 'obvious', 'enough'];
const PHASE2_NOISE_WORDS = ['seen', 'typing', '@', '...', 'left', 'read', 'watching', 'online', 'pause', 'me?', 'why'];

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
  stage1GhostOffset = random(1000);
  stage1TideSeed = random(1000);

  // refresh tide background system
  // each tide is a moving distorted band. when it touches front-layer signals, the signal flashes as if it has been refreshed away
  stage1Tides = [];
  const tideCount = 4;
  for (let i = 0; i < tideCount; i++) {
    stage1Tides.push({
      y: map(i, 0, tideCount - 1, -height * 0.35, height * 1.05) + random(-120, 120),
      speed: random(74, 138),
      band: random(52, 96),
      waveAmp: random(18, 42),
      waveFreq: random(0.0045, 0.0085),
      phase: random(TAU),
      strength: random(0.72, 1.18),
      resetDelay: random(0, 1.2)
    });
  }
}

function initStage2() {
  phase2Cards = [];
  phase2Words = [];
  phase2GazeMarks = [];
  phase2FlowDust = [];
  phase2SpawnTimer = 0;
  phase2Age = 0;

  const laneCount = max(3, min(5, floor(width / 320)));
  const cardsPerLane = 6;

  for (let lane = 0; lane < laneCount; lane++) {
    for (let i = 0; i < cardsPerLane; i++) {
      phase2Cards.push(new Phase2Card(lane, i, laneCount));
    }
  }

  const gazeCount = floor(map(width * height, 300000, 3000000, 7, 13, true));
  const dustCount = floor(map(width * height, 300000, 3000000, 120, 240, true));
  for (let i = 0; i < gazeCount; i++) phase2GazeMarks.push(new Phase2GazeMark());
  for (let i = 0; i < dustCount; i++) phase2FlowDust.push(new Phase2Dust());
  phase2Eye = new Phase2FloatingEye();
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

function draw() {
  uiHideTimer -= deltaTime / 1000;
  if (uiHideTimer <= 0) uiEl.classList.add('hidden');

  if (phase === 0) {
    drawStage1();
  } else if (phase === 1) {
    drawStage2();
    drawTransitionVeil();
  } else {
    drawReliefStage();
    drawTransitionVeil();
  }
}


// anixety 1
function drawStage1() {
  updateStage1Tides();
  drawStage1Background();
  drawStage1RefreshTideBack();
  drawStage1SignalMist();
  updateStage1Elements();
  drawStage1BaitLinks();
  drawStage1Elements();
  drawStage1RefreshTideFront();
  drawStage1Vignette();
  drawTransitionVeil();
}

function updateStage1Tides() {
  const dt = deltaTime / 1000;
  for (const tide of stage1Tides) {
    tide.y += tide.speed * dt;
    tide.phase += dt * 0.18;
    if (tide.y > height + tide.band * 3) {
      tide.y = random(-height * 0.55, -tide.band * 2);
      tide.speed = random(74, 142);
      tide.band = random(52, 96);
      tide.waveAmp = random(18, 42);
      tide.waveFreq = random(0.0045, 0.0085);
      tide.phase = random(TAU);
      tide.strength = random(0.72, 1.18);
    }
  }
}

function drawStage1Background() {
  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#070209');
  g.addColorStop(0.32, '#11040d');
  g.addColorStop(0.62, '#08050b');
  g.addColorStop(1, '#020203');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);

  const t = frameCount * 0.01;
  const glowA = drawingContext.createRadialGradient(
    width * (0.16 + sin(t * 0.7) * 0.03),
    height * (0.22 + cos(t * 0.9) * 0.03),
    0,
    width * 0.18,
    height * 0.22,
    max(width, height) * 0.68
  );
  glowA.addColorStop(0, 'rgba(255,28,45,0.12)');
  glowA.addColorStop(0.33, 'rgba(150,0,85,0.06)');
  glowA.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = glowA;
  drawingContext.fillRect(0, 0, width, height);

  const glowB = drawingContext.createRadialGradient(
    width * 0.82,
    height * (0.74 + sin(t * 0.8) * 0.03),
    0,
    width * 0.82,
    height * 0.74,
    max(width, height) * 0.5
  );
  glowB.addColorStop(0, 'rgba(255,94,20,0.075)');
  glowB.addColorStop(0.42, 'rgba(82,0,120,0.05)');
  glowB.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = glowB;
  drawingContext.fillRect(0, 0, width, height);

  // subtle stretched substrate: background lines bend near the refresh tides
  push();
  blendMode(SCREEN);
  strokeWeight(1);
  for (let y = -20; y < height + 20; y += 32) {
    beginShape();
    noFill();
    let maxInf = 0;
    for (let x = -40; x <= width + 40; x += 32) {
      const info = getStage1RefreshInfo(x, y);
      maxInf = max(maxInf, info.flash);
      const yy = y + info.displacement * 0.36 + sin(x * 0.011 + frameCount * 0.011) * 1.8;
      vertex(x, yy);
    }
    stroke(255, 38, 54, 4 + maxInf * 20);
    endShape();
  }

  for (let x = 0; x <= width; x += 46) {
    beginShape();
    noFill();
    let maxInf = 0;
    for (let y = -30; y <= height + 30; y += 22) {
      const info = getStage1RefreshInfo(x, y);
      maxInf = max(maxInf, info.flash);
      const xx = x + sin(y * 0.012 + frameCount * 0.009) * 2 + info.sideShift;
      const yy = y + info.displacement * 0.22;
      vertex(xx, yy);
    }
    stroke(190, 18, 80, 2 + maxInf * 14);
    endShape();
  }
  pop();
}

function tideLineY(tide, x) {
  const wave = sin(x * tide.waveFreq + tide.phase + frameCount * 0.017) * tide.waveAmp;
  const n = (noise(x * 0.004, tide.phase * 0.37, frameCount * 0.006) - 0.5) * tide.waveAmp * 0.75;
  return tide.y + wave + n;
}

function getStage1RefreshInfo(x, y) {
  let flash = 0;
  let displacement = 0;
  let sideShift = 0;
  let nearest = 99999;

  for (const tide of stage1Tides) {
    const lineY = tideLineY(tide, x);
    const d = y - lineY;
    const ad = abs(d);
    nearest = min(nearest, ad);

    const reach = tide.band * 1.7;
    let inf = constrain(1 - ad / reach, 0, 1);
    inf = pow(inf, 2.05) * tide.strength;

    // stretch: pixels/elements are pulled away from the refresh seam, while slightly drifting with the direction of the passing tide
    const away = d < 0 ? -1 : 1;
    displacement += away * inf * (22 + tide.band * 0.34) + inf * 10;
    sideShift += sin(x * 0.018 + tide.phase) * inf * 14;
    flash = max(flash, inf);
  }

  return { flash: constrain(flash, 0, 1), displacement, sideShift, nearest };
}

function drawStage1RefreshTideBack() {
  push();
  blendMode(SCREEN);

  // soft tide bodies behind the bait signals
  for (const tide of stage1Tides) {
    drawRefreshTideBody(tide, false);
  }

  // falling digital residue: makes the refresh action feel like a pull/reload
  noStroke();
  for (let i = 0; i < 78; i++) {
    const n = noise(i * 17.2, frameCount * 0.009);
    const x = (i / 77) * width + sin(frameCount * 0.01 + i) * 18;
    const y = (frameCount * (0.8 + n * 1.4) + i * 67) % (height + 140) - 70;
    const info = getStage1RefreshInfo(x, y);
    const h = 18 + n * 76 + info.flash * 90;
    fill(255, 42, 56, 4 + n * 10 + info.flash * 28);
    rect(x + info.sideShift * 0.35, y + info.displacement * 0.45, 1.2 + n * 2.2, h, 3);
  }

  pop();
}

function drawStage1RefreshTideFront() {
  push();
  blendMode(SCREEN);

  // bright seam in front: this is the visible refresh edge that removes signals
  for (const tide of stage1Tides) {
    drawRefreshTideSeam(tide);
  }

  pop();
}

function drawRefreshTideBody(tide, front = false) {
  const top = -tide.band * 0.72;
  const bottom = tide.band * 0.95;

  noStroke();
  fill(255, 34, 58, front ? 10 * tide.strength : 15 * tide.strength);
  beginShape();
  for (let x = -60; x <= width + 60; x += 26) {
    const y = tideLineY(tide, x);
    vertex(x, y + top + sin(frameCount * 0.01 + x * 0.01) * 8);
  }
  for (let x = width + 60; x >= -60; x -= 26) {
    const y = tideLineY(tide, x);
    vertex(x, y + bottom + sin(frameCount * 0.012 + x * 0.013) * 13);
  }
  endShape(CLOSE);

  // multiple compressed echoes around the seam
  noFill();
  for (let k = -5; k <= 5; k++) {
    const off = k * 9;
    const a = map(abs(k), 0, 5, 42, 4) * tide.strength;
    stroke(255, k === 0 ? 210 : 75, k === 0 ? 170 : 82, front ? a * 0.65 : a * 0.35);
    strokeWeight(k === 0 ? 1.4 : 0.7);
    beginShape();
    for (let x = -60; x <= width + 60; x += 22) {
      const lineY = tideLineY(tide, x);
      const stretch = off + sin(x * 0.012 + frameCount * 0.02 + k) * (4 + abs(k));
      vertex(x, lineY + stretch);
    }
    endShape();
  }

  // local vertical deformation curtains around the seam
  strokeWeight(1);
  for (let x = -30; x <= width + 30; x += 34) {
    const centerY = tideLineY(tide, x);
    const n = noise(x * 0.01, tide.phase);
    const a = (6 + n * 20) * tide.strength;
    stroke(255, 48, 70, a);
    beginShape();
    for (let yy = centerY - tide.band * 1.9; yy <= centerY + tide.band * 1.9; yy += 12) {
      const d = yy - centerY;
      const inf = pow(constrain(1 - abs(d) / (tide.band * 2), 0, 1), 1.5);
      const bend = sin(frameCount * 0.014 + yy * 0.025 + x * 0.008) * inf * 18;
      const pull = (d < 0 ? -1 : 1) * inf * 14;
      vertex(x + bend, yy + pull);
    }
    endShape();
  }
}

function drawRefreshTideSeam(tide) {
  noFill();
  strokeWeight(1.3);
  stroke(255, 212, 176, 54 * tide.strength);
  beginShape();
  for (let x = -60; x <= width + 60; x += 18) {
    vertex(x, tideLineY(tide, x));
  }
  endShape();

  strokeWeight(5);
  stroke(255, 35, 56, 15 * tide.strength);
  beginShape();
  for (let x = -60; x <= width + 60; x += 22) {
    vertex(x, tideLineY(tide, x) + sin(x * 0.014 + frameCount * 0.02) * 3);
  }
  endShape();

  // small hot fragments attached to the seam
  noStroke();
  for (let i = 0; i < 12; i++) {
    const x = (i / 11) * width + sin(frameCount * 0.02 + i * 2.1 + tide.phase) * 40;
    const y = tideLineY(tide, x) + random(-2, 2);
    const a = 24 + noise(i, frameCount * 0.05) * 50;
    fill(255, 188, 126, a * tide.strength);
    rect(x, y, random(12, 42), random(1, 3), 2);
  }
}

function drawStage1SignalMist() {
  push();
  blendMode(SCREEN);
  noStroke();
  for (let i = 0; i < 128; i++) {
    const x = noise(i * 13.1, stage1GhostOffset) * width;
    const y0 = (noise(i * 8.9, stage1GhostOffset + 40) * height + frameCount * (0.05 + noise(i) * 0.1)) % height;
    const info = getStage1RefreshInfo(x, y0);
    const flicker = noise(i * 3.7, frameCount * 0.035);
    fill(255, 28 + info.flash * 170, 44 + info.flash * 120, 5 + flicker * 14 + info.flash * 28);
    circle(x + info.sideShift * 0.25, y0 + info.displacement * 0.55, 1.2 + flicker * 3.6 + info.flash * 4);
  }
  pop();
}

function updateStage1Elements() {
  stage1SpawnTimer -= deltaTime / 1000;
  if (stage1SpawnTimer <= 0) {
    spawnStage1Burst();
    stage1SpawnTimer = random(0.04, 0.095);
  }

  for (let i = stage1Elements.length - 1; i >= 0; i--) {
    const e = stage1Elements[i];
    const dt = deltaTime / 1000;
    const info = getStage1RefreshInfo(e.x, e.y);

    e.life -= dt;
    e.age += dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.refreshGlow = max((e.refreshGlow || 0) * 0.86, info.flash);
    e.refreshDisplace = info.displacement;
    e.refreshShift = info.sideShift;

    // core refresh tide behaviour: when the seam reaches a signal, it flashes for a very short moment and is wiped from the feed
    if (info.flash > 0.66 && !e.refreshed) {
      e.refreshed = true;
      e.refreshGlow = 1;
      e.life = min(e.life, random(0.12, 0.26));
      e.vy += random(-10, 20);
      e.vx += random(-16, 16);
    }

    if (e.type === 'baitDot' || e.type === 'baitOrb') {
      e.pulse += dt * e.pulseSpeed;
      e.y += sin(frameCount * 0.015 + e.seed) * 0.08;
    }

    if (e.type === 'baitGlyph') {
      e.x += sin(frameCount * 0.02 + e.seed) * 0.12;
    }

    if (e.x < -150 || e.x > width + 150 || e.y < -150 || e.y > height + 150 || e.life <= 0) {
      stage1Elements.splice(i, 1);
    }
  }
}

function spawnStage1Burst() {
  const maxCount = floor(map(width * height, 300000, 3000000, 70, 132, true));
  if (stage1Elements.length > maxCount) return;

  const clusterX = random(width * 0.08, width * 0.92);
  const clusterY = random(height * 0.1, height * 0.9);
  const burst = random() < 0.72;
  const dotNum = burst ? floor(random(2, 6)) : 1;

  for (let i = 0; i < dotNum; i++) {
    spawnBaitDot(clusterX + random(-58, 58), clusterY + random(-46, 46), random() < 0.13);
  }

  const r = random();
  if (r < 0.42) spawnBaitGlyph(clusterX + random(-42, 42), clusterY + random(-32, 32));
  else if (r < 0.64) spawnBaitOrb(clusterX, clusterY);
}

function spawnBaitDot(x, y, symbol = false) {
  const ttl = random(0.75, 1.9);
  stage1Elements.push({
    type: 'baitDot',
    x, y,
    ttl, life: ttl,
    age: 0,
    r: random(2.5, 8.5),
    vx: random(-9, 9),
    vy: random(-22, -4),
    pulse: random(TAU),
    pulseSpeed: random(4.5, 9.5),
    seed: random(9999),
    symbol,
    symbolType: random(['heart', 'eye', '@', '?', '+']),
    refreshed: false,
    refreshGlow: 0,
    refreshDisplace: 0,
    refreshShift: 0
  });
}

function spawnBaitOrb(x, y) {
  const ttl = random(0.9, 1.45);
  stage1Elements.push({
    type: 'baitOrb',
    x, y,
    ttl, life: ttl,
    age: 0,
    r: random(18, 36),
    vx: random(-5, 5),
    vy: random(-14, -4),
    pulse: random(TAU),
    pulseSpeed: random(3.2, 5.8),
    seed: random(9999),
    mode: random(['ring', 'target']),
    refreshed: false,
    refreshGlow: 0,
    refreshDisplace: 0,
    refreshShift: 0
  });
}

function spawnBaitGlyph(x, y) {
  const ttl = random(0.48, 1.12);
  const fragments = ['@', 'seen', '...', '+23', '0.7', 'now', 'tap', 'new', 'ping', 'live', 'view?', 'again', 'wait', 'pull', 'reload', 'more'];
  stage1Elements.push({
    type: 'baitGlyph',
    x, y,
    ttl, life: ttl,
    age: 0,
    text: random(fragments),
    size: random(10, 19),
    vx: random(-14, 14),
    vy: random(-24, -6),
    seed: random(9999),
    hot: random() < 0.36,
    refreshed: false,
    refreshGlow: 0,
    refreshDisplace: 0,
    refreshShift: 0
  });
}

function fadeElement(life, ttl) {
  const fadeIn = constrain((ttl - life) / (ttl * 0.18), 0, 1);
  const fadeOut = constrain(life / (ttl * 0.32), 0, 1);
  return min(fadeIn, fadeOut);
}

function stage1DisplayPos(e) {
  const info = getStage1RefreshInfo(e.x, e.y);
  const glow = max(e.refreshGlow || 0, info.flash);
  return {
    x: e.x + (e.refreshShift || 0) * 0.55 + info.sideShift * 0.35,
    y: e.y + (e.refreshDisplace || 0) * 0.6 + info.displacement * 0.28,
    glow,
    displacement: info.displacement
  };
}

function drawStage1BaitLinks() {
  const nodes = stage1Elements.filter(e => e.type === 'baitDot' || e.type === 'baitOrb');
  const maxLinks = 30;
  let linkCount = 0;

  push();
  blendMode(SCREEN);
  strokeWeight(1);
  for (let i = 0; i < nodes.length && linkCount < maxLinks; i++) {
    for (let j = i + 1; j < nodes.length && linkCount < maxLinks; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const pa = stage1DisplayPos(a);
      const pb = stage1DisplayPos(b);
      const d = dist(pa.x, pa.y, pb.x, pb.y);
      if (d < 138 && random() < 0.48) {
        const fa = fadeElement(a.life, a.ttl);
        const fb = fadeElement(b.life, b.ttl);
        const glow = max(pa.glow, pb.glow);
        const alpha = map(d, 0, 138, 48, 0) * min(fa, fb) + glow * 42;
        stroke(255, 45 + glow * 150, 52 + glow * 110, alpha);
        line(pa.x, pa.y, pb.x, pb.y);
        linkCount++;
      }
    }
  }
  pop();
}

function drawStage1Elements() {
  for (const e of stage1Elements) {
    const a = fadeElement(e.life, e.ttl);
    const p = stage1DisplayPos(e);

    // brief ghost smear caused by the refresh tide pulling the element before removal
    if (p.glow > 0.12) {
      push();
      blendMode(SCREEN);
      stroke(255, 198, 150, 50 * p.glow * a);
      strokeWeight(1);
      const smearY = p.y - p.displacement * 0.72;
      line(p.x, smearY, p.x + random(-4, 4), p.y + p.displacement * 0.42);
      pop();
    }

    if (e.type === 'baitDot') drawBaitDot(e, a, p);
    else if (e.type === 'baitOrb') drawBaitOrb(e, a, p);
    else if (e.type === 'baitGlyph') drawBaitGlyph(e, a, p);
  }
}

function drawBaitDot(e, a, p) {
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  noStroke();

  const flash = p.glow;
  const pulse = map(sin(e.pulse), -1, 1, 0.55, 1.3);
  const hot = noise(e.seed, frameCount * 0.04) > 0.76 || flash > 0.45;
  const outer = e.r * (3.2 + pulse * 2.2 + flash * 4.5);

  const grad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, outer);
  grad.addColorStop(0, `rgba(255,235,200,${(0.42 + flash * 0.28) * a})`);
  grad.addColorStop(0.18, `rgba(255,42,48,${(0.55 + flash * 0.2) * a})`);
  grad.addColorStop(0.52, `rgba(255,0,96,${(0.18 + flash * 0.18) * a})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = grad;
  ellipse(0, 0, outer * 2, outer * 2);

  fill(hot ? color(255, 196, 88, 245 * a) : color(255, 35, 47, 230 * a));
  circle(0, 0, e.r * pulse * (1 + flash * 0.55));

  stroke(255, 92 + flash * 120, 78 + flash * 120, (82 + flash * 145) * a);
  strokeWeight(1);
  noFill();
  circle(0, 0, e.r * (2.2 + pulse * 2.4 + flash * 2.4));

  if (e.symbol) drawTinySignalSymbol(e.symbolType, a * (1 + flash * 0.35));
  pop();
}

function drawBaitOrb(e, a, p) {
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  noStroke();
  const flash = p.glow;
  const pulse = map(sin(e.pulse), -1, 1, 0.75, 1.22);

  const grad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, e.r * (3.6 + flash * 2.2));
  grad.addColorStop(0, `rgba(255,194,114,${(0.18 + flash * 0.26) * a})`);
  grad.addColorStop(0.28, `rgba(255,20,48,${(0.24 + flash * 0.24) * a})`);
  grad.addColorStop(0.68, `rgba(136,0,80,${(0.14 + flash * 0.16) * a})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = grad;
  ellipse(0, 0, e.r * (7.2 + flash * 3.2), e.r * (7.2 + flash * 3.2));

  stroke(255, 55 + flash * 155, 58 + flash * 120, (120 + flash * 120) * a);
  noFill();
  strokeWeight(1.1);
  for (let i = 0; i < 3; i++) circle(0, 0, e.r * (1.1 + i * 0.7 + flash * 0.42) * pulse);
  noStroke();
  fill(255, 35 + flash * 160, 45 + flash * 90, 190 * a);
  circle(0, 0, e.r * 0.38 * pulse * (1 + flash * 0.55));
  pop();
}

function drawBaitGlyph(e, a, p) {
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  textAlign(CENTER, CENTER);
  textSize(e.size + p.glow * 4);
  textStyle(e.hot || p.glow > 0.45 ? BOLD : NORMAL);
  noStroke();
  fill(e.hot || p.glow > 0.4 ? color(255, 190, 86, 230 * a) : color(255, 64, 64, 185 * a));
  text(e.text, 0, 0);
  fill(255, 238, 224, (60 + p.glow * 160) * a);
  text(e.text, random(-1.5, 1.5) + p.glow * random(-4, 4), random(-1.5, 1.5));
  pop();
}

function drawTinySignalSymbol(type, a) {
  push();
  translate(0, -13);
  if (type === 'heart') {
    noStroke();
    fill(255, 210, 198, 190 * a);
    beginShape();
    vertex(0, 5);
    bezierVertex(-8, -2, -7, -10, 0, -5);
    bezierVertex(7, -10, 8, -2, 0, 5);
    endShape(CLOSE);
  } else if (type === 'eye') {
    stroke(255, 220, 200, 165 * a);
    strokeWeight(1.2);
    noFill();
    ellipse(0, 0, 17, 8);
    noStroke();
    fill(255, 220, 200, 165 * a);
    circle(0, 0, 3.5);
  } else {
    noStroke();
    fill(255, 228, 215, 170 * a);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(type, 0, 0);
  }
  pop();
}

function drawStage1Vignette() {
  push();
  noStroke();
  const vignette = drawingContext.createRadialGradient(width * 0.5, height * 0.46, 0, width * 0.5, height * 0.46, max(width, height) * 0.76);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.58, 'rgba(0,0,0,0.13)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.74)');
  drawingContext.fillStyle = vignette;
  drawingContext.fillRect(0, 0, width, height);
  pop();
}


// anxiety 2
function drawStage2() {
  phase2Age += deltaTime / 1000;
  drawStage2Background();

  if (phase2Eye) {
    phase2Eye.update();
    phase2Eye.displayBack();
  }

  for (const dust of phase2FlowDust) {
    dust.update();
    dust.display();
  }

  for (const mark of phase2GazeMarks) {
    mark.update();
    mark.display();
  }

  phase2SpawnTimer -= deltaTime / 1000;
  if (phase2SpawnTimer <= 0) {
    spawnPhase2Word();
    phase2SpawnTimer = random(0.018, 0.04);
  }

  for (const card of phase2Cards) {
    card.update();
    card.display();
  }

  drawStage2TextRibbon();

  for (let i = phase2Words.length - 1; i >= 0; i--) {
    const w = phase2Words[i];
    w.update();
    w.display();
    if (w.dead) phase2Words.splice(i, 1);
  }

  if (phase2Eye) phase2Eye.displayFront();
  drawStage2ChromaticBurn();
  drawStage2FeedMask();
}

function drawStage2Background() {
  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#07020a');
  g.addColorStop(0.28, '#170316');
  g.addColorStop(0.58, '#240309');
  g.addColorStop(0.8, '#100209');
  g.addColorStop(1, '#020203');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);

  const cx = width * 0.5 + sin(frameCount * 0.009) * width * 0.025;
  const cy = height * 0.42 + cos(frameCount * 0.007) * height * 0.02;
  const pulse = map(sin(frameCount * 0.035), -1, 1, 0.11, 0.22);

  const redField = drawingContext.createRadialGradient(cx, cy, 0, cx, cy, max(width, height) * 0.72);
  redField.addColorStop(0, `rgba(255,34,54,${pulse})`);
  redField.addColorStop(0.28, `rgba(126,0,78,${pulse * 0.72})`);
  redField.addColorStop(0.64, `rgba(56,0,68,${pulse * 0.45})`);
  redField.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = redField;
  drawingContext.fillRect(0, 0, width, height);

  const warning = drawingContext.createRadialGradient(width * 0.72, height * 0.22, 0, width * 0.72, height * 0.22, width * 0.42);
  warning.addColorStop(0, 'rgba(255,92,12,0.075)');
  warning.addColorStop(0.5, 'rgba(255,0,130,0.035)');
  warning.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = warning;
  drawingContext.fillRect(0, 0, width, height);

  push();
  blendMode(SCREEN);
  strokeWeight(1);
  for (let y = 0; y < height; y += 18) {
    const flick = map(noise(y * 0.01, frameCount * 0.02), 0, 1, 0, 18);
    stroke(255, 40, 62, 4 + flick);
    line(0, y + sin(frameCount * 0.015 + y) * 2, width, y + sin(frameCount * 0.015 + y) * 2);
  }
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * width + sin(frameCount * 0.008 + i) * 12;
    stroke(137, 20, 90, 7);
    line(x, 0, x + sin(frameCount * 0.01 + i * 2) * 24, height);
  }
  blendMode(BLEND);
  pop();
}

function getInterpretationWeights() {
  if (phase2Age < 4) return { platform: 0.24, judgement: 0.54, self: 0.22 };
  if (phase2Age < 9) return { platform: 0.12, judgement: 0.50, self: 0.38 };
  return { platform: 0.04, judgement: 0.42, self: 0.54 };
}

function pickPhase2Text() {
  const w = getInterpretationWeights();
  const r = random();
  if (r < w.platform) return { text: random(PLATFORM_WORDS), kind: 'platform' };
  if (r < w.platform + w.judgement) return { text: random(JUDGEMENT_WORDS), kind: 'judgement' };
  return { text: random(SELF_WORDS), kind: 'self' };
}

function spawnPhase2Word() {
  const count = random() < 0.38 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const pick = pickPhase2Text();
    let x, y;

    if (phase2Eye && random() < 0.5) {
      const a = random(TAU);
      const rx = phase2Eye.baseW * random(0.18, 0.56);
      const ry = phase2Eye.baseH * random(0.35, 1.2);
      x = phase2Eye.x + cos(a) * rx;
      y = phase2Eye.y + sin(a) * ry;
    } else {
      const card = random(phase2Cards);
      if (!card) return;
      x = card.x + random(-card.w * 0.42, card.w * 0.42);
      y = card.y + random(-card.h * 0.36, card.h * 0.36);
    }

    phase2Words.push(new Phase2Word(x, y, pick.text, pick.kind));
  }

  if (random() < 0.48) {
    phase2Words.push(new Phase2Word(
      random(width * 0.06, width * 0.94),
      height + random(10, 70),
      random(PHASE2_NOISE_WORDS),
      'noise'
    ));
  }
}

function phase2KindColor(kind, alpha) {
  if (kind === 'platform') return color(224, 92, 42, alpha);
  if (kind === 'judgement') return color(255, 24, 58, alpha);
  if (kind === 'self') return color(255, 226, 232, alpha);
  return color(255, 85, 115, alpha);
}

function drawStage2TextRibbon() {
  push();
  blendMode(SCREEN);
  textAlign(CENTER, CENTER);
  textFont('monospace');
  for (let i = 0; i < 9; i++) {
    const x = map(i, 0, 8, width * 0.1, width * 0.9) + sin(frameCount * 0.007 + i) * 18;
    const phrase = i % 3 === 0 ? random(JUDGEMENT_WORDS) : (i % 3 === 1 ? random(SELF_WORDS) : random(PLATFORM_WORDS));
    const yStep = 64;
    const offset = (frameCount * (0.7 + i * 0.06) + i * 80) % yStep;
    for (let y = -80; y < height + 80; y += yStep) {
      const yy = y - offset;
      const a = i % 3 === 1 ? 18 : 11;
      fill(i % 3 === 1 ? 255 : 255, i % 3 === 1 ? 210 : 50, i % 3 === 1 ? 224 : 70, a);
      textSize(11 + (i % 3 === 1 ? 3 : 0));
      text(phrase, x + sin(yy * 0.01 + frameCount * 0.015) * 5, yy);
    }
  }
  blendMode(BLEND);
  pop();
}

function drawStage2ChromaticBurn() {
  push();
  blendMode(SCREEN);
  noFill();
  const cx = width * 0.5;
  const cy = height * 0.42;
  const flick = random() < 0.06 ? 1 : 0;
  stroke(255, 42, 58, 14 + flick * 28);
  strokeWeight(1.2);
  for (let i = 0; i < 5; i++) {
    const w = width * (0.18 + i * 0.14) + sin(frameCount * 0.018 + i) * 16;
    const h = w * 0.27;
    ellipse(cx, cy, w, h);
  }
  if (random() < 0.22) {
    noStroke();
    fill(210, 255, 46, 16);
    rect(random(width), random(height), random(8, 28), random(2, 6), 1);
  }
  blendMode(BLEND);
  pop();
}

class Phase2Card {
  constructor(lane, index, laneCount) {
    this.lane = lane;
    this.laneCount = laneCount;
    this.index = index;
    this.reset(true);
  }
  reset(first = false) {
    this.laneW = width / this.laneCount;
    this.w = this.laneW * random(0.5, 0.86);
    this.h = random(150, 260);
    this.x = this.lane * this.laneW + this.laneW * 0.5 + random(-this.laneW * 0.14, this.laneW * 0.14);
    this.y = first ? random(-height * 0.15, height * 1.1) : random(height + 80, height + 260);
    this.speed = random(3.4, 6.3);
    this.flashSeed = random(1000);
    this.kind = random(['platform', 'judgement', 'self']);
    const pick = pickPhase2Text();
    this.text = pick.text;
    this.textKind = pick.kind;
    this.metric = random(PHASE2_CHIPS);
    this.cut = random() < 0.62;
  }
  update() {
    this.y -= this.speed;
    this.x += sin(frameCount * 0.012 + this.flashSeed) * 0.22;
    if (random() < 0.012) {
      const pick = pickPhase2Text();
      this.text = pick.text;
      this.textKind = pick.kind;
    }
    if (this.y < -this.h - 80) this.reset(false);
  }
  display() {
    push();
    rectMode(CENTER);
    const flick = random() < 0.08 ? random(20, 70) : 0;
    const localA = 52 + flick * 0.25;

    noStroke();
    fill(8, 3, 8, 132);
    rect(this.x, this.y, this.w, this.h, 10);

    const ctx = drawingContext;
    const x0 = this.x - this.w * 0.5;
    const y0 = this.y - this.h * 0.5;
    const grad = ctx.createLinearGradient(x0, y0, x0 + this.w, y0 + this.h);
    grad.addColorStop(0, `rgba(255,18,52,${0.05 + flick * 0.0008})`);
    grad.addColorStop(0.45, 'rgba(122,0,76,0.035)');
    grad.addColorStop(1, `rgba(255,112,18,${0.035 + flick * 0.0005})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x0, y0, this.w, this.h, 10);
    ctx.fill();

    stroke(255, 54, 72, localA);
    strokeWeight(1);
    noFill();
    if (this.cut) {
      const c = 20;
      line(x0, y0 + c, x0, y0);
      line(x0, y0, x0 + c, y0);
      line(x0 + this.w - c, y0, x0 + this.w, y0);
      line(x0 + this.w, y0, x0 + this.w, y0 + c);
      line(x0, y0 + this.h - c, x0, y0 + this.h);
      line(x0, y0 + this.h, x0 + c, y0 + this.h);
      line(x0 + this.w - c, y0 + this.h, x0 + this.w, y0 + this.h);
      line(x0 + this.w, y0 + this.h - c, x0 + this.w, y0 + this.h);
    } else {
      rect(this.x, this.y, this.w, this.h, 10);
    }

    noStroke();
    textAlign(LEFT, TOP);
    textSize(11);
    fill(255, 100, 76, 52 + flick * 0.4);
    text(this.metric, x0 + 14, y0 + 12);

    const lines = [this.text, random(PHASE2_NOISE_WORDS), random(PHASE2_NOISE_WORDS), this.text];
    for (let i = 0; i < lines.length; i++) {
      const yy = y0 + 42 + i * 31;
      const kind = i === 0 ? this.textKind : 'noise';
      const c = phase2KindColor(kind, i === 0 ? 155 + flick : 34);
      fill(c);
      textSize(i === 0 ? 13 + (this.textKind === 'self' ? 2 : 0) : 10);
      const visibleText = i === 0 && random() < 0.12 ? this.text.slice(0, floor(random(3, this.text.length))) + '...' : lines[i];
      text(visibleText, x0 + 14 + random(-0.6, 0.6), yy, this.w - 28);
    }

    if (random() < 0.12) {
      fill(255, 244, 245, 24);
      textSize(13);
      text(this.text, x0 + 17 + random(-4, 4), y0 + 45 + random(-4, 4), this.w - 28);
    }
    pop();
  }
}

class Phase2Word {
  constructor(x, y, text, kind) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.kind = kind;
    this.vx = random(-18, 18);
    this.vy = kind === 'noise' ? random(-54, -24) : random(-42, -18);
    this.life = kind === 'noise' ? random(0.7, 1.5) : random(1.3, 2.8);
    this.ttl = this.life;
    this.size = kind === 'self' ? random(21, 34) : kind === 'judgement' ? random(16, 26) : random(11, 18);
    this.dead = false;
    this.seed = random(1000);
    this.rotate = random(-0.035, 0.035);
  }
  update() {
    this.life -= deltaTime / 1000;
    this.x += this.vx * deltaTime / 1000;
    this.y += this.vy * deltaTime / 1000;
    const jitterAmount = this.kind === 'self' ? 3.4 : this.kind === 'judgement' ? 2.6 : 1.6;
    if (random() < 0.22) {
      this.x += random(-jitterAmount, jitterAmount);
      this.y += random(-jitterAmount * 0.7, jitterAmount * 0.7);
    }
    if (this.life <= 0) this.dead = true;
  }
  display() {
    const aIn = constrain((this.ttl - this.life) / (this.ttl * 0.18), 0, 1);
    const aOut = constrain(this.life / (this.ttl * 0.38), 0, 1);
    const a = min(aIn, aOut);
    const glitch = random() < 0.12;

    push();
    translate(this.x, this.y);
    rotate(this.rotate + sin(frameCount * 0.02 + this.seed) * 0.01);
    textAlign(CENTER, CENTER);
    textSize(this.size);

    if (this.kind !== 'noise') {
      blendMode(SCREEN);
      fill(255, 10, 42, 40 * a);
      text(this.text, -2 + random(-1, 1), 1);
      fill(65, 235, 255, 16 * a);
      text(this.text, 2 + random(-1, 1), -1);
      blendMode(BLEND);
    }

    if (this.kind === 'platform') fill(236, 98, 46, 132 * a);
    else if (this.kind === 'judgement') fill(255, 34, 58, 215 * a);
    else if (this.kind === 'self') fill(255, 232, 236, 238 * a);
    else fill(255, 88, 122, 70 * a);

    const drawn = glitch && this.text.length > 5 ? this.text.slice(0, floor(random(3, this.text.length))) + '...' : this.text;
    text(drawn, 0, 0);

    if (this.kind === 'self' && random() < 0.2) {
      noFill();
      stroke(255, 226, 232, 28 * a);
      strokeWeight(1);
      rectMode(CENTER);
      rect(0, 0, textWidth(this.text) + 28, this.size * 1.6, 4);
    }
    pop();
  }
}

class Phase2FloatingEye {
  constructor() {
    this.x = width * 0.5;
    this.y = height * 0.42;
    this.baseW = min(width * 0.84, height * 1.35);
    this.baseH = this.baseW * 0.31;
    this.t = random(1000);
    this.blinkCountdown = int(random(120, 260));
    this.blinkPhase = 0;
    this.open = 1;
    this.ringWords = [];
    for (let i = 0; i < 34; i++) {
      this.ringWords.push({
        a: random(TAU),
        r: random(0.18, 0.86),
        text: random([...PLATFORM_WORDS, ...JUDGEMENT_WORDS, ...SELF_WORDS]),
        kind: random(['platform', 'judgement', 'self']),
        s: random(9, 17),
        speed: random(-0.0018, 0.0018)
      });
    }
  }
  update() {
    this.t += deltaTime * 0.001;
    this.x = width * 0.5 + sin(this.t * 0.74) * width * 0.018;
    this.y = height * 0.42 + cos(this.t * 0.52) * height * 0.014;
    this.baseW = min(width * 0.84, height * 1.35);
    this.baseH = this.baseW * 0.31;

    if (this.blinkPhase > 0) {
      this.blinkPhase += 0.2;
      const blink = sin(this.blinkPhase);
      this.open = constrain(abs(blink), 0.02, 1);
      if (this.blinkPhase >= PI) {
        this.blinkPhase = 0;
        this.open = 1;
        this.blinkCountdown = int(random(150, 360));
      }
    } else {
      this.blinkCountdown -= 1;
      if (this.blinkCountdown <= 0) this.blinkPhase = 0.01;
      this.open = lerp(this.open, 1, 0.08);
    }

    for (const rw of this.ringWords) {
      rw.a += rw.speed + sin(frameCount * 0.004 + rw.r * 5) * 0.0005;
      if (random() < 0.004) {
        const pick = pickPhase2Text();
        rw.text = pick.text;
        rw.kind = pick.kind;
      }
    }
  }
  displayBack() {
    push();
    translate(this.x, this.y);
    const ctx = drawingContext;
    const lidH = this.baseH * this.open;
    const pulse = map(sin(frameCount * 0.032), -1, 1, 0.88, 1.12);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const organGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, this.baseW * 0.68);
    organGlow.addColorStop(0, 'rgba(255,24,54,0.24)');
    organGlow.addColorStop(0.22, 'rgba(255,112,30,0.13)');
    organGlow.addColorStop(0.48, 'rgba(142,0,94,0.16)');
    organGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = organGlow;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.baseW * 0.74 * pulse, this.baseH * 1.72 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    blendMode(SCREEN);
    noFill();
    for (let i = 0; i < 10; i++) {
      const a = 30 - i * 2;
      stroke(i % 2 === 0 ? 255 : 160, i % 2 === 0 ? 38 : 0, i % 2 === 0 ? 64 : 118, a);
      strokeWeight(1.2);
      ellipse(0, 0, this.baseW * (0.2 + i * 0.07) * pulse, lidH * (0.7 + i * 0.18));
    }

    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU + frameCount * 0.002;
      const r1 = this.baseW * random(0.06, 0.12);
      const r2 = this.baseW * random(0.27, 0.43);
      const x1 = cos(a) * r1;
      const y1 = sin(a) * lidH * random(0.22, 0.46);
      const x2 = cos(a + sin(frameCount * 0.01 + i) * 0.08) * r2;
      const y2 = sin(a) * lidH * random(0.7, 1.18);
      stroke(255, 42, 62, random(8, 22));
      line(x1, y1, x2, y2);
    }

    textAlign(CENTER, CENTER);
    textFont('monospace');
    for (const rw of this.ringWords) {
      const rx = cos(rw.a) * this.baseW * rw.r * 0.46;
      const ry = sin(rw.a) * lidH * rw.r * 1.2;
      push();
      translate(rx, ry);
      rotate(rw.a + HALF_PI);
      textSize(rw.s);
      if (rw.kind === 'self') fill(255, 230, 236, 42);
      else if (rw.kind === 'judgement') fill(255, 28, 56, 48);
      else fill(255, 110, 34, 32);
      text(rw.text, 0, 0);
      pop();
    }
    blendMode(BLEND);
    pop();
  }
  displayFront() {
    push();
    translate(this.x, this.y);
    const ctx = drawingContext;
    const lidH = this.baseH * this.open;
    const pulse = map(sin(frameCount * 0.03), -1, 1, 0.92, 1.06);

    noStroke();
    const pupilGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, this.baseH * 1.2);
    pupilGlow.addColorStop(0, 'rgba(0,0,0,0.88)');
    pupilGlow.addColorStop(0.34, 'rgba(20,0,12,0.82)');
    pupilGlow.addColorStop(0.58, 'rgba(118,0,62,0.36)');
    pupilGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pupilGlow;
    ctx.beginPath();
    ctx.ellipse(0, 0, this.baseH * 0.78 * pulse, this.baseH * 0.78 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();

    blendMode(SCREEN);
    noFill();
    stroke(255, 214, 226, 36);
    strokeWeight(1.2);
    beginShape();
    vertex(-this.baseW * 0.5, 0);
    bezierVertex(-this.baseW * 0.27, -lidH * 1.28, this.baseW * 0.27, -lidH * 1.28, this.baseW * 0.5, 0);
    bezierVertex(this.baseW * 0.27, lidH * 1.28, -this.baseW * 0.27, lidH * 1.28, -this.baseW * 0.5, 0);
    endShape(CLOSE);

    stroke(255, 28, 54, 24);
    strokeWeight(2);
    arc(0, 0, this.baseW * 0.95, lidH * 2.55, PI + 0.06, TWO_PI - 0.06);
    arc(0, 0, this.baseW * 0.95, lidH * 2.55, 0.06, PI - 0.06);
    blendMode(BLEND);

    if (this.open < 0.2) {
      noStroke();
      fill(0, 0, 0, 205);
      rect(0, 0, width * 1.4, this.baseH * 0.32, 2);
    }
    pop();
  }
}

class Phase2GazeMark {
  constructor() { this.reset(); }
  reset() {
    this.x = random(width * 0.06, width * 0.94);
    this.y = random(height * 0.08, height * 0.92);
    this.scale = random(0.45, 1.28);
    this.alpha = random(22, 62);
    this.life = random(100, 260);
    this.vx = random(-0.28, 0.28);
    this.vy = random(-0.18, 0.18);
    this.mode = random(['corners', 'microeye', 'target']);
  }
  update() {
    this.life -= 1;
    this.x += this.vx;
    this.y += this.vy;
    if (this.life <= 0 || this.x < -80 || this.x > width + 80 || this.y < -80 || this.y > height + 80) this.reset();
  }
  display() {
    push();
    const a = this.alpha * map(sin(frameCount * 0.035 + this.x * 0.01), -1, 1, 0.38, 1);
    noFill();
    strokeWeight(1.1);

    if (this.mode === 'corners') {
      const s = 42 * this.scale;
      const c = 10 * this.scale;
      stroke(255, 44, 72, a * 0.55);
      line(this.x - s, this.y - s, this.x - s + c, this.y - s);
      line(this.x - s, this.y - s, this.x - s, this.y - s + c);
      line(this.x + s, this.y - s, this.x + s - c, this.y - s);
      line(this.x + s, this.y - s, this.x + s, this.y - s + c);
      line(this.x - s, this.y + s, this.x - s + c, this.y + s);
      line(this.x - s, this.y + s, this.x - s, this.y + s - c);
      line(this.x + s, this.y + s, this.x + s - c, this.y + s);
      line(this.x + s, this.y + s, this.x + s, this.y + s - c);
    } else if (this.mode === 'microeye') {
      stroke(255, 80, 100, a * 0.46);
      ellipse(this.x, this.y, 70 * this.scale, 20 * this.scale);
      noStroke();
      fill(255, 236, 240, a * 0.28);
      circle(this.x, this.y, 8 * this.scale);
      fill(0, 0, 0, a * 0.9);
      circle(this.x, this.y, 4 * this.scale);
    } else {
      stroke(255, 128, 24, a * 0.38);
      ellipse(this.x, this.y, 48 * this.scale, 48 * this.scale);
      line(this.x - 34 * this.scale, this.y, this.x + 34 * this.scale, this.y);
      line(this.x, this.y - 34 * this.scale, this.x, this.y + 34 * this.scale);
    }
    pop();
  }
}

class Phase2Dust {
  constructor() { this.reset(true); }
  reset(first = false) {
    this.x = random(width);
    this.y = first ? random(height) : height + random(10, 90);
    this.s = random(1, 3.8);
    this.vy = random(-2.8, -0.8);
    this.vx = random(-0.35, 0.35);
    this.alpha = random(10, 44);
    this.kind = random() < 0.08 ? 'acid' : 'red';
  }
  update() {
    this.y += this.vy;
    this.x += this.vx + sin(frameCount * 0.018 + this.y * 0.02) * 0.22;
    if (this.y < -10 || this.x < -20 || this.x > width + 20) this.reset(false);
  }
  display() {
    noStroke();
    if (this.kind === 'acid') fill(206, 255, 38, this.alpha * 0.55);
    else fill(255, random(34, 92), random(58, 126), this.alpha);
    circle(this.x, this.y, this.s);
  }
}

function drawStage2FeedMask() {
  push();
  noStroke();
  const ctx = drawingContext;
  const topFade = ctx.createLinearGradient(0, 0, 0, height * 0.16);
  topFade.addColorStop(0, 'rgba(2,2,3,0.98)');
  topFade.addColorStop(1, 'rgba(2,2,3,0)');
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, width, height * 0.16);

  const bottomFade = ctx.createLinearGradient(0, height * 0.82, 0, height);
  bottomFade.addColorStop(0, 'rgba(2,2,3,0)');
  bottomFade.addColorStop(1, 'rgba(2,2,3,0.98)');
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);

  const side = ctx.createLinearGradient(0, 0, width, 0);
  side.addColorStop(0, 'rgba(2,2,3,0.42)');
  side.addColorStop(0.16, 'rgba(2,2,3,0)');
  side.addColorStop(0.84, 'rgba(2,2,3,0)');
  side.addColorStop(1, 'rgba(2,2,3,0.42)');
  ctx.fillStyle = side;
  ctx.fillRect(0, 0, width, height);
  pop();
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
      this.cooldown = int(random(42, 110));
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.r += ring.speed;
      ring.alpha *= 0.982;
      ring.weight *= 0.996;
      if (ring.alpha < 2 || ring.r > max(width, height) * 0.78) {
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
      '#dceff1', '#c7ebe5', '#b7d8ff', '#5a8d96', '#ffd9b8', '#cdb8ff', '#9ff0da'
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
  if (phase === 0) initStage1();
  if (phase === 1) initStage2();
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