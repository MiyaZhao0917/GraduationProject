const int trigPin = 2;
const int echoPin = 3;
const int buttonPin = 4;

// smaller than this distance(cm) is treated as "visitor is near"
const int distanceThresholdCm = 280;

// how many consecutive readings are required before state changes
const int requiredStableReads = 3;

// button debounce time (milliseconds)
const unsigned long debounceDelay = 50;

// interval between  ultrasonic readings
const unsigned long ultrasonicInterval = 60;

// pulseIn timeout (microseconds)
// 30000us corresponds to approximately 5 meters of echo time, which is suitable for my project
const unsigned long echoTimeoutUs = 30000;


bool nearState = false;           // current “close” state: false = away, true = close
int nearCounter = 0;              // number of consecutive detections of "close"
int farCounter = 0;               // number of consecutive detections of "away"
unsigned long lastUltrasonicRead = 0;

bool lastButtonReading = HIGH;
bool stableButtonState = HIGH;
unsigned long lastDebounceTime = 0;

// HC-SR04 distance reading
long readDistanceCm() {
  // give trig a low-level signal first
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  // send 10us high-level pulse
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // read echo time
  unsigned long duration = pulseIn(echoPin, HIGH, echoTimeoutUs);

  // duration == 0 indicates a timeout situation, meaning no valid echo has been received
  if (duration == 0) {
    return -1;
  }

  // convert sound speed into distance: cm = us * 0.0343 / 2
  long distance = (long)(duration * 0.0343 / 2.0);
  return distance;
}

void setup() {
  Serial.begin(115200);

  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  pinMode(buttonPin, INPUT_PULLUP);

  // give system a short time to stabilise
  delay(1000);

  // initial serial state for webpage
  Serial.println("PIR:0");
  Serial.println("BUTTON:0");
}

void loop() {
  // HC-SR04: near / far detection
  if (millis() - lastUltrasonicRead >= ultrasonicInterval) {
    lastUltrasonicRead = millis();

    long distanceCm = readDistanceCm();

    // as long as it is within the valid range and less than the threshold, this frame is considered to have detected "close"
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