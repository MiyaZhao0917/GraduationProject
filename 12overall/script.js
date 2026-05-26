let phase = 0; // 0 = anxiety_1, 1 = anxiety_2, 2 = relief

// Arduino / Web Serial
let serialBtnEl;
let serialStatusEl;
let serialPort = null;
let serialReader = null;
let serialReadableClosed = null;
let serialKeepReading = false;
let serialLineBuffer = '';
const sensorState = { pir: 0, button: 0 };

// Arduino command output
let serialWriteQueue = Promise.resolve();

function sendArduinoCommand(command) {
  if (!serialPort || !serialPort.writable) return;

  serialWriteQueue = serialWriteQueue
    .then(async () => {
      if (!serialPort || !serialPort.writable) return;

      const writer = serialPort.writable.getWriter();
      try {
        await writer.write(new TextEncoder().encode(`${command}\n`));
      } catch (err) {
        console.warn('Serial write failed:', err);
      } finally {
        try {
          writer.releaseLock();
        } catch (err) {}
      }
    })
    .catch((err) => {
      console.warn('Serial write queue failed:', err);
    });
}

function sendServoMode(mode) {
  // valid values handled by Arduino:
  // SERVO:A1   = anxiety1 subtle occasional movement
  // SERVO:A2   = anxiety2 stronger movement
  // SERVO:STOP = return to stop and stay still
  sendArduinoCommand(`SERVO:${mode}`);
}

function syncServoToCurrentVisualState() {
  if (!serialPort) return;

  if (transitionState) {
    // during anxiety2-relief transition, the tray should already be still
    if (transitionState.from === 1 && transitionState.to === 2) sendServoMode('STOP');
    // during anxiety1-anxiety2 transition, keep anixety1 subtle mode until the animation commits
    else if (transitionState.from === 0 && transitionState.to === 1) sendServoMode('A1');
    return;
  }

  if (phase === 0) sendServoMode('A1');
  else if (phase === 1) sendServoMode('A2');
  else if (phase === 2) sendServoMode('STOP');
}


let uiEl;
let uiHideTimer = 0;
let uiPinnedVisible = false;


let transitionState = null;


// sound layer
const SOUND_PATHS = {
  pop: 'pop.mp3',
  interface: 'interface.mp3',
  glitch: 'glitch.mp3',
  typing: 'typing.mp3',
  transfer1: 'transfer1.mp3',
  radio: 'radio.mp3',
  heartbeat: 'heartbeat.mp3',
  transfer2: 'transfer2.mp3',
  relax: 'relax.mp3',
  flower1: 'flower1.mp3',
  flower2: 'flower2.mp3',
  flower3: 'flower3.mp3',
  waterdrop: 'waterdrop.mp3'
};

const SOUND_SETTINGS = {
  pop: { volume: 0.42, throttle: 180, poolSize: 6 },
  interface: { volume: 0.34, throttle: 260, poolSize: 5 },
  glitch: { volume: 0.26, throttle: 420, poolSize: 4 },
  typing: { volume: 0.36, throttle: 520, poolSize: 4 },
  transfer1: { volume: 0.72, throttle: 900, poolSize: 1 },
  radio: { volume: 0.28, throttle: 1000, poolSize: 1 },
  heartbeat: { volume: 0.45, throttle: 950, poolSize: 3 },
  transfer2: { volume: 0.74, throttle: 900, poolSize: 1 },
  relax: { volume: 0.42, throttle: 1000, poolSize: 1 },
  flower1: { volume: 0.34, throttle: 650, poolSize: 3 },
  flower2: { volume: 0.34, throttle: 650, poolSize: 3 },
  flower3: { volume: 0.34, throttle: 650, poolSize: 3 },
  waterdrop: { volume: 0.32, throttle: 850, poolSize: 4 }
};

let soundUnlocked = false;
let soundLibrary = {};
let lastSoundAt = {};
let activeTransferAudio = null;
let nextStage2HeartbeatAt = 0;
let reliefRelaxStarted = false;

function setupSoundLayer() {
  soundLibrary = {};

  for (const name of Object.keys(SOUND_PATHS)) {
    const setting = SOUND_SETTINGS[name];
    const pool = [];
    for (let i = 0; i < setting.poolSize; i++) {
      const audio = new Audio(SOUND_PATHS[name]);
      audio.preload = 'auto';
      audio.volume = setting.volume;
      if (name === 'radio') audio.loop = true;
      pool.push(audio);
    }
    soundLibrary[name] = { pool, index: 0 };
    lastSoundAt[name] = -999999;
  }

  window.addEventListener('pointerdown', unlockSoundLayer, { once: true });
  window.addEventListener('keydown', unlockSoundLayer, { once: true });
}

function unlockSoundLayer() {
  if (soundUnlocked) return;
  soundUnlocked = true;

  for (const item of Object.values(soundLibrary)) {
    for (const audio of item.pool) {
      try {
        audio.muted = true;
        const promise = audio.play();
        if (promise && typeof promise.then === 'function') {
          promise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = false;
            })
            .catch(() => {
              audio.muted = false;
            });
        } else {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        }
      } catch (err) {
        audio.muted = false;
      }
    }
  }
}

function playSound(name, options = {}) {
  if (!soundUnlocked || !soundLibrary[name]) return;

  const setting = SOUND_SETTINGS[name];
  const chance = options.chance ?? 1;
  if (Math.random() > chance) return;

  const now = (typeof millis === 'function') ? millis() : performance.now();
  const throttle = options.throttle ?? setting.throttle;
  if (!options.force && now - lastSoundAt[name] < throttle) return;
  lastSoundAt[name] = now;

  const item = soundLibrary[name];
  let audio;

  if (options.interrupt) {
    audio = item.pool[0];
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (err) {}
  } else {
    audio = item.pool.find(a => a.paused || a.ended);
    if (!audio) {
      audio = item.pool[item.index % item.pool.length];
      item.index++;
    }
    try {
      audio.currentTime = 0;
    } catch (err) {}
  }

  audio.volume = options.volume ?? setting.volume;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }

  if (name === 'transfer1' || name === 'transfer2') activeTransferAudio = audio;
}

function playStage1Sound(name, chance = 1) {
  if (phase !== 0 || transitionState) return;
  playSound(name, { chance });
}

function playTransferSound(fromPhase, toPhase) {
  if (fromPhase === 0 && toPhase === 1) {
    playSound('transfer1', { force: true, interrupt: true });
  }
  if (fromPhase === 1 && toPhase === 2) {
    playSound('transfer2', { force: true, interrupt: true });
  }
}

function stopSoundPool(name) {
  const item = soundLibrary[name];
  if (!item) return;

  for (const audio of item.pool) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (err) {}
  }
}

function stopStage1Sounds() {
  stopSoundPool('pop');
  stopSoundPool('interface');
  stopSoundPool('glitch');
  stopSoundPool('typing');
}

function startStage2RadioLoop() {
  if (!soundUnlocked || !soundLibrary.radio) return;

  const audio = soundLibrary.radio.pool[0];
  if (!audio) return;

  audio.loop = true;
  audio.volume = SOUND_SETTINGS.radio.volume;

  if (audio.paused || audio.ended) {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }
}

function updateStage2HeartbeatSound() {
  if (!soundUnlocked || phase !== 1 || transitionState) return;

  const now = (typeof millis === 'function') ? millis() : performance.now();
  if (!nextStage2HeartbeatAt || now >= nextStage2HeartbeatAt) {
    playSound('heartbeat', {
      force: true,
      volume: random(0.32, 0.5)
    });
    nextStage2HeartbeatAt = now + random(2800, 7600);
  }
}

function stopStage2Sounds() {
  stopSoundPool('radio');
  stopSoundPool('heartbeat');
  nextStage2HeartbeatAt = 0;
}

