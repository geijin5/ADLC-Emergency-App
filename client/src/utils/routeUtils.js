/**
 * Utility functions for routing and road-following paths
 */

/**
 * Gets a road-following route using OSRM routing service
 * @param {Array} coordinates - Array of [lat, lng] coordinates
 * @returns {Promise<Array>} Array of [lat, lng] coordinates following roads
 */
export const getRoadFollowingRoute = async (coordinates) => {
  if (!coordinates || coordinates.length < 2) {
    return coordinates || [];
  }

  try {
    // Convert coordinates to OSRM format (lng, lat)
    const waypoints = coordinates.map(coord => {
      const [lat, lng] = Array.isArray(coord) ? coord : [coord.lat || coord[0], coord.lng || coord[1] || coord[0]];
      return [parseFloat(lng), parseFloat(lat)];
    });

    // Build OSRM route request URL
    // Using the public OSRM demo server (free, but has rate limits)
    // For production, consider setting up your own OSRM instance
    const coordinatesStr = waypoints.map(wp => `${wp[0]},${wp[1]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesStr}?overview=full&geometries=geojson`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ADLC-Emergency-App'
      }
    });

    if (!response.ok) {
      console.warn('OSRM routing failed, falling back to straight line');
      return coordinates;
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      // Extract the route geometry from the first route
      const routeGeometry = data.routes[0].geometry;
      
      if (routeGeometry && routeGeometry.coordinates) {
        // Convert from [lng, lat] back to [lat, lng] format
        const routeCoordinates = routeGeometry.coordinates.map(coord => [coord[1], coord[0]]);
        console.log(`✅ Road-following route generated: ${coordinates.length} waypoints → ${routeCoordinates.length} route points`);
        return routeCoordinates;
      }
    }

    // Fallback to original coordinates if routing fails
    console.warn('⚠️ OSRM routing returned no valid route, using original coordinates');
    if (data.code && data.code !== 'Ok') {
      console.warn(`OSRM error code: ${data.code}`);
    }
    return coordinates;
  } catch (error) {
    console.error('Error getting road-following route:', error);
    // Fallback to original coordinates on error
    return coordinates;
  }
};

/**
 * Processes routes/detours/roads to add road-following paths
 * This function can be called to enhance coordinates with road-following routes
 * @param {Array} items - Array of route/detour/road items with coordinates
 * @returns {Promise<Array>} Items with enhanced road-following coordinates
 */
export const enhanceWithRoadRoutes = async (items) => {
  if (!items || items.length === 0) {
    return items;
  }

  // Process items in parallel (but limit concurrency to avoid rate limits)
  const enhancedItems = await Promise.all(
    items.map(async (item) => {
      if (!item.coordinates || !Array.isArray(item.coordinates) || item.coordinates.length < 2) {
        return item;
      }

      // If there are only 2 points, get a road-following route
      // If there are more points, we can still route through all waypoints
      try {
        const roadCoordinates = await getRoadFollowingRoute(item.coordinates);
        return {
          ...item,
          coordinates: roadCoordinates,
          _routeEnhanced: true
        };
      } catch (error) {
        console.error(`Error enhancing route for item ${item.id}:`, error);
        return item;
      }
    })
  );

  return enhancedItems;
};

