import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylineoffset';

// Helper function to create a stable key from positions
const getPositionsKey = (positions) => {
  if (!positions || positions.length === 0) return '';
  return JSON.stringify(positions.map(p => [Number(p[0]).toFixed(6), Number(p[1]).toFixed(6)]));
};

// Component to create offset polyline with popup support
const OffsetPolyline = ({ positions, pathOptions, offset = 0, popupContent, eventHandlers }) => {
  const map = useMap();
  const polylineRef = useRef(null);
  const positionsKeyRef = useRef('');

  useEffect(() => {
    if (!positions || positions.length === 0) {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
        positionsKeyRef.current = '';
      }
      return;
    }

    const currentPositionsKey = getPositionsKey(positions);
    const pathOptionsKey = JSON.stringify(pathOptions);
    
    // Only recreate if positions or pathOptions actually changed
    if (positionsKeyRef.current === currentPositionsKey && 
        polylineRef.current && 
        offset === (polylineRef.current.options.offset || 0)) {
      // Nothing changed, keep existing polyline
      return;
    }

    // Clean up previous polyline before creating new one
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // Create polyline with offset
    const polyline = L.polyline(positions, pathOptions);
    
    // Apply offset (in pixels, positive moves right, negative moves left)
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
    positionsKeyRef.current = currentPositionsKey;

    return () => {
      // Only cleanup on unmount
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
        positionsKeyRef.current = '';
      }
    };
  }, [map, JSON.stringify(positions), JSON.stringify(pathOptions), offset, popupContent]);

  return null;
};

export default OffsetPolyline;