function startReliefRelaxOnce() {
  if (!soundUnlocked || reliefRelaxStarted || !soundLibrary.relax) return;

  const audio = soundLibrary.relax.pool[0];
  if (!audio) return;

  reliefRelaxStarted = true;
  audio.loop = false;
  audio.volume = SOUND_SETTINGS.relax.volume;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (err) {}

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function playReliefFlowerSound() {
  if (phase !== 2 || transitionState) return false;
  const flowerSounds = ['flower1', 'flower2', 'flower3'];
  const picked = random(flowerSounds);
  playSound(picked, { force: true, volume: random(0.24, 0.38) });
  return true;
}

function playReliefWaterdropSound() {
  if (phase !== 2 || transitionState) return;
  playSound('waterdrop', { volume: random(0.22, 0.34) });
}

function stopReliefSounds() {
  stopSoundPool('relax');
  stopSoundPool('flower1');
  stopSoundPool('flower2');
  stopSoundPool('flower3');
  stopSoundPool('waterdrop');
  reliefRelaxStarted = false;
}

function stopAllSounds() {
  for (const name of Object.keys(soundLibrary)) {
    stopSoundPool(name);
  }
  nextStage2HeartbeatAt = 0;
  reliefRelaxStarted = false;
  activeTransferAudio = null;
}

function resetAllPhaseSounds() {
  stopAllSounds();
}


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
  setupSoundLayer();
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  textFont('monospace');
  rectMode(CENTER);
  noCursor();
  uiEl = document.getElementById('ui');
  if (uiEl) uiEl.classList.add('hidden');
  setupSerialUI();
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

function applyUIVisibility() {
  if (!uiEl) return;
  if (uiPinnedVisible) {
    uiEl.classList.remove('hidden');
  } else {
    uiEl.classList.add('hidden');
  }
}

function showUI(seconds = 4) {
  applyUIVisibility();
}

function drawCommittedPhase(p) {
  if (p === 0) {
    drawStage1();
  } else if (p === 1) {
    drawStage2();
    drawTransitionVeil();
  } else {
    drawReliefStage();
    drawTransitionVeil();
  }
}

function draw() {
  applyUIVisibility();

  if (transitionState) {
    transitionState.age += deltaTime / 1000;
    const p = constrain(transitionState.age / transitionState.duration, 0, 1);

    drawIntegratedPhaseMorph(transitionState, p);

    if (p >= 1) commitPhaseAfterTransition();
  } else {
    drawCommittedPhase(phase);
  }
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

  for (const tide of stage1Tides) {
    drawRefreshTideBody(tide, false);
  }

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
  playStage1Sound('pop', 0.22);
  const ttl = random(1.75, 2.9);
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
  playStage1Sound('pop', 0.35);
  const ttl = random(1.9, 2.45);
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
  playStage1Sound('glitch', 0.42);
  const ttl = random(1.48, 2.12);
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
  playStage1Sound('interface', 0.62);
  const laneCount = max(3, min(5, floor(width / 320)));
  const laneW = width / laneCount;
  const lane = floor(random(laneCount));
  const ttl = random(1.72, 2.32);
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
  playStage1Sound('interface', 0.68);
  const ttl = random(1.7, 2.28);
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
  playStage1Sound('typing', 0.86);
  const ttl = random(1.8, 2.35);
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
  playStage1Sound('interface', 0.58);
  const ttl = random(1.62, 2.15);
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
  push();
  translate(p.x, p.y);
  blendMode(SCREEN);
  rectMode(CENTER);
  const flash = p.glow;
  const jitter = flash > 0.15 ? random(-1.6, 1.6) : 0;

  noStroke();
  fill(26, 8, 18, (54 + flash * 58) * a);
  rect(jitter, 0, e.w, e.h, 4);

  strokeWeight(1);
  stroke(255, 70 + flash * 130, 74 + flash * 100, (62 + flash * 116) * a);
  noFill();
  line(-e.w * 0.50, -e.h * 0.42, -e.w * 0.22, -e.h * 0.42);
  line(-e.w * 0.04, -e.h * 0.42, e.w * 0.50, -e.h * 0.42);
  line(-e.w * 0.50, e.h * 0.42, e.w * 0.06, e.h * 0.42);
  line(e.w * 0.24, e.h * 0.42, e.w * 0.50, e.h * 0.42);
  line(-e.w * 0.50, -e.h * 0.42, -e.w * 0.50, -e.h * 0.10);
  line(e.w * 0.50, e.h * 0.10, e.w * 0.50, e.h * 0.42);

  noStroke();
  fill(255, 48 + flash * 130, 58 + flash * 120, (160 + flash * 80) * a);
  circle(-e.w * 0.39, 0, 7 + flash * 5);
  fill(255, 228, 218, (145 + flash * 100) * a);
  textAlign(LEFT, CENTER);
  textSize(8.5 + flash * 1.6);
  text(e.label, -e.w * 0.31, -e.h * 0.16);

  stroke(255, 220, 205, (56 + flash * 80) * a);
  strokeWeight(1.2);
  for (let i = 0; i < e.lines + 2; i++) {
    const xx = -e.w * 0.31 + i * e.w * 0.12;
    const yy = e.h * 0.12 + random(-0.6, 0.6);
    const len = random(7, 18) + flash * 8;
    line(xx, yy, xx + len, yy + random(-0.7, 0.7));
  }

  noStroke();
  fill(255, 88 + flash * 110, 80 + flash * 95, (122 + flash * 110) * a);
  textAlign(RIGHT, CENTER);
  textSize(10 + flash * 2);
  text(`${e.count} ${e.metric}`, e.w * 0.42, e.h * 0.16);

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
  startStage2RadioLoop();
  updateStage2HeartbeatSound();

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
  startReliefRelaxOnce();
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
    playReliefWaterdropSound();
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
    this.soundStarted = false;
    this.holdFrames = 240;
    this.holdCounter = 0;
    this.opacity = 255;
  }

  showToBuffer() {
    this.buffer.noFill();
    let c = color(this.col);
    c.setAlpha(55);
    this.buffer.strokeWeight(max(0.55, this.bs * 0.0005));
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
      if (!this.soundStarted && playReliefFlowerSound()) {
        this.soundStarted = true;
      }
      for (let i = 0; i < 2; i++) {
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
      this.opacity -= 10;
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
  if (key === '0-1') return 4.05;
  if (key === '1-2') return 5.15;
  if (key === '2-0') return 3.35;
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

function transitionAnchorCount(key, side) {
  if (key === '0-1') return side === 'source' ? 165 : 190;
  if (key === '1-2') return side === 'source' ? 190 : 210;
  if (key === '2-0') return side === 'source' ? 175 : 185;
  return 130;
}

function createPhaseTransform(from, to) {
  const key = `${from}-${to}`;
  const sourceSnapshot = key === '1-2' ? get(0, 0, width, height) : null;
  const sourceAnchors = collectTransitionAnchors(from, transitionAnchorCount(key, 'source'));

  initPhase(to);
  prepareTargetPhaseForTransition(to);
  const targetAnchors = collectTransitionAnchors(to, transitionAnchorCount(key, 'target'));

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
    sourceAnchors,
    targetAnchors,
    sourceSnapshot,
    targetPools: buildTargetAnchorPools(targetAnchors),
    targetCursor: 0,
    label: `${stageNameLabel(from)} → ${stageNameLabel(to)}`
  };

  if (key === '0-1') buildFeedToGazeTransform(state, sourceAnchors);
  else if (key === '1-2') buildGazeToReliefTransform(state, sourceAnchors);
  else if (key === '2-0') buildReliefToFeedTransform(state, sourceAnchors);
  else buildGenericTransform(state, sourceAnchors);

  alignMorphTargetsToGeneratedStage(state);
  return state;
}

function prepareTargetPhaseForTransition(to) {
  if (to === 0) {
    seedStage1ForTransitionTarget();
  }

  if (to === 2) {
    for (const blob of reliefBlobs) blob.update();
    for (const mote of reliefMotes) mote.update();
    for (const word of reliefWords) word.update();
    for (const petal of reliefPetals) {
      for (let i = 0; i < 8; i++) petal.update();
    }
    for (const ripple of reliefRipples) {
      ripple.rings = [];
      for (let i = 0; i < 5; i++) {
        ripple.spawnRing();
        const ring = ripple.rings[ripple.rings.length - 1];
        ring.r = min(width, height) * (0.10 + i * 0.055);
        ring.alpha = 65 - i * 7;
      }
      ripple.cooldown = 90;
    }
  }
}

function seedStage1ForTransitionTarget() {
  for (let i = 0; i < 10; i++) spawnBaitDot(random(width * 0.08, width * 0.92), random(height * 0.08, height * 0.92), random() < 0.28);
  for (let i = 0; i < 4; i++) spawnFeedCardTrace();
  for (let i = 0; i < 5; i++) spawnBadgeChipTrace();
  for (let i = 0; i < 4; i++) spawnTypingBubbleTrace();
  for (let i = 0; i < 4; i++) spawnIconMetricTrace();
}

function buildTargetAnchorPools(anchors) {
  const pools = {};
  for (const a of shuffleAnchors(anchors.slice())) {
    if (!pools[a.kind]) pools[a.kind] = [];
    pools[a.kind].push(a);
  }
  return pools;
}

function claimTargetAnchor(state, preferredKinds = []) {
  for (const kind of preferredKinds) {
    const pool = state.targetPools[kind];
    if (pool && pool.length > 0) return pool.pop();
  }
  if (!state.targetAnchors || state.targetAnchors.length === 0) return null;
  const t = state.targetAnchors[state.targetCursor % state.targetAnchors.length];
  state.targetCursor++;
  return t;
}

function applyTargetAnchorToMovingItem(item, target, targetPhase) {
  if (!target) return;
  item.tx = target.x;
  item.ty = target.y;
  item.w1 = max(4, min(target.w || item.w1 || 20, width * 0.95));
  item.h1 = max(3, min(target.h || item.h1 || 18, height * 0.88));
  item.toText = getAnchorText(target, targetPhase);
  item.toKind = target.textKind || item.toKind || 'platform';
  item.targetKind = target.kind;
  item.targetAnchor = target;
  item.c1x = lerp(item.sx, item.tx, 0.30) + random(-70, 70);
  item.c1y = lerp(item.sy, item.ty, 0.30) + random(-90, 70);
  item.c2x = lerp(item.sx, item.tx, 0.76) + random(-55, 55);
  item.c2y = lerp(item.sy, item.ty, 0.76) + random(-65, 80);
}

function applyTargetAnchorToLetter(letter, target) {
  if (!target) return;
  letter.tx = target.x + random(-max(2, target.w || 8) * 0.18, max(2, target.w || 8) * 0.18);
  letter.ty = target.y + random(-max(2, target.h || 8) * 0.18, max(2, target.h || 8) * 0.18);
  letter.endSize = max(2, min(target.size || letter.endSize || 5, 12));
  letter.targetKind = target.kind;
  letter.targetAnchor = target;
  letter.c1x = lerp(letter.sx, letter.tx, 0.30) + random(-58, 58);
  letter.c1y = lerp(letter.sy, letter.ty, 0.30) + random(-80, 55);
  letter.c2x = lerp(letter.sx, letter.tx, 0.78) + random(-40, 40);
  letter.c2y = lerp(letter.sy, letter.ty, 0.78) + random(-50, 65);
}

function applyTargetAnchorToFragment(frag, target) {
  if (!target) return;
  frag.tx = target.x;
  frag.ty = target.y;
  frag.w1 = max(12, min(target.w || frag.w1 || 40, width * 0.55));
  frag.h1 = max(10, min(target.h || frag.h1 || 30, height * 0.55));
  frag.targetKind = target.kind;
  frag.targetAnchor = target;
  frag.c1x = lerp(frag.sx, frag.tx, 0.30) + random(-70, 70);
  frag.c1y = lerp(frag.sy, frag.ty, 0.30) - random(40, 130);
  frag.c2x = lerp(frag.sx, frag.tx, 0.78) + random(-55, 55);
  frag.c2y = lerp(frag.sy, frag.ty, 0.78) + random(-45, 85);
}

function alignMorphTargetsToGeneratedStage(state) {
  if (state.key === '0-1') {
    for (const item of state.particles) {
      let prefs = ['phase2RingWord', 'phase2Word'];
      if (item.finalKind === 'phase2Card') prefs = ['phase2Card'];
      else if (item.finalKind === 'eyeNode') prefs = ['phase2RingWord', 'phase2Eye', 'phase2Word'];
      applyTargetAnchorToMovingItem(item, claimTargetAnchor(state, prefs), 1);
      if (item.targetKind === 'phase2Card') item.finalKind = 'phase2Card';
      else if (item.targetKind === 'phase2Eye') item.finalKind = 'eyeNode';
      else item.finalKind = 'ringWord';
    }
    const targetEye = state.targetAnchors.find(a => a.kind === 'phase2Eye');
    if (targetEye) state.targetEye = targetEye;
  } else if (state.key === '1-2') {
    for (const item of state.particles) {
      const prefs = item.finalKind === 'blob' ? ['reliefBlob', 'reliefPetal', 'reliefMote'] : ['reliefMote', 'reliefWord', 'reliefBlob'];
      applyTargetAnchorToMovingItem(item, claimTargetAnchor(state, prefs), 2);
    }
    for (const frag of state.fragments) {
      applyTargetAnchorToFragment(frag, claimTargetAnchor(state, ['reliefPetal', 'reliefBlob', 'reliefMote']));
    }
    for (const letter of state.letters) {
      applyTargetAnchorToLetter(letter, claimTargetAnchor(state, ['reliefMote', 'reliefWord', 'reliefBlob']));
    }
    const rippleTargets = state.targetAnchors.filter(a => a.kind === 'reliefRipple');
    for (let i = 0; i < state.rings.length; i++) {
      const t = rippleTargets[i % max(1, rippleTargets.length)] || claimTargetAnchor(state, ['reliefRipple', 'reliefBlob']);
      if (t) {
        state.rings[i].tx = t.x;
        state.rings[i].ty = t.y;
        state.rings[i].r1 = max(20, (t.w || min(width, height) * 0.25) * 0.5);
        state.rings[i].targetAnchor = t;
      }
    }
  } else if (state.key === '2-0') {
    for (const item of state.particles) {
      const prefs = (item.finalKind === 'wordToBadge' || item.finalKind === 'moteToChip')
        ? ['badge', 'typing', 'card', 'baitGlyph']
        : ['baitDot', 'iconmetric', 'baitOrb', 'baitGlyph'];
      applyTargetAnchorToMovingItem(item, claimTargetAnchor(state, prefs), 0);
      if (['badge', 'typing', 'card', 'baitGlyph'].includes(item.targetKind)) {
        item.finalKind = item.targetKind === 'card' ? 'moteToChip' : 'wordToBadge';
      } else if (item.targetKind === 'baitOrb') {
        item.finalKind = 'blobToDotCluster';
      } else {
        item.finalKind = 'moteToDot';
      }
    }
  }
}

// nxiety1-anxiety2
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

// anxiety2-relief
function buildGazeToReliefTransform(state, anchors) {
  const centerX = width * 0.5;
  const centerY = height * 0.52;

  state.revelation = {
    cx: centerX,
    cy: centerY,
    preludeEnd: 0.37,
    compressionStart: 0.08,
    compressionPeak: 0.43,
    openingStart: 0.36,
    openingEnd: 0.74,
    seed: random(9999)
  };

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


function drawStage2SourcePreviewNoUpdate() {
  drawStage2Background();
  if (phase2Eye) phase2Eye.displayBack();
  for (const dust of phase2FlowDust) dust.display();
  for (const mark of phase2GazeMarks) mark.display();
  for (const card of phase2Cards) card.display();
  drawStage2TextRibbon();
  for (const w of phase2Words) w.display();
  if (phase2Eye) phase2Eye.displayFront();
  drawStage2ChromaticBurn();
  drawStage2FeedMask();
}

function drawA2SourceStageDissolve(state, p) {
  const end = state.revelation && state.revelation.preludeEnd ? state.revelation.preludeEnd : 0.37;
  const tail = 0.11;
  if (p >= end + tail) return;

  const t = constrain(p / end, 0, 1);
  const soften = smoother(t);
  const tailFade = 1 - smoother(constrain((p - end) / tail, 0, 1));
  const sourceFade = lerp(1, 0.24, easeInOutCubic(constrain((t - 0.10) / 0.90, 0, 1))) * tailFade;
  const blurAmount = lerp(0, 15, soften);
  const ctx = drawingContext;

  ctx.save();
  ctx.globalAlpha *= sourceFade;
  ctx.filter = `blur(${blurAmount}px)`;
  if (state.sourceSnapshot) {
    push();
    imageMode(CORNER);
    image(state.sourceSnapshot, 0, 0, width, height);
    pop();
  } else {
    drawStage2SourcePreviewNoUpdate();
  }
  ctx.restore();

  if (t < 0.72) {
    ctx.save();
    ctx.globalAlpha *= (1 - smoother(constrain((t - 0.22) / 0.50, 0, 1))) * 0.48;
    ctx.filter = `blur(${lerp(0, 7, soften)}px)`;
    drawA2SourceBlurDissolve(state, t * 0.72);
    ctx.restore();
  }

  drawA2PreludeClosingEye(state, t, max(0.18, sourceFade));

  if (soften > 0.04) {
    push();
    blendMode(SCREEN);
    noStroke();
    const wash = ctx.createRadialGradient(width * 0.5, height * 0.43, 0, width * 0.5, height * 0.43, max(width, height) * 0.66);
    wash.addColorStop(0, `rgba(255,58,82,${0.08 * soften * sourceFade})`);
    wash.addColorStop(0.35, `rgba(170,0,120,${0.045 * soften * sourceFade})`);
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);
    blendMode(BLEND);
    pop();
  }
}

function drawA2PreludeClosingEye(state, t, fade) {
  if (t <= 0.035) return;
  const eye = state.rings && state.rings.length > 0 ? state.rings[0] : null;
  const cx = eye ? eye.sx : (phase2Eye ? phase2Eye.x : width * 0.5);
  const cy = eye ? eye.sy : (phase2Eye ? phase2Eye.y : height * 0.42);
  const eyeW = eye ? eye.w : (phase2Eye ? phase2Eye.baseW : min(width * 0.84, height * 1.35));
  const eyeH = eye ? eye.h : (phase2Eye ? phase2Eye.baseH : min(width * 0.84, height * 1.35) * 0.31);
  const close = smoother(constrain((t - 0.08) / 0.78, 0, 1));
  if (close <= 0.001) return;

  push();
  translate(cx, cy);
  blendMode(SCREEN);
  noFill();
  const lidH = lerp(eyeH * 1.18, eyeH * 0.018, close);
  stroke(255, 50, 76, 96 * fade);
  strokeWeight(lerp(1.8, 2.5, close));
  beginShape();
  vertex(-eyeW * 0.48, 0);
  bezierVertex(-eyeW * 0.25, -lidH, eyeW * 0.25, -lidH, eyeW * 0.48, 0);
  bezierVertex(eyeW * 0.25, lidH, -eyeW * 0.25, lidH, -eyeW * 0.48, 0);
  endShape(CLOSE);

  if (close > 0.65) {
    stroke(255, 218, 226, 54 * fade * close);
    strokeWeight(1.2);
    line(-eyeW * 0.42, 0, eyeW * 0.42, 0);
  }
  blendMode(BLEND);
  pop();
}

function drawA2SourceBlurDissolve(state, p) {
  const prelude = constrain(p / 0.38, 0, 1);
  const fade = 1 - smoother(prelude);
  if (fade <= 0.002) return;

  const blurAmount = lerp(0, 9.5, smoother(prelude));
  const drift = easeOutCubic(prelude);
  const ctx = drawingContext;

  push();
  blendMode(SCREEN);
  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  textFont('monospace');

  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.filter = `blur(${blurAmount}px)`;

  const anchors = state.sourceAnchors || [];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    if (a.kind === 'phase2Card') {
      drawA2SourceCardDissolving(a, i, drift, fade);
    } else if (a.kind === 'phase2Word' || a.kind === 'phase2RingWord') {
      drawA2SourceWordDissolving(a, i, drift, fade);
    }
  }

  ctx.restore();
  pop();
}

function drawA2SourceCardDissolving(a, index, drift, fade) {
  const seed = (index + 1) * 12.9898;
  const x = a.x + sin(seed) * width * 0.018 * drift;
  const y = a.y + cos(seed * 1.37) * height * 0.018 * drift - height * 0.018 * drift;
  const w = max(34, a.w || 90);
  const h = max(22, a.h || 48);
  const soften = 1 - drift;
  const localFlicker = 0.84 + 0.16 * sin(frameCount * 0.06 + index);

  push();
  translate(x, y);
  rotate(sin(seed + frameCount * 0.01) * 0.018 * soften);

  noStroke();
  fill(8, 0, 8, 82 * fade * localFlicker);
  rect(0, 0, w, h, 10);

  stroke(255, 44, 72, 74 * fade * localFlicker);
  strokeWeight(lerp(1.0, 0.45, drift));
  noFill();
  rect(0, 0, w, h, 10);

  noStroke();
  textAlign(CENTER, CENTER);
  textSize(lerp(12, 9, drift));
  const c = phase2TargetKindColor(a.textKind || 'judgement', 138 * fade * localFlicker);
  fill(c);
  text(a.text || randomStablePhase2Word(seed), 0, -h * 0.16, w * 0.82);

  fill(255, 112, 78, 56 * fade * soften);
  textSize(9);
  text(a.metric || 'read', 0, h * 0.19, w * 0.82);
  pop();
}

function drawA2SourceWordDissolving(a, index, drift, fade) {
  const seed = (index + 7) * 7.177;
  const x = a.x + sin(seed) * width * 0.014 * drift;
  const y = a.y + cos(seed * 1.21) * height * 0.014 * drift - height * 0.012 * drift;
  const s = max(8, a.size || 14) * lerp(1, 0.86, drift);
  const jitter = 1.8 * drift;
  const textValue = a.text || randomStablePhase2Word(seed);

  push();
  translate(x + sin(frameCount * 0.025 + seed) * jitter, y + cos(frameCount * 0.02 + seed) * jitter);
  rotate((a.rotate || a.angle || 0) * (1 - drift * 0.35));
  textAlign(CENTER, CENTER);
  textSize(s);

  if (a.kind === 'phase2RingWord') rotate(HALF_PI);

  fill(255, 0, 42, 34 * fade);
  text(textValue, -2 - drift * 2, 1);
  fill(70, 230, 255, 14 * fade);
  text(textValue, 2 + drift * 2, -1);
  fill(phase2TargetKindColor(a.textKind || 'noise', 150 * fade));
  text(textValue, 0, 0);
  pop();
}

function drawGazeToReliefTransform(state, p) {
  const preludeEnd = state.revelation && state.revelation.preludeEnd ? state.revelation.preludeEnd : 0.37;
  const collapseP = constrain((p - preludeEnd) / (1 - preludeEnd), 0, 1);
  const q = smoother(collapseP);
  const cx = width * 0.5;
  const cy = height * 0.52;

  drawA2SourceStageDissolve(state, p);

  if (p < preludeEnd) {
    drawTransitionLabel(state, p, color(210, 246, 238));
    return;
  }

  push();
  noStroke();
  const hold = (1 - smoother(constrain((collapseP - 0.18) / 0.64, 0, 1))) * q;
  fill(10, 0, 7, 76 * hold);
  rect(width * 0.5, height * 0.5, width, height);
  const open = easeOutCubic(constrain((collapseP - 0.34) / 0.52, 0, 1));
  const wash = drawingContext.createRadialGradient(cx, cy, 0, cx, cy, max(width, height) * 0.92);
  wash.addColorStop(0, `rgba(226,255,246,${0.10 * q + 0.34 * open})`);
  wash.addColorStop(0.30, `rgba(178,228,250,${0.06 * q + 0.18 * open})`);
  wash.addColorStop(0.62, `rgba(255,224,205,${0.03 * open})`);
  wash.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = wash;
  drawingContext.fillRect(0, 0, width, height);
  pop();

  drawA2RevelationCompression(state, collapseP);
  drawA2EyeCollapsingIntoRipple(state, collapseP);
  drawA2RevelationOpening(state, collapseP);
  drawA2RedSyntaxIntoWater(state, collapseP);
  for (const frag of state.fragments) drawA2CornerFragmentToPetal(frag, collapseP);
  for (const item of state.particles) drawA2CardBodyToBlob(item, collapseP);
  for (const letter of state.letters) drawA2LetterToMote(letter, collapseP);
  drawA2AfterglowBreath(state, collapseP);
  drawTransitionLabel(state, p, color(210, 246, 238));
}

function revelationPointFor(obj, q, tightness = 1) {
  const split = 0.46;
  const seed = obj.seed || 0;
  const cx = width * 0.5 + sin(seed * 1.37) * width * 0.028 * tightness;
  const cy = height * 0.52 + cos(seed * 1.11) * height * 0.020 * tightness;

  if (q <= split) {
    const k = smoother(constrain(q / split, 0, 1));
    return {
      x: lerp(obj.sx, cx, k),
      y: lerp(obj.sy, cy, k)
    };
  }

  const k = easeOutCubic(constrain((q - split) / (1 - split), 0, 1));
  const c1x = cx + sin(seed + 4.1) * width * 0.045;
  const c1y = cy + cos(seed + 2.7) * height * 0.035;
  const c2x = lerp(cx, obj.tx, 0.62) + sin(seed + 8.3) * width * 0.030;
  const c2y = lerp(cy, obj.ty, 0.62) + cos(seed + 5.9) * height * 0.026;
  return {
    x: cubicPoint(cx, c1x, c2x, obj.tx, k),
    y: cubicPoint(cy, c1y, c2y, obj.ty, k)
  };
}

function revelationMorphSize(a, b, q, squeeze = 0.18) {
  const split = 0.46;
  const mid = max(1.4, min(abs(a), abs(b)) * squeeze);
  if (q <= split) return lerp(a, mid, smoother(constrain(q / split, 0, 1)));
  return lerp(mid, b, easeOutCubic(constrain((q - split) / (1 - split), 0, 1)));
}

function drawA2RevelationCompression(state, p) {
  const rv = state.revelation || { cx: width * 0.5, cy: height * 0.52, seed: state.seed };
  const pull = smoother(constrain((p - 0.06) / 0.36, 0, 1));
  const release = smoother(constrain((p - 0.38) / 0.20, 0, 1));
  const intensity = pull * (1 - release);
  if (intensity <= 0.001) return;

  push();
  blendMode(MULTIPLY);
  noStroke();
  fill(0, 0, 0, 120 * intensity);
  rect(width * 0.5, height * 0.5, width, height);
  blendMode(SCREEN);

  const count = min(44, state.sourceAnchors ? state.sourceAnchors.length : 0);
  for (let i = 0; i < count; i++) {
    const a = state.sourceAnchors[i];
    const toward = smoother(constrain((p - 0.08 - i * 0.002) / 0.33, 0, 1));
    const x = lerp(a.x, rv.cx, toward);
    const y = lerp(a.y, rv.cy, toward);
    const alpha = 42 * intensity * (0.45 + 0.55 * noise(i, rv.seed));
    stroke(255, 42, 72, alpha);
    strokeWeight(0.8 + 1.0 * intensity);
    line(a.x, a.y, x, y);
    noStroke();
    fill(255, 48, 76, alpha * 0.9);
    circle(x, y, 2.5 + 5.5 * intensity);
  }

  noFill();
  for (let i = 0; i < 5; i++) {
    const r = lerp(max(width, height) * (0.30 - i * 0.028), min(width, height) * (0.022 + i * 0.006), pull);
    stroke(255, 44, 72, (42 - i * 5) * intensity);
    strokeWeight(1.2);
    ellipse(rv.cx, rv.cy, r * 2.2, r * 1.22);
  }
  blendMode(BLEND);
  pop();
}

function drawA2RevelationOpening(state, p) {
  const rv = state.revelation || { cx: width * 0.5, cy: height * 0.52, seed: state.seed };
  const burst = sin(constrain((p - 0.36) / 0.32, 0, 1) * PI);
  const open = easeOutCubic(constrain((p - 0.38) / 0.48, 0, 1));
  if (burst <= 0.001 && open <= 0.001) return;

  push();
  blendMode(SCREEN);
  noStroke();
  const ctx = drawingContext;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(rv.cx, rv.cy, 0, rv.cx, rv.cy, max(width, height) * lerp(0.22, 0.84, open));
  glow.addColorStop(0, `rgba(238,255,247,${0.36 * burst + 0.16 * open})`);
  glow.addColorStop(0.18, `rgba(207,246,238,${0.28 * burst + 0.12 * open})`);
  glow.addColorStop(0.48, `rgba(151,218,248,${0.14 * burst + 0.08 * open})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  noFill();
  for (let i = 0; i < 11; i++) {
    const t = constrain((p - 0.34 - i * 0.018) / 0.58, 0, 1);
    if (t <= 0) continue;
    const r = easeOutCubic(t) * max(width, height) * (0.10 + i * 0.045);
    const a = sin(t * PI) * (64 - i * 3.4);
    stroke(226, 255, 246, a);
    strokeWeight(max(0.8, 3.2 - i * 0.18));
    ellipse(rv.cx, rv.cy, r * 2.05, r * 1.46);
  }

  for (let i = 0; i < 32; i++) {
    const a = i * TAU / 32 + sin(rv.seed) * 0.3;
    const len = max(width, height) * (0.10 + 0.32 * open) * (0.6 + 0.4 * noise(i, rv.seed));
    const inner = max(width, height) * 0.018;
    stroke(230, 255, 246, 32 * burst * (0.5 + 0.5 * noise(rv.seed, i)));
    strokeWeight(0.8);
    line(rv.cx + cos(a) * inner, rv.cy + sin(a) * inner * 0.72, rv.cx + cos(a) * len, rv.cy + sin(a) * len * 0.72);
  }
  blendMode(BLEND);
  pop();
}

function drawA2AfterglowBreath(state, p) {
  const open = easeOutCubic(constrain((p - 0.58) / 0.42, 0, 1));
  if (open <= 0.001) return;
  push();
  blendMode(SCREEN);
  noFill();
  const cx = width * 0.5;
  const cy = height * 0.52;
  for (let i = 0; i < 6; i++) {
    const breathe = 0.5 + 0.5 * sin(frameCount * 0.018 + i);
    const r = min(width, height) * (0.11 + i * 0.055 + breathe * 0.012) * open;
    stroke(205, 246, 238, (18 - i * 1.8) * open);
    strokeWeight(1.1);
    ellipse(cx, cy, r * 2.2, r * 1.48);
  }
  blendMode(BLEND);
  pop();
}

function drawA2EyeCollapsingIntoRipple(state, p) {
  const eye = state.rings[0];

  const qClose = 1;
  const qRipple = easeOutCubic(constrain((p - 0.28) / 0.72, 0, 1));
  const targetX = eye.tx || width * 0.5;
  const targetY = eye.ty || height * 0.52;
  const cx = lerp(eye.sx, targetX, qRipple);
  const cy = lerp(eye.sy, targetY, qRipple);
  const eyeW = eye.w;
  const eyeH = eye.h;
  const burst = sin(constrain((p - 0.34) / 0.34, 0, 1) * PI);

  push();
  blendMode(SCREEN);
  noFill();

  const lidH = lerp(eyeH * 1.25, eyeH * 0.018, qClose);
  stroke(255, 44, 72, 86 * (1 - qRipple));
  strokeWeight(lerp(2.2, 1.0, qClose));
  beginShape();
  vertex(cx - eyeW * 0.48, cy);
  bezierVertex(cx - eyeW * 0.25, cy - lidH, cx + eyeW * 0.25, cy - lidH, cx + eyeW * 0.48, cy);
  bezierVertex(cx + eyeW * 0.25, cy + lidH, cx - eyeW * 0.25, cy + lidH, cx - eyeW * 0.48, cy);
  endShape(CLOSE);

  if (p < 0.50) {
    noStroke();
    fill(0, 0, 0, 160 * (1 - qClose));
    ellipse(cx, cy, eyeH * 0.62 * (1 - qClose * 0.3), eyeH * 0.8 * (1 - qClose * 0.3));
  }

  if (burst > 0) {
    stroke(230, 255, 246, 92 * burst);
    strokeWeight(2.2);
    ellipse(cx, cy, eyeH * (0.36 + burst * 0.18), eyeH * (0.10 + burst * 0.08));
    noStroke();
    fill(230, 255, 246, 78 * burst);
    ellipse(cx, cy, eyeH * (0.22 + burst * 0.26), eyeH * (0.06 + burst * 0.10));
  }

  for (let i = 0; i < 10; i++) {
    const targetR = eye.r1 || max(width, height) * (0.12 + i * 0.075);
    const r = lerp(eyeH * (0.22 + i * 0.055), targetR * (0.58 + i * 0.075), qRipple);
    const a = sin(constrain((p - 0.21 - i * 0.018) / 0.79, 0, 1) * PI) * (58 - i * 3.2);
    stroke(lerp(255, 205, qRipple), lerp(45, 246, qRipple), lerp(72, 238, qRipple), max(0, a + burst * 18));
    strokeWeight(max(0.8, 3.4 - i * 0.23));
    ellipse(cx, cy, r * 2, r * lerp(0.40, 1.48, qRipple));
  }
  blendMode(BLEND);
  pop();
}

function drawA2RedSyntaxIntoWater(state, p) {
  const q = smoother(constrain((p - 0.14) / 0.78, 0, 1));
  push();
  blendMode(SCREEN);
  noFill();
  for (const seam of state.seams) {
    const lp = localProgress(p, seam.delay, 0.08);
    const a = 42 * sin(lp * PI);
    if (a <= 0) continue;
    stroke(lerp(255, 204, q), lerp(42, 246, q), lerp(70, 238, q), a);
    strokeWeight(lerp(1.1, 2.8, q));
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
  const pt = revelationPointFor(frag, q, 0.85);
  const x = pt.x;
  const y = pt.y;
  const a = min(1, sin(lp * PI) * 1.2);
  const w = revelationMorphSize(frag.w0, frag.w1, q, 0.20);
  const h = revelationMorphSize(frag.h0, frag.h1, q, 0.20);

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
  const pt = revelationPointFor(item, q, 1.0);
  const x = pt.x;
  const y = pt.y;
  const a = min(1, sin(lp * PI) * 1.15);
  const w = revelationMorphSize(item.w0, item.w1, q, 0.16);
  const h = revelationMorphSize(item.h0, item.h1, q, 0.16);

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
  const pt = revelationPointFor(letter, q, 1.05);
  const x = pt.x;
  const y = pt.y;
  const a = min(1, sin(lp * PI) * 1.25);
  const s = revelationMorphSize(letter.startSize, letter.endSize, q, 0.20);

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

// relief-anxiety1
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

function commitPhaseAfterTransition() {
  if (!transitionState) return;
  phase = transitionState.to;
  transitionState = null;

  // servo mode follows the committed visual phase
  // this is the point where the anxiety1-anxiety2 animation has actually finished
  if (phase === 0) sendServoMode('A1');
  if (phase === 1) sendServoMode('A2');
  if (phase === 2) sendServoMode('STOP');

  if (phase === 2) {
    startReliefRelaxOnce();
    playReliefWaterdropSound();
  }
}

function drawPhaseTransform() {
  if (!transitionState) return;
  const p = constrain(transitionState.age / transitionState.duration, 0, 1);
  drawIntegratedPhaseMorph(transitionState, p);
}


function rgbaFromColor(c, a) {
  return `rgba(${floor(red(c))},${floor(green(c))},${floor(blue(c))},${a})`;
}

function drawIntegratedPhaseMorph(state, p) {
  const q = smoother(p);
  drawMorphingBackground(state, q);
  const a2PreludeEnd = state.revelation && state.revelation.preludeEnd ? state.revelation.preludeEnd : 0.37;
  const holdSourceOnly = state.key === '1-2' && p < a2PreludeEnd;
  if (!holdSourceOnly) drawMorphingSubstrate(state, p, q);

  if (state.key === '0-1') {
    drawFeedToGazeTransform(state, p);
  } else if (state.key === '1-2') {
    drawGazeToReliefTransform(state, p);
  } else if (state.key === '2-0') {
    drawReliefToFeedTransform(state, p);
  } else {
    drawGenericPhaseTransform(state, p);
  }

  drawGeneratedTargetPhasePreview(state, p);
  drawMorphingSurfaceGrain(state, p);
}

function morphPaletteForKey(key) {
  if (key === '0-1') {
    return {
      topA: color(7, 2, 9), midA: color(17, 4, 13), botA: color(2, 2, 3),
      topB: color(7, 2, 10), midB: color(23, 3, 22), botB: color(2, 2, 3),
      glowA: color(255, 34, 54), glowB: color(130, 0, 160), glowC: color(255, 74, 26)
    };
  }
  if (key === '1-2') {
    return {
      topA: color(7, 2, 10), midA: color(23, 3, 22), botA: color(2, 2, 3),
      topB: color(79, 125, 131), midB: color(90, 141, 150), botB: color(86, 127, 136),
      glowA: color(210, 246, 238), glowB: color(150, 210, 245), glowC: color(255, 225, 205)
    };
  }
  if (key === '2-0') {
    return {
      topA: color(79, 125, 131), midA: color(90, 141, 150), botA: color(86, 127, 136),
      topB: color(7, 2, 9), midB: color(17, 4, 13), botB: color(2, 2, 3),
      glowA: color(255, 34, 54), glowB: color(120, 0, 160), glowC: color(255, 92, 24)
    };
  }
  return {
    topA: color(5), midA: color(12), botA: color(3),
    topB: color(5), midB: color(12), botB: color(3),
    glowA: color(255), glowB: color(150), glowC: color(255)
  };
}

function drawMorphingBackground(state, q) {
  const pal = morphPaletteForKey(state.key);
  const top = lerpColor(pal.topA, pal.topB, q);
  const mid = lerpColor(pal.midA, pal.midB, q);
  const bot = lerpColor(pal.botA, pal.botB, q);

  const g = drawingContext.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, rgbaFromColor(top, 1));
  g.addColorStop(0.46, rgbaFromColor(mid, 1));
  g.addColorStop(1, rgbaFromColor(bot, 1));
  drawingContext.fillStyle = g;
  drawingContext.fillRect(0, 0, width, height);

  const t = frameCount * 0.01 + state.seed;
  const glowStrength = state.key === '1-2' ? 0.18 + q * 0.12 : 0.18;
  const g1 = drawingContext.createRadialGradient(width * (0.18 + sin(t) * 0.04), height * (0.22 + cos(t * 0.7) * 0.04), 0, width * 0.24, height * 0.26, max(width, height) * 0.78);
  g1.addColorStop(0, rgbaFromColor(pal.glowA, glowStrength * (state.key === '2-0' ? q : 1 - q * 0.15)));
  g1.addColorStop(0.42, rgbaFromColor(pal.glowB, 0.08 + 0.08 * q));
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = g1;
  drawingContext.fillRect(0, 0, width, height);

  const g2 = drawingContext.createRadialGradient(width * (0.72 + cos(t * 0.5) * 0.05), height * (0.76 + sin(t * 0.8) * 0.04), 0, width * 0.72, height * 0.76, max(width, height) * 0.62);
  g2.addColorStop(0, rgbaFromColor(pal.glowC, state.key === '1-2' ? 0.08 * (1 - q) + 0.13 * q : 0.10 + 0.08 * q));
  g2.addColorStop(0.5, rgbaFromColor(pal.glowB, 0.05 + 0.04 * q));
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  drawingContext.fillStyle = g2;
  drawingContext.fillRect(0, 0, width, height);
}

function drawMorphingSubstrate(state, p, q) {
  push();
  blendMode(SCREEN);
  noFill();

  if (state.key === '0-1') {
    const cx = width * 0.5;
    const cy = height * 0.42;
    const eyeW = min(width * 0.84, height * 1.35);
    const eyeH = eyeW * 0.31;
    for (let i = 0; i < 16; i++) {
      const yy = map(i, 0, 15, height * 0.04, height * 0.96);
      const orbitA = map(i, 0, 15, -PI * 0.92, PI * 0.92);
      stroke(lerp(255, 255, q), lerp(38, 74, q), lerp(62, 118, q), 24 + 34 * q);
      strokeWeight(lerp(0.8, 1.7, q));
      beginShape();
      for (let k = 0; k <= 80; k++) {
        const x0 = map(k, 0, 80, -60, width + 60);
        const y0 = yy + sin(x0 * 0.006 + frameCount * 0.018 + i) * (12 + 12 * noise(i));
        const a = orbitA + map(k, 0, 80, -0.42, 0.42);
        const x1 = cx + cos(a) * eyeW * (0.28 + i * 0.012);
        const y1 = cy + sin(a) * eyeH * (0.45 + i * 0.018);
        curveVertex(lerp(x0, x1, q), lerp(y0, y1, q));
      }
      endShape();
    }
  } else if (state.key === '1-2') {
    
  } else if (state.key === '2-0') {
    for (let i = 0; i < 14; i++) {
      const y = map(i, 0, 13, height * 0.04, height * 0.98) + q * height * 0.08;
      stroke(lerp(206, 255, q), lerp(246, 36, q), lerp(238, 56, q), 20 + 44 * q);
      strokeWeight(lerp(2.2, 1.1, q));
      beginShape();
      for (let x = -60; x <= width + 60; x += 18) {
        const slow = y + sin(x * 0.004 + i + frameCount * 0.006) * 16;
        const sharp = y + sin(x * 0.012 + i + frameCount * 0.03) * (18 + 16 * q);
        curveVertex(x, lerp(slow, sharp, q));
      }
      endShape();
    }
  }

  blendMode(BLEND);
  pop();
}

function drawArrivingGazeStructure(state, p) {
  const q = easeOutCubic(constrain((p - 0.58) / 0.42, 0, 1));
  if (q <= 0) return;
  const cx = width * 0.5;
  const cy = height * 0.42;
  const eyeW = min(width * 0.84, height * 1.35);
  const eyeH = eyeW * 0.31;

  push();
  blendMode(SCREEN);
  noFill();
  stroke(255, 54, 76, 72 * q);
  strokeWeight(1.5);
  beginShape();
  vertex(cx - eyeW * 0.5, cy);
  bezierVertex(cx - eyeW * 0.25, cy - eyeH, cx + eyeW * 0.25, cy - eyeH, cx + eyeW * 0.5, cy);
  bezierVertex(cx + eyeW * 0.25, cy + eyeH, cx - eyeW * 0.25, cy + eyeH, cx - eyeW * 0.5, cy);
  endShape(CLOSE);
  noStroke();
  fill(0, 0, 0, 120 * q);
  ellipse(cx, cy, eyeH * 0.74, eyeH * 0.94);

  rectMode(CENTER);
  textAlign(CENTER, CENTER);
  for (let i = 0; i < 8; i++) {
    const laneCount = max(3, min(5, floor(width / 320)));
    const lane = i % laneCount;
    const x = lane * (width / laneCount) + width / laneCount * 0.5 + sin(i + frameCount * 0.01) * 22;
    const y = height * (0.18 + (i * 0.11) % 0.72) - q * 42;
    const w = width / laneCount * 0.62;
    const h = 58 + (i % 3) * 22;
    fill(8, 0, 8, 54 * q);
    stroke(255, 42, 70, 70 * q);
    strokeWeight(1);
    rect(x, y, w, h, 10);
    noStroke();
    fill(255, 220, 220, 106 * q);
    textSize(11);
    text(randomStablePhase2Word(state.seed + i), x, y, w * 0.82);
  }
  blendMode(BLEND);
  pop();
}

function randomStablePhase2Word(seedValue) {
  const all = [...PLATFORM_WORDS, ...JUDGEMENT_WORDS, ...SELF_WORDS];
  const idx = floor(abs(sin(seedValue * 12.9898) * 43758.5453)) % all.length;
  return all[idx];
}

function drawArrivingReliefStructure(state, p) {
  const q = easeOutCubic(constrain((p - 0.56) / 0.44, 0, 1));
  if (q <= 0) return;
  const cx = width * 0.5;
  const cy = height * 0.52;

  push();
  blendMode(SCREEN);
  noFill();
  for (let i = 0; i < 7; i++) {
    const r = max(width, height) * (0.08 + i * 0.055) * q;
    stroke(206, 246, 238, (48 - i * 4) * q);
    strokeWeight(2.4 - i * 0.18);
    ellipse(cx, cy, r * 2, r * 1.42);
  }

  noStroke();
  for (let i = 0; i < 36; i++) {
    const a = i * 1.618 + state.seed;
    const r = sqrt(i / 36) * max(width, height) * 0.44 * q;
    const x = cx + cos(a) * r;
    const y = cy + sin(a) * r * 0.68;
    fill(205, 246, 238, 36 * q);
    ellipse(x, y, 12 + 26 * noise(i, state.seed), 8 + 18 * noise(state.seed, i));
  }

  textAlign(CENTER, CENTER);
  textSize(14);
  fill(222, 244, 246, 65 * q);
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5 + state.seed;
    text(RELIEF_WORDS[i % RELIEF_WORDS.length], cx + cos(a) * width * 0.25, cy + sin(a) * height * 0.22);
  }
  blendMode(BLEND);
  pop();
}

function drawArrivingFeedStructure(state, p) {
  const q = easeOutCubic(constrain((p - 0.56) / 0.44, 0, 1));
  if (q <= 0) return;
  push();
  blendMode(SCREEN);
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  for (let i = 0; i < 18; i++) {
    const x = noise(state.seed, i * 0.13) * width;
    const y = noise(state.seed + 31.7, i * 0.19) * height;
    const pulse = 0.65 + 0.35 * sin(frameCount * 0.08 + i);
    noStroke();
    fill(255, 32, 52, 92 * q * pulse);
    circle(x, y, 4 + 8 * q * pulse);
  }

  for (let i = 0; i < 10; i++) {
    const x = noise(state.seed + 100, i * 0.27) * width;
    const y = noise(state.seed + 200, i * 0.31) * height;
    const label = FEED_BADGES[i % FEED_BADGES.length];
    const w = max(48, label.length * 7);
    const h = 22;
    fill(18, 0, 10, 70 * q);
    stroke(255, 48, 66, 82 * q);
    strokeWeight(1);
    rect(x, y, w, h, 8);
    noStroke();
    fill(255, 218, 198, 116 * q);
    textSize(11);
    text(label, x, y, w * 0.9);
  }
  blendMode(BLEND);
  pop();
}

function drawMorphingSurfaceGrain(state, p) {
  const q = smoother(p);
  push();
  noStroke();
  const amount = state.key === '1-2' ? floor(lerp(34, 16, q)) : floor(lerp(16, 34, q));
  for (let i = 0; i < amount; i++) {
    const n = noise(state.seed, i * 0.17, frameCount * 0.012);
    if (state.key === '1-2') fill(215, 246, 238, 4 + 10 * q);
    else fill(255, 40, 60, 3 + 9 * (state.key === '2-0' ? q : 1 - q * 0.2));
    rect(noise(i, state.seed) * width, noise(state.seed, i) * height, 1 + n * 2, 1 + n * 2);
  }
  pop();
}


function drawGeneratedTargetPhasePreview(state, p) {
  const start = state.key === '1-2' ? 0.62 : 0.68;
  const span = state.key === '1-2' ? 0.38 : 0.32;
  const appear = easeInOutCubic(constrain((p - start) / span, 0, 1));
  if (appear <= 0.001) return;

  drawingContext.save();
  drawingContext.globalAlpha *= appear;
  if (state.to === 0) drawStage1TargetPreviewNoUpdate();
  else if (state.to === 1) drawStage2TargetPreviewNoUpdate();
  else drawReliefTargetPreviewNoUpdate();
  drawingContext.restore();
}

function drawStage1TargetPreviewNoUpdate() {
  drawStage1RefreshTideBack();
  drawStage1SignalMist();
  drawStage1BaitLinks();
  drawStage1Elements();
  drawStage1RefreshTideFront();
  drawStage1Vignette();
}

function drawStage2TargetPreviewNoUpdate() {
  if (phase2Eye) phase2Eye.displayBack();
  for (const dust of phase2FlowDust) dust.display();
  for (const mark of phase2GazeMarks) mark.display();
  for (const card of phase2Cards) card.display();
  for (const w of phase2Words) w.display();
  if (phase2Eye) phase2Eye.displayFront();
  drawStage2ChromaticBurn();
  drawStage2FeedMask();
}

function drawReliefTargetPreviewNoUpdate() {
  for (const blob of reliefBlobs) blob.display();
  for (const petal of reliefPetals) petal.display();
  drawFlowingLight();
  for (const ripple of reliefRipples) ripple.display();
  for (const mote of reliefMotes) mote.display();
  for (const word of reliefWords) word.display();
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
  push();
  noStroke();
  for (let i = 0; i < 26; i++) {
    fill(255, 3);
    rect(random(width), random(height), random(1, 2), random(1, 2));
  }
  pop();
}

function setPhase(nextPhase) {
  if (transitionState) return;

  if (nextPhase === phase) {
    if (phase === 0) stopAllSounds();
    if (phase === 1) stopStage2Sounds();
    if (phase === 2) stopReliefSounds();
    initPhase(phase);
    syncServoToCurrentVisualState();
    showUI();
    return;
  }

  const fromPhase = phase;

  // servo behaviour is linked to the visual phase transition
  // - anxiety2-relief: stop immediately at the start of the anxiety2-relief animation
  // - relief-anxiety1: return to subtle anxiety1 mode.
  // - anxiety1-anxiety2: keep anxiety1 subtle mode during animation; anxiety2 is sent only after commitPhaseAfterTransition()
  if (fromPhase === 1 && nextPhase === 2) sendServoMode('STOP');
  if (nextPhase === 0) sendServoMode('A1');

  if (nextPhase === 0) {
    stopAllSounds();
  } else {
    if (fromPhase === 0 && nextPhase !== 0) {
      stopStage1Sounds();
    }
    if (fromPhase === 1 && nextPhase !== 1) {
      stopStage2Sounds();
    }
    if (fromPhase === 2 && nextPhase !== 2) {
      stopReliefSounds();
    }
  }
  playTransferSound(fromPhase, nextPhase);
  transitionState = createPhaseTransform(fromPhase, nextPhase);
  showUI();
}

function keyPressed() {
  unlockSoundLayer();
  if (key === '1') {
    setPhase(0);
  } else if (key === '2') {
    setPhase(1);
  } else if (key === '3') {
    setPhase(2);
  } else if (key === 'r' || key === 'R') {
    resetAllPhaseSounds();
    initScene();
    showUI();
  } else if (key === 'f' || key === 'F') {
    let fs = fullscreen();
    fullscreen(!fs);
    showUI();
  } else if (key === 'h' || key === 'H') {
    uiPinnedVisible = !uiPinnedVisible;
    uiHideTimer = uiPinnedVisible ? Infinity : 0;
    applyUIVisibility();
  } else if (key === 'c' || key === 'C') {
    if (!serialPort) connectSerial();
  }
}

function mousePressed() {
  unlockSoundLayer();
  showUI();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  transitionState = null;
  if (phase === 0) stopAllSounds();
  initScene();
}

function setupSerialUI() {
  serialBtnEl = document.getElementById('serialBtn');
  serialStatusEl = document.getElementById('serialStatus');

  if (!serialBtnEl || !serialStatusEl) return;

  if (!('serial' in navigator)) {
    serialBtnEl.disabled = true;
    setSerialStatus('Web Serial unavailable. Please open in Chrome / Edge over localhost or HTTPS.');
    return;
  }

  serialBtnEl.addEventListener('click', async () => {
    unlockSoundLayer();
    if (serialPort) await disconnectSerial();
    else await connectSerial();
  });

  navigator.serial.addEventListener?.('disconnect', (event) => {
    if (serialPort && event.target === serialPort) {
      disconnectSerial();
    }
  });
}

function setSerialStatus(message) {
  if (serialStatusEl) serialStatusEl.textContent = `Serial: ${message}`;
}

function updateSerialButtonLabel() {
  if (!serialBtnEl) return;
  serialBtnEl.textContent = serialPort ? 'Disconnect Arduino' : 'Connect Arduino';
}

async function connectSerial() {
  if (!('serial' in navigator)) {
    setSerialStatus('Web Serial unavailable on this browser.');
    return;
  }

  try {
    setSerialStatus('requesting port…');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    serialPort = port;
    serialKeepReading = true;
    serialLineBuffer = '';
    sensorState.pir = 0;
    sensorState.button = 0;
    updateSerialButtonLabel();
    setSerialStatus('connected');
    syncServoToCurrentVisualState();
    showUI(6);

    serialReadableClosed = readSerialLoop();
  } catch (err) {
    setSerialStatus(`connection failed (${err.message || err})`);
    serialPort = null;
    updateSerialButtonLabel();
  }
}

async function disconnectSerial() {
  sendServoMode('STOP');
  await new Promise(resolve => setTimeout(resolve, 60));

  serialKeepReading = false;

  try {
    if (serialReader) {
      await serialReader.cancel();
    }
  } catch (err) {
    console.warn('Reader cancel failed:', err);
  }

  try {
    if (serialReadableClosed) await serialReadableClosed;
  } catch (err) {
    // ignore read loop cancellation errors
  }

  try {
    if (serialPort) await serialPort.close();
  } catch (err) {
    console.warn('Port close failed:', err);
  }

  serialReader = null;
  serialReadableClosed = null;
  serialPort = null;
  sensorState.pir = 0;
  sensorState.button = 0;
  updateSerialButtonLabel();
  setSerialStatus('not connected');
  showUI(4);
}

async function readSerialLoop() {
  const decoder = new TextDecoder();

  while (serialPort && serialPort.readable && serialKeepReading) {
    try {
      serialReader = serialPort.readable.getReader();

      while (serialKeepReading) {
        const { value, done } = await serialReader.read();
        if (done) break;
        if (!value) continue;

        serialLineBuffer += decoder.decode(value, { stream: true });
        let newlineIndex = serialLineBuffer.indexOf('\n');

        while (newlineIndex >= 0) {
          const rawLine = serialLineBuffer.slice(0, newlineIndex);
          serialLineBuffer = serialLineBuffer.slice(newlineIndex + 1);
          handleSerialLine(rawLine.trim());
          newlineIndex = serialLineBuffer.indexOf('\n');
        }
      }
    } catch (err) {
      if (serialKeepReading) {
        console.warn('Serial read error:', err);
        setSerialStatus(`read error (${err.message || err})`);
      }
      break;
    } finally {
      try {
        serialReader?.releaseLock();
      } catch (err) {}
      serialReader = null;
    }
  }
}

function handleSerialLine(line) {
  if (!line) return;
  console.log('[Serial]', line);

  const upper = line.toUpperCase();

  if (upper.startsWith('PIR:')) {
    const value = parseInt(upper.split(':')[1], 10);
    updateSensorState('pir', Number.isNaN(value) ? 0 : value);
    return;
  }

  if (upper.startsWith('BUTTON:')) {
    const value = parseInt(upper.split(':')[1], 10);
    updateSensorState('button', Number.isNaN(value) ? 0 : value);
    return;
  }

  const kvPairs = line.split(',');
  if (kvPairs.length > 1) {
    for (const pair of kvPairs) {
      const [rawKey, rawValue] = pair.split('=');
      if (!rawKey || rawValue == null) continue;
      const key = rawKey.trim().toLowerCase();
      const value = parseInt(rawValue.trim(), 10);
      if (key === 'pir') updateSensorState('pir', Number.isNaN(value) ? 0 : value);
      if (key === 'button') updateSensorState('button', Number.isNaN(value) ? 0 : value);
    }
  }
}

function updateSensorState(type, rawValue) {
  const nextValue = rawValue ? 1 : 0;
  const prevValue = sensorState[type];
  sensorState[type] = nextValue;

  if (prevValue === nextValue) return;

  showUI(3);

  if (type === 'pir' && prevValue === 0 && nextValue === 1) {
    if (phase === 0 && !transitionState) {
      setPhase(1);
      setSerialStatus('PIR triggered · Anxiety 1 → Anxiety 2');
    } else {
      setSerialStatus('PIR detected');
    }
    return;
  }

  if (type === 'button' && prevValue === 0 && nextValue === 1) {
    if (phase === 1 && !transitionState) {
      setPhase(2);
      setSerialStatus('Button pressed · Anxiety 2 → Relief');
    } else {
      setSerialStatus('Button pressed');
    }
    return;
  }

  if (type === 'pir' && nextValue === 0) setSerialStatus('PIR idle');
  if (type === 'button' && nextValue === 0) setSerialStatus('Button released');
}