const storedVolume = localStorage.getItem( "volume" );
let masterVolume = storedVolume === null ? 1 : Number( storedVolume );

function masterGainOf( volume ) {
  return volume * volume;
}

function showVolume() {
  volumeSlider.value = Math.round( masterVolume * 100 );
  volumeReadout.textContent = `${ volumeSlider.value }%`;
  volumeButton.classList.toggle( "silent", masterVolume === 0 );
}

volumeSlider.addEventListener( "input", () => {
  masterVolume = volumeSlider.value / 100;
  localStorage.setItem( "volume", masterVolume );
  showVolume();
  if ( audioMix )
    audioMix.master.gain.setTargetAtTime( masterGainOf( masterVolume ), audioMix.context.currentTime, 0.03 );
});

showVolume();
