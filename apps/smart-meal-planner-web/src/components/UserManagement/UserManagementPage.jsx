import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  Tooltip,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';

const UserManagementPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  
  // Determine API base path based on current route
  const isAdminRoute = location.pathname.startsWith('/admin');
  const apiBasePath = isAdminRoute ? '/admin' : '/organizations';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState({});
  
  // Pagination and filtering
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Dialog states
  const [actionDialog, setActionDialog] = useState({
    open: false,
    action: null,
    user: null,
    reason: ''
  });
  
  const [historyDialog, setHistoryDialog] = useState({
    open: false,
    user: null,
    logs: []
  });

  // Fetch user permissions
  useEffect(() => {
    fetchPermissions();
  }, []);

  // Fetch users when filters change
  useEffect(() => {
    fetchUsers();
  }, [page, rowsPerPage, searchQuery, filterRole, filterStatus]);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}${apiBasePath}/permissions`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setPermissions(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        limit: rowsPerPage,
        offset: page * rowsPerPage,
        ...(searchQuery && { search_query: searchQuery }),
        ...(filterRole && { role: filterRole }),
        ...(filterStatus && {
          is_active: filterStatus === 'active',
          is_paused: filterStatus === 'paused'
        })
      });
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}${apiBasePath}/users?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setUsers(response.data.users);
      setTotalCount(response.data.total_count);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserHistory = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}${apiBasePath}/users/${userId}/logs`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setHistoryDialog({
        open: true,
        user: users.find(u => u.id === userId),
        logs: response.data
      });
    } catch (error) {
      console.error('Error fetching user history:', error);
      setError('Failed to fetch user history');
    }
  };

  const handleAction = async () => {
    const { action, user, reason } = actionDialog;
    
    try {
      const token = localStorage.getItem('token');
      let endpoint = '';
      let method = 'post';
      
      switch (action) {
        case 'pause':
          endpoint = `${process.env.REACT_APP_API_URL}${apiBasePath}/users/${user.id}/pause`;
          break;
        case 'unpause':
          endpoint = `${process.env.REACT_APP_API_URL}${apiBasePath}/users/${user.id}/unpause`;
          break;
        case 'delete':
          endpoint = `${process.env.REACT_APP_API_URL}${apiBasePath}/users/${user.id}`;
          method = 'delete';
          break;
      }
      
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      if (action !== 'unpause') {
        await axios[method](endpoint, {
          action,
          reason,
          send_notification: true
        }, config);
      } else {
        await axios[method](endpoint, {}, config);
      }
      
      setActionDialog({ open: false, action: null, user: null, reason: '' });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error performing action:', error);
      setError(`Failed to ${action} user`);
    }
  };

  const getUserStatus = (user) => {
    if (!user.is_active) return { label: 'Deleted', color: 'error' };
    if (user.paused_at) return { label: 'Paused', color: 'warning' };
    return { label: 'Active', color: 'success' };
  };

  const canPerformAction = (action, user) => {
    if (!permissions) return false;
    
    switch (action) {
      case 'pause':
      case 'unpause':
        return permissions.can_pause_users;
      case 'delete':
        return permissions.can_delete_users && user.is_active;
      default:
        return false;
    }
  };

  if (!permissions.can_view_all_users && !permissions.can_manage_org_users && !permissions.is_system_admin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You don't have permission to manage users.
          <br />
          Debug: {JSON.stringify(permissions)}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={filterRole}
              label="Role"
              onChange={(e) => setFilterRole(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="owner">Owner</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
              <MenuItem value="client">Client</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              label="Status"
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="paused">Paused</MenuItem>
              <MenuItem value="deleted">Deleted</MenuItem>
            </Select>
          </FormControl>
          
          <IconButton onClick={fetchUsers} color="primary">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Paper>
      
      {/* Users Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Organization</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => {
                  const status = getUserStatus(user);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.organization_name || '-'}</TableCell>
                      <TableCell>
                        {user.role && (
                          <Chip label={user.role} size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={status.label}
                          color={status.color}
                          size="small"
                        />
                        {user.pause_reason && (
                          <Tooltip title={`Reason: ${user.pause_reason}`}>
                            <Typography variant="caption" sx={{ ml: 1 }}>
                              (i)
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="View History">
                          <IconButton
                            size="small"
                            onClick={() => fetchUserHistory(user.id)}
                          >
                            <HistoryIcon />
                          </IconButton>
                        </Tooltip>
                        
                        {user.paused_at ? (
                          <Tooltip title="Unpause User">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => setActionDialog({
                                open: true,
                                action: 'unpause',
                                user,
                                reason: ''
                              })}
                              disabled={!canPerformAction('unpause', user)}
                            >
                              <PlayIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Pause User">
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => setActionDialog({
                                open: true,
                                action: 'pause',
                                user,
                                reason: ''
                              })}
                              disabled={!canPerformAction('pause', user) || !user.is_active}
                            >
                              <PauseIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        <Tooltip title="Delete User">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setActionDialog({
                              open: true,
                              action: 'delete',
                              user,
                              reason: ''
                            })}
                            disabled={!canPerformAction('delete', user)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            <TablePagination
              rowsPerPageOptions={[10, 25, 50]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
            />
          </>
        )}
      </TableContainer>
      
      {/* Action Confirmation Dialog */}
      <Dialog
        open={actionDialog.open}
        onClose={() => setActionDialog({ open: false, action: null, user: null, reason: '' })}
      >
        <DialogTitle>
          {actionDialog.action === 'pause' && 'Pause User'}
          {actionDialog.action === 'unpause' && 'Unpause User'}
          {actionDialog.action === 'delete' && 'Delete User'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {actionDialog.action === 'pause' && 
              `Are you sure you want to pause ${actionDialog.user?.name}'s account? They will not be able to log in.`
            }
            {actionDialog.action === 'unpause' && 
              `Are you sure you want to unpause ${actionDialog.user?.name}'s account? They will be able to log in again.`
            }
            {actionDialog.action === 'delete' && 
              `Are you sure you want to delete ${actionDialog.user?.name}'s account? This action cannot be undone.`
            }
          </DialogContentText>
          
          {actionDialog.action !== 'unpause' && (
            <TextField
              autoFocus
              margin="dense"
              label="Reason (optional)"
              fullWidth
              multiline
              rows={3}
              value={actionDialog.reason}
              onChange={(e) => setActionDialog({ ...actionDialog, reason: e.target.value })}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialog({ open: false, action: null, user: null, reason: '' })}>
            Cancel
          </Button>
          <Button onClick={handleAction} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* History Dialog */}
      <Dialog
        open={historyDialog.open}
        onClose={() => setHistoryDialog({ open: false, user: null, logs: [] })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          User History: {historyDialog.user?.name}
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Performed By</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyDialog.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.performed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.action}
                        size="small"
                        color={
                          log.action === 'deleted' ? 'error' :
                          log.action === 'paused' ? 'warning' :
                          'success'
                        }
                      />
                    </TableCell>
                    <TableCell>{log.performed_by}</TableCell>
                    <TableCell>{log.reason || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialog({ open: false, user: null, logs: [] })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserManagementPage;