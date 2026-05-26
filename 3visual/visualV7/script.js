let phase = 0; // 0 = anxiety_1, 1 = anxiety_2, 2 = relief

let uiEl;
let uiHideTimer = 7;

// anxiety 1
let stage1Elements = [];
let stage1SpawnTimer = 0;
let stage1GhostOffset = 0;

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


// anxiety 1
function drawStage1() {
  drawStage1Background();
  drawStage1RefreshTide();
  drawStage1SignalMist();
  updateStage1Elements();
  drawStage1BaitLinks();
  drawStage1Elements();
  drawStage1Vignette();
  drawTransitionVeil();
}

function drawStage1Background() {
  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, '#08030a');
  g.addColorStop(0.34, '#10050d');
  g.addColorStop(0.68, '#08050b');
  g.addColorStop(1, '#020203');
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);

  const t = frameCount * 0.01;
  const glowA = drawingContext.createRadialGradient(
    width * (0.18 + sin(t * 0.7) * 0.03),
    height * (0.24 + cos(t * 0.9) * 0.03),
    0,
    width * 0.2,
    height * 0.25,
    max(width, height) * 0.62
  );
  glowA.addColorStop(0, 'rgba(255,28,45,0.11)');
  glowA.addColorStop(0.32, 'rgba(150,0,85,0.055)');
  glowA.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = glowA;
  drawingContext.fillRect(0, 0, width, height);

  const glowB = drawingContext.createRadialGradient(
    width * 0.78,
    height * (0.72 + sin(t * 0.8) * 0.03),
    0,
    width * 0.78,
    height * 0.72,
    max(width, height) * 0.5
  );
  glowB.addColorStop(0, 'rgba(255,94,20,0.07)');
  glowB.addColorStop(0.42, 'rgba(82,0,120,0.045)');
  glowB.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = glowB;
  drawingContext.fillRect(0, 0, width, height);
}

function drawStage1RefreshTide() {
  push();
  blendMode(SCREEN);
  noStroke();

  const bandCount = 7;
  const spacing = height / (bandCount - 1);
  for (let i = 0; i < bandCount; i++) {
    const speed = 0.42 + i * 0.035;
    const y = ((frameCount * speed + i * spacing * 1.43) % (height + spacing * 1.5)) - spacing * 0.75;
    const amp = 12 + i * 2.2;
    const bandH = 28 + i * 5;
    const alpha = 9 + i * 1.2;

    fill(255, 48, 48, alpha);
    beginShape();
    for (let x = -40; x <= width + 40; x += 28) {
      const wave = sin(x * 0.009 + frameCount * 0.018 + i * 0.8) * amp + noise(x * 0.004, i, frameCount * 0.006) * 8;
      vertex(x, y + wave);
    }
    for (let x = width + 40; x >= -40; x -= 28) {
      const wave = sin(x * 0.009 + frameCount * 0.018 + i * 0.8) * amp + noise(x * 0.004, i, frameCount * 0.006) * 8;
      vertex(x, y + bandH + wave * 0.55);
    }
    endShape(CLOSE);

    stroke(255, 170, 128, alpha * 1.7);
    strokeWeight(1);
    noFill();
    beginShape();
    for (let x = -40; x <= width + 40; x += 24) {
      const wave = sin(x * 0.012 + frameCount * 0.022 + i) * (amp * 0.6);
      vertex(x, y + wave);
    }
    endShape();
    noStroke();
  }

  for (let i = 0; i < 64; i++) {
    const n = noise(i * 17.2, frameCount * 0.009);
    const x = (i / 63) * width + sin(frameCount * 0.01 + i) * 12;
    const y = (frameCount * (0.7 + n * 1.2) + i * 61) % (height + 120) - 60;
    const h = 24 + n * 76;
    fill(255, 42, 56, 5 + n * 14);
    rect(x, y, 1.5 + n * 2.2, h, 3);
  }

  const sweepY = (frameCount * 1.45) % (height + 260) - 130;
  const beam = drawingContext.createLinearGradient(0, sweepY - 100, 0, sweepY + 100);
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(0.42, 'rgba(255,60,70,0.025)');
  beam.addColorStop(0.5, 'rgba(255,195,165,0.07)');
  beam.addColorStop(0.58, 'rgba(255,60,70,0.025)');
  beam.addColorStop(1, 'rgba(255,255,255,0)');
  drawingContext.fillStyle = beam;
  drawingContext.fillRect(0, sweepY - 100, width, 200);

  pop();
}

function drawStage1SignalMist() {
  push();
  blendMode(SCREEN);
  noStroke();
  for (let i = 0; i < 120; i++) {
    const x = noise(i * 13.1, stage1GhostOffset) * width;
    const y = (noise(i * 8.9, stage1GhostOffset + 40) * height + frameCount * (0.05 + noise(i) * 0.1)) % height;
    const flicker = noise(i * 3.7, frameCount * 0.035);
    fill(255, 28, 44, 5 + flicker * 18);
    circle(x, y, 1.2 + flicker * 3.8);
  }
  pop();
}

function updateStage1Elements() {
  stage1SpawnTimer -= deltaTime / 1000;
  if (stage1SpawnTimer <= 0) {
    spawnStage1Burst();
    stage1SpawnTimer = random(0.035, 0.09);
  }

  for (let i = stage1Elements.length - 1; i >= 0; i--) {
    const e = stage1Elements[i];
    e.life -= deltaTime / 1000;
    e.age += deltaTime / 1000;
    e.x += e.vx * deltaTime / 1000;
    e.y += e.vy * deltaTime / 1000;

    if (e.type === 'baitDot' || e.type === 'baitOrb') {
      e.pulse += deltaTime / 1000 * e.pulseSpeed;
      e.y += sin(frameCount * 0.015 + e.seed) * 0.08;
    }

    if (e.type === 'baitGlyph') {
      e.x += sin(frameCount * 0.02 + e.seed) * 0.12;
    }

    if (e.type === 'baitFrame') {
      e.w += sin(frameCount * 0.035 + e.seed) * 0.15;
      e.h += cos(frameCount * 0.032 + e.seed) * 0.12;
    }

    if (e.x < -120 || e.x > width + 120 || e.y < -120 || e.y > height + 120 || e.life <= 0) {
      stage1Elements.splice(i, 1);
    }
  }
}

function spawnStage1Burst() {
  const maxCount = floor(map(width * height, 300000, 3000000, 70, 135, true));
  if (stage1Elements.length > maxCount) return;

  const clusterX = random(width * 0.08, width * 0.92);
  const clusterY = random(height * 0.1, height * 0.9);
  const burst = random() < 0.72;
  const dotNum = burst ? floor(random(2, 6)) : 1;

  for (let i = 0; i < dotNum; i++) {
    spawnBaitDot(clusterX + random(-58, 58), clusterY + random(-46, 46), random() < 0.13);
  }

  const r = random();
  if (r < 0.34) spawnBaitGlyph(clusterX + random(-42, 42), clusterY + random(-32, 32));
  else if (r < 0.51) spawnBaitFrame(clusterX, clusterY);
  else if (r < 0.62) spawnBaitOrb(clusterX, clusterY);
}

function spawnBaitDot(x, y, symbol = false) {
  const ttl = random(0.7, 1.75);
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
    symbolType: random(['heart', 'eye', '@', '?', '+'])
  });
}

function spawnBaitOrb(x, y) {
  const ttl = random(0.9, 1.35);
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
    mode: random(['ring', 'eye', 'target'])
  });
}

function spawnBaitGlyph(x, y) {
  const ttl = random(0.45, 1.05);
  const fragments = ['@', 'seen', '...', '+23', '0.7', 'now', 'tap', 'new', 'ping', 'live', 'view?', 'again', 'wait', 'pull'];
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
    hot: random() < 0.36
  });
}

function spawnBaitFrame(x, y) {
  const ttl = random(0.55, 1.05);
  stage1Elements.push({
    type: 'baitFrame',
    x, y,
    ttl, life: ttl,
    age: 0,
    w: random(42, 130),
    h: random(28, 92),
    vx: random(-7, 7),
    vy: random(-13, -2),
    seed: random(9999)
  });
}

function fadeElement(life, ttl) {
  const fadeIn = constrain((ttl - life) / (ttl * 0.18), 0, 1);
  const fadeOut = constrain(life / (ttl * 0.32), 0, 1);
  return min(fadeIn, fadeOut);
}

function drawStage1BaitLinks() {
  const nodes = stage1Elements.filter(e => e.type === 'baitDot' || e.type === 'baitOrb');
  const maxLinks = 28;
  let linkCount = 0;

  push();
  blendMode(SCREEN);
  strokeWeight(1);
  for (let i = 0; i < nodes.length && linkCount < maxLinks; i++) {
    for (let j = i + 1; j < nodes.length && linkCount < maxLinks; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 135 && random() < 0.48) {
        const fa = fadeElement(a.life, a.ttl);
        const fb = fadeElement(b.life, b.ttl);
        const alpha = map(d, 0, 135, 45, 0) * min(fa, fb);
        stroke(255, 45, 52, alpha);
        line(a.x, a.y, b.x, b.y);
        linkCount++;
      }
    }
  }
  pop();
}

function drawStage1Elements() {
  for (const e of stage1Elements) {
    const a = fadeElement(e.life, e.ttl);
    if (e.type === 'baitDot') drawBaitDot(e, a);
    else if (e.type === 'baitOrb') drawBaitOrb(e, a);
    else if (e.type === 'baitGlyph') drawBaitGlyph(e, a);
    else if (e.type === 'baitFrame') drawBaitFrame(e, a);
  }
}

function drawBaitDot(e, a) {
  push();
  translate(e.x, e.y);
  blendMode(SCREEN);
  noStroke();

  const pulse = map(sin(e.pulse), -1, 1, 0.55, 1.3);
  const hot = noise(e.seed, frameCount * 0.04) > 0.76;
  const outer = e.r * (3.2 + pulse * 2.2);

  const grad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, outer);
  grad.addColorStop(0, `rgba(255,220,178,${0.42 * a})`);
  grad.addColorStop(0.18, `rgba(255,36,44,${0.55 * a})`);
  grad.addColorStop(0.52, `rgba(255,0,96,${0.18 * a})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = grad;
  ellipse(0, 0, outer * 2, outer * 2);

  fill(hot ? color(255, 190, 72, 230 * a) : color(255, 35, 47, 230 * a));
  circle(0, 0, e.r * pulse);

  stroke(255, 76, 72, 82 * a);
  strokeWeight(1);
  noFill();
  circle(0, 0, e.r * (2.2 + pulse * 2.4));

  if (e.symbol) drawTinySignalSymbol(e.symbolType, a);
  pop();
}

function drawBaitOrb(e, a) {
  push();
  translate(e.x, e.y);
  blendMode(SCREEN);
  noStroke();
  const pulse = map(sin(e.pulse), -1, 1, 0.75, 1.22);

  const grad = drawingContext.createRadialGradient(0, 0, 0, 0, 0, e.r * 3.6);
  grad.addColorStop(0, `rgba(255,170,92,${0.18 * a})`);
  grad.addColorStop(0.28, `rgba(255,20,48,${0.24 * a})`);
  grad.addColorStop(0.68, `rgba(136,0,80,${0.14 * a})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = grad;
  ellipse(0, 0, e.r * 7.2, e.r * 7.2);

  if (e.mode === 'eye') {
    stroke(255, 82, 72, 150 * a);
    strokeWeight(1.5);
    noFill();
    ellipse(0, 0, e.r * 2.1 * pulse, e.r * 0.95 * pulse);
    noStroke();
    fill(255, 32, 44, 215 * a);
    circle(0, 0, e.r * 0.48 * pulse);
    fill(255, 212, 160, 180 * a);
    circle(e.r * 0.08, -e.r * 0.08, e.r * 0.14);
  } else {
    stroke(255, 50, 50, 120 * a);
    noFill();
    strokeWeight(1.1);
    for (let i = 0; i < 3; i++) circle(0, 0, e.r * (1.1 + i * 0.7) * pulse);
    noStroke();
    fill(255, 35, 45, 190 * a);
    circle(0, 0, e.r * 0.38 * pulse);
  }
  pop();
}

function drawBaitGlyph(e, a) {
  push();
  translate(e.x, e.y);
  blendMode(SCREEN);
  textAlign(CENTER, CENTER);
  textSize(e.size);
  textStyle(e.hot ? BOLD : NORMAL);
  noStroke();
  fill(e.hot ? color(255, 177, 76, 220 * a) : color(255, 64, 64, 185 * a));
  text(e.text, 0, 0);
  fill(255, 230, 215, 60 * a);
  text(e.text, random(-1.5, 1.5), random(-1.5, 1.5));
  pop();
}

function drawBaitFrame(e, a) {
  push();
  translate(e.x, e.y);
  blendMode(SCREEN);
  noFill();
  stroke(255, 60, 62, 130 * a);
  strokeWeight(1.2);
  const cw = min(18, e.w * 0.22);
  const ch = min(18, e.h * 0.3);
  const x1 = -e.w * 0.5;
  const x2 = e.w * 0.5;
  const y1 = -e.h * 0.5;
  const y2 = e.h * 0.5;
  line(x1, y1, x1 + cw, y1); line(x1, y1, x1, y1 + ch);
  line(x2, y1, x2 - cw, y1); line(x2, y1, x2, y1 + ch);
  line(x1, y2, x1 + cw, y2); line(x1, y2, x1, y2 - ch);
  line(x2, y2, x2 - cw, y2); line(x2, y2, x2, y2 - ch);

  if (noise(e.seed, frameCount * 0.05) > 0.62) {
    noStroke();
    fill(255, 184, 112, 90 * a);
    rect(0, -e.h * 0.5 - 8, e.w * 0.35, 2, 1);
  }
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
  vignette.addColorStop(0.58, 'rgba(0,0,0,0.12)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.72)');
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