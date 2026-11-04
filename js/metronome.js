const TICKING_ICON = METRONOME_ICON;
let METRONOME_ON = localStorage.getItem( "metronome" ) === "on";
let CLICK_VOLUME = null;

const CLICKS = {
  downbeat: { pitch: 1760, loudness: 0.6 },
  beat: { pitch: 1320, loudness: 0.35 },
  subdivision: { pitch: 990, loudness: 0.08 }
};

function isCompoundMeter( meter ) {
  return meter.unit >= 8 && meter.beats % 3 === 0 && meter.beats > 3;
}

function countedBeatOf( meter ) {
  return isCompoundMeter( meter ) ? 3 / meter.unit : 1 / meter.unit;
}

function scheduleClick( time, kind ) {
  const click = AUDIO_CONTEXT.createOscillator();
  const envelope = AUDIO_CONTEXT.createGain();
  click.frequency.value = CLICKS[ kind ].pitch;
  envelope.gain.setValueAtTime( 0.0001, time );
  envelope.gain.exponentialRampToValueAtTime( CLICKS[ kind ].loudness, time + 0.002 );
  envelope.gain.exponentialRampToValueAtTime( 0.0001, time + 0.05 );
  click.connect( envelope );
  envelope.connect( CLICK_VOLUME );
  click.start( time );
  click.stop( time + 0.06 );
}

function showBeat( count ) {
  if ( !METRONOME_ON )
    return;
  METRONOME_BUTTON.textContent = count;
  METRONOME_BUTTON.classList.remove( "beat", "downbeat" );
  void METRONOME_BUTTON.offsetWidth;
  METRONOME_BUTTON.classList.add( count === 1 ? "downbeat" : "beat" );
}

function resetMetronome() {
  METRONOME_BUTTON.replaceChildren( TICKING_ICON );
  METRONOME_BUTTON.classList.toggle( "on", METRONOME_ON );
}

function metronomeOf( start_time, output, from, until ) {
  CLICK_VOLUME = AUDIO_CONTEXT.createGain();
  CLICK_VOLUME.gain.value = METRONOME_ON ? 1 : 0;
  CLICK_VOLUME.connect( output );
  const beat_length = countedBeatOf( SHEET.meter );
  const beats_per_measure = Math.max( 1, Math.round( measureLengthOf( SHEET.meter ) / beat_length ) );
  const end = Math.min( until, totalDurationOf( SHEET ) );
  const last_beat = Math.ceil( end / beat_length - EPSILON );
  const audioTimeOf = position => audioTimeAt( position, start_time, from );
  const subdivided = isCompoundMeter( SHEET.meter );
  let beat = Math.floor( from / beat_length + EPSILON );
  const clickBeat = () => {
    const position = beat * beat_length;
    if ( position >= from - EPSILON ) {
      const count = Math.round( scorePositionOf( position ) / beat_length ) % beats_per_measure + 1;
      const click_time = audioTimeOf( position );
      scheduleClick( click_time, count === 1 ? "downbeat" : "beat" );
      HIGHLIGHT_TIMEOUTS.push( setTimeout( () => showBeat( count ), ( click_time - AUDIO_CONTEXT.currentTime ) * 1000 ) );
    }
    if ( subdivided )
      [ 1, 2 ]
        .map( step => position + step * beat_length / 3 )
        .filter( tick => tick >= from - EPSILON && tick < end - EPSILON )
        .forEach( tick => scheduleClick( audioTimeOf( tick ), "subdivision" ) );
  };
  return horizon => {
    while ( beat < last_beat && audioTimeOf( beat * beat_length ) <= horizon ) {
      clickBeat();
      beat++;
    }
  };
}

METRONOME_BUTTON.addEventListener( "click", () => {
  METRONOME_ON = !METRONOME_ON;
  localStorage.setItem( "metronome", METRONOME_ON ? "on" : "off" );
  if ( CLICK_VOLUME )
    CLICK_VOLUME.gain.value = METRONOME_ON ? 1 : 0;
  resetMetronome();
});

resetMetronome();
