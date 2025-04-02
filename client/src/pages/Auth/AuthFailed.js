// AuthFailed.js
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthFailed = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const reason = searchParams.get('reason');

  let errorMessage = 'אירעה שגיאה במהלך תהליך ההתחברות. אנא נסה שוב או התחבר באמצעות אימייל וסיסמה.';
  
  if (reason === 'user_not_exists') {
    errorMessage = 'יש להירשם לאתר תחילה כדי להתחבר באמצעות Google.';
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>שגיאת התחברות</h2>
        <div className="error-message">
          {errorMessage}
        </div>
        <div className="auth-buttons-container">
          {reason === 'user_not_exists' ? (
            <>
              <button 
                onClick={() => navigate('/register')} 
                className="auth-button"
                style={{ marginTop: '20px', marginBottom: '10px' }}
              >
                עבור לדף ההרשמה
              </button>
              <button 
                onClick={() => navigate('/login')} 
                className="auth-button secondary"
                style={{ marginBottom: '20px', background: '#f5f5f5', color: '#333', border: '1px solid #ddd' }}
              >
                חזור לדף ההתחברות
              </button>
            </>
          ) : (
            <button 
              onClick={() => navigate('/login')} 
              className="auth-button"
              style={{ marginTop: '20px', marginBottom: '10px' }}
            >
              חזור לדף ההתחברות
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthFailed;