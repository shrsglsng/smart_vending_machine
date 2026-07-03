#include "Arduino.h"
#include "AccelStepper.h"

/* TB6600 Config: 1A and 1/8 MicroStep */

#define SLOT_DISTANCE_X 4800 // in steps (corresponods to 12cm)
#define SLOT_DISTANCE_Y 4000 //(corresponds to 10 cm)

const int x_step_pin = 17;
const int x_dir_pin = 16;

const int y_step_pin = 19;
const int y_dir_pin = 18;

const int x_limit_switch = 23;
const int y_limit_switch = 22;

void move_1_slot_distance_x();
void move_1_slot_distance_y();
void all_axis_homing();
void handleCommand(String cmd);

AccelStepper StepperX(AccelStepper::DRIVER, x_step_pin, x_dir_pin);
AccelStepper StepperY(AccelStepper::DRIVER, y_step_pin, y_dir_pin);

char received_char;
String received_data = "";

void setup()
{
    Serial.begin(115200);

    pinMode(x_limit_switch, INPUT_PULLUP); // PRESSED == LOW
    pinMode(y_limit_switch, INPUT_PULLUP);

    StepperX.setMaxSpeed(8000);
    StepperX.setAcceleration(3000);
    StepperX.setMinPulseWidth(10);

    StepperY.setMaxSpeed(8000);
    StepperY.setAcceleration(3000);
    StepperY.setMinPulseWidth(10);

    all_axis_homing();
}

void loop()
{
    while (Serial.available())
    {
        received_char = (char)Serial.read();
        if (received_char == '\n' || received_char == '\r')
        {
            if (received_data.length() != 0)
            {
                handleCommand(received_data);
                received_data = "";
            }
        }
        else
        {
            received_data += received_char;
        }
    }
}

void move_1_slot_distance_x()
{
    StepperX.setCurrentPosition(0);
    StepperX.moveTo(-SLOT_DISTANCE_X); //-ve for CCW rotation

    while (StepperX.distanceToGo() != 0)
    {
        StepperX.run();
    }
}

void move_1_slot_distance_y()
{
    StepperY.setCurrentPosition(0);
    StepperY.moveTo(-SLOT_DISTANCE_Y);

    while (StepperY.distanceToGo() != 0)
    {
        StepperY.run();
    }
}

void all_axis_homing()
{
    /* homing sequence : first x-axis homing then y axis homing */

    if (digitalRead(x_limit_switch) != LOW || digitalRead(y_limit_switch) != LOW)
    {
        StepperX.setSpeed(8000);
        StepperY.setSpeed(8000);

        while (digitalRead(x_limit_switch) != LOW)
        {
            StepperX.runSpeed();
        }

        while (digitalRead(y_limit_switch) != LOW)
        {
            StepperY.runSpeed();
        }

        StepperX.setCurrentPosition(0);
        StepperY.setCurrentPosition(0);
    }
}

void handleCommand(String cmd)
{
    cmd.trim();

    all_axis_homing();

    if (cmd == "S1")
    {
        all_axis_homing();
    }
    else if (cmd == "S2")
    {
        StepperX.moveTo(-SLOT_DISTANCE_X); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }
    else if (cmd == "S3")
    {
        StepperX.moveTo(-(2 * SLOT_DISTANCE_X)); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }
    else if (cmd == "S4")
    {
        StepperY.moveTo(-SLOT_DISTANCE_Y);

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
    }
    else if (cmd == "S5")
    {
        StepperY.moveTo(-SLOT_DISTANCE_Y);

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }

        StepperX.moveTo(-SLOT_DISTANCE_X); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }
    else if (cmd == "S6")
    {
        StepperY.moveTo(-SLOT_DISTANCE_Y);

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
        StepperX.moveTo(-(2 * SLOT_DISTANCE_X)); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }
    else if (cmd == "S7")
    {
        StepperY.moveTo(-(2 * SLOT_DISTANCE_Y));

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
    }
    else if (cmd == "S8")
    {
        StepperY.moveTo(-(2 * SLOT_DISTANCE_Y));

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
        StepperX.moveTo(-SLOT_DISTANCE_X); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }
    else if (cmd == "S9")
    {
        StepperY.moveTo(-(2 * SLOT_DISTANCE_Y));

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
        StepperX.moveTo(-(2 * SLOT_DISTANCE_X)); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }
    else if (cmd == "S10")
    {
        StepperY.moveTo(-(3 * SLOT_DISTANCE_Y));

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
    }
    else if (cmd == "S11")
    {
        StepperY.moveTo(-(3 * SLOT_DISTANCE_Y));

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
        StepperX.moveTo(-SLOT_DISTANCE_X); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }
    else if (cmd == "S12")
    {
        StepperY.moveTo(-(3 * SLOT_DISTANCE_Y));

        while (StepperY.distanceToGo() != 0)
        {
            StepperY.run();
        }
        StepperX.moveTo(-(2 * SLOT_DISTANCE_X)); //-ve for CCW rotation

        while (StepperX.distanceToGo() != 0)
        {
            StepperX.run();
        }
    }

    delay(2000);

    all_axis_homing();
}
