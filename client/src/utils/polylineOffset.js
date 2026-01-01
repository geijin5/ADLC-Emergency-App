/**
 * Utility functions for detecting overlapping polylines and calculating offsets
 */

/**
 * Calculate distance between two coordinate points (in degrees)
 * Uses simple Euclidean distance as an approximation
 */
const distance = (coord1, coord2) => {
  const [lat1, lng1] = coord1;
  const [lat2, lng2] = coord2;
  return Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
};

/**
 * Check if two coordinate arrays share similar segments (overlap)
 * Returns true if they have significant overlap
 */
const routesOverlap = (coords1, coords2, threshold = 0.001) => {
  if (!coords1 || !coords2 || coords1.length === 0 || coords2.length === 0) {
    return false;
  }

  // Normalize coordinates
  const normalize = (coords) => {
    return coords.map(coord => {
      if (Array.isArray(coord) && coord.length >= 2) {
        return [parseFloat(coord[0]), parseFloat(coord[1])];
      }
      return coord;
    }).filter(coord => Array.isArray(coord) && coord.length === 2);
  };

  const normalized1 = normalize(coords1);
  const normalized2 = normalize(coords2);

  if (normalized1.length === 0 || normalized2.length === 0) {
    return false;
  }

  // Check if any points from route1 are close to any points from route2
  let closeMatches = 0;
  const minMatches = Math.min(3, Math.min(normalized1.length, normalized2.length) / 2);

  for (const point1 of normalized1) {
    for (const point2 of normalized2) {
      if (distance(point1, point2) < threshold) {
        closeMatches++;
        if (closeMatches >= minMatches) {
          return true;
        }
      }
    }
  }

  // Also check if routes share segments (consecutive points that are close)
  // Sample points along both routes and check for proximity
  const samplePoints = (coords, numSamples = 10) => {
    if (coords.length <= numSamples) return coords;
    const step = Math.floor(coords.length / numSamples);
    const samples = [];
    for (let i = 0; i < coords.length; i += step) {
      samples.push(coords[i]);
    }
    return samples;
  };

  const samples1 = samplePoints(normalized1);
  const samples2 = samplePoints(normalized2);

  for (const point1 of samples1) {
    for (const point2 of samples2) {
      if (distance(point1, point2) < threshold * 2) {
        closeMatches++;
        if (closeMatches >= minMatches) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Calculate offsets for overlapping routes
 * Returns a map of route keys to offset values (in pixels)
 */
export const calculateRouteOffsets = (routes) => {
  if (!routes || routes.length <= 1) {
    return {};
  }

  const offsetMap = {};
  const processed = new Set();
  const OFFSET_STEP = 10; // pixels between overlapping routes

  for (let i = 0; i < routes.length; i++) {
    const route1 = routes[i];
    const key1 = route1.key;

    if (processed.has(key1)) continue;

    // Find all routes that overlap with route1
    const overlappingGroup = [route1];
    for (let j = i + 1; j < routes.length; j++) {
      const route2 = routes[j];
      const key2 = route2.key;

      if (processed.has(key2)) continue;

      if (routesOverlap(route1.coordinates, route2.coordinates)) {
        overlappingGroup.push(route2);
        processed.add(key2);
      }
    }

    // If only one route in group, no offset needed
    if (overlappingGroup.length === 1) {
      offsetMap[key1] = 0;
      processed.add(key1);
      continue;
    }

    // Assign offsets to overlapping routes
    // Center them around 0, so some go left (negative) and some go right (positive)
    const groupSize = overlappingGroup.length;
    const startOffset = -Math.floor((groupSize - 1) / 2) * OFFSET_STEP;

    overlappingGroup.forEach((route, idx) => {
      const offset = startOffset + (idx * OFFSET_STEP);
      offsetMap[route.key] = offset;
      processed.add(route.key);
    });
  }

  return offsetMap;
};

/**
 * Prepare routes for offset calculation
 * Converts route arrays into objects with keys and coordinates
 */
export const prepareRoutesForOffset = (paradeRoutes, detours, closedRoads, routedCoordinates) => {
  const routes = [];

  // Add parade routes
  paradeRoutes.forEach(route => {
    if (route.coordinates && Array.isArray(route.coordinates) && route.coordinates.length > 0) {
      routes.push({
        key: `route-${route.id}`,
        coordinates: routedCoordinates[`route-${route.id}`] || route.coordinates,
        type: 'route'
      });
    }
  });

  // Add detours
  detours.forEach(detour => {
    if (detour.coordinates && Array.isArray(detour.coordinates) && detour.coordinates.length > 0) {
      routes.push({
        key: `detour-${detour.id}`,
        coordinates: routedCoordinates[`detour-${detour.id}`] || detour.coordinates,
        type: 'detour'
      });
    }
  });

  // Add closed roads
  closedRoads.forEach(road => {
    if (road.coordinates && Array.isArray(road.coordinates) && road.coordinates.length > 0) {
      routes.push({
        key: `road-${road.id}`,
        coordinates: routedCoordinates[`road-${road.id}`] || road.coordinates,
        type: 'road'
      });
    }
  });

  return routes;
};

