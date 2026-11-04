function measureStartsOf( parsed ) {
  const measure_length = measureLengthOf( parsed.meter );
  return parsed.staves.flatMap( staff => timedEventsOf( staff )
    .filter( item => isOnBarline( item.start, measure_length ) && item.event.token )
    .map( item => ( { source: item.event.countSource || item.event.graceSources?.[ 0 ] || item.event, number: Math.round( item.start / measure_length ) + 1 } ) ) );
}

function markerColumnOf( source, line_text ) {
  return line_text[ source.column - 1 ] === "{" || line_text[ source.column - 1 ] === "(" ? source.column - 1 : source.column;
}

function spanOf( numbers ) {
  const unique = [ ...new Set( numbers ) ].sort( ( a, b ) => a - b );
  const is_run = unique.every( ( number, index ) => number === unique[ 0 ] + index );
  return is_run && unique.length > 1 ? `${ unique[ 0 ] }–${ unique.at( -1 ) }` : unique.join( "," );
}

function barRangesOn( line_number, line_text, measure_starts ) {
  const numbers_at = new Map();
  measure_starts
    .filter( measure_start => measure_start.source.line === line_number )
    .forEach( measure_start => {
      const at = markerColumnOf( measure_start.source, line_text );
      numbers_at.set( at, [ ...( numbers_at.get( at ) || [] ), measure_start.number ] );
    });
  return [ ...numbers_at ].map( ( [ at, numbers ] ) => {
    const marker = document.createElement( "span" );
    marker.className = "barMarker";
    marker.dataset.measure = spanOf( numbers );
    return { start: at, end: at, element: marker };
  });
}
