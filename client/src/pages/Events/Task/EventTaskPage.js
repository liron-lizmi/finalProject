/**
 * EventTaskPage.js - Event Task/Timeline Management Component
 *
 * Main component for managing event tasks and timeline.
 *
 * Route: /event/:id/timeline
 *
 * Features:
 * - Task list with CRUD operations
 * - Filter by status, priority, category
 * - Statistics dashboard (total, completed, in progress, overdue)
 * - Google Calendar sync integration
 * - Internal calendar view
 * - Reminder notifications (toast)
 * - Permission-based editing
 *
 * Task Properties:
 * - title, description, dueDate, dueTime
 * - priority (low, medium, high)
 * - category (venue, vendors, guests, etc.)
 * - status (pending, in_progress, completed)
 * - reminder settings with recurrence
 *
 * Tabs:
 * - List: Task cards view
 * - Calendar: Visual calendar view
 *
 * Components Used:
 * - TaskCard: Individual task display
 * - TaskModal: Create/edit task form
 * - GoogleCalendarSync: Calendar integration
 * - InternalCalendar: Built-in calendar view
 * - ReminderToast: Reminder notifications
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import TaskCard from './components/TaskCard';
import TaskModal from './components/TaskModal';
import GoogleCalendarSync from './components/GoogleCalendarSync';
import InternalCalendar from './components/InternalCalendar';
import ReminderToast from './components/ReminderToast';
import FeaturePageTemplate from '../../FeaturePageTemplate';
import { apiFetch } from '../../../utils/api';
import '../../../styles/EventTimeline.css';

const EventTaskPage = ({ eventId, permissionLoading = false }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const actualEventId = eventId || id;
  const { t } = useTranslation();
  
  const [tasks, setTasks] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [statistics, setStatistics] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  
  const [activeTab, setActiveTab] = useState('list'); 

  const [filters, setFilters] = useState({ status: 'all', priority: 'all', category: 'all' });
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
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setErrorMessage(message);
    setSuccessMessage('');
    messageTimeoutRef.current = setTimeout(() => setErrorMessage(''), 5000);
  };

  const showSuccess = (message) => {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setSuccessMessage(message);
    setErrorMessage('');
    messageTimeoutRef.current = setTimeout(() => setSuccessMessage(''), 5000);
  };

  const getAuthToken = () => localStorage.getItem('token');

  const fetchEventPermissions = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await apiFetch(`/api/events/${actualEventId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setCanEdit(data.canEdit || false);
      setUserPermission(data.userPermission || 'view');
    } catch (error) { /* Error fetching event permissions */ }
  }, [actualEventId]);

  const fetchEventData = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;
      const response = await apiFetch(`/api/events/${actualEventId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setEventData(data);
    } catch (error) { /* Error fetching event data */ }
  }, [actualEventId]);

  const fetchTasks = useCallback(async (showErrorMsg = true) => {
    try {
      const token = getAuthToken();
      if (!token) { if (showErrorMsg) showError(t('auth.notLoggedIn')); return; }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await apiFetch(`/api/tasks/event/${actualEventId}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) { if (response.status === 404) { setTasks([]); return; } throw new Error('Failed'); }
      const data = await response.json();
      setTasks(data);
    } catch (error) {
       setTasks([]);
    }
  }, [actualEventId, t]);

  const fetchStatistics = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await apiFetch(`/api/tasks/event/${actualEventId}/statistics`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setStatistics(data);
    } catch (error) { /* Error fetching statistics */ }
  }, [actualEventId]);

  const handleSaveTask = async (taskData) => {
    if (!canEdit) { showError(t('events.accessDenied')); return; }
    try {
      const token = getAuthToken();
      const isEditing = editingTask !== null;
      const url = isEditing ? `/api/tasks/event/${actualEventId}/${editingTask._id}` : `/api/tasks/event/${actualEventId}`;
      const method = isEditing ? 'PUT' : 'POST';
      const response = await apiFetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (!response.ok) throw new Error('Failed');
      setShowModal(false);
      setEditingTask(null);
      await fetchTasks();
      await fetchStatistics();
      showSuccess(isEditing ? t('events.features.tasks.messages.updateSuccess') : t('events.features.tasks.messages.createSuccess'));
    } catch (error) { showError(t('events.features.tasks.messages.saveError')); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!canEdit) { showError(t('events.accessDenied')); return; }
    setDeletingTaskId(taskId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTask = async () => {
    if (!canEdit) return;
    setShowDeleteModal(false);
    try {
      const token = getAuthToken();
      const response = await apiFetch(`/api/tasks/event/${actualEventId}/${deletingTaskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed');
      await fetchTasks();
      await fetchStatistics();
      showSuccess(t('events.features.tasks.messages.deleteSuccess'));
    } catch (error) { showError(t('events.features.tasks.messages.deleteError')); } finally { setDeletingTaskId(null); }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    if (!canEdit) { showError(t('events.accessDenied')); return; }
    try {
      const token = getAuthToken();
      const response = await apiFetch(`/api/tasks/event/${actualEventId}/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed');
      await fetchTasks();
      await fetchStatistics();
    } catch (error) { showError(t('events.features.tasks.messages.statusError')); }
  };

  const handleCalendarModeChange = (mode) => {
    setCalendarMode(mode);
    if (mode === 'internal') { setShowCalendar(true); setShowGoogleSync(false); }
    else if (mode === 'google') { setShowCalendar(false); setShowGoogleSync(true); }
    else { setShowCalendar(false); setShowGoogleSync(false); }
  };

  useEffect(() => {
    if (location.state && !processedAuthState.current) {
      processedAuthState.current = true;
      if (location.state.googleAuthError) {
        showError(location.state.message || t('events.features.tasks.calendar.sync.connectionError'));
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname, t]);

  useEffect(() => {
    if (actualEventId) {
      setLoading(false);
      Promise.all([fetchEventPermissions(), fetchEventData(), fetchTasks(false), fetchStatistics()]).catch(() => {});
    }
  }, [actualEventId, fetchEventPermissions, fetchEventData, fetchTasks, fetchStatistics]);

  const filteredTasks = tasks.filter(task => {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.category !== 'all' && task.category !== filters.category) return false;
    return true;
  });

  return (
    <FeaturePageTemplate title={t('events.features.tasks.title')} icon="📅">
      <ReminderToast tasks={tasks} onTaskClick={(task) => { setEditingTask(task); setShowModal(true); }} canEdit={canEdit} />

      <div className="dashboard-summary-bar">
        <div className="summary-item">
          <span className="summary-value large">{statistics.total}</span>
          <span className="summary-label">{t('events.features.tasks.statistics.total')}</span>
        </div>
        
        <div className="vertical-divider"></div>
        
        <div className="summary-item">
          <span className="summary-value large success-text">{statistics.completed}</span>
          <span className="summary-label">{t('events.features.tasks.statistics.completed')}</span>
        </div>
        
        <div className="vertical-divider"></div>
        
        <div className="summary-item">
          <span className="summary-value large pending-text">{statistics.inProgress}</span>
          <span className="summary-label">{t('events.features.tasks.statistics.inProgress')}</span>
        </div>

        <div className="vertical-divider"></div>
        
        <div className="summary-item">
          <span className="summary-value large overdue-text">{statistics.overdue}</span>
          <span className="summary-label">{t('events.features.tasks.statistics.overdue')}</span>
        </div>
      </div>

      {errorMessage && <div className="task-manager-error-message">{errorMessage}</div>}
      {successMessage && <div className="task-manager-success-message">{successMessage}</div>}

      <div className="feature-tabs">
        <button 
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          {t('events.features.tasks.form.titleTable')}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          {t('events.features.tasks.calendar.title')}
        </button>
      </div>

      <div className="feature-content-area">
        {activeTab === 'list' && (
          <>
            {/* Filters & Actions Bar */}
            <div className="timeline-controls table-controls">
              <div className="controls-left">
                <div className="filter-group">
                  <span className="filter-label">{t('events.features.tasks.filters.status')}:</span>
                  <select className="filter-select" value={filters.status} onChange={(e) => setFilters({...filters, status: e.target.value})}>
                    <option value="all">{t('events.features.tasks.filters.all')}</option>
                    <option value="pending">{t('events.features.tasks.status.pending')}</option>
                    <option value="in_progress">{t('events.features.tasks.status.in_progress')}</option>
                    <option value="completed">{t('events.features.tasks.status.completed')}</option>
                  </select>
                </div>

              <div className="filter-group">
                <span className="filter-label">{t('events.features.tasks.filters.priority')}:</span>
                <select className="filter-select" value={filters.priority} onChange={(e) => setFilters({...filters, priority: e.target.value})}>
                  <option value="all">{t('events.features.tasks.filters.all')}</option>
                  <option value="urgent">{t('events.features.tasks.priority.urgent')}</option>
                  <option value="high">{t('events.features.tasks.priority.high')}</option>
                  <option value="medium">{t('events.features.tasks.priority.medium')}</option>
                  <option value="low">{t('events.features.tasks.priority.low')}</option>
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">{t('events.features.tasks.filters.category')}:</span>
                <select className="filter-select" value={filters.category} onChange={(e) => setFilters({...filters, category: e.target.value})}>
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
                  if (!canEdit) { showError(t('events.accessDenied')); return; }
                  setEditingTask(null);
                  setShowModal(true);
                }}
                disabled={!canEdit}
              >
                <span>✚</span> {t('events.features.tasks.addTask')}
              </button>
            </div>

            {/* Task Table/List View */}
            <div className="tasks-table-container">
              {filteredTasks.length === 0 ? (
                 <div className="empty-state">
                   <div className="empty-state-icon">📝</div>
                   <h3>{t('events.features.tasks.noTasks')}</h3>
                 </div>
              ) : (
                <div className="tasks-table">
                  <div className="table-header">
                    <div className="th-cell title">{t('events.features.tasks.form.taskName')}</div>
                    <div className="th-cell category">{t('events.features.tasks.form.category')}</div>
                    <div className="th-cell priority">{t('events.features.tasks.form.priority')}</div>
                    <div className="th-cell date">{t('events.features.tasks.form.dueDate')}</div>
                    <div className="th-cell status">{t('events.features.tasks.form.statusTable')}</div>
                    <div className="th-cell actions"></div>
                  </div>
                  <div className="table-body">
                    {filteredTasks.map(task => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        canEdit={canEdit}
                        onEdit={(t) => { setEditingTask(t); setShowModal(true); }}
                        onDelete={handleDeleteTask}
                        onStatusChange={handleStatusChange}
                        viewMode="row"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'schedule' && (
          <div className="schedule-view">
             <div className="calendar-mode-selection">
                <h3>{t('events.features.tasks.calendar.modeSelection.title')}</h3>
                <div className="mode-buttons">
                  <button className={`mode-btn ${calendarMode === 'google' ? 'active' : ''}`} onClick={() => handleCalendarModeChange('google')}>
                    <span className="mode-icon">🔗</span> {t('events.features.tasks.calendar.modeSelection.googleMode')}
                  </button>
                  <button className={`mode-btn ${calendarMode === 'internal' ? 'active' : ''}`} onClick={() => handleCalendarModeChange('internal')}>
                    <span className="mode-icon">📅</span> {t('events.features.tasks.calendar.modeSelection.internalMode')}
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

              {calendarMode === 'internal' && showCalendar && (
                <div className="internal-calendar-container">
                  <InternalCalendar 
                    tasks={tasks}
                    eventDate={eventData?.date}
                    onTaskClick={(t) => { setEditingTask(t); setShowModal(true); }}
                    canEdit={canEdit}
                    onClose={() => { setShowCalendar(false); setCalendarMode('none'); }}
                  />
                </div>
              )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <TaskModal
          task={editingTask}
          eventDate={eventData?.date}
          canEdit={canEdit}
          onSave={handleSaveTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('dashboard.confirmDelete')}</h3></div>
            <p className="delete-modal-text">{t('events.features.tasks.messages.deleteConfirm')}</p>
            <div className="modal-footer">
               <button className="modal-btn cancel" onClick={() => setShowDeleteModal(false)}>{t('general.cancel')}</button>
               <button className="modal-btn delete" onClick={confirmDeleteTask}>{t('events.features.tasks.actions.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default EventTaskPage;