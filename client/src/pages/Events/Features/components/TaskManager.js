import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import GoogleCalendarSync from './GoogleCalendarSync';
import InternalCalendar from './InternalCalendar';
import ReminderToast from './ReminderToast';
import FeaturePageTemplate from '../FeaturePageTemplate';
import '../../../../styles/EventTimeline.css';

const TaskManager = ({ eventId, permissionLoading = false }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const actualEventId = eventId || id; 
  const { t } = useTranslation();
  const [tasks, setTasks] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [statistics, setStatistics] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    category: 'all'
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [calendarMode, setCalendarMode] = useState('none');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showGoogleSync, setShowGoogleSync] = useState(true);
  const messageTimeoutRef = useRef(null);
  const processedAuthState = useRef(false);
  const [canEdit, setCanEdit] = useState(true);
  const [userPermission, setUserPermission] = useState('edit');
  
  const showError = (message) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setErrorMessage(message);
    setSuccessMessage('');
    messageTimeoutRef.current = setTimeout(() => setErrorMessage(''), 5000);
  };

  const showSuccess = (message) => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    setSuccessMessage(message);
    setErrorMessage('');
    messageTimeoutRef.current = setTimeout(() => setSuccessMessage(''), 5000);
  };

  const getAuthToken = () => {
    return localStorage.getItem('token');
  };

  const fetchEventPermissions = useCallback(async () => {
  try {
    const token = getAuthToken();
    
    if (!token) {
      return;
    }
    
    const response = await fetch(`/api/events/${actualEventId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch event permissions');
    }

    const data = await response.json();
    setCanEdit(data.canEdit || false);
    setUserPermission(data.userPermission || 'view');
  } catch (error) {
    console.error('Error fetching event permissions:', error);
  }
}, [actualEventId]);

  const fetchEventData = useCallback(async () => {
    try {
      const token = getAuthToken();
      
      if (!token) {
        return;
      }
      
      const response = await fetch(`/api/events/${actualEventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch event data');
      }

      const data = await response.json();
      setEventData(data);
    } catch (error) {
      console.error('Error fetching event data:', error);
    }
  }, [actualEventId]);

const fetchTasks = useCallback(async (showErrorMsg = true) => {
  try {
    const token = getAuthToken();
    
    if (!token) {
      if (showErrorMsg) {
        showError(t('auth.notLoggedIn'));
      }
      return;
    }
    
    // בקשה עם timeout קצר יותר
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`/api/tasks/event/${actualEventId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        setTasks([]);
        return;
      }
      throw new Error('Failed to fetch tasks');
    }

    const data = await response.json();
    setTasks(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request timeout');
      if (showErrorMsg && canEdit) {
        showError(t('events.features.tasks.messages.timeout'));
      }
    } else {
      console.error('Error fetching tasks:', error);
      if (showErrorMsg && canEdit) {
        showError(t('events.features.tasks.messages.loadError'));
      }
    }
    setTasks([]);
  }
}, [actualEventId, t, canEdit]);

  const fetchStatistics = useCallback(async () => {
    try {
      const token = getAuthToken();
      
      const response = await fetch(`/api/tasks/event/${actualEventId}/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }

      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [actualEventId]);

  const handleSaveTask = async (taskData) => {

    if (!canEdit) {
    showError(t('events.accessDenied'));
    return;
  }
    
    try {
      const token = getAuthToken();
      const isEditing = editingTask !== null;
      
      const url = isEditing 
        ? `/api/tasks/event/${actualEventId}/${editingTask._id}`
        : `/api/tasks/event/${actualEventId}`;
      
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        throw new Error('Failed to save task');
      }

      setShowModal(false);
      setEditingTask(null);
      await fetchTasks();
      await fetchStatistics();
      
      showSuccess(isEditing ? t('events.features.tasks.messages.updateSuccess') : t('events.features.tasks.messages.createSuccess'));
    } catch (error) {
      console.error('Error saving task:', error);
      showError(t('events.features.tasks.messages.saveError'));
    }
  };

  const handleDeleteTask = async (taskId) => {

    if (!canEdit) {
    showError(t('events.accessDenied'));
    return;
  }
    
    setDeletingTaskId(taskId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTask = async () => {
    if (!canEdit) return;
    
    setShowDeleteModal(false);
    
    try {
      const token = getAuthToken();
      
      const response = await fetch(`/api/tasks/event/${actualEventId}/${deletingTaskId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      await fetchTasks();
      await fetchStatistics();
      showSuccess(t('events.features.tasks.messages.deleteSuccess'));
    } catch (error) {
      console.error('Error deleting task:', error);
      showError(t('events.features.tasks.messages.deleteError'));
    } finally {
      setDeletingTaskId(null);
    }
  };

  const cancelDeleteTask = () => {
    setShowDeleteModal(false);
    setDeletingTaskId(null);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    
    if (!canEdit) {
    showError(t('events.accessDenied'));
    return;
  }
    
    try {
      const token = getAuthToken();
      
      const response = await fetch(`/api/tasks/event/${actualEventId}/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      await fetchTasks();
      await fetchStatistics();
    } catch (error) {
      console.error('Error updating task status:', error);
      showError(t('events.features.tasks.messages.statusError'));
    }
  };

  const handleEditTask = (task) => {
    if (!canEdit) {
      showError(t('events.accessDenied'));
      return;
    }
    setEditingTask(task);
    setShowModal(true);
  };

  const handleCalendarModeChange = (mode) => {
    setCalendarMode(mode);
    if (mode === 'internal') {
      setShowCalendar(true);
      setShowGoogleSync(false);
    } else if (mode === 'google') {
      setShowCalendar(false);
      setShowGoogleSync(true);
    } else {
      setShowCalendar(false);
      setShowGoogleSync(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.category !== 'all' && task.category !== filters.category) return false;
    return true;
  });

  useEffect(() => {
    if (location.state && !processedAuthState.current) {
      processedAuthState.current = true;
      
      if (location.state.googleAuthError) {
        const message = location.state.message || t('events.features.tasks.calendar.sync.connectionError');
        showError(message);
      }
      
      navigate(location.pathname, { 
        replace: true, 
        state: {} 
      });
    }
  }, [location.state, navigate, location.pathname, t]);

  useEffect(() => {
    if (actualEventId) {
      setLoading(false);
      
      Promise.all([
        fetchEventPermissions(),
        fetchEventData(), 
        fetchTasks(false),
        fetchStatistics()
      ]).catch(error => {
        console.error('Error loading initial data:', error);
      });
    }
  }, [actualEventId, fetchEventPermissions, fetchEventData, fetchTasks, fetchStatistics]);

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  return (
    <FeaturePageTemplate
      title={t('events.features.tasks.title')}
      icon="📋"
      description={t('events.features.tasks.description')}
    >
      <ReminderToast 
        tasks={tasks} 
        onTaskClick={handleEditTask}
        canEdit={canEdit}
      />

      <div className="statistics-grid">
        <div className="stat-card total">
          <div className="stat-number">{statistics.total}</div>
          <div className="stat-label">{t('events.features.tasks.statistics.total')}</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-number">{statistics.completed}</div>
          <div className="stat-label">{t('events.features.tasks.statistics.completed')}</div>
        </div>
        <div className="stat-card pending">
            <div className="stat-number">{statistics.inProgress}</div>
            <div className="stat-label">{t('events.features.tasks.statistics.inProgress')}</div>
        </div>
        <div className="stat-card overdue">
          <div className="stat-number">{statistics.overdue}</div>
          <div className="stat-label">{t('events.features.tasks.statistics.overdue')}</div>
        </div>
      </div>

      <div className="calendar-mode-selection">
        <h3>{t('events.features.tasks.calendar.modeSelection.title')}</h3>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${calendarMode === 'google' ? 'active' : ''}`}
            onClick={() => handleCalendarModeChange('google')}
          >
            <span className="mode-icon">🔗</span>
            <span>{t('events.features.tasks.calendar.modeSelection.googleMode')}</span>
          </button>
          <button
            className={`mode-btn ${calendarMode === 'internal' ? 'active' : ''}`}
            onClick={() => handleCalendarModeChange('internal')}
          >
            <span className="mode-icon">📅</span>
            <span>{t('events.features.tasks.calendar.modeSelection.internalMode')}</span>
          </button>
        </div>
      </div>

      {calendarMode === 'google' && (
        <GoogleCalendarSync 
          eventId={actualEventId} 
          canEdit={canEdit}
          isExpanded={showGoogleSync}
          onClose={() => setShowGoogleSync(false)}
        />
      )}

      {errorMessage && (
        <div className="task-manager-error-message">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="task-manager-success-message">
          {successMessage}
        </div>
      )}

      {calendarMode === 'internal' && showCalendar && (
        <div className="internal-calendar-container">
          <InternalCalendar 
            tasks={tasks}
            eventDate={eventData?.date}
            onTaskClick={handleEditTask}
            canEdit={canEdit}
            onClose={() => {
              setShowCalendar(false);
              setCalendarMode('none');
            }}
          />
        </div>
      )}

      <div className="timeline-controls">
        <div className="controls-left">
          <div className="filter-group">
            <label>{t('events.features.tasks.filters.status')}:</label>
            <select 
              className="filter-select"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">{t('events.features.tasks.filters.all')}</option>
              <option value="pending">{t('events.features.tasks.status.pending')}</option>
              <option value="in_progress">{t('events.features.tasks.status.in_progress')}</option>
              <option value="completed">{t('events.features.tasks.status.completed')}</option>
            </select>
          </div>

          <div className="filter-group">
            <label>{t('events.features.tasks.filters.priority')}:</label>
            <select 
              className="filter-select"
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
            >
              <option value="all">{t('events.features.tasks.filters.all')}</option>
              <option value="urgent">{t('events.features.tasks.priority.urgent')}</option>
              <option value="high">{t('events.features.tasks.priority.high')}</option>
              <option value="medium">{t('events.features.tasks.priority.medium')}</option>
              <option value="low">{t('events.features.tasks.priority.low')}</option>
            </select>
          </div>

          <div className="filter-group">
            <label>{t('events.features.tasks.filters.category')}:</label>
            <select 
              className="filter-select"
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
            >
              <option value="all">{t('events.features.tasks.filters.all')}</option>
              <option value="venue">{t('events.features.tasks.category.venue')}</option>
              <option value="catering">{t('events.features.tasks.category.catering')}</option>
              <option value="decoration">{t('events.features.tasks.category.decoration')}</option>
              <option value="entertainment">{t('events.features.tasks.category.entertainment')}</option>
              <option value="photography">{t('events.features.tasks.category.photography')}</option>
              <option value="invitations">{t('events.features.tasks.category.invitations')}</option>
              <option value="transportation">{t('events.features.tasks.category.transportation')}</option>
              <option value="budget">{t('events.features.tasks.category.budget')}</option>
              <option value="other">{t('events.features.tasks.category.other')}</option>
            </select>
          </div>
        </div>

        
          <button 
            className="add-task-btn"
            onClick={() => {
              if (!canEdit) {
                showError(t('events.accessDenied'));
                return;
              }
              setEditingTask(null);
              setShowModal(true);
            }}
            disabled={!canEdit}
        >
            <span>✚</span>
            {t('events.features.tasks.addTask')}
          </button>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <h3>{t('events.features.tasks.noTasks')}</h3>
          <p>
            {tasks.length === 0 
              ? t('events.features.tasks.noTasksMessage')
              : t('events.features.tasks.noFilteredTasks')
            }
          </p>
          {tasks.length === 0 && (
            <button 
              className="btn-primary"
              onClick={() => {
                if (!canEdit) {
                  showError(t('events.accessDenied'));
                  return;
                }
                setEditingTask(null);
                setShowModal(true);
              }}
              disabled={!canEdit}
            >
              {t('events.features.tasks.createTask')}
            </button>
          )}
        </div>
      ) : (
        <div className="tasks-grid">
          {filteredTasks.map(task => (
            <TaskCard
              key={task._id}
              task={task}
              canEdit={canEdit}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {canEdit && showModal && (
        <TaskModal
          task={editingTask}
          eventDate={eventData?.date}
          onSave={handleSaveTask}
          onClose={() => {
            setShowModal(false);
            setEditingTask(null);
          }}
        />
      )}

      {showDeleteModal && canEdit && (
        <div className="modal-overlay" onClick={cancelDeleteTask}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-delete" onClick={cancelDeleteTask}>
              ✕
            </button>
            
            <div className="modal-header">
              <h2 className="modal-title">{t('events.features.tasks.messages.deleteConfirm')}</h2>
            </div>
            
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={cancelDeleteTask}
              >
                {t('general.cancel')}
              </button>
              <button
                className="btn-primary delete-confirm-btn"
                onClick={confirmDeleteTask}
              >
                {t('events.features.tasks.actions.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default TaskManager;