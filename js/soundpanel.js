const sliderInputs = {};
const sliderReadouts = {};
let pendingRestart = null;

function decimalsOf( step ) {
  return ( String( step ).split( "." )[ 1 ] || "" ).length;
}

function readoutOf( slider, value ) {
  return Number( value ).toFixed( decimalsOf( slider.step ) ) + ( slider.unit || "" );
}

function snappedToStep( value, slider ) {
  return Number( ( Math.round( value / slider.step ) * slider.step ).toFixed( decimalsOf( slider.step ) ) );
}

function sliderRowOf( slider ) {
  const row = document.createElement( "label" );
  const name = document.createElement( "span" );
  const input = document.createElement( "input" );
  const readout = document.createElement( "span" );
  name.textContent = slider.name;
  Object.assign( input, { type: "range", min: slider.min, max: slider.max, step: slider.step } );
  input.addEventListener( "input", () => changeSound( { [ slider.name ]: Number( input.value ) } ) );
  sliderInputs[ slider.name ] = input;
  sliderReadouts[ slider.name ] = readout;
  row.append( name, input, readout );
  return row;
}

function showSoundSettings() {
  presetPicker.value = soundSettings.preset;
  waveformPicker.value = soundSettings.waveform;
  bodyPicker.value = soundSettings.body;
  refreshDropdowns();
  SOUND_SLIDERS.forEach( slider => {
    sliderInputs[ slider.name ].value = soundSettings[ slider.name ];
    sliderReadouts[ slider.name ].textContent = readoutOf( slider, soundSettings[ slider.name ] );
  });
}

function restartPlaybackSoon() {
  clearTimeout( pendingRestart );
  pendingRestart = setTimeout( () => {
    if ( !playing )
      return;
    pausePlayback();
    startPlayback();
  }, 250 );
}

const LIVE_SETTINGS = [ "volume", "brightness", "room" ];

function changeSound( changes, preset = "custom" ) {
  const changesNotes = Object.keys( changes ).some( name => !LIVE_SETTINGS.includes( name ) && changes[ name ] !== soundSettings[ name ] );
  soundSettings = { ...soundSettings, ...changes, preset };
  localStorage.setItem( "sound", JSON.stringify( soundSettings ) );
  showSoundSettings();
  applyLiveSettings( audioMix );
  if ( changesNotes )
    restartPlaybackSoon();
}

function randomPickOf( choices ) {
  return choices[ Math.floor( Math.random() * choices.length ) ];
}

function randomSound() {
  const randomSliders = Object.fromEntries( SOUND_SLIDERS.map( slider => {
    const value = slider.min + Math.random() * ( slider.max - slider.min );
    return [ slider.name, snappedToStep( value, slider ) ];
  }));
  const waveform = randomPickOf( WAVEFORMS );
  const body = randomPickOf( Object.keys( BODIES ) );
  const volume = snappedToStep( 0.4 + Math.random() * 0.4, SOUND_SLIDERS[ 0 ] );
  changeSound( { ...randomSliders, waveform, body, volume } );
  previewSound();
}

function showSheetInstruments() {
  const heard = sheet.staves.filter( staff => !staff.muted );
  const chosen = heard.filter( staff => staff.instrument );
  const muted = sheet.staves.filter( staff => staff.muted ).map( staff => `the ${ staff.clef } staff is muted` );
  const rest = chosen.length === heard.length ? "" : "; this menu plays the rest";
  const picks = chosen.length ? [ `this sheet picks ${ chosen.map( staff => `${ staff.instrument } (${ staff.clef })` ).join( " and " ) }${ rest }` ] : [];
  sheetInstruments.textContent = [ ...picks, ...muted ].join( ". " );
}

function buildSoundPanel() {
  presetPicker.replaceChildren( ...[ ...Object.keys( SOUND_PRESETS ), "custom" ].map( name => new Option( name, name ) ) );
  waveformPicker.replaceChildren( ...WAVEFORMS.map( waveform => new Option( waveform, waveform ) ) );
  bodyPicker.replaceChildren( ...Object.keys( BODIES ).map( body => new Option( body, body ) ) );
  soundSliders.replaceChildren( ...SOUND_SLIDERS.map( sliderRowOf ) );
  showSoundSettings();
}

soundButton.addEventListener( "click", event => {
  event.stopPropagation();
  closeExportMenu();
  closeLookMenu();
  closePopups();
  soundPanel.classList.toggle( "open" );
});

let pressedInsideSoundPanel = false;

document.addEventListener( "pointerdown", event => {
  pressedInsideSoundPanel = soundPanel.contains( event.target );
});

document.addEventListener( "click", event => {
  if ( !soundPanel.contains( event.target ) && !pressedInsideSoundPanel )
    soundPanel.classList.remove( "open" );
});

presetPicker.addEventListener( "change", () => {
  if ( presetPicker.value in SOUND_PRESETS )
    changeSound( SOUND_PRESETS[ presetPicker.value ], presetPicker.value );
});

waveformPicker.addEventListener( "change", () => changeSound( { waveform: waveformPicker.value } ) );
bodyPicker.addEventListener( "change", () => changeSound( { body: bodyPicker.value } ) );
previewButton.addEventListener( "click", previewSound );
randomButton.addEventListener( "click", randomSound );
resetSoundButton.addEventListener( "click", () => changeSound( SOUND_PRESETS.piano, "piano" ) );

buildSoundPanel();
