// src/pages/VenueSearch/VenueSearch.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleMaps } from './GoogleMapsProvider';
import axios from 'axios';
import { FaSearch, FaFilter, FaMapMarkerAlt, FaShekelSign, FaArrowRight, FaArrowLeft } from 'react-icons/fa';
import '../../styles/VenueSearch.css';

const VenueSearch = () => {
  const navigate = useNavigate();
  const { isLoaded, loadError, googleMapsApiKey } = useGoogleMaps();
  const [user, setUser] = useState(null);
  const [searchParams, setSearchParams] = useState({
    query: '',
    capacity: '',
    eventType: '',
    priceRange: '',
    location: ''
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const autocompleteRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // פונקציה להתחברות אוטומטית אם יש טוקן
  useEffect(() => {
    const checkUserSession = () => {
      const userJson = localStorage.getItem('user');
      if (userJson) {
        try {
          const userData = JSON.parse(userJson);
          setUser(userData);
        } catch (error) {
          console.error('Error parsing user data from localStorage:', error);
        }
      } else {
        navigate('/login'); // אם אין משתמש מחובר, מעביר לדף התחברות
      }
    };

    checkUserSession();
  }, [navigate]);

  // אתחול Google Maps ו-Places Autocomplete
  useEffect(() => {
    if (isLoaded && !loadError) {
      // אתחול המפה
      mapRef.current = new window.google.maps.Map(document.getElementById('map'), {
        center: { lat: 31.771959, lng: 35.217018 }, // מרכז ישראל
        zoom: 8,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      // אתחול Autocomplete לשדה החיפוש
      const autocompleteInput = document.getElementById('location-input');
      if (autocompleteInput) {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(autocompleteInput, {
          types: ['geocode'],
          componentRestrictions: { country: 'il' }
        });

        // מאזין לבחירת מיקום
        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current.getPlace();
          
          if (!place.geometry) {
            console.error('No geometry for this place');
            return;
          }

          // עדכון שדה המיקום עם הקואורדינטות
          const location = `${place.geometry.location.lng()},${place.geometry.location.lat()}`;
          setSearchParams({
            ...searchParams,
            location
          });

          // כיוון המפה למיקום שנבחר
          mapRef.current.setCenter(place.geometry.location);
          mapRef.current.setZoom(12);
        });
      }
    }
  }, [isLoaded, loadError, searchParams]);

  // חיפוש מקומות
  const searchVenues = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // ניקוי סמנים קודמים במפה
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      
      // חיפוש דרך ה-API
      const response = await axios.get('/api/venues/api/search', {
        params: {
          query: searchParams.query || 'אולם אירועים',
          location: searchParams.location,
          type: 'restaurant,event_venue'
        }
      });
      
      const venues = response.data.results || [];
      setResults(venues);
      
      // הוספת סמנים למפה
      venues.forEach((venue, index) => {
        if (venue.geometry && venue.geometry.location) {
          const marker = new window.google.maps.Marker({
            position: venue.geometry.location,
            map: mapRef.current,
            label: `${index + 1}`,
            title: venue.name
          });
          
          // הוספת חלון מידע (InfoWindow) לכל סמן
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="max-width: 200px; text-align: right;">
                <h3>${venue.name}</h3>
                <p>${venue.formatted_address || 'אין כתובת'}</p>
                <div>דירוג: ${venue.rating || 'אין דירוג'}</div>
                <button 
                  style="background: #4f46e5; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
                  onclick="window.showVenueDetails('${venue.place_id}')"
                >
                  הצג פרטים
                </button>
              </div>
            `
          });
          
          marker.addListener('click', () => {
            // סגירת כל חלונות המידע הפתוחים
            markersRef.current.forEach(m => m.infoWindow?.close());
            // פתיחת חלון המידע לסמן הנוכחי
            infoWindow.open(mapRef.current, marker);
          });
          
          // שמירת האינפו-וינדו בסמן כדי שנוכל לסגור אותו אחר כך
          marker.infoWindow = infoWindow;
          markersRef.current.push(marker);
        }
      });
      
      // התאמת גבולות המפה לכל התוצאות
      if (venues.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        venues.forEach(venue => {
          if (venue.geometry && venue.geometry.location) {
            bounds.extend(venue.geometry.location);
          }
        });
        mapRef.current.fitBounds(bounds);
      }
      
      // פונקציה גלובלית לטיפול בלחיצה על "הצג פרטים" בחלון המידע
      window.showVenueDetails = async (placeId) => {
        try {
          const detailsResponse = await axios.get(`/api/venues/api/details/${placeId}`);
          setSelectedVenue(detailsResponse.data.placeDetails);
        } catch (error) {
          console.error('Error fetching venue details:', error);
          setError('שגיאה בטעינת פרטי המקום');
        }
      };
    } catch (error) {
      console.error('Search venues error:', error);
      setError('שגיאה בחיפוש מקומות. אנא נסה שנית.');
    } finally {
      setLoading(false);
    }
  };

  // הצגת פרטי מקום
  const showVenueDetails = async (placeId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/venues/api/details/${placeId}`);
      setSelectedVenue(response.data.placeDetails);
    } catch (error) {
      console.error('Show venue details error:', error);
      setError('שגיאה בטעינת פרטי המקום');
    } finally {
      setLoading(false);
    }
  };

  // בחירת מקום והמשך לשלב הבא
  const selectVenue = (venue) => {
    if (venue) {
      localStorage.setItem('selectedVenue', JSON.stringify(venue));
      navigate('/dashboard'); // חזרה לדשבורד עם המידע על המקום שנבחר
    }
  };

  // אם ה-API לא נטען
  if (loadError) {
    return (
      <div className="venue-search-container">
        <div className="venue-search-error">
          <h2>שגיאה בטעינת מפות Google</h2>
          <p>אנא נסה שוב מאוחר יותר.</p>
          <button className="back-button" onClick={() => navigate('/dashboard')}>
            <FaArrowRight /> חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  // אם ה-API עדיין נטען
  if (!isLoaded) {
    return (
      <div className="venue-search-container">
        <div className="venue-search-loading">
          <h2>טוען...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="venue-search-container">
      <header className="venue-search-header">
        <h1>חיפוש מקום לאירוע</h1>
        <button className="back-button" onClick={() => navigate('/dashboard')}>
          <FaArrowRight /> חזרה לדשבורד
        </button>
      </header>

      <div className="search-panel">
        <div className="search-bar">
          <input
            type="text"
            placeholder="חפש מקום אירועים..."
            value={searchParams.query}
            onChange={(e) => setSearchParams({ ...searchParams, query: e.target.value })}
          />
          <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
            <FaFilter /> סינון
          </button>
          <button className="search-button" onClick={searchVenues}>
            <FaSearch /> חפש
          </button>
        </div>

        {showFilters && (
          <div className="search-filters">
            <div className="filter-group">
              <label>מיקום</label>
              <div className="location-input-container">
                <FaMapMarkerAlt className="input-icon" />
                <input
                  id="location-input"
                  type="text"
                  placeholder="הזן כתובת או עיר..."
                />
              </div>
            </div>
            
            <div className="filter-group">
              <label>כמות אורחים</label>
              <select
                value={searchParams.capacity}
                onChange={(e) => setSearchParams({ ...searchParams, capacity: e.target.value })}
              >
                <option value="">כל הכמויות</option>
                <option value="50">עד 50 אורחים</option>
                <option value="100">עד 100 אורחים</option>
                <option value="200">עד 200 אורחים</option>
                <option value="300">עד 300 אורחים</option>
                <option value="500">עד 500 אורחים</option>
                <option value="1000">מעל 500 אורחים</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>סוג אירוע</label>
              <select
                value={searchParams.eventType}
                onChange={(e) => setSearchParams({ ...searchParams, eventType: e.target.value })}
              >
                <option value="">כל סוגי האירועים</option>
                <option value="חתונה">חתונה</option>
                <option value="בר/בת מצווה">בר/בת מצווה</option>
                <option value="ברית/ה">ברית/ה</option>
                <option value="אירוע חברה">אירוע חברה</option>
                <option value="יום הולדת">יום הולדת</option>
                <option value="אחר">אחר</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>טווח מחירים לאורח</label>
              <select
                value={searchParams.priceRange}
                onChange={(e) => setSearchParams({ ...searchParams, priceRange: e.target.value })}
              >
                <option value="">כל המחירים</option>
                <option value="0-150">עד 150 ₪</option>
                <option value="150-250">150-250 ₪</option>
                <option value="250-350">250-350 ₪</option>
                <option value="350-500">350-500 ₪</option>
                <option value="500-1000">מעל 500 ₪</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="venue-search-content">
        <div className="results-container">
          {error && <div className="error-message">{error}</div>}
          
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>מחפש מקומות...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="venues-list">
              <h2>תוצאות חיפוש ({results.length})</h2>
              <div className="venues-grid">
                {results.map((venue, index) => (
                  <div
                    key={venue.place_id}
                    className={`venue-card ${selectedVenue && selectedVenue.place_id === venue.place_id ? 'selected' : ''}`}
                    onClick={() => showVenueDetails(venue.place_id)}
                  >
                    <div className="venue-number">{index + 1}</div>
                    <h3>{venue.name}</h3>
                    <p className="venue-address">{venue.formatted_address}</p>
                    <div className="venue-rating">
                      דירוג: {venue.rating ? `${venue.rating} / 5` : 'אין דירוג'}
                    </div>
                    <button 
                      className="view-details-button"
                      onClick={(e) => { 
                        e.stopPropagation();
                        showVenueDetails(venue.place_id);
                      }}
                    >
                      הצג פרטים
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !loading && (
              <div className="no-results">
                <h2>איך מחפשים מקום לאירוע?</h2>
                <ol>
                  <li>הזן שם של מקום אירועים או סוג אירוע</li>
                  <li>בחר מיקום לחיפוש</li>
                  <li>סנן את התוצאות לפי כמות אורחים, סוג אירוע ותקציב</li>
                  <li>לחץ על כפתור "חפש"</li>
                </ol>
                <button className="search-button" onClick={searchVenues}>
                  <FaSearch /> התחל חיפוש
                </button>
              </div>
            )
          )}
        </div>
        
        <div className="map-container">
          <div id="map" style={{ width: '100%', height: '100%' }}></div>
        </div>
      </div>

      {selectedVenue && (
        <div className="venue-details-modal">
          <div className="venue-details-content">
            <button className="close-button" onClick={() => setSelectedVenue(null)}>×</button>
            
            <div className="venue-details-header">
              <h2>{selectedVenue.name}</h2>
              <p>{selectedVenue.formatted_address}</p>
            </div>
            
            <div className="venue-details-body">
              <div className="venue-photos">
                {selectedVenue.photos && selectedVenue.photos.length > 0 ? (
                  <div className="photo-grid">
                    {selectedVenue.photos.slice(0, 5).map((photo, idx) => {
                      const photoUrl = 
                      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${googleMapsApiKey}`;
                      
                      return (
                        <div key={idx} className="photo-item">
                          <img src={photoUrl} alt={`תמונה של ${selectedVenue.name}`} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="no-photos">
                    <p>אין תמונות זמינות</p>
                  </div>
                )}
              </div>
              
              <div className="venue-info">
                <div className="info-item">
                  <strong>דירוג:</strong> {selectedVenue.rating ? `${selectedVenue.rating} / 5` : 'אין דירוג'}
                </div>
                
                {selectedVenue.formatted_phone_number && (
                  <div className="info-item">
                    <strong>טלפון:</strong> {selectedVenue.formatted_phone_number}
                  </div>
                )}
                
                {selectedVenue.website && (
                  <div className="info-item">
                    <strong>אתר:</strong> <a href={selectedVenue.website} target="_blank" rel="noopener noreferrer">{selectedVenue.website}</a>
                  </div>
                )}
                
                {selectedVenue.opening_hours && (
                  <div className="info-item">
                    <strong>שעות פעילות:</strong>
                    <ul className="hours-list">
                      {selectedVenue.opening_hours.weekday_text?.map((day, idx) => (
                        <li key={idx}>{day}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {selectedVenue.reviews && selectedVenue.reviews.length > 0 && (
                <div className="venue-reviews">
                  <h3>ביקורות ({selectedVenue.reviews.length})</h3>
                  <div className="reviews-list">
                    {selectedVenue.reviews.slice(0, 3).map((review, idx) => (
                      <div key={idx} className="review-item">
                        <div className="review-header">
                          <div className="reviewer-name">{review.author_name}</div>
                          <div className="review-rating">{review.rating} / 5</div>
                        </div>
                        <div className="review-text">{review.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="venue-details-footer">
              <button 
                className="select-venue-button"
                onClick={() => selectVenue(selectedVenue)}
              >
                בחר מקום זה לאירוע
              </button>
              <button 
                className="back-button"
                onClick={() => setSelectedVenue(null)}
              >
                חזור לתוצאות
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VenueSearch;