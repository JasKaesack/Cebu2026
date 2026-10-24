/* Cebu × Bohol — background music
   Original, generated live with the Web Audio API (no audio files, no third-party recordings).
   A relaxed island groove: ukulele-style strums, marimba melody, soft bass, shaker and a warm pad.
   I–vi–IV–V in C major at ~96 BPM, with small variations each pass so it doesn't feel looped. */
(function () {
  'use strict';
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { window.TripMusic = null; return; }

  var ctx = null, master = null, comp = null, verb = null, verbGain = null, noiseBuf = null;
  var playing = false, timer = 0, nextTime = 0, step = 0, bar = 0;
  var BPM = 96, SPB = 60 / BPM / 4;          // seconds per 16th note
  var VOL = 0.45;

  var mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  // chords as MIDI notes (ukulele-ish voicings) + bass root
  var CHORDS = [
    { name: 'C',  uke: [67, 72, 76, 79], bass: 36 },
    { name: 'Am', uke: [69, 72, 76, 81], bass: 33 },
    { name: 'F',  uke: [65, 69, 72, 77], bass: 29 },
    { name: 'G',  uke: [67, 71, 74, 79], bass: 31 }
  ];
  var PENTA = [72, 74, 76, 79, 81, 84, 86, 88];            // C major pentatonic, upper register
  var STRUM = [1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0]; // island strum: D . . . D . U . . . U . D . U .
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

  function build(c) {
    ctx = c || new AC();
    master = ctx.createGain(); master.gain.value = 0;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    // tiny feedback-delay "room" for warmth
    var d = ctx.createDelay(1.0); d.delayTime.value = SPB * 3;
    var fb = ctx.createGain(); fb.gain.value = 0.28;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    verb = ctx.createGain(); verbGain = ctx.createGain(); verbGain.gain.value = 0.22;
    verb.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(verbGain); verbGain.connect(comp);
    master.connect(comp); comp.connect(ctx.destination);
    // noise for the shaker
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    var ch = noiseBuf.getChannelData(0);
    for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  function out(node, send) {
    node.connect(master);
    if (send) { var s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(verb); }
  }
  function env(g, t, a, peak, decay, sustain) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + decay);
  }
  // plucked string: two detuned oscillators through a closing lowpass
  function pluck(m, t, vel) {
    var f = mtof(m), g = ctx.createGain(), flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.Q.value = 2;
    flt.frequency.setValueAtTime(f * 6, t); flt.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.35);
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f * 1.004;
    var g2 = ctx.createGain(); g2.gain.value = 0.25;
    o1.connect(flt); o2.connect(g2); g2.connect(flt); flt.connect(g);
    env(g, t, 0.004, 0.09 * vel, 0.9);
    out(g, 0.25);
    o1.start(t); o2.start(t); o1.stop(t + 1.1); o2.stop(t + 1.1);
  }
  // marimba: sine fundamental + 4x partial, quick decay
  function marimba(m, t, vel) {
    var f = mtof(m), g = ctx.createGain();
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    var o4 = ctx.createOscillator(); o4.type = 'sine'; o4.frequency.value = f * 4.0;
    var g4 = ctx.createGain(); env(g4, t, 0.002, 0.25, 0.08);
    o.connect(g); o4.connect(g4); g4.connect(g);
    env(g, t, 0.003, 0.16 * vel, 0.7);
    out(g, 0.35);
    o.start(t); o4.start(t); o.stop(t + 0.8); o4.stop(t + 0.3);
  }
  function bass(m, t, len) {
    var f = mtof(m), g = ctx.createGain(), o = ctx.createOscillator(), flt = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = f; flt.type = 'lowpass'; flt.frequency.value = 420;
    o.connect(flt); flt.connect(g);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    out(g, 0);
    o.start(t); o.stop(t + len + 0.05);
  }
  function shaker(t, vel) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    var g = ctx.createGain(); env(g, t, 0.005, 0.035 * vel, 0.06);
    s.connect(hp); hp.connect(g); out(g, 0);
    s.start(t); s.stop(t + 0.12);
  }
  function pad(chord, t, len) {
    var g = ctx.createGain(), flt = ctx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 0.6); g.gain.linearRampToValueAtTime(0.0001, t + len);
    flt.connect(g); out(g, 0.4);
    chord.uke.slice(0, 3).forEach(function (m, i) {
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m - 12); o.detune.value = (i - 1) * 7;
      o.connect(flt); o.start(t); o.stop(t + len + 0.1);
    });
  }

  var melody = [];
  function newPhrase() {           // 2-bar motif, reused with small changes → catchy but not mechanical
    melody = [];
    var idx = 2 + Math.floor(rnd() * 3);
    for (var i = 0; i < 32; i++) {
      var on = (i % 4 === 0 && rnd() < 0.8) || (i % 4 === 2 && rnd() < 0.45) || (i % 2 === 1 && rnd() < 0.12);
      if (on) { idx = Math.max(0, Math.min(PENTA.length - 1, idx + Math.round((rnd() - 0.5) * 3))); melody.push(PENTA[idx]); }
      else melody.push(0);
    }
  }
  newPhrase();

  function schedule(t, s) {
    var c = CHORDS[bar % 4], pos = s % 16;
    if (pos === 0 && bar % 2 === 0) pad(c, t, SPB * 32);
    // strum
    if (STRUM[pos]) {
      var up = pos % 4 !== 0, notes = up ? c.uke.slice().reverse() : c.uke;
      var v = pos === 0 ? 1 : up ? 0.6 : 0.8;
      notes.forEach(function (m, i) { pluck(m, t + i * 0.012, v); });
    }
    // bass: root on 1, fifth on 3, little pickup
    if (pos === 0) bass(c.bass, t, SPB * 6);
    if (pos === 8) bass(c.bass + 7, t, SPB * 5);
    if (pos === 14 && rnd() < 0.5) bass(c.bass + 12, t, SPB * 2);
    // shaker on 8ths, accents off-beat
    if (pos % 2 === 0) shaker(t, pos % 4 === 2 ? 1 : 0.55);
    // melody enters after the first two bars, rests every 4th phrase for breathing room
    if (bar >= 2 && Math.floor(bar / 8) % 4 !== 3) {
      var m = melody[(bar % 2) * 16 + pos];
      if (m) marimba(m, t, 0.8 + rnd() * 0.3);
    }
  }
  function tick() {
    while (nextTime < ctx.currentTime + 0.12) {
      schedule(nextTime, step);
      nextTime += SPB * ((step % 2) ? 0.92 : 1.08);      // light swing
      step++;
      if (step % 16 === 0) { bar++; if (bar % 8 === 0) newPhrase(); }
    }
  }

  function start() {
    if (!ctx) build();
    if (ctx.state === 'suspended') ctx.resume();
    if (playing) return true;
    playing = true;
    nextTime = ctx.currentTime + 0.08; step = 0; bar = 0;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(VOL, ctx.currentTime + 1.5);
    clearInterval(timer); timer = setInterval(tick, 25); tick();
    return true;
  }
  function stop() {
    if (!ctx || !playing) { playing = false; return false; }
    playing = false;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    setTimeout(function () { if (!playing) { clearInterval(timer); ctx.suspend && ctx.suspend(); } }, 700);
    return false;
  }
  // render the music offline (used only for testing / previewing; not called by the page)
  function renderOffline(sec) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var oc = new OAC(2, Math.ceil(44100 * sec), 44100);
    build(oc); master.gain.value = VOL;
    nextTime = 0.05; step = 0; bar = 0;
    while (nextTime < sec - 1) { schedule(nextTime, step); nextTime += SPB * ((step % 2) ? 0.92 : 1.08); step++; if (step % 16 === 0) { bar++; if (bar % 8 === 0) newPhrase(); } }
    var p = oc.startRendering(); ctx = null; return p;
  }
  window.TripMusic = {
    _renderOffline: renderOffline,
    start: start, stop: stop,
    toggle: function () { return playing ? stop() : start(); },
    get playing() { return playing; },
    get state() { return ctx ? ctx.state : 'none'; }
  };
})();
