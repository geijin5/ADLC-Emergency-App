import axios from 'axios';

// Determine API base URL
// In Capacitor (native app), always use the production server URL
// In web production, use relative path since server and client are on same domain
// In development, use localhost or REACT_APP_API_URL if set
const getApiBaseUrl = () => {
  // Check if running in Capacitor (native app)
  // Capacitor apps have window.Capacitor or the URL starts with capacitor:// or file://
  const isCapacitor = typeof window !== 'undefined' && (
    window.Capacitor || 
    window.CapacitorWeb ||
    (window.location && (
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      window.location.hostname === 'localhost' && window.location.port === ''
    ))
  );
  
  // If REACT_APP_API_URL is explicitly set, use it
  if (process.env.REACT_APP_API_URL) {
    console.log('Using REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
    return process.env.REACT_APP_API_URL;
  }
  
  // If running in Capacitor, use production server URL
  if (isCapacitor) {
    const prodUrl = process.env.REACT_APP_PROD_API_URL || 'https://adlc-emergency-app.onrender.com/api';
    console.log('Running in Capacitor, using production API URL:', prodUrl);
    return prodUrl;
  }
  
  // In web production (not Capacitor), use relative path
  if (process.env.NODE_ENV === 'production') {
    console.log('Running in web production, using relative API path: /api');
    return '/api';
  }
  
  // Development: use localhost
  console.log('Running in development, using localhost API: http://localhost:5000/api');
  return 'http://localhost:5000/api';
};

const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL configured as:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration and unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token is invalid or expired - clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Trigger a custom event so AuthContext can update
      window.dispatchEvent(new Event('authChange'));
      // Only redirect if not already on login page
      if (window.location.pathname !== '/personnel/login' && !window.location.pathname.includes('/personnel/login')) {
        window.location.href = '/personnel/login';
      }
    }
    return Promise.reject(error);
  }
);

// Public API
export const getPublicAlerts = () => {
  return api.get('/public/alerts');
};

// Push Notification API
export const getVapidPublicKey = () => {
  return api.get('/public/push/vapid-key');
};

export const subscribeToPush = (subscription) => {
  return api.post('/public/push/subscribe', { subscription });
};

export const unsubscribeFromPush = (endpoint) => {
  return api.post('/public/push/unsubscribe', { endpoint });
};

// Personnel push notification APIs
export const getPersonnelVapidPublicKey = () => {
  return api.get('/personnel/push/vapid-key');
};

export const subscribePersonnelToPush = (subscription) => {
  return api.post('/personnel/push/subscribe', { subscription });
};

export const unsubscribePersonnelFromPush = (endpoint) => {
  return api.post('/personnel/push/unsubscribe', { endpoint });
};

export const sendPushNotification = (title, message, severity) => {
  return api.post('/personnel/push/send', { title, message, severity });
};

export const getClosedAreas = () => {
  return api.get('/public/closed-areas');
};

// Personnel API
export const login = (credentials) => {
  return api.post('/auth/login', credentials);
};

export const verifyAuth = () => {
  return api.get('/auth/me');
};


export const createAlert = (data) => {
  return api.post('/personnel/alerts', data);
};

export const getUsers = () => {
  return api.get('/personnel/users');
};

export const createUser = (data) => {
  return api.post('/personnel/users', data);
};

export const updateUser = (id, data) => {
  return api.put(`/personnel/users/${id}`, data);
};

export const deleteUser = (id) => {
  return api.delete(`/personnel/users/${id}`);
};

export const getDepartments = () => {
  return api.get('/personnel/departments');
};

export const createDepartment = (data) => {
  return api.post('/personnel/departments', data);
};

export const updateDepartment = (id, data) => {
  return api.put(`/personnel/departments/${id}`, data);
};

export const deleteDepartment = (id) => {
  return api.delete(`/personnel/departments/${id}`);
};

export const getPersonnelClosedAreas = () => {
  return api.get('/personnel/closed-areas');
};

export const createClosedArea = (data) => {
  return api.post('/personnel/closed-areas', data);
};

export const updateClosedArea = (id, data) => {
  return api.put(`/personnel/closed-areas/${id}`, data);
};

export const deleteClosedArea = (id) => {
  return api.delete(`/personnel/closed-areas/${id}`);
};

export const getParadeRoutes = () => {
  return api.get('/public/parade-routes');
};

export const getDetours = () => {
  return api.get('/public/detours');
};

export const getClosedRoads = () => {
  return api.get('/public/closed-roads');
};

export const getPersonnelParadeRoutes = () => {
  return api.get('/personnel/parade-routes');
};

export const createParadeRoute = (data) => {
  return api.post('/personnel/parade-routes', data);
};

export const updateParadeRoute = (id, data) => {
  return api.put(`/personnel/parade-routes/${id}`, data);
};

export const deleteParadeRoute = (id) => {
  return api.delete(`/personnel/parade-routes/${id}`);
};

export const getPersonnelDetours = () => {
  return api.get('/personnel/detours');
};

export const createDetour = (data) => {
  return api.post('/personnel/detours', data);
};

export const updateDetour = (id, data) => {
  return api.put(`/personnel/detours/${id}`, data);
};

export const deleteDetour = (id) => {
  return api.delete(`/personnel/detours/${id}`);
};

// Closed Roads API
export const getPersonnelClosedRoads = () => {
  return api.get('/personnel/closed-roads');
};

export const createClosedRoad = (data) => {
  return api.post('/personnel/closed-roads', data);
};

export const updateClosedRoad = (id, data) => {
  return api.put(`/personnel/closed-roads/${id}`, data);
};

export const deleteClosedRoad = (id) => {
  return api.delete(`/personnel/closed-roads/${id}`);
};

export const deleteAllClosedRoads = () => {
  return api.delete('/personnel/closed-roads');
};

export const getCallouts = () => {
  return api.get('/personnel/callouts');
};

export const createCallout = (data) => {
  return api.post('/personnel/callouts', data);
};

export const acknowledgeCallout = (id) => {
  return api.put(`/personnel/callouts/${id}/acknowledge`);
};

export const updateCallout = (id, data) => {
  return api.put(`/personnel/callouts/${id}`, data);
};

// Chat API
export const getChatMessages = (departmentId) => {
  const params = departmentId ? { department_id: departmentId } : {};
  return api.get('/personnel/chat/messages', { params });
};

export const sendChatMessage = (message, departmentId) => {
  return api.post('/personnel/chat/messages', { message, department_id: departmentId });
};

// Search and Rescue API
export const getPersonnelSearchRescue = () => {
  return api.get('/personnel/search-rescue');
};

export const getPublicSearchRescue = () => {
  return api.get('/public/search-rescue');
};

export const createSearchRescue = (data) => {
  return api.post('/personnel/search-rescue', data);
};

export const updateSearchRescue = (id, data) => {
  return api.put(`/personnel/search-rescue/${id}`, data);
};

export const deleteSearchRescue = (id) => {
  return api.delete(`/personnel/search-rescue/${id}`);
};

// Comprehensive Notification System API
export const sendNotification = (notificationData) => {
  return api.post('/personnel/notifications/send', notificationData);
};

export const getNotificationLogs = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  if (filters.type) params.append('type', filters.type);
  if (filters.targetType) params.append('targetType', filters.targetType);
  if (filters.status) params.append('status', filters.status);
  if (filters.senderId) params.append('senderId', filters.senderId);
  return api.get(`/personnel/notifications/logs?${params.toString()}`);
};

export const getNotificationLog = (id) => {
  return api.get(`/personnel/notifications/logs/${id}`);
};

export const getNotificationStatistics = (id) => {
  return api.get(`/personnel/notifications/logs/${id}/statistics`);
};

export const getNotificationAcknowledgements = (id) => {
  return api.get(`/personnel/notifications/logs/${id}/acknowledgements`);
};

export const getNotificationTypes = () => {
  return api.get('/personnel/notifications/types');
};

export const getNotificationPreferences = () => {
  return api.get('/personnel/notifications/preferences');
};

export const updateNotificationPreferences = (preferences) => {
  return api.put('/personnel/notifications/preferences', preferences);
};

export const acknowledgeNotification = (notificationLogId, calloutId, response) => {
  return api.post('/personnel/notifications/acknowledge', {
    notificationLogId,
    calloutId,
    response
  });
};

// Scheduled notifications
export const getScheduledNotifications = (limit = 100) => {
  return api.get(`/personnel/notifications/scheduled?limit=${limit}`);
};

export const cancelScheduledNotification = (id) => {
  return api.post(`/personnel/notifications/scheduled/${id}/cancel`);
};

// Audit logs
export const getAuditLogs = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  if (filters.action) params.append('action', filters.action);
  if (filters.userId) params.append('userId', filters.userId);
  if (filters.notificationLogId) params.append('notificationLogId', filters.notificationLogId);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  return api.get(`/personnel/notifications/audit?${params.toString()}`);
};

export const getAuditStatistics = (startDate = null, endDate = null) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return api.get(`/personnel/notifications/audit/statistics?${params.toString()}`);
};

// Metrics
export const getNotificationMetrics = (startDate = null, endDate = null) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  return api.get(`/personnel/notifications/metrics?${params.toString()}`);
};

export default api;

