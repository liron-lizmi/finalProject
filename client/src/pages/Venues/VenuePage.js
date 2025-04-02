import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/VenuePage.css';

const VenuePage = () => {
  const navigate = useNavigate();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [map, setMap] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [markers, setMarkers] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    venueType: 'all',
    minCapacity: '',
    maxCapacity: '',
    priceRange: 'all',
    amenities: {
      parking: false,
      accessibility: false,
      outdoorSpace: false,
      catering: false,
      accommodation: false
    },
    distance: '50', // km
  });
  
  const mapRef = useRef(null);
  const placesService = useRef(null);

  // גישה פשוטה יותר - ייבוא חיצוני של Google Maps API
  useEffect(() => {
    // קבע מפתח API
    const API_KEY = 'AIzaSyD2mR8Ifpxu6tjdDRDly5_hnNpAW4fC7bQ';
    
    // טען את ה-API אם הוא לא כבר טעון
    if (!window.google) {
      const googleMapsScript = document.createElement('script');
      googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
      googleMapsScript.async = true;
      googleMapsScript.defer = true;
      googleMapsScript.onload = initializeMap;
      document.head.appendChild(googleMapsScript);
      
      return () => {
        // ניקוי בעת ניתוק הקומפוננטה
        document.head.removeChild(googleMapsScript);
      };
    } else {
      // אם כבר טעון, אתחל מיד
      initializeMap();
    }
  }, []);
  
  // פונקציית אתחול המפה
  const initializeMap = () => {
    if (!mapRef.current || !window.google) {
      console.error("Map ref or Google Maps API not available");
      return;
    }
    
    try {
      console.log("Initializing map");
      
      // יצירת המפה
      const mapOptions = {
        center: { lat: 31.7683, lng: 35.2137 }, // Default to Jerusalem
        zoom: 11,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#333333" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#dddddd" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#e0e0e0" }] }
        ]
      };
      
      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      setMap(newMap);
      
      // יצירת שירות המקומות
      const node = document.createElement('div');
      placesService.current = new window.google.maps.places.PlacesService(newMap);
      
      // בדיקת מיקום המשתמש
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            console.log("Got user location:", userLocation);
            newMap.setCenter(userLocation);
            
            // חיפוש מקומות באזור
            searchVenues(userLocation);
          },
          (error) => {
            console.log("Geolocation error:", error);
            searchVenues({ lat: 31.7683, lng: 35.2137 });
          }
        );
      } else {
        console.log("Geolocation not supported");
        searchVenues({ lat: 31.7683, lng: 35.2137 });
      }
    } catch (error) {
      console.error("Error initializing map:", error);
      setLoading(false);
    }
  };
  
  // חיפוש מקומות
  const searchVenues = (location) => {
    if (!placesService.current) {
      console.error("Places service not available");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    console.log("Searching venues near location:", location);
    
    // בניית מחרוזת חיפוש
    let searchQuery = 'אולם אירועים גן אירועים';
    if (search) {
      searchQuery += ' ' + search;
    }
    
    // סינון לפי סוג מקום אם נבחר
    if (filters.venueType !== 'all') {
      switch (filters.venueType) {
        case 'restaurant':
          searchQuery += ' מסעדה';
          break;
        case 'event_venue':
          searchQuery += ' אולם אירועים';
          break;
        case 'banquet_hall':
          searchQuery += ' אולם כנסים';
          break;
        case 'hotel':
          searchQuery += ' מלון';
          break;
        case 'park':
          searchQuery += ' גן אירועים';
          break;
        case 'museum':
          searchQuery += ' מוזיאון';
          break;
        default:
          break;
      }
    }
    
    // הגדרת בקשת החיפוש
    const request = {
      query: searchQuery,
      location: location,
      radius: filters.distance * 1000 // המרת ק"מ למטרים
    };
    
    console.log("Text search request:", request);
    
    try {
      // ביצוע החיפוש
      placesService.current.textSearch(request, (results, status) => {
        console.log("Text search status:", status);
        
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          console.log("Found venues:", results.length);
          
          // סינון תוצאות לפי הסינונים שנבחרו
          const filteredResults = filterResults(results);
          setVenues(filteredResults);
          
          // הוספת סמנים למפה
          addMarkers(filteredResults);
        } else {
          console.error('Places search failed. Status:', status);
          setVenues([]);
        }
        
        setLoading(false);
      });
    } catch (error) {
      console.error('Error searching for venues:', error);
      setLoading(false);
      setVenues([]);
    }
  };
  
  // סינון תוצאות לפי בחירות המשתמש
  const filterResults = (results) => {
    return results.filter(place => {
      // סינון לפי קיבולת (הערכה, כי מידע זה לא ניתן ישירות)
      if (filters.minCapacity && place.user_ratings_total < filters.minCapacity * 0.5) {
        return false;
      }
      
      if (filters.maxCapacity && place.user_ratings_total > filters.maxCapacity * 2) {
        return false;
      }
      
      // סינון לפי רמת מחירים
      if (filters.priceRange !== 'all' && place.price_level) {
        if (filters.priceRange === 'budget' && place.price_level > 1) return false;
        if (filters.priceRange === 'moderate' && (place.price_level < 2 || place.price_level > 3)) return false;
        if (filters.priceRange === 'luxury' && place.price_level < 4) return false;
      }
      
      return true;
    });
  };
  
  // הוספת סמנים למפה
  const addMarkers = (venues) => {
    // נקה סמנים קיימים
    markers.forEach(marker => marker.setMap(null));
    const newMarkers = [];
    
    // צור סמנים חדשים
    venues.forEach(venue => {
      try {
        const marker = new window.google.maps.Marker({
          position: venue.geometry.location,
          map: map,
          title: venue.name
        });
        
        marker.addListener('click', () => {
          getVenueDetails(venue.place_id);
        });
        
        newMarkers.push(marker);
      } catch (error) {
        console.error("Error creating marker for venue:", venue.name, error);
      }
    });
    
    setMarkers(newMarkers);
  };
  
  // קבלת מידע מפורט על מקום
  const getVenueDetails = (placeId) => {
    if (!placesService.current || !placeId) {
      console.error("Places service not available or place ID is empty");
      return;
    }
    
    console.log("Getting details for venue:", placeId);
    
    const request = {
      placeId: placeId,
      fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'photos', 'rating', 'reviews', 'opening_hours', 'price_level', 'user_ratings_total']
    };
    
    try {
      placesService.current.getDetails(request, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          console.log("Venue details received");
          setSelectedVenue(place);
        } else {
          console.error('Place details request failed. Status:', status);
        }
      });
    } catch (error) {
      console.error('Error getting venue details:', error);
    }
  };
  
  // טיפול בשינוי קלט החיפוש
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };
  
  // טיפול בשליחת טופס החיפוש
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (!map) {
      console.error("Map not initialized");
      return;
    }
    
    console.log("Submitting search for:", search);
    
    try {
      // השתמש בשירות הגיאוקודינג למציאת המיקום
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: search }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          console.log("Geocoded location:", results[0]);
          const location = results[0].geometry.location;
          map.setCenter(location);
          searchVenues(location);
        } else {
          console.log("Geocoding failed, using map center");
          // אם הגיאוקודינג נכשל, חפש עם מרכז המפה הנוכחי
          searchVenues(map.getCenter());
        }
      });
    } catch (error) {
      console.error("Error in search submission:", error);
      searchVenues(map.getCenter());
    }
  };
  
  // טיפול בשינויי מסנן
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setFilters(prev => ({
        ...prev,
        amenities: {
          ...prev.amenities,
          [name]: checked
        }
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // יישום מסננים
  const applyFilters = () => {
    if (map) {
      console.log("Applying filters:", filters);
      searchVenues(map.getCenter());
    }
  };
  
  // בחירת מקום והמשך לשלב הבא
  const selectVenue = (venue) => {
    // שמור את המקום הנבחר ב-localStorage
    localStorage.setItem('selectedVenue', JSON.stringify(venue));
    console.log("Selected venue:", venue);
    
    // נווט לשלב הבא ביצירת האירוע
    navigate('/create-event', { state: { venue } });
  };
  
  return (
    <div className="venue-page">
      <div className="venue-header">
        <h1>חיפוש מקום לאירוע</h1>
        <p>מצא את המקום המושלם לאירוע שלך</p>
      </div>
      
      <div className="venue-search-container">
        <form onSubmit={handleSearchSubmit} className="venue-search-form">
          <input 
            type="text" 
            placeholder="חפש לפי עיר, שכונה או שם המקום" 
            value={search} 
            onChange={handleSearchChange}
            className="venue-search-input"
          />
          <button type="submit" className="venue-search-button">חפש</button>
        </form>
      </div>
      
      <div className="venue-content">
        <div className="venue-filters">
          <h3>סינון תוצאות</h3>
          
          <div className="filter-group">
            <label htmlFor="venueType">סוג המקום</label>
            <select 
              id="venueType" 
              name="venueType" 
              value={filters.venueType} 
              onChange={handleFilterChange}
            >
              <option value="all">הכל</option>
              <option value="restaurant">מסעדה</option>
              <option value="event_venue">אולם אירועים</option>
              <option value="banquet_hall">אולם כנסים</option>
              <option value="hotel">מלון</option>
              <option value="park">גן אירועים</option>
              <option value="museum">מוזיאון</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="minCapacity">קיבולת מינימלית</label>
            <input 
              type="number" 
              id="minCapacity" 
              name="minCapacity" 
              value={filters.minCapacity} 
              onChange={handleFilterChange}
              placeholder="מספר אורחים מינימלי"
            />
          </div>
          
          <div className="filter-group">
            <label htmlFor="maxCapacity">קיבולת מקסימלית</label>
            <input 
              type="number" 
              id="maxCapacity" 
              name="maxCapacity" 
              value={filters.maxCapacity} 
              onChange={handleFilterChange}
              placeholder="מספר אורחים מקסימלי"
            />
          </div>
          
          <div className="filter-group">
            <label htmlFor="priceRange">טווח מחירים</label>
            <select 
              id="priceRange" 
              name="priceRange" 
              value={filters.priceRange} 
              onChange={handleFilterChange}
            >
              <option value="all">הכל</option>
              <option value="budget">חסכוני ($)</option>
              <option value="moderate">בינוני ($$-$$$)</option>
              <option value="luxury">יוקרתי ($$$$)</option>
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="distance">מרחק מקסימלי (ק"מ)</label>
            <input 
              type="range" 
              id="distance" 
              name="distance" 
              min="5" 
              max="100" 
              step="5" 
              value={filters.distance} 
              onChange={handleFilterChange}
            />
            <span>{filters.distance} ק"מ</span>
          </div>
          
          <div className="filter-group amenities-group">
            <label>תוספות</label>
            <div className="checkbox-group">
              <label>
                <input 
                  type="checkbox" 
                  name="parking" 
                  checked={filters.amenities.parking} 
                  onChange={handleFilterChange}
                />
                חניה
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  name="accessibility" 
                  checked={filters.amenities.accessibility} 
                  onChange={handleFilterChange}
                />
                נגישות
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  name="outdoorSpace" 
                  checked={filters.amenities.outdoorSpace} 
                  onChange={handleFilterChange}
                />
                שטח חוץ
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  name="catering" 
                  checked={filters.amenities.catering} 
                  onChange={handleFilterChange}
                />
                קייטרינג במקום
              </label>
              
              <label>
                <input 
                  type="checkbox" 
                  name="accommodation" 
                  checked={filters.amenities.accommodation} 
                  onChange={handleFilterChange}
                />
                אפשרויות לינה
              </label>
            </div>
          </div>
          
          <button className="filter-apply-button" onClick={applyFilters}>החל סינון</button>
        </div>
        
        <div className="venue-results-container">
          <div className="venue-map" ref={mapRef}></div>
          
          <div className="venue-list">
            <h3>תוצאות חיפוש</h3>
            
            {loading ? (
              <div className="loading-indicator">טוען מקומות...</div>
            ) : venues.length === 0 ? (
              <div className="no-results">לא נמצאו מקומות. נסה לשנות את החיפוש או הסינון.</div>
            ) : (
              <div className="venues-grid">
                {venues.map(venue => (
                  <div 
                    key={venue.place_id} 
                    className={`venue-card ${selectedVenue && selectedVenue.place_id === venue.place_id ? 'selected' : ''}`}
                    onClick={() => getVenueDetails(venue.place_id)}
                  >
                    {venue.photos && venue.photos[0] && (
                      <div className="venue-image">
                        <img 
                          src={venue.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })} 
                          alt={venue.name} 
                        />
                      </div>
                    )}
                    
                    <div className="venue-info">
                      <h4>{venue.name}</h4>
                      <p className="venue-address">{venue.vicinity || venue.formatted_address}</p>
                      
                      {venue.rating && (
                        <div className="venue-rating">
                          <span className="stars">
                            {Array(Math.floor(venue.rating)).fill().map((_, i) => (
                              <span key={i} className="star">★</span>
                            ))}
                            {venue.rating % 1 > 0 && <span className="star half">★</span>}
                          </span>
                          <span className="rating-value">{venue.rating}</span>
                          <span className="review-count">({venue.user_ratings_total || 0})</span>
                        </div>
                      )}
                      
                      {venue.price_level && (
                        <div className="venue-price">
                          {'$'.repeat(venue.price_level)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {selectedVenue && (
          <div className="venue-details">
            <div className="venue-details-header">
              <h2>{selectedVenue.name}</h2>
              <button className="close-details" onClick={() => setSelectedVenue(null)}>×</button>
            </div>
            
            <div className="venue-details-content">
              {selectedVenue.photos && selectedVenue.photos.length > 0 && (
                <div className="venue-photos">
                  <div className="main-photo">
                    <img 
                      src={selectedVenue.photos[0].getUrl({ maxWidth: 600, maxHeight: 400 })} 
                      alt={selectedVenue.name} 
                    />
                  </div>
                  
                  {selectedVenue.photos.length > 1 && (
                    <div className="additional-photos">
                      {selectedVenue.photos.slice(1, 5).map((photo, index) => (
                        <img 
                          key={index} 
                          src={photo.getUrl({ maxWidth: 150, maxHeight: 100 })} 
                          alt={`${selectedVenue.name} - ${index + 1}`} 
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="venue-info-detailed">
                <p className="address">
                  <strong>כתובת:</strong> {selectedVenue.formatted_address}
                </p>
                
                {selectedVenue.formatted_phone_number && (
                  <p className="phone">
                    <strong>טלפון:</strong> {selectedVenue.formatted_phone_number}
                  </p>
                )}
                
                {selectedVenue.website && (
                  <p className="website">
                    <strong>אתר:</strong> <a href={selectedVenue.website} target="_blank" rel="noopener noreferrer">{selectedVenue.website}</a>
                  </p>
                )}
                
                {selectedVenue.rating && (
                  <p className="rating-details">
                    <strong>דירוג:</strong> {selectedVenue.rating} מתוך 5 ({selectedVenue.user_ratings_total} ביקורות)
                  </p>
                )}
                
                {selectedVenue.price_level && (
                  <p className="price-details">
                    <strong>רמת מחיר:</strong> {'$'.repeat(selectedVenue.price_level)}
                  </p>
                )}
                
                {selectedVenue.opening_hours && selectedVenue.opening_hours.weekday_text && (
                  <div className="opening-hours">
                    <strong>שעות פתיחה:</strong>
                    <ul>
                      {selectedVenue.opening_hours.weekday_text.map((day, index) => (
                        <li key={index}>{day}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {selectedVenue.reviews && selectedVenue.reviews.length > 0 && (
                <div className="venue-reviews">
                  <h3>ביקורות</h3>
                  <div className="reviews-list">
                    {selectedVenue.reviews.slice(0, 3).map((review, index) => (
                      <div key={index} className="review">
                        <div className="review-header">
                          <span className="reviewer">{review.author_name}</span>
                          <span className="review-rating">
                            {'★'.repeat(review.rating)}
                            {'☆'.repeat(5 - review.rating)}
                          </span>
                          <span className="review-date">{new Date(review.time * 1000).toLocaleDateString()}</span>
                        </div>
                        <p className="review-text">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="venue-actions">
                <button className="select-venue-button" onClick={() => selectVenue(selectedVenue)}>
                  בחר מקום זה לאירוע
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenuePage;