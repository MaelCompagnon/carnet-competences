// Lists the pending markers left in content/. Exit code 1 if any remains.
import { findMarkers, formatMarkers } from './markers.mjs';

const markers = findMarkers();
if (markers.length === 0) {
  console.log('No marker left in content/.');
} else {
  console.error(`${markers.length} marker(s) left in content/:\n${formatMarkers(markers)}`);
  process.exit(1);
}
