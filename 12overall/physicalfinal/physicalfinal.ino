#include <Servo.h>
// pin settings
// HC-SR04
const int trigPin = 2;
const int echoPin = 3;
// button
const int buttonPin = 4;
// FS90R servos
const int leftServoPin = 10;
const int rightServoPin = 6;

Servo leftServo;
Servo rightServo;


// stop values measured
const int leftStop = 1420;
const int rightStop = 1470;

// phase A: one direction
const int leftA = 1530;
const int rightA = 1500;

// phase B: opposite direction
const int leftB = 1360;
const int rightB = 1390;

// debug off by default because extra serial output may interfere with webpage parsing
const bool motorDebug = false;


// anxiety1 motor timing
const unsigned long anxiety1MoveMin = 70;
const unsigned long anxiety1MoveMax = 140;

const unsigned long anxiety1InnerStopMin = 80;
const unsigned long anxiety1InnerStopMax = 180;

// long random pause
const unsigned long anxiety1LongPauseMin = 2200;
const unsigned long anxiety1LongPauseMax = 6200;


// anxiety2 motor timing
const unsigned long anxiety2MoveMin = 360;
const unsigned long anxiety2MoveMax = 560;

const unsigned long anxiety2StopAMin = 180;
const unsigned long anxiety2StopAMax = 420;

const unsigned long anxiety2StopBMin = 220;
const unsigned long anxiety2StopBMax = 520;


// HC-SR04 / button settings
// smaller than this distance(cm) is treated as "visitor is near"
const int distanceThresholdCm = 250;

// how many consecutive readings are required before state changes
const int requiredStableReads = 3;

// button debounce time
const unsigned long debounceDelay = 50;

// interval between ultrasonic readings
const unsigned long ultrasonicInterval = 60;

// pulsein timeout
const unsigned long echoTimeoutUs = 30000;


// internal sensor states
// ultrasonic state
bool nearState = false;
int nearCounter = 0;
int farCounter = 0;
unsigned long lastUltrasonicRead = 0;

// button state
bool lastButtonReading = HIGH;
bool stableButtonState = HIGH;
unsigned long lastDebounceTime = 0;

// incoming command buffer from browser
String serialInputBuffer = "";

// motor states
enum MotorMode {
  MOTOR_ANXIETY_1,
  MOTOR_ANXIETY_2,
  MOTOR_STOPPED
};

enum MotorStep {
  STEP_IDLE_STOP,
  STEP_PHASE_A,
  STEP_STOP_AFTER_A,
  STEP_PHASE_B,
  STEP_STOP_AFTER_B
};

MotorMode motorMode = MOTOR_ANXIETY_1;
MotorStep motorStep = STEP_IDLE_STOP;

unsigned long motorStepStartedAt = 0;
unsigned long motorStepDuration = 0;


// HC-SR04 distance reading
long readDistanceCm() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  unsigned long duration = pulseIn(echoPin, HIGH, echoTimeoutUs);

  if (duration == 0) {
    return -1;
  }

  long distance = (long)(duration * 0.0343 / 2.0);
  return distance;
}


// basic motor writing
void stopBothMotors() {
  leftServo.writeMicroseconds(leftStop);
  rightServo.writeMicroseconds(rightStop);
}

void writePhaseA() {
  leftServo.writeMicroseconds(leftA);
  rightServo.writeMicroseconds(rightA);
}

void writePhaseB() {
  leftServo.writeMicroseconds(leftB);
  rightServo.writeMicroseconds(rightB);
}


// motor mode control
void setMotorMode(MotorMode newMode) {
  motorMode = newMode;
  motorStep = STEP_IDLE_STOP;
  motorStepStartedAt = millis();
  motorStepDuration = 0;

  stopBothMotors();

  if (newMode == MOTOR_ANXIETY_1) {
    // in anxiety1, do not move immediately. wait for a random pause
    motorStepDuration = random(anxiety1LongPauseMin, anxiety1LongPauseMax);
  }

  if (motorDebug) {
    if (newMode == MOTOR_ANXIETY_1) Serial.println("MOTOR_MODE:ANXIETY_1");
    if (newMode == MOTOR_ANXIETY_2) Serial.println("MOTOR_MODE:ANXIETY_2");
    if (newMode == MOTOR_STOPPED) Serial.println("MOTOR_MODE:STOPPED");
  }
}


// anxiety1 movement
void enterAnxiety1Step(MotorStep nextStep) {
  motorStep = nextStep;
  motorStepStartedAt = millis();

  if (nextStep == STEP_PHASE_A) {
    writePhaseA();
    motorStepDuration = random(anxiety1MoveMin, anxiety1MoveMax);
  }
  else if (nextStep == STEP_STOP_AFTER_A) {
    stopBothMotors();
    motorStepDuration = random(anxiety1InnerStopMin, anxiety1InnerStopMax);
  }
  else if (nextStep == STEP_PHASE_B) {
    writePhaseB();
    motorStepDuration = random(anxiety1MoveMin, anxiety1MoveMax);
  }
  else if (nextStep == STEP_STOP_AFTER_B) {
    stopBothMotors();

    motorStepDuration = random(anxiety1LongPauseMin, anxiety1LongPauseMax);
  }
  else if (nextStep == STEP_IDLE_STOP) {
    stopBothMotors();
    motorStepDuration = random(anxiety1LongPauseMin, anxiety1LongPauseMax);
  }
}

void updateAnxiety1Motor() {
  unsigned long now = millis();

  if (motorStep == STEP_IDLE_STOP) {
    // stay still for a while, then start a complete subtle cycle
    if (now - motorStepStartedAt >= motorStepDuration) {
      enterAnxiety1Step(STEP_PHASE_A);
    }
    return;
  }

  if (now - motorStepStartedAt < motorStepDuration) {
    return;
  }

  if (motorStep == STEP_PHASE_A) {
    enterAnxiety1Step(STEP_STOP_AFTER_A);
  }
  else if (motorStep == STEP_STOP_AFTER_A) {
    enterAnxiety1Step(STEP_PHASE_B);
  }
  else if (motorStep == STEP_PHASE_B) {
    enterAnxiety1Step(STEP_STOP_AFTER_B);
  }
  else if (motorStep == STEP_STOP_AFTER_B) {
    // after the long pause, start another occasional full cycle
    enterAnxiety1Step(STEP_PHASE_A);
  }
}


// anxiety2 movement
void enterAnxiety2Step(MotorStep nextStep) {
  motorStep = nextStep;
  motorStepStartedAt = millis();

  if (nextStep == STEP_PHASE_A) {
    writePhaseA();
    motorStepDuration = random(anxiety2MoveMin, anxiety2MoveMax);
  }
  else if (nextStep == STEP_STOP_AFTER_A) {
    stopBothMotors();
    motorStepDuration = random(anxiety2StopAMin, anxiety2StopAMax);
  }
  else if (nextStep == STEP_PHASE_B) {
    writePhaseB();
    motorStepDuration = random(anxiety2MoveMin, anxiety2MoveMax);
  }
  else if (nextStep == STEP_STOP_AFTER_B) {
    stopBothMotors();
    motorStepDuration = random(anxiety2StopBMin, anxiety2StopBMax);
  }
}

void updateAnxiety2Motor() {
  unsigned long now = millis();

  if (motorStep == STEP_IDLE_STOP) {
    enterAnxiety2Step(STEP_PHASE_A);
    return;
  }

  if (now - motorStepStartedAt < motorStepDuration) {
    return;
  }

  if (motorStep == STEP_PHASE_A) {
    enterAnxiety2Step(STEP_STOP_AFTER_A);
  }
  else if (motorStep == STEP_STOP_AFTER_A) {
    enterAnxiety2Step(STEP_PHASE_B);
  }
  else if (motorStep == STEP_PHASE_B) {
    enterAnxiety2Step(STEP_STOP_AFTER_B);
  }
  else if (motorStep == STEP_STOP_AFTER_B) {
    enterAnxiety2Step(STEP_PHASE_A);
  }
}


// main motor update
void updateMotorMotion() {
  if (motorMode == MOTOR_STOPPED) {
    stopBothMotors();
    return;
  }

  if (motorMode == MOTOR_ANXIETY_1) {
    updateAnxiety1Motor();
    return;
  }

  if (motorMode == MOTOR_ANXIETY_2) {
    updateAnxiety2Motor();
    return;
  }
}


// incoming commands from browser
void handleSerialCommand(String command) {
  command.trim();
  command.toUpperCase();

  if (command == "SERVO:A1") {
    setMotorMode(MOTOR_ANXIETY_1);
  }
  else if (command == "SERVO:A2") {
    setMotorMode(MOTOR_ANXIETY_2);
  }
  else if (command == "SERVO:STOP") {
    setMotorMode(MOTOR_STOPPED);
  }
}

void updateIncomingSerialCommands() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();

    if (c == '\n' || c == '\r') {
      if (serialInputBuffer.length() > 0) {
        handleSerialCommand(serialInputBuffer);
        serialInputBuffer = "";
      }
    } else {
      serialInputBuffer += c;

      // safety: avoid runaway buffer if a malformed line arrives
      if (serialInputBuffer.length() > 48) {
        serialInputBuffer = "";
      }
    }
  }
}


// setup
void setup() {
  Serial.begin(115200);

  // sensor / button pins
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buttonPin, INPUT_PULLUP);

  // servo setup
  leftServo.attach(leftServoPin);
  rightServo.attach(rightServoPin);
  stopBothMotors();

  randomSeed(analogRead(A0));

  // give system a short time to stabilise
  delay(1000);

  // initial serial state for webpage
  Serial.println("PIR:0");
  Serial.println("BUTTON:0");

  // start in anxiety 1 subtle mode by default
  setMotorMode(MOTOR_ANXIETY_1);
}


// loop
void loop() {
  // read commands from the webpage first
  updateIncomingSerialCommands();

  // motor movement is non-blocking, so ultrasonic/button can still update
  updateMotorMotion();

  // HC-SR04: near / far detection
  if (millis() - lastUltrasonicRead >= ultrasonicInterval) {
    lastUltrasonicRead = millis();

    long distanceCm = readDistanceCm();

    bool detectedNear = (distanceCm > 0 && distanceCm < distanceThresholdCm);

    if (detectedNear) {
      nearCounter++;
      farCounter = 0;
    } else {
      farCounter++;
      nearCounter = 0;
    }

    // far to near
    if (!nearState && nearCounter >= requiredStableReads) {
      nearState = true;

      // keep webpage protocol unchanged
      Serial.println("PIR:1");
    }

    // near to far
    if (nearState && farCounter >= requiredStableReads) {
      nearState = false;

      // keep webpage protocol unchanged
      Serial.println("PIR:0");
    }
  }

  // button: debounce + state change output
  bool currentButtonReading = digitalRead(buttonPin);

  if (currentButtonReading != lastButtonReading) {
    lastDebounceTime = millis();
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (currentButtonReading != stableButtonState) {
      stableButtonState = currentButtonReading;

      if (stableButtonState == LOW) {
        // keep webpage protocol unchanged
        Serial.println("BUTTON:1");
      } else {
        // keep webpage protocol unchanged
        Serial.println("BUTTON:0");
      }
    }
  }

  lastButtonReading = currentButtonReading;
}