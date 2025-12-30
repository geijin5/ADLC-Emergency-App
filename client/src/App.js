import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicHome from './components/Public/PublicHome';
import PublicAlerts from './components/Public/PublicAlerts';
import SearchAndRescue from './components/Public/SearchAndRescue';
import PersonnelLogin from './components/Personnel/PersonnelLogin';
import PersonnelDashboard from './components/Personnel/PersonnelDashboard';
import CountyAttorneyDashboard from './components/CountyAttorney/CountyAttorneyDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  
  // Wait for auth to finish loading before redirecting
  if (loading) {
    return <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: '#111827',
      color: '#f9fafb'
    }}>Loading...</div>;
  }
  
  return user ? children : <Navigate to="/personnel/login" />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/alerts" element={<PublicAlerts />} />
          <Route path="/search-rescue" element={<SearchAndRescue />} />
          <Route path="/personnel/login" element={<PersonnelLogin />} />
          <Route
            path="/personnel/dashboard"
            element={
              <ProtectedRoute>
                <PersonnelDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/county-attorney/dashboard"
            element={
              <ProtectedRoute>
                <CountyAttorneyDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

