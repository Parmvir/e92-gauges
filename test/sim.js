// Fake ELM327 adapter + BMW DME for testing the protocol code without a car. Not loaded by the app.
// In the browser console: load this script, set SIM.variant, then connect('sim').
//   'iso'     MSD80 that wants ISO 14230 DDLI records (exercises the hand-built multi-frame send)
//   'compact' MSD80 that takes the short BMW record form
//   'single'  MSD80 with no DDLI support, only one-at-a-time $22 reads
//   'uds'     N55 MEVD17 (UDS $2C 01 F300)
//   'obd'     adapter without BMW features, standard OBD2 only
(() => {
  const SIM = window.SIM = { variant: 'iso', log: [], block: [] };
  const hx = a => a.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const t0 = performance.now();
  const engine = () => {
    const ph = ((performance.now() - t0) / 1000) % 8, pull = ph > 3 && ph < 7;
    return { rpm: pull ? 2500 + (ph - 3) * 1100 : 900, map: pull ? 225 : 40, mapTarget: pull ? 230 : 40, baro: 101.3,
      tps: pull ? 99.6 : 0, timing: pull ? 8 : 15, lambda: pull ? 0.8 : 1, lambdaTarget: pull ? 0.8 : 1, wgdc: pull ? 70 : 10,
      lpfp: 5.1, rail: pull ? 180 : 50, load: pull ? 90 : 20, ect: 95, iat: 30, oil: 105, speed: 50, gear: 3,
      stft: 1.6, ltft: -2.3, volts: 14.1 };
  };
  const channels = () => PROFILES[SIM.variant === 'uds' ? 'mevd17' : 'msd80'].channels;
  const encode = (c, v) => {
    if (c.post) v = v / 100 + 1;   // only MEVD17 LTFT: stored as a factor
    let raw = Math.round((v - c.add) / c.mul);
    if (raw < 0) raw += 2 ** (c.size * 8);
    const out = [];
    for (let i = c.size - 1; i >= 0; i--) out.push(Math.floor(raw / 2 ** (8 * i)) & 255);
    return out;
  };
  const byId = id => channels().find(c => c.id === id);
  const values = () => { const e = engine(); return SIM.block.flatMap(c => encode(c, e[c.key])); };

  function dme(q) {
    const id = (q[1] << 8) | q[2];
    if (SIM.variant === 'uds') {
      if (q[0] === 0x2C && q[1] === 0x03) { SIM.block = []; return [0x6C, 0x03, 0xF3, 0x00]; }
      if (q[0] === 0x2C && q[1] === 0x01) {
        const c = q.length === 8 && byId((q[4] << 8) | q[5]);
        if (!c) return [0x7F, 0x2C, 0x31];
        SIM.block.push(c); return [0x6C, 0x01, 0xF3, 0x00];
      }
      if (q[0] === 0x22 && id === 0xF300) return SIM.block.length ? [0x62, 0xF3, 0x00, ...values()] : [0x7F, 0x22, 0x31];
      if (q[0] === 0x2C) return [0x7F, 0x2C, 0x12];
    } else if (q[0] === 0x2C || q[0] === 0x21) {
      if (SIM.variant === 'single') return [0x7F, q[0], 0x11];
      if (q[0] === 0x2C && q[2] === 0x04) { SIM.block = []; return [0x6C, 0xF0]; }
      if (q[0] === 0x2C && q[2] === 0x02) {
        const iso = SIM.variant === 'iso';
        if (q.length !== (iso ? 8 : 5)) return [0x7F, 0x2C, 0x13];
        const c = byId(iso ? (q[5] << 8) | q[6] : (q[3] << 8) | q[4]);
        if (!c) return [0x7F, 0x2C, 0x31];
        SIM.block.push(c); return [0x6C, 0xF0];
      }
      if (q[0] === 0x21) return SIM.block.length ? [0x61, 0xF0, ...values()] : [0x7F, 0x21, 0x31];
    }
    if (q[0] === 0x22) { const c = byId(id); return c ? [0x62, q[1], q[2], ...encode(c, engine()[c.key])] : [0x7F, 0x22, 0x31]; }
    return [0x7F, q[0], 0x11];
  }

  const SUP = [0x04, 0x05, 0x06, 0x07, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x11, 0x20, 0x24, 0x33, 0x40, 0x42, 0x44, 0x5C];
  function obd(b) {
    if (b[0] !== 0x01) return 'NO DATA';
    if ([0x00, 0x20, 0x40].includes(b[1])) {
      const m = [0, 0, 0, 0];
      for (const p of SUP) if (p > b[1] && p <= b[1] + 32) { const i = p - b[1] - 1; m[i >> 3] |= 0x80 >> (i & 7); }
      return hx([0x41, b[1], ...m]);
    }
    const e = engine(), out = [0x41], w = v => [Math.round(v) >> 8, Math.round(v) & 255];
    const pid = { 0x0C: w(e.rpm * 4), 0x0B: [Math.round(e.map) & 255], 0x11: [Math.round(e.tps * 2.55)], 0x0E: [Math.round((e.timing + 64) * 2)],
      0x24: [...w(e.lambda * 32768), 0, 0], 0x44: w(e.lambdaTarget * 32768), 0x04: [Math.round(e.load * 2.55)], 0x33: [101],
      0x05: [e.ect + 40], 0x0F: [e.iat + 40], 0x5C: [e.oil + 40], 0x0D: [e.speed], 0x06: [130], 0x07: [125], 0x42: w(14100) };
    for (const p of b.slice(1)) if (pid[p]) out.push(p, ...pid[p]);
    if (out.length <= 7) return hx(out);
    const lines = [out.length.toString(16).toUpperCase().padStart(3, '0'), '0:' + hx(out.slice(0, 6))];
    for (let i = 6, n = 1; i < out.length; i += 7, n++) lines.push((n % 16).toString(16).toUpperCase() + ':' + hx(out.slice(i, i + 7)));
    return lines.join('\r');
  }

  // The ELM327 chip itself: takes typed text, calls out() with what it prints
  function adapter(out) {
    const st = { caf: true, r: true, rx: null };
    const reply = s => setTimeout(() => out(s + '\r\r>'), 4);
    // DME → tester frames the way an ELM prints them with headers on and spaces off
    const frames = msg => {
      if (msg.length <= 6) return ['612F1' + hx([msg.length, ...msg])];
      const out = ['612F1' + hx([0x10 | (msg.length >> 8), msg.length & 255, ...msg.slice(0, 5)])];
      for (let i = 5, s = 1; i < msg.length && st.caf; i += 6, s++) out.push('612F1' + hx([0x20 | (s & 15), ...msg.slice(i, i + 6)]));
      return out;
    };
    function handle(c) {
      SIM.log.push(c);
      if (!c) return reply('');
      if (/^(AT|ST)/.test(c)) {
        if (c === 'ATZ' || c === 'ATI') { Object.assign(st, c === 'ATZ' ? { caf: true, r: true } : {}); return reply('ELM327 v1.5'); }
        if (c.startsWith('ST') || (SIM.variant === 'obd' && c === 'ATCEA12')) return reply('?');
        if (c === 'ATCAF0' || c === 'ATCAF1') st.caf = c.endsWith('1');
        if (c === 'ATR0' || c === 'ATR1') st.r = c.endsWith('1');
        if (c === 'ATRV') return reply('14.1V');
        if (c === 'ATDPN') return reply('A6');
        return reply('OK');
      }
      const b = c.match(/../g).map(h => parseInt(h, 16));
      if (SIM.variant === 'obd') return reply(obd(b));
      let q = null;
      if (st.caf) {
        if (b.length > 6) return reply('?');   // a plain ELM327 can't segment
        q = b;
      } else {
        const pci = b[1];
        if (pci >> 4 === 1) { st.rx = { len: ((pci & 15) << 8) | b[2], data: b.slice(3) }; return reply('612F1' + hx([0x30, 0, 0, 0, 0, 0, 0])); }
        if (pci >> 4 === 2 && st.rx) {
          st.rx.data.push(...b.slice(2));
          if (st.rx.data.length < st.rx.len) return reply(st.r ? 'NO DATA' : '');
          q = st.rx.data.slice(0, st.rx.len); st.rx = null;
        } else if (pci >> 4 === 0) q = b.slice(2, 2 + (pci & 15));
      }
      reply(q ? frames(dme(q)).join('\r') : 'NO DATA');
    }
    let line = '';
    return {
      write(s) {
        line += s;
        for (let i; (i = line.indexOf('\r')) >= 0; line = line.slice(i + 1)) handle(line.slice(0, i).replace(/\s/g, '').toUpperCase());
      },
    };
  }

  TRANSPORTS.sim = async () => {
    const t = { onData: () => {}, onClose: () => {}, close() {} };
    t.write = adapter(s => t.onData(s)).write;
    return t;
  };

  // Fake FTDI USB cable for the WebUSB path: its ELM chip only talks at SIM.usb.baud, and every
  // 64-byte packet it sends starts with two modem-status bytes, like the real FT232R.
  SIM.usb = { baud: 115200, ctl: [] };
  const FTDI_DIVISORS = { 0x4138: 9600, 0xC04E: 38400, 0x001A: 115200, 0x0006: 500000 };   // FTDI's published values
  const fakeFtdi = () => {
    let baud = 0, closed = false;
    const queue = [], te = new TextEncoder(), td = new TextDecoder();
    const elm = adapter(s => {
      if (baud !== SIM.usb.baud) return;
      const b = te.encode(s);
      for (let i = 0; i < b.length; i += 62) queue.push([0x01, 0x60, ...b.slice(i, i + 62)]);
    });
    return {
      vendorId: 0x0403, productId: 0x6001, configuration: null,
      async open() {}, async claimInterface() {}, async releaseInterface() {}, async close() { closed = true; },
      async selectConfiguration() {
        this.configuration = { interfaces: [{ alternate: { endpoints: [
          { direction: 'in', type: 'bulk', endpointNumber: 1, packetSize: 64 },
          { direction: 'out', type: 'bulk', endpointNumber: 2, packetSize: 64 }] } }] };
      },
      async controlTransferOut(s) {
        SIM.usb.ctl.push([s.request, s.value, s.index]);
        if (s.request === 0x03) baud = FTDI_DIVISORS[s.value | (s.index << 16)] || -1;
        return { status: 'ok' };
      },
      async transferIn() {
        for (let i = 0; !queue.length && i < 3 && !closed; i++) await new Promise(r => setTimeout(r, 2));
        if (closed) throw new DOMException('device closed', 'NetworkError');
        return { status: 'ok', data: new DataView(new Uint8Array(queue.shift() || [0x01, 0x60]).buffer) };   // status-only when idle
      },
      async transferOut(ep, data) { if (baud === SIM.usb.baud) elm.write(td.decode(data)); return { status: 'ok' }; },
    };
  };
  Object.defineProperty(navigator, 'usb', { configurable: true, value: { requestDevice: async () => fakeFtdi() } });
})();
