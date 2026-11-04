const PLAIN_SOUND = { vibrato: 0, tremolo: 0, bite: 0, breath: 0, scoop: 0, voices: 1, body: "plain" };

const SOUND_PRESETS = {
  piano: { ...PLAIN_SOUND, waveform: "triangle", volume: 0.7, brightness: 6000, attack: 0.004, decay: 1.2, sustain: 0, release: 0.15, overtone: 0.3, detune: 2, room: 0.2 },
  "electric piano": { ...PLAIN_SOUND, waveform: "sine", volume: 0.75, brightness: 4000, attack: 0.003, decay: 1.6, sustain: 0.05, release: 0.3, overtone: 0.5, detune: 6, room: 0.25, tremolo: 0.15 },
  organ: { ...PLAIN_SOUND, waveform: "sine", volume: 0.55, brightness: 3000, attack: 0.02, decay: 10, sustain: 1, release: 0.08, overtone: 0.8, detune: 3, room: 0.35 },
  "music box": { ...PLAIN_SOUND, waveform: "sine", volume: 0.7, brightness: 9000, attack: 0.001, decay: 0.35, sustain: 0, release: 0.3, overtone: 0.6, detune: 0, room: 0.4 },
  vibraphone: { ...PLAIN_SOUND, waveform: "sine", volume: 0.75, brightness: 7000, attack: 0.002, decay: 2.8, sustain: 0, release: 0.9, overtone: 0.25, detune: 1, room: 0.5, tremolo: 0.45 },
  "soft pad": { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.45, brightness: 1400, attack: 0.35, decay: 3, sustain: 0.7, release: 0.8, overtone: 0.2, detune: 8, room: 0.6 },
  chiptune: { ...PLAIN_SOUND, waveform: "square", volume: 0.35, brightness: 12000, attack: 0.001, decay: 10, sustain: 0.8, release: 0.03, overtone: 0, detune: 0, room: 0 },
  violin: { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.38, brightness: 5000, attack: 0.08, decay: 10, sustain: 0.9, release: 0.25, overtone: 0.1, detune: 3, room: 0.4, vibrato: 0.45, bite: 0.15, breath: 0.04, scoop: 0.12, body: "strings" },
  strings: { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.36, brightness: 3600, attack: 0.28, decay: 10, sustain: 0.9, release: 0.6, overtone: 0.05, detune: 12, room: 0.6, vibrato: 0.3, voices: 3, body: "strings" },
  cello: { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.42, brightness: 2400, attack: 0.1, decay: 10, sustain: 0.9, release: 0.35, overtone: 0.1, detune: 3, room: 0.4, vibrato: 0.4, bite: 0.15, breath: 0.03, scoop: 0.1, body: "strings" },
  "upright bass": { ...PLAIN_SOUND, waveform: "pluck", volume: 0.95, brightness: 1500, attack: 0.003, decay: 1.6, sustain: 0, release: 0.12, overtone: 0, detune: 0, room: 0.15, body: "wood" },
  guitar: { ...PLAIN_SOUND, waveform: "pluck", volume: 0.9, brightness: 4500, attack: 0.002, decay: 2.4, sustain: 0, release: 0.2, overtone: 0, detune: 0, room: 0.3, body: "wood" },
  harp: { ...PLAIN_SOUND, waveform: "pluck", volume: 0.9, brightness: 7000, attack: 0.002, decay: 3.5, sustain: 0, release: 0.7, overtone: 0, detune: 0, room: 0.55 },
  trumpet: { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.36, brightness: 5500, attack: 0.03, decay: 10, sustain: 0.85, release: 0.1, overtone: 0.15, detune: 2, room: 0.3, vibrato: 0.12, bite: 0.8, breath: 0.05, scoop: 0.25, body: "brass" },
  "muted trumpet": { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.45, brightness: 4500, attack: 0.02, decay: 10, sustain: 0.8, release: 0.12, overtone: 0.1, detune: 2, room: 0.4, vibrato: 0.2, bite: 0.4, breath: 0.08, scoop: 0.3, body: "mute" },
  trombone: { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.42, brightness: 2600, attack: 0.05, decay: 10, sustain: 0.85, release: 0.15, overtone: 0.1, detune: 3, room: 0.35, vibrato: 0.1, bite: 0.6, breath: 0.04, scoop: 0.35, body: "brass" },
  sax: { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.38, brightness: 3200, attack: 0.04, decay: 10, sustain: 0.8, release: 0.12, overtone: 0.2, detune: 4, room: 0.45, vibrato: 0.4, bite: 0.35, breath: 0.22, scoop: 0.4, body: "reed" },
  flute: { ...PLAIN_SOUND, waveform: "sine", volume: 0.42, brightness: 6000, attack: 0.06, decay: 10, sustain: 0.9, release: 0.15, overtone: 0.25, detune: 2, room: 0.45, vibrato: 0.35, breath: 0.35, scoop: 0.05 },
  choir: { ...PLAIN_SOUND, waveform: "sawtooth", volume: 0.3, brightness: 3200, attack: 0.3, decay: 10, sustain: 0.9, release: 0.7, overtone: 0, detune: 10, room: 0.65, vibrato: 0.3, breath: 0.08, voices: 3, body: "voice" }
};

