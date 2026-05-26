const int PIR_PIN = 2;
const int BUTTON_PIN = 4;

int pirState = LOW;
int lastPirState = LOW;

int buttonStableState = HIGH;
int lastButtonReading = HIGH;
unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 35;

void setup() {
  pinMode(PIR_PIN, INPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  Serial.begin(115200);
  delay(300);

  pirState = digitalRead(PIR_PIN);
  lastPirState = pirState;
  buttonStableState = digitalRead(BUTTON_PIN);
  lastButtonReading = buttonStableState;

  sendPirState(pirState);
  sendButtonState(buttonStableState == LOW);
}

void loop() {
  readPir();
  readButton();
}

void readPir() {
  int reading = digitalRead(PIR_PIN);
  if (reading != lastPirState) {
    lastPirState = reading;
    pirState = reading;
    sendPirState(pirState);
  }
}

void readButton() {
  int reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonReading) {
    lastDebounceTime = millis();
    lastButtonReading = reading;
  }

  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != buttonStableState) {
      buttonStableState = reading;
      sendButtonState(buttonStableState == LOW);
    }
  }
}

void sendPirState(int state) {
  Serial.print("PIR:");
  Serial.println(state == HIGH ? 1 : 0);
}

void sendButtonState(bool pressed) {
  Serial.print("BUTTON:");
  Serial.println(pressed ? 1 : 0);
}