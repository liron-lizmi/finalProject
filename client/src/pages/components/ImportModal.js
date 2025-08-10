import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import googleContactsAPI from './GoogleContacts';
import './ImportModal.css';

const ImportModal = ({ isOpen, onClose, onImport, eventId }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('csv');
  const [csvData, setCsvData] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState([]);
  
  // Google Contacts states
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleContacts, setGoogleContacts] = useState([]);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [showContactSelection, setShowContactSelection] = useState(false);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [bulkGroupValue, setBulkGroupValue] = useState('');
  const [bulkCustomGroupName, setBulkCustomGroupName] = useState('');

  const importTabs = [
    { id: 'csv', label: t('import.csv'), icon: '📄' },
    { id: 'excel', label: t('import.excel'), icon: '📊' },
    { id: 'google', label: t('import.google'), icon: '📞' },
    { id: 'whatsapp', label: t('import.whatsapp'), icon: '💬' }
  ];

  // Checking Google connection status when opening the tab
  useEffect(() => {
    if (isOpen && activeTab === 'google') {
      checkGoogleConnectionStatus();
    }
  }, [isOpen, activeTab]);

  const checkGoogleConnectionStatus = async () => {
    setCheckingConnection(true);
    try {
      const isConnected = await googleContactsAPI.checkConnection();
      setGoogleConnected(isConnected);
    } catch (error) {
      console.error('Error checking Google connection:', error);
      setGoogleConnected(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleGoogleConnect = async () => {
    try {
      setLoading(true);
      setError('');
      
      await googleContactsAPI.signIn();
      setGoogleConnected(true);
      
    } catch (error) {
      console.error('❌ Google connect error:', error);
      setError(error.message || t('guests.errors.googleConnectionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGoogleContacts = async () => {
    try {
      setLoading(true);
      setError('');
      
      const contacts = await googleContactsAPI.getContacts();
      setGoogleContacts(contacts);
      setShowContactSelection(true);
      
    } catch (error) {
      console.error('Error loading Google contacts:', error);
      setError(error.message || t('guests.errors.googleContactsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await googleContactsAPI.signOut();
      setGoogleConnected(false);
      setGoogleContacts([]);
      setShowContactSelection(false);
      setShowGroupEditor(false);
      setPreviewData([]);
      setError('');
    } catch (error) {
      console.error('Google disconnect error:', error);
      setError(t('guests.errors.googleDisconnectFailed'));
    }
  };

  const handleContactSelection = (contactId, isSelected) => {
    setGoogleContacts(prev => 
      prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, selected: isSelected }
          : contact
      )
    );
  };

  const handleSelectAllContacts = (selectAll) => {
    setGoogleContacts(prev => 
      prev.map(contact => ({ ...contact, selected: selectAll }))
    );
  };

  const handleConfirmGoogleSelection = () => {
    const selectedContacts = googleContacts.filter(contact => contact.selected);
    if (selectedContacts.length > 0) {
      setShowContactSelection(false);
      setShowGroupEditor(true);
    }
  };

  // Update a group for a specific contact
  const handleContactGroupChange = (contactId, newGroup, customGroupName = '') => {
    setGoogleContacts(prev => 
      prev.map(contact => 
        contact.id === contactId 
          ? { 
              ...contact, 
              group: newGroup,
              customGroup: newGroup === 'custom' ? customGroupName : undefined
            }
          : contact
      )
    );
  };

  // Apply a group to all selected
  const handleBulkGroupChange = () => {
    if (!bulkGroupValue) return;

    const finalGroup = bulkGroupValue === 'custom' ? bulkCustomGroupName : bulkGroupValue;
    const finalCustomGroup = bulkGroupValue === 'custom' ? bulkCustomGroupName : undefined;

    setGoogleContacts(prev => 
      prev.map(contact => 
        contact.selected 
          ? { 
              ...contact, 
              group: finalGroup,
              customGroup: finalCustomGroup
            }
          : contact
      )
    );

    setBulkGroupValue('');
    setBulkCustomGroupName('');
  };

  const handleConfirmGroupEditor = () => {
    const selectedContacts = googleContacts.filter(contact => contact.selected);
    setPreviewData(selectedContacts);
    setShowGroupEditor(false);
  };

  const handleFileUpload = async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError('');
    setLoading(true);

    try {
      if (activeTab === 'excel') {
        await handleExcelFile(uploadedFile);
      } else if (activeTab === 'csv') {
        await handleCSVFile(uploadedFile);
      }
    } catch (err) {
      setError(t('guests.errors.fileProcessing'));
    } finally {
      setLoading(false);
    }
  };

  const handleCSVFile = async (file) => {
    const text = await file.text();
    setCsvData(text);
    parseCSVData(text);
  };

  const handleExcelFile = async (file) => {
    try {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs');
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvData = XLSX.utils.sheet_to_csv(firstSheet);
      
      setCsvData(csvData);
      parseCSVData(csvData);
    } catch (error) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          setCsvData(text);
          parseCSVData(text);
        } catch (err) {
          setError(t('guests.errors.excelNotSupported'));
        }
      };
      reader.readAsText(file);
    }
  };

  const parseCSVData = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 1) {
      setError(t('guests.errors.invalidFormat'));
      return;
    }

    const data = [];
    const firstLine = lines[0];
    
    const isHeader = firstLine.toLowerCase().includes('שם') || 
                    firstLine.toLowerCase().includes('name') ||
                    firstLine.toLowerCase().includes('טלפון') ||
                    firstLine.toLowerCase().includes('phone');

    const actualStartIndex = isHeader ? 1 : 0;

    for (let i = actualStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(/[,\t]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
      
      if (values.length === 1 && values[0].includes(' ')) {
        const spaceSplit = values[0].split(/\s+/);
        if (spaceSplit.length >= 2) {
          values[0] = spaceSplit[0];
          values[1] = spaceSplit.slice(1, -1).join(' ');
          values[2] = spaceSplit[spaceSplit.length - 1];
          
          if (spaceSplit.length > 3) {
            values[3] = spaceSplit[spaceSplit.length - 2];
            values[2] = spaceSplit[spaceSplit.length - 1];
          }
        }
      }

      if (values.length >= 1) {
        let guest = {
          firstName: '',
          lastName: '',
          phone: '',
          group: 'other'
        };

        if (values.length === 1) {
          const singleValue = values[0];
          if (/^05\d[\-\s]?\d{7}$/.test(singleValue.replace(/[\s\-]/g, ''))) {
            guest.phone = singleValue.replace(/[\s]/g, '').replace(/(\d{3})(\d{7})/, '$1-$2');
            guest.firstName = t('import.unknownContact');
            guest.lastName = '';
          } else {
            guest.firstName = singleValue;
            guest.lastName = '';
            guest.phone = '';
          }
        } else {
          guest.firstName = values[0] || '';
          guest.lastName = values[1] || '';
          guest.phone = values[2] || '';
          
          const groupValue = (values[3] || '').trim();
          
          if (['משפחה', 'family'].includes(groupValue.toLowerCase())) {
            guest.group = 'family';
          } else if (['חברים', 'friends'].includes(groupValue.toLowerCase())) {
            guest.group = 'friends';
          } else if (['עבודה', 'work'].includes(groupValue.toLowerCase())) {
            guest.group = 'work';
          } else if (['אחר', 'other'].includes(groupValue.toLowerCase()) || !groupValue) {
            guest.group = 'other';
          } else {
            guest.group = groupValue;
          }
          
          if (guest.phone) {
            guest.phone = guest.phone.replace(/[\s\-]/g, '');
            if (/^05\d{8}$/.test(guest.phone)) {
              guest.phone = guest.phone.replace(/(\d{3})(\d{7})/, '$1-$2');
            }
          }
        }
        
        if (guest.firstName || guest.phone) {
          data.push(guest);
        }
      }
    }

    if (data.length === 0) {
      setError(t('guests.errors.noValidData'));
      return;
    }

    setPreviewData(data.slice(0, 10));
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setError(t('guests.errors.noData'));
      return;
    }

    setLoading(true);
    try {
      await onImport(previewData);
      resetModal();
      onClose();
    } catch (err) {
      console.error('Import error in modal:', err);
      setError(t('guests.errors.importFailed'));
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setCsvData('');
    setFile(null);
    setPreviewData([]);
    setError('');
    setLoading(false);
    setGoogleConnected(false);
    setGoogleContacts([]);
    setCheckingConnection(false);
    setShowContactSelection(false);
    setShowGroupEditor(false);
    setBulkGroupValue('');
    setBulkCustomGroupName('');
  };

  const getGroupDisplayName = (group) => {
    if (['family', 'friends', 'work', 'other'].includes(group)) {
      return t(`guests.groups.${group}`);
    }
    return group;
  };

  if (!isOpen) return null;

  return (
    <div className="import-modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="import-modal-header">
          <h2>{t('import.title')}</h2>
          <button 
            className="import-modal-close" 
            onClick={() => {
              resetModal();
              onClose();
            }}
          >
            ✕
          </button>
        </div>

        <div className="import-modal-tabs">
          {importTabs.map(tab => (
            <button
              key={tab.id}
              className={`import-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                resetModal();
                if (tab.id === 'google') {
                  checkGoogleConnectionStatus();
                }
              }}
            >
              <span className="import-tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="import-modal-content">
          {error && (
            <div className="import-error">
              {error}
            </div>
          )}

          {/* CSV Tab */}
          {activeTab === 'csv' && (
            <div className="import-csv-section">
              <h3>{t('import.csv')}</h3>
              <p className="import-description">
                {t('import.csvDescription')}
              </p>
              
              <div className="import-options">
                <div className="import-option">
                  <label>{t('import.uploadFile')}</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="import-file-input"
                  />
                </div>

                <div className="import-divider">
                  <span>{t('common.or')}</span>
                </div>

                <div className="import-option">
                  <label>{t('import.pasteData')}</label>
                  <textarea
                    value={csvData}
                    onChange={(e) => {
                      setCsvData(e.target.value);
                      if (e.target.value.trim()) {
                        parseCSVData(e.target.value);
                      } else {
                        setPreviewData([]);
                      }
                    }}
                    placeholder={t('import.csvPlaceholder')}
                    className="import-textarea"
                    rows="8"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Excel Tab */}
          {activeTab === 'excel' && (
            <div className="import-excel-section">
              <h3>{t('import.excel')}</h3>
              <p className="import-description">
                {t('import.excelDescription')}
              </p>
              <div className="import-notice">
                <p>{t('import.excelNote')}</p>
              </div>
              
              <div className="import-option">
                <label>{t('import.uploadFile')}</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="import-file-input"
                />
              </div>
            </div>
          )}

          {/* Google Tab */}
          {activeTab === 'google' && (
            <div className="import-google-section">
              <h3>{t('import.google')}</h3>
              
              {checkingConnection && (
                <div className="google-status-checking">
                  <p>{t('common.loading')}...</p>
                </div>
              )}

              {!checkingConnection && !googleConnected && (
                <>
                  <div className="import-instructions">
                    <p><strong>{t('import.googleInstructions.title')}</strong></p>
                    <ol>
                      <li>{t('import.googleInstructions.step1')}</li>
                      <li>{t('import.googleInstructions.step2')}</li>
                      <li>{t('import.googleInstructions.step3')}</li>
                    </ol>
                  </div>
                  
                  <button 
                    onClick={handleGoogleConnect}
                    className="import-google-button"
                    disabled={loading}
                  >
                    {loading ? t('common.loading') : t('import.connectGoogle')}
                  </button>
                </>
              )}

              {!checkingConnection && googleConnected && !showContactSelection && !showGroupEditor && (
                <div className="google-connected-section">
                  <div className="google-status-connected">
                    <span className="success-icon">✅</span>
                    <p>{t('guests.googleConnected')}</p>
                  </div>
                  
                  <div className="google-actions">
                    <button 
                      onClick={handleLoadGoogleContacts}
                      className="import-google-button"
                      disabled={loading}
                    >
                      {loading ? t('common.loading') : t('import.loadContacts')}
                    </button>
                    
                    <button 
                      onClick={handleGoogleDisconnect}
                      className="import-google-disconnect-button"
                    >
                      {t('import.disconnectGoogle')}
                    </button>
                  </div>
                </div>
              )}

              {showContactSelection && (
                <div className="google-contact-selection">
                  <div className="contact-selection-header">
                    <h4>{t('import.selectContacts')} ({googleContacts.length} {t('import.contactsFound')})</h4>
                    <div className="contact-selection-actions">
                      <button 
                        onClick={() => handleSelectAllContacts(true)}
                        className="select-all-button"
                      >
                        {t('import.selectAll')}
                      </button>
                      <button 
                        onClick={() => handleSelectAllContacts(false)}
                        className="deselect-all-button"
                      >
                        {t('import.deselectAll')}
                      </button>
                    </div>
                  </div>

                  <div className="contact-selection-list">
                    {googleContacts.map(contact => (
                      <div key={contact.id} className="contact-selection-item">
                        <input
                          type="checkbox"
                          checked={contact.selected}
                          onChange={(e) => handleContactSelection(contact.id, e.target.checked)}
                          className="contact-checkbox"
                        />
                        <div className="contact-info">
                          <span className="contact-name">
                            {contact.firstName} {contact.lastName}
                          </span>
                          <span className="contact-phone">
                            {contact.phone}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="contact-selection-footer">
                    <button 
                      onClick={() => setShowContactSelection(false)}
                      className="cancel-selection-button"
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      onClick={handleConfirmGoogleSelection}
                      className="confirm-selection-button"
                      disabled={!googleContacts.some(c => c.selected)}
                    >
                      {t('import.googleInstructions.continueToGroups')} ({googleContacts.filter(c => c.selected).length})
                    </button>
                  </div>
                </div>
              )}

              {showGroupEditor && (
                <div className="google-group-editor">
                  <div className="group-editor-header">
                    <h4>{t('import.googleInstructions.editContactGroups')}</h4>
                    <p>{t('import.googleInstructions.editContactGroupsDescription')} ({googleContacts.filter(c => c.selected).length} {t('import.contacts')})</p>
                  </div>

                  {/* quick actions*/}
                  <div className="bulk-actions">
                    <h5>{t('import.googleInstructions.quickActions')}</h5>
                    <div className="bulk-actions-row">
                      <select
                        value={bulkGroupValue}
                        onChange={(e) => setBulkGroupValue(e.target.value)}
                        className="bulk-group-select"
                      >
                        <option value="">{t('import.googleInstructions.selectGroupForAll')}</option>
                        <option value="family">{t('guests.groups.family')}</option>
                        <option value="friends">{t('guests.groups.friends')}</option>
                        <option value="work">{t('guests.groups.work')}</option>
                        <option value="other">{t('guests.groups.other')}</option>
                        <option value="custom">{t('import.googleInstructions.customGroup')}</option>
                      </select>
                      
                      {bulkGroupValue === 'custom' && (
                        <input
                          type="text"
                          value={bulkCustomGroupName}
                          onChange={(e) => setBulkCustomGroupName(e.target.value)}
                          placeholder={t('guests.form.customGroupPlaceholder')}
                          className="bulk-custom-group-input"
                        />
                      )}
                      
                      <button
                        onClick={handleBulkGroupChange}
                        className="apply-bulk-button"
                        disabled={!bulkGroupValue || (bulkGroupValue === 'custom' && !bulkCustomGroupName.trim())}
                      >
                        {t('import.googleInstructions.applyToAll')}
                      </button>
                    </div>
                  </div>

                  {/* Individual editing */}
                  <div className="individual-editor">
                    <h5>{t('import.googleInstructions.individualEditing')}</h5>
                    <div className="contact-editor-list">
                      {googleContacts.filter(contact => contact.selected).map(contact => (
                        <div key={contact.id} className="contact-editor-item">
                          <div className="contact-editor-info">
                            <span className="contact-editor-name">
                              {contact.firstName} {contact.lastName}
                            </span>
                            <span className="contact-editor-phone">
                              {contact.phone}
                            </span>
                          </div>
                          <div className="contact-editor-group">
                            <select
                              value={contact.group === contact.customGroup ? 'custom' : contact.group}
                              onChange={(e) => {
                                if (e.target.value === 'custom') {
                                  handleContactGroupChange(contact.id, 'custom', contact.customGroup || '');
                                } else {
                                  handleContactGroupChange(contact.id, e.target.value);
                                }
                              }}
                              className="contact-group-select"
                            >
                              <option value="family">{t('guests.groups.family')}</option>
                              <option value="friends">{t('guests.groups.friends')}</option>
                              <option value="work">{t('guests.groups.work')}</option>
                              <option value="other">{t('guests.groups.other')}</option>
                              <option value="custom">{t('import.googleInstructions.customGroup')}</option>
                            </select>
                            
                            {(contact.group === contact.customGroup || contact.group === 'custom') && (
                              <input
                                type="text"
                                value={contact.customGroup || ''}
                                onChange={(e) => handleContactGroupChange(contact.id, 'custom', e.target.value)}
                                placeholder={t('guests.form.customGroupPlaceholder')}
                                className="contact-custom-group-input"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="group-editor-footer">
                    <button 
                      onClick={() => setShowGroupEditor(false)}
                      className="cancel-selection-button"
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      onClick={handleConfirmGroupEditor}
                      className="confirm-selection-button"
                    >
                      {t('import.googleInstructions.continueToPreview')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp Tab */}
          {activeTab === 'whatsapp' && (
            <div className="import-whatsapp-section">
              <h3>{t('import.whatsapp')}</h3>
              <div className="import-instructions">
                <p><strong>{t('import.whatsappInstructions.title')}</strong></p>
                <ol>
                  <li>{t('import.whatsappInstructions.step1')}</li>
                  <li>{t('import.whatsappInstructions.step2')}</li>
                  <li>{t('import.whatsappInstructions.step3')}</li>
                  <li>{t('import.whatsappInstructions.step4')}</li>
                </ol>
              </div>
              
              <button 
                onClick={() => setError(t('guests.errors.notImplemented'))}
                className="import-whatsapp-button"
                disabled={loading}
              >
                {loading ? t('common.loading') : t('import.selectWhatsappFile')}
              </button>
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && (
            <div className="import-preview">
              <h4>{t('import.preview')} ({previewData.length} {t('import.contacts')})</h4>
              <div className="import-preview-table">
                <div className="import-preview-header">
                  <span>{t('guests.form.firstName')}</span>
                  <span>{t('guests.form.lastName')}</span>
                  <span>{t('guests.form.phone')}</span>
                  <span>{t('guests.form.group')}</span>
                </div>
                {previewData.map((guest, index) => (
                  <div key={index} className="import-preview-row">
                    <span>{guest.firstName}</span>
                    <span>{guest.lastName}</span>
                    <span>{guest.phone}</span>
                    <span>{getGroupDisplayName(guest.customGroup || guest.group)}</span>
                  </div>
                ))}
                {previewData.length > 10 && (
                  <div className="import-preview-more">
                    {t('import.andMore', { count: previewData.length - 10 })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="import-modal-footer">
          <button 
            onClick={() => {
              resetModal();
              onClose();
            }}
            className="import-cancel-button"
          >
            {t('common.cancel')}
          </button>
          
          {previewData.length > 0 && (
            <button 
              onClick={handleImport}
              className="import-confirm-button"
              disabled={loading}
            >
              {loading ? t('common.loading') : `${t('import.importButton')} ${previewData.length} ${t('import.contacts')}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;