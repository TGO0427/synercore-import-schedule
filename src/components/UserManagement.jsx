import React, { useState, useEffect } from 'react';
import { authUtils } from '../utils/auth';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'user'
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/api/auth/admin/users`, {
        headers: authUtils.getAuthHeader()
      });

      if (!response.ok) {
        throw new Error('Failed to load users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      setMessage({ type: 'error', text: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    try {
      if (!newUser.username || !newUser.password) {
        setMessage({ type: 'error', text: 'Username and password are required' });
        return;
      }

      if (newUser.password.length < 6) {
        setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
        return;
      }

      setLoading(true);
      const response = await fetch(`${apiUrl}/api/auth/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authUtils.getAuthHeader()
        },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setMessage({ type: 'success', text: 'User created successfully!' });
      setNewUser({
        username: '',
        email: '',
        password: '',
        fullName: '',
        role: 'user'
      });
      setShowCreateForm(false);
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
    setMessage({ type: '', text: '' });
  };

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '28px',
          color: '#2c3e50'
        }}>
          User Management
        </h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6fd8'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
        >
          {showCreateForm ? '✕ Cancel' : '+ Create New User'}
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '20px',
          backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          color: message.type === 'success' ? '#155724' : '#721c24',
          fontSize: '14px'
        }}>
          {message.text}
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          marginBottom: '2rem',
          border: '1px solid #e1e5e9'
        }}>
          <h2 style={{
            margin: '0 0 20px 0',
            fontSize: '20px',
            color: '#2c3e50'
          }}>
            Create New User
          </h2>
          <form onSubmit={handleCreateUser}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={newUser.username}
                  onChange={handleInputChange}
                  disabled={loading}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={newUser.email}
                  onChange={handleInputChange}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={newUser.password}
                  onChange={handleInputChange}
                  disabled={loading}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={newUser.fullName}
                  onChange={handleInputChange}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  Role *
                </label>
                <select
                  name="role"
                  value={newUser.role}
                  onChange={handleInputChange}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #e1e5e9',
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? '#9ca3af' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </form>
        </div>
      )}

      {/* Users List */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        border: '1px solid #e1e5e9'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}>
          <thead>
            <tr style={{
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #e1e5e9'
            }}>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Username
              </th>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Email
              </th>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Full Name
              </th>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Role
              </th>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Status
              </th>
              <th style={{
                padding: '16px',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: '600',
                color: '#2c3e50'
              }}>
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan="6" style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#6c757d'
                }}>
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" style={{
                  padding: '40px',
                  textAlign: 'center',
                  color: '#6c757d'
                }}>
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: '1px solid #e1e5e9',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{
                    padding: '16px',
                    fontSize: '14px',
                    color: '#2c3e50',
                    fontWeight: '500'
                  }}>
                    {user.username}
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '14px',
                    color: '#6c757d'
                  }}>
                    {user.email || '-'}
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '14px',
                    color: '#6c757d'
                  }}>
                    {user.fullName || '-'}
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '14px'
                  }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      backgroundColor: user.role === 'admin' ? '#667eea' : '#28a745',
                      color: 'white'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '14px'
                  }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: user.isActive ? '#d4edda' : '#f8d7da',
                      color: user.isActive ? '#155724' : '#721c24'
                    }}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{
                    padding: '16px',
                    fontSize: '14px',
                    color: '#6c757d'
                  }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserManagement;
