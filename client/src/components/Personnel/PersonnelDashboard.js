import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createAlert, getUsers, createUser, updateUser, deleteUser, getDepartments, createDepartment, updateDepartment, deleteDepartment, getPersonnelClosedAreas, createClosedArea, updateClosedArea, deleteClosedArea, getPersonnelParadeRoutes, createParadeRoute, updateParadeRoute, deleteParadeRoute, getPersonnelDetours, createDetour, updateDetour, deleteDetour, getPersonnelClosedRoads, createClosedRoad, updateClosedRoad, deleteClosedRoad, deleteAllClosedRoads, getCallouts, createCallout, acknowledgeCallout, updateCallout, getChatMessages, sendChatMessage, getPersonnelSearchRescue, createSearchRescue, updateSearchRescue, deleteSearchRescue } from '../../api/api';
import MapView from '../Public/MapView';

const PersonnelDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [closedAreas, setClosedAreas] = useState([]);
  const [paradeRoutes, setParadeRoutes] = useState([]);
  const [detours, setDetours] = useState([]);
  const [closedRoads, setClosedRoads] = useState([]);
  const [callouts, setCallouts] = useState([]);
  const [searchRescueOps, setSearchRescueOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showDetourModal, setShowDetourModal] = useState(false);
  const [showClosedRoadModal, setShowClosedRoadModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showCalloutModal, setShowCalloutModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showSARModal, setShowSARModal] = useState(false);
  const [editingSAR, setEditingSAR] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [selectedChatDept, setSelectedChatDept] = useState('all');
  const [routeType, setRouteType] = useState('parade'); // 'parade' or 'detour'
  const [editingDeptColor, setEditingDeptColor] = useState(null); // Department ID being edited
  const [tempDeptColor, setTempDeptColor] = useState('#3b82f6'); // Temporary color value
  const [alertForm, setAlertForm] = useState({
    title: '',
    message: '',
    severity: 'info',
    expires_at: '',
    send_push: false
  });
  const [areaForm, setAreaForm] = useState({
    name: '',
    description: '',
    address: '',
    latitude: '46.1286',
    longitude: '-112.9422',
    radius: '500',
    reason: '',
    expires_at: ''
  });
  const [routeForm, setRouteForm] = useState({
    name: '',
    description: '',
    address: '',
    streets: '',
    coordinates: '',
    expires_at: ''
  });
  const [closedRoadForm, setClosedRoadForm] = useState({
    name: '',
    description: '',
    address: '',
    streets: '',
    coordinates: '',
    expires_at: ''
  });
  const [routeGeocoding, setRouteGeocoding] = useState(false);
  const [closedRoadGeocoding, setClosedRoadGeocoding] = useState(false);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'personnel',
    name: '',
    department_id: '',
    permissions: {
      createAlerts: false,
      manageRoutes: false,
      manageUsers: false,
      manageDepartments: false
    }
  });
  const [deptForm, setDeptForm] = useState({
    name: '',
    description: '',
    color: '#3b82f6'
  });
  const [calloutForm, setCalloutForm] = useState({
    title: '',
    message: '',
    department_ids: [], // Changed to array for multiple selection
    location: '',
    priority: 'high',
    expires_at: ''
  });
  const [sarForm, setSarForm] = useState({
    case_number: '',
    title: '',
    description: '',
    location: '',
    latitude: '',
    longitude: '',
    status: 'active',
    priority: 'medium',
    missing_person_name: '',
    missing_person_age: '',
    missing_person_description: '',
    last_seen_location: '',
    last_seen_time: '',
    contact_name: '',
    contact_phone: '',
    assigned_team: '',
    search_area_coordinates: ''
  });
  const [geocoding, setGeocoding] = useState(false);
  const [sarGeocoding, setSarGeocoding] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showChatModal) {
      fetchChatMessages();
      const interval = setInterval(fetchChatMessages, 5000); // Refresh chat every 5 seconds
      return () => clearInterval(interval);
    }
  }, [showChatModal, selectedChatDept]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (showChatModal && chatMessages.length > 0) {
      const chatContainer = document.getElementById('chat-messages-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  }, [chatMessages, showChatModal]);

  const fetchChatMessages = async () => {
    try {
      const response = await getChatMessages(selectedChatDept);
      setChatMessages(response.data || []);
    } catch (error) {
      console.error('Failed to fetch chat messages:', error);
    }
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    
    try {
      await sendChatMessage(chatMessage.trim(), selectedChatDept);
      setChatMessage('');
      fetchChatMessages();
    } catch (error) {
      alert('Failed to send message');
      console.error('Error sending chat message:', error);
    }
  };

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes, areasRes, routesRes, detoursRes, roadsRes, calloutsRes, sarRes] = await Promise.all([
        getUsers(),
        getDepartments(),
        getPersonnelClosedAreas(),
        getPersonnelParadeRoutes(),
        getPersonnelDetours(),
        getPersonnelClosedRoads(),
        getCallouts(),
        getPersonnelSearchRescue()
      ]);
      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
      setClosedAreas(areasRes.data || []);
      setParadeRoutes(routesRes.data || []);
      setDetours(detoursRes.data || []);
      setClosedRoads(roadsRes.data || []);
      setCallouts(calloutsRes.data || []);
      setSearchRescueOps(sarRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      if (error.response?.status === 401) {
        logout();
        navigate('/personnel/login');
      }
    } finally {
      setLoading(false);
    }
  };


  const togglePermission = (permission) => {
    setUserForm({
      ...userForm,
      permissions: {
        ...userForm.permissions,
        [permission]: !userForm.permissions[permission]
      }
    });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      if (!userForm.username || !userForm.password || !userForm.name) {
        alert('Please fill in all required fields');
        return;
      }

      const response = await createUser({
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
        name: userForm.name.trim(),
        department_id: userForm.department_id || null,
        permissions: userForm.permissions
      });

      if (response.data.success) {
        setShowUserModal(false);
        setUserForm({
          username: '',
          password: '',
          role: 'personnel',
          name: '',
          department_id: '',
          permissions: {
            createAlerts: false,
            manageRoutes: false,
            manageUsers: false,
            manageDepartments: false
          }
        });
        fetchData();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create user';
      alert(`Error: ${errorMessage}`);
      console.error('Error creating user:', error);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    try {
      if (!deptForm.name) {
        alert('Please enter a department name');
        return;
      }

      const response = await createDepartment({
        name: deptForm.name.trim(),
        description: (deptForm.description || '').trim(),
        color: deptForm.color
      });

      if (response.data.success) {
        setShowDeptModal(false);
        setDeptForm({
          name: '',
          description: '',
          color: '#3b82f6'
        });
        fetchData();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create department';
      alert(`Error: ${errorMessage}`);
      console.error('Error creating department:', error);
    }
  };

  const handleUpdateDepartmentColor = async (deptId, newColor) => {
    // Validate hex color format
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(newColor)) {
      alert('Please enter a valid hex color (e.g., #3b82f6 or #fff)');
      return;
    }

    try {
      await updateDepartment(deptId, { color: newColor });
      setEditingDeptColor(null);
      fetchData();
      alert('Department color updated successfully');
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update department color';
      alert(`Error: ${errorMessage}`);
      console.error('Error updating department color:', error);
    }
  };

  const startEditingColor = (dept) => {
    setEditingDeptColor(dept.id);
    setTempDeptColor(dept.color);
  };

  const cancelEditingColor = () => {
    setEditingDeptColor(null);
    setTempDeptColor('#3b82f6');
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUser(userId);
        fetchData();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to delete user');
      }
    }
  };

  const handleDeleteDepartment = async (deptId) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        await deleteDepartment(deptId);
        fetchData();
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to delete department');
      }
    }
  };

  const handleCreateCallout = async (e) => {
    e.preventDefault();
    try {
      if (!calloutForm.title || !calloutForm.message || !calloutForm.department_ids || calloutForm.department_ids.length === 0) {
        alert('Please fill in title, message, and select at least one department');
        return;
      }

      // Create a callout for each selected department
      const promises = calloutForm.department_ids.map(departmentId => 
        createCallout({
          title: calloutForm.title.trim(),
          message: calloutForm.message.trim(),
          department_id: departmentId,
          location: (calloutForm.location || '').trim(),
          priority: calloutForm.priority,
          expires_at: calloutForm.expires_at && calloutForm.expires_at.trim() ? calloutForm.expires_at : null
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every(response => response.data.success);

      if (allSuccess) {
        const selectedCount = calloutForm.department_ids.length;
        setShowCalloutModal(false);
        setCalloutForm({
          title: '',
          message: '',
          department_ids: [],
          location: '',
          priority: 'high',
          expires_at: ''
        });
        alert(`Mass callout sent successfully to ${selectedCount} department(s)!`);
        fetchData();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create callout';
      alert(`Error: ${errorMessage}`);
      console.error('Error creating callout:', error);
    }
  };

  const handleAcknowledgeCallout = async (calloutId) => {
    try {
      await acknowledgeCallout(calloutId);
      fetchData();
    } catch (error) {
      alert('Failed to acknowledge callout');
    }
  };

  const handleDeactivateCallout = async (calloutId) => {
    if (window.confirm('Are you sure you want to deactivate this callout?')) {
      try {
        await updateCallout(calloutId, { is_active: false });
        fetchData();
      } catch (error) {
        alert('Failed to deactivate callout');
      }
    }
  };

  const handleGeocodeSARLocation = async () => {
    if (!sarForm.location || !sarForm.location.trim()) {
      alert('Please enter a location first');
      return;
    }

    setSarGeocoding(true);
    try {
      // Deer Lodge County bounds
      const DEER_LODGE_BOUNDS = [
        [45.7, -113.3], // Southwest
        [46.6, -112.5]  // Northeast
      ];

      const query = `${sarForm.location}, Deer Lodge County, Montana`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&bounded=1&viewbox=${DEER_LODGE_BOUNDS[1][1]},${DEER_LODGE_BOUNDS[1][0]},${DEER_LODGE_BOUNDS[0][1]},${DEER_LODGE_BOUNDS[0][0]}`,
        {
          headers: {
            'User-Agent': 'ADLC-Emergency-App'
          }
        }
      );

      const data = await response.json();

      // Filter results to ensure they're within Deer Lodge County bounds
      const validResults = data.filter(result => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        return lat >= DEER_LODGE_BOUNDS[0][0] && 
               lat <= DEER_LODGE_BOUNDS[1][0] &&
               lng >= DEER_LODGE_BOUNDS[0][1] && 
               lng <= DEER_LODGE_BOUNDS[1][1];
      });

      if (validResults.length > 0) {
        const result = validResults[0];
        setSarForm({
          ...sarForm,
          latitude: result.lat,
          longitude: result.lon
        });
        alert(`Location found in Deer Lodge County: ${result.display_name}\nCoordinates: ${result.lat}, ${result.lon}`);
      } else {
        alert('Location not found in Deer Lodge County, Montana. You can still create the operation without coordinates, or enter coordinates manually.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Failed to geocode location. You can still create the operation without coordinates, or enter coordinates manually.');
    } finally {
      setSarGeocoding(false);
    }
  };

  const handleCreateSAR = async (e) => {
    e.preventDefault();
    try {
      if (!sarForm.title || !sarForm.location) {
        alert('Please fill in title and location');
        return;
      }

      // Convert empty strings to null for optional fields
      const sarData = {
        ...sarForm,
        latitude: sarForm.latitude && sarForm.latitude.trim() !== '' ? sarForm.latitude : null,
        longitude: sarForm.longitude && sarForm.longitude.trim() !== '' ? sarForm.longitude : null,
        search_area_coordinates: sarForm.search_area_coordinates && sarForm.search_area_coordinates.trim() !== '' ? JSON.parse(sarForm.search_area_coordinates) : null,
        last_seen_time: sarForm.last_seen_time && sarForm.last_seen_time.trim() !== '' ? sarForm.last_seen_time : null
      };

      if (editingSAR) {
        await updateSearchRescue(editingSAR.id, sarData);
        alert('Search and rescue operation updated successfully');
      } else {
        await createSearchRescue(sarData);
        alert('Search and rescue operation created successfully');
      }

      setShowSARModal(false);
      setEditingSAR(null);
      setSarForm({
        case_number: '',
        title: '',
        description: '',
        location: '',
        latitude: '',
        longitude: '',
        status: 'active',
        priority: 'medium',
        missing_person_name: '',
        missing_person_age: '',
        missing_person_description: '',
        last_seen_location: '',
        last_seen_time: '',
        contact_name: '',
        contact_phone: '',
        assigned_team: '',
        search_area_coordinates: ''
      });
      fetchData();
      setMapRefreshTrigger(prev => prev + 1);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save search and rescue operation';
      alert(`Error: ${errorMessage}`);
      console.error('Error saving SAR operation:', error);
    }
  };

  const handleEditSAR = (operation) => {
    setEditingSAR(operation);
    setSarForm({
      case_number: operation.case_number || '',
      title: operation.title || '',
      description: operation.description || '',
      location: operation.location || '',
      latitude: operation.latitude || '',
      longitude: operation.longitude || '',
      status: operation.status || 'active',
      priority: operation.priority || 'medium',
      missing_person_name: operation.missing_person_name || '',
      missing_person_age: operation.missing_person_age || '',
      missing_person_description: operation.missing_person_description || '',
      last_seen_location: operation.last_seen_location || '',
      last_seen_time: operation.last_seen_time ? operation.last_seen_time.substring(0, 16) : '',
      contact_name: operation.contact_name || '',
      contact_phone: operation.contact_phone || '',
      assigned_team: operation.assigned_team || '',
      search_area_coordinates: operation.search_area_coordinates ? JSON.stringify(operation.search_area_coordinates) : ''
    });
    setShowSARModal(true);
  };

  const handleDeleteSAR = async (operationId) => {
    if (window.confirm('Are you sure you want to delete this search and rescue operation?')) {
      try {
        await deleteSearchRescue(operationId);
        fetchData();
        setMapRefreshTrigger(prev => prev + 1);
      } catch (error) {
        alert(error.response?.data?.error || 'Failed to delete search and rescue operation');
      }
    }
  };

  const handleUpdateSARStatus = async (operationId, status) => {
    try {
      await updateSearchRescue(operationId, { status });
      fetchData();
      setMapRefreshTrigger(prev => prev + 1);
    } catch (error) {
      alert('Failed to update search and rescue operation status');
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    try {
      await createAlert(alertForm);
      setShowAlertModal(false);
      setAlertForm({ title: '', message: '', severity: 'info', expires_at: '', send_push: false });
      fetchData();
    } catch (error) {
      alert('Failed to create alert');
    }
  };

  const geocodeAddress = async (address) => {
    if (!address || !address.trim()) {
      alert('Please enter an address');
      return;
    }

    setGeocoding(true);
    try {
      // Deer Lodge County bounds
      const DEER_LODGE_BOUNDS = [
        [45.8, -113.2], // Southwest
        [46.5, -112.6]  // Northeast
      ];

      // Use OpenStreetMap Nominatim API, constrained to Deer Lodge County, Montana
      const query = `${address}, Deer Lodge County, Montana`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&bounded=1&viewbox=${DEER_LODGE_BOUNDS[1][1]},${DEER_LODGE_BOUNDS[1][0]},${DEER_LODGE_BOUNDS[0][1]},${DEER_LODGE_BOUNDS[0][0]}`,
        {
          headers: {
            'User-Agent': 'ADLC-Emergency-App' // Required by Nominatim
          }
        }
      );
      
      const data = await response.json();
      
      // Filter results to ensure they're within Deer Lodge County bounds
      const validResults = data.filter(result => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        return lat >= DEER_LODGE_BOUNDS[0][0] && 
               lat <= DEER_LODGE_BOUNDS[1][0] &&
               lng >= DEER_LODGE_BOUNDS[0][1] && 
               lng <= DEER_LODGE_BOUNDS[1][1];
      });
      
      if (validResults && validResults.length > 0) {
        const result = validResults[0];
        setAreaForm({
          ...areaForm,
          latitude: result.lat,
          longitude: result.lon,
          address: address.trim()
        });
        alert(`Location found in Deer Lodge County: ${result.display_name}`);
      } else {
        alert('Address not found in Deer Lodge County, Montana. Please try a different address or enter coordinates manually.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Failed to geocode address. Please enter coordinates manually.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleCreateArea = async (e) => {
    e.preventDefault();
    try {
      // Validate inputs
      if (!areaForm.name) {
        alert('Please enter a name for the closed area');
        return;
      }

      // Either address or coordinates are required
      if (!areaForm.address && (!areaForm.latitude || !areaForm.longitude)) {
        alert('Please enter either an address (and click "Find Location") or coordinates manually');
        return;
      }

      const lat = parseFloat(areaForm.latitude);
      const lng = parseFloat(areaForm.longitude);
      const rad = parseFloat(areaForm.radius);

      if (isNaN(lat) || isNaN(lng)) {
        alert('Latitude and longitude must be valid numbers. Try using "Find Location" if you entered an address.');
        return;
      }

      if (isNaN(rad) || rad <= 0) {
        alert('Radius must be a positive number');
        return;
      }

      const response = await createClosedArea({
        name: areaForm.name.trim(),
        description: (areaForm.description || '').trim(),
        address: (areaForm.address || '').trim(),
        latitude: lat,
        longitude: lng,
        radius: rad,
        reason: (areaForm.reason || '').trim(),
        expires_at: areaForm.expires_at && areaForm.expires_at.trim() ? areaForm.expires_at : null
      });

      if (response.data.success) {
        setShowAreaModal(false);
        setAreaForm({
          name: '',
          description: '',
          address: '',
          latitude: '46.1286',
          longitude: '-112.9422',
          radius: '500',
          reason: '',
          expires_at: ''
        });
        fetchData();
        setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create closed area';
      alert(`Error: ${errorMessage}`);
      console.error('Error creating closed area:', error);
    }
  };

  const handleToggleArea = async (areaId, isActive) => {
    try {
      await updateClosedArea(areaId, { is_active: !isActive });
      fetchData();
      setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
    } catch (error) {
      alert('Failed to update closed area');
    }
  };

  const handleDeleteArea = async (areaId) => {
    if (window.confirm('Are you sure you want to delete this closed area?')) {
      try {
        await deleteClosedArea(areaId);
        fetchData();
        setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
      } catch (error) {
        alert('Failed to delete closed area');
      }
    }
  };

  const handleGeocodeStreets = async () => {
    if (!routeForm.streets || !routeForm.streets.trim()) {
      alert('Please enter street names or addresses to geocode');
      return;
    }

    setRouteGeocoding(true);
    try {
      // Deer Lodge County bounds
      const DEER_LODGE_BOUNDS = [
        [45.8, -113.2], // Southwest
        [46.5, -112.6]  // Northeast
      ];

      // Parse streets - support two streets per line (e.g., "Main St and Park Ave" or "Main St to Park Ave")
      const streetLines = routeForm.streets
        .split(/[\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (streetLines.length < 1) {
        alert('Please enter at least 1 line with street addresses (can be two streets per line like "Main St and Park Ave")');
        setRouteGeocoding(false);
        return;
      }

      const coordinates = [];
      const geocodedAddresses = [];

      // Process each line - can contain one or two street addresses
      for (const line of streetLines) {
        // Check if line contains " and " or " to " - indicates two streets
        const separators = [' and ', ' to ', ' & ', ' between '];
        let streets = [line];
        
        for (const sep of separators) {
          if (line.toLowerCase().includes(sep.toLowerCase())) {
            streets = line.split(new RegExp(sep, 'i')).map(s => s.trim());
            break;
          }
        }

        // Geocode each street address in the line
        for (const streetAddress of streets) {
          const query = `${streetAddress}, Deer Lodge County, Montana`;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&bounded=1&viewbox=${DEER_LODGE_BOUNDS[1][1]},${DEER_LODGE_BOUNDS[1][0]},${DEER_LODGE_BOUNDS[0][1]},${DEER_LODGE_BOUNDS[0][0]}`,
            {
              headers: {
                'User-Agent': 'ADLC-Emergency-App'
              }
            }
          );

          const data = await response.json();

          // Filter results to ensure they're within Deer Lodge County bounds
          const validResults = data.filter(result => {
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            return lat >= DEER_LODGE_BOUNDS[0][0] && 
                   lat <= DEER_LODGE_BOUNDS[1][0] &&
                   lng >= DEER_LODGE_BOUNDS[0][1] && 
                   lng <= DEER_LODGE_BOUNDS[1][1];
          });

          if (validResults && validResults.length > 0) {
            const result = validResults[0];
            coordinates.push([parseFloat(result.lat), parseFloat(result.lon)]);
            geocodedAddresses.push(result.display_name);
          } else {
            alert(`Warning: Could not find location for "${streetAddress}" in Deer Lodge County. Skipping this location.`);
          }

          // Add a small delay to respect Nominatim's rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (coordinates.length >= 2) {
        // Format coordinates as lines for the textarea
        const coordinatesText = coordinates.map(coord => `${coord[0]}, ${coord[1]}`).join('\n');
        setRouteForm({
          ...routeForm,
          coordinates: coordinatesText
        });
        alert(`Successfully geocoded ${coordinates.length} locations:\n\n${geocodedAddresses.join('\n')}`);
      } else {
        alert('Failed to geocode enough locations. Please check your street addresses or enter coordinates manually.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Failed to geocode street addresses. Please enter coordinates manually.');
    } finally {
      setRouteGeocoding(false);
    }
  };

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    try {
      if (!routeForm.name) {
        alert('Please enter a name for the route');
        return;
      }

      // Either coordinates or streets must be provided
      if (!routeForm.coordinates && !routeForm.streets) {
        alert('Please enter either street names/addresses (and click "Geocode Streets") or coordinates manually');
        return;
      }

      // Parse coordinates - support multiple formats
      let coordinates = [];
      if (routeForm.coordinates && routeForm.coordinates.trim()) {
        try {
          // Try parsing as JSON array first
          if (routeForm.coordinates.trim().startsWith('[')) {
            coordinates = JSON.parse(routeForm.coordinates);
          } else {
            // Parse as line-separated lat,lng pairs
            const lines = routeForm.coordinates.trim().split('\n');
            coordinates = lines.map(line => {
              const [lat, lng] = line.split(',').map(coord => parseFloat(coord.trim()));
              if (isNaN(lat) || isNaN(lng)) {
                throw new Error(`Invalid coordinate: ${line}`);
              }
              return [lat, lng];
            });
          }
        } catch (error) {
          alert(`Invalid coordinates format: ${error.message}\n\nPlease use format:\n46.1286, -112.9422\n46.1300, -112.9400\n\nOr JSON array: [[46.1286, -112.9422], [46.1300, -112.9400]]`);
          return;
        }
      }

      if (coordinates.length < 2) {
        alert('At least 2 coordinate points are required. Please geocode streets or enter coordinates manually.');
        return;
      }

      const createFunction = routeType === 'parade' ? createParadeRoute : createDetour;
      const response = await createFunction({
        name: routeForm.name.trim(),
        description: (routeForm.description || '').trim(),
        address: (routeForm.address || '').trim(),
        coordinates: coordinates,
        expires_at: routeForm.expires_at && routeForm.expires_at.trim() ? routeForm.expires_at : null
      });

      if (response.data.success) {
        setShowRouteModal(false);
        setShowDetourModal(false);
        setRouteForm({
          name: '',
          description: '',
          address: '',
          streets: '',
          coordinates: '',
          expires_at: ''
        });
        fetchData();
        setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create route';
      alert(`Error: ${errorMessage}`);
      console.error('Error creating route:', error);
    }
  };

  const handleToggleRoute = async (id, isActive, type) => {
    try {
      const updateFunction = type === 'parade' ? updateParadeRoute : updateDetour;
      await updateFunction(id, { is_active: !isActive });
      fetchData();
      setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
    } catch (error) {
      alert(`Failed to update ${type}`);
    }
  };

  const handleDeleteRoute = async (id, type) => {
    const typeName = type === 'parade' ? 'parade route' : 'detour';
    if (window.confirm(`Are you sure you want to delete this ${typeName}?`)) {
      try {
        const deleteFunction = type === 'parade' ? deleteParadeRoute : deleteDetour;
        await deleteFunction(id);
        fetchData();
        setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
      } catch (error) {
        alert(`Failed to delete ${typeName}`);
      }
    }
  };

  const handleGeocodeClosedRoadStreets = async () => {
    if (!closedRoadForm.streets || !closedRoadForm.streets.trim()) {
      alert('Please enter street names or addresses to geocode');
      return;
    }

    setClosedRoadGeocoding(true);
    try {
      // Deer Lodge County bounds
      const DEER_LODGE_BOUNDS = [
        [45.8, -113.2], // Southwest
        [46.5, -112.6]  // Northeast
      ];

      // Parse streets - support two streets per line (e.g., "Main St and Park Ave" or "Main St to Park Ave")
      const streetLines = closedRoadForm.streets
        .split(/[\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      if (streetLines.length < 1) {
        alert('Please enter at least 1 line with street addresses (can be two streets per line like "Main St and Park Ave")');
        setClosedRoadGeocoding(false);
        return;
      }

      const coordinates = [];
      const geocodedAddresses = [];

      // Process each line - can contain one or two street addresses
      for (const line of streetLines) {
        // Check if line contains " and " or " to " - indicates two streets
        const separators = [' and ', ' to ', ' & ', ' between '];
        let streets = [line];
        
        for (const sep of separators) {
          if (line.toLowerCase().includes(sep.toLowerCase())) {
            streets = line.split(new RegExp(sep, 'i')).map(s => s.trim());
            break;
          }
        }

        // Geocode each street address in the line
        for (const streetAddress of streets) {
          const query = `${streetAddress}, Deer Lodge County, Montana`;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&bounded=1&viewbox=${DEER_LODGE_BOUNDS[1][1]},${DEER_LODGE_BOUNDS[1][0]},${DEER_LODGE_BOUNDS[0][1]},${DEER_LODGE_BOUNDS[0][0]}`,
            {
              headers: {
                'User-Agent': 'ADLC-Emergency-App'
              }
            }
          );

          const data = await response.json();

          // Filter results to ensure they're within Deer Lodge County bounds
          const validResults = data.filter(result => {
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);
            return lat >= DEER_LODGE_BOUNDS[0][0] && 
                   lat <= DEER_LODGE_BOUNDS[1][0] &&
                   lng >= DEER_LODGE_BOUNDS[0][1] && 
                   lng <= DEER_LODGE_BOUNDS[1][1];
          });

          if (validResults && validResults.length > 0) {
            const result = validResults[0];
            coordinates.push([parseFloat(result.lat), parseFloat(result.lon)]);
            geocodedAddresses.push(result.display_name);
          } else {
            alert(`Warning: Could not find location for "${streetAddress}" in Deer Lodge County. Skipping this location.`);
          }

          // Add a small delay to respect Nominatim's rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (coordinates.length >= 2) {
        // Format coordinates as lines for the textarea
        const coordinatesText = coordinates.map(coord => `${coord[0]}, ${coord[1]}`).join('\n');
        setClosedRoadForm({
          ...closedRoadForm,
          coordinates: coordinatesText
        });
        alert(`Successfully geocoded ${coordinates.length} locations:\n\n${geocodedAddresses.join('\n')}`);
      } else {
        alert('Failed to geocode enough locations. Please check your street addresses or enter coordinates manually.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('Failed to geocode street addresses. Please enter coordinates manually.');
    } finally {
      setClosedRoadGeocoding(false);
    }
  };

  const handleCreateClosedRoad = async (e) => {
    e.preventDefault();
    try {
      if (!closedRoadForm.name) {
        alert('Please enter a name for the closed road');
        return;
      }

      // Either coordinates or streets must be provided
      if (!closedRoadForm.coordinates && !closedRoadForm.streets) {
        alert('Please enter either street names/addresses (and click "Geocode Streets") or coordinates manually');
        return;
      }

      // Parse coordinates - support multiple formats
      let coordinates = [];
      if (closedRoadForm.coordinates && closedRoadForm.coordinates.trim()) {
        try {
          // Try parsing as JSON array first
          if (closedRoadForm.coordinates.trim().startsWith('[')) {
            coordinates = JSON.parse(closedRoadForm.coordinates);
          } else {
            // Parse as line-separated lat,lng pairs
            const lines = closedRoadForm.coordinates.trim().split('\n');
            coordinates = lines.map(line => {
              const [lat, lng] = line.split(',').map(coord => parseFloat(coord.trim()));
              if (isNaN(lat) || isNaN(lng)) {
                throw new Error(`Invalid coordinate: ${line}`);
              }
              return [lat, lng];
            });
          }
        } catch (error) {
          alert(`Invalid coordinates format: ${error.message}\n\nPlease use format:\n46.1286, -112.9422\n46.1300, -112.9400\n\nOr JSON array: [[46.1286, -112.9422], [46.1300, -112.9400]]`);
          return;
        }
      }

      if (coordinates.length < 2) {
        alert('At least 2 coordinate points are required. Please geocode streets or enter coordinates manually.');
        return;
      }

      const response = await createClosedRoad({
        name: closedRoadForm.name.trim(),
        description: (closedRoadForm.description || '').trim(),
        address: (closedRoadForm.address || '').trim(),
        coordinates: coordinates,
        expires_at: closedRoadForm.expires_at && closedRoadForm.expires_at.trim() ? closedRoadForm.expires_at : null
      });

      if (response.data.success) {
        setShowClosedRoadModal(false);
        setClosedRoadForm({
          name: '',
          description: '',
          address: '',
          streets: '',
          coordinates: '',
          expires_at: ''
        });
        fetchData();
        setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create closed road';
      alert(`Error: ${errorMessage}`);
      console.error('Error creating closed road:', error);
    }
  };

  const handleToggleClosedRoad = async (id, isActive) => {
    try {
      await updateClosedRoad(id, { is_active: !isActive });
      fetchData();
      setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
    } catch (error) {
      alert('Failed to update closed road');
    }
  };

  const handleDeleteClosedRoad = async (id) => {
    if (window.confirm('Are you sure you want to delete this closed road?')) {
      try {
        await deleteClosedRoad(id);
        fetchData();
        setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
      } catch (error) {
        alert('Failed to delete closed road');
      }
    }
  };

  const handleClearAllClosedRoads = async () => {
    if (closedRoads.length === 0) {
      alert('No closed roads to clear');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete ALL ${closedRoads.length} closed roads? This action cannot be undone.`)) {
      try {
        await deleteAllClosedRoads();
        fetchData();
        setMapRefreshTrigger(prev => prev + 1); // Trigger map refresh
        alert('All closed roads have been deleted');
      } catch (error) {
        alert('Failed to delete all closed roads');
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="/logo.png" alt="ADLC Emergency Services Logo" style={{ height: '60px', width: '60px' }} />
            <span style={{ fontSize: '20px' }}>ADLC Emergency Services - Personnel</span>
          </div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px' }}>Welcome, {user?.name || user?.username}</span>
            <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container">
        <h1 style={{ marginBottom: '30px', color: '#f9fafb' }}>Emergency Personnel Dashboard</h1>

        {loading ? (
          <div className="card">
            <p>Loading dashboard...</p>
          </div>
        ) : (
          <>
            {/* Active Callouts Alert */}
            {callouts.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                {callouts.map((callout) => {
                  const acknowledged = callout.acknowledged_by ? JSON.parse(callout.acknowledged_by) : [];
                  const isAcknowledged = acknowledged.includes(user?.id);
                  return (
                    <div
                      key={callout.id}
                      style={{
                        background: `linear-gradient(135deg, ${callout.department_color || '#dc2626'} 0%, ${callout.department_color || '#991b1b'} 100%)`,
                        color: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        border: isAcknowledged ? '3px solid #10b981' : '3px solid transparent'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '24px' }}>🚨</span>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>
                              MASS CALLOUT - {callout.department_name?.toUpperCase()}
                            </h3>
                            {isAcknowledged && (
                              <span style={{ 
                                padding: '4px 12px', 
                                backgroundColor: '#10b981', 
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '600'
                              }}>
                                ✓ ACKNOWLEDGED
                              </span>
                            )}
                          </div>
                          <h4 style={{ margin: '5px 0', fontSize: '18px' }}>{callout.title}</h4>
                          <p style={{ margin: '10px 0', fontSize: '16px', lineHeight: '1.6' }}>
                            {callout.message}
                          </p>
                          {callout.location && (
                            <p style={{ margin: '5px 0', fontSize: '14px', opacity: 0.9 }}>
                              📍 <strong>Location:</strong> {callout.location}
                            </p>
                          )}
                          <p style={{ margin: '5px 0', fontSize: '12px', opacity: 0.8 }}>
                            Priority: <strong>{callout.priority.toUpperCase()}</strong> | 
                            Issued: {formatDate(callout.created_at)} | 
                            By: {callout.created_by_name}
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                          {!isAcknowledged && (
                            <button
                              onClick={() => handleAcknowledgeCallout(callout.id)}
                              className="btn"
                              style={{
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                padding: '10px 20px',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              ✓ Acknowledge
                            </button>
                          )}
                          {(user?.role === 'admin' || callout.created_by === user?.id) && (
                            <button
                              onClick={() => handleDeactivateCallout(callout.id)}
                              className="btn"
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                border: '2px solid white',
                                padding: '10px 20px',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setShowCalloutModal(true)} 
                className="btn btn-primary"
                style={{ 
                  backgroundColor: '#dc2626',
                  fontSize: '16px',
                  padding: '12px 24px',
                  fontWeight: 'bold'
                }}
              >
                🚨 MASS CALLOUT (MCI)
              </button>
              <button 
                onClick={() => setShowAlertModal(true)} 
                className="btn btn-success"
              >
                Create Public Alert
              </button>
              <button 
                onClick={() => setShowChatModal(true)} 
                className="btn btn-success"
                style={{ backgroundColor: '#8b5cf6' }}
              >
                💬 Department Chat
              </button>
              <button 
                onClick={() => { setEditingSAR(null); setShowSARModal(true); }} 
                className="btn btn-success"
                style={{ backgroundColor: '#059669' }}
              >
                🔍 Search & Rescue
              </button>
              <button 
                onClick={() => setShowAreaModal(true)} 
                className="btn btn-success"
              >
                Add Closed Area
              </button>
              <button 
                onClick={() => { setRouteType('parade'); setShowRouteModal(true); }}
                className="btn btn-success"
                style={{ backgroundColor: '#3b82f6' }}
              >
                Add Parade Route
              </button>
              <button 
                onClick={() => { setRouteType('detour'); setShowDetourModal(true); }}
                className="btn btn-success"
                style={{ backgroundColor: '#f59e0b' }}
              >
                Add Detour
              </button>
              <button 
                onClick={() => setShowClosedRoadModal(true)}
                className="btn btn-success"
                style={{ backgroundColor: '#dc2626' }}
              >
                Add Closed Road
              </button>
              {user?.role === 'admin' && (
                <>
                  <button 
                    onClick={() => setShowUserModal(true)} 
                    className="btn btn-success"
                    style={{ backgroundColor: '#8b5cf6' }}
                  >
                    Create User
                  </button>
                  <button 
                    onClick={() => setShowDeptModal(true)} 
                    className="btn btn-success"
                    style={{ backgroundColor: '#ec4899' }}
                  >
                    Create Department
                  </button>
                </>
              )}
              <button 
                onClick={fetchData} 
                className="btn btn-secondary"
              >
                Refresh
              </button>
            </div>

            {/* Map View - Shows Parade Routes, Detours, and Closed Areas */}
            <div className="card" style={{ marginTop: '30px' }}>
              <MapView refreshTrigger={mapRefreshTrigger} />
            </div>

            <div className="card" style={{ marginTop: '30px' }}>
              <h2 style={{ marginBottom: '20px' }}>Closed Areas Management</h2>
              {closedAreas.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>No closed areas defined.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Address/Location</th>
                        <th>Description</th>
                        <th>Coordinates</th>
                        <th>Radius (m)</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedAreas.map((area) => (
                        <tr key={area.id}>
                          <td><strong>{area.name}</strong></td>
                          <td>{area.address || '-'}</td>
                          <td>{area.description || '-'}</td>
                          <td style={{ fontSize: '12px' }}>
                            {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
                          </td>
                          <td>{area.radius}</td>
                          <td>{area.reason || '-'}</td>
                          <td>
                            <span className={`badge badge-${area.is_active ? 'in-progress' : 'resolved'}`}>
                              {area.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: '#d1d5db' }}>
                            {area.expires_at ? formatDate(area.expires_at) : 'No expiration'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleToggleArea(area.id, area.is_active)}
                                className={`btn ${area.is_active ? 'btn-secondary' : 'btn-success'}`}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                {area.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteArea(area.id)}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#ef4444' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Parade Routes Management */}
            <div className="card" style={{ marginTop: '30px' }}>
              <h2 style={{ marginBottom: '20px' }}>Parade Routes Management</h2>
              {paradeRoutes.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>No parade routes defined.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Address</th>
                        <th>Description</th>
                        <th>Points</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paradeRoutes.map((route) => (
                        <tr key={route.id}>
                          <td><strong>🎉 {route.name}</strong></td>
                          <td>{route.address || '-'}</td>
                          <td>{route.description || '-'}</td>
                          <td style={{ fontSize: '12px' }}>{route.coordinates.length} points</td>
                          <td>
                            <span className={`badge badge-${route.is_active ? 'in-progress' : 'resolved'}`}>
                              {route.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: '#d1d5db' }}>
                            {route.expires_at ? formatDate(route.expires_at) : 'No expiration'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleToggleRoute(route.id, route.is_active, 'parade')}
                                className={`btn ${route.is_active ? 'btn-secondary' : 'btn-success'}`}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                {route.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteRoute(route.id, 'parade')}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#ef4444' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detours Management */}
            <div className="card" style={{ marginTop: '30px' }}>
              <h2 style={{ marginBottom: '20px' }}>Detours Management</h2>
              {detours.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>No detours defined.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Address</th>
                        <th>Description</th>
                        <th>Points</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detours.map((detour) => (
                        <tr key={detour.id}>
                          <td><strong>🚧 {detour.name}</strong></td>
                          <td>{detour.address || '-'}</td>
                          <td>{detour.description || '-'}</td>
                          <td style={{ fontSize: '12px' }}>{detour.coordinates.length} points</td>
                          <td>
                            <span className={`badge badge-${detour.is_active ? 'in-progress' : 'resolved'}`}>
                              {detour.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: '#d1d5db' }}>
                            {detour.expires_at ? formatDate(detour.expires_at) : 'No expiration'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleToggleRoute(detour.id, detour.is_active, 'detour')}
                                className={`btn ${detour.is_active ? 'btn-secondary' : 'btn-success'}`}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                {detour.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteRoute(detour.id, 'detour')}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#ef4444' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Closed Roads Management */}
            <div className="card" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Closed Roads Management</h2>
                {closedRoads.length > 0 && (
                  <button
                    onClick={handleClearAllClosedRoads}
                    className="btn btn-primary"
                    style={{ 
                      padding: '8px 16px',
                      fontSize: '14px',
                      backgroundColor: '#dc2626'
                    }}
                  >
                    🗑️ Clear All Closed Roads
                  </button>
                )}
              </div>
              {closedRoads.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>No closed roads defined.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Address</th>
                        <th>Description</th>
                        <th>Points</th>
                        <th>Status</th>
                        <th>Expires</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedRoads.map((road) => (
                        <tr key={road.id}>
                          <td><strong>🚫 {road.name}</strong></td>
                          <td>{road.address || '-'}</td>
                          <td>{road.description || '-'}</td>
                          <td style={{ fontSize: '12px' }}>{road.coordinates.length} points</td>
                          <td>
                            <span className={`badge badge-${road.is_active ? 'in-progress' : 'resolved'}`}>
                              {road.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ fontSize: '12px', color: '#d1d5db' }}>
                            {road.expires_at ? formatDate(road.expires_at) : 'No expiration'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleToggleClosedRoad(road.id, road.is_active)}
                                className={`btn ${road.is_active ? 'btn-secondary' : 'btn-success'}`}
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                {road.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleDeleteClosedRoad(road.id)}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#ef4444' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Search and Rescue Operations */}
            <div className="card" style={{ marginTop: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>🔍 Search and Rescue Operations</h2>
                <button
                  onClick={() => { setEditingSAR(null); setShowSARModal(true); }}
                  className="btn btn-success"
                  style={{ padding: '8px 16px', fontSize: '14px', backgroundColor: '#059669' }}
                >
                  + New Operation
                </button>
              </div>
              {searchRescueOps.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>No search and rescue operations.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Case #</th>
                        <th>Title</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Missing Person</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchRescueOps.map((op) => (
                        <tr key={op.id}>
                          <td><strong>{op.case_number || `SAR-${op.id}`}</strong></td>
                          <td>{op.title}</td>
                          <td>{op.location}</td>
                          <td>
                            <span className={`badge badge-${op.status === 'active' || op.status === 'in_progress' ? 'in-progress' : op.status === 'resolved' ? 'resolved' : 'pending'}`}>
                              {op.status || 'active'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${op.priority === 'high' ? 'badge-danger' : op.priority === 'medium' ? 'badge-warning' : 'badge-in-progress'}`}>
                              {op.priority || 'medium'}
                            </span>
                          </td>
                          <td>{op.missing_person_name || '-'}</td>
                          <td style={{ fontSize: '12px', color: '#d1d5db' }}>
                            {formatDate(op.created_at)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleEditSAR(op)}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                Edit
                              </button>
                              <select
                                value={op.status || 'active'}
                                onChange={(e) => handleUpdateSARStatus(op.id, e.target.value)}
                                className="btn"
                                style={{ padding: '5px 10px', fontSize: '12px', marginRight: '5px' }}
                              >
                                <option value="active">Active</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                              <button
                                onClick={() => handleDeleteSAR(op.id)}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#ef4444' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Users Management (Admin Only) */}
            {user?.role === 'admin' && (
              <div className="card" style={{ marginTop: '30px' }}>
                <h2 style={{ marginBottom: '20px' }}>Users Management</h2>
                {users.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#6b7280' }}>No users found.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Department</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => (
                          <tr key={u.id}>
                            <td><strong>{u.username}</strong></td>
                            <td>{u.name}</td>
                            <td>
                              <span className={`badge ${u.role === 'admin' ? 'badge-danger' : 'badge-in-progress'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              {u.department_name ? (
                                <span style={{ 
                                  padding: '4px 12px', 
                                  borderRadius: '12px', 
                                  fontSize: '12px',
                                  backgroundColor: u.department_color + '20',
                                  color: u.department_color,
                                  fontWeight: '600'
                                }}>
                                  {u.department_name}
                                </span>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td style={{ fontSize: '12px', color: '#d1d5db' }}>
                              {formatDate(u.created_at)}
                            </td>
                            <td>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#ef4444' }}
                                disabled={u.id === user.id}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Departments Management (Admin Only) */}
            {user?.role === 'admin' && (
              <div className="card" style={{ marginTop: '30px' }}>
                <h2 style={{ marginBottom: '20px' }}>Departments Management</h2>
                {departments.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#6b7280' }}>No departments found.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Description</th>
                          <th>Color</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {departments.map((dept) => (
                          <tr key={dept.id}>
                            <td><strong>{dept.name}</strong></td>
                            <td>{dept.description || '-'}</td>
                            <td>
                              {editingDeptColor === dept.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                  <input
                                    type="color"
                                    value={tempDeptColor}
                                    onChange={(e) => setTempDeptColor(e.target.value)}
                                    style={{
                                      width: '50px',
                                      height: '30px',
                                      border: '1px solid #4b5563',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                  />
                                  <input
                                    type="text"
                                    value={tempDeptColor}
                                    onChange={(e) => setTempDeptColor(e.target.value)}
                                    style={{
                                      width: '100px',
                                      padding: '5px',
                                      backgroundColor: '#1f2937',
                                      border: '1px solid #4b5563',
                                      borderRadius: '4px',
                                      color: '#f9fafb',
                                      fontSize: '12px'
                                    }}
                                    placeholder="#3b82f6"
                                  />
                                  <button
                                    onClick={() => handleUpdateDepartmentColor(dept.id, tempDeptColor)}
                                    className="btn btn-success"
                                    style={{ padding: '5px 10px', fontSize: '12px' }}
                                  >
                                    ✓ Save
                                  </button>
                                  <button
                                    onClick={cancelEditingColor}
                                    className="btn btn-secondary"
                                    style={{ padding: '5px 10px', fontSize: '12px' }}
                                  >
                                    ✕ Cancel
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '30px',
                                    height: '30px',
                                    backgroundColor: dept.color,
                                    borderRadius: '4px',
                                    border: '1px solid #4b5563',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => startEditingColor(dept)}
                                  title="Click to edit color"
                                  ></div>
                                  <span style={{ fontSize: '12px', color: '#d1d5db' }}>{dept.color}</span>
                                  <button
                                    onClick={() => startEditingColor(dept)}
                                    className="btn btn-secondary"
                                    style={{ padding: '3px 8px', fontSize: '11px' }}
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </td>
                            <td>
                              <button
                                onClick={() => handleDeleteDepartment(dept.id)}
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#ef4444' }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showAlertModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>Create Public Alert</h2>
            <form onSubmit={handleCreateAlert}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  className="input"
                  value={alertForm.title}
                  onChange={(e) => setAlertForm({ ...alertForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea
                  className="input"
                  value={alertForm.message}
                  onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                  required
                  rows="4"
                />
              </div>
              <div className="form-group">
                <label>Severity</label>
                <select
                  className="select"
                  value={alertForm.severity}
                  onChange={(e) => setAlertForm({ ...alertForm, severity: e.target.value })}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="danger">Danger</option>
                </select>
              </div>
              <div className="form-group">
                <label>Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={alertForm.expires_at}
                  onChange={(e) => setAlertForm({ ...alertForm, expires_at: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={alertForm.send_push}
                    onChange={(e) => setAlertForm({ ...alertForm, send_push: e.target.checked })}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span>🔔 Send push notification to all subscribers</span>
                </label>
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block', marginLeft: '30px' }}>
                  When checked, all users who enabled push notifications will receive this alert on their device
                </small>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>
                  Create Alert
                </button>
                <button
                  type="button"
                  onClick={() => setShowAlertModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAreaModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>Create Closed Area</h2>
            <form onSubmit={handleCreateArea}>
              <div className="form-group">
                <label>Area Name *</label>
                <input
                  type="text"
                  className="input"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  placeholder="e.g., Main Street Closure"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input"
                  value={areaForm.description}
                  onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                  placeholder="Additional details about the closed area"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Address or Location (Deer Lodge County, Montana)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    className="input"
                    value={areaForm.address}
                    onChange={(e) => setAreaForm({ ...areaForm, address: e.target.value })}
                    placeholder="e.g., Main Street Anaconda or 123 Park Ave"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => geocodeAddress(areaForm.address)}
                    className="btn btn-secondary"
                    disabled={geocoding || !areaForm.address}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {geocoding ? 'Finding...' : 'Find Location'}
                  </button>
                </div>
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter an address in Deer Lodge County and click "Find Location" to automatically get coordinates, or enter coordinates manually below.
                </small>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={areaForm.latitude}
                    onChange={(e) => setAreaForm({ ...areaForm, latitude: e.target.value })}
                    placeholder="46.1286"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={areaForm.longitude}
                    onChange={(e) => setAreaForm({ ...areaForm, longitude: e.target.value })}
                    placeholder="-112.9422"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Radius (meters) *</label>
                <input
                  type="number"
                  className="input"
                  value={areaForm.radius}
                  onChange={(e) => setAreaForm({ ...areaForm, radius: e.target.value })}
                  placeholder="500"
                  required
                />
              </div>
              <div className="form-group">
                <label>Reason for Closure</label>
                <input
                  type="text"
                  className="input"
                  value={areaForm.reason}
                  onChange={(e) => setAreaForm({ ...areaForm, reason: e.target.value })}
                  placeholder="e.g., Road construction, Emergency response"
                />
              </div>
              <div className="form-group">
                <label>Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={areaForm.expires_at}
                  onChange={(e) => setAreaForm({ ...areaForm, expires_at: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>
                  Create Closed Area
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAreaModal(false);
                    setAreaForm({
                      name: '',
                      description: '',
                      address: '',
                      latitude: '46.1286',
                      longitude: '-112.9422',
                      radius: '500',
                      reason: '',
                      expires_at: ''
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Parade Route / Detour Modal */}
      {(showRouteModal || showDetourModal) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '700px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>
              {routeType === 'parade' ? '🎉 Create Parade Route' : '🚧 Create Detour'}
            </h2>
            <form onSubmit={handleCreateRoute}>
              <div className="form-group">
                <label>Route Name *</label>
                <input
                  type="text"
                  className="input"
                  value={routeForm.name}
                  onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
                  placeholder={routeType === 'parade' ? 'e.g., Main Street Parade Route' : 'e.g., Construction Detour'}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input"
                  value={routeForm.description}
                  onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
                  placeholder="Additional details about the route"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Address or Location (Optional)</label>
                <input
                  type="text"
                  className="input"
                  value={routeForm.address}
                  onChange={(e) => setRouteForm({ ...routeForm, address: e.target.value })}
                  placeholder={routeType === 'parade' ? 'e.g., Main Street from Park Ave to First St, Anaconda' : 'e.g., Detour via Railroad Ave from Main St to Second St'}
                />
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter a general address or location description for this route/detour. This will be displayed on the map to help users identify the location.
                </small>
              </div>
              <div className="form-group">
                <label>Street Names or Addresses (Alternative to Coordinates)</label>
                <textarea
                  className="input"
                  value={routeForm.streets}
                  onChange={(e) => setRouteForm({ ...routeForm, streets: e.target.value })}
                  placeholder="Main Street and Park Avenue, Anaconda&#10;First Street to Second Street, Anaconda&#10;Third Street and Cedar Street, Anaconda"
                  rows="5"
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleGeocodeStreets}
                    className="btn btn-primary"
                    disabled={routeGeocoding || !routeForm.streets}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {routeGeocoding ? 'Geocoding...' : 'Geocode Streets'}
                  </button>
                </div>
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter street names or addresses. You can put two streets per line using "and", "to", "&", or "between" (e.g., "Main Street and Park Avenue"). Click "Geocode Streets" to automatically convert them to coordinates. Street addresses will be constrained to Deer Lodge County, Montana.
                </small>
              </div>
              <div className="form-group">
                <label>Coordinates *</label>
                <textarea
                  className="input"
                  value={routeForm.coordinates}
                  onChange={(e) => setRouteForm({ ...routeForm, coordinates: e.target.value })}
                  placeholder="46.1286, -112.9422&#10;46.1300, -112.9400&#10;46.1315, -112.9380"
                  rows="8"
                />
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter coordinates as one per line: "latitude, longitude"<br/>
                  Example:<br/>
                  46.1286, -112.9422<br/>
                  46.1300, -112.9400<br/>
                  46.1315, -112.9380<br/><br/>
                  Or as JSON array: [[46.1286, -112.9422], [46.1300, -112.9400]]<br/><br/>
                  <strong>Note:</strong> You can either enter street names above and click "Geocode Streets", or enter coordinates manually here. At least one method is required.
                </small>
              </div>
              <div className="form-group">
                <label>Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={routeForm.expires_at}
                  onChange={(e) => setRouteForm({ ...routeForm, expires_at: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  className="btn btn-success" 
                  style={{ 
                    flex: 1,
                    backgroundColor: routeType === 'parade' ? '#3b82f6' : '#f59e0b'
                  }}
                >
                  Create {routeType === 'parade' ? 'Parade Route' : 'Detour'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRouteModal(false);
                    setShowDetourModal(false);
                    setRouteForm({
                      name: '',
                      description: '',
                      address: '',
                      streets: '',
                      coordinates: '',
                      expires_at: ''
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal (Admin Only) */}
      {showUserModal && user?.role === 'admin' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '700px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>Create New User</h2>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    type="text"
                    className="input"
                    value={userForm.username}
                    onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    className="input"
                    value={userForm.password}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  className="input"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select
                  className="select"
                  value={userForm.role}
                  onChange={(e) => {
                    const newRole = e.target.value;
                    setUserForm({ 
                      ...userForm, 
                      role: newRole,
                      // Auto-set permissions based on role
                      permissions: newRole === 'admin' ? {
                        viewReports: true,
                        updateReports: true,
                        createAlerts: true,
                        manageRoutes: true,
                        manageUsers: true,
                        manageDepartments: true
                      } : {
                        viewReports: true,
                        updateReports: true,
                        createAlerts: false,
                        manageRoutes: false,
                        manageUsers: false,
                        manageDepartments: false
                      }
                    });
                  }}
                  required
                >
                  <option value="personnel">Personnel</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>Department *</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                  gap: '10px',
                  marginTop: '10px'
                }}>
                  <div
                    onClick={() => setUserForm({ ...userForm, department_id: '' })}
                    style={{
                      padding: '15px',
                      border: `2px solid ${userForm.department_id === '' ? '#3b82f6' : '#d1d5db'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      backgroundColor: userForm.department_id === '' ? '#1e3a8a' : '#1f2937',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '5px' }}>No Department</div>
                  </div>
                  {departments.map((dept) => (
                    <div
                      key={dept.id}
                      onClick={() => setUserForm({ ...userForm, department_id: dept.id })}
                      style={{
                        padding: '15px',
                        border: `2px solid ${userForm.department_id === dept.id ? dept.color : '#d1d5db'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        backgroundColor: userForm.department_id === dept.id ? dept.color + '20' : '#1f2937',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: dept.color,
                        borderRadius: '50%',
                        margin: '0 auto 8px',
                        border: '2px solid white',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}></div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{dept.name}</div>
                      {dept.description && (
                        <div style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px' }}>
                          {dept.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Permissions</label>
                <div style={{ 
                  border: '1px solid #d1d5db', 
                  borderRadius: '8px', 
                  padding: '15px',
                  backgroundColor: '#f9fafb'
                }}>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={userForm.permissions.viewReports}
                        onChange={() => togglePermission('viewReports')}
                        style={{ marginRight: '10px', width: '18px', height: '18px' }}
                      />
                      <span>View Reports</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={userForm.permissions.updateReports}
                        onChange={() => togglePermission('updateReports')}
                        style={{ marginRight: '10px', width: '18px', height: '18px' }}
                      />
                      <span>Update Reports</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={userForm.permissions.createAlerts}
                        onChange={() => togglePermission('createAlerts')}
                        style={{ marginRight: '10px', width: '18px', height: '18px' }}
                      />
                      <span>Create Public Alerts</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={userForm.permissions.manageRoutes}
                        onChange={() => togglePermission('manageRoutes')}
                        style={{ marginRight: '10px', width: '18px', height: '18px' }}
                      />
                      <span>Manage Routes & Detours</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={userForm.permissions.manageUsers}
                        onChange={() => togglePermission('manageUsers')}
                        style={{ marginRight: '10px', width: '18px', height: '18px' }}
                        disabled={userForm.role !== 'admin'}
                      />
                      <span style={{ opacity: userForm.role !== 'admin' ? 0.5 : 1 }}>
                        Manage Users {userForm.role !== 'admin' && '(Admin Only)'}
                      </span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={userForm.permissions.manageDepartments}
                        onChange={() => togglePermission('manageDepartments')}
                        style={{ marginRight: '10px', width: '18px', height: '18px' }}
                        disabled={userForm.role !== 'admin'}
                      />
                      <span style={{ opacity: userForm.role !== 'admin' ? 0.5 : 1 }}>
                        Manage Departments {userForm.role !== 'admin' && '(Admin Only)'}
                      </span>
                    </label>
                  </div>
                </div>
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Select what actions this user can perform in the system
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserModal(false);
                    setUserForm({
                      username: '',
                      password: '',
                      role: 'personnel',
                      name: '',
                      department_id: '',
                      permissions: {
                        viewReports: true,
                        updateReports: true,
                        createAlerts: false,
                        manageRoutes: false,
                        manageUsers: false,
                        manageDepartments: false
                      }
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Department Modal (Admin Only) */}
      {showDeptModal && user?.role === 'admin' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>Create New Department</h2>
            <form onSubmit={handleCreateDepartment}>
              <div className="form-group">
                <label>Department Name *</label>
                <input
                  type="text"
                  className="input"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                  placeholder="e.g., Fire, Police, EMS"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  placeholder="Department description"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Color</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={deptForm.color}
                    onChange={(e) => setDeptForm({ ...deptForm, color: e.target.value })}
                    style={{ width: '60px', height: '40px', border: '1px solid #d1d5db', borderRadius: '5px' }}
                  />
                  <input
                    type="text"
                    className="input"
                    value={deptForm.color}
                    onChange={(e) => setDeptForm({ ...deptForm, color: e.target.value })}
                    placeholder="#3b82f6"
                    style={{ flex: 1 }}
                  />
                </div>
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Choose a color to identify this department on reports and assignments
                </small>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" className="btn btn-success" style={{ flex: 1 }}>
                  Create Department
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeptModal(false);
                    setDeptForm({
                      name: '',
                      description: '',
                      color: '#3b82f6'
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="card" style={{ 
            maxWidth: '800px', 
            width: '100%', 
            maxHeight: '90vh', 
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '1px solid #374151',
              paddingBottom: '15px'
            }}>
              <h2 style={{ margin: 0, color: '#f9fafb' }}>💬 Department Chat</h2>
              <button
                onClick={() => setShowChatModal(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                Close
              </button>
            </div>

            <div style={{ 
              marginBottom: '15px',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}>
              <label style={{ color: '#f9fafb', fontWeight: '600' }}>Filter by Department:</label>
              <select
                className="select"
                value={selectedChatDept}
                onChange={(e) => {
                  setSelectedChatDept(e.target.value);
                }}
                style={{ flex: 1, maxWidth: '300px' }}
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div 
              id="chat-messages-container"
              style={{
                flex: 1,
                overflowY: 'auto',
                backgroundColor: '#111827',
                borderRadius: '8px',
                padding: '15px',
                marginBottom: '15px',
                border: '1px solid #374151',
                minHeight: '400px',
                maxHeight: '500px'
              }}
            >
              {chatMessages.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '50px' }}>
                  No messages yet. Start the conversation!
                </p>
              ) : (
                chatMessages.map((msg) => {
                  const isOwnMessage = msg.user_id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        marginBottom: '15px',
                        padding: '10px 15px',
                        backgroundColor: isOwnMessage ? '#1e3a8a' : '#1f2937',
                        borderRadius: '8px',
                        border: isOwnMessage ? '1px solid #3b82f6' : '1px solid #374151',
                        borderLeft: msg.department_color ? `4px solid ${msg.department_color}` : '4px solid #6b7280',
                        marginLeft: isOwnMessage ? '20%' : '0',
                        marginRight: isOwnMessage ? '0' : '20%'
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'flex-start',
                        marginBottom: '8px'
                      }}>
                        <div>
                          <strong style={{ color: '#f9fafb', fontSize: '14px' }}>
                            {msg.user_name}
                          </strong>
                          {msg.department_name && (
                            <span style={{ 
                              color: '#9ca3af', 
                              fontSize: '12px',
                              marginLeft: '10px',
                              padding: '2px 8px',
                              backgroundColor: msg.department_color ? msg.department_color + '20' : '#374151',
                              borderRadius: '4px'
                            }}>
                              {msg.department_name}
                            </span>
                          )}
                        </div>
                        <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p style={{ 
                        color: '#f9fafb', 
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}>
                        {msg.message}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendChatMessage}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <textarea
                  className="input"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder={`Type your message${selectedChatDept === 'all' ? ' to all departments' : ''}...`}
                  rows="2"
                  style={{ flex: 1, resize: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage(e);
                    }
                  }}
                />
                <button 
                  type="submit" 
                  className="btn btn-success"
                  style={{ 
                    alignSelf: 'flex-end',
                    padding: '10px 24px',
                    whiteSpace: 'nowrap'
                  }}
                  disabled={!chatMessage.trim()}
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Closed Road Modal */}
      {showClosedRoadModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '700px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>🚫 Create Closed Road</h2>
            <form onSubmit={handleCreateClosedRoad}>
              <div className="form-group">
                <label>Road Name *</label>
                <input
                  type="text"
                  className="input"
                  value={closedRoadForm.name}
                  onChange={(e) => setClosedRoadForm({ ...closedRoadForm, name: e.target.value })}
                  placeholder="e.g., Main Street Closure"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input"
                  value={closedRoadForm.description}
                  onChange={(e) => setClosedRoadForm({ ...closedRoadForm, description: e.target.value })}
                  placeholder="Additional details about the road closure"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Address or Location (Optional)</label>
                <input
                  type="text"
                  className="input"
                  value={closedRoadForm.address}
                  onChange={(e) => setClosedRoadForm({ ...closedRoadForm, address: e.target.value })}
                  placeholder="e.g., Main Street between First St and Second St, Anaconda"
                />
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter a general address or location description for this closed road. This will be displayed on the map to help users identify the location.
                </small>
              </div>
              <div className="form-group">
                <label>Street Names or Addresses (Alternative to Coordinates)</label>
                <textarea
                  className="input"
                  value={closedRoadForm.streets}
                  onChange={(e) => setClosedRoadForm({ ...closedRoadForm, streets: e.target.value })}
                  placeholder="Main Street and First Street, Anaconda&#10;Main Street to Second Street, Anaconda"
                  rows="5"
                />
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleGeocodeClosedRoadStreets}
                    className="btn btn-primary"
                    disabled={closedRoadGeocoding || !closedRoadForm.streets}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {closedRoadGeocoding ? 'Geocoding...' : 'Geocode Streets'}
                  </button>
                </div>
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter street names or addresses. You can put two streets per line using "and", "to", "&", or "between" (e.g., "Main Street and First Street"). Click "Geocode Streets" to automatically convert them to coordinates. Street addresses will be constrained to Deer Lodge County, Montana.
                </small>
              </div>
              <div className="form-group">
                <label>Coordinates *</label>
                <textarea
                  className="input"
                  value={closedRoadForm.coordinates}
                  onChange={(e) => setClosedRoadForm({ ...closedRoadForm, coordinates: e.target.value })}
                  placeholder="46.1286, -112.9422&#10;46.1300, -112.9400"
                  rows="8"
                />
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter coordinates as one per line: "latitude, longitude"<br/>
                  Example:<br/>
                  46.1286, -112.9422<br/>
                  46.1300, -112.9400<br/><br/>
                  Or as JSON array: [[46.1286, -112.9422], [46.1300, -112.9400]]<br/><br/>
                  <strong>Note:</strong> You can either enter street names above and click "Geocode Streets", or enter coordinates manually here. At least one method is required.
                </small>
              </div>
              <div className="form-group">
                <label>Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={closedRoadForm.expires_at}
                  onChange={(e) => setClosedRoadForm({ ...closedRoadForm, expires_at: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  className="btn btn-success" 
                  style={{ 
                    flex: 1,
                    backgroundColor: '#dc2626'
                  }}
                >
                  Create Closed Road
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowClosedRoadModal(false);
                    setClosedRoadForm({
                      name: '',
                      description: '',
                      address: '',
                      streets: '',
                      coordinates: '',
                      expires_at: ''
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mass Callout Modal */}
      {showCalloutModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>🚨 Mass Callout (MCI)</h2>
            <p style={{ marginBottom: '20px', color: '#d1d5db', fontSize: '14px' }}>
              Send an urgent alert to all personnel in selected department(s) for Mass Casualty Incidents or emergency callouts. You can select multiple departments.
            </p>
            <form onSubmit={handleCreateCallout}>
              <div className="form-group">
                <label>Select Department(s) *</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                  gap: '10px',
                  marginTop: '10px'
                }}>
                  {departments.map((dept) => {
                    const isSelected = calloutForm.department_ids.includes(dept.id);
                    return (
                      <div
                        key={dept.id}
                        onClick={() => {
                          if (isSelected) {
                            // Remove from selection
                            setCalloutForm({ 
                              ...calloutForm, 
                              department_ids: calloutForm.department_ids.filter(id => id !== dept.id)
                            });
                          } else {
                            // Add to selection
                            setCalloutForm({ 
                              ...calloutForm, 
                              department_ids: [...calloutForm.department_ids, dept.id]
                            });
                          }
                        }}
                        style={{
                          padding: '15px',
                          border: `3px solid ${isSelected ? dept.color : '#4b5563'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          backgroundColor: isSelected ? dept.color + '30' : '#1f2937',
                          transition: 'all 0.2s',
                          fontWeight: isSelected ? '600' : 'normal',
                          opacity: isSelected ? 1 : 0.8
                        }}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          backgroundColor: dept.color,
                          borderRadius: '50%',
                          margin: '0 auto 8px',
                          border: '2px solid white',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          position: 'relative'
                        }}>
                          {isSelected && (
                            <div style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              color: 'white',
                              fontSize: '16px',
                              fontWeight: 'bold'
                            }}>✓</div>
                          )}
                        </div>
                        <div style={{ fontSize: '14px', color: '#f9fafb' }}>{dept.name}</div>
                      </div>
                    );
                  })}
                </div>
                {calloutForm.department_ids.length > 0 && (
                  <small style={{ color: '#d1d5db', marginTop: '10px', display: 'block' }}>
                    Selected: {calloutForm.department_ids.length} department(s) - {departments.filter(d => calloutForm.department_ids.includes(d.id)).map(d => d.name).join(', ')}
                  </small>
                )}
              </div>
              <div className="form-group">
                <label>Callout Title *</label>
                <input
                  type="text"
                  className="input"
                  value={calloutForm.title}
                  onChange={(e) => setCalloutForm({ ...calloutForm, title: e.target.value })}
                  placeholder="e.g., MCI - Multi-Vehicle Accident"
                  required
                />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea
                  className="input"
                  value={calloutForm.message}
                  onChange={(e) => setCalloutForm({ ...calloutForm, message: e.target.value })}
                  placeholder="Describe the situation and what response is needed..."
                  rows="5"
                  required
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  className="input"
                  value={calloutForm.location}
                  onChange={(e) => setCalloutForm({ ...calloutForm, location: e.target.value })}
                  placeholder="e.g., Main Street & Park Avenue"
                />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  className="select"
                  value={calloutForm.priority}
                  onChange={(e) => setCalloutForm({ ...calloutForm, priority: e.target.value })}
                >
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="form-group">
                <label>Expires At (Optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={calloutForm.expires_at}
                  onChange={(e) => setCalloutForm({ ...calloutForm, expires_at: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ 
                    flex: 1,
                    backgroundColor: '#dc2626',
                    fontSize: '16px',
                    padding: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  🚨 SEND MASS CALLOUT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCalloutModal(false);
                    setCalloutForm({
                      title: '',
                      message: '',
                      department_ids: [],
                      location: '',
                      priority: 'high',
                      expires_at: ''
                    });
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search and Rescue Modal */}
      {showSARModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflow: 'auto' }}>
            <h2 style={{ marginBottom: '20px', color: '#f9fafb' }}>🔍 {editingSAR ? 'Edit' : 'New'} Search and Rescue Operation</h2>
            <form onSubmit={handleCreateSAR}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Case Number (Auto-generated if empty)</label>
                  <input
                    type="text"
                    className="input"
                    value={sarForm.case_number}
                    onChange={(e) => setSarForm({ ...sarForm, case_number: e.target.value })}
                    placeholder="SAR-12345"
                  />
                </div>
                <div className="form-group">
                  <label>Status *</label>
                  <select
                    className="select"
                    value={sarForm.status}
                    onChange={(e) => setSarForm({ ...sarForm, status: e.target.value })}
                    required
                  >
                    <option value="active">Active</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Operation Title *</label>
                <input
                  type="text"
                  className="input"
                  value={sarForm.title}
                  onChange={(e) => setSarForm({ ...sarForm, title: e.target.value })}
                  placeholder="e.g., Missing Hiker - Lost Creek Trail"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  className="input"
                  value={sarForm.description}
                  onChange={(e) => setSarForm({ ...sarForm, description: e.target.value })}
                  placeholder="Detailed description of the search and rescue operation..."
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Location *</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="input"
                      value={sarForm.location}
                      onChange={(e) => setSarForm({ ...sarForm, location: e.target.value })}
                      placeholder="e.g., Lost Creek Trail, Anaconda"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGeocodeSARLocation}
                    className="btn btn-primary"
                    disabled={sarGeocoding || !sarForm.location || !sarForm.location.trim()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {sarGeocoding ? 'Finding...' : 'Find Coordinates'}
                  </button>
                </div>
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Enter a location in Deer Lodge County and click "Find Coordinates" to automatically get latitude and longitude, or enter coordinates manually below. You can also create the operation with just the location text if coordinates aren't available.
                </small>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  className="select"
                  value={sarForm.priority}
                  onChange={(e) => setSarForm({ ...sarForm, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label>Latitude (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={sarForm.latitude}
                    onChange={(e) => setSarForm({ ...sarForm, latitude: e.target.value })}
                    placeholder="46.1286"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    className="input"
                    value={sarForm.longitude}
                    onChange={(e) => setSarForm({ ...sarForm, longitude: e.target.value })}
                    placeholder="-112.9422"
                  />
                </div>
              </div>
              <div style={{ borderTop: '1px solid #374151', paddingTop: '20px', marginTop: '20px' }}>
                <h3 style={{ color: '#f9fafb', marginBottom: '15px' }}>Missing Person Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      className="input"
                      value={sarForm.missing_person_name}
                      onChange={(e) => setSarForm({ ...sarForm, missing_person_name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Age</label>
                    <input
                      type="text"
                      className="input"
                      value={sarForm.missing_person_age}
                      onChange={(e) => setSarForm({ ...sarForm, missing_person_age: e.target.value })}
                      placeholder="e.g., 35 or 5-10"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    className="input"
                    value={sarForm.missing_person_description}
                    onChange={(e) => setSarForm({ ...sarForm, missing_person_description: e.target.value })}
                    placeholder="Physical description, clothing, medical conditions, etc."
                    rows="3"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Last Seen Location</label>
                    <input
                      type="text"
                      className="input"
                      value={sarForm.last_seen_location}
                      onChange={(e) => setSarForm({ ...sarForm, last_seen_location: e.target.value })}
                      placeholder="Where was the person last seen?"
                    />
                  </div>
                  <div className="form-group">
                    <label>Last Seen Time</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={sarForm.last_seen_time}
                      onChange={(e) => setSarForm({ ...sarForm, last_seen_time: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #374151', paddingTop: '20px', marginTop: '20px' }}>
                <h3 style={{ color: '#f9fafb', marginBottom: '15px' }}>Contact Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group">
                    <label>Contact Name</label>
                    <input
                      type="text"
                      className="input"
                      value={sarForm.contact_name}
                      onChange={(e) => setSarForm({ ...sarForm, contact_name: e.target.value })}
                      placeholder="Reporting party name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input
                      type="text"
                      className="input"
                      value={sarForm.contact_phone}
                      onChange={(e) => setSarForm({ ...sarForm, contact_phone: e.target.value })}
                      placeholder="(406) 555-1234"
                    />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Assigned Team</label>
                <input
                  type="text"
                  className="input"
                  value={sarForm.assigned_team}
                  onChange={(e) => setSarForm({ ...sarForm, assigned_team: e.target.value })}
                  placeholder="e.g., SAR Team Alpha, Mountain Rescue Unit"
                />
              </div>
              <div className="form-group">
                <label>Search Area Coordinates (JSON Array, Optional)</label>
                <textarea
                  className="input"
                  value={sarForm.search_area_coordinates}
                  onChange={(e) => setSarForm({ ...sarForm, search_area_coordinates: e.target.value })}
                  placeholder='[[46.1, -112.9], [46.2, -112.8], [46.1, -112.8], [46.1, -112.9]]'
                  rows="3"
                />
                <small style={{ color: '#d1d5db', marginTop: '5px', display: 'block' }}>
                  Array of [latitude, longitude] pairs defining the search area polygon
                </small>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                >
                  {editingSAR ? 'Update Operation' : 'Create Operation'}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setShowSARModal(false);
                    setEditingSAR(null);
                    setSarForm({
                      case_number: '',
                      title: '',
                      description: '',
                      location: '',
                      latitude: '',
                      longitude: '',
                      status: 'active',
                      priority: 'medium',
                      missing_person_name: '',
                      missing_person_age: '',
                      missing_person_description: '',
                      last_seen_location: '',
                      last_seen_time: '',
                      contact_name: '',
                      contact_phone: '',
                      assigned_team: '',
                      search_area_coordinates: ''
                    });
                  }}
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelDashboard;

