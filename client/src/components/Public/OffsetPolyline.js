import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylineoffset';

// Component to create offset polyline with popup support
const OffsetPolyline = ({ positions, pathOptions, offset = 0, popupContent, eventHandlers }) => {
  const map = useMap();
  const polylineRef = useRef(null);

  useEffect(() => {
    if (!positions || positions.length === 0) return;

    // Clean up previous polyline
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
    }

    // Create polyline with offset
    const polyline = L.polyline(positions, pathOptions);
    
    // Apply offset (in pixels, positive moves right, negative moves left)
    if (offset !== 0) {
      polyline.setOffset(offset);
    }

    // Add popup if content provided
    if (popupContent) {
      polyline.bindPopup(popupContent);
    }

    // Add event handlers
    if (eventHandlers) {
      Object.keys(eventHandlers).forEach(eventName => {
        polyline.on(eventName, eventHandlers[eventName]);
      });
    }

    polyline.addTo(map);
    polylineRef.current = polyline;

    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
    };
  }, [map, positions, pathOptions, offset, popupContent, eventHandlers]);

  return null;
};

export default OffsetPolyline;

