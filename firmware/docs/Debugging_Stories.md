### Issue 1 : Random corruption of serial monitor after launch

***Description*** : Sometimes after launching the serial monitor, it would get populated with a stream of unknown characters. This stream of unknown characters would be continous until I close the serial monitor. But if I press the en pin on the esp32, it would trigger the POWERON RESET sequence and would initiate the serial monitor correctly,and I able abple to read and provide input to my program running on the esp32.

***Serial Monitor*** : (Here is a snippet of the serial monitor with a stream of unknown char, and after pressing the EN pin; triggering the POWERON RESET and correcting its behaviour)

```
␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xx��␀�␀�␀�␀�x��x��␀x�␀�xets Jul 29 2019 12:21:46

rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
configsip: 0, SPIWP:0xee
clk_drv:0x00,q_drv:0x00,d_drv:0x00,cs0_drv:0x00,hd_drv:0x00,wp_drv:0x00
mode:DIO, clock div:2
load:0x3fff0030,len:4640
load:0x40078000,len:15660
load:0x40080400,len:3164
entry 0x4008059c
```

***Hardware Setup*** :
- NodeMCU ESP32S
- NEMA17 Stepper Motor
- TB6600 Motor Driver
- Esp32 Breakout Board
- 12V SMPS

***Note***:
- This issue does not happen every time I open serial monitor. It happens occasionally.
- I have also swapped out my esp32, and this issue still persists.