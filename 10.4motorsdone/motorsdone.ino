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

// timing
// each movement duration. larger value = tray rotates more.
const unsigned long moveTime = 600;

// stop durations between movements
const unsigned long stopTimeA = 1500;
const unsigned long stopTimeB = 2000;

const bool motorDebug = false;


// HC-SR04 / button settings from previous file

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


// internal states

// ultrasonic state
bool nearState = false;
int nearCounter = 0;
int farCounter = 0;
unsigned long lastUltrasonicRead = 0;

// button state
bool lastButtonReading = HIGH;
bool stableButtonState = HIGH;
unsigned long lastDebounceTime = 0;

// motor state machine
enum MotorState {
  MOTOR_PHASE_A,
  MOTOR_STOP_AFTER_A,
  MOTOR_PHASE_B,
  MOTOR_STOP_AFTER_B
};

MotorState motorState = MOTOR_STOP_AFTER_B;
unsigned long motorStateStartedAt = 0;
unsigned long motorStateDuration = 0;


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


// motor control

void stopBothMotors() {
  leftServo.writeMicroseconds(leftStop);
  rightServo.writeMicroseconds(rightStop);
}

void enterMotorState(MotorState newState) {
  motorState = newState;
  motorStateStartedAt = millis();

  if (newState == MOTOR_PHASE_A) {
    if (motorDebug) Serial.println("MOTOR:PHASE_A");

    leftServo.writeMicroseconds(leftA);
    rightServo.writeMicroseconds(rightA);

    motorStateDuration = moveTime;
  }

  else if (newState == MOTOR_STOP_AFTER_A) {
    if (motorDebug) Serial.println("MOTOR:STOP_AFTER_A");

    stopBothMotors();
    motorStateDuration = stopTimeA;
  }

  else if (newState == MOTOR_PHASE_B) {
    if (motorDebug) Serial.println("MOTOR:PHASE_B");

    // opposite direction
    leftServo.writeMicroseconds(leftB);
    rightServo.writeMicroseconds(rightB);

    motorStateDuration = moveTime;
  }

  else if (newState == MOTOR_STOP_AFTER_B) {
    if (motorDebug) Serial.println("MOTOR:STOP_AFTER_B");

    stopBothMotors();
    motorStateDuration = stopTimeB;
  }
}

void updateMotorMotion() {
  unsigned long now = millis();

  if (now - motorStateStartedAt < motorStateDuration) {
    return;
  }

  if (motorState == MOTOR_PHASE_A) {
    enterMotorState(MOTOR_STOP_AFTER_A);
  }
  else if (motorState == MOTOR_STOP_AFTER_A) {
    enterMotorState(MOTOR_PHASE_B);
  }
  else if (motorState == MOTOR_PHASE_B) {
    enterMotorState(MOTOR_STOP_AFTER_B);
  }
  else if (motorState == MOTOR_STOP_AFTER_B) {
    enterMotorState(MOTOR_PHASE_A);
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

  // give system a short time to stabilise
  delay(1000);

  // initial serial state for webpage
  Serial.println("PIR:0");
  Serial.println("BUTTON:0");

  // start tray motion
  enterMotorState(MOTOR_PHASE_A);
}


// loop

void loop() {
  // motor movement is non-blocking, so ultrasonic / button can still update
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
      Serial.println("PIR:1");
    }

    // near to far
    if (nearState && farCounter >= requiredStableReads) {
      nearState = false;
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
        Serial.println("BUTTON:1");
      } else {
        Serial.println("BUTTON:0");
      }
    }
  }

  lastButtonReading = currentButtonReading;
}