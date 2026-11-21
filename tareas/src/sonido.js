// Sonidos sin archivos: campana al acabar y ruido de fondo para concentrarse (blanco, rosa, marrón, lluvia).
let ctx = null;
const audio = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

export function campana(veces = 2) {
  try {
    const a = audio(); a.resume?.();
    for (let i = 0; i < veces; i++) {
      for (const [f, g] of [[880, 0.22], [1320, 0.08]]) {
        const o = a.createOscillator(), v = a.createGain();
        o.type = "sine"; o.frequency.value = f;
        const t0 = a.currentTime + i * 0.55;
        v.gain.setValueAtTime(0, t0); v.gain.linearRampToValueAtTime(g, t0 + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
        o.connect(v).connect(a.destination); o.start(t0); o.stop(t0 + 1.3);
      }
    }
  } catch {}
}

let fuente = null, volumen = null;
export const RUIDOS = { "": "Silencio", blanco: "Ruido blanco", rosa: "Ruido rosa", marron: "Ruido marrón", lluvia: "Lluvia" };

function buffer(tipo) {
  const a = audio(), n = a.sampleRate * 4, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, ult = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (tipo === "blanco") d[i] = w * 0.25;
    else if (tipo === "marron" || tipo === "lluvia") { ult = (ult + 0.02 * w) / 1.02; d[i] = ult * 3.2; }
    else { // rosa (Paul Kellet)
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.08; b6 = w * 0.115926;
    }
    if (tipo === "lluvia" && Math.random() < 0.0009) for (let k = 0; k < 300 && i + k < n; k++) d[i + k] += (Math.random() * 2 - 1) * 0.35 * Math.exp(-k / 60);
  }
  return b;
}
export function ruido(tipo, vol = 0.5) {
  try {
    if (fuente) { fuente.stop(); fuente.disconnect(); fuente = null; }
    if (!tipo) return;
    const a = audio(); a.resume?.();
    fuente = a.createBufferSource(); fuente.buffer = buffer(tipo); fuente.loop = true;
    volumen ||= a.createGain(); volumen.gain.value = vol;
    let nodo = fuente;
    if (tipo === "lluvia") { const f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 400; nodo = fuente.connect(f); }
    nodo.connect(volumen); volumen.connect(a.destination);
    fuente.start();
  } catch (e) { console.warn(e); }
}
export function volumenRuido(v) { if (volumen) volumen.gain.value = v; }
