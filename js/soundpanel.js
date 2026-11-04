const SLIDER_INPUTS = {};
const SLIDER_READOUTS = {};
let PENDING_RESTART = null;

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
  SLIDER_INPUTS[ slider.name ] = input;
  SLIDER_READOUTS[ slider.name ] = readout;
  row.append( name, input, readout );
  return row;
}

function showSoundSettings() {
  PRESET_PICKER.value = SOUND_SETTINGS.preset;
  WAVEFORM_PICKER.value = SOUND_SETTINGS.waveform;
  BODY_PICKER.value = SOUND_SETTINGS.body;
  refreshDropdowns();
  SOUND_SLIDERS.forEach( slider => {
    SLIDER_INPUTS[ slider.name ].value = SOUND_SETTINGS[ slider.name ];
    SLIDER_READOUTS[ slider.name ].textContent = readoutOf( slider, SOUND_SETTINGS[ slider.name ] );
  });
}

function restartPlaybackSoon() {
  clearTimeout( PENDING_RESTART );
  PENDING_RESTART = setTimeout( () => {
    if ( !PLAYING )
      return;
    pausePlayback();
    startPlayback();
  }, 250 );
}

const LIVE_SETTINGS = [ "volume", "brightness", "room" ];

function changeSound( changes, preset = "custom" ) {
  const changes_notes = Object.keys( changes ).some( name => !LIVE_SETTINGS.includes( name ) && changes[ name ] !== SOUND_SETTINGS[ name ] );
  SOUND_SETTINGS = { ...SOUND_SETTINGS, ...changes, preset };
  localStorage.setItem( "sound", JSON.stringify( SOUND_SETTINGS ) );
  showSoundSettings();
  applyLiveSettings( AUDIO_MIX );
  if ( changes_notes )
    restartPlaybackSoon();
}

function randomPickOf( choices ) {
  return choices[ Math.floor( Math.random() * choices.length ) ];
}

function randomSound() {
  const random_sliders = Object.fromEntries( SOUND_SLIDERS.map( slider => {
    const value = slider.min + Math.random() * ( slider.max - slider.min );
    return [ slider.name, snappedToStep( value, slider ) ];
  }));
  const waveform = randomPickOf( WAVEFORMS );
  const body = randomPickOf( Object.keys( BODIES ) );
  const volume = snappedToStep( 0.4 + Math.random() * 0.4, SOUND_SLIDERS[ 0 ] );
  changeSound( { ...random_sliders, waveform, body, volume } );
  previewSound();
}

function showSheetInstruments() {
  const heard = SHEET.staves.filter( staff => !staff.muted );
  const chosen = heard.filter( staff => staff.instrument );
  const muted = SHEET.staves.filter( staff => staff.muted ).map( staff => `the ${ staff.clef } staff is muted` );
  const rest = chosen.length === heard.length ? "" : "; this menu plays the rest";
  const picks = chosen.length ? [ `this sheet picks ${ chosen.map( staff => `${ staff.instrument } (${ staff.clef })` ).join( " and " ) }${ rest }` ] : [];
  SHEET_INSTRUMENTS.textContent = [ ...picks, ...muted ].join( ". " );
}

function buildSoundPanel() {
  PRESET_PICKER.replaceChildren( ...[ ...Object.keys( SOUND_PRESETS ), "custom" ].map( name => new Option( name, name ) ) );
  WAVEFORM_PICKER.replaceChildren( ...WAVEFORMS.map( waveform => new Option( waveform, waveform ) ) );
  BODY_PICKER.replaceChildren( ...Object.keys( BODIES ).map( body => new Option( body, body ) ) );
  SOUND_SLIDER_LIST.replaceChildren( ...SOUND_SLIDERS.map( sliderRowOf ) );
  showSoundSettings();
}

SOUND_BUTTON.addEventListener( "click", event => {
  event.stopPropagation();
  closeExportMenu();
  closeLookMenu();
  closePopups();
  SOUND_PANEL.classList.toggle( "open" );
});

let PRESSED_INSIDE_SOUND_PANEL = false;

document.addEventListener( "pointerdown", event => {
  PRESSED_INSIDE_SOUND_PANEL = SOUND_PANEL.contains( event.target );
});

document.addEventListener( "click", event => {
  if ( !SOUND_PANEL.contains( event.target ) && !PRESSED_INSIDE_SOUND_PANEL )
    SOUND_PANEL.classList.remove( "open" );
});

PRESET_PICKER.addEventListener( "change", () => {
  if ( PRESET_PICKER.value in SOUND_PRESETS )
    changeSound( SOUND_PRESETS[ PRESET_PICKER.value ], PRESET_PICKER.value );
});

WAVEFORM_PICKER.addEventListener( "change", () => changeSound( { waveform: WAVEFORM_PICKER.value } ) );
BODY_PICKER.addEventListener( "change", () => changeSound( { body: BODY_PICKER.value } ) );
PREVIEW_BUTTON.addEventListener( "click", previewSound );
RANDOM_BUTTON.addEventListener( "click", randomSound );
RESET_SOUND_BUTTON.addEventListener( "click", () => changeSound( SOUND_PRESETS.piano, "piano" ) );

buildSoundPanel();
