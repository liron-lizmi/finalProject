// client/src/hooks/useModal.js
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const useModal = () => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const showSuccessModal = (message) => {
    setModalMessage(message);
    setModalType('success');
    setShowModal(true);
  };

  const showErrorModal = (message) => {
    setModalMessage(message);
    setModalType('error');
    setShowModal(true);
  };

  const showConfirmModal = (message, onConfirm) => {
    setModalMessage(message);
    setModalType('confirm');
    setConfirmAction(() => onConfirm);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMessage('');
    setModalType('');
    setConfirmAction(null);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      confirmAction();
    }
    closeModal();
  };


  const ModalComponent = showModal ? (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target.className === 'modal-overlay') {
        closeModal();
      }
    }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>
            {modalType === 'success' && '✅ '}
            {modalType === 'error' && '❌ '}
            {modalType === 'confirm' && '⚠️ '}
            {modalType === 'success' && t('general.success')}
            {modalType === 'error' && t('general.error')}
            {modalType === 'confirm' && t('general.confirm')}
          </h3>
          <button className="modal-close" onClick={closeModal}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <p>{modalMessage}</p>
        </div>
        <div className="modal-footer">
          {modalType === 'confirm' ? (
            <>
              <button className="modal-btn cancel" onClick={closeModal}>
                {t('general.cancel')}
              </button>
              <button className="modal-btn delete" onClick={handleConfirm}>
                {t('general.confirm')}
              </button>
            </>
          ) : (
            <button className="modal-btn cancel" onClick={closeModal}>
              {t('general.dismiss')}
            </button>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return {
    showSuccessModal,
    showErrorModal,
    showConfirmModal,
    closeModal,
    Modal: ModalComponent
  };
};