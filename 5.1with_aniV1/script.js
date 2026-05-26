let phase = 0; // 0 = anxiety_1, 1 = anxiety_2, 2 = relief

let uiEl;
let uiHideTimer = 7;

let transitionState = null;


// anxiety1
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

// anxiety2
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
  // each tide is a moving distorted band. When it touches front-layer signals, the signal flashes as if it has been refreshed away
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

  // drawn last so the bridge reads as a transformation layer rather than a flat fade/cut between screens
  drawPhaseTransform();
}


// anxiety1
function drawStage1() {
  updateStage1Tides();
  drawStage1Background();
  drawStage1RefreshTideBack();
  drawStage1FeedGhostsBalanced();
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

  // falling digital residue: it makes the refresh action feel like a pull/reload
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

function drawStage1FeedGhostsBalanced() {
  // very faint platform ghosts in the background
  push();
  blendMode(SCREEN);
  rectMode(CENTER);
  noFill();

  const count = max(4, min(7, floor(width / 240)));
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.5) / count) * width + sin(frameCount * 0.006 + i * 2.1) * 26;
    const y = height * (0.18 + (i % 4) * 0.19) + cos(frameCount * 0.005 + i) * 20;
    const info = getStage1RefreshInfo(x, y);
    const w = width * random(0.09, 0.15);
    const h = random(34, 54);
    const a = 5 + info.flash * 18;
    const px = x + info.sideShift * 0.25;
    const py = y + info.displacement * 0.25;

    stroke(255, 78, 86, a * 1.2);
    strokeWeight(1);
    // broken top/bottom edges only
    line(px - w * 0.46, py - h * 0.38, px - w * 0.14, py - h * 0.38);
    line(px + w * 0.10, py - h * 0.38, px + w * 0.46, py - h * 0.38);
    line(px - w * 0.42, py + h * 0.34, px - w * 0.04, py + h * 0.34);
    line(px + w * 0.16, py + h * 0.34, px + w * 0.42, py + h * 0.34);

    noStroke();
    fill(255, 56, 68, a * 2.0);
    circle(px - w * 0.36, py, 5 + info.flash * 4);
    fill(255, 232, 214, a * 1.35);
    textAlign(LEFT, CENTER);
    textSize(8 + info.flash * 1.5);
    text(random(['seen', 'new', '@', 'live', '...']), px - w * 0.25, py - 1);

    // small broken ticks instead of bar-chart-like rectangles
    stroke(255, 190, 150, a * 0.95);
    for (let k = 0; k < 4; k++) {
      const tx = px + w * (-0.02 + k * 0.105);
      line(tx, py - 5, tx + 5 + info.flash * 6, py - 5 + random(-1, 1));
    }
    noFill();
  }
  pop();
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
    // slightly slower so the social cues remain legible in exhibition space.
    stage1SpawnTimer = random(0.07, 0.16);
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
      e.life = min(e.life, random(0.12, 0.28));
      e.vy += random(-10, 22);
      e.vx += random(-18, 18);
    }

    if (e.type === 'baitDot' || e.type === 'baitOrb') {
      e.pulse += dt * e.pulseSpeed;
      e.y += sin(frameCount * 0.015 + e.seed) * 0.08;
    }

    if (e.type === 'baitGlyph') {
      e.x += sin(frameCount * 0.02 + e.seed) * 0.12;
    }


    if (e.type === 'typing') {
      e.dotPhase += dt * 6.4;
    }

    if (e.x < -220 || e.x > width + 220 || e.y < -220 || e.y > height + 220 || e.life <= 0) {
      stage1Elements.splice(i, 1);
    }
  }
}

function stage1SocialCount() {
  return stage1Elements.filter(e => ['card', 'badge', 'typing', 'iconmetric'].includes(e.type)).length;
}

function spawnStage1Burst() {
  const maxCount = floor(map(width * height, 300000, 3000000, 76, 138, true));
  if (stage1Elements.length > maxCount) return;

  const clusterX = random(width * 0.08, width * 0.92);
  const clusterY = random(height * 0.1, height * 0.9);

  // reduce bait dots
  let dotNum = 0;
  const dotChance = random();
  if (dotChance < 0.46) dotNum = 1;
  else if (dotChance < 0.58) dotNum = 2;
  for (let i = 0; i < dotNum; i++) {
    spawnBaitDot(clusterX + random(-42, 42), clusterY + random(-34, 34), random() < 0.14);
  }

  const r = random();
  if (r < 0.26) spawnBaitGlyph(clusterX + random(-42, 42), clusterY + random(-32, 32));
  else if (r < 0.32) spawnBaitOrb(clusterX, clusterY);

  const socialCount = stage1SocialCount();
  if (socialCount < 4 && random() < 0.38) {
    const s = random();
    if (s < 0.30) spawnFeedCardTrace();
    else if (s < 0.56) spawnBadgeChipTrace();
    else if (s < 0.78) spawnTypingBubbleTrace();
    else spawnIconMetricTrace();
  }
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

function spawnFeedCardTrace() {
  const laneCount = max(3, min(5, floor(width / 320)));
  const laneW = width / laneCount;
  const lane = floor(random(laneCount));
  const ttl = random(0.72, 1.32);
  stage1Elements.push({
    type: 'card',
    x: lane * laneW + laneW * 0.5 + random(-laneW * 0.18, laneW * 0.18),
    y: random(height * 0.08, height * 0.88),
    w: laneW * random(0.44, 0.66),
    h: random(36, 62),
    ttl, life: ttl,
    age: 0,
    label: random(['for you', 'suggested', 'nearby', 'new', 'reloaded', 'pushed']),
    metric: random(['viewed', 'liked', 'shared', 'saved', 'seen', 'boosted']),
    count: `${floor(random(1, 98))}`,
    lines: floor(random(1, 3)),
    hasImage: false,
    vx: random(-14, 12),
    vy: random(-20, -6),
    seed: random(9999),
    refreshed: false,
    refreshGlow: 0,
    refreshDisplace: 0,
    refreshShift: 0
  });
}

function spawnBadgeChipTrace() {
  const ttl = random(0.7, 1.28);
  stage1Elements.push({
    type: 'badge',
    x: random(width * 0.08, width * 0.92),
    y: random(height * 0.08, height * 0.9),
    text: random(FEED_BADGES),
    ttl, life: ttl,
    age: 0,
    vx: random(-14, 14),
    vy: random(-16, 4),
    seed: random(9999),
    refreshed: false,
    refreshGlow: 0,
    refreshDisplace: 0,
    refreshShift: 0
  });
}

function spawnTypingBubbleTrace() {
  const ttl = random(0.8, 1.35);
  stage1Elements.push({
    type: 'typing',
    x: random(width * 0.12, width * 0.88),
    y: random(height * 0.12, height * 0.88),
    w: random(90, 170),
    ttl, life: ttl,
    age: 0,
    dotPhase: random(TAU),
    label: random(FEED_ACTIONS),
    vx: random(-9, 9),
    vy: random(-14, 3),
    seed: random(9999),
    refreshed: false,
    refreshGlow: 0,
    refreshDisplace: 0,
    refreshShift: 0
  });
}

function spawnIconMetricTrace() {
  const ttl = random(0.62, 1.15);
  stage1Elements.push({
    type: 'iconmetric',
    x: random(width * 0.08, width * 0.92),
    y: random(height * 0.12, height * 0.9),
    value: `${floor(random(3, 999))}`,
    icon: random(FEED_ICON_TYPES),
    ttl, life: ttl,
    age: 0,
    vx: random(-10, 10),
    vy: random(-16, 4),
    seed: random(9999),
    refreshed: false,
    refreshGlow: 0,
    refreshDisplace: 0,
    refreshShift: 0
  });
}

function fadeElement(life, ttl) {
  const fadeIn = constrain((ttl - life) / (ttl * 0.2), 0, 1);
  const fadeOut = constrain(life / (ttl * 0.3), 0, 1);
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
  const nodes = stage1Elements.filter(e => e.type === 'baitDot' || e.type === 'baitOrb' || e.type === 'iconmetric');
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
    else if (e.type === 'card') drawStage1CardTrace(e, a, p);
    else if (e.type === 'badge') drawStage1BadgeTrace(e, a, p);
    else if (e.type === 'typing') drawStage1TypingTrace(e, a, p);
    else if (e.type === 'iconmetric') drawStage1IconMetricTrace(e, a, p);
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

function drawStage1CardTrace(e, a, p) {
  // anxiety1 uses feed shards, not chat bubbles
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  rectMode(CENTER);
  const flash = p.glow;
  const jitter = flash > 0.15 ? random(-1.6, 1.6) : 0;

  // a very thin broken plate
  noStroke();
  fill(26, 8, 18, (54 + flash * 58) * a);
  rect(jitter, 0, e.w, e.h, 4);

  strokeWeight(1);
  stroke(255, 70 + flash * 130, 74 + flash * 100, (62 + flash * 116) * a);
  noFill();
  // broken, angular edges: more like feed UI debris
  line(-e.w * 0.50, -e.h * 0.42, -e.w * 0.22, -e.h * 0.42);
  line(-e.w * 0.04, -e.h * 0.42, e.w * 0.50, -e.h * 0.42);
  line(-e.w * 0.50, e.h * 0.42, e.w * 0.06, e.h * 0.42);
  line(e.w * 0.24, e.h * 0.42, e.w * 0.50, e.h * 0.42);
  line(-e.w * 0.50, -e.h * 0.42, -e.w * 0.50, -e.h * 0.10);
  line(e.w * 0.50, e.h * 0.10, e.w * 0.50, e.h * 0.42);

  // red bait dot + tiny platform status
  noStroke();
  fill(255, 48 + flash * 130, 58 + flash * 120, (160 + flash * 80) * a);
  circle(-e.w * 0.39, 0, 7 + flash * 5);
  fill(255, 228, 218, (145 + flash * 100) * a);
  textAlign(LEFT, CENTER);
  textSize(8.5 + flash * 1.6);
  text(e.label, -e.w * 0.31, -e.h * 0.16);

  // broken text ticks, deliberately short and uneven
  stroke(255, 220, 205, (56 + flash * 80) * a);
  strokeWeight(1.2);
  for (let i = 0; i < e.lines + 2; i++) {
    const xx = -e.w * 0.31 + i * e.w * 0.12;
    const yy = e.h * 0.12 + random(-0.6, 0.6);
    const len = random(7, 18) + flash * 8;
    line(xx, yy, xx + len, yy + random(-0.7, 0.7));
  }

  // count + action as a micro signal
  noStroke();
  fill(255, 88 + flash * 110, 80 + flash * 95, (122 + flash * 110) * a);
  textAlign(RIGHT, CENTER);
  textSize(10 + flash * 2);
  text(`${e.count} ${e.metric}`, e.w * 0.42, e.h * 0.16);

  // refresh contact makes the shard overexpose and tear away
  if (flash > 0.18 || noise(e.seed, frameCount * 0.04) > 0.82) {
    stroke(255, 202, 146, (55 + flash * 145) * a);
    line(-e.w * 0.56, random(-e.h * 0.28, e.h * 0.28), e.w * 0.56, random(-e.h * 0.28, e.h * 0.28));
    stroke(255, 245, 220, 55 * flash * a);
    line(-e.w * 0.18, -e.h * 0.62, e.w * 0.12, e.h * 0.62);
  }
  pop();
}

function drawStage1BadgeTrace(e, a, p) {
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  rectMode(CENTER);
  const flash = p.glow;
  const w = max(82, e.text.length * 7.2 + 24);

  noStroke();
  fill(255, 48 + flash * 140, 58 + flash * 120, (145 + flash * 95) * a);
  rect(0, 0, w, 27, 14);
  fill(255, 244, 240, (190 + flash * 60) * a);
  textAlign(CENTER, CENTER);
  textSize(11 + flash * 2);
  text(e.text, 0, 1);

  if (flash > 0.2) {
    stroke(255, 226, 190, 80 * flash * a);
    line(-w * 0.6, -16, w * 0.6, 16);
  }
  pop();
}

function drawStage1TypingTrace(e, a, p) {
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  rectMode(CENTER);
  const flash = p.glow;
  const h = 22 + flash * 4;

  strokeWeight(1);
  stroke(255, 70 + flash * 135, 70 + flash * 110, (76 + flash * 118) * a);
  noFill();
  line(-e.w * 0.48, -h * 0.45, -e.w * 0.12, -h * 0.45);
  line(e.w * 0.03, -h * 0.45, e.w * 0.48, -h * 0.45);
  line(-e.w * 0.48, h * 0.45, e.w * 0.18, h * 0.45);
  line(e.w * 0.30, h * 0.45, e.w * 0.48, h * 0.45);

  noStroke();
  fill(255, 50 + flash * 145, 62 + flash * 110, (90 + flash * 120) * a);
  circle(-e.w * 0.39, 0, 5 + flash * 3);

  fill(255, 226, 214, (128 + flash * 112) * a);
  textAlign(LEFT, CENTER);
  textSize(9.5 + flash * 1.5);
  text(e.label, -e.w * 0.32, 1);

  const dx = e.w * 0.24;
  for (let i = 0; i < 3; i++) {
    const pulse = map(sin(e.dotPhase + i * 0.9), -1, 1, 0.25, 1);
    fill(255, 132 + flash * 80, 98 + flash * 80, (132 + flash * 95) * a * pulse);
    rect(dx + i * 9, 0, 5 + pulse * 4 + flash * 4, 2.2, 1);
  }
  pop();
}

function drawStage1IconMetricTrace(e, a, p) {
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  rectMode(CENTER);
  const flash = p.glow;

  noStroke();
  fill(18, 12, 18, (116 + flash * 95) * a);
  rect(0, 0, 76 + flash * 10, 32 + flash * 4, 16);

  if (e.icon === 'heart') {
    fill(255, 88 + flash * 90, 110 + flash * 70, (190 + flash * 60) * a);
    beginShape();
    vertex(0, 7);
    bezierVertex(-12, -4, -10, -16, 0, -6);
    bezierVertex(10, -16, 12, -4, 0, 7);
    endShape(CLOSE);
  } else {
    stroke(214, 238, 245, (168 + flash * 70) * a);
    strokeWeight(1.8);
    noFill();
    ellipse(0, -1, 22 + flash * 7, 12 + flash * 3);
    noStroke();
    fill(214, 238, 245, (170 + flash * 70) * a);
    circle(0, -1, 5 + flash * 3);
  }

  noStroke();
  fill(255, 236, 232, (205 + flash * 50) * a);
  textAlign(LEFT, CENTER);
  textSize(11 + flash * 2);
  text(e.value, 18, 1);
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


// anxiety2
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


// phase transition system: true element inheritance + distinct transformations
function easeInOutCubic(t) {
  t = constrain(t, 0, 1);
  return t < 0.5 ? 4 * t * t * t : 1 - pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  t = constrain(t, 0, 1);
  return 1 - pow(1 - t, 3);
}

function easeInCubic(t) {
  t = constrain(t, 0, 1);
  return t * t * t;
}

function easeOutBack(t) {
  t = constrain(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2);
}

function smoother(t) {
  t = constrain(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function cubicPoint(a, b, c, d, t) {
  const mt = 1 - t;
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

function localProgress(p, delay = 0, tail = 0.04) {
  return constrain((p - delay) / max(0.001, 1 - delay - tail), 0, 1);
}

function transitionDuration(from, to) {
  const key = `${from}-${to}`;
  if (key === '0-1') return 4.05; // signal fragments are gathered into gaze/text
  if (key === '1-2') return 4.45; // eye/text/card collapse and dissolve into relief
  if (key === '2-0') return 3.35; // soft breathing light condenses back into feed cues
  return 2.8;
}

function stageNameLabel(p) {
  if (p === 0) return 'Anxiety 1';
  if (p === 1) return 'Anxiety 2';
  return 'Relief';
}

function initPhase(p) {
  if (p === 0) initStage1();
  if (p === 1) initStage2();
  if (p === 2) initRelief();
}

function pickPhase2Target() {
  const pick = pickPhase2Text();
  return { text: pick.text, kind: pick.kind };
}

function pickTransformTextForPhase(p) {
  if (p === 0) return random([...FEED_BADGES, ...FEED_ACTIONS, 'pull', 'reload', 'seen', 'new']);
  if (p === 1) return random([...PLATFORM_WORDS, ...JUDGEMENT_WORDS, ...SELF_WORDS, ...PHASE2_NOISE_WORDS]);
  return random(RELIEF_WORDS);
}

function phase2TargetKindColor(kind, alphaValue = 180) {
  if (kind === 'platform') return color(238, 92, 44, alphaValue);
  if (kind === 'judgement') return color(255, 38, 66, alphaValue);
  if (kind === 'self') return color(255, 234, 238, alphaValue);
  return color(255, 92, 124, alphaValue);
}

function getAnchorText(a, fallbackPhase = 0) {
  return a.text || a.label || a.metric || a.value || pickTransformTextForPhase(fallbackPhase);
}

function addFallbackAnchors(anchors, desiredCount, sourcePhase) {
  while (anchors.length < desiredCount) {
    anchors.push({
      x: random(width * 0.06, width * 0.94),
      y: random(height * 0.08, height * 0.92),
      w: random(10, 90),
      h: random(8, 46),
      text: pickTransformTextForPhase(sourcePhase),
      kind: 'field',
      alpha: 0.45,
      size: random(8, 18)
    });
  }
}

function shuffleAnchors(anchors) {
  for (let i = anchors.length - 1; i > 0; i--) {
    const j = floor(random(i + 1));
    const tmp = anchors[i];
    anchors[i] = anchors[j];
    anchors[j] = tmp;
  }
  return anchors;
}

function collectTransitionAnchors(sourcePhase, desiredCount = 120) {
  const anchors = [];

  if (sourcePhase === 0) {
    for (const e of stage1Elements) {
      const p = stage1DisplayPos(e);
      let text = e.text || e.label || e.metric || e.value || '';
      if (e.type === 'card') text = `${e.metric || e.label || 'viewed'} ${e.count || ''}`.trim();
      if (e.type === 'typing') text = e.label || 'typing...';
      if (e.type === 'iconmetric') text = `${e.value || ''} ${e.icon === 'eye' ? 'views' : 'likes'}`.trim();
      if (!text) text = random(FEED_BADGES);
      anchors.push({
        x: p.x,
        y: p.y,
        w: e.w || (e.r ? e.r * 2 : max(18, text.length * 7)),
        h: e.h || (e.r ? e.r * 2 : 22),
        text,
        kind: e.type || 'signal',
        icon: e.icon || e.symbolType || null,
        count: e.count || null,
        size: e.size || e.r || random(8, 18),
        glow: p.glow || 0,
        alpha: fadeElement(e.life || 1, e.ttl || 1)
      });
    }
    // preserve the moving refresh seams as real source material for the a1-a2 fold
    for (const tide of stage1Tides) {
      anchors.push({
        x: width * 0.5,
        y: tide.y,
        w: width * 1.1,
        h: tide.band,
        text: 'refresh',
        kind: 'refreshTide',
        amp: tide.waveAmp,
        phase: tide.phase,
        speed: tide.speed,
        alpha: 0.65
      });
    }
  } else if (sourcePhase === 1) {
    for (const c of phase2Cards) {
      anchors.push({
        x: c.x,
        y: c.y,
        w: c.w,
        h: c.h,
        text: c.text,
        kind: 'phase2Card',
        textKind: c.textKind,
        metric: c.metric,
        cut: c.cut,
        alpha: 0.82
      });
    }
    for (const w of phase2Words) {
      anchors.push({
        x: w.x,
        y: w.y,
        w: max(28, w.text.length * w.size * 0.42),
        h: w.size * 1.5,
        text: w.text,
        kind: 'phase2Word',
        textKind: w.kind,
        size: w.size,
        rotate: w.rotate || 0,
        alpha: 0.9
      });
    }
    if (phase2Eye) {
      anchors.push({
        x: phase2Eye.x,
        y: phase2Eye.y,
        w: phase2Eye.baseW,
        h: phase2Eye.baseH,
        text: 'watching',
        kind: 'phase2Eye',
        alpha: 1
      });
      for (const rw of phase2Eye.ringWords) {
        const rx = phase2Eye.x + cos(rw.a) * phase2Eye.baseW * rw.r * 0.5;
        const ry = phase2Eye.y + sin(rw.a) * phase2Eye.baseH * rw.r * 1.25;
        anchors.push({
          x: rx,
          y: ry,
          w: max(20, rw.text.length * rw.s * 0.5),
          h: rw.s * 1.5,
          text: rw.text,
          kind: 'phase2RingWord',
          textKind: rw.kind,
          size: rw.s,
          angle: rw.a,
          radius: rw.r,
          alpha: 0.78
        });
      }
    }
  } else {
    for (const m of reliefMotes) {
      anchors.push({ x: m.x, y: m.y, w: m.s * 3.2, h: m.s * 3.2, text: 'light', kind: 'reliefMote', size: m.s, alpha: 0.7 });
    }
    for (const w of reliefWords) {
      anchors.push({ x: w.x, y: w.y, w: max(24, w.text.length * w.size * 0.48), h: w.size * 1.4, text: w.text, kind: 'reliefWord', size: w.size, alpha: 0.78 });
    }
    for (const b of reliefBlobs) {
      const bx = b.x || b.baseX;
      const by = b.y || b.baseY;
      const bs = b.currentSize || b.size;
      anchors.push({ x: bx, y: by, w: bs, h: bs * 0.65, text: 'soft light', kind: 'reliefBlob', size: bs, palette: b.palette, alpha: 0.55 });
    }
    for (const petal of reliefPetals) {
      anchors.push({ x: petal.x, y: petal.y, w: petal.dMax || min(width, height) * 0.22, h: petal.dMax || min(width, height) * 0.22, text: 'bloom', kind: 'reliefPetal', size: petal.d || 20, alpha: 0.55 });
    }
    for (const ripple of reliefRipples) {
      for (const ring of ripple.rings) {
        anchors.push({ x: ripple.centerX, y: ripple.centerY, w: ring.r * 2, h: ring.r * 2 * ring.stretch, text: 'ring', kind: 'reliefRipple', size: ring.r, alpha: ring.alpha / 100 });
      }
    }
  }

  addFallbackAnchors(anchors, desiredCount, sourcePhase);
  return shuffleAnchors(anchors).slice(0, desiredCount);
}

function createPhaseTransform(from, to) {
  const key = `${from}-${to}`;
  const state = {
    from,
    to,
    key,
    age: 0,
    duration: transitionDuration(from, to),
    particles: [],
    letters: [],
    fragments: [],
    seams: [],
    rings: [],
    seed: random(99999),
    label: `${stageNameLabel(from)} → ${stageNameLabel(to)}`
  };

  if (key === '0-1') buildFeedToGazeTransform(state, collectTransitionAnchors(from, 165));
  else if (key === '1-2') buildGazeToReliefTransform(state, collectTransitionAnchors(from, 190));
  else if (key === '2-0') buildReliefToFeedTransform(state, collectTransitionAnchors(from, 175));
  else buildGenericTransform(state, collectTransitionAnchors(from, 130));

  return state;
}

// anxiety1-anxiety2: individual feed signals are misread and organised into gaze
function buildFeedToGazeTransform(state, anchors) {
  const eyeCx = width * 0.5;
  const eyeCy = height * 0.42;
  const eyeW = min(width * 0.84, height * 1.35);
  const eyeH = eyeW * 0.31;
  const laneCount = max(3, min(5, floor(width / 320)));

  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];

    if (a.kind === 'refreshTide') {
      state.seams.push({
        sourceY: a.y,
        sourceBand: a.h,
        amp: a.amp || random(18, 44),
        phase: a.phase || random(TAU),
        lidOffset: random(-eyeH * 0.58, eyeH * 0.58),
        delay: random(0, 0.12)
      });
      continue;
    }

    const isDot = ['baitDot', 'baitOrb', 'iconmetric'].includes(a.kind);
    const isTextChip = ['badge', 'typing', 'baitGlyph'].includes(a.kind);
    const mode = isDot ? 'signalToPupil' : isTextChip ? 'chipToJudgement' : random(['cardToCard', 'chipToJudgement', 'signalToPupil']);
    const targetPick = pickPhase2Target();
    let tx, ty, targetW, targetH, finalKind;

    if (mode === 'signalToPupil') {
      const angle = random(TAU);
      const radius = random(0.16, 0.52);
      tx = eyeCx + cos(angle) * eyeW * radius * 0.5;
      ty = eyeCy + sin(angle) * eyeH * radius * 1.55;
      targetW = random(14, 56);
      targetH = random(6, 22);
      finalKind = random() < 0.6 ? 'eyeNode' : 'ringWord';
    } else if (mode === 'chipToJudgement') {
      const angle = random(-PI * 0.1, PI * 1.1);
      tx = eyeCx + cos(angle) * eyeW * random(0.25, 0.48);
      ty = eyeCy + sin(angle) * eyeH * random(0.75, 1.28);
      targetW = max(70, targetPick.text.length * random(7.5, 10.5));
      targetH = random(18, 34);
      finalKind = 'ringWord';
    } else {
      const lane = i % laneCount;
      tx = lane * (width / laneCount) + width / laneCount * 0.5 + random(-48, 48);
      ty = random(height * 0.16, height * 0.94);
      targetW = random(width / laneCount * 0.54, width / laneCount * 0.86);
      targetH = random(132, 236);
      finalKind = 'phase2Card';
    }

    state.particles.push({
      sx: a.x,
      sy: a.y,
      tx,
      ty,
      c1x: lerp(a.x, tx, 0.28) + random(-120, 120),
      c1y: lerp(a.y, ty, 0.28) + random(-120, 70),
      c2x: lerp(a.x, tx, 0.72) + random(-95, 95),
      c2y: lerp(a.y, ty, 0.72) + random(-80, 120),
      sourceKind: a.kind,
      mode,
      finalKind,
      fromText: getAnchorText(a, 0),
      toText: targetPick.text,
      toKind: targetPick.kind,
      icon: a.icon,
      w0: max(6, min(a.w || 20, width * 0.35)),
      h0: max(4, min(a.h || 18, height * 0.22)),
      w1: targetW,
      h1: targetH,
      delay: random(0.01, 0.28),
      spin: random(-0.8, 0.8),
      seed: random(9999),
      alpha: a.alpha || 0.8
    });
  }
}

function drawFeedToGazeTransform(state, p) {
  const q = smoother(p);
  const eyeCx = width * 0.5;
  const eyeCy = height * 0.42;
  const eyeW = min(width * 0.84, height * 1.35);
  const eyeH = eyeW * 0.31;

  push();
  noStroke();
  fill(4, 0, 5, 62 + 92 * sin(p * PI));
  rect(width * 0.5, height * 0.5, width, height);
  pop();

  drawA1RefreshBandsFoldingIntoEye(state, p, eyeCx, eyeCy, eyeW, eyeH);
  drawA1ToA2Tethers(state, p, eyeCx, eyeCy);

  for (const item of state.particles) drawA1InheritedParticle(item, p);

  drawA1AssembledEye(state, p, eyeCx, eyeCy, eyeW, eyeH);
  drawTransitionLabel(state, p, color(255, 94, 108));
}

function drawA1RefreshBandsFoldingIntoEye(state, p, cx, cy, eyeW, eyeH) {
  const q = smoother(constrain((p - 0.03) / 0.82, 0, 1));
  push();
  blendMode(SCREEN);
  noFill();
  for (let i = 0; i < state.seams.length; i++) {
    const seam = state.seams[i];
    const lp = localProgress(p, seam.delay, 0.08);
    const k = smoother(lp);
    const a = 52 * sin(lp * PI);
    stroke(255, lerp(38, 104, k), lerp(58, 112, k), a);
    strokeWeight(lerp(1.0, 2.1, k));
    beginShape();
    for (let x = -60; x <= width + 60; x += 18) {
      const n = (x - width * 0.5) / (width * 0.5);
      const oldY = seam.sourceY + sin(x * 0.009 + seam.phase + frameCount * 0.018) * seam.amp;
      const lidCurve = cy + sin(n * PI) * eyeH * 0.45 + seam.lidOffset * 0.2;
      const foldedX = lerp(x, cx + n * eyeW * 0.48, k * 0.78);
      const foldedY = lerp(oldY, lidCurve, k);
      curveVertex(foldedX, foldedY);
    }
    endShape();
  }

  // small vertical strokes appear late: the feed rhythm is being re-read as lashes/gaze marks
  const lashP = constrain((p - 0.48) / 0.42, 0, 1);
  for (let i = 0; i < 38; i++) {
    const a = map(i, 0, 37, -PI * 0.92, PI * 0.08);
    const side = i % 2 === 0 ? -1 : 1;
    const x = cx + cos(a) * eyeW * 0.5;
    const y = cy + side * abs(sin(a)) * eyeH * 0.62;
    const len = random(10, 32) * lashP;
    stroke(255, 54, 76, 26 * lashP);
    line(x, y, x + cos(a) * len, y + side * len * 0.35);
  }
  blendMode(BLEND);
  pop();
}

function drawA1ToA2Tethers(state, p, cx, cy) {
  const a = 32 * sin(constrain((p - 0.08) / 0.74, 0, 1) * PI);
  if (a <= 1) return;
  push();
  blendMode(SCREEN);
  strokeWeight(0.75);
  for (let i = 0; i < state.particles.length; i += 3) {
    const item = state.particles[i];
    const lp = localProgress(p, item.delay, 0.08);
    if (lp <= 0 || lp >= 0.93) continue;
    const q = easeInOutCubic(lp);
    const x = cubicPoint(item.sx, item.c1x, item.c2x, item.tx, q);
    const y = cubicPoint(item.sy, item.c1y, item.c2y, item.ty, q);
    stroke(255, 42, 70, a * (1 - q * 0.4));
    line(x, y, lerp(x, cx, 0.22 + q * 0.2), lerp(y, cy, 0.22 + q * 0.2));
  }
  blendMode(BLEND);
  pop();
}

function drawA1InheritedParticle(item, p) {
  const lp = localProgress(p, item.delay, 0.045);
  if (lp <= 0 || lp >= 1.02) return;
  const q = easeInOutCubic(lp);
  const x = cubicPoint(item.sx, item.c1x, item.c2x, item.tx, q);
  const y = cubicPoint(item.sy, item.c1y, item.c2y, item.ty, q);
  const alpha = min(1, sin(lp * PI) * 1.25) * (item.alpha || 1);
  const w = lerp(item.w0, item.w1, q);
  const h = lerp(item.h0, item.h1, q);
  const txt = q < 0.45 ? item.fromText : item.toText;

  push();
  translate(x, y);
  rotate(item.spin * (q - 0.2) + sin(frameCount * 0.015 + item.seed) * 0.025);
  rectMode(CENTER);
  blendMode(SCREEN);

  if (item.finalKind === 'phase2Card') {
    const corner = lerp(18, 7, q);
    const sourceA = constrain(1 - q * 1.8, 0, 1);
    const targetA = constrain((q - 0.18) / 0.82, 0, 1);

    if (sourceA > 0) drawTinyA1SignalSource(item, 0, 0, item.w0, item.h0, sourceA * alpha);

    noStroke();
    fill(9, 2, 8, 116 * targetA * alpha);
    rect(0, 0, w, h, corner);
    stroke(255, 54, 72, 92 * targetA * alpha);
    strokeWeight(1);
    noFill();
    // old small chip stretches into the cut-corner anxiety2 card language
    const c = min(22, w * 0.1, h * 0.14);
    line(-w / 2, -h / 2 + c, -w / 2, -h / 2);
    line(-w / 2, -h / 2, -w / 2 + c, -h / 2);
    line(w / 2 - c, -h / 2, w / 2, -h / 2);
    line(w / 2, -h / 2, w / 2, -h / 2 + c);
    line(-w / 2, h / 2 - c, -w / 2, h / 2);
    line(-w / 2, h / 2, -w / 2 + c, h / 2);
    line(w / 2 - c, h / 2, w / 2, h / 2);
    line(w / 2, h / 2 - c, w / 2, h / 2);

    noStroke();
    textAlign(LEFT, TOP);
    fill(255, 98, 76, 72 * targetA * alpha);
    textSize(10);
    text(item.fromText, -w * 0.44, -h * 0.43, w * 0.84);
    const cText = phase2TargetKindColor(item.toKind, 150 * targetA * alpha);
    fill(cText);
    textSize(13 + (item.toKind === 'self' ? 2 : 0));
    text(item.toText, -w * 0.44, -h * 0.18, w * 0.84);
    fill(255, 70, 98, 42 * targetA * alpha);
    text(random(PHASE2_NOISE_WORDS), -w * 0.44, h * 0.10, w * 0.84);
  } else if (item.finalKind === 'ringWord') {
    const sourceA = constrain(1 - q * 1.55, 0, 1);
    if (sourceA > 0.02) drawTinyA1SignalSource(item, 0, 0, item.w0, item.h0, sourceA * alpha);

    const textA = constrain((q - 0.22) / 0.78, 0, 1) * alpha;
    noFill();
    stroke(255, 44, 70, 32 * textA);
    strokeWeight(1);
    ellipse(0, 0, max(24, w * 0.52), max(8, h * 1.5));
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(lerp(10, item.toKind === 'self' ? 17 : 13, q));
    fill(phase2TargetKindColor(item.toKind, 164 * textA));
    text(txt, 0, 0, max(38, w));
  } else {
    const r = lerp(max(4, item.w0 * 0.5), max(4, item.w1 * 0.28), q);
    noStroke();
    fill(255, lerp(34, 238, q), lerp(52, 230, q), 92 * alpha);
    circle(0, 0, r);
    noFill();
    stroke(255, 56, 84, 58 * alpha * q);
    ellipse(0, 0, r * 2.6, r * 1.25);
  }

  if (q > 0.35 && random() < 0.065) {
    stroke(255, 238, 230, 42 * alpha);
    line(-w * 0.2, random(-h * 0.35, h * 0.35), w * 0.2, random(-h * 0.35, h * 0.35));
  }

  blendMode(BLEND);
  pop();
}

function drawTinyA1SignalSource(item, x, y, w, h, a) {
  noStroke();
  if (item.sourceKind === 'baitDot' || item.sourceKind === 'iconmetric' || item.sourceKind === 'baitOrb') {
    fill(255, 38, 52, 120 * a);
    circle(x, y, max(5, min(w, h, 28)));
    if (item.icon === 'eye') drawEyeIcon(x, y, max(12, min(w, 24)), color(255, 230, 220, 110 * a));
    else if (item.icon === 'heart') drawHeartIcon(x, y, max(10, min(w, 20)), color(255, 230, 220, 110 * a));
  } else {
    fill(18, 0, 10, 86 * a);
    rect(x, y, max(24, w), max(12, h), 10);
    stroke(255, 52, 70, 80 * a);
    strokeWeight(1);
    noFill();
    rect(x, y, max(24, w), max(12, h), 10);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(10);
    fill(255, 166, 132, 116 * a);
    text(item.fromText, x, y, max(26, w * 0.9));
  }
}


function drawHeartIcon(x, y, s, col) {
  push();
  translate(x, y);
  noStroke();
  fill(col);
  const k = s / 20;
  beginShape();
  vertex(0, 7 * k);
  bezierVertex(-12 * k, -4 * k, -10 * k, -16 * k, 0, -6 * k);
  bezierVertex(10 * k, -16 * k, 12 * k, -4 * k, 0, 7 * k);
  endShape(CLOSE);
  pop();
}

function drawEyeIcon(x, y, s, col) {
  push();
  translate(x, y);
  stroke(col);
  strokeWeight(max(0.8, s * 0.08));
  noFill();
  ellipse(0, 0, s, s * 0.48);
  noStroke();
  fill(col);
  circle(0, 0, s * 0.22);
  pop();
}

function drawA1AssembledEye(state, p, cx, cy, eyeW, eyeH) {
  const ep = constrain((p - 0.36) / 0.58, 0, 1);
  if (ep <= 0) return;
  const q = easeOutCubic(ep);
  push();
  blendMode(SCREEN);
  noFill();
  for (let i = 0; i < 8; i++) {
    const a = (22 - i * 1.6) * q;
    stroke(255, i % 2 ? 54 : 218, i % 2 ? 74 : 170, a);
    strokeWeight(i === 0 ? 1.7 : 0.9);
    const w = eyeW * (0.26 + i * 0.07) * (0.94 + 0.06 * sin(frameCount * 0.018 + i));
    const h = eyeH * (0.34 + i * 0.13) * q;
    ellipse(cx, cy, w, h);
  }
  noStroke();
  fill(6, 0, 7, 104 * q);
  ellipse(cx, cy, eyeH * 0.58, eyeH * 0.72);
  fill(255, 38, 72, 70 * q);
  circle(cx + sin(frameCount * 0.025) * 8, cy, eyeH * 0.12);
  blendMode(BLEND);
  pop();
}

// anxiety2-relief: gaze, cards, and words dissolve into water/light/bloom
function buildGazeToReliefTransform(state, anchors) {
  const centerX = width * 0.5;
  const centerY = height * 0.52;

  for (const a of anchors) {
    if (a.kind === 'phase2Eye') {
      state.rings.push({
        sx: a.x,
        sy: a.y,
        w: a.w,
        h: a.h,
        delay: 0,
        seed: random(9999)
      });
      continue;
    }

    if (a.kind === 'phase2Card') {
      addA2CardFragments(state, a, centerX, centerY);
      continue;
    }

    if (a.kind === 'phase2Word' || a.kind === 'phase2RingWord') {
      addA2WordLetters(state, a, centerX, centerY);
      continue;
    }

    // fallback small red fragments become soft motes
    const angle = random(TAU);
    const radius = random(width * 0.06, max(width, height) * 0.42);
    state.particles.push({
      sx: a.x,
      sy: a.y,
      tx: centerX + cos(angle) * radius,
      ty: centerY + sin(angle) * radius * random(0.55, 0.88),
      c1x: a.x + random(-90, 90),
      c1y: a.y + random(-120, 80),
      c2x: centerX + random(-160, 160),
      c2y: centerY + random(-120, 120),
      sourceKind: a.kind,
      finalKind: 'mote',
      fromText: getAnchorText(a, 1),
      toText: random(RELIEF_WORDS),
      w0: max(8, min(a.w || 40, 180)),
      h0: max(8, min(a.h || 18, 90)),
      w1: random(8, 34),
      h1: random(8, 26),
      delay: random(0, 0.24),
      spin: random(-0.45, 0.45),
      seed: random(9999),
      textKind: a.textKind || 'noise'
    });
  }

  // guarantee the eye-to-ripple gesture even if the eye has not been collected yet
  if (state.rings.length === 0) {
    state.rings.push({ sx: width * 0.5, sy: height * 0.42, w: min(width * 0.84, height * 1.35), h: min(width * 0.84, height * 1.35) * 0.31, delay: 0, seed: random(9999) });
  }

  for (let i = 0; i < 12; i++) {
    state.seams.push({
      y: map(i, 0, 11, height * 0.05, height * 0.96),
      amp: random(14, 52),
      phase: random(TAU),
      delay: random(0.12, 0.42)
    });
  }
}

function addA2CardFragments(state, a, centerX, centerY) {
  const corners = [
    [-1, -1, 0], [1, -1, 1], [1, 1, 2], [-1, 1, 3]
  ];
  for (const c of corners) {
    const sx = a.x + c[0] * a.w * 0.5;
    const sy = a.y + c[1] * a.h * 0.5;
    const angle = atan2(sy - centerY, sx - centerX) + random(-0.35, 0.35);
    const radius = random(width * 0.11, max(width, height) * 0.52);
    const tx = centerX + cos(angle) * radius;
    const ty = centerY + sin(angle) * radius * random(0.52, 0.9);
    state.fragments.push({
      sx, sy, tx, ty,
      c1x: lerp(sx, tx, 0.28) + random(-80, 80),
      c1y: lerp(sy, ty, 0.28) - random(80, 180),
      c2x: lerp(sx, tx, 0.72) + random(-100, 100),
      c2y: lerp(sy, ty, 0.72) + random(-60, 90),
      corner: c[2],
      w0: min(58, a.w * 0.2),
      h0: min(58, a.h * 0.16),
      w1: random(30, 90),
      h1: random(18, 56),
      delay: random(0.04, 0.32),
      seed: random(9999),
      textKind: a.textKind || 'judgement'
    });
  }

  // card body turns into a larger translucent blob, so the rectangular UI frame visibly softens
  const angle = random(TAU);
  const radius = random(width * 0.08, width * 0.35);
  state.particles.push({
    sx: a.x,
    sy: a.y,
    tx: centerX + cos(angle) * radius,
    ty: centerY + sin(angle) * radius * random(0.5, 0.88),
    c1x: a.x + random(-80, 80),
    c1y: a.y - random(60, 180),
    c2x: centerX + random(-120, 120),
    c2y: centerY + random(-140, 120),
    sourceKind: 'phase2CardBody',
    finalKind: 'blob',
    fromText: a.text,
    toText: random(RELIEF_WORDS),
    w0: a.w,
    h0: a.h,
    w1: random(60, 150),
    h1: random(40, 120),
    delay: random(0.06, 0.22),
    spin: random(-0.2, 0.2),
    seed: random(9999),
    textKind: a.textKind || 'judgement'
  });
}

function addA2WordLetters(state, a, centerX, centerY) {
  const sourceText = String(a.text || pickTransformTextForPhase(1));
  const letters = sourceText.slice(0, 18).split('');
  const startSize = a.size || 16;
  const spacing = min(13, startSize * 0.52);
  const total = (letters.length - 1) * spacing;
  for (let i = 0; i < letters.length; i++) {
    const ch = letters[i];
    if (ch === ' ' && random() < 0.3) continue;
    const lx = a.x - total * 0.5 + i * spacing + random(-2, 2);
    const ly = a.y + random(-startSize * 0.18, startSize * 0.18);
    const angle = random(TAU);
    const radius = random(24, max(width, height) * 0.47);
    state.letters.push({
      ch,
      sx: lx,
      sy: ly,
      tx: centerX + cos(angle) * radius,
      ty: centerY + sin(angle) * radius * random(0.52, 0.92),
      c1x: lx + random(-65, 65),
      c1y: ly - random(30, 150),
      c2x: centerX + random(-160, 160),
      c2y: centerY + random(-110, 120),
      startSize,
      endSize: random(2, 7),
      delay: random(0.02, 0.34) + i * 0.006,
      seed: random(9999),
      textKind: a.textKind || 'noise'
    });
  }
}

function drawGazeToReliefTransform(state, p) {
  const q = smoother(p);
  const cx = width * 0.5;
  const cy = height * 0.52;

  push();
  noStroke();
  fill(10, 0, 7, 92 * pow(1 - q, 0.9));
  rect(width * 0.5, height * 0.5, width, height);
  const wash = drawingContext.createRadialGradient(cx, cy, 0, cx, cy, max(width, height) * 0.84);
  wash.addColorStop(0, `rgba(208,246,238,${0.18 * q})`);
  wash.addColorStop(0.42, `rgba(155,214,240,${0.08 * q})`);
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = wash;
  drawingContext.fillRect(0, 0, width, height);
  pop();

  drawA2EyeCollapsingIntoRipple(state, p);
  drawA2RedSyntaxIntoWater(state, p);
  for (const frag of state.fragments) drawA2CornerFragmentToPetal(frag, p);
  for (const item of state.particles) drawA2CardBodyToBlob(item, p);
  for (const letter of state.letters) drawA2LetterToMote(letter, p);
  drawTransitionLabel(state, p, color(210, 246, 238));
}

function drawA2EyeCollapsingIntoRipple(state, p) {
  const eye = state.rings[0];
  const qClose = smoother(constrain(p / 0.48, 0, 1));
  const qRipple = easeOutCubic(constrain((p - 0.32) / 0.68, 0, 1));
  const cx = lerp(eye.sx, width * 0.5, qRipple);
  const cy = lerp(eye.sy, height * 0.52, qRipple);
  const eyeW = eye.w;
  const eyeH = eye.h;

  push();
  blendMode(SCREEN);
  noFill();

  const lidH = lerp(eyeH * 1.25, eyeH * 0.03, qClose);
  stroke(255, 44, 72, 70 * (1 - qRipple));
  strokeWeight(2);
  beginShape();
  vertex(cx - eyeW * 0.48, cy);
  bezierVertex(cx - eyeW * 0.25, cy - lidH, cx + eyeW * 0.25, cy - lidH, cx + eyeW * 0.48, cy);
  bezierVertex(cx + eyeW * 0.25, cy + lidH, cx - eyeW * 0.25, cy + lidH, cx - eyeW * 0.48, cy);
  endShape(CLOSE);

  if (p < 0.54) {
    noStroke();
    fill(0, 0, 0, 150 * (1 - qClose));
    ellipse(cx, cy, eyeH * 0.62 * (1 - qClose * 0.3), eyeH * 0.8 * (1 - qClose * 0.3));
  }

  for (let i = 0; i < 8; i++) {
    const r = lerp(eyeH * (0.35 + i * 0.08), max(width, height) * (0.12 + i * 0.085), qRipple);
    const a = sin(constrain((p - 0.24 - i * 0.025) / 0.76, 0, 1) * PI) * (40 - i * 2.2);
    stroke(lerp(255, 205, qRipple), lerp(45, 246, qRipple), lerp(72, 238, qRipple), max(0, a));
    strokeWeight(max(0.8, 2.6 - i * 0.18));
    ellipse(cx, cy, r * 2, r * 1.48);
  }
  blendMode(BLEND);
  pop();
}

function drawA2RedSyntaxIntoWater(state, p) {
  const q = smoother(constrain((p - 0.16) / 0.7, 0, 1));
  push();
  blendMode(SCREEN);
  noFill();
  for (const seam of state.seams) {
    const lp = localProgress(p, seam.delay, 0.08);
    const a = 30 * sin(lp * PI);
    if (a <= 0) continue;
    stroke(lerp(255, 204, q), lerp(42, 246, q), lerp(70, 238, q), a);
    strokeWeight(lerp(1.1, 2.3, q));
    beginShape();
    for (let x = -40; x <= width + 40; x += 16) {
      const anxiousY = seam.y + sin(x * 0.015 + seam.phase + frameCount * 0.024) * seam.amp;
      const waterY = seam.y + sin(x * 0.006 + seam.phase + frameCount * 0.006) * (seam.amp * 0.28 + 8);
      curveVertex(x, lerp(anxiousY, waterY, q));
    }
    endShape();
  }
  blendMode(BLEND);
  pop();
}

function drawA2CornerFragmentToPetal(frag, p) {
  const lp = localProgress(p, frag.delay, 0.06);
  if (lp <= 0 || lp >= 1.02) return;
  const q = easeInOutCubic(lp);
  const x = cubicPoint(frag.sx, frag.c1x, frag.c2x, frag.tx, q);
  const y = cubicPoint(frag.sy, frag.c1y, frag.c2y, frag.ty, q);
  const a = min(1, sin(lp * PI) * 1.2);
  const w = lerp(frag.w0, frag.w1, q);
  const h = lerp(frag.h0, frag.h1, q);

  push();
  translate(x, y);
  rotate(sin(frameCount * 0.01 + frag.seed) * 0.08 + q * (frag.corner - 1.5) * 0.45);
  blendMode(SCREEN);
  noFill();
  strokeWeight(lerp(1.1, 2.0, q));

  if (q < 0.56) {
    stroke(255, 44, 72, 90 * a * (1 - q * 0.45));
    const l = w * 0.72;
    const sx = frag.corner === 0 || frag.corner === 3 ? 1 : -1;
    const sy = frag.corner < 2 ? 1 : -1;
    line(0, 0, sx * l, 0);
    line(0, 0, 0, sy * h * 0.9);
  }

  if (q > 0.16) {
    const soft = constrain((q - 0.16) / 0.84, 0, 1) * a;
    stroke(204, 246, 238, 62 * soft);
    beginShape();
    for (let i = 0; i < 18; i++) {
      const aa = map(i, 0, 17, 0, TAU);
      const rr = 0.48 + noise(frag.seed, i * 0.12, frameCount * 0.004) * 0.25;
      curveVertex(cos(aa) * w * rr, sin(aa) * h * rr);
    }
    endShape(CLOSE);
  }
  blendMode(BLEND);
  pop();
}

function drawA2CardBodyToBlob(item, p) {
  const lp = localProgress(p, item.delay, 0.07);
  if (lp <= 0 || lp >= 1.02) return;
  const q = easeInOutCubic(lp);
  const x = cubicPoint(item.sx, item.c1x, item.c2x, item.tx, q);
  const y = cubicPoint(item.sy, item.c1y, item.c2y, item.ty, q);
  const a = min(1, sin(lp * PI) * 1.15);
  const w = lerp(item.w0, item.w1, q);
  const h = lerp(item.h0, item.h1, q);

  push();
  translate(x, y);
  rotate(item.spin * (1 - q));
  blendMode(SCREEN);
  rectMode(CENTER);

  const rectA = constrain(1 - q * 1.35, 0, 1) * a;
  if (rectA > 0) {
    noStroke();
    fill(9, 0, 8, 80 * rectA);
    rect(0, 0, w, h, 10);
    stroke(255, 42, 72, 80 * rectA);
    strokeWeight(1);
    noFill();
    rect(0, 0, w, h, 10);
    noStroke();
    fill(255, 236, 238, 120 * rectA);
    textAlign(CENTER, CENTER);
    textSize(12);
    text(item.fromText, 0, 0, max(40, w * 0.82));
  }

  const soft = constrain((q - 0.18) / 0.82, 0, 1) * a;
  if (soft > 0) {
    noStroke();
    const ctx = drawingContext;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, max(w, h));
    grad.addColorStop(0, `rgba(210,246,238,${0.18 * soft})`);
    grad.addColorStop(0.5, `rgba(170,220,255,${0.09 * soft})`);
    grad.addColorStop(1, 'rgba(210,246,238,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.74, h * 0.62, sin(frameCount * 0.006 + item.seed) * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  blendMode(BLEND);
  pop();
}

function drawA2LetterToMote(letter, p) {
  const lp = localProgress(p, letter.delay, 0.08);
  if (lp <= 0 || lp >= 1.02) return;
  const q = easeInOutCubic(lp);
  const x = cubicPoint(letter.sx, letter.c1x, letter.c2x, letter.tx, q);
  const y = cubicPoint(letter.sy, letter.c1y, letter.c2y, letter.ty, q);
  const a = min(1, sin(lp * PI) * 1.25);
  const s = lerp(letter.startSize, letter.endSize, q);

  push();
  translate(x, y);
  rotate(sin(frameCount * 0.012 + letter.seed) * 0.25 * (1 - q));
  blendMode(SCREEN);
  textAlign(CENTER, CENTER);
  textSize(s);
  if (q < 0.62) {
    fill(phase2TargetKindColor(letter.textKind, 172 * a * (1 - q * 0.35)));
    text(letter.ch, 0, 0);
  }
  if (q > 0.28) {
    const soft = constrain((q - 0.28) / 0.72, 0, 1) * a;
    noStroke();
    fill(210, 246, 238, 82 * soft);
    circle(0, 0, max(2, s * 0.8));
    fill(255, 236, 210, 36 * soft);
    circle(sin(letter.seed) * 7, cos(letter.seed) * 5, max(1, s * 0.36));
  }
  blendMode(BLEND);
  pop();
}

// relief-anxiety1: calm light contracts into notification/feed pressure
function buildReliefToFeedTransform(state, anchors) {
  for (const a of anchors) {
    if (a.kind === 'reliefRipple') {
      state.rings.push({ sx: a.x, sy: a.y, r0: max(20, a.w * 0.5), delay: random(0.02, 0.18), seed: random(9999) });
      continue;
    }

    const targetText = pickTransformTextForPhase(0);
    const mode = a.kind === 'reliefBlob' ? 'blobToDotCluster' : a.kind === 'reliefWord' ? 'wordToBadge' : random(['moteToDot', 'moteToChip', 'moteToDot']);
    const tx = random(width * 0.08, width * 0.92);
    const ty = random(height * 0.08, height * 0.92);
    const targetW = mode === 'wordToBadge' || mode === 'moteToChip' ? max(48, targetText.length * random(6.0, 7.2)) : random(6, 22);
    const targetH = mode === 'wordToBadge' || mode === 'moteToChip' ? random(18, 32) : targetW;

    state.particles.push({
      sx: a.x,
      sy: a.y,
      tx,
      ty,
      c1x: lerp(a.x, tx, 0.25) + random(-110, 110),
      c1y: lerp(a.y, ty, 0.25) + random(-140, 100),
      c2x: lerp(a.x, tx, 0.78) + random(-70, 70),
      c2y: lerp(a.y, ty, 0.78) + random(-80, 90),
      sourceKind: a.kind,
      finalKind: mode,
      fromText: getAnchorText(a, 2),
      toText: targetText,
      w0: max(4, min(a.w || 20, width * 0.3)),
      h0: max(4, min(a.h || 20, height * 0.26)),
      w1: targetW,
      h1: targetH,
      delay: random(0, 0.25),
      spin: random(-0.75, 0.75),
      seed: random(9999),
      alpha: a.alpha || 0.7
    });
  }

  if (state.rings.length < 3) {
    for (let i = 0; i < 5; i++) state.rings.push({ sx: width * 0.5, sy: height * 0.52, r0: min(width, height) * (0.15 + i * 0.08), delay: i * 0.04, seed: random(9999) });
  }

  for (let i = 0; i < 8; i++) {
    state.seams.push({
      y: map(i, 0, 7, -height * 0.08, height * 1.08),
      phase: random(TAU),
      delay: random(0.26, 0.62),
      amp: random(10, 28)
    });
  }
}

function drawReliefToFeedTransform(state, p) {
  const q = smoother(p);
  push();
  noStroke();
  fill(1, 0, 3, 30 + 108 * q);
  rect(width * 0.5, height * 0.5, width, height);
  pop();

  drawReliefRingsCompressing(state, p);
  for (const item of state.particles) drawReliefParticleToFeedSignal(item, p);
  drawFeedRefreshReappearing(state, p);
  drawTransitionLabel(state, p, color(255, 80, 92));
}

function drawReliefRingsCompressing(state, p) {
  push();
  blendMode(SCREEN);
  noFill();
  for (const ring of state.rings) {
    const lp = localProgress(p, ring.delay, 0.04);
    if (lp <= 0 || lp >= 1.02) continue;
    const q = easeInCubic(lp);
    const r = lerp(ring.r0, 10, q);
    const a = 42 * sin(lp * PI);
    stroke(lerp(206, 255, q), lerp(246, 44, q), lerp(238, 62, q), a);
    strokeWeight(lerp(2.2, 1.0, q));
    ellipse(ring.sx, ring.sy, r * 2, r * 1.4);
    if (q > 0.78) {
      noStroke();
      fill(255, 34, 52, 80 * (q - 0.78) / 0.22);
      circle(ring.sx, ring.sy, 7 + sin(frameCount * 0.1 + ring.seed) * 2);
      noFill();
    }
  }
  blendMode(BLEND);
  pop();
}

function drawReliefParticleToFeedSignal(item, p) {
  const lp = localProgress(p, item.delay, 0.05);
  if (lp <= 0 || lp >= 1.02) return;
  const q = easeInOutCubic(lp);
  const x = cubicPoint(item.sx, item.c1x, item.c2x, item.tx, q);
  const y = cubicPoint(item.sy, item.c1y, item.c2y, item.ty, q);
  const a = min(1, sin(lp * PI) * 1.2) * (item.alpha || 1);
  const w = lerp(item.w0, item.w1, q);
  const h = lerp(item.h0, item.h1, q);

  push();
  translate(x, y);
  rotate(item.spin * q);
  blendMode(SCREEN);
  rectMode(CENTER);

  const softA = constrain(1 - q * 1.35, 0, 1) * a;
  if (softA > 0) {
    noStroke();
    fill(206, 246, 238, 46 * softA);
    ellipse(0, 0, max(8, item.w0 * (1 - q * 0.35)), max(6, item.h0 * (1 - q * 0.35)));
    if (item.sourceKind === 'reliefWord') {
      fill(220, 242, 246, 80 * softA);
      textAlign(CENTER, CENTER);
      textSize(lerp(item.h0, 12, q));
      text(item.fromText, 0, 0, max(40, item.w0));
    }
  }

  const signalA = constrain((q - 0.18) / 0.82, 0, 1) * a;
  if (item.finalKind === 'wordToBadge' || item.finalKind === 'moteToChip') {
    noStroke();
    fill(18, 0, 10, 86 * signalA);
    rect(0, 0, max(30, w), max(13, h), lerp(18, 8, q));
    stroke(255, 48, 66, 86 * signalA);
    strokeWeight(1);
    noFill();
    rect(0, 0, max(30, w), max(13, h), lerp(18, 8, q));
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(lerp(10, 12, q));
    fill(255, 214, 198, 138 * signalA);
    text(q < 0.45 ? item.fromText : item.toText, 0, 0, max(34, w * 0.9));
  } else if (item.finalKind === 'blobToDotCluster') {
    noStroke();
    const dots = 5;
    for (let i = 0; i < dots; i++) {
      const a2 = i / dots * TAU + item.seed;
      const d = lerp(max(10, w * 0.28), 9 + i * 1.5, q);
      fill(255, 34 + i * 14, 52, 74 * signalA);
      circle(cos(a2) * d * 0.35, sin(a2) * d * 0.35, lerp(18, 5, q));
    }
  } else {
    noStroke();
    fill(255, 35, 54, 118 * signalA);
    circle(0, 0, max(4, lerp(max(w, h), 7, q)));
    fill(255, 222, 210, 110 * signalA);
    circle(-1, -1, max(1, lerp(max(w, h) * 0.25, 2, q)));
  }

  blendMode(BLEND);
  pop();
}

function drawFeedRefreshReappearing(state, p) {
  const q = smoother(constrain((p - 0.46) / 0.54, 0, 1));
  if (q <= 0) return;
  push();
  blendMode(SCREEN);
  noFill();
  for (const seam of state.seams) {
    const lp = localProgress(p, seam.delay, 0.02);
    const a = 36 * q * sin(lp * PI);
    if (a <= 0) continue;
    stroke(255, 34, 54, a);
    strokeWeight(1.0 + q * 0.6);
    beginShape();
    for (let x = -40; x <= width + 40; x += 18) {
      const y = seam.y + q * height * 0.18 + sin(x * 0.008 + seam.phase + frameCount * 0.017) * seam.amp;
      curveVertex(x, y);
    }
    endShape();
  }
  // red dots restart as a recognisable anxiety1 motif
  for (let i = 0; i < 10; i++) {
    const x = noise(state.seed, i * 13.7) * width;
    const y = noise(state.seed + 100, i * 9.1) * height;
    noStroke();
    fill(255, 35, 54, 42 * q * (0.4 + noise(i, frameCount * 0.04)));
    circle(x, y, 3 + 4 * noise(i * 2, frameCount * 0.06));
  }
  blendMode(BLEND);
  pop();
}

function buildGenericTransform(state, anchors) {
  for (const a of anchors) {
    state.particles.push({
      sx: a.x,
      sy: a.y,
      tx: random(width * 0.08, width * 0.92),
      ty: random(height * 0.08, height * 0.92),
      c1x: a.x + random(-140, 140),
      c1y: a.y + random(-140, 140),
      c2x: random(width * 0.1, width * 0.9),
      c2y: random(height * 0.1, height * 0.9),
      fromText: getAnchorText(a, state.from),
      toText: pickTransformTextForPhase(state.to),
      sourceKind: a.kind,
      finalKind: 'generic',
      delay: random(0, 0.24),
      size: random(8, 20),
      w0: max(8, min(140, a.w || 40)),
      h0: max(5, min(80, a.h || 20)),
      w1: random(16, 120),
      h1: random(8, 54),
      spin: random(-0.6, 0.6),
      seed: random(9999)
    });
  }
}

function drawPhaseTransform() {
  if (!transitionState) return;

  transitionState.age += deltaTime / 1000;
  const p = constrain(transitionState.age / transitionState.duration, 0, 1);

  if (transitionState.key === '0-1') drawFeedToGazeTransform(transitionState, p);
  else if (transitionState.key === '1-2') drawGazeToReliefTransform(transitionState, p);
  else if (transitionState.key === '2-0') drawReliefToFeedTransform(transitionState, p);
  else drawGenericPhaseTransform(transitionState, p);

  if (p >= 1) transitionState = null;
}

function drawGenericPhaseTransform(state, p) {
  push();
  noStroke();
  fill(0, 0, 0, 120 * sin(p * PI));
  rect(width * 0.5, height * 0.5, width, height);
  pop();
  for (const item of state.particles) drawReliefParticleToFeedSignal(item, p);
  drawTransitionLabel(state, p, color(255, 220, 210));
}

function drawTransitionLabel(state, p, col) {
  if (uiEl && uiEl.classList.contains('hidden')) return;
  const a = 115 * sin(p * PI);
  if (a <= 1) return;
  push();
  textAlign(LEFT, CENTER);
  textSize(11);
  noStroke();
  fill(red(col), green(col), blue(col), a);
  text(state.label, 18, height - 22);
  pop();
}

function drawTransitionVeil() {
  // a very light grain that helps projection hide banding; intentionally not a transition itself
  push();
  noStroke();
  for (let i = 0; i < 26; i++) {
    fill(255, 3);
    rect(random(width), random(height), random(1, 2), random(1, 2));
  }
  pop();
}

function setPhase(nextPhase) {
  if (nextPhase === phase && !transitionState) {
    initPhase(phase);
    showUI();
    return;
  }

  const fromPhase = phase;
  transitionState = createPhaseTransform(fromPhase, nextPhase);
  phase = nextPhase;
  initPhase(phase);
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
  transitionState = null;
  initScene();
}