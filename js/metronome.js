const tickingIcon = metronomeIcon;
let metronomeOn = localStorage.getItem( "metronome" ) === "on";
let clickVolume = null;

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
  const click = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  click.frequency.value = CLICKS[ kind ].pitch;
  envelope.gain.setValueAtTime( 0.0001, time );
  envelope.gain.exponentialRampToValueAtTime( CLICKS[ kind ].loudness, time + 0.002 );
  envelope.gain.exponentialRampToValueAtTime( 0.0001, time + 0.05 );
  click.connect( envelope );
  envelope.connect( clickVolume );
  click.start( time );
  click.stop( time + 0.06 );
}

function showBeat( count ) {
  if ( !metronomeOn )
    return;
  metronomeButton.textContent = count;
  metronomeButton.classList.remove( "beat", "downbeat" );
  void metronomeButton.offsetWidth;
  metronomeButton.classList.add( count === 1 ? "downbeat" : "beat" );
}

function resetMetronome() {
  metronomeButton.replaceChildren( tickingIcon );
  metronomeButton.classList.toggle( "on", metronomeOn );
}

function metronomeOf( startTime, output, from, until ) {
  clickVolume = audioContext.createGain();
  clickVolume.gain.value = metronomeOn ? 1 : 0;
  clickVolume.connect( output );
  const beatLength = countedBeatOf( sheet.meter );
  const beatsPerMeasure = Math.max( 1, Math.round( measureLengthOf( sheet.meter ) / beatLength ) );
  const end = Math.min( until, totalDurationOf( sheet ) );
  const lastBeat = Math.ceil( end / beatLength - EPSILON );
  const audioTimeOf = position => audioTimeAt( position, startTime, from );
  const subdivided = isCompoundMeter( sheet.meter );
  let beat = Math.floor( from / beatLength + EPSILON );
  const clickBeat = () => {
    const position = beat * beatLength;
    if ( position >= from - EPSILON ) {
      const count = Math.round( scorePositionOf( position ) / beatLength ) % beatsPerMeasure + 1;
      const clickTime = audioTimeOf( position );
      scheduleClick( clickTime, count === 1 ? "downbeat" : "beat" );
      highlightTimeouts.push( setTimeout( () => showBeat( count ), ( clickTime - audioContext.currentTime ) * 1000 ) );
    }
    if ( subdivided )
      [ 1, 2 ]
        .map( step => position + step * beatLength / 3 )
        .filter( tick => tick >= from - EPSILON && tick < end - EPSILON )
        .forEach( tick => scheduleClick( audioTimeOf( tick ), "subdivision" ) );
  };
  return horizon => {
    while ( beat < lastBeat && audioTimeOf( beat * beatLength ) <= horizon ) {
      clickBeat();
      beat++;
    }
  };
}

metronomeButton.addEventListener( "click", () => {
  metronomeOn = !metronomeOn;
  localStorage.setItem( "metronome", metronomeOn ? "on" : "off" );
  if ( clickVolume )
    clickVolume.gain.value = metronomeOn ? 1 : 0;
  resetMetronome();
});

resetMetronome();
