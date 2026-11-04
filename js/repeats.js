function repeatPairsOf( repeats, from, to, level ) {
  const signs = repeats
    .filter( sign => sign.level === level && sign.position >= from - 1e-6 && sign.position <= to + 1e-6 )
    .sort( ( a, b ) => a.position - b.position || ( a.kind === "end" ? -1 : 1 ) );
  const openStarts = [];
  const pairs = [];
  signs.forEach( sign => {
    if ( sign.kind === "start" ) {
      openStarts.push( sign.position );
      return;
    }
    const start = openStarts.length ? openStarts.pop() : from;
    pairs.push( { start, end: sign.position } );
  });
  return pairs.sort( ( a, b ) => a.start - b.start );
}

function hasRepeatsInside( repeats, from, to, level ) {
  return repeats.some( sign => sign.level >= level && sign.position >= from - 1e-6 && sign.position <= to + 1e-6 );
}

function unfold( repeats, from, to, level ) {
  if ( to - from <= 1e-6 )
    return [];
  if ( !hasRepeatsInside( repeats, from, to, level ) )
    return [ { start: from, end: to } ];
  const segments = [];
  let cursor = from;
  repeatPairsOf( repeats, from, to, level ).forEach( pair => {
    const body = unfold( repeats, pair.start, pair.end, level + 1 );
    segments.push( ...unfold( repeats, cursor, pair.start, level + 1 ), ...body, ...body );
    cursor = pair.end;
  });
  segments.push( ...unfold( repeats, cursor, to, level + 1 ) );
  return segments;
}

function joinedSegments( segments ) {
  return segments.reduce( ( joined, segment ) => {
    const previous = joined.at( -1 );
    if ( previous && Math.abs( previous.end - segment.start ) < 1e-6 )
      previous.end = segment.end;
    else
      joined.push( { ...segment } );
    return joined;
  }, [] );
}

function performanceSegmentsOf( repeats, songLength ) {
  return joinedSegments( unfold( repeats, 0, songLength, 1 ) );
}
