import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicHome from './components/Public/PublicHome';
import PublicAlerts from './components/Public/PublicAlerts';
import PersonnelLogin from './components/Personnel/PersonnelLogin';
import PersonnelDashboard from './components/Personnel/PersonnelDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/personnel/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/alerts" element={<PublicAlerts />} />
          <Route path="/personnel/login" element={<PersonnelLogin />} />
          <Route
            path="/personnel/dashboard"
            element={
              <ProtectedRoute>
                <PersonnelDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

