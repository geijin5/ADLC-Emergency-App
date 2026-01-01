import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Popup, Marker, useMap, Polyline, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getClosedAreas, getParadeRoutes, getDetours, getClosedRoads, getPublicSearchRescue } from '../../api/api';
import OffsetPolyline from './OffsetPolyline';
import { getRoadFollowingRoute } from '../../utils/routeUtils';
import { calculateRouteOffsets, prepareRoutesForOffset } from '../../utils/polylineOffset';
import './MapView.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Anaconda-Deer Lodge County, Montana center coordinates
const DEFAULT_CENTER = [46.1286, -112.9422];
const DEFAULT_ZOOM = 10; // Reduced zoom to show more of the county

// Anaconda-Deer Lodge County approximate bounds (southwest, northeast)
// Bounds set to show only Anaconda-Deer Lodge County
const DEER_LODGE_COUNTY_BOUNDS = [
  [45.7, -113.3], // Southwest corner
  [46.6, -112.5]  // Northeast corner
];


// Component to update map view when location changes
function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

const MapView = ({ refreshTrigger, onSectionClick }) => {
  const [closedAreas, setClosedAreas] = useState([]);
  const [paradeRoutes, setParadeRoutes] = useState([]);
  const [detours, setDetours] = useState([]);
  const [closedRoads, setClosedRoads] = useState([]);
  const [searchRescueOps, setSearchRescueOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [mapType, setMapType] = useState('standard'); // 'standard' or 'satellite'
  const [routedCoordinates, setRoutedCoordinates] = useState({}); // Cache for routed coordinates
  const [routeOffsets, setRouteOffsets] = useState({}); // Cache for route offsets to prevent overlap

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Refresh map when refreshTrigger changes (triggered from parent)
  useEffect(() => {
    if (refreshTrigger) {
      fetchMapData();
    }
  }, [refreshTrigger]);

  // Fetch road-following routes for routes, detours, and closed roads
  useEffect(() => {
    const enhanceRoutesWithRoads = async () => {
      const allItems = [
        ...paradeRoutes.map(r => ({ ...r, type: 'route' })),
        ...detours.map(d => ({ ...d, type: 'detour' })),
        ...closedRoads.map(r => ({ ...r, type: 'road' }))
      ].filter(item => item.coordinates && Array.isArray(item.coordinates) && item.coordinates.length >= 2);

      // Only route items that don't already have many points (indicating they need routing)
      // If an item has 10+ points, it's likely already detailed and doesn't need routing
      const itemsToRoute = allItems.filter(item => item.coordinates.length < 10);

      if (itemsToRoute.length === 0) {
        setRoutedCoordinates({});
        return;
      }

      // Process routes in batches to avoid rate limits
      const batchSize = 3;
      const newRoutedCoordinates = {};

      for (let i = 0; i < itemsToRoute.length; i += batchSize) {
        const batch = itemsToRoute.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (item) => {
            const cacheKey = `${item.type}-${item.id}`;
            try {
              const routedCoords = await getRoadFollowingRoute(item.coordinates);
              newRoutedCoordinates[cacheKey] = routedCoords;
            } catch (error) {
              console.error(`Error routing ${item.type} ${item.id}:`, error);
              // Use original coordinates on error
              newRoutedCoordinates[cacheKey] = item.coordinates;
            }
          })
        );

        // Small delay between batches to avoid rate limits
        if (i + batchSize < itemsToRoute.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setRoutedCoordinates(newRoutedCoordinates);
    };

    if (paradeRoutes.length > 0 || detours.length > 0 || closedRoads.length > 0) {
      enhanceRoutesWithRoads();
    } else {
      setRoutedCoordinates({});
    }
    // Dependency on route IDs to trigger re-routing when routes change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(paradeRoutes.map(r => r.id)),
    JSON.stringify(detours.map(d => d.id)),
    JSON.stringify(closedRoads.map(r => r.id))
  ]);

  // Calculate offsets for overlapping routes
  useEffect(() => {
    const routes = prepareRoutesForOffset(paradeRoutes, detours, closedRoads, routedCoordinates);
    if (routes.length > 0) {
      const offsets = calculateRouteOffsets(routes);
      setRouteOffsets(offsets);
    } else {
      setRouteOffsets({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paradeRoutes, detours, closedRoads, routedCoordinates]);

  const fetchMapData = async () => {
    try {
      const [areasRes, routesRes, detoursRes, roadsRes, sarRes] = await Promise.all([
        getClosedAreas(),
        getParadeRoutes(),
        getDetours(),
        getClosedRoads(),
        getPublicSearchRescue()
      ]);
      
      // Ensure coordinates are parsed correctly (handle both string and array formats)
      const parseCoordinates = (coords) => {
        if (!coords) return [];
        if (Array.isArray(coords)) return coords;
        try {
          return typeof coords === 'string' ? JSON.parse(coords) : coords;
        } catch (e) {
          console.error('Error parsing coordinates:', e, coords);
          return [];
        }
      };
      
      setClosedAreas(areasRes.data || []);
      setParadeRoutes((routesRes.data || []).map(route => ({
        ...route,
        coordinates: parseCoordinates(route.coordinates)
      })));
      setDetours((detoursRes.data || []).map(detour => ({
        ...detour,
        coordinates: parseCoordinates(detour.coordinates)
      })));
      setClosedRoads((roadsRes.data || []).map(road => ({
        ...road,
        coordinates: parseCoordinates(road.coordinates)
      })));
      setSearchRescueOps((sarRes.data || []).map(op => ({
        ...op,
        search_area_coordinates: op.search_area_coordinates 
          ? (Array.isArray(op.search_area_coordinates) 
              ? op.search_area_coordinates 
              : JSON.parse(op.search_area_coordinates))
          : null
      })));
    } catch (error) {
      console.error('Failed to fetch map data:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchLocation = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      return;
    }

    setSearching(true);
    try {
      // Use OpenStreetMap Nominatim API for geocoding, constrained to Deer Lodge County, Montana
      const query = `${searchQuery}, Deer Lodge County, Montana`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&bounded=1&viewbox=${DEER_LODGE_COUNTY_BOUNDS[1][1]},${DEER_LODGE_COUNTY_BOUNDS[1][0]},${DEER_LODGE_COUNTY_BOUNDS[0][1]},${DEER_LODGE_COUNTY_BOUNDS[0][0]}`,
        {
          headers: {
            'User-Agent': 'ADLC-Emergency-App'
          }
        }
      );

      const data = await response.json();

      if (data && data.length > 0) {
        // Filter results to ensure they're within Deer Lodge County bounds
        const validResults = data.filter(result => {
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);
          return lat >= DEER_LODGE_COUNTY_BOUNDS[0][0] && 
                 lat <= DEER_LODGE_COUNTY_BOUNDS[1][0] &&
                 lng >= DEER_LODGE_COUNTY_BOUNDS[0][1] && 
                 lng <= DEER_LODGE_COUNTY_BOUNDS[1][1];
        });

        if (validResults.length > 0) {
          const result = validResults[0];
          const location = {
            name: result.display_name,
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            type: result.type,
            address: result.display_name
          };
          setSearchedLocation(location);
          setMapCenter([location.lat, location.lng]);
          setMapZoom(15); // Zoom in on found location
        } else {
          alert('Location not found in Deer Lodge County, Montana. Please try a different search term.');
          setSearchedLocation(null);
        }
      } else {
        alert('Location not found in Deer Lodge County, Montana. Please try a different search term.');
        setSearchedLocation(null);
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Failed to search for location. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchedLocation(null);
    setMapCenter(DEFAULT_CENTER);
    setMapZoom(DEFAULT_ZOOM);
  };

  return (
    <div className="map-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, color: '#f9fafb' }}>Interactive Map - Routes, Detours & Closed Areas</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1f2937', padding: '6px 12px', borderRadius: '6px', border: '1px solid #374151' }}>
            <span style={{ color: '#d1d5db', fontSize: '14px' }}>🗺️ Standard</span>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', margin: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={mapType === 'satellite'}
                onChange={(e) => setMapType(e.target.checked ? 'satellite' : 'standard')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: mapType === 'satellite' ? '#3b82f6' : '#6b7280',
                borderRadius: '24px',
                transition: 'background-color 0.3s',
                cursor: 'pointer'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '18px',
                  width: '18px',
                  left: '3px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: 'transform 0.3s',
                  transform: mapType === 'satellite' ? 'translateX(20px)' : 'translateX(0)'
                }} />
              </span>
            </label>
            <span style={{ color: '#d1d5db', fontSize: '14px' }}>🛰️ Satellite</span>
          </div>
          <button
            onClick={fetchMapData}
            className="btn btn-secondary"
            style={{ 
              padding: '8px 16px',
              fontSize: '14px',
              whiteSpace: 'nowrap'
            }}
            title="Refresh map data"
          >
            🔄 Refresh Map
          </button>
        </div>
      </div>
      
      {/* Location Search */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <form onSubmit={searchLocation} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="location-search" style={{ marginBottom: '5px', display: 'block', color: '#f9fafb' }}>
              Search for a Location in Anaconda-Deer Lodge County
            </label>
            <input
              id="location-search"
              type="text"
              className="input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g., Main Street Anaconda, City Hall, or Park"
              style={{ marginBottom: 0 }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={searching || !searchQuery.trim()}
            style={{ whiteSpace: 'nowrap', height: 'fit-content' }}
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
          {searchedLocation && (
            <button
              type="button"
              onClick={clearSearch}
              className="btn btn-secondary"
              style={{ whiteSpace: 'nowrap', height: 'fit-content' }}
            >
              Clear
            </button>
          )}
        </form>
          {searchedLocation && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#1e3a8a', borderRadius: '5px', border: '1px solid #374151' }}>
              <p style={{ margin: 0, color: '#dbeafe' }}>
                <strong>📍 Found:</strong> {searchedLocation.name}
              </p>
            </div>
          )}
      </div>

      {loading ? (
        <div className="card">
          <p>Loading map...</p>
        </div>
      ) : (
        <>
          <div className="closed-areas-legend" style={{ 
            display: 'flex', 
            gap: '20px', 
            flexWrap: 'wrap',
            marginBottom: '15px',
            padding: '15px',
            background: '#1f2937',
            borderRadius: '8px',
            border: '1px solid #374151'
          }}>
            {onSectionClick ? (
              <>
                <p 
                  style={{ margin: 0, color: '#d1d5db', cursor: 'pointer' }}
                  onClick={() => onSectionClick('closed-areas-section')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#d1d5db'}
                >
                  <strong style={{ color: '#f9fafb' }}>🔴 Closed Areas:</strong> {closedAreas.length} active
                </p>
                <p 
                  style={{ margin: 0, color: '#d1d5db', cursor: 'pointer' }}
                  onClick={() => onSectionClick('parade-routes-section')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#d1d5db'}
                >
                  <strong style={{ color: '#f9fafb' }}>🔵 Parade Routes:</strong> {paradeRoutes.length} active
                </p>
                <p 
                  style={{ margin: 0, color: '#d1d5db', cursor: 'pointer' }}
                  onClick={() => onSectionClick('detours-section')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#d1d5db'}
                >
                  <strong style={{ color: '#f9fafb' }}>🟠 Detours:</strong> {detours.length} active
                </p>
                <p 
                  style={{ margin: 0, color: '#d1d5db', cursor: 'pointer' }}
                  onClick={() => onSectionClick('closed-roads-section')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#d1d5db'}
                >
                  <strong style={{ color: '#f9fafb' }}>🚫 Closed Roads:</strong> {closedRoads.length} active
                </p>
                <p 
                  style={{ margin: '5px 0', fontSize: '14px', color: '#d1d5db', cursor: 'pointer' }}
                  onClick={() => onSectionClick('search-rescue-section')}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#d1d5db'}
                >
                  <strong style={{ color: '#f9fafb' }}>🔍 Search & Rescue:</strong> {searchRescueOps.length} active
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: 0, color: '#d1d5db' }}>
                  <strong style={{ color: '#f9fafb' }}>🔴 Closed Areas:</strong> {closedAreas.length} active
                </p>
                <p style={{ margin: 0, color: '#d1d5db' }}>
                  <strong style={{ color: '#f9fafb' }}>🔵 Parade Routes:</strong> {paradeRoutes.length} active
                </p>
                <p style={{ margin: 0, color: '#d1d5db' }}>
                  <strong style={{ color: '#f9fafb' }}>🟠 Detours:</strong> {detours.length} active
                </p>
                <p style={{ margin: 0, color: '#d1d5db' }}>
                  <strong style={{ color: '#f9fafb' }}>🚫 Closed Roads:</strong> {closedRoads.length} active
                </p>
                <p style={{ margin: '5px 0', fontSize: '14px', color: '#d1d5db' }}>
                  <strong style={{ color: '#f9fafb' }}>🔍 Search & Rescue:</strong> {searchRescueOps.length} active
                </p>
              </>
            )}
          </div>
          <div className="map-wrapper">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '500px', width: '100%', borderRadius: '8px' }}
              scrollWheelZoom={true}
              key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}-${mapType}`}
              maxBounds={DEER_LODGE_COUNTY_BOUNDS}
              maxBoundsViscosity={0.5}
              minZoom={9}
              maxZoom={22}
            >
              <MapUpdater center={mapCenter} zoom={mapZoom} />
              {mapType === 'satellite' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.mapbox.com/">Mapbox</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              ) : (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              )}
              
              {/* Searched Location Marker */}
              {searchedLocation && (
                <Marker position={[searchedLocation.lat, searchedLocation.lng]}>
                  <Popup maxWidth={300} autoPan={true} autoPanPadding={[50, 50]} closeButton={true}>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#3b82f6' }}>
                        🔍 {searchedLocation.name}
                      </h3>
                      <p style={{ margin: '5px 0', fontSize: '12px', color: '#6b7280' }}>
                        Coordinates: {searchedLocation.lat.toFixed(6)}, {searchedLocation.lng.toFixed(6)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Parade Routes */}
              {paradeRoutes.filter(route => route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0).map((route, index) => {
                // Use routed coordinates if available, otherwise use original
                const coordinatesToUse = routedCoordinates[`route-${route.id}`] || route.coordinates;
                const positions = coordinatesToUse.map(coord => 
                  Array.isArray(coord) && coord.length === 2 
                    ? [parseFloat(coord[0]), parseFloat(coord[1])]
                    : coord
                );
                const offset = routeOffsets[`route-${route.id}`] || 0;
                const popupContent = `
                  <div>
                    <h3 style="margin: 0 0 10px 0; color: #3b82f6;">🎉 ${route.name}</h3>
                    ${route.address ? `<p style="margin: 5px 0; font-weight: 600; color: #f9fafb;">📍 ${route.address}</p>` : ''}
                    ${route.crossroads ? `<p style="margin: 5px 0; font-size: 12px; color: #9ca3af;">🚦 ${route.crossroads}</p>` : ''}
                    ${route.description ? `<p style="margin: 5px 0; color: #d1d5db;">${route.description}</p>` : ''}
                    ${route.expires_at ? `<p style="margin: 5px 0; font-size: 12px; color: #d1d5db;">Expires: ${new Date(route.expires_at).toLocaleString()}</p>` : ''}
                  </div>
                `;
                return (
                  <OffsetPolyline
                    key={`route-${route.id}`}
                    positions={positions}
                    pathOptions={{
                      color: '#3b82f6',
                      weight: 5,
                      opacity: 0.8,
                      interactive: true,
                      bubblingMouseEvents: true
                    }}
                    offset={offset}
                    popupContent={popupContent}
                    eventHandlers={{
                      mouseover: (e) => {
                        e.target.setStyle({ weight: 7, opacity: 1 });
                      },
                      mouseout: (e) => {
                        e.target.setStyle({ weight: 5, opacity: 0.8 });
                      }
                    }}
                  />
                );
              })}

              {/* Detours */}
              {detours.filter(detour => detour.coordinates && Array.isArray(detour.coordinates) && detour.coordinates.length > 0).map((detour, index) => {
                // Use routed coordinates if available, otherwise use original
                const coordinatesToUse = routedCoordinates[`detour-${detour.id}`] || detour.coordinates;
                const positions = coordinatesToUse.map(coord => 
                  Array.isArray(coord) && coord.length === 2 
                    ? [parseFloat(coord[0]), parseFloat(coord[1])]
                    : coord
                );
                const offset = routeOffsets[`detour-${detour.id}`] || 0;
                const popupContent = `
                  <div>
                    <h3 style="margin: 0 0 10px 0; color: #f59e0b;">🚧 ${detour.name}</h3>
                    ${detour.address ? `<p style="margin: 5px 0; font-weight: 600; color: #f9fafb;">📍 ${detour.address}</p>` : ''}
                    ${detour.crossroads ? `<p style="margin: 5px 0; font-size: 12px; color: #9ca3af;">🚦 ${detour.crossroads}</p>` : ''}
                    ${detour.description ? `<p style="margin: 5px 0; color: #d1d5db;">${detour.description}</p>` : ''}
                    ${detour.expires_at ? `<p style="margin: 5px 0; font-size: 12px; color: #d1d5db;">Expires: ${new Date(detour.expires_at).toLocaleString()}</p>` : ''}
                  </div>
                `;
                return (
                  <OffsetPolyline
                    key={`detour-${detour.id}`}
                    positions={positions}
                    pathOptions={{
                      color: '#f59e0b',
                      weight: 5,
                      opacity: 0.8,
                      dashArray: '10, 5',
                      interactive: true,
                      bubblingMouseEvents: true
                    }}
                    offset={offset}
                    popupContent={popupContent}
                    eventHandlers={{
                      mouseover: (e) => {
                        e.target.setStyle({ weight: 7, opacity: 1 });
                      },
                      mouseout: (e) => {
                        e.target.setStyle({ weight: 5, opacity: 0.8 });
                      }
                    }}
                  />
                );
              })}

              {/* Closed Roads */}
              {closedRoads.filter(road => road.coordinates && Array.isArray(road.coordinates) && road.coordinates.length > 0).map((road, index) => {
                // Use routed coordinates if available, otherwise use original
                const coordinatesToUse = routedCoordinates[`road-${road.id}`] || road.coordinates;
                const positions = coordinatesToUse.map(coord => 
                  Array.isArray(coord) && coord.length === 2 
                    ? [parseFloat(coord[0]), parseFloat(coord[1])]
                    : coord
                );
                const offset = routeOffsets[`road-${road.id}`] || 0;
                const popupContent = `
                  <div>
                    <h3 style="margin: 0 0 10px 0; color: #dc2626;">🚫 ${road.name}</h3>
                    ${road.address ? `<p style="margin: 5px 0; font-weight: 600; color: #f9fafb;">📍 ${road.address}</p>` : ''}
                    ${road.crossroads ? `<p style="margin: 5px 0; font-size: 12px; color: #9ca3af;">🚦 ${road.crossroads}</p>` : ''}
                    ${road.description ? `<p style="margin: 5px 0; color: #d1d5db;">${road.description}</p>` : ''}
                    ${road.expires_at ? `<p style="margin: 5px 0; font-size: 12px; color: #d1d5db;">Expires: ${new Date(road.expires_at).toLocaleString()}</p>` : ''}
                  </div>
                `;
                return (
                  <OffsetPolyline
                    key={`road-${road.id}`}
                    positions={positions}
                    pathOptions={{
                      color: '#dc2626',
                      weight: 6,
                      opacity: 0.9,
                      dashArray: '15, 10',
                      interactive: true,
                      bubblingMouseEvents: true
                    }}
                    offset={offset}
                    popupContent={popupContent}
                    eventHandlers={{
                      mouseover: (e) => {
                        e.target.setStyle({ weight: 8, opacity: 1 });
                      },
                      mouseout: (e) => {
                        e.target.setStyle({ weight: 6, opacity: 0.9 });
                      }
                    }}
                  />
                );
              })}

              {/* Search and Rescue Operations */}
              {searchRescueOps.map((op) => {
                // Determine color based on status and priority
                const getMarkerColor = () => {
                  if (op.status === 'training') {
                    return '#3b82f6'; // Blue for training
                  } else if (op.priority === 'critical') {
                    return '#dc2626'; // Red for critical
                  } else if (op.priority === 'high') {
                    return '#f59e0b'; // Orange for high
                  } else {
                    return '#059669'; // Green for medium/low
                  }
                };
                
                const markerColor = getMarkerColor();
                const iconEmoji = op.status === 'training' ? '🎓' : '🔍';
                const searchAreaType = op.search_area_type || (op.search_area_coordinates ? 'polygon' : (op.search_area_radius ? 'radius' : 'pin'));
                
                // Create a custom icon for SAR operations
                const sarIcon = L.divIcon({
                  className: 'sar-marker',
                  html: `<div style="
                    background-color: ${markerColor};
                    width: 30px;
                    height: 30px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    border: 3px solid white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  ">
                    <span style="
                      transform: rotate(45deg);
                      color: white;
                      font-size: 18px;
                      font-weight: bold;
                    ">${iconEmoji}</span>
                  </div>`,
                  iconSize: [30, 30],
                  iconAnchor: [15, 30],
                  popupAnchor: [0, -30]
                });

                const popupContent = (
                  <div>
                    <h3 style={{ margin: '0 0 10px 0', color: markerColor }}>
                      {op.status === 'training' ? '🎓' : '🔍'} {op.case_number || `SAR-${op.id}`}: {op.title}
                    </h3>
                    {op.status === 'training' && (
                      <p style={{ 
                        margin: '0 0 10px 0', 
                        padding: '5px 10px',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        display: 'inline-block'
                      }}>
                        🎓 TRAINING OPERATION
                      </p>
                    )}
                    <p style={{ margin: '5px 0', fontWeight: '600', color: '#f9fafb' }}>
                      📍 {op.location}
                    </p>
                    {op.crossroads && (
                      <p style={{ margin: '5px 0', fontSize: '12px', color: '#9ca3af' }}>
                        🚦 {op.crossroads}
                      </p>
                    )}
                    {op.description && <p style={{ margin: '5px 0', color: '#d1d5db' }}>{op.description}</p>}
                    {op.missing_person_name && (
                      <p style={{ margin: '5px 0', color: '#d1d5db' }}>
                        <strong>Missing Person:</strong> {op.missing_person_name}
                        {op.missing_person_age && ` (${op.missing_person_age})`}
                      </p>
                    )}
                    {op.last_seen_location && (
                      <p style={{ margin: '5px 0', fontSize: '12px', color: '#d1d5db' }}>
                        <strong>Last Seen:</strong> {op.last_seen_location}
                      </p>
                    )}
                    <p style={{ margin: '5px 0', fontSize: '12px', color: '#d1d5db' }}>
                      <strong>Status:</strong> {op.status === 'training' ? '🎓 Training' : op.status || 'active'} | <strong>Priority:</strong> {op.priority || 'medium'}
                    </p>
                    {op.assigned_team && (
                      <p style={{ margin: '5px 0', fontSize: '12px', color: '#d1d5db' }}>
                        <strong>Team:</strong> {op.assigned_team}
                      </p>
                    )}
                    {op.status !== 'training' && (
                      <p style={{ margin: '10px 0 0 0', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                        If you have information, call 911
                      </p>
                    )}
                  </div>
                );

                return (
                  <React.Fragment key={`sar-${op.id}`}>
                    {/* SAR Operation Marker - always show if coordinates available */}
                    {op.latitude && op.longitude && (
                      <Marker position={[op.latitude, op.longitude]} icon={sarIcon} zIndexOffset={1000}>
                        <Popup maxWidth={300} autoPan={true} autoPanPadding={[50, 50]} closeButton={true}>
                          {popupContent}
                        </Popup>
                      </Marker>
                    )}
                    {/* Search Area - Radius Boundary (Circle) */}
                    {searchAreaType === 'radius' && op.latitude && op.longitude && op.search_area_radius && (
                      <Circle
                        center={[parseFloat(op.latitude), parseFloat(op.longitude)]}
                        radius={parseFloat(op.search_area_radius)}
                        pathOptions={{
                          color: markerColor,
                          fillColor: markerColor,
                          fillOpacity: op.status === 'training' ? 0.15 : 0.2,
                          weight: 3,
                          dashArray: op.status === 'training' ? '5, 5' : '10, 5',
                          interactive: true,
                          bubblingMouseEvents: true
                        }}
                        eventHandlers={{
                          mouseover: (e) => {
                            e.target.setStyle({ fillOpacity: op.status === 'training' ? 0.25 : 0.3, weight: 4 });
                          },
                          mouseout: (e) => {
                            e.target.setStyle({ fillOpacity: op.status === 'training' ? 0.15 : 0.2, weight: 3 });
                          }
                        }}
                      >
                        <Popup maxWidth={300} autoPan={true} autoPanPadding={[50, 50]} closeButton={true}>
                          <div>
                            <h3 style={{ margin: '0 0 10px 0', color: markerColor }}>
                              {op.status === 'training' ? '🎓' : '🔍'} Search Area: {op.title}
                            </h3>
                            {op.status === 'training' && (
                              <p style={{ 
                                margin: '0 0 10px 0', 
                                padding: '5px 10px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'inline-block'
                              }}>
                                🎓 TRAINING OPERATION
                              </p>
                            )}
                            <p style={{ margin: '5px 0', color: '#d1d5db' }}>
                              <strong>Radius:</strong> {parseFloat(op.search_area_radius).toLocaleString()} meters
                            </p>
                            <p style={{ margin: '5px 0', color: '#d1d5db' }}>
                              {op.case_number || `SAR-${op.id}`}
                            </p>
                          </div>
                        </Popup>
                      </Circle>
                    )}
                    {/* Search Area - Polygon */}
                    {searchAreaType === 'polygon' && op.search_area_coordinates && Array.isArray(op.search_area_coordinates) && op.search_area_coordinates.length > 0 && (
                      <Polygon
                        positions={op.search_area_coordinates}
                        pathOptions={{
                          color: markerColor,
                          fillColor: markerColor,
                          fillOpacity: op.status === 'training' ? 0.15 : 0.2,
                          weight: 3,
                          dashArray: op.status === 'training' ? '5, 5' : '10, 5',
                          interactive: true,
                          bubblingMouseEvents: true
                        }}
                        eventHandlers={{
                          mouseover: (e) => {
                            e.target.setStyle({ fillOpacity: op.status === 'training' ? 0.25 : 0.3, weight: 4 });
                          },
                          mouseout: (e) => {
                            e.target.setStyle({ fillOpacity: op.status === 'training' ? 0.15 : 0.2, weight: 3 });
                          }
                        }}
                        pane="overlayPane"
                      >
                        <Popup maxWidth={300} autoPan={true} autoPanPadding={[50, 50]} closeButton={true}>
                          <div>
                            <h3 style={{ margin: '0 0 10px 0', color: markerColor }}>
                              {op.status === 'training' ? '🎓' : '🔍'} Search Area: {op.title}
                            </h3>
                            {op.status === 'training' && (
                              <p style={{ 
                                margin: '0 0 10px 0', 
                                padding: '5px 10px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'inline-block'
                              }}>
                                🎓 TRAINING OPERATION
                              </p>
                            )}
                            <p style={{ margin: '5px 0', color: '#d1d5db' }}>
                              {op.case_number || `SAR-${op.id}`}
                            </p>
                          </div>
                        </Popup>
                      </Polygon>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Closed Areas */}
              {closedAreas.filter(area => area.latitude != null && area.longitude != null).map((area) => (
                <Circle
                  key={area.id}
                  center={[parseFloat(area.latitude), parseFloat(area.longitude)]}
                  radius={parseFloat(area.radius) || 500}
                  pathOptions={{
                    color: '#dc2626',
                    fillColor: '#dc2626',
                    fillOpacity: 0.25,
                    weight: 2,
                    interactive: true,
                    bubblingMouseEvents: true
                  }}
                  eventHandlers={{
                    mouseover: (e) => {
                      e.target.setStyle({ fillOpacity: 0.35, weight: 3 });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({ fillOpacity: 0.25, weight: 2 });
                    }
                  }}
                >
                  <Popup maxWidth={300} autoPan={true} autoPanPadding={[50, 50]} closeButton={true}>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>{area.name}</h3>
                      {area.address && (
                        <p style={{ margin: '5px 0', fontWeight: '600', color: '#f9fafb' }}>
                          📍 {area.address}
                        </p>
                      )}
                      {area.crossroads && (
                        <p style={{ margin: '5px 0', fontSize: '12px', color: '#9ca3af' }}>
                          🚦 {area.crossroads}
                        </p>
                      )}
                      {area.description && <p style={{ margin: '5px 0', color: '#d1d5db' }}>{area.description}</p>}
                      {area.reason && (
                        <p style={{ margin: '5px 0', color: '#d1d5db' }}>
                          <strong>Reason:</strong> {area.reason}
                        </p>
                      )}
                      {area.expires_at && (
                        <p style={{ margin: '5px 0', fontSize: '12px', color: '#d1d5db' }}>
                          Expires: {new Date(area.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Circle>
              ))}
            </MapContainer>
          </div>
          {(closedAreas.length === 0 && paradeRoutes.length === 0 && detours.length === 0 && closedRoads.length === 0 && searchRescueOps.length === 0 && !searchedLocation) && (
            <div className="card" style={{ marginTop: '20px' }}>
              <p style={{ textAlign: 'center', color: '#d1d5db' }}>
                No active parade routes, detours, closed roads, or closed areas at this time. Search for a location above to view it on the map.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MapView;