const BODIES = {
  plain: [],
  wood: [ { type: "peaking", frequency: 220, Q: 1.2, gain: 5 }, { type: "peaking", frequency: 1800, Q: 1.5, gain: 2 } ],
  strings: [ { type: "highpass", frequency: 110, Q: 0.7 }, { type: "peaking", frequency: 450, Q: 1.2, gain: 4 }, { type: "peaking", frequency: 2600, Q: 1.4, gain: 5 } ],
  reed: [ { type: "peaking", frequency: 600, Q: 1.3, gain: 4 }, { type: "peaking", frequency: 1500, Q: 1.6, gain: 6 } ],
  brass: [ { type: "peaking", frequency: 1200, Q: 1, gain: 5 } ],
  mute: [ { type: "highpass", frequency: 700, Q: 0.7 }, { type: "peaking", frequency: 1700, Q: 3, gain: 12 } ],
  voice: [ { type: "highpass", frequency: 160, Q: 0.7 }, { type: "peaking", frequency: 750, Q: 5, gain: 12 }, { type: "peaking", frequency: 1150, Q: 6, gain: 9 }, { type: "peaking", frequency: 2700, Q: 6, gain: 6 } ]
};

const SOUND_SLIDERS = [
  { name: "volume", min: 0, max: 1, step: 0.01 },
  { name: "brightness", min: 300, max: 12000, step: 100, unit: " Hz" },
  { name: "attack", min: 0.001, max: 1, step: 0.001, unit: " s" },
  { name: "decay", min: 0.05, max: 10, step: 0.05, unit: " s" },
  { name: "sustain", min: 0, max: 1, step: 0.01 },
  { name: "release", min: 0.01, max: 2, step: 0.01, unit: " s" },
  { name: "overtone", min: 0, max: 1, step: 0.01 },
  { name: "detune", min: 0, max: 25, step: 1, unit: " ¢" },
  { name: "voices", min: 1, max: 3, step: 1 },
  { name: "vibrato", min: 0, max: 1, step: 0.01 },
  { name: "tremolo", min: 0, max: 1, step: 0.01 },
  { name: "bite", min: 0, max: 1, step: 0.01 },
  { name: "breath", min: 0, max: 1, step: 0.01 },
  { name: "scoop", min: 0, max: 1, step: 0.01 },
  { name: "room", min: 0, max: 1, step: 0.01 }
];

const WAVEFORMS = [ "sine", "triangle", "square", "sawtooth", "pluck" ];
const SLIDE_SEMITONES = { fall: -7, rise: 7 };

let soundSettings = loadSoundSettings();
let audioMix = null;

function loadSoundSettings() {
  try {
    return { preset: "piano", ...SOUND_PRESETS.piano, ...JSON.parse( localStorage.getItem( "sound" ) ) };
  } catch {
    return { preset: "piano", ...SOUND_PRESETS.piano };
  }
}

function frequencyOf( midi ) {
  return 440 * Math.pow( 2, ( midi - 69 ) / 12 );
}

const roomEchoSamples = {};

function roomEchoSamplesOf( length, channel ) {
  const key = `${ length } ${ channel }`;
  roomEchoSamples[ key ] ??= Float32Array.from( { length }, ( _, index ) => ( Math.random() * 2 - 1 ) * Math.pow( 1 - index / length, 3 ) );
  return roomEchoSamples[ key ];
}

function roomEchoOf( context ) {
  const seconds = 2.2;
  const echo = context.createBuffer( 2, context.sampleRate * seconds, context.sampleRate );
  for ( let channel = 0; channel < 2; channel++ )
    echo.copyToChannel( roomEchoSamplesOf( echo.length, channel ), channel );
  return echo;
}

function buildMix( context ) {
  const room = context.createConvolver();
  const compressor = context.createDynamicsCompressor();
  const master = context.createGain();
  room.buffer = roomEchoOf( context );
  room.connect( compressor );
  compressor.connect( master );
  master.gain.value = masterGainOf( masterVolume );
  master.connect( context.destination );
  return { context, room, compressor, master, voices: [], noise: null, plucks: new Map() };
}

function soundOfVoice( voice ) {
  return voice.instrument ? SOUND_PRESETS[ voice.instrument ] : soundSettings;
}

function buildVoice( mix, instrument = null ) {
  const { context } = mix;
  const voice = { mix, instrument, input: context.createGain(), tone: context.createBiquadFilter(), dry: context.createGain(), wet: context.createGain() };
  const body = BODIES[ soundOfVoice( voice ).body ] || [];
  const filters = body.map( shape => Object.assign( context.createBiquadFilter(), { type: shape.type } ) );
  filters.forEach( ( filter, index ) => {
    filter.frequency.value = body[ index ].frequency;
    filter.Q.value = body[ index ].Q;
    filter.gain.value = body[ index ].gain || 0;
  });
  voice.tone.type = "lowpass";
  [ voice.input, ...filters, voice.tone ].reduce( ( from, to ) => from.connect( to ) );
  voice.tone.connect( voice.dry );
  voice.tone.connect( voice.wet );
  voice.dry.connect( mix.compressor );
  voice.wet.connect( mix.room );
  setLiveSettings( voice );
  mix.voices.push( voice );
  return voice;
}

function liveSettingsOf( voice ) {
  const sound = soundOfVoice( voice );
  return [
    [ voice.input.gain, sound.volume * 0.4 ],
    [ voice.tone.frequency, sound.brightness ],
    [ voice.dry.gain, 1 - sound.room * 0.4 ],
    [ voice.wet.gain, sound.room * 0.7 ]
  ];
}

function setLiveSettings( voice ) {
  liveSettingsOf( voice ).forEach( ( [ parameter, value ] ) => parameter.value = value );
}

function applyLiveSettings( mix ) {
  if ( !mix )
    return;
  const now = mix.context.currentTime;
  mix.voices
    .filter( voice => !voice.instrument )
    .forEach( voice => liveSettingsOf( voice ).forEach( ( [ parameter, value ] ) => parameter.setTargetAtTime( value, now, 0.03 ) ) );
}

function noiseOf( mix ) {
  if ( mix.noise )
    return mix.noise;
  const { context } = mix;
  mix.noise = context.createBuffer( 1, context.sampleRate * 2, context.sampleRate );
  mix.noise.copyToChannel( Float32Array.from( { length: mix.noise.length }, () => Math.random() * 2 - 1 ), 0 );
  return mix.noise;
}

function pluckedStringOf( mix, midi, sound ) {
  const key = `${ midi } ${ sound.decay } ${ sound.brightness }`;
  if ( mix.plucks.has( key ) )
    return mix.plucks.get( key );
  const { context } = mix;
  const rate = context.sampleRate;
  const period = Math.max( 2, Math.round( rate / frequencyOf( midi ) ) );
  const length = Math.round( rate * Math.min( 6, sound.decay * 1.5 + 0.3 ) );
  const samples = new Float32Array( length );
  const loss = Math.pow( 0.001, period / ( sound.decay * rate ) );
  const brightness = 0.5 + 0.45 * Math.min( 1, sound.brightness / 12000 );
  let smoothed = 0;
  for ( let index = 0; index < period; index++ ) {
    smoothed += ( Math.random() * 2 - 1 - smoothed ) * brightness;
    samples[ index ] = smoothed;
  }
  for ( let index = period; index < length; index++ ) {
    const before = samples[ index - period - 1 ] ?? 0;
    samples[ index ] = loss * ( brightness * samples[ index - period ] + ( 1 - brightness ) * before );
  }
  const buffer = context.createBuffer( 1, length, rate );
  buffer.copyToChannel( samples, 0 );
  const plucked = { buffer, rate: frequencyOf( midi ) * ( period + 1 - brightness ) / rate };
  mix.plucks.set( key, plucked );
  return plucked;
}

function wobble( context, rate, depth, from, until, parameter ) {
  const swing = context.createOscillator();
  const amount = context.createGain();
  swing.frequency.value = rate;
  amount.gain.setValueAtTime( 0, from );
  amount.gain.linearRampToValueAtTime( depth, from + 0.35 );
  swing.connect( amount );
  amount.connect( parameter );
  swing.start( from );
  swing.stop( until );
}

function slideTo( parameter, ratio, from, to ) {
  parameter.setValueAtTime( parameter.value, from );
  parameter.exponentialRampToValueAtTime( parameter.value * ratio, to );
}

function sourcesOfNote( voice, midi, sound ) {
  const { context } = voice.mix;
  if ( sound.waveform === "pluck" ) {
    const plucked = pluckedStringOf( voice.mix, midi, sound );
    const source = context.createBufferSource();
    source.buffer = plucked.buffer;
    source.playbackRate.value = plucked.rate;
    return [ { source, pitch: source.playbackRate, tuning: source.detune, level: 2 } ];
  }
  const voices = Math.round( sound.voices );
  const bodies = Array.from( { length: voices }, ( _, index ) => {
    const source = context.createOscillator();
    source.type = sound.waveform;
    source.frequency.value = frequencyOf( midi );
    source.detune.value = voices > 1 ? ( index - ( voices - 1 ) / 2 ) * sound.detune : 0;
    return { source, pitch: source.frequency, tuning: source.detune, level: 1 / Math.sqrt( voices ) };
  });
  if ( sound.overtone <= 0 )
    return bodies;
  const overtone = context.createOscillator();
  overtone.frequency.value = frequencyOf( midi ) * 2;
  overtone.detune.value = sound.detune;
  return [ ...bodies, { source: overtone, pitch: overtone.frequency, tuning: overtone.detune, level: sound.overtone * 0.5 } ];
}

function addBreath( voice, midi, sound, time, until, envelope ) {
  const { context } = voice.mix;
  const noise = context.createBufferSource();
  const band = context.createBiquadFilter();
  const level = context.createGain();
  noise.buffer = noiseOf( voice.mix );
  noise.loop = true;
  noise.loopStart = Math.random();
  band.type = "bandpass";
  band.frequency.value = Math.min( 6000, Math.max( 900, frequencyOf( midi ) * 2 ) );
  band.Q.value = 0.9;
  level.gain.setValueAtTime( sound.breath * 1.2, time );
  level.gain.setTargetAtTime( sound.breath * 0.45, time + 0.02, 0.06 );
  noise.connect( band );
  band.connect( level );
  level.connect( envelope );
  noise.start( time, noise.loopStart );
  noise.stop( until );
}

function addBite( context, midi, sound, time, attackEnd ) {
  const filter = context.createBiquadFilter();
  const base = frequencyOf( midi );
  const limit = context.sampleRate / 2 - 100;
  filter.type = "lowpass";
  filter.Q.value = 1 + sound.bite * 2;
  filter.frequency.setValueAtTime( Math.min( limit, base * 1.5 ), time );
  filter.frequency.linearRampToValueAtTime( Math.min( limit, base * ( 1.5 + sound.bite * 14 ) ), attackEnd + 0.04 );
  filter.frequency.setTargetAtTime( Math.min( limit, base * ( 1.5 + sound.bite * 5 ) ), attackEnd + 0.04, 0.25 );
  return filter;
}

function scheduleNote( pitch, time, duration, voice, style = {} ) {
  const { context } = voice.mix;
  const sound = soundOfVoice( voice );
  const midi = midiOf( pitch );
  const attackEnd = time + sound.attack;
  const end = time + Math.max( duration, sound.attack );
  const until = end + sound.release * 1.5 + 0.05;
  const decayTime = sound.decay * ( 1.4 - midi / 127 );
  const peak = style.loudness ?? 1;
  const sustain = style.held ? Math.max( sound.sustain, 0.6 ) : sound.sustain;
  const isPlucked = sound.waveform === "pluck";

  const release = context.createGain();
  release.connect( voice.input );

  const envelope = context.createGain();
  envelope.gain.setValueAtTime( 0, time );
  envelope.gain.linearRampToValueAtTime( peak, attackEnd );
  if ( !isPlucked )
    envelope.gain.setTargetAtTime( Math.max( sustain * peak, 0.0001 ), attackEnd, decayTime / 3 );
  envelope.gain.setTargetAtTime( 0, end, sound.release / 4 );

  const shaped = sound.bite > 0 ? addBite( context, midi, sound, time, attackEnd ) : null;
  const tremolo = sound.tremolo > 0 ? context.createGain() : null;
  const chain = [ envelope, shaped, tremolo, release ].filter( Boolean );
  chain.reduce( ( from, to ) => from.connect( to ) );
  if ( tremolo ) {
    tremolo.gain.value = 1 - sound.tremolo * 0.4;
    wobble( context, 4.8, sound.tremolo * 0.4, time, until, tremolo.gain );
  }

  const sources = sourcesOfNote( voice, midi, sound );
  sources.forEach( ( { source, pitch: frequency, tuning, level } ) => {
    const gain = context.createGain();
    gain.gain.value = level;
    source.connect( gain );
    gain.connect( envelope );
    if ( sound.scoop > 0 ) {
      tuning.setValueAtTime( tuning.value - sound.scoop * 120, time );
      tuning.linearRampToValueAtTime( tuning.value, time + 0.05 + sound.scoop * 0.07 );
    }
    if ( sound.vibrato > 0 )
      wobble( context, 5.4, sound.vibrato * 35, time + 0.12, until, tuning );
    if ( style.slide )
      slideTo( frequency, Math.pow( 2, SLIDE_SEMITONES[ style.slide ] / 12 ), Math.max( attackEnd, end - Math.min( 0.35, duration * 0.4 ) ), end );
    source.start( time );
    source.stop( until );
  });

  if ( sound.breath > 0 && !isPlucked )
    addBreath( voice, midi, sound, time, until, envelope );

  return {
    letGo: () => release.gain.setTargetAtTime( 0, context.currentTime, 0.05 )
  };
}

function previewSound() {
  const context = new AudioContext();
  const mix = buildMix( context );
  const voice = buildVoice( mix );
  const start = context.currentTime + 0.05;
  const chord = [ [ "c", 4 ], [ "e", 4 ], [ "g", 4 ], [ "c", 5 ] ];
  chord.forEach( ( [ letter, octave ], index ) => {
    scheduleNote( { letter, alter: 0, octave }, start + index * 0.18, 1.2 - index * 0.18, voice );
  });
  setTimeout( () => context.close(), ( 2.4 + soundSettings.release * 2 ) * 1000 );
}
