import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ImportModal.css';

const ImportModal = ({ isOpen, onClose, onImport, eventId }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('csv');
  const [csvData, setCsvData] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState([]);

  const importTabs = [
    { id: 'csv', label: t('import.csv'), icon: '📄' },
    { id: 'excel', label: t('import.excel'), icon: '📊' },
    { id: 'google', label: t('import.google'), icon: '📞' },
    { id: 'whatsapp', label: t('import.whatsapp'), icon: '💬' }
  ];

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
      setError(t('import.errors.fileProcessing'));
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
      // Import SheetJS dynamically only when needed
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs');
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const csvData = XLSX.utils.sheet_to_csv(firstSheet);
      
      setCsvData(csvData);
      parseCSVData(csvData);
    } catch (error) {
      // אם XLSX לא זמין, נשתמש ב-FileReader כ-fallback
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // ננסה לקרוא כטקסט (אם זה CSV disguised as Excel)
          const text = e.target.result;
          setCsvData(text);
          parseCSVData(text);
        } catch (err) {
          setError(t('import.errors.excelNotSupported'));
        }
      };
      reader.readAsText(file);
    }
  };

  const parseCSVData = (csvText) => {
    console.log('Parsing CSV data:', csvText);
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 1) {
      setError(t('import.errors.invalidFormat'));
      return;
    }

    const data = [];

    // אם יש רק שורה אחת, נתייחס אליה כנתונים (לא כהדרים)
    const startIndex = lines.length === 1 ? 0 : 1;
    const firstLine = lines[0];
    
    // בדיקה אם השורה הראשונה נראית כמו הדרים
    const isHeader = firstLine.toLowerCase().includes('שם') || 
                    firstLine.toLowerCase().includes('name') ||
                    firstLine.toLowerCase().includes('טלפון') ||
                    firstLine.toLowerCase().includes('phone');

    const actualStartIndex = isHeader ? 1 : 0;
    console.log('Is header detected:', isHeader, 'Starting from line:', actualStartIndex);

    for (let i = actualStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      console.log('Processing line:', line);
      
      // תמיכה בפסיקים רגילים ובפסיקים מתוך Excel
      const values = line.split(/[,\t]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
      console.log('Split values:', values);
      
      // אם יש רק ערך אחד, ננסה לפצל לפי רווחים
      if (values.length === 1 && values[0].includes(' ')) {
        const spaceSplit = values[0].split(/\s+/);
        if (spaceSplit.length >= 2) {
          values[0] = spaceSplit[0]; // שם פרטי
          values[1] = spaceSplit.slice(1, -1).join(' '); // שם משפחה
          values[2] = spaceSplit[spaceSplit.length - 1]; // טלפון (הערך האחרון)
          
          // אם יש יותר מ-3 ערכים בפיצול רווחים, הרביעי יהיה הקבוצה
          if (spaceSplit.length > 3) {
            values[3] = spaceSplit[spaceSplit.length - 2]; // הערך הלפני האחרון הוא הקבוצה
            values[2] = spaceSplit[spaceSplit.length - 1]; // הערך האחרון הוא הטלפון
          }
        }
        console.log('Space split result:', values);
      }

      if (values.length >= 1) {
        let guest = {
          firstName: '',
          lastName: '',
          phone: '',
          group: 'other'
        };

        // אם יש רק ערך אחד, ננסה לזהות אם זה טלפון או שם
        if (values.length === 1) {
          const singleValue = values[0];
          if (/^05\d[\-\s]?\d{7}$/.test(singleValue.replace(/[\s\-]/g, ''))) {
            // זה נראה כמו טלפון
            guest.phone = singleValue.replace(/[\s]/g, '').replace(/(\d{3})(\d{7})/, '$1-$2');
            guest.firstName = t('import.unknownContact');
            guest.lastName = '';
          } else {
            // זה נראה כמו שם
            guest.firstName = singleValue;
            guest.lastName = '';
            guest.phone = '';
          }
        } else {
          // יש מספר ערכים
          guest.firstName = values[0] || '';
          guest.lastName = values[1] || '';
          guest.phone = values[2] || '';
          
          // עיבוד קבוצות - תמיכה מלאה בקבוצות מותאמות
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
            // זו קבוצה מותאמת - שמור את השם המדויק כפי שהמשתמש רשם
            guest.group = groupValue;
          }
          
          console.log('Group processing:', values[3], '->', guest.group);
          
          // תיקון פורמט טלפון
          if (guest.phone) {
            guest.phone = guest.phone.replace(/[\s\-]/g, '');
            if (/^05\d{8}$/.test(guest.phone)) {
              guest.phone = guest.phone.replace(/(\d{3})(\d{7})/, '$1-$2');
            }
          }
        }
        
        console.log('Created guest object:', guest);
        
        // בדיקה שיש לפחות שם פרטי או טלפון
        if (guest.firstName || guest.phone) {
          data.push(guest);
        }
      }
    }

    console.log('Final parsed data:', data);

    if (data.length === 0) {
      setError(t('import.errors.noValidData'));
      return;
    }

    setPreviewData(data.slice(0, 10)); // תצוגה מקדימה של 10 הראשונים
  };

  const handleManualCSV = () => {
    if (!csvData.trim()) {
      setError(t('import.errors.emptyData'));
      return;
    }
    parseCSVData(csvData);
  };

  const handleGoogleContacts = () => {
    // יתממש בהמשך - אינטגרציה עם Google Contacts API
    setError(t('import.errors.notImplemented'));
  };

  const handleWhatsAppImport = () => {
    // יתממש בהמשך - הוראות לייצוא מ-WhatsApp
    setError(t('import.errors.notImplemented'));
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setError(t('import.errors.noData'));
      return;
    }

    console.log('Starting import with data:', previewData);
    setLoading(true);
    try {
      await onImport(previewData);
      resetModal();
      onClose();
    } catch (err) {
      console.error('Import error in modal:', err);
      setError(t('import.errors.importFailed'));
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
  };

  // פונקציה לקבלת שם הקבוצה לתצוגה בתצוגה המקדימה
  const getGroupDisplayName = (group) => {
    if (['family', 'friends', 'work', 'other'].includes(group)) {
      return t(`guests.groups.${group}`);
    }
    // אם זו קבוצה מותאמת, החזר את השם כפי שהוא
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
                      // עיבוד אוטומטי של הנתונים כשהמשתמש מקליד
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

          {activeTab === 'google' && (
            <div className="import-google-section">
              <h3>{t('import.google')}</h3>
              <p className="import-description">
                {t('import.googleDescription')}
              </p>
              
              <button 
                onClick={handleGoogleContacts}
                className="import-google-button"
              >
                {t('import.connectGoogle')}
              </button>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="import-whatsapp-section">
              <h3>{t('import.whatsapp')}</h3>
              <div className="import-instructions">
                <p>{t('import.whatsappInstructions.title')}</p>
                <ol>
                  <li>{t('import.whatsappInstructions.step1')}</li>
                  <li>{t('import.whatsappInstructions.step2')}</li>
                  <li>{t('import.whatsappInstructions.step3')}</li>
                  <li>{t('import.whatsappInstructions.step4')}</li>
                </ol>
              </div>
              
              <button 
                onClick={handleWhatsAppImport}
                className="import-whatsapp-button"
              >
                {t('import.selectWhatsappFile')}
              </button>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="import-preview">
              <h4>{t('import.preview')} ({previewData.length} {t('import.contacts')})</h4>
              <div className="import-preview-table">
                <div className="import-preview-header">
                  <span>{t('guests.form.firstName')}</span>
                  <span>{t('guests.form.lastName')}</span>
                  <span>{t('guests.form.phone')}</span>
                  <span>{t('form.group')}</span>
                </div>
                {previewData.map((guest, index) => (
                  <div key={index} className="import-preview-row">
                    <span>{guest.firstName}</span>
                    <span>{guest.lastName}</span>
                    <span>{guest.phone}</span>
                    <span>{getGroupDisplayName(guest.group)}</span>
                  </div>
                ))}
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