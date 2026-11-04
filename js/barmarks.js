function measureStartsOf( parsed ) {
  const measureLength = measureLengthOf( parsed.meter );
  return parsed.staves.flatMap( staff => timedEventsOf( staff )
    .filter( item => isOnBarline( item.start, measureLength ) && item.event.token )
    .map( item => ( { source: item.event.countSource || item.event.graceSources?.[ 0 ] || item.event, number: Math.round( item.start / measureLength ) + 1 } ) ) );
}

function markerColumnOf( source, lineText ) {
  return lineText[ source.column - 1 ] === "{" || lineText[ source.column - 1 ] === "(" ? source.column - 1 : source.column;
}

function spanOf( numbers ) {
  const unique = [ ...new Set( numbers ) ].sort( ( a, b ) => a - b );
  const isRun = unique.every( ( number, index ) => number === unique[ 0 ] + index );
  return isRun && unique.length > 1 ? `${ unique[ 0 ] }–${ unique.at( -1 ) }` : unique.join( "," );
}

function barRangesOn( lineNumber, lineText, measureStarts ) {
  const numbersAt = new Map();
  measureStarts
    .filter( measureStart => measureStart.source.line === lineNumber )
    .forEach( measureStart => {
      const at = markerColumnOf( measureStart.source, lineText );
      numbersAt.set( at, [ ...( numbersAt.get( at ) || [] ), measureStart.number ] );
    });
  return [ ...numbersAt ].map( ( [ at, numbers ] ) => {
    const marker = document.createElement( "span" );
    marker.className = "barMarker";
    marker.dataset.measure = spanOf( numbers );
    return { start: at, end: at, element: marker };
  });
}
