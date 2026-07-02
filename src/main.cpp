#include <Arduino.h>
#include <WiFi.h>
#include <AccelStepper.h>

/* ESP32 Native Pins connected to 74HC595 */
#define MUX_DATA_PIN 21   // Labeled 125 DATA -> SER (Pin 14)[cite: 1]
#define MUX_BCLK_PIN 16   // Labeled 125 BCK  -> SRCLK (Pin 11)[cite: 1]
#define MUX_WS_PIN   17   // Labeled 125 WS   -> RCLK (Pin 12)[cite: 1]

/* 74HC595 Parallel Output Bit Indices (0-7) */
#define XYZ_EN_BIT   0    // QA -> Global Driver Enable (Active Low)[cite: 1]
#define X_STEP_BIT   1    // QB -> X-Axis Step[cite: 1]
#define X_DIR_BIT    2    // QC -> X-Axis Direction[cite: 1]
#define Y_STEP_BIT   5    // QF -> Y-Axis Step[cite: 1]
#define Y_DIR_BIT    6    // QG -> Y-Axis Direction[cite: 1]

/* Global byte tracking the 8-bit state of the Shift Register */
// Start with Enable Bit (Bit 0) HIGH so drivers are safe until explicitly cleared.
volatile uint8_t shiftRegisterState = 0b00000001; 

/* AccelStepper Callbacks */
void handleStepXForward();
void handleStepXBackward();
void handleStepYForward();
void handleStepYBackward();

/* Initialising AccelStepper with callback functions */
AccelStepper stepperX(handleStepXForward, handleStepXBackward);
AccelStepper stepperY(handleStepYForward, handleStepYBackward);

TaskHandle_t StepperTaskHandle = NULL;

const char *ssid = "AibotInk workshop";
const char *password = "Aibotink@123";

/* Core Shift Register SPI Write Execution */
void writeShiftRegister() {
  digitalWrite(MUX_WS_PIN, LOW);
  shiftOut(MUX_DATA_PIN, MUX_BCLK_PIN, MSBFIRST, shiftRegisterState);
  digitalWrite(MUX_WS_PIN, HIGH);
}

void printRegisterState(const char* context) {
  Serial.print("[SHIFT_REG] ");
  Serial.print(context);
  Serial.print(" -> Byte Value: 0b");
  // Print leading zeros for clarity
  for (int i = 7; i >= 0; i--) {
    Serial.print((shiftRegisterState >> i) & 0x01);
  }
  Serial.println();
}

void enableDrivers() {
  shiftRegisterState &= ~(1 << XYZ_EN_BIT); // Pull Bit 0 LOW (Active Low Enable)[cite: 1]
  writeShiftRegister();
  printRegisterState("DRIVERS ENABLED (Bit 0 set to 0)");
}

void disableDrivers() {
  shiftRegisterState |= (1 << XYZ_EN_BIT);  // Pull Bit 0 HIGH[cite: 1]
  writeShiftRegister();
  printRegisterState("DRIVERS DISABLED (Bit 0 set to 1)");
}

/* Dedicated Core 1 Loop for Motor Calculations */
void stepperCoreLoop(void *pvParameters) {
  Serial.println("[CORE 1] Stepper calculation engine spinning up...");
  enableDrivers();
  
  uint32_t loopCounter = 0;
  
  for (;;) {
    bool movingX = stepperX.run();
    bool movingY = stepperY.run();
    
    // Periodically trace task execution health to prove Core 1 isn't deadlocking
    if (++loopCounter >= 500000) {
      loopCounter = 0;
      Serial.printf("[CORE 1 TCK] Engine Active. X_Target: %ld, X_Pos: %ld | Y_Target: %ld, Y_Pos: %ld\n", 
                    stepperX.targetPosition(), stepperX.currentPosition(),
                    stepperY.targetPosition(), stepperY.currentPosition());
    }
    
    // Yield execution control cleanly to satisfy the ESP32 Task Watchdog
    vTaskDelay(0); 
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000); // Give serial monitor time to connect completely
  Serial.println("\n--- STARTING VENDING MACHINE DIAGNOSTIC FIRMWARE ---");

  // Initialize Shift Register Control Pins
  pinMode(MUX_DATA_PIN, OUTPUT);
  pinMode(MUX_BCLK_PIN, OUTPUT);
  pinMode(MUX_WS_PIN, OUTPUT);
  
  Serial.println("[INIT] Initializing 74HC595 control lines...");
  writeShiftRegister(); 
  printRegisterState("Initial Hard Reset Flush");

  // Connect to Network Layout
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("[WIFI] Connecting to network");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] WiFi connected! IP: " + WiFi.localIP().toString());

  // Configure AccelStepper Motion Profiles
  // Low speeds initially to ensure we can physically watch and trace structural logic
  stepperX.setMaxSpeed(400.0);     
  stepperX.setAcceleration(200.0);  
  
  stepperY.setMaxSpeed(400.0);
  stepperY.setAcceleration(200.0);

  Serial.println("[OS] Spawning StepperTask onto Core 1...");
  xTaskCreatePinnedToCore(
    stepperCoreLoop,     
    "StepperTask",       
    4096,                
    NULL,                
    1,                   
    &StepperTaskHandle,  
    1                    
  );
}

void loop() {
  // If the motor is sitting completely idle, give it a new command destination alternating back and forth!
  if (stepperX.distanceToGo() == 0) {
    long nextTargetX = (stepperX.currentPosition() == 0) ? 2000 : 0;
    Serial.printf("\n[LOOP] X Axis completed movement. Routing to new target destination: %ld\n", nextTargetX);
    stepperX.moveTo(nextTargetX);
  }

  delay(1000);

  if (stepperY.distanceToGo() == 0) {
    long nextTargetY = (stepperY.currentPosition() == 0) ? -2000 : 0;
    Serial.printf("\n[LOOP] Y Axis completed movement. Routing to new target destination: %ld\n", nextTargetY);
    stepperY.moveTo(nextTargetY);
  }

  delay(1000); 
}

/* Stepper Motor Callback with  */

void handleStepXForward() {
  // 1. Set and write Direction first
  shiftRegisterState |= (1 << X_DIR_BIT);
  writeShiftRegister();
  delayMicroseconds(1); // Gives the A4988 plenty of setup time
  
  // 2. Pulse Step HIGH
  shiftRegisterState |= (1 << X_STEP_BIT);
  writeShiftRegister();
  delayMicroseconds(5); 
  
  // 3. Pulse Step LOW
  shiftRegisterState &= ~(1 << X_STEP_BIT);
  writeShiftRegister();
}

void handleStepXBackward() {
  shiftRegisterState &= ~(1 << X_DIR_BIT);
  writeShiftRegister();
  delayMicroseconds(1);
  
  shiftRegisterState |= (1 << X_STEP_BIT);
  writeShiftRegister();
  delayMicroseconds(5);
  
  shiftRegisterState &= ~(1 << X_STEP_BIT);
  writeShiftRegister();
}

void handleStepYForward() {
  shiftRegisterState |= (1 << Y_DIR_BIT);
  writeShiftRegister();
  delayMicroseconds(1);
  
  shiftRegisterState |= (1 << Y_STEP_BIT);
  writeShiftRegister();
  delayMicroseconds(5);
  
  shiftRegisterState &= ~(1 << Y_STEP_BIT);
  writeShiftRegister();
}

void handleStepYBackward() {
  shiftRegisterState &= ~(1 << Y_DIR_BIT);
  writeShiftRegister();
  delayMicroseconds(1);
  
  shiftRegisterState |= (1 << Y_STEP_BIT);
  writeShiftRegister();
  delayMicroseconds(5);
  
  shiftRegisterState &= ~(1 << Y_STEP_BIT);
  writeShiftRegister();
}


/* Code Design:

- loop task (void setup() + void loop()) on Core 1 , Priority 1
- stepper task (void stepperCoreLoop()) on Core 1, Priority 1
- TCP/IP WiFi stack on Core 0

Execution Flow:

*/


