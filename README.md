# E92 335i Gauges

Live gauges for the E92 335i (N54 / N55): boost and boost target, AFR and lambda target, low-pressure and rail fuel pressure, wastegate duty, charge-air, oil and coolant temps, timing, gear, plus a shift light and CSV logging.

**Open it:** https://parmvir.github.io/e92-gauges/

It talks straight to the DME over BMW D-CAN (the same diagnostic protocol INPA, MHD and bootmod3 use), bundling every gauge into one request per update. If the adapter can't do that, it falls back to standard OBD2.

## What you need

- A **Bluetooth LE** OBD2 adapter. OBDLink CX is the safe choice (works with BMW D-CAN and with iPhone). Cheap ELM327 clones may only manage standard OBD2.
- **Android:** Chrome. Open the link, then menu → *Add to Home screen*.
- **iPhone:** Safari can't use Bluetooth. Open the link in the free *Bluefy – Web BLE Browser* app.
- **Computer:** Chrome or Edge, with a USB adapter or a Bluetooth one.

Ignition on, tap **Connect**, pick the adapter. **Demo** shows the gauges without a car.

## Notes

- Read-only. The bundle of values is defined in the DME's temporary memory and clears when the ignition goes off.
- A JB4 uses the same diagnostic channel, so unplug it while using this.
- `test/sim.js` is a fake adapter + DME for testing the protocol code in the browser console; the app never loads it.
