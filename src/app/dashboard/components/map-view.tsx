'use client';

import { Map, Marker } from '@vis.gl/react-google-maps';

export default function MapView() {
  const position = { lat: 37.7749, lng: -122.4194 }; // Default to San Francisco

  return (
    <Map
      mapId="tech-report-map"
      style={{ width: '100%', height: '100%' }}
      defaultCenter={position}
      defaultZoom={9}
      gestureHandling={'greedy'}
      disableDefaultUI={true}
    >
      <Marker position={position} />
    </Map>
  );
}
