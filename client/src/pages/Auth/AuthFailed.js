import React from 'react';
import { useNavigate } from 'react-router-dom';

const AuthFailed = () => {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>שגיאת התחברות</h2>
        <div className="error-message">
          אירעה שגיאה במהלך תהליך ההתחברות. אנא נסה שוב או התחבר באמצעות אימייל וסיסמה.
        </div>
        <button 
          onClick={() => navigate('/login')} 
          className="auth-button"
          style={{ marginTop: '20px' }}
        >
          חזור לדף ההתחברות
        </button>
      </div>
    </div>
  );
};

export default AuthFailed;