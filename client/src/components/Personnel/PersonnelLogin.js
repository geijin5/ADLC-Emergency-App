import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { login } from '../../api/api';

const PersonnelLogin = () => {
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log('Attempting login with credentials:', { username: credentials.username, password: '***' });
      const response = await login(credentials);
      console.log('Login response received:', response.data);
      authLogin(response.data.token, response.data.user);
      navigate('/personnel/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App" style={{ 
      background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <img src="/logo.png" alt="ADLC Emergency Services Logo" style={{ height: '200px', width: '200px', display: 'block', margin: '0 auto', filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))' }} />
      </div>
      <div className="login-container" style={{
        background: '#1f2937',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
        maxWidth: '450px',
        width: '100%',
        border: '1px solid #374151'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '10px',
            color: '#dc2626'
          }}>🚨</div>
          <h2 style={{ 
            color: '#f9fafb', 
            marginBottom: '10px',
            fontSize: '28px'
          }}>Emergency Personnel Login</h2>
          <p style={{ color: '#d1d5db', fontSize: '14px' }}>
            Anaconda-Deer Lodge County Emergency Services
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              className="input"
              value={credentials.username}
              onChange={handleChange}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              className="input"
              value={credentials.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
            style={{ 
              width: '100%', 
              marginTop: '20px',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              borderRadius: '6px',
              transition: 'all 0.3s'
            }}
          >
            {loading ? 'Logging in...' : 'Login to Dashboard'}
          </button>
        </form>

        <div style={{ 
          marginTop: '25px', 
          padding: '15px',
          background: '#374151',
          borderRadius: '6px',
          textAlign: 'center',
          border: '1px solid #4b5563'
        }}>
          <p style={{ fontSize: '12px', color: '#d1d5db', margin: '0' }}>
            <strong>Default credentials:</strong> admin / admin123
          </p>
        </div>
      </div>
    </div>
  );
};

export default PersonnelLogin;

