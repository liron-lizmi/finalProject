import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';
import { 
  FaChevronDown,
  FaGlassCheers,
  FaRing,
  FaBirthdayCake,
  FaBuilding
} from 'react-icons/fa';

const HomePage = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const featuresRef = useRef([]);
  const stepsRef = useRef([]);

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
      
      // Add visible class to features when scrolled into view
      featuresRef.current.forEach(el => {
        if (el && isElementInViewport(el)) {
          el.classList.add('visible');
        }
      });
      
      // Add visible class to steps when scrolled into view
      stepsRef.current.forEach(el => {
        if (el && isElementInViewport(el)) {
          el.classList.add('visible');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    // Initial check for elements in viewport
    setTimeout(() => {
      handleScroll();
    }, 300);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Check if element is in viewport
  const isElementInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.85 &&
      rect.bottom >= 0
    );
  };

  // Smooth scroll to section
  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Redirect to login page (for all feature buttons)
  const redirectToLogin = (e) => {
    e.preventDefault(); // Prevent default anchor behavior
    navigate('/login');
  };

  return (
    <div className="homepage-container">
      {/* Header */}
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <img src="/images/logo.png" alt="PlanIt Logo" className="logo" />
        <nav>
          <button className="btn" onClick={() => navigate('/register')}>הירשם</button>
          <button className="btn" onClick={() => navigate('/login')}>התחבר</button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="text-gradient">PlanIt</h1>
          <p className="subheader">הפכו את האירוע שלכם לחוויה בלתי נשכחת עם הכלים המתקדמים ביותר לתכנון וניהול אירועים</p>
          <button className="btn cta" onClick={() => navigate('/login')}>התחל לתכנן את האירוע שלך</button>
        </div>
        <div className="scroll-indicator" onClick={() => scrollToSection('event-types')}>
          <FaChevronDown />
        </div>
      </section>

      {/* Event Types Section */}
      <section id="event-types" className="section section-light event-definition">
        <h2 className="section-title">האירוע שלך, בדרך שלך</h2>
        <p className="section-description">
          בין אם אתם מתכננים חתונה מפוארת, אירוע עסקי, או מסיבת יום הולדת אינטימית,
          הפלטפורמה שלנו מותאמת לכל סוגי האירועים ולכל גודל תקציב.
        </p>
        
        <div className="event-types">
          <div className="event-type">
            <div className="event-icon">
              <FaRing />
            </div>
            <h3>חתונות</h3>
            <p>תכנון מושלם ליום המיוחד שלכם</p>
          </div>
          <div className="event-type">
            <div className="event-icon">
              <FaBuilding />
            </div>
            <h3>אירועים עסקיים</h3>
            <p>כנסים, אירועי חברה והשקות מוצרים</p>
          </div>
          <div className="event-type">
            <div className="event-icon">
              <FaBirthdayCake />
            </div>
            <h3>יום הולדת</h3>
            <p>חגיגות בלתי נשכחות לכל גיל</p>
          </div>
          <div className="event-type">
            <div className="event-icon">
              <FaGlassCheers />
            </div>
            <h3>אירועים פרטיים</h3>
            <p>בר/בת מצווה, אירוסין ומסיבות</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section section-dark features-section">
        <h2 className="section-title">כלים מתקדמים לתכנון אירועים</h2>
        <p className="section-description">
          הפלטפורמה שלנו מציעה מגוון כלים חכמים שיסייעו לך בכל שלב מתכנון האירוע ועד לניהולו בזמן אמת.
        </p>
        
        <div className="feature" ref={el => featuresRef.current[0] = el}>
          <div className="feature-text">
            <h3>בחירת מקום מושלם</h3>
            <p>
              מצא את המקום האידיאלי לאירוע שלך עם סינון חכם לפי מיקום, תקציב, קיבולת אורחים ואווירה. 
              גלה אולמות, גני אירועים ומקומות ייחודיים שמתאימים בדיוק לדרישות שלך, קבל המלצות מותאמות אישית,
              והשווה אפשרויות שונות במקום אחד.
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>גלה מקומות</a>
          </div>
          <div className="feature-image">
            <img src="/images/image1.png" alt="בחירת מקום מושלם" />
          </div>
        </div>
        
        <div className="feature feature-odd" ref={el => featuresRef.current[1] = el}>
          <div className="feature-text">
            <h3>ניהול ספקים חכם</h3>
            <p>
              נהל את כל הספקים שלך במקום אחד - מוזיקה, קייטרינג, צילום, עיצוב ועוד. 
              השווה הצעות מחיר, שמור מסמכים חשובים ונהל תקשורת יעילה מול כל הגורמים המעורבים.
              המערכת מתריעה על תאריכי יעד חשובים ומסייעת לך לעקוב אחר התקדמות התכנון.
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>נהל ספקים</a>
          </div>
          <div className="feature-image">
            <img src="/images/image2.png" alt="ניהול ספקים חכם" />
          </div>
        </div>
        
        <div className="feature" ref={el => featuresRef.current[2] = el}>
          <div className="feature-text">
            <h3>רשימת מוזמנים חכמה</h3>
            <p>
              נהל רשימות מוזמנים בקלות, שלח הזמנות דיגיטליות מותאמות אישית ועקוב אחר אישורי הגעה בזמן אמת. 
              הכלי החכם שלנו מסייע לך לשמור על קשר עם האורחים לפני ואחרי האירוע, לאסוף העדפות תפריט, 
              ולנהל אירועים נלווים כמו מסיבת רווקות או חינה.
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>נהל מוזמנים</a>
          </div>
          <div className="feature-image">
            <img src="/images/image3.png" alt="רשימת מוזמנים חכמה" />
          </div>
        </div>
        
        <div className="feature feature-odd" ref={el => featuresRef.current[3] = el}>
          <div className="feature-text">
            <h3>סידורי הושבה אינטואיטיביים</h3>
            <p>
              אלגוריתם AI לסידור מושבים אופטימלי לאורחים שלך, המתחשב בדינמיקות משפחתיות, העדפות אישיות וצרכים מיוחדים. 
              הממשק האינטראקטיבי מאפשר לך לתכנן ולשנות סידורי ישיבה בקלות, לשתף עם בני משפחה לקבלת משוב,
              ולייצא תרשימים מפורטים לספקים.
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>תכנן סידורי ישיבה</a>
          </div>
          <div className="feature-image">
            <img src="/images/image4.png" alt="סידורי הושבה אינטואיטיביים" />
          </div>
        </div>
        
        <div className="feature" ref={el => featuresRef.current[4] = el}>
          <div className="feature-text">
            <h3>ניהול לו"ז מדויק</h3>
            <p>
              תכנן את האירוע שלך עם לו"ז חכם לכל שלב. קבל התראות על מועדי תשלום, פגישות עם ספקים ומשימות חשובות. 
              הכלי שלנו מוודא שלא תפספס אף פרט חשוב בדרך לאירוע המושלם, מציע תבניות מוכנות מראש להתנהלות יעילה,
              ומאפשר שיתוף לו"ז עם המשפחה או מתכנן אירועים מקצועי.
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>נהל לו"ז</a>
          </div>
          <div className="feature-image">
            <img src="/images/image5.png" alt="ניהול לו״ז מדויק" />
          </div>
        </div>
        
        <div className="feature feature-odd" ref={el => featuresRef.current[5] = el}>
          <div className="feature-text">
            <h3>ניהול תקציב חכם</h3>
            <p>
              עקוב אחר התקציב שלך והוצאות האירוע בזמן אמת. הכלי החכם שלנו עוזר לך להתמקד במה שחשוב באמת, 
              לזהות מקומות לחסוך ולוודא שתישאר במסגרת התקציב שהגדרת. קבל תובנות לגבי דפוסי הוצאה, השווה בין הצעות מחיר,
              וקבל התראות כשמתקרבים למגבלות תקציב.
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>נהל תקציב</a>
          </div>
          <div className="feature-image">
            <img src="/images/image6.png" alt="ניהול תקציב חכם" />
          </div>
        </div>
      </section>

      {/* Planning Steps Section */}
      <section id="process" className="section section-light">
        <h2 className="section-title">תהליך תכנון פשוט ואפקטיבי</h2>
        <p className="section-description">
          מהרעיון הראשוני ועד ליום האירוע, מערכת PlanIt מלווה אותך בכל צעד בדרך
        </p>
        
        <div className="planning-steps">
          <div className="step" ref={el => stepsRef.current[0] = el}>
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>הגדרת האירוע</h3>
              <p>
                צור חשבון ב-PlanIt והגדר את סוג האירוע, התאריך, מספר המוזמנים והתקציב.
                המערכת תתאים את עצמה לצרכים הספציפיים שלך ותיצור תוכנית עבודה אישית.
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[1] = el}>
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>בחירת מקום וספקים</h3>
              <p>
                המערכת תציע לך אפשרויות מותאמות אישית למקומות וספקים המתאימים לדרישות ולתקציב שלך.
                תוכל להשוות מחירים, לקרוא חוות דעת, ולקבל החלטות מושכלות במקום אחד.
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[2] = el}>
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>ניהול הזמנות ואורחים</h3>
              <p>
                שליחת הזמנות דיגיטליות מעוצבות, מעקב אחר אישורי הגעה, וניהול הערות מיוחדות כמו העדפות תפריט או צרכים מיוחדים.
                המערכת מרכזת את כל המידע במקום אחד ומאפשרת תקשורת קלה עם האורחים.
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[3] = el}>
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>תכנון סופי ולוגיסטיקה</h3>
              <p>
                עיצוב סידורי הישיבה, תיאום סופי עם ספקים ובניית לוח זמנים מפורט ליום האירוע. המערכת מוודאת שכל הפרטים הקטנים
                מטופלים ושהכל מוכן ליום הגדול.
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[4] = el}>
            <div className="step-number">5</div>
            <div className="step-content">
              <h3>ניהול האירוע בזמן אמת</h3>
              <p>
                קבל גישה לכל הנתונים החשובים ביום האירוע, שתף משימות עם אנשי צוות, ותעד רגעים מיוחדים ביומן האירוע הדיגיטלי.
                גם אחרי האירוע, תוכל לשלוח תודות לאורחים ולספקים ולסכם את האירוע המוצלח שלך.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="section testimonials-section">
        <h2 className="section-title">לקוחות מספרים</h2>
        <div className="testimonial-container">
          <div className="testimonial">
            <p className="testimonial-text">
              "PlanIt פשוט שינה את כל חווית תכנון החתונה שלנו. במקום לחץ ודאגות, יכולנו באמת ליהנות מהתהליך. הכלים לניהול תקציב ורשימת מוזמנים חסכו לנו המון זמן וכסף, וביום האירוע הכל התנהל בצורה מושלמת!"
            </p>
            <p className="testimonial-author">רונית ודן</p>
            <p className="testimonial-role">חתונה בגן אירועים, יוני 2024</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2 className="cta-title">מוכנים להתחיל?</h2>
        <p className="cta-description">
          פתחו חשבון חינמי והתחילו לתכנן את האירוע המושלם שלכם כבר היום!
        </p>
        <button className="cta-button" onClick={() => navigate('/register')}>צור חשבון חדש</button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <img src="/images/logo.png" alt="PlanIt Logo" className="footer-logo" />
        <p className="footer-description">
          PlanIt הוא הפתרון המושלם לתכנון וניהול אירועים מוצלחים. אנו מחויבים לעזור לך להפוך את החזון שלך למציאות.
        </p>
        <div className="footer-links">
          <a href="#" className="footer-link">אודות</a>
          <a href="#" className="footer-link">שירותים</a>
          <a href="#" className="footer-link">בלוג</a>
          <a href="#" className="footer-link">צור קשר</a>
          <a href="#" className="footer-link">תנאי שימוש</a>
          <a href="#" className="footer-link">מדיניות פרטיות</a>
        </div>
        <p className="copyright">כל הזכויות שמורות © 2025 PlanIt</p>
      </footer>
    </div>
  );
};

export default HomePage;