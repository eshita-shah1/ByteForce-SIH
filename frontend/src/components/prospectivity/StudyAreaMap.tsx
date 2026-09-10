import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BHARVELI_CENTER, BHARVELI_CONCESSION_POLYGON } from '../../utils/geoUtils';

// Leaflet default icon fix
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface StudyAreaMapProps {
  selectedCoord: { lat: number; lng: number };
  onMapClick: (lat: number, lng: number) => void;
}

// Controller to handle user clicks on the map
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Recenter component when coordinates are updated via steppers
function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!isNaN(lat) && !isNaN(lng)) {
      map.panTo([lat, lng], { animate: true });
    }
  }, [lat, lng, map]);
  return null;
}

export const StudyAreaMap: React.FC<StudyAreaMapProps> = ({ selectedCoord, onMapClick }) => {
  return (
    <div className="w-full h-full min-h-[440px] relative rounded-lg overflow-hidden border border-slate-200">
      <MapContainer
        center={BHARVELI_CENTER}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Bharveli & Balaghat Concession Polygon Boundary */}
        <Polygon
          positions={BHARVELI_CONCESSION_POLYGON}
          pathOptions={{
            color: '#183D2B',
            weight: 2.5,
            dashArray: '5, 5',
            fillColor: '#38A169',
            fillOpacity: 0.18
          }}
        />

        {/* Selected target marker */}
        <Marker
          position={[selectedCoord.lat, selectedCoord.lng]}
          icon={defaultIcon}
        />

        <MapClickHandler onMapClick={onMapClick} />
        <MapRecenter lat={selectedCoord.lat} lng={selectedCoord.lng} />
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-xs px-3 py-2 rounded-md border border-slate-200 shadow-sm text-xs space-y-1">
        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-brand-forest"></span>
          <span>Bharveli & Balaghat Concession Boundary</span>
        </div>
        <div className="text-[11px] text-slate-500">
          Click inside boundary to sample prospectivity coordinates.
        </div>
      </div>
    </div>
  );
};
