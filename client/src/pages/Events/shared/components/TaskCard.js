import { useTranslation } from 'react-i18next';
import '../../../../styles/EventTimeline.css'; // Ensure CSS is imported

const TaskCard = ({ task, onEdit, onDelete, onStatusChange, canEdit = true }) => {
  const { t } = useTranslation();

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  };

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'completed') return false;
    return new Date() > new Date(dueDate);
  };

  const taskIsOverdue = isOverdue(task.dueDate, task.status);

  const getStatusLabel = (status) => t(`events.features.tasks.status.${status}`);
  const getPriorityLabel = (priority) => t(`events.features.tasks.priority.${priority}`);
  const getCategoryLabel = (category) => t(`events.features.tasks.category.${category}`);

  const handleStatusClick = () => {
    if(!canEdit) return;
    const flow = { 'pending': 'in_progress', 'in_progress': 'completed', 'completed': 'pending' };
    onStatusChange(task._id, flow[task.status]);
  };

  return (
    <div className={`task-row ${task.status} ${taskIsOverdue ? 'overdue' : ''}`}>
      
      {/* Title & Description Column */}
      <div className="row-cell title-cell" onClick={() => canEdit && onEdit(task)}>
        <span className={`task-name ${task.status === 'completed' ? 'completed-text' : ''}`}>
          {task.title}
        </span>
        {task.description && <span className="task-desc-preview">{task.description}</span>}
      </div>

      {/* Category */}
      <div className="row-cell category-cell">
        <span className="pill category-pill">{getCategoryLabel(task.category)}</span>
      </div>

      {/* Priority */}
      <div className="row-cell priority-cell">
        <div className={`priority-indicator p-${task.priority}`}></div>
        <span>{getPriorityLabel(task.priority)}</span>
      </div>

      {/* Due Date */}
      <div className="row-cell date-cell">
        <span className={taskIsOverdue ? 'text-danger' : ''}>
           {formatDate(task.dueDate)}
        </span>
      </div>

      {/* Status (Clickable) */}
      <div className="row-cell status-cell">
        <button 
           className={`status-badge ${task.status}`} 
           onClick={(e) => { e.stopPropagation(); handleStatusClick(); }}
           disabled={!canEdit}
        >
          {getStatusLabel(task.status)}
        </button>
      </div>

      {/* Actions */}
      <div className="row-cell actions-cell">
        <button className="icon-btn edit-btn" onClick={() => onEdit(task)} disabled={!canEdit} title={t('events.features.tasks.actions.edit')}>✎</button>
        <button className="icon-btn delete-btn" onClick={() => onDelete(task._id)} disabled={!canEdit} title={t('events.features.tasks.actions.delete')}>🗑</button>
      </div>
    </div>
  );
};

export default TaskCard;