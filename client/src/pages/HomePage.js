/**
 * HomePage.js - Landing Page
 *
 * Public landing page showcasing PlanIt features and encouraging sign-up.
 *
 * Sections:
 * - Header: Logo, language switcher (HE/EN), signup/login buttons
 * - Hero: App name, tagline, CTA button
 * - Event Types: Wedding, Business, Birthday, Private events
 * - Features: Venue, Vendors, Guests, Seating, Timeline, Budget
 * - Planning Steps: 5-step process overview
 * - Testimonials: Auto-rotating customer quotes (4 testimonials, 10s interval)
 * - CTA: Final call-to-action for registration
 * - Footer: Logo, description, copyright
 *
 * Features:
 * - Scroll animations for features and steps (fade-in on viewport)
 * - Sticky header that changes style on scroll
 * - Smooth scroll to sections
 * - Language switching (Hebrew/English)
 * - RTL/LTR support based on language
 */

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
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';

const HomePage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const featuresRef = useRef([]);
  const stepsRef = useRef([]);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    document.documentElement.dir = i18n.dir();
    document.documentElement.lang = i18n.language;
    
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
      
      featuresRef.current.forEach(el => {
        if (el && isElementInViewport(el)) {
          el.classList.add('visible');
        }
      });
      
      stepsRef.current.forEach(el => {
        if (el && isElementInViewport(el)) {
          el.classList.add('visible');
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    setTimeout(() => {
      handleScroll();
    }, 300);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [i18n.language, i18n.dir]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial(prev => prev === 3 ? 0 : prev + 1);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const isElementInViewport = (el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.85 &&
      rect.bottom >= 0
    );
  };

  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const redirectToLogin = (e) => {
    e.preventDefault(); 
    navigate('/login');
  };

  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
  };

  return (
    <div className="homepage-container">
      {/* Header */}
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <img src="/images/logo.png" alt={t('general.appLogo')} className="logo" />
        <nav>
          <div className="language-selector">
            <span 
              className={`language-option ${i18n.language === 'he' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('he')}
            >
              {t('general.Hebrew')}
            </span>
            <span className="language-separator">|</span>
            <span 
              className={`language-option ${i18n.language === 'en' ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              {t('general.English')}
            </span>
          </div>
          <button className="btn" onClick={() => navigate('/register')}>{t('general.signup')}</button>
          <button className="btn" onClick={() => navigate('/login')}>{t('general.login')}</button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="text-gradient">PlanIt</h1>
          <p className="subheader">{t('home.hero.subtitle')}</p>
          <button className="btn cta" onClick={() => navigate('/login')}>{t('home.hero.cta')}</button>
        </div>
        <div className="scroll-indicator" onClick={() => scrollToSection('event-types')}>
          <FaChevronDown />
        </div>
      </section>

      {/* Event Types Section */}
      <section id="event-types" className="section section-light event-definition">
        <h2 className="section-title">{t('home.eventTypes.title')}</h2>
        <p className="section-description">
          {t('home.eventTypes.description')}
        </p>
        
        <div className="event-types">
          <div className="event-type">
            <div className="event-icon">
              <FaRing />
            </div>
            <h3>{t('home.eventTypes.wedding.title')}</h3>
            <p>{t('home.eventTypes.wedding.description')}</p>
          </div>
          <div className="event-type">
            <div className="event-icon">
              <FaBuilding />
            </div>
            <h3>{t('home.eventTypes.business.title')}</h3>
            <p>{t('home.eventTypes.business.description')}</p>
          </div>
          <div className="event-type">
            <div className="event-icon">
              <FaBirthdayCake />
            </div>
            <h3>{t('home.eventTypes.birthday.title')}</h3>
            <p>{t('home.eventTypes.birthday.description')}</p>
          </div>
          <div className="event-type">
            <div className="event-icon">
              <FaGlassCheers />
            </div>
            <h3>{t('home.eventTypes.private.title')}</h3>
            <p>{t('home.eventTypes.private.description')}</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section section-dark features-section">
        <h2 className="section-title">{t('home.features.title')}</h2>
        <p className="section-description">
          {t('home.features.description')}
        </p>
        
        <div className="feature" ref={el => featuresRef.current[0] = el}>
          <div className="feature-text">
            <h3>{t('home.features.venue.title')}</h3>
            <p>
              {t('home.features.venue.description')}
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>{t('home.features.venue.cta')}</a>
          </div>
          <div className="feature-image">
            <img src="/images/image1.png" alt={t('home.features.venue.title')} />
          </div>
        </div>
        
        <div className="feature feature-odd" ref={el => featuresRef.current[1] = el}>
          <div className="feature-text">
            <h3>{t('home.features.vendors.title')}</h3>
            <p>
              {t('home.features.vendors.description')}
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>{t('home.features.vendors.cta')}</a>
          </div>
          <div className="feature-image">
            <img src="/images/image2.png" alt={t('home.features.vendors.title')} />
          </div>
        </div>
        
        <div className="feature" ref={el => featuresRef.current[2] = el}>
          <div className="feature-text">
            <h3>{t('home.features.guests.title')}</h3>
            <p>
              {t('home.features.guests.description')}
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>{t('home.features.guests.cta')}</a>
          </div>
          <div className="feature-image">
            <img src="/images/image3.png" alt={t('home.features.guests.title')} />
          </div>
        </div>
        
        <div className="feature feature-odd" ref={el => featuresRef.current[3] = el}>
          <div className="feature-text">
            <h3>{t('home.features.seating.title')}</h3>
            <p>
              {t('home.features.seating.description')}
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>{t('home.features.seating.cta')}</a>
          </div>
          <div className="feature-image">
            <img src="/images/image4.png" alt={t('home.features.seating.title')} />
          </div>
        </div>
        
        <div className="feature" ref={el => featuresRef.current[4] = el}>
          <div className="feature-text">
            <h3>{t('home.features.timeline.title')}</h3>
            <p>
              {t('home.features.timeline.description')}
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>{t('home.features.timeline.cta')}</a>
          </div>
          <div className="feature-image">
            <img src="/images/image5.png" alt={t('home.features.timeline.title')} />
          </div>
        </div>
        
        <div className="feature feature-odd" ref={el => featuresRef.current[5] = el}>
          <div className="feature-text">
            <h3>{t('home.features.budget.title')}</h3>
            <p>
              {t('home.features.budget.description')}
            </p>
            <a href="#" className="feature-btn" onClick={redirectToLogin}>{t('home.features.budget.cta')}</a>
          </div>
          <div className="feature-image">
            <img src="/images/image6.png" alt={t('home.features.budget.title')} />
          </div>
        </div>
      </section>

      {/* Planning Steps Section */}
      <section id="process" className="section section-light">
        <h2 className="section-title">{t('home.process.title')}</h2>
        <p className="section-description">
          {t('home.process.description')}
        </p>
        
        <div className="planning-steps">
          <div className="step" ref={el => stepsRef.current[0] = el}>
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>{t('home.process.step1.title')}</h3>
              <p>
                {t('home.process.step1.description')}
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[1] = el}>
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>{t('home.process.step2.title')}</h3>
              <p>
                {t('home.process.step2.description')}
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[2] = el}>
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>{t('home.process.step3.title')}</h3>
              <p>
                {t('home.process.step3.description')}
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[3] = el}>
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>{t('home.process.step4.title')}</h3>
              <p>
                {t('home.process.step4.description')}
              </p>
            </div>
          </div>
          
          <div className="step" ref={el => stepsRef.current[4] = el}>
            <div className="step-number">5</div>
            <div className="step-content">
              <h3>{t('home.process.step5.title')}</h3>
              <p>
                {t('home.process.step5.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
        <section id="testimonials" className="section testimonials-section">
          <h2 className="section-title">{t('home.testimonials.title')}</h2>
          <div className="testimonial-container">
            <div className="testimonial">
              <p className="testimonial-text">
                {t(`home.testimonials.testimonial${currentTestimonial + 1}.quote`)}
              </p>
              <p className="testimonial-author">
                {t(`home.testimonials.testimonial${currentTestimonial + 1}.author`)}
              </p>
              <p className="testimonial-role">
                {t(`home.testimonials.testimonial${currentTestimonial + 1}.event`)}
              </p>
            </div>
          </div>
          
          <div className="testimonial-dots">
            {[0, 1, 2, 3].map(index => (
              <button
                key={index}
                className={`testimonial-dot ${currentTestimonial === index ? 'active' : ''}`}
                onClick={() => setCurrentTestimonial(index)}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2 className="cta-title">{t('home.cta.title')}</h2>
        <p className="cta-description">
          {t('home.cta.description')}
        </p>
        <button className="cta-button" onClick={() => navigate('/register')}>{t('home.cta.button')}</button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <img src="/images/logo.png" alt={t('general.appLogo')} className="footer-logo" />
        <p className="footer-description">
          {t('home.footer.description')}
        </p>
        <p className="copyright">{t('home.footer.copyright')}</p>
      </footer>
    </div>
  );
};

export default HomePage;