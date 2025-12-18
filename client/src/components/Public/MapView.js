import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Popup, Marker, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getClosedAreas, getParadeRoutes, getDetours, getClosedRoads } from '../../api/api';
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

const MapView = ({ refreshTrigger }) => {
  const [closedAreas, setClosedAreas] = useState([]);
  const [paradeRoutes, setParadeRoutes] = useState([]);
  const [detours, setDetours] = useState([]);
  const [closedRoads, setClosedRoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchedLocation, setSearchedLocation] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM);
  const [mapType, setMapType] = useState('standard'); // 'standard' or 'satellite'

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

  const fetchMapData = async () => {
    try {
      const [areasRes, routesRes, detoursRes, roadsRes] = await Promise.all([
        getClosedAreas(),
        getParadeRoutes(),
        getDetours(),
        getClosedRoads()
      ]);
      setClosedAreas(areasRes.data);
      setParadeRoutes(routesRes.data);
      setDetours(detoursRes.data);
      setClosedRoads(roadsRes.data);
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
          </div>
          <div className="map-wrapper">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '500px', width: '100%', borderRadius: '8px' }}
              scrollWheelZoom={true}
              key={`${mapCenter[0]}-${mapCenter[1]}-${mapZoom}-${mapType}`}
              maxBounds={DEER_LODGE_COUNTY_BOUNDS}
              maxBoundsViscosity={1.0}
              minZoom={9}
              maxZoom={18}
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
                  <Popup>
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
              {paradeRoutes.map((route, index) => (
                <Polyline
                  key={`route-${route.id}`}
                  positions={route.coordinates}
                  pathOptions={{
                    color: '#3b82f6',
                    weight: 5,
                    opacity: 0.8,
                    interactive: true,
                    bubblingMouseEvents: true
                  }}
                  eventHandlers={{
                    mouseover: (e) => {
                      e.target.setStyle({ weight: 7, opacity: 1 });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({ weight: 5, opacity: 0.8 });
                    }
                  }}
                >
                  <Popup>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#3b82f6' }}>🎉 {route.name}</h3>
                      {route.address && (
                        <p style={{ margin: '5px 0', fontWeight: '600', color: '#f9fafb' }}>
                          📍 {route.address}
                        </p>
                      )}
                      {route.description && <p style={{ margin: '5px 0', color: '#d1d5db' }}>{route.description}</p>}
                      {route.expires_at && (
                        <p style={{ margin: '5px 0', fontSize: '12px', color: '#d1d5db' }}>
                          Expires: {new Date(route.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Polyline>
              ))}

              {/* Detours */}
              {detours.map((detour, index) => (
                <Polyline
                  key={`detour-${detour.id}`}
                  positions={detour.coordinates}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 5,
                    opacity: 0.8,
                    dashArray: '10, 5',
                    interactive: true,
                    bubblingMouseEvents: true
                  }}
                  eventHandlers={{
                    mouseover: (e) => {
                      e.target.setStyle({ weight: 7, opacity: 1 });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({ weight: 5, opacity: 0.8 });
                    }
                  }}
                >
                  <Popup>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>🚧 {detour.name}</h3>
                      {detour.address && (
                        <p style={{ margin: '5px 0', fontWeight: '600', color: '#f9fafb' }}>
                          📍 {detour.address}
                        </p>
                      )}
                      {detour.description && <p style={{ margin: '5px 0', color: '#d1d5db' }}>{detour.description}</p>}
                      {detour.expires_at && (
                        <p style={{ margin: '5px 0', fontSize: '12px', color: '#d1d5db' }}>
                          Expires: {new Date(detour.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Polyline>
              ))}

              {/* Closed Roads */}
              {closedRoads.map((road, index) => (
                <Polyline
                  key={`road-${road.id}`}
                  positions={road.coordinates}
                  pathOptions={{
                    color: '#dc2626',
                    weight: 6,
                    opacity: 0.9,
                    dashArray: '15, 10',
                    interactive: true,
                    bubblingMouseEvents: true
                  }}
                  eventHandlers={{
                    mouseover: (e) => {
                      e.target.setStyle({ weight: 8, opacity: 1 });
                    },
                    mouseout: (e) => {
                      e.target.setStyle({ weight: 6, opacity: 0.9 });
                    }
                  }}
                >
                  <Popup>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>🚫 {road.name}</h3>
                      {road.address && (
                        <p style={{ margin: '5px 0', fontWeight: '600', color: '#f9fafb' }}>
                          📍 {road.address}
                        </p>
                      )}
                      {road.description && <p style={{ margin: '5px 0', color: '#d1d5db' }}>{road.description}</p>}
                      {road.expires_at && (
                        <p style={{ margin: '5px 0', fontSize: '12px', color: '#d1d5db' }}>
                          Expires: {new Date(road.expires_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Polyline>
              ))}

              {/* Closed Areas */}
              {closedAreas.map((area) => (
                <Circle
                  key={area.id}
                  center={[area.latitude, area.longitude]}
                  radius={area.radius || 500}
                  pathOptions={{
                    color: '#dc2626',
                    fillColor: '#dc2626',
                    fillOpacity: 0.3,
                    weight: 2
                  }}
                >
                  <Popup>
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#dc2626' }}>{area.name}</h3>
                      {area.address && (
                        <p style={{ margin: '5px 0', fontWeight: '600', color: '#f9fafb' }}>
                          📍 {area.address}
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
          {(closedAreas.length === 0 && paradeRoutes.length === 0 && detours.length === 0 && closedRoads.length === 0 && !searchedLocation) && (
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

