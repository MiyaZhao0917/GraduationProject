let palettes = [
  ['#dceff1', '#c7ebe5', '#b7d8ff', '#5a8d96', '#ffd9b8', '#cdb8ff', '#9ff0da']
];

var SEED;
var PALETTE = ['#dceff1', '#c7ebe5', '#b7d8ff', '#5a8d96', '#ffd9b8', '#cdb8ff', '#9ff0da'];
var BACKGROUND = 4;

let forms = [];
let colors;
let bsSize;
let pSd = SEED;
let pPlt = PALETTE;
let pBg = BACKGROUND;

function setup() {
  // each time the page is open, a new SEED is randomly generated
  // position and movement of flowers in this round are stable
  // layout will be different when the page is opened again next time
  SEED = Math.floor(Math.random() * 1000000);
  createCanvas(windowWidth, windowHeight);
  randomSeed(SEED);
  noiseSeed(SEED);
  INIT();
}

function draw() {
  randomSeed(SEED);
  noiseSeed(SEED);
  background(colors[BACKGROUND - 1]);

  for (let f of forms) {
    f.run();
    f.display();
  }

  if (pSd != SEED || pPlt != PALETTE || pBg != BACKGROUND) {
    INIT();
  }
}

function INIT() {
  forms.length = 0;
  bsSize = min(width, height);
  colors = createPlette();
  pSd = SEED;
  pPlt = PALETTE;
  pBg = BACKGROUND;
  addForms();
  background(colors[BACKGROUND - 1]);
}

function addForms() {
  // number of flowers in total
  let n = int(map(max(width, height), 800, 2200, 5, 8, true));
  for (let i = 0; i < n; i++) {
    forms.push(new Form(i));
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  INIT();
}

function createPlette() {
  return PALETTE;
}

class Form {
  constructor(index) {
    this.index = index;
    this.buffer = createGraphics(windowWidth, windowHeight);
    this.buffer.pixelDensity(1);
    this.reset(true);
  }

  reset(first = false) {
    this.buffer.clear();
    this.x = random(0.12, 0.88) * width;
    this.y = random(0.14, 0.86) * height;
    this.d = 0;
    // size of flowers
    this.dMax = random(bsSize * 0.2, bsSize * 0.35);
    this.col = random(colors.filter(c => c !== colors[BACKGROUND - 1]));
    this.fr = random(10284701987);
    // delay before each flower appears
    // the larger the value, the later flower appears, and the slower the rhythm will be
    this.t = first ? -int(this.index * random(20, 36)) : -int(random(20, 100));
    this.state = 'grow';
    this.holdFrames = 90; // duration of staying on screen
    this.holdCounter = 0;
    this.opacity = 255;
  }

  showToBuffer() {
    this.buffer.noFill();
    let c = color(this.col);
    c.setAlpha(255);
    this.buffer.strokeWeight(bsSize * 0.00007);
    this.buffer.stroke(c);
    this.buffer.beginShape();
    for (let i = 0; i < 30; i++) {
      let a = map(i, 0, 30, 0, TAU);
      let xx = this.x + this.d * 0.5 * cos(a);
      let yy = this.y + this.d * 0.5 * sin(a);
      let nScl = 10 / bsSize;
      let theta = noise(xx * nScl, yy * nScl, this.fr) * TAU * 2;
      xx += cos(theta) * this.d * 0.0002 * bsSize;
      yy += sin(theta) * this.d * 0.0002 * bsSize;
      this.buffer.vertex(xx, yy);
    }
    this.buffer.endShape(CLOSE);
  }

  // growth rate of each move
  move() {
    this.d += noise(frameCount * 0.1 * bsSize, this.x, this.y) * bsSize * 0.0009;
  }

  run() {
    if (this.t < 0) {
      this.t++;
      return;
    }

    if (this.state === 'grow') {
      // number of increments per frame
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