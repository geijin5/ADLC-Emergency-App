import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUsers, getDepartments, getCallouts, getChatMessages, sendChatMessage } from '../../api/api';
import PersonnelPushNotification from '../Personnel/PersonnelPushNotification';

const CountyAttorneyDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [callouts, setCallouts] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const [selectedChatDept, setSelectedChatDept] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (showChatModal) {
      fetchChatMessages();
      const interval = setInterval(fetchChatMessages, 5000); // Refresh chat every 5 seconds
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChatModal, selectedChatDept]);

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes, calloutsRes] = await Promise.all([
        getUsers(),
        getDepartments(),
        getCallouts()
      ]);
      setUsers(usersRes.data || []);
      setDepartments(deptsRes.data || []);
      setCallouts(calloutsRes.data || []);
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="App" style={{ minHeight: '100vh', background: '#111827', color: '#f9fafb', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div>Loading...</div>
      </div>
    );
  }

  // Find County Attorney department
  const countyAttorneyDept = departments.find(d => d.name === 'County Attorney');
  const countyAttorneyUsers = users.filter(u => u.department_id === countyAttorneyDept?.id);
  const countyAttorneyCallouts = callouts.filter(c => c.department_id === countyAttorneyDept?.id);

  return (
    <div className="App" style={{ minHeight: '100vh', background: '#111827' }}>
      <nav style={{
        background: '#1f2937',
        padding: '15px 30px',
        borderBottom: '2px solid #7c3aed',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.png" alt="ADLC Emergency Services Logo" style={{ height: '50px', width: '50px' }} />
          <h1 style={{ margin: 0, color: '#f9fafb', fontSize: '24px' }}>County Attorney Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ color: '#d1d5db' }}>Welcome, {user?.name || user?.username}</span>
          <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="container" style={{ maxWidth: '1400px', margin: '30px auto', padding: '0 20px' }}>
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#f9fafb', marginBottom: '20px' }}>⚖️ County Attorney Office</h2>
          
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '30px' }}>
            <button 
              onClick={() => setShowChatModal(true)} 
              className="btn btn-success"
              style={{ backgroundColor: '#7c3aed' }}
            >
              💬 Department Chat
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div className="card" style={{ background: '#1f2937', border: '1px solid #374151', borderLeft: '4px solid #7c3aed' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#7c3aed' }}>Team Members</h3>
            <p style={{ fontSize: '32px', margin: 0, color: '#f9fafb', fontWeight: 'bold' }}>
              {countyAttorneyUsers.length}
            </p>
          </div>
          <div className="card" style={{ background: '#1f2937', border: '1px solid #374151', borderLeft: '4px solid #f59e0b' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>Active Callouts</h3>
            <p style={{ fontSize: '32px', margin: 0, color: '#f9fafb', fontWeight: 'bold' }}>
              {countyAttorneyCallouts.filter(c => c.is_active).length}
            </p>
          </div>
        </div>

        {/* Team Members Section */}
        <div className="card" style={{ marginBottom: '30px' }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#f9fafb' }}>👥 County Attorney Team</h2>
          {countyAttorneyUsers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280' }}>No team members assigned to County Attorney department.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #374151' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#f9fafb' }}>Name</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#f9fafb' }}>Username</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: '#f9fafb' }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {countyAttorneyUsers.map((teamMember) => (
                    <tr key={teamMember.id} style={{ borderBottom: '1px solid #374151' }}>
                      <td style={{ padding: '12px', color: '#d1d5db' }}>{teamMember.name}</td>
                      <td style={{ padding: '12px', color: '#d1d5db' }}>{teamMember.username}</td>
                      <td style={{ padding: '12px', color: '#d1d5db' }}>
                        <span className={`badge badge-${teamMember.role === 'admin' ? 'danger' : 'primary'}`}>
                          {teamMember.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Callouts Section */}
        {countyAttorneyCallouts.length > 0 && (
          <div className="card" style={{ marginBottom: '30px' }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#f9fafb' }}>🚨 Department Callouts</h2>
            {countyAttorneyCallouts.map((callout) => {
              const acknowledged = callout.acknowledged_by ? JSON.parse(callout.acknowledged_by) : [];
              const isAcknowledged = acknowledged.includes(user?.id);
              
              return (
                <div
                  key={callout.id}
                  className="card"
                  style={{
                    marginBottom: '20px',
                    background: '#1f2937',
                    border: '1px solid #374151',
                    borderLeft: `4px solid ${callout.department_color || '#7c3aed'}`,
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '24px' }}>🚨</span>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#f9fafb' }}>
                          {callout.title}
                        </h3>
                        {isAcknowledged && (
                          <span style={{ 
                            padding: '4px 12px', 
                            backgroundColor: '#10b981', 
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            color: 'white'
                          }}>
                            ✓ ACKNOWLEDGED
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '10px 0', fontSize: '16px', lineHeight: '1.6', color: '#d1d5db' }}>
                        {callout.message}
                      </p>
                      {callout.location && (
                        <p style={{ margin: '5px 0', fontSize: '14px', color: '#9ca3af' }}>
                          📍 Location: {callout.location}
                        </p>
                      )}
                      <p style={{ margin: '5px 0', fontSize: '12px', color: '#6b7280' }}>
                        Priority: <strong style={{ color: callout.priority === 'high' ? '#ef4444' : '#f59e0b' }}>
                          {callout.priority?.toUpperCase() || 'MEDIUM'}
                        </strong> | Created: {formatDate(callout.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Push Notifications */}
        <div className="card" style={{ marginBottom: '30px' }}>
          <PersonnelPushNotification />
        </div>
      </div>

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
                        backgroundColor: isOwnMessage ? '#7c3aed' : '#1f2937',
                        borderRadius: '8px',
                        border: isOwnMessage ? '1px solid #8b5cf6' : '1px solid #374151',
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
                    whiteSpace: 'nowrap',
                    backgroundColor: '#7c3aed'
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
    </div>
  );
};

export default CountyAttorneyDashboard;


