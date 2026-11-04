const STORED_VOLUME = localStorage.getItem( "volume" );
let MASTER_VOLUME = STORED_VOLUME === null ? 1 : Number( STORED_VOLUME );

function masterGainOf( volume ) {
  return volume * volume;
}

function showVolume() {
  VOLUME_SLIDER.value = Math.round( MASTER_VOLUME * 100 );
  VOLUME_READOUT.textContent = `${ VOLUME_SLIDER.value }%`;
  VOLUME_BUTTON.classList.toggle( "silent", MASTER_VOLUME === 0 );
}

VOLUME_SLIDER.addEventListener( "input", () => {
  MASTER_VOLUME = VOLUME_SLIDER.value / 100;
  localStorage.setItem( "volume", MASTER_VOLUME );
  showVolume();
  if ( AUDIO_MIX )
    AUDIO_MIX.master.gain.setTargetAtTime( masterGainOf( MASTER_VOLUME ), AUDIO_MIX.context.currentTime, 0.03 );
});

showVolume();
