import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const SeatingPreferencesModal = ({
  isOpen,
  preferences,
  guests,
  onClose,
  onSave,
  canEdit = true
}) => {
  const { t } = useTranslation();
  const [localPreferences, setLocalPreferences] = useState({
    groupTogether: [],
    keepSeparate: [],
    specialRequests: []
  });

  const [activeTab, setActiveTab] = useState('groupTogether');
  const [newGroupRule, setNewGroupRule] = useState({
    name: '',
    guestIds: []
  });
  const [newSeparateRule, setNewSeparateRule] = useState({
    guest1Id: '',
    guest2Id: '',
    reason: ''
  });
  const [newSpecialRequest, setNewSpecialRequest] = useState({
    guestId: '',
    request: '',
    priority: 'medium'
  });

  useEffect(() => {
    if (preferences) {
      setLocalPreferences({
        groupTogether: preferences.groupTogether || [],
        keepSeparate: preferences.keepSeparate || [],
        specialRequests: preferences.specialRequests || []
      });
    }
  }, [preferences]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localPreferences);
    onClose();
  };

  const handleAddGroupRule = () => {
    if (newGroupRule.name.trim() && newGroupRule.guestIds.length >= 2) {
      setLocalPreferences(prev => ({
        ...prev,
        groupTogether: [...prev.groupTogether, {
          id: Date.now().toString(),
          name: newGroupRule.name.trim(),
          guestIds: [...newGroupRule.guestIds]
        }]
      }));
      setNewGroupRule({ name: '', guestIds: [] });
    }
  };

  const handleRemoveGroupRule = (ruleId) => {
    setLocalPreferences(prev => ({
      ...prev,
      groupTogether: prev.groupTogether.filter(rule => rule.id !== ruleId)
    }));
  };

  const handleAddSeparateRule = () => {
    if (newSeparateRule.guest1Id && newSeparateRule.guest2Id && 
        newSeparateRule.guest1Id !== newSeparateRule.guest2Id) {
      setLocalPreferences(prev => ({
        ...prev,
        keepSeparate: [...prev.keepSeparate, {
          id: Date.now().toString(),
          guest1Id: newSeparateRule.guest1Id,
          guest2Id: newSeparateRule.guest2Id,
          reason: newSeparateRule.reason.trim()
        }]
      }));
      setNewSeparateRule({ guest1Id: '', guest2Id: '', reason: '' });
    }
  };

  const handleRemoveSeparateRule = (ruleId) => {
    setLocalPreferences(prev => ({
      ...prev,
      keepSeparate: prev.keepSeparate.filter(rule => rule.id !== ruleId)
    }));
  };

  const handleAddSpecialRequest = () => {
    if (newSpecialRequest.guestId && newSpecialRequest.request.trim()) {
      setLocalPreferences(prev => ({
        ...prev,
        specialRequests: [...prev.specialRequests, {
          id: Date.now().toString(),
          guestId: newSpecialRequest.guestId,
          request: newSpecialRequest.request.trim(),
          priority: newSpecialRequest.priority
        }]
      }));
      setNewSpecialRequest({ guestId: '', request: '', priority: 'medium' });
    }
  };

  const handleRemoveSpecialRequest = (requestId) => {
    setLocalPreferences(prev => ({
      ...prev,
      specialRequests: prev.specialRequests.filter(request => request.id !== requestId)
    }));
  };

  const getGuestName = (guestId) => {
    const guest = guests.find(g => g._id === guestId);
    return guest ? `${guest.firstName} ${guest.lastName}` : t('seating.preferences.unknownGuest');
  };

  const toggleGuestInGroup = (guestId) => {
    setNewGroupRule(prev => ({
      ...prev,
      guestIds: prev.guestIds.includes(guestId)
        ? prev.guestIds.filter(id => id !== guestId)
        : [...prev.guestIds, guestId]
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content seating-preferences-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('seating.preferences.title')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Tabs */}
          <div className="preferences-tabs">
            <button
              className={`tab-button ${activeTab === 'groupTogether' ? 'active' : ''}`}
              onClick={() => setActiveTab('groupTogether')}
            >
              👥 {t('seating.preferences.groupTogether')}
            </button>
            <button
              className={`tab-button ${activeTab === 'keepSeparate' ? 'active' : ''}`}
              onClick={() => setActiveTab('keepSeparate')}
            >
              🚫 {t('seating.preferences.keepSeparate')}
            </button>
            <button
              className={`tab-button ${activeTab === 'specialRequests' ? 'active' : ''}`}
              onClick={() => setActiveTab('specialRequests')}
            >
              ⭐ {t('seating.preferences.specialRequests')}
            </button>
          </div>

          {/* Group Together Tab */}
          {activeTab === 'groupTogether' && (
            <div className="tab-content">
              <div className="tab-description">
                {t('seating.preferences.groupTogetherDescription')}
              </div>

              {/* Add New Group Rule */}
              <div className="add-rule-section">
                <h4>{t('seating.preferences.addGroupRule')}</h4>
                
                <div className="form-group">
                  <label>{t('seating.preferences.groupName')}</label>
                  <input
                    type="text"
                    value={newGroupRule.name}
                    onChange={(e) => setNewGroupRule(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('seating.preferences.groupNamePlaceholder')}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>{t('seating.preferences.selectGuests')} ({newGroupRule.guestIds.length})</label>
                  <div className="guests-grid">
                    {guests.map(guest => (
                      <label key={guest._id} className="guest-checkbox">
                        <input
                          type="checkbox"
                          checked={newGroupRule.guestIds.includes(guest._id)}
                          onChange={() => toggleGuestInGroup(guest._id)}
                        />
                        <span className="guest-name">
                          {guest.firstName} {guest.lastName}
                          {guest.attendingCount > 1 && (
                            <span className="attending-count">+{guest.attendingCount - 1}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  className="add-rule-button"
                  onClick={handleAddGroupRule}
                  disabled={!canEdit || !newGroupRule.name.trim() || newGroupRule.guestIds.length < 2}
                >
                  ➕ {t('seating.preferences.addRule')}
                </button>
              </div>

              {/* Existing Group Rules */}
              <div className="existing-rules-section">
                <h4>{t('seating.preferences.existingRules')} ({localPreferences.groupTogether.length})</h4>
                {localPreferences.groupTogether.length > 0 ? (
                  <div className="rules-list">
                    {localPreferences.groupTogether.map(rule => (
                      <div key={rule.id} className="rule-item group-rule">
                        <div className="rule-content">
                          <div className="rule-name">{rule.name}</div>
                          <div className="rule-guests">
                            {rule.guestIds.map(guestId => getGuestName(guestId)).join(', ')}
                          </div>
                        </div>
                        <button
                          className="remove-rule-button"
                          onClick={() => handleRemoveGroupRule(rule.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-rules-message">
                    {t('seating.preferences.noGroupRules')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Keep Separate Tab */}
          {activeTab === 'keepSeparate' && (
            <div className="tab-content">
              <div className="tab-description">
                {t('seating.preferences.keepSeparateDescription')}
              </div>

              {/* Add New Separate Rule */}
              <div className="add-rule-section">
                <h4>{t('seating.preferences.addSeparateRule')}</h4>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>{t('seating.preferences.firstGuest')}</label>
                    <select
                      value={newSeparateRule.guest1Id}
                      onChange={(e) => setNewSeparateRule(prev => ({ ...prev, guest1Id: e.target.value }))}
                      className="form-select"
                    >
                      <option value="">{t('seating.preferences.selectGuest')}</option>
                      {guests.map(guest => (
                        <option key={guest._id} value={guest._id}>
                          {guest.firstName} {guest.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t('seating.preferences.secondGuest')}</label>
                    <select
                      value={newSeparateRule.guest2Id}
                      onChange={(e) => setNewSeparateRule(prev => ({ ...prev, guest2Id: e.target.value }))}
                      className="form-select"
                    >
                      <option value="">{t('seating.preferences.selectGuest')}</option>
                      {guests.filter(guest => guest._id !== newSeparateRule.guest1Id).map(guest => (
                        <option key={guest._id} value={guest._id}>
                          {guest.firstName} {guest.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t('seating.preferences.reason')} ({t('seating.preferences.optional')})</label>
                  <input
                    type="text"
                    value={newSeparateRule.reason}
                    onChange={(e) => setNewSeparateRule(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder={t('seating.preferences.reasonPlaceholder')}
                    className="form-input"
                  />
                </div>

                <button
                  className="add-rule-button"
                  onClick={handleAddSeparateRule}
                  disabled={!canEdit || !newSeparateRule.guest1Id || !newSeparateRule.guest2Id}
                >
                  ➕ {t('seating.preferences.addRule')}
                </button>
              </div>

              {/* Existing Separate Rules */}
              <div className="existing-rules-section">
                <h4>{t('seating.preferences.existingRules')} ({localPreferences.keepSeparate.length})</h4>
                {localPreferences.keepSeparate.length > 0 ? (
                  <div className="rules-list">
                    {localPreferences.keepSeparate.map(rule => (
                      <div key={rule.id} className="rule-item separate-rule">
                        <div className="rule-content">
                          <div className="rule-guests">
                            {getGuestName(rule.guest1Id)} ↔️ {getGuestName(rule.guest2Id)}
                          </div>
                          {rule.reason && (
                            <div className="rule-reason">{rule.reason}</div>
                          )}
                        </div>
                        <button
                          className="remove-rule-button"
                          onClick={() => handleRemoveSeparateRule(rule.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-rules-message">
                    {t('seating.preferences.noSeparateRules')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Special Requests Tab */}
          {activeTab === 'specialRequests' && (
            <div className="tab-content">
              <div className="tab-description">
                {t('seating.preferences.specialRequestsDescription')}
              </div>

              {/* Add New Special Request */}
              <div className="add-rule-section">
                <h4>{t('seating.preferences.addSpecialRequest')}</h4>
                
                <div className="form-group">
                  <label>{t('seating.preferences.selectGuest')}</label>
                  <select
                    value={newSpecialRequest.guestId}
                    onChange={(e) => setNewSpecialRequest(prev => ({ ...prev, guestId: e.target.value }))}
                    className="form-select"
                  >
                    <option value="">{t('seating.preferences.selectGuest')}</option>
                    {guests.map(guest => (
                      <option key={guest._id} value={guest._id}>
                        {guest.firstName} {guest.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>{t('seating.preferences.request')}</label>
                  <textarea
                    value={newSpecialRequest.request}
                    onChange={(e) => setNewSpecialRequest(prev => ({ ...prev, request: e.target.value }))}
                    placeholder={t('seating.preferences.requestPlaceholder')}
                    className="form-textarea"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>{t('seating.preferences.priority')}</label>
                  <select
                    value={newSpecialRequest.priority}
                    onChange={(e) => setNewSpecialRequest(prev => ({ ...prev, priority: e.target.value }))}
                    className="form-select"
                  >
                    <option value="low">{t('seating.preferences.priorityLow')}</option>
                    <option value="medium">{t('seating.preferences.priorityMedium')}</option>
                    <option value="high">{t('seating.preferences.priorityHigh')}</option>
                  </select>
                </div>

                <button
                  className="add-rule-button"
                  onClick={handleAddSpecialRequest}
                  disabled={!canEdit || !newSpecialRequest.guestId || !newSpecialRequest.request.trim()}
                >
                  ➕ {t('seating.preferences.addRequest')}
                </button>
              </div>

              {/* Existing Special Requests */}
              <div className="existing-rules-section">
                <h4>{t('seating.preferences.existingRequests')} ({localPreferences.specialRequests.length})</h4>
                {localPreferences.specialRequests.length > 0 ? (
                  <div className="rules-list">
                    {localPreferences.specialRequests.map(request => (
                      <div key={request.id} className="rule-item special-request">
                        <div className="rule-content">
                          <div className="request-guest">
                            {getGuestName(request.guestId)}
                            <span className={`priority-badge ${request.priority}`}>
                              {t(`seating.preferences.priority${request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}`)}
                            </span>
                          </div>
                          <div className="request-text">{request.request}</div>
                        </div>
                        <button
                          className="remove-rule-button"
                          onClick={() => handleRemoveSpecialRequest(request.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-rules-message">
                    {t('seating.preferences.noSpecialRequests')}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
           className="cancel-button"
           onClick={onClose}
           disabled={!canEdit}
          >
            {t('common.cancel')}
          </button>

          <button
            className="save-button"
            onClick={handleSave}
            disabled={!canEdit}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeatingPreferencesModal;