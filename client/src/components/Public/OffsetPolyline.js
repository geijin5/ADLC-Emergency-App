import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-polylineoffset';

// Helper function for deep comparison of coordinate arrays
const positionsEqual = (pos1, pos2) => {
  if (!pos1 || !pos2) return pos1 === pos2;
  if (pos1.length !== pos2.length) return false;
  for (let i = 0; i < pos1.length; i++) {
    const [lat1, lng1] = Array.isArray(pos1[i]) ? pos1[i] : [pos1[i].lat || pos1[i][0], pos1[i].lng || pos1[i][1] || pos1[i][0]];
    const [lat2, lng2] = Array.isArray(pos2[i]) ? pos2[i] : [pos2[i].lat || pos2[i][0], pos2[i].lng || pos2[i][1] || pos2[i][0]];
    // Compare with small tolerance for floating point precision
    if (Math.abs(parseFloat(lat1) - parseFloat(lat2)) > 0.000001 || 
        Math.abs(parseFloat(lng1) - parseFloat(lng2)) > 0.000001) {
      return false;
    }
  }
  return true;
};

// Component to create offset polyline with popup support
const OffsetPolyline = ({ positions, pathOptions, offset = 0, popupContent, eventHandlers }) => {
  const map = useMap();
  const polylineRef = useRef(null);
  const prevPositionsRef = useRef();
  const prevPathOptionsRef = useRef();
  const prevOffsetRef = useRef();
  const prevPopupContentRef = useRef();
  const prevEventHandlersRef = useRef();

  useEffect(() => {
    // Check if any relevant props have actually changed by value
    const positionsChanged = !positionsEqual(prevPositionsRef.current, positions);
    const pathOptionsChanged = JSON.stringify(prevPathOptionsRef.current) !== JSON.stringify(pathOptions);
    const offsetChanged = prevOffsetRef.current !== offset;
    const popupContentChanged = prevPopupContentRef.current !== popupContent;
    
    // Compare eventHandlers by checking if keys changed (functions can't be stringified)
    const prevEventHandlersKeys = prevEventHandlersRef.current ? Object.keys(prevEventHandlersRef.current).sort().join(',') : '';
    const currentEventHandlersKeys = eventHandlers ? Object.keys(eventHandlers).sort().join(',') : '';
    const eventHandlersChanged = prevEventHandlersKeys !== currentEventHandlersKeys;

    // If only eventHandlers changed (same keys), update handlers without recreating polyline
    if (!positionsChanged && !pathOptionsChanged && !offsetChanged && !popupContentChanged && eventHandlersChanged && polylineRef.current) {
      // Remove old event handlers
      if (prevEventHandlersRef.current) {
        Object.keys(prevEventHandlersRef.current).forEach(eventName => {
          polylineRef.current.off(eventName, prevEventHandlersRef.current[eventName]);
        });
      }
      // Add new event handlers
      if (eventHandlers) {
        Object.keys(eventHandlers).forEach(eventName => {
          polylineRef.current.on(eventName, eventHandlers[eventName]);
        });
      }
      prevEventHandlersRef.current = eventHandlers;
      return;
    }

    // If nothing changed, don't recreate the polyline
    if (!positionsChanged && !pathOptionsChanged && !offsetChanged && !popupContentChanged && !eventHandlersChanged && polylineRef.current) {
      return;
    }

    // Clean up previous polyline if it exists
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    // If no positions, we're done
    if (!positions || positions.length === 0) {
      prevPositionsRef.current = positions;
      prevPathOptionsRef.current = pathOptions;
      prevOffsetRef.current = offset;
      prevPopupContentRef.current = popupContent;
      prevEventHandlersRef.current = eventHandlers;
      return;
    }

    // Normalize positions to ensure they're in [lat, lng] format
    const normalizedPositions = positions.map(coord => {
      if (Array.isArray(coord) && coord.length >= 2) {
        return [parseFloat(coord[0]), parseFloat(coord[1])];
      }
      return coord;
    }).filter(coord => Array.isArray(coord) && coord.length === 2);

    if (normalizedPositions.length === 0) {
      prevPositionsRef.current = positions;
      prevPathOptionsRef.current = pathOptions;
      prevOffsetRef.current = offset;
      prevPopupContentRef.current = popupContent;
      prevEventHandlersRef.current = eventHandlers;
      return;
    }

    // Create polyline with offset
    const polyline = L.polyline(normalizedPositions, pathOptions);
    
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

    // Update refs to current props
    prevPositionsRef.current = positions;
    prevPathOptionsRef.current = pathOptions;
    prevOffsetRef.current = offset;
    prevPopupContentRef.current = popupContent;
    prevEventHandlersRef.current = eventHandlers;

    // Cleanup function
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
