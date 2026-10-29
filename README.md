# E92 335i Gauges

Live gauges for the E92 335i (N54 / N55): boost and boost target, AFR and lambda target, low-pressure and rail fuel pressure, wastegate duty, charge-air, oil and coolant temps, timing, gear, plus a shift light and CSV logging.

**Open it:** https://parmvir.github.io/e92-gauges/

It talks straight to the DME over BMW D-CAN (the same diagnostic protocol INPA, MHD and bootmod3 use), bundling every gauge into one request per update. If the adapter can't do that, it falls back to standard OBD2.

## What you need

- An OBD2 adapter:
  - **Bluetooth LE**: OBDLink CX is the safe choice (works with BMW D-CAN and with iPhone). Cheap ELM327 clones may only manage standard OBD2.
  - **USB cable** with an FTDI or CH340 chip, e.g. the "FORScan" ELM327 v1.5 cables (FT232RL + PIC18F25K80). Set the HS-CAN / MS-CAN switch to **HS-CAN**. The app finds the cable's speed by itself.
- **Android:** Chrome. Open the link, then menu → *Add to Home screen*. USB cables plug in through a USB-OTG adapter.
- **iPhone:** Safari can't use Bluetooth. Open the link in the free *Bluefy – Web BLE Browser* app. USB cables can't work on iPhone.
- **Computer:** Chrome or Edge, with a USB cable (pick *USB cable / COM port*) or a Bluetooth adapter.

Ignition on, tap **Connect**, pick the adapter. **Demo** shows the gauges without a car.

## Notes

- Read-only. The bundle of values is defined in the DME's temporary memory and clears when the ignition goes off.
- A JB4 uses the same diagnostic channel, so unplug it while using this.
- `test/sim.js` is a fake adapter + DME for testing the protocol code in the browser console; the app never loads it.
