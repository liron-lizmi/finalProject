import { useTranslation } from 'react-i18next';

const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
  const { t } = useTranslation();

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'completed') return false;
    return new Date() > new Date(dueDate);
  };

  const getStatusText = (status) => {
    return t(`events.features.tasks.status.${status}`);
  };

  const getPriorityText = (priority) => {
    return t(`events.features.tasks.priority.${priority}`);
  };

  const getCategoryText = (category) => {
    return t(`events.features.tasks.category.${category}`);
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      'pending': 'in_progress',
      'in_progress': 'completed',
      'completed': 'pending'
    };
    return statusFlow[currentStatus] || 'pending';
  };

  const getNextStatusText = (currentStatus) => {
    const nextStatusMap = {
      'pending': t('events.features.tasks.actions.start'),
      'in_progress': t('events.features.tasks.actions.complete'),
      'completed': t('events.features.tasks.actions.cancelComplete')
    };
    return nextStatusMap[currentStatus] || t('events.features.tasks.actions.complete');
  };

  const daysUntilDue = getDaysUntilDue(task.dueDate);
  const taskIsOverdue = isOverdue(task.dueDate, task.status);

  return (
    <div className={`task-card ${task.status} ${taskIsOverdue ? 'overdue' : ''}`}>
      <div className="task-header">
        <div>
          <h3 className={`task-title ${task.status}`}>{task.title}</h3>
        </div>
        <div className="task-header-info">
          <div className={`task-due-date ${taskIsOverdue ? 'overdue' : ''}`}>
            {formatDate(task.dueDate)}
            {daysUntilDue !== null && (
              <span className="task-days-info">
                {daysUntilDue === 0 && `(${t('events.features.tasks.time.today')})`}
                {daysUntilDue === 1 && `(${t('events.features.tasks.time.tomorrow')})`}
                {daysUntilDue > 1 && `(${t('events.features.tasks.time.daysLeft', { days: daysUntilDue })})`}
                {daysUntilDue < 0 && `(${t('events.features.tasks.time.daysOverdue', { days: Math.abs(daysUntilDue) })})`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="task-body">
        <div className="task-main-content">
          {task.description && (
            <p className="task-description">{task.description}</p>
          )}

          <span className="task-category">
            {getCategoryText(task.category)}
          </span>

          {task.notes && (
            <div className="task-notes">
              {task.notes}
            </div>
          )}
        </div>

        <div className="task-side-info">
          <div className={`task-priority priority-${task.priority}`}>
            {getPriorityText(task.priority)}
          </div>
        </div>
      </div>

      <div className="task-bottom-section">
        <div className="task-status-container">
          <span className={`task-status ${task.status}`}>
            {getStatusText(task.status)}
          </span>
        </div>

        <div className="task-actions">
          <button
            className="task-action-btn btn-edit"
            onClick={() => onEdit(task)}
          >
            {t('events.features.tasks.actions.edit')}
          </button>

          <button
            className="task-action-btn btn-delete"
            onClick={() => onDelete(task._id)}
          >
            {t('events.features.tasks.actions.delete')}
          </button>

          {task.status !== 'cancelled' && (
            <button
              className={`task-action-btn ${task.status === 'completed' ? 'btn-edit' : 'btn-complete'}`}
              onClick={() => onStatusChange(task._id, getNextStatus(task.status))}
            >
              {getNextStatusText(task.status)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;