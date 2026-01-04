import { useEffect, useRef, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylineoffset';

// Component to create offset polyline with popup support
const OffsetPolyline = ({ positions, pathOptions, offset = 0, popupContent, eventHandlers }) => {
  const map = useMap();
  const polylineRef = useRef(null);
  const prevKeysRef = useRef('');

  // Normalize positions
  const normalizedPositions = useMemo(() => {
    if (!positions || positions.length === 0) return [];
    return positions
      .map(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          const lat = parseFloat(coord[0]);
          const lng = parseFloat(coord[1]);
          if (isNaN(lat) || isNaN(lng)) return null;
          return [lat, lng];
        }
        return null;
      })
      .filter(coord => coord !== null);
  }, [JSON.stringify(positions)]);

  // Create a single composite key for all dependencies
  const compositeKey = useMemo(() => {
    const posKey = JSON.stringify(normalizedPositions);
    const pathKey = JSON.stringify(pathOptions);
    const handlerKey = eventHandlers ? Object.keys(eventHandlers).sort().join(',') : '';
    return `${posKey}|${pathKey}|${offset}|${popupContent || ''}|${handlerKey}`;
  }, [normalizedPositions, pathOptions, offset, popupContent, eventHandlers]);

  useEffect(() => {
    // Only recreate if the composite key actually changed
    if (prevKeysRef.current === compositeKey && polylineRef.current) {
      return;
    }
    prevKeysRef.current = compositeKey;

    // Clean up previous polyline if it exists
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // If no positions, we're done
    if (normalizedPositions.length === 0) {
      return;
    }

    // Create polyline with offset
    const polyline = L.polyline(normalizedPositions, pathOptions);
    
    // Apply offset (in pixels, positive moves right, negative moves left)
    // Note: leaflet-polylineoffset recalculates on zoom, which is expected behavior
    if (offset !== 0) {
      polyline.setOffset(offset);
    }

    // Add popup if content provided
    if (popupContent) {
      polyline.bindPopup(popupContent, {
        maxWidth: 300,
        autoPan: true,
        autoPanPadding: [50, 50],
        closeButton: true,
        className: 'custom-popup'
      });
    }

    // Add event handlers
    if (eventHandlers) {
      Object.keys(eventHandlers).forEach(eventName => {
        polyline.on(eventName, eventHandlers[eventName]);
      });
    }

    polyline.addTo(map);
    polylineRef.current = polyline;

    // Cleanup function
    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
    };
  }, [map, compositeKey]);

  return null;
};

export default OffsetPolyline;
