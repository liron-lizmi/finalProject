import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/VenuePage.css';

// A flag to ensure Google Maps API is loaded only once across the entire application
window.googleMapsLoaded = window.googleMapsLoaded || false;

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
  const geocoder = useRef(null);
  const scriptRef = useRef(null);
  const isMapInitialized = useRef(false);
  const isEffectRun = useRef(false);
  const mapInstance = useRef(null); // שמירת המפה כרפרנס במקום ב-state
  
  // Loading the API and setting up the map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Prevent multiple executions of this effect
    if (isEffectRun.current) return;
    isEffectRun.current = true;
    
    // Define a function to initialize the map
    const setupGoogleMaps = () => {
      console.log("Setting up Google Maps...");
      initMap();
    };
    
    // Function to load Google Maps API
    const loadGoogleMapsAPI = () => {
      // Check if Google Maps is already loaded and available
      if (window.google && window.google.maps) {
        console.log("Google Maps already loaded, skipping load");
        setupGoogleMaps();
        return;
      }

      // Check if there's already a script tag for Google Maps
      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        console.log("Google Maps script tag already exists");
        
        // If the API is loading but not ready yet, set up a callback
        if (!window.google || !window.google.maps) {
          console.log("Google Maps script exists but API not yet initialized, waiting...");
          window.initGoogleMapsCallback = setupGoogleMaps;
          return;
        } else {
          setupGoogleMaps();
          return;
        }
      }

      // Mark the API as being loaded
      window.googleMapsLoaded = true;
      
      const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!API_KEY) {
        console.error("Missing Google Maps API key");
        setLoading(false);
        return;
      }
      
      console.log("Loading Google Maps API");
      
      // Load the API
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=googleMapsCallback&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      
      // Define a global callback for when Google Maps loads
      window.googleMapsCallback = () => {
        console.log("Google Maps API loaded via callback");
        setupGoogleMaps();
        
        // Also call any waiting callbacks
        if (window.initGoogleMapsCallback) {
          window.initGoogleMapsCallback();
          window.initGoogleMapsCallback = null;
        }
      };
      
      scriptRef.current = script;
      document.head.appendChild(script);
    };
    
    // Load the API
    loadGoogleMapsAPI();
    
    // Cleanup
    return () => {
      // Only remove script if it's one we added and Google isn't initialized
      if (scriptRef.current && scriptRef.current.parentNode && !window.google) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        window.googleMapsLoaded = false;
      }
      
      // Clear markers on unmount - תמיכה בשני סוגי הסמנים
      if (markers.length > 0) {
        markers.forEach(marker => {
          if (marker) {
            try {
              if (typeof marker.setMap === 'function') {
                marker.setMap(null);
              } else if (marker.map) {
                marker.map = null;
              }
            } catch (error) {
              console.error("Error clearing marker on unmount:", error);
            }
          }
        });
      }
    };
  }, []); // Empty dependency array to run only once on component mount
  
  // Initialize the map and related services
  const initMap = () => {
    if (!mapRef.current || !window.google) {
      console.error("Map ref or Google API not ready");
      return;
    }
    
    // Prevent multiple initializations
    if (isMapInitialized.current || mapInstance.current) {
      console.log("Map already initialized");
      return;
    }
    
    isMapInitialized.current = true;
    
    try {
      // Create the map
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
      
      // שמירת המפה ברפרנס, לשימוש ישיר
      mapInstance.current = newMap;
      // קודם מגדירים את המפה בסטייט ואז יוצרים את השירותים
      setMap(newMap);
      
      // אתחול הג'יאוקודר
      if (window.google.maps.Geocoder) {
        geocoder.current = new window.google.maps.Geocoder();
      }
      
      // אתחול שירות המקומות עם אלמנט בדף במקום עם המפה ישירות
      const placesDiv = document.createElement('div');
      document.body.appendChild(placesDiv);
      
      if (window.google.maps.places && window.google.maps.places.PlacesService) {
        placesService.current = new window.google.maps.places.PlacesService(placesDiv);
      } else {
        console.error("Google Maps Places Service is not available");
      }
      
      console.log("Map is fully loaded");
      
      // Try to get the user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            
            console.log("Got user location:", userLocation);
            newMap.setCenter(userLocation);
            
            // עכשיו נבצע חיפוש ישירות, בלי לעבור דרך performInitialSearch
            try {
              if (placesService.current) {
                console.log("Directly performing search with location:", userLocation);
                searchVenues(userLocation, filters.venueType, newMap); // העברת המפה כפרמטר 
              } else {
                console.error("Places service not available for search");
                setLoading(false);
              }
            } catch (error) {
              console.error("Error in direct search:", error);
              setLoading(false);
            }
          },
          (error) => {
            console.error("Geolocation error:", error);
            // אם אין גישה למיקום, השתמש במיקום ברירת המחדל
            try {
              if (placesService.current) {
                console.log("Directly performing search with default location:", mapOptions.center);
                searchVenues(mapOptions.center, filters.venueType, newMap); // העברת המפה כפרמטר
              } else {
                console.error("Places service not available for search");
                setLoading(false);
              }
            } catch (error) {
              console.error("Error in direct search:", error);
              setLoading(false);
            }
          }
        );
      } else {
        console.log("Geolocation not supported");
        // אם הדפדפן לא תומך בגיאולוקציה, השתמש במיקום ברירת המחדל
        try {
          if (placesService.current) {
            console.log("Directly performing search with default location:", mapOptions.center);
            searchVenues(mapOptions.center, filters.venueType, newMap); // העברת המפה כפרמטר
          } else {
            console.error("Places service not available for search");
            setLoading(false);
          }
        } catch (error) {
          console.error("Error in direct search:", error);
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Error in initMap:", error);
      isMapInitialized.current = false; // Reset if there was an error
      setLoading(false);
    }
  };

  // הסרנו את פונקציית performInitialSearch שלא נמצאת בשימוש
  
  // Search for places near a specific location
  const searchVenues = (location, venueType, mapParamDirect = null) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.error("Google Maps or Places API not available");
      setLoading(false);
      return;
    }
    
    // בדיקה נוספת לשירות המקומות
    if (!placesService.current) {
      console.log("Places service not initialized, creating it now");
      try {
        // נסיון לאתחל את שירות המקומות אם הוא לא קיים
        const placesDiv = document.createElement('div');
        document.body.appendChild(placesDiv);
        placesService.current = new window.google.maps.places.PlacesService(placesDiv);
      } catch (error) {
        console.error("Failed to create places service:", error);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    
    // Build search query based on venue type
    let query = '';
    
    switch (venueType) {
      case 'restaurant':
        query = 'מסעדה';
        break;
      case 'event_venue':
        query = 'אולם אירועים';
        break;
      case 'banquet_hall':
        query = 'אולם כנסים';
        break;
      case 'hotel':
        query = 'מלון';
        break;
      case 'park':
        query = 'גן אירועים';
        break;
      case 'museum':
        query = 'מוזיאון';
        break;
      default:
        query = 'אולם אירועים';
        break;
    }
    
    // Add user search if available
    if (search) {
      query += ' ' + search;
    }
    
    console.log("Searching for:", query, "near", location);
    
    // וידוא שהמיקום הוא אובייקט תקין
    let locationObj = location;
    if (typeof location.lat === 'function') {
      // אם זה אובייקט LatLng, נחלץ את הערכים
      locationObj = {
        lat: location.lat(),
        lng: location.lng()
      };
    }
    
    // Text search - שימוש בצורה שונה של החיפוש למקרה שיש בעיה עם הקודמת
    const request = {
      query: query,
      location: locationObj,
      radius: parseInt(filters.distance) * 1000 // Convert km to meters
    };
    
    try {
      placesService.current.textSearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          console.log("Found", results.length, "venues");
          
          // Filter results
          const filteredResults = filterVenues(results);
          
          // Set results and add markers
          setVenues(filteredResults);
          
          // השתמש במפה שהועברה ישירות, אם יש, אחרת נסה להשתמש ברפרנס או ב-state
          const currentMap = mapParamDirect || mapInstance.current || map;
          addMarkers(filteredResults, currentMap);
        } else {
          console.error("Search failed:", status);
          setVenues([]);
          
          // Clear existing markers
          clearMarkers();
        }
        
        setLoading(false);
      });
    } catch (error) {
      console.error("Search execution error:", error);
      setLoading(false);
    }
  };
  
  // Filter results by user preferences
  const filterVenues = (venues) => {
    return venues.filter(venue => {
      // Filter by capacity (based on ratings if no direct data)
      if (filters.minCapacity && venue.user_ratings_total && 
          parseInt(venue.user_ratings_total) < parseInt(filters.minCapacity) * 0.5) {
        return false;
      }
      
      if (filters.maxCapacity && venue.user_ratings_total && 
          parseInt(venue.user_ratings_total) > parseInt(filters.maxCapacity) * 2) {
        return false;
      }
      
      // Filter by price level
      if (filters.priceRange !== 'all' && venue.price_level !== undefined) {
        if (filters.priceRange === 'budget' && venue.price_level > 1) return false;
        if (filters.priceRange === 'moderate' && (venue.price_level < 2 || venue.price_level > 3)) return false;
        if (filters.priceRange === 'luxury' && venue.price_level < 4) return false;
      }
      
      return true;
    });
  };
  
  // Add markers to the map
  const addMarkers = (venues, mapParamDirect = null) => {
    // Clear existing markers first
    clearMarkers();
    
    // השתמש במפה שהועברה כפרמטר, או ברפרנס, או בסטייט
    const currentMap = mapParamDirect || mapInstance.current || map;
    
    // Make sure map is available
    if (!currentMap || !window.google) {
      console.error("Map not available for adding markers");
      return;
    }
    
    console.log("Adding markers using map:", currentMap ? "available" : "not available");
    
    // Create new markers
    const newMarkers = venues.map(venue => {
      if (!venue.geometry || !venue.geometry.location) return null;
      
      try {
        // בדיקה אם AdvancedMarkerElement קיים, ואם לא שימוש בסמן רגיל
        let marker;
        
        if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
          console.log("Using AdvancedMarkerElement");
          marker = new window.google.maps.marker.AdvancedMarkerElement({
            position: venue.geometry.location,
            map: currentMap,
            title: venue.name
          });
          
          // AdvancedMarkerElement משתמש ב-gm_click
          marker.addListener('gm_click', () => {
            getVenueDetails(venue.place_id);
          });
        } else {
          console.log("Using regular Marker (deprecated)");
          // שימוש בסמן רגיל כגיבוי
          marker = new window.google.maps.Marker({
            position: venue.geometry.location,
            map: currentMap,
            title: venue.name
          });
          
          // הסמן הרגיל משתמש ב-click
          marker.addListener('click', () => {
            getVenueDetails(venue.place_id);
          });
        }
        
        return marker;
      } catch (error) {
        console.error("Error creating marker:", error);
        return null;
      }
    }).filter(Boolean); // Filter out nulls
    
    setMarkers(newMarkers);
  };
  
  // Clear existing markers
  const clearMarkers = () => {
    markers.forEach(marker => {
      // נסיון לנקות סמנים - תומך גם בסמנים רגילים וגם בסמנים מתקדמים
      if (marker) {
        try {
          if (typeof marker.setMap === 'function') {
            marker.setMap(null);
          } else if (marker.map) {
            marker.map = null;
          }
        } catch (error) {
          console.error("Error clearing marker:", error);
        }
      }
    });
    setMarkers([]);
  };
  
  // Get details for a specific place
  const getVenueDetails = (placeId) => {
    if (!placesService.current || !placeId) return;
    
          // עדכון השדות לתמיכה באפשרות שה-API דורש שדות ספציפיים
      const request = {
        placeId: placeId,
        fields: [
          'name', 'formatted_address', 'formatted_phone_number', 
          'website', 'photos', 'rating', 'reviews', 
          'opening_hours', 'price_level', 'user_ratings_total',
          'geometry', 'vicinity'
        ]
      };
    
    placesService.current.getDetails(request, (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        console.log("Venue details loaded:", place.name);
        setSelectedVenue(place);
      } else {
        console.error("Failed to get venue details:", status);
      }
    });
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };
  
  // Handle search form submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (!geocoder.current) {
      console.error("Geocoder not initialized");
      // נסיון לאתחל את הג'יאוקודר אם הוא לא קיים
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        geocoder.current = new window.google.maps.Geocoder();
      } else {
        console.error("Google Maps Geocoder API not available");
        return;
      }
    }
    
    // אם מעבירים את ה-map כפרמטר
    geocoder.current.geocode({ address: search }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const currentMap = mapInstance.current || map;
        if (currentMap) {
          currentMap.setCenter(location);
        }
        searchVenues(location, filters.venueType, currentMap);
      } else {
        // If geocoding fails, use current map center if available
        const currentMap = mapInstance.current || map;
        if (currentMap && currentMap.getCenter) {
          searchVenues(currentMap.getCenter(), filters.venueType, currentMap);
        } else {
          // אם אין מרכז מפה, השתמש במיקום ברירת מחדל
          searchVenues({ lat: 31.7683, lng: 35.2137 }, filters.venueType, currentMap);
        }
      }
    });
  };
  
  // Handle filter changes
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
  
  // Apply filters
  const applyFilters = () => {
    // השתמש במפה מהרפרנס או מהסטייט
    const currentMap = mapInstance.current || map;
    
    // שימוש במיקום ברירת מחדל אם המפה לא זמינה
    if (currentMap && currentMap.getCenter) {
      searchVenues(currentMap.getCenter(), filters.venueType, currentMap);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          searchVenues(userLocation, filters.venueType, currentMap);
        },
        () => {
          // אם אין גישה למיקום, השתמש במיקום ברירת מחדל
          searchVenues({ lat: 31.7683, lng: 35.2137 }, filters.venueType, currentMap);
        }
      );
    } else {
      // אם הדפדפן לא תומך בגיאולוקציה, השתמש במיקום ברירת מחדל
      searchVenues({ lat: 31.7683, lng: 35.2137 }, filters.venueType, currentMap);
    }
  };
  
  // Select a venue and proceed to next step
  const selectVenue = (venue) => {
    try {
      // Save selected venue in localStorage
      const venueData = {
        place_id: venue.place_id,
        id: venue.place_id,
        name: venue.name,
        address: venue.formatted_address || venue.vicinity,
        phone: venue.formatted_phone_number || '',
        website: venue.website || '',
        rating: venue.rating || 0,
        price_level: venue.price_level || 0
      };
      
      localStorage.setItem('selectedVenue', JSON.stringify(venueData));
      
      // Navigate to next page
      navigate('/create-event', { state: { venue } });
    } catch (error) {
      console.error("Error selecting venue:", error);
    }
  };
  
  // Helper function to get photo URL
  const getPhotoUrl = (photo, maxWidth = 300, maxHeight = 200) => {
    try {
      if (photo && typeof photo.getUrl === 'function') {
        return photo.getUrl({ maxWidth, maxHeight });
      }
    } catch (error) {
      console.error("Error getting photo URL:", error);
    }
    
    // אם לא הצלחנו להשיג תמונה, נחזיר תמונה ריקה שתפעיל את onError
    return '';
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
                    <div className="venue-image">
                {venue.photos && venue.photos.length > 0 ? (
                  <img 
                    src={getPhotoUrl(venue.photos[0])}
                    alt={venue.name}
                    onError={(e) => {
                      // נסיון למצוא תמונה אחרת זמינה במקום
                      if (venue.photos && venue.photos.length > 1) {
                        // נסיון לטעון את התמונה הבאה ברשימה
                        const currentIndex = parseInt(e.target.dataset.photoIndex || "0");
                        const nextIndex = (currentIndex + 1) % venue.photos.length;
                        
                        if (nextIndex !== currentIndex) {
                          e.target.dataset.photoIndex = nextIndex.toString();
                          e.target.src = getPhotoUrl(venue.photos[nextIndex]);
                          return;
                        }
                      }
                      
                      // אם אין תמונות אחרות זמינות, השתמש בתמונת ברירת מחדל
                      e.target.onerror = null;
                      e.target.src = `https://dummyimage.com/300x200/cccccc/666666&text=${encodeURIComponent(venue.name || 'מקום אירוע')}`;
                    }}
                    data-photo-index="0"
                  />
                ) : (
                  <img 
                    src={`https://dummyimage.com/300x200/cccccc/666666&text=${encodeURIComponent(venue.name || 'מקום אירוע')}`}
                    alt={venue.name || 'מקום האירוע'}
                  />
                )}
              </div>
                    
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
              <div className="venue-photos">
                <div className="main-photo">
                {selectedVenue.photos && selectedVenue.photos.length > 0 ? (
                  <img 
                    src={getPhotoUrl(selectedVenue.photos[0], 600, 400)}
                    alt={selectedVenue.name}
                    onError={(e) => {
                      // נסיון למצוא תמונה אחרת זמינה במקום
                      if (selectedVenue.photos && selectedVenue.photos.length > 1) {
                        // נסיון לטעון את התמונה הבאה ברשימה
                        const currentIndex = parseInt(e.target.dataset.photoIndex || "0");
                        const nextIndex = (currentIndex + 1) % selectedVenue.photos.length;
                        
                        if (nextIndex !== currentIndex) {
                          e.target.dataset.photoIndex = nextIndex.toString();
                          e.target.src = getPhotoUrl(selectedVenue.photos[nextIndex], 600, 400);
                          return;
                        }
                      }
                      
                      // אם אין תמונות אחרות זמינות, השתמש בתמונת ברירת מחדל
                      e.target.onerror = null;
                      e.target.src = `https://dummyimage.com/600x400/cccccc/666666&text=${encodeURIComponent(selectedVenue.name || 'מקום אירוע')}`;
                    }}
                    data-photo-index="0"
                  />
                ) : (
                  <img 
                    src={`https://dummyimage.com/600x400/cccccc/666666&text=${encodeURIComponent(selectedVenue.name || 'מקום אירוע')}`}
                    alt={selectedVenue.name || 'מקום האירוע'}
                  />
                )}
              </div>
                
                {selectedVenue.photos && selectedVenue.photos.length > 1 && (
                  <div className="additional-photos">
                {selectedVenue.photos.slice(1, 5).map((photo, index) => {
                  // הראה רק תמונות זמינות
                  return (
                    <img 
                      key={index} 
                      src={getPhotoUrl(photo, 150, 100)} 
                      alt={`${selectedVenue.name} - ${index + 1}`}
                      onError={(e) => {
                        e.target.style.display = 'none'; // הסתר תמונות שלא נטענות
                      }}
                    />
                  );
                })}
              </div>
                )}
              </div>
              
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