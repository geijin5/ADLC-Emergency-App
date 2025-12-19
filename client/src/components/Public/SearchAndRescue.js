import React, { useState, useEffect } from 'react';
import { getPublicSearchRescue } from '../../api/api';
import './SearchAndRescue.css';

const SearchAndRescue = () => {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperation, setSelectedOperation] = useState(null);

  useEffect(() => {
    fetchOperations();
    const interval = setInterval(fetchOperations, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchOperations = async () => {
    try {
      const response = await getPublicSearchRescue();
      setOperations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch search and rescue operations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading search and rescue operations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1 style={{ color: '#f9fafb', marginBottom: '10px' }}>🔍 Search and Rescue Operations</h1>
        <p style={{ color: '#d1d5db', marginBottom: '30px' }}>
          Active search and rescue operations in Anaconda-Deer Lodge County
        </p>

        {operations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>No active search and rescue operations at this time.</p>
            <p style={{ fontSize: '14px' }}>If you have information about a missing person, please contact 911 immediately.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {operations.map((op) => (
              <div
                key={op.id}
                className="sar-operation-card"
                onClick={() => setSelectedOperation(selectedOperation?.id === op.id ? null : op)}
                style={{
                  border: `2px solid ${op.priority === 'critical' ? '#dc2626' : op.priority === 'high' ? '#f59e0b' : '#3b82f6'}`,
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: '#1f2937',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                  <div>
                    <h3 style={{ color: '#f9fafb', margin: '0 0 5px 0' }}>
                      {op.case_number || `SAR-${op.id}`}: {op.title}
                    </h3>
                    <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
                      Location: {op.location}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className={`badge badge-${op.status === 'active' || op.status === 'in_progress' ? 'in-progress' : 'resolved'}`}>
                      {op.status || 'active'}
                    </span>
                    <span className={`badge ${op.priority === 'high' || op.priority === 'critical' ? 'badge-danger' : op.priority === 'medium' ? 'badge-warning' : 'badge-in-progress'}`}>
                      {op.priority || 'medium'} priority
                    </span>
                  </div>
                </div>

                {op.description && (
                  <p style={{ color: '#d1d5db', marginBottom: '15px' }}>{op.description}</p>
                )}

                {selectedOperation?.id === op.id && (
                  <div style={{ 
                    marginTop: '20px', 
                    paddingTop: '20px', 
                    borderTop: '1px solid #374151',
                    animation: 'fadeIn 0.3s'
                  }}>
                    {op.missing_person_name && (
                      <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ color: '#f9fafb', marginBottom: '10px' }}>Missing Person</h4>
                        <p style={{ color: '#d1d5db', margin: '5px 0' }}>
                          <strong>Name:</strong> {op.missing_person_name}
                        </p>
                        {op.missing_person_age && (
                          <p style={{ color: '#d1d5db', margin: '5px 0' }}>
                            <strong>Age:</strong> {op.missing_person_age}
                          </p>
                        )}
                        {op.missing_person_description && (
                          <p style={{ color: '#d1d5db', margin: '5px 0' }}>
                            <strong>Description:</strong> {op.missing_person_description}
                          </p>
                        )}
                      </div>
                    )}

                    {(op.last_seen_location || op.last_seen_time) && (
                      <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ color: '#f9fafb', marginBottom: '10px' }}>Last Seen</h4>
                        {op.last_seen_location && (
                          <p style={{ color: '#d1d5db', margin: '5px 0' }}>
                            <strong>Location:</strong> {op.last_seen_location}
                          </p>
                        )}
                        {op.last_seen_time && (
                          <p style={{ color: '#d1d5db', margin: '5px 0' }}>
                            <strong>Time:</strong> {formatDate(op.last_seen_time)}
                          </p>
                        )}
                      </div>
                    )}

                    {op.assigned_team && (
                      <div style={{ marginBottom: '15px' }}>
                        <p style={{ color: '#d1d5db', margin: '5px 0' }}>
                          <strong>Assigned Team:</strong> {op.assigned_team}
                        </p>
                      </div>
                    )}

                    <div style={{ 
                      marginTop: '20px', 
                      padding: '15px', 
                      backgroundColor: '#111827', 
                      borderRadius: '6px',
                      border: '1px solid #374151'
                    }}>
                      <p style={{ color: '#f9fafb', fontWeight: 'bold', marginBottom: '10px' }}>
                        If you have information about this case:
                      </p>
                      <p style={{ color: '#d1d5db', margin: '5px 0', fontSize: '14px' }}>
                        <strong>Emergency:</strong> Call 911 immediately
                      </p>
                      <p style={{ color: '#d1d5db', margin: '5px 0', fontSize: '14px' }}>
                        <strong>Non-Emergency:</strong> (406) 563-5241
                      </p>
                      {op.contact_phone && (
                        <p style={{ color: '#d1d5db', margin: '5px 0', fontSize: '14px' }}>
                          <strong>Case Contact:</strong> {op.contact_phone}
                        </p>
                      )}
                    </div>

                    <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '15px', fontStyle: 'italic' }}>
                      Operation created: {formatDate(op.created_at)}
                    </p>
                  </div>
                )}

                <div style={{ 
                  marginTop: '15px', 
                  paddingTop: '15px', 
                  borderTop: '1px solid #374151',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Click to {selectedOperation?.id === op.id ? 'collapse' : 'expand'} details
                  </span>
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                    {selectedOperation?.id === op.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchAndRescue;

