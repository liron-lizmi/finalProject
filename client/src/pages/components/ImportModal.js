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
  const [allImportData, setAllImportData] = useState([]); // נתונים מלאים לייבוא
  
  // Google Contacts states
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleContacts, setGoogleContacts] = useState([]);
  const [checkingConnection, setCheckingConnection] = useState(false);
  const [showContactSelection, setShowContactSelection] = useState(false);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [bulkGroupValue, setBulkGroupValue] = useState('');
  const [bulkCustomGroupName, setBulkCustomGroupName] = useState('');

  // VCF states
  const [vcfContacts, setVcfContacts] = useState([]);
  const [showVcfContactSelection, setShowVcfContactSelection] = useState(false);
  const [showVcfGroupEditor, setShowVcfGroupEditor] = useState(false);
  const [vcfBulkGroupValue, setVcfBulkGroupValue] = useState('');
  const [vcfBulkCustomGroupName, setVcfBulkCustomGroupName] = useState('');

  const importTabs = [
    { id: 'csv', label: t('import.csv'), icon: '📄' },
    { id: 'excel', label: t('import.excel'), icon: '📊' },
    { id: 'google', label: t('import.google'), icon: '📞' },
    { id: 'vcf', label: t('import.vcf'), icon: '📱' }
  ];

  // Improved QUOTED-PRINTABLE decoder
  const decodeQuotedPrintable = (str) => {
    if (!str || !str.includes('=')) return str;
    
    try {
      let processed = str.replace(/=\r?\n/g, '');

      processed = processed.replace(/=\s*$/gm, '');
      
      processed = processed.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
      });
      
      processed = processed.replace(/=(?![0-9A-F]{2})/gi, '');
      
      // Handle UTF-8 decoding properly
      try {
        const bytes = [];
        for (let i = 0; i < processed.length; i++) {
          const charCode = processed.charCodeAt(i);
          if (charCode <= 255) {
            bytes.push(charCode);
          } else {
            const utf8Bytes = new TextEncoder().encode(processed.charAt(i));
            bytes.push(...utf8Bytes);
          }
        }
        
        // Decode as UTF-8
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const result = decoder.decode(new Uint8Array(bytes));
        
        return result;
      } catch (utfError) {
        console.warn('UTF-8 decoding failed, returning processed string:', utfError);
        return processed;
      }
      
    } catch (error) {
      console.warn('Failed to decode quoted-printable:', str, error);
      return str;
    }
  };

  // Process VCF lines handling multi-line values
  const processVCFLines = (rawLines) => {
    const processedLines = [];
    let currentLine = '';

    for (const line of rawLines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith(' ') || trimmedLine.startsWith('\t') || 
          (currentLine && (trimmedLine.startsWith('=') || line.startsWith(' ') || line.startsWith('\t')))) {
        currentLine += trimmedLine.replace(/^[\s\t]/, '');
      } else {
        if (currentLine) {
          processedLines.push(currentLine);
        }
        currentLine = trimmedLine;
      }
    }
    
    // Add the last line
    if (currentLine) {
      processedLines.push(currentLine);
    }
    
    return processedLines;
  };

  // Validate phone number
  const validatePhoneNumber = (phone) => {
    if (!phone) return { valid: false, message: '' };
    
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    
    // Check for +972 format
    if (cleanPhone.startsWith('+972')) {
      if (cleanPhone.length === 13 && /^\+972[5]\d{8}$/.test(cleanPhone)) {
        const israeliNumber = '0' + cleanPhone.substring(4);
        return { valid: true, formatted: israeliNumber.substring(0, 3) + '-' + israeliNumber.substring(3) };
      }
      return { valid: false, message: t('import.errors.invalidPhoneFormat972') };
    }
    
    // Check for Israeli format
    if (cleanPhone.startsWith('05')) {
      if (cleanPhone.length === 10 && /^05\d{8}$/.test(cleanPhone)) {
        return { valid: true, formatted: cleanPhone.substring(0, 3) + '-' + cleanPhone.substring(3) };
      }
      return { valid: false, message: t('import.errors.invalidPhoneFormat05') };
    }
    
    return { valid: false, message: t('import.errors.invalidPhoneStart') };
  };

  // Check Google connection status when opening the tab
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
      setAllImportData([]);
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

  // VCF Contact Selection Functions
  const handleVcfContactSelection = (contactId, isSelected) => {
    setVcfContacts(prev => 
      prev.map(contact => 
        contact.id === contactId 
          ? { ...contact, selected: isSelected }
          : contact
      )
    );
  };

  const handleVcfSelectAllContacts = (selectAll) => {
    setVcfContacts(prev => 
      prev.map(contact => ({ ...contact, selected: selectAll }))
    );
  };

  const handleConfirmVcfSelection = () => {
    const selectedContacts = vcfContacts.filter(contact => contact.selected);
    if (selectedContacts.length > 0) {
      setShowVcfContactSelection(false);
      setShowVcfGroupEditor(true);
    }
  };

  // Update a group for a specific Google contact
  const handleContactGroupChange = (contactId, newGroup, customGroupName = '') => {
    setGoogleContacts(prev => 
      prev.map(contact => 
        contact.id === contactId 
          ? { 
              ...contact, 
              group: (newGroup === 'custom' || newGroup === 'other') ? (customGroupName || newGroup) : newGroup,
              customGroup: (newGroup === 'custom' || newGroup === 'other') ? customGroupName : undefined
            }
          : contact
      )
    );
  };

  // Apply a group to all selected Google contacts
  const handleBulkGroupChange = () => {
    if (!bulkGroupValue) return;

  const finalGroup = (bulkGroupValue === 'custom' || bulkGroupValue === 'other') ? bulkCustomGroupName : bulkGroupValue;
  const finalCustomGroup = (bulkGroupValue === 'custom' || bulkGroupValue === 'other') ? bulkCustomGroupName : undefined;

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
    setAllImportData(selectedContacts); // שמירת כל הנתונים
    setPreviewData(selectedContacts.slice(0, 10)); // תצוגה מקדימה של 10 הראשונים
    setShowGroupEditor(false);
  };

  // VCF Group Editor Functions
  const handleVcfContactGroupChange = (contactId, newGroup, customGroupName = '') => {
    setVcfContacts(prev => 
      prev.map(contact => 
        contact.id === contactId 
          ? { 
              ...contact, 
              group: (newGroup === 'custom' || newGroup === 'other') ? (customGroupName || newGroup) : newGroup,
              customGroup: (newGroup === 'custom' || newGroup === 'other') ? customGroupName : undefined
            }
          : contact
      )
    );
  };

  // Apply a group to all VCF contacts
  const handleVcfBulkGroupChange = () => {
    if (!vcfBulkGroupValue) return;

    const finalGroup = (vcfBulkGroupValue === 'custom' || vcfBulkGroupValue === 'other') ? vcfBulkCustomGroupName : vcfBulkGroupValue;
    const finalCustomGroup = (vcfBulkGroupValue === 'custom' || vcfBulkGroupValue === 'other') ? vcfBulkCustomGroupName : undefined;

    setVcfContacts(prev => 
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

    setVcfBulkGroupValue('');
    setVcfBulkCustomGroupName('');
  };

  const handleConfirmVcfGroupEditor = () => {
    const selectedContacts = vcfContacts.filter(contact => contact.selected);
    setAllImportData(selectedContacts); // שמירת כל הנתונים
    setPreviewData(selectedContacts.slice(0, 10)); // תצוגה מקדימה של 10 הראשונים
    setShowVcfGroupEditor(false);
  };

  // Parse VCF data with improved name handling
  const parseVCFData = (vcfText) => {
    
    const data = [];
    const invalidContacts = [];
    
    const cleanText = vcfText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const vcardBlocks = cleanText.split(/BEGIN:VCARD/i);
        
    for (let i = 1; i < vcardBlocks.length; i++) {
      const block = vcardBlocks[i];
      
      if (!block.includes('END:VCARD')) {
        continue;
      }

      const rawLines = block.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      const lines = processVCFLines(rawLines);
      
      let firstName = '';
      let lastName = '';
      let phone = '';
      let contactName = '';
      let hasInvalidPhone = false;
      let invalidPhoneDetails = '';

      lines.forEach(line => {
        
        // Handle full name (FN)
        if (line.startsWith('FN')) {
          let fullNameValue = '';
          
          const colonIndex = line.indexOf(':');
          if (colonIndex !== -1) {
            fullNameValue = line.substring(colonIndex + 1).trim();
          }
          
          // Decode QUOTED-PRINTABLE if needed
          if (line.includes('QUOTED-PRINTABLE')) {
            fullNameValue = decodeQuotedPrintable(fullNameValue);
          }
          
          if (fullNameValue) {
            contactName = fullNameValue;
            const nameParts = fullNameValue.split(' ').filter(part => part.length > 0);
            if (nameParts.length > 0) {
              firstName = nameParts[0];
              lastName = nameParts.slice(1).join(' ');
            }
          }
        }
        
        // Handle structured name (N)
        else if (line.startsWith('N')) {
          let nameValue = '';
          
          const colonIndex = line.indexOf(':');
          if (colonIndex !== -1) {
            nameValue = line.substring(colonIndex + 1).trim();
          }
          
          // Decode QUOTED-PRINTABLE if needed
          if (line.includes('QUOTED-PRINTABLE')) {
            nameValue = decodeQuotedPrintable(nameValue);
          }
          
          const nameParts = nameValue.split(';').map(part => part.trim());
          // Only use N if we don't have name from FN
          if (!firstName && !lastName && nameParts.length >= 2) {
            lastName = nameParts[0] || '';
            firstName = nameParts[1] || '';
            if (!contactName) {
              contactName = `${firstName} ${lastName}`.trim();
            }
          }
        }
        
        // Handle phone
        else if (line.startsWith('TEL')) {
          const phoneMatch = line.match(/:([+\d\s\-\(\)\*]+)/);
          if (phoneMatch && !phone) {
            const rawPhone = phoneMatch[1].trim();
            
            const phoneValidation = validatePhoneNumber(rawPhone);
            if (phoneValidation.valid) {
              phone = phoneValidation.formatted;
            } else {
              hasInvalidPhone = true;
              invalidPhoneDetails = `${rawPhone} - ${phoneValidation.message}`;
            }
          }
        }
      });

      // Add contact if we have name or phone
      if (firstName || lastName || contactName) {
        const displayName = contactName || `${firstName} ${lastName}`.trim() || t('import.unknownFirstName');
        
        if (hasInvalidPhone && !phone) {
          invalidContacts.push({
            name: displayName,
            phone: invalidPhoneDetails,
            reason: t('import.errors.invalidPhone')
          });
        } else {
          const contact = {
            id: `vcf-${i}`,
            firstName: firstName || t('import.unknownFirstName'),
            lastName: lastName || '',
            phone: phone || '',
            group: 'other',
            selected: false
          };
          
          data.push(contact);
        }
      }
    }

    // Show warning for invalid contacts but still show table
    if (invalidContacts.length > 0) {
      const errorMessages = invalidContacts.map(contact => 
        `${t('import.errors.contactInvalidPhone', { name: contact.name, phone: contact.phone })}`
      );
      setError(`${t('import.errors.invalidPhonesFound')}:\n${errorMessages.join('\n')}\n\n${t('import.errors.skippedInvalid')}`);
    }

    if (data.length === 0) {
      setError(t('import.errors.noValidData'));
      return;
    }

    setVcfContacts(data);
    setShowVcfContactSelection(true);
  };

  // Parse CSV data
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
      setError(t('import.errors.noValidData'));
      return;
    }

    // שמירת כל הנתונים וגם תצוגה מקדימה
    setAllImportData(data);
    setPreviewData(data.slice(0, 10));
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
      } else if (activeTab === 'vcf') {
        await handleVCFFile(uploadedFile);
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

  const handleVCFFile = async (file) => {
    try {
      const text = await file.text();
      parseVCFData(text);
    } catch (error) {
      setError(t('import.errors.vcfProcessingError'));
    }
  };

  const handleImport = async () => {
    // שימוש ב-allImportData במקום previewData
    const dataToImport = allImportData.length > 0 ? allImportData : previewData;
    
    if (dataToImport.length === 0) {
      setError(t('guests.errors.noData'));
      return;
    }

    setLoading(true);
    try {
      await onImport(dataToImport);
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
    setAllImportData([]); // איפוס גם של הנתונים המלאים
    setError('');
    setLoading(false);
    setGoogleConnected(false);
    setGoogleContacts([]);
    setCheckingConnection(false);
    setShowContactSelection(false);
    setShowGroupEditor(false);
    setBulkGroupValue('');
    setBulkCustomGroupName('');
    setVcfContacts([]);
    setShowVcfContactSelection(false);
    setShowVcfGroupEditor(false);
    setVcfBulkGroupValue('');
    setVcfBulkCustomGroupName('');
  };

  const getGroupDisplayName = (group) => {
    if (['family', 'friends', 'work', 'other'].includes(group)) {
      return t(`guests.groups.${group}`);
    }
    return group;
  };

  if (!isOpen) return null;

  // חישוב המספר הכולל לייבוא
  const totalImportCount = allImportData.length > 0 ? allImportData.length : previewData.length;

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
              {error.split('\n').map((line, index) => (
                <div key={index}>{line}</div>
              ))}
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
                        setAllImportData([]);
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
                      
                      {(bulkGroupValue === 'custom' || bulkGroupValue === 'other') && (
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
                        disabled={!bulkGroupValue || ((bulkGroupValue === 'custom' || bulkGroupValue === 'other') && !bulkCustomGroupName.trim())}
                      >
                        {t('import.googleInstructions.applyToAll')}
                      </button>
                    </div>
                  </div>

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
                                if (e.target.value === 'custom' || e.target.value === 'other') {
                                  handleContactGroupChange(contact.id, e.target.value, contact.customGroup || '');
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
                            
                            {(contact.group === contact.customGroup || contact.group === 'custom' || contact.group === 'other') && (
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

          {/* VCF Tab */}
          {activeTab === 'vcf' && (
            <div className="import-vcf-section">
              <h3>{t('import.vcf')}</h3>
              <div className="import-instructions">
                <p><strong>{t('import.vcfInstructions.title')}</strong></p>
                <ol>
                  <li>{t('import.vcfInstructions.step1')}</li>
                  <li>{t('import.vcfInstructions.step2')}</li>
                  <li>{t('import.vcfInstructions.step3')}</li>
                  <li>{t('import.vcfInstructions.step4')}</li>
                  <li>{t('import.vcfInstructions.step5')}</li>
                </ol>
              </div>
              
              <div className="import-option">
                <label>{t('import.uploadFile')}</label>
                <input
                  type="file"
                  accept=".vcf,.txt"
                  onChange={handleFileUpload}
                  className="import-file-input"
                />
              </div>

              {/* VCF Contact Selection */}
              {showVcfContactSelection && (
                <div className="vcf-contact-selection">
                  <div className="contact-selection-header">
                    <h4>{t('import.selectContacts')} ({vcfContacts.length} {t('import.contactsFound')})</h4>
                    <div className="contact-selection-actions">
                      <button 
                        onClick={() => handleVcfSelectAllContacts(true)}
                        className="select-all-button"
                      >
                        {t('import.selectAll')}
                      </button>
                      <button 
                        onClick={() => handleVcfSelectAllContacts(false)}
                        className="deselect-all-button"
                      >
                        {t('import.deselectAll')}
                      </button>
                    </div>
                  </div>

                  <div className="contact-selection-list">
                    {vcfContacts.map(contact => (
                      <div key={contact.id} className="contact-selection-item">
                        <input
                          type="checkbox"
                          checked={contact.selected}
                          onChange={(e) => handleVcfContactSelection(contact.id, e.target.checked)}
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
                      onClick={() => setShowVcfContactSelection(false)}
                      className="cancel-selection-button"
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      onClick={handleConfirmVcfSelection}
                      className="confirm-selection-button"
                      disabled={!vcfContacts.some(c => c.selected)}
                    >
                      {t('import.googleInstructions.continueToGroups')} ({vcfContacts.filter(c => c.selected).length})
                    </button>
                  </div>
                </div>
              )}

              {/* VCF Group Editor */}
              {showVcfGroupEditor && (
                <div className="vcf-group-editor">
                  <div className="group-editor-header">
                    <h4>{t('import.vcfInstructions.editContactGroups')}</h4>
                    <p>{t('import.vcfInstructions.editContactGroupsDescription')} ({vcfContacts.filter(c => c.selected).length} {t('import.contacts')})</p>
                  </div>

                  <div className="bulk-actions">
                    <h5>{t('import.googleInstructions.quickActions')}</h5>
                    <div className="bulk-actions-row">
                      <select
                        value={vcfBulkGroupValue}
                        onChange={(e) => setVcfBulkGroupValue(e.target.value)}
                        className="bulk-group-select"
                      >
                        <option value="">{t('import.googleInstructions.selectGroupForAll')}</option>
                        <option value="family">{t('guests.groups.family')}</option>
                        <option value="friends">{t('guests.groups.friends')}</option>
                        <option value="work">{t('guests.groups.work')}</option>
                        <option value="other">{t('guests.groups.other')}</option>
                        <option value="custom">{t('import.googleInstructions.customGroup')}</option>
                      </select>
                      
                      {(vcfBulkGroupValue === 'custom' || vcfBulkGroupValue === 'other') && (
                        <input
                          type="text"
                          value={vcfBulkCustomGroupName}
                          onChange={(e) => setVcfBulkCustomGroupName(e.target.value)}
                          placeholder={t('guests.form.customGroupPlaceholder')}
                          className="bulk-custom-group-input"
                        />
                      )}

                      <button
                        onClick={handleVcfBulkGroupChange}
                        className="apply-bulk-button"
                        disabled={!vcfBulkGroupValue || ((vcfBulkGroupValue === 'custom' || vcfBulkGroupValue === 'other') && !vcfBulkCustomGroupName.trim())}
                      >
                        {t('import.googleInstructions.applyToAll')}
                      </button>
                    </div>
                  </div>

                  <div className="individual-editor">
                    <h5>{t('import.googleInstructions.individualEditing')}</h5>
                    <div className="contact-editor-list">
                      {vcfContacts.filter(contact => contact.selected).map(contact => (
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
                                if (e.target.value === 'custom' || e.target.value === 'other') {
                                  handleVcfContactGroupChange(contact.id, e.target.value, contact.customGroup || '');
                                } else {
                                  handleVcfContactGroupChange(contact.id, e.target.value);
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
                            
                            {(contact.group === contact.customGroup || contact.group === 'custom' || contact.group === 'other') && (
                              <input
                                type="text"
                                value={contact.customGroup || ''}
                                onChange={(e) => handleVcfContactGroupChange(contact.id, 'custom', e.target.value)}
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
                      onClick={() => setShowVcfGroupEditor(false)}
                      className="cancel-selection-button"
                    >
                      {t('common.cancel')}
                    </button>
                    <button 
                      onClick={handleConfirmVcfGroupEditor}
                      className="confirm-selection-button"
                    >
                      {t('import.googleInstructions.continueToPreview')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && !showVcfGroupEditor && !showVcfContactSelection && !showGroupEditor && !showContactSelection && (
            <div className="import-preview">
              <h4>{t('import.preview')} ({totalImportCount} {t('import.contacts')})</h4>
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
                {totalImportCount > 10 && (
                  <div className="import-preview-more">
                    {t('import.andMore', { count: totalImportCount - 10 })}
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
          
          {totalImportCount > 0 && !showVcfGroupEditor && !showVcfContactSelection && !showGroupEditor && !showContactSelection && (
            <button 
              onClick={handleImport}
              className="import-confirm-button"
              disabled={loading}
            >
              {loading ? t('common.loading') : `${t('import.importButton')} ${totalImportCount} ${t('import.contacts')}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;