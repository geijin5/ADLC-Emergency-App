import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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

export default api;

