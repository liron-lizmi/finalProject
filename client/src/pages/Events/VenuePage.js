import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../styles/VenuePage.css';

window.googleMapsLoaded = window.googleMapsLoaded || false;

const VenuePage = ({ onSelectVenue }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [map, setMap] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedVenuePhotoIndex, setSelectedVenuePhotoIndex] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
 
  const eventId = location.state?.eventId;
  
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';
  const isEnglish = i18n.language === 'en' || i18n.language === 'en-US';
 
  const [filters, setFilters] = useState({
    area: 'all',
    venueType: 'all',
    venueStyle: 'all',
    capacity: '',
    amenities: {
      parking: false,
      accessibility: false,
      outdoorSpace: false,
      catering: false,
      accommodation: false
    },
    distance: '50',
  });

  const [selectedPhoto, setSelectedPhoto] = useState(0);
 
  const mapRef = useRef(null);
  const placesService = useRef(null);
  const geocoder = useRef(null);
  const scriptRef = useRef(null);
  const isMapInitialized = useRef(false);
  const isEffectRun = useRef(false);
  const mapInstance = useRef(null);
  
  const translateText = async (text, targetLang = 'en') => {
    if (!text || targetLang === 'he') return text;
    
    try {
      if ('translator' in window && 'createTranslator' in window.translator) {
        const translator = await window.translator.createTranslator({
          sourceLanguage: 'he',
          targetLanguage: targetLang
        });
        const translation = await translator.translate(text);
        return translation;
      }
      
      const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=he&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await response.json();
      
      if (data && data[0] && data[0][0]) {
        return data[0][0][0];
      }
      
    } catch (error) {
      console.error('Translation failed:', error);
    }
    
    return text;
  };
  
  const containsHebrew = (text) => {
    return /[\u0590-\u05FF]/.test(text);
  };
  
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
  }, [isRTL, i18n.language]);
 
  useEffect(() => {
    if (isEffectRun.current) return;
    isEffectRun.current = true;
   
    const setupGoogleMaps = () => {
      console.log("Setting up Google Maps...");
      initMap();
    };
   
    const loadGoogleMapsAPI = () => {
      if (window.google && window.google.maps) {
        console.log("Google Maps already loaded, skipping load");
        setupGoogleMaps();
        return;
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
      if (existingScript) {
        console.log("Google Maps script tag already exists");
       
        if (!window.google || !window.google.maps) {
          console.log("Google Maps script exists but API not yet initialized, waiting...");
          window.initGoogleMapsCallback = setupGoogleMaps;
          return;
        } else {
          setupGoogleMaps();
          return;
        }
      }

      window.googleMapsLoaded = true;
     
      const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (!API_KEY) {
        console.error("Missing Google Maps API key");
        setLoading(false);
        return;
      }
     
      console.log("Loading Google Maps API");
     
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=googleMapsCallback&v=weekly&loading=async&language=${isRTL ? 'he' : 'en'}&region=IL`;
      script.async = true;
      script.defer = true;

      window.googleMapsCallback = () => {
        console.log("Google Maps API loaded via callback");
        setupGoogleMaps();
       
        if (window.initGoogleMapsCallback) {
          window.initGoogleMapsCallback();
          window.initGoogleMapsCallback = null;
        }
      };
     
      scriptRef.current = script;
      document.head.appendChild(script);
    };
   
    loadGoogleMapsAPI();
   
    return () => {
      if (scriptRef.current && scriptRef.current.parentNode && !window.google) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
        window.googleMapsLoaded = false;
      }
     
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
  }, []);
 
  const initMap = () => {
    if (!mapRef.current || !window.google) {
      console.error("Map ref or Google API not ready");
      return;
    }
   
    if (isMapInitialized.current || mapInstance.current) {
      console.log("Map already initialized");
      return;
    }
   
    isMapInitialized.current = true;
   
    try {
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
     
      mapInstance.current = newMap;
     
      setMap(newMap);
     
      if (window.google.maps.Geocoder) {
        geocoder.current = new window.google.maps.Geocoder();
      }
     
      const placesDiv = document.createElement('div');
      document.body.appendChild(placesDiv);
     
      if (window.google.maps.places && window.google.maps.places.PlacesService) {
        placesService.current = new window.google.maps.places.PlacesService(placesDiv);
      } else {
        console.error("Google Maps Places Service is not available");
      }
     
      console.log("Map is fully loaded");
     
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
           
            console.log("Got user location:", userLocation);
            newMap.setCenter(userLocation);
           
            try {
              if (placesService.current) {
                console.log("Directly performing search with location:", userLocation);
                searchVenues(userLocation, filters.venueType, newMap);
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
            try {
              if (placesService.current) {
                console.log("Directly performing search with default location:", mapOptions.center);
                searchVenues(mapOptions.center, filters.venueType, newMap);
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
        try {
          if (placesService.current) {
            console.log("Directly performing search with default location:", mapOptions.center);
            searchVenues(mapOptions.center, filters.venueType, newMap);
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
      isMapInitialized.current = false;
      setLoading(false);
    }
  };

  const searchVenues = async (location, venueType, mapParamDirect = null) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.error("Google Maps or Places API not available");
      setLoading(false);
      return;
    }
   
    if (!placesService.current) {
      console.log("Places service not initialized, creating it now");
      try {
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
   
    let query = '';
    switch (venueType) {
      case 'restaurant':
        query = 'restaurant';
        break;
      case 'event_venue':
        query = 'event venue';
        break;
      case 'banquet_hall':
        query = 'banquet hall';
        break;
      case 'hotel':
        query = 'hotel';
        break;
      case 'park':
        query = 'park';
        break;
      case 'museum':
        query = 'museum';
        break;
      default:
        query = 'venue';
        break;
    }
   
    if (filters.area !== 'all') {
      switch (filters.area) {
        case 'ירושלים':
          query += ' Jerusalem';
          break;
        case 'מרכז':
          query += ' Center';
          break;
        case 'דרום':
          query += ' South';
          break;
        case 'צפון':
          query += ' North';
          break;
        default:
          query += ' ' + filters.area;
          break;
      }
    }
   
    if (search) {
      query += ' ' + search;
    }
   
    query += ' Israel';
   
    console.log("Searching for:", query, "near", location);
   
    let locationObj = location;
    if (typeof location.lat === 'function') {
      locationObj = {
        lat: location.lat(),
        lng: location.lng()
      };
    }
   
    const request = {
      query: query,
      location: locationObj,
      radius: parseInt(filters.distance) * 1000,
      language: isRTL ? 'he' : 'en' 
    };

    try {
      placesService.current.textSearch(request, async (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          console.log("Found", results.length, "venues");
         
          const processedResults = await Promise.all(results.map(async venue => {
            let processedVenue = { ...venue };
            
            if (containsHebrew(venue.name)) {
              processedVenue.originalName = venue.name;
            }
            
            if (venue.vicinity && containsHebrew(venue.vicinity)) {
              processedVenue.originalVicinity = venue.vicinity;
            }
            
            if (venue.formatted_address && containsHebrew(venue.formatted_address)) {
              processedVenue.originalFormattedAddress = venue.formatted_address;
            }
            
            if (isEnglish && containsHebrew(venue.name)) {
              processedVenue.name = await translateText(venue.name, 'en');
            }
            
            if (isEnglish && venue.vicinity && containsHebrew(venue.vicinity)) {
              processedVenue.vicinity = await translateText(venue.vicinity, 'en');
            }
            
            if (isEnglish && venue.formatted_address && containsHebrew(venue.formatted_address)) {
              processedVenue.formatted_address = await translateText(venue.formatted_address, 'en');
            }
            
            return processedVenue;
          }));
         
          const filteredResults = filterVenues(processedResults);
         
          setVenues(filteredResults);
         
          const currentMap = mapParamDirect || mapInstance.current || map;
          addMarkers(filteredResults, currentMap);
        } else {
          console.error("Search failed:", status);
          setVenues([]);
         
          clearMarkers();
        }
       
        setLoading(false);
      });
    } catch (error) {
      console.error("Search execution error:", error);
      setLoading(false);
    }
  };
 
  const filterVenues = (venues) => {
    return venues.filter(venue => {
      if (filters.capacity && venue.user_ratings_total) {
        const estimatedCapacity = venue.user_ratings_total * 2;
        if (estimatedCapacity < parseInt(filters.capacity)) {
          return false;
        }
      }
     
      if (filters.venueStyle !== 'all') {
        const venueText = venue.name + ' ' + (venue.vicinity || '');
       
        if (filters.venueStyle === 'modern' && !venueText.toLowerCase().includes('modern')) return false;
        if (filters.venueStyle === 'classic' && !venueText.toLowerCase().includes('classic')) return false;
        if (filters.venueStyle === 'outdoor' && !venueText.toLowerCase().includes('outdoor') && !venueText.toLowerCase().includes('garden')) return false;
        if (filters.venueStyle === 'urban' && !venueText.toLowerCase().includes('urban')) return false;
        if (filters.venueStyle === 'luxury' && !venueText.toLowerCase().includes('luxury')) return false;
      }
     
      return true;
    });
  };
 
  const addMarkers = (venues, mapParamDirect = null) => {
    clearMarkers();
   
    const currentMap = mapParamDirect || mapInstance.current || map;
   
    if (!currentMap || !window.google) {
      console.error("Map not available for adding markers");
      return;
    }
   
    console.log("Adding markers using map:", currentMap ? "available" : "not available");
   
    const newMarkers = venues.map(venue => {
      if (!venue.geometry || !venue.geometry.location) return null;
     
      try {
        let marker;
       
        if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
          console.log("Using AdvancedMarkerElement");
          marker = new window.google.maps.marker.AdvancedMarkerElement({
            position: venue.geometry.location,
            map: currentMap,
            title: venue.name
          });
         
          marker.addListener('gm_click', () => {
            getVenueDetails(venue.place_id);
          });
        } else {
          console.log("Using regular Marker (deprecated)");
          marker = new window.google.maps.Marker({
            position: venue.geometry.location,
            map: currentMap,
            title: venue.name
          });
         
          marker.addListener('click', () => {
            getVenueDetails(venue.place_id);
          });
        }
       
        return marker;
      } catch (error) {
        console.error("Error creating marker:", error);
        return null;
      }
    }).filter(Boolean);
   
    setMarkers(newMarkers);
  };
 
  const clearMarkers = () => {
    markers.forEach(marker => {
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
 
  const getVenueDetails = async (placeId) => {
    if (!placesService.current || !placeId) return;
  
    const request = {
      placeId: placeId,
      fields: [
        'name', 'formatted_address', 'formatted_phone_number',
        'website', 'photos', 'rating', 'reviews',
        'opening_hours', 'price_level', 'user_ratings_total',
        'geometry', 'vicinity', 'url', 'photo'
      ],
      language: isRTL ? 'he' : 'en' 
    };
  
    placesService.current.getDetails(request, async (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        console.log("Venue details loaded:", place.name);
        
        let processedPlace = { ...place };
        
        if (containsHebrew(place.name)) {
          processedPlace.originalName = place.name;
        }
        
        if (place.formatted_address && containsHebrew(place.formatted_address)) {
          processedPlace.originalFormattedAddress = place.formatted_address;
        }
        
        if (place.vicinity && containsHebrew(place.vicinity)) {
          processedPlace.originalVicinity = place.vicinity;
        }
        
        if (isEnglish) {
          if (containsHebrew(place.name)) {
            processedPlace.name = await translateText(place.name, 'en');
          }
          
          if (place.formatted_address && containsHebrew(place.formatted_address)) {
            processedPlace.formatted_address = await translateText(place.formatted_address, 'en');
          }
          
          if (place.vicinity && containsHebrew(place.vicinity)) {
            processedPlace.vicinity = await translateText(place.vicinity, 'en');
          }
          
          if (place.opening_hours && place.opening_hours.weekday_text) {
            processedPlace.opening_hours = {
              ...place.opening_hours,
              weekday_text: await Promise.all(
                place.opening_hours.weekday_text.map(async (day) => {
                  if (containsHebrew(day)) {
                    return await translateText(day, 'en');
                  }
                  return day;
                })
              )
            };
          }
        }
        
        setSelectedVenue(processedPlace);
        
        if (selectedVenuePhotoIndex !== null) {
          setSelectedPhoto(selectedVenuePhotoIndex);
        } else {
          setSelectedPhoto(0);
        }
      } else {
        console.error("Failed to get venue details:", status);
      }
    });
  };
 
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };
 
  const handleSearchSubmit = (e) => {
    e.preventDefault();
   
    if (!geocoder.current) {
      console.error("Geocoder not initialized");
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        geocoder.current = new window.google.maps.Geocoder();
      } else {
        console.error("Google Maps Geocoder API not available");
        return;
      }
    }
   
    const geocodeRequest = {
      address: search,
      language: 'en',
      region: 'IL'
    };
   
    geocoder.current.geocode(geocodeRequest, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        const currentMap = mapInstance.current || map;
        if (currentMap) {
          currentMap.setCenter(location);
        }
        searchVenues(location, filters.venueType, currentMap);
      } else {
        const currentMap = mapInstance.current || map;
        if (currentMap && currentMap.getCenter) {
          searchVenues(currentMap.getCenter(), filters.venueType, currentMap);
        } else {
          searchVenues({ lat: 31.7683, lng: 35.2137 }, filters.venueType, currentMap);
        }
      }
    });
  };
 
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
 
  const applyFilters = () => {
    const currentMap = mapInstance.current || map;
 
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
          searchVenues({ lat: 31.7683, lng: 35.2137 }, filters.venueType, currentMap);
        }
      );
    } else {
      searchVenues({ lat: 31.7683, lng: 35.2137 }, filters.venueType, currentMap);
    }
  };
 
  const selectVenue = (venue) => {
    try {
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
     
      if (onSelectVenue && typeof onSelectVenue === 'function') {
        onSelectVenue(venueData);
        setSuccessMessage(t('venues.venueAddedSuccess'));
       
        setTimeout(() => {
          setSelectedVenue(null);
        }, 2000);
      } else {
        localStorage.setItem('selectedVenue', JSON.stringify(venueData));
        navigate('/create-event', { state: { venue: venueData } });
      }
    } catch (error) {
      console.error("Error selecting venue:", error);
    }
  };
 
  const getPhotoUrl = (photo, maxWidth = 300, maxHeight = 200, useHighQuality = false) => {
    try {
      if (photo && typeof photo.getUrl === 'function') {
        if (useHighQuality) {
          return photo.getUrl({ maxWidth: Math.max(maxWidth, 500), maxHeight: Math.max(maxHeight, 300) });
        }
        return photo.getUrl({ maxWidth, maxHeight });
      }
    } catch (error) {
      console.error("Error getting photo URL:", error);
    }
    
    return null;
  };

  const getMainVenueImage = (venue) => {
    if (!venue.photos || venue.photos.length === 0) {
      return null;
    }

    try {
      for (let i = 0; i < venue.photos.length; i++) {
        const imageUrl = getPhotoUrl(venue.photos[i], 300, 200, true);
        if (imageUrl) {
          return { url: imageUrl, index: i };
        }
      }
    } catch (error) {
      console.error("Error getting main venue image:", error);
    }

    return null;
  };

  const getValidPhotos = (venue) => {
    if (!venue.photos || venue.photos.length === 0) {
      return [];
    }

    const validPhotos = [];
    for (let i = 0; i < venue.photos.length; i++) {
      try {
        const photoUrl = getPhotoUrl(venue.photos[i], 100, 70);
        if (photoUrl) {
          validPhotos.push({ photo: venue.photos[i], url: photoUrl, index: i });
        }
      } catch (error) {
        console.error("Error getting photo at index", i, error);
      }
    }

    return validPhotos;
  };
 
  return (
    <div className="venue-page">
      <div className="venue-header">
        <h1>{t('venues.searchTitle')}</h1>
        <p>{t('venues.searchSubtitle')}</p>
      </div>
     
      <div className="venue-search-container">
        <form onSubmit={handleSearchSubmit} className="venue-search-form">
          <input
            type="text"
            placeholder={t('venues.searchPlaceholder')}
            value={search}
            onChange={handleSearchChange}
            className="venue-search-input"
          />
          <button type="submit" className="venue-search-button">{t('venues.searchButton')}</button>
        </form>
      </div>
     
      <div className="venue-content">
        <div className="venue-filters">
          <h3>{t('venues.filtersTitle')}</h3>
         
          {/* Area */}
          <div className="filter-group">
            <label htmlFor="area">{t('venues.filters.areaLabel')}</label>
            <select
              id="area"
              name="area"
              value={filters.area}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="all">{t('venues.filters.allAreas')}</option>
              <option value="ירושלים">{t('venues.filters.jerusalem')}</option>
              <option value="מרכז">{t('venues.filters.center')}</option>
              <option value="דרום">{t('venues.filters.south')}</option>
              <option value="צפון">{t('venues.filters.north')}</option>
            </select>
          </div>
         
          {/* Venue Type */}
          <div className="filter-group">
            <label htmlFor="venueType">{t('venues.filters.typeLabel')}</label>
            <select
              id="venueType"
              name="venueType"
              value={filters.venueType}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="all">{t('venues.filters.allTypes')}</option>
              <option value="restaurant">{t('venues.filters.restaurant')}</option>
              <option value="event_venue">{t('venues.filters.eventVenue')}</option>
              <option value="banquet_hall">{t('venues.filters.banquetHall')}</option>
              <option value="hotel">{t('venues.filters.hotel')}</option>
              <option value="park">{t('venues.filters.park')}</option>
              <option value="museum">{t('venues.filters.museum')}</option>
            </select>
          </div>
         
          {/* Venue Style */}
          <div className="filter-group">
            <label htmlFor="venueStyle">{t('venues.filters.styleLabel')}</label>
            <select
              id="venueStyle"
              name="venueStyle"
              value={filters.venueStyle}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="all">{t('venues.filters.allStyles')}</option>
              <option value="modern">{t('venues.filters.modern')}</option>
              <option value="classic">{t('venues.filters.classic')}</option>
              <option value="outdoor">{t('venues.filters.outdoor')}</option>
              <option value="urban">{t('venues.filters.urban')}</option>
              <option value="luxury">{t('venues.filters.luxury')}</option>
            </select>
          </div>
         
          {/* Capacity */}
          <div className="filter-group">
            <label htmlFor="capacity">{t('venues.filters.capacityLabel')}</label>
            <select
              id="capacity"
              name="capacity"
              value={filters.capacity}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="">{t('venues.filters.selectCapacity')}</option>
              <option value="50">{t('venues.filters.upTo50')}</option>
              <option value="100">{t('venues.filters.upTo100')}</option>
              <option value="200">{t('venues.filters.upTo200')}</option>
              <option value="300">{t('venues.filters.upTo300')}</option>
              <option value="500">{t('venues.filters.upTo500')}</option>
              <option value="1000">{t('venues.filters.above500')}</option>
            </select>
          </div>
         
          {/* Amenities */}
          <div className="filter-group amenities-group">
            <label>{t('venues.filters.amenitiesLabel')}</label>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="parking"
                  checked={filters.amenities.parking}
                  onChange={handleFilterChange}
                />
                {t('venues.filters.parking')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="accessibility"
                  checked={filters.amenities.accessibility}
                  onChange={handleFilterChange}
                />
                {t('venues.filters.accessibility')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="outdoorSpace"
                  checked={filters.amenities.outdoorSpace}
                  onChange={handleFilterChange}
                />
                {t('venues.filters.outdoorSpace')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="catering"
                  checked={filters.amenities.catering}
                  onChange={handleFilterChange}
                />
                {t('venues.filters.catering')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="accommodation"
                  checked={filters.amenities.accommodation}
                  onChange={handleFilterChange}
                />
                {t('venues.filters.accommodation')}
              </label>
            </div>
          </div>
         
          <button className="filter-apply-button" onClick={applyFilters}>{t('venues.filters.applyButton')}</button>
        </div>
       
        <div className="venue-results-container">
          <div className="venue-map" ref={mapRef}></div>
         
          <div className="venue-list">
            <h3>{t('venues.searchResults')}</h3>
           
            {loading ? (
              <div className="loading-indicator">
                <div className="loading-spinner"></div>
                <p>{t('venues.loading')}</p>
              </div>
            ) : venues.length === 0 ? (
              <div className="no-results">{t('venues.noResults')}</div>
            ) : (
              <div className="venues-grid">
                {venues.map(venue => {
                  const mainImageData = getMainVenueImage(venue);
                  
                  return (
                    <div
                      key={venue.place_id}
                      className={`venue-card ${selectedVenue && selectedVenue.place_id === venue.place_id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedVenuePhotoIndex(mainImageData ? mainImageData.index : null);
                        getVenueDetails(venue.place_id);
                      }}
                    >
                      <div className="venue-image">
                        {mainImageData && mainImageData.url ? (
                          <img
                            src={mainImageData.url}
                            alt={venue.name}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://dummyimage.com/300x200/eeeeee/333333&text=${encodeURIComponent(venue.name || t('venues.defaultVenueName'))}`;
                            }}
                          />
                        ) : (
                          <img
                            src={`https://dummyimage.com/300x200/eeeeee/333333&text=${encodeURIComponent(venue.name || t('venues.defaultVenueName'))}`}
                            alt={venue.name || t('venues.defaultVenueName')}
                          />
                        )}
                      </div>
                     
                      <div className="venue-info">
                        <h4>{venue.name}</h4>
                        <p className="venue-address">
                          {venue.formatted_address || venue.vicinity || t('venues.noAddress')}
                        </p>
                       
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
       
        {selectedVenue && (
          <div className="venue-details">
            <div className="venue-details-content">
              <div className="venue-details-header">
                <h2>{selectedVenue.name}</h2>
                <button className="close-details" onClick={() => {
                  setSelectedVenue(null);
                  setSelectedVenuePhotoIndex(null);
                }}>×</button>
              </div>
             
              {/* Success message */}
              {successMessage && (
                <div className="success-message">
                  {successMessage}
                </div>
              )}
             
              <div className="venue-details-content">
                <div className="venue-photos">
                  <div className="main-photo">
                    {selectedVenue.photos && selectedVenue.photos.length > 0 ? (
                      (() => {
                        const validPhotos = getValidPhotos(selectedVenue);
                        if (validPhotos.length > 0) {
                          const photoIndex = Math.min(selectedPhoto, validPhotos.length - 1);
                          const photoToShow = validPhotos[photoIndex];
                          
                          return (
                            <img
                              src={getPhotoUrl(photoToShow.photo, 600, 400, true)}
                              alt={selectedVenue.name}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVenue.name || t('venues.defaultVenueName'))}`;
                              }}
                            />
                          );
                        } else {
                          return (
                            <img
                              src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVenue.name || t('venues.defaultVenueName'))}`}
                              alt={selectedVenue.name || t('venues.defaultVenueName')}
                            />
                          );
                        }
                      })()
                    ) : (
                      <img
                        src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVenue.name || t('venues.defaultVenueName'))}`}
                        alt={selectedVenue.name || t('venues.defaultVenueName')}
                      />
                    )}
                  </div>
                  
                  {selectedVenue.photos && selectedVenue.photos.length > 0 && getValidPhotos(selectedVenue).length > 0 && (
                    <div className="all-photos">
                      {getValidPhotos(selectedVenue).map(({ photo, url, index }) => (
                        <img
                          key={index}
                          src={url}
                          alt={`${selectedVenue.name} - ${index + 1}`}
                          className={`thumbnail-photo ${selectedPhoto === index ? 'selected' : ''}`}
                          onClick={() => setSelectedPhoto(index)}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                            
                <div className="venue-info-detailed">
                  <p className="address">
                    <strong>{t('venues.details.address')}:</strong> {
                      isRTL && selectedVenue.originalFormattedAddress ? 
                      selectedVenue.originalFormattedAddress : 
                      selectedVenue.formatted_address || selectedVenue.vicinity
                    }
                  </p>
                 
                  {selectedVenue.formatted_phone_number && (
                    <p className="phone">
                      <strong>{t('venues.details.phone')}:</strong> {selectedVenue.formatted_phone_number}
                    </p>
                  )}
                 
                  {selectedVenue.website && (
                    <p className="website">
                      <strong>{t('venues.details.website')}:</strong> <a href={selectedVenue.website} target="_blank" rel="noopener noreferrer">{selectedVenue.website}</a>
                    </p>
                  )}
                 
                  {selectedVenue.rating && (
                    <p className="rating-details">
                      <strong>{t('venues.details.rating')}:</strong> {selectedVenue.rating} {t('venues.details.outOf5')} ({selectedVenue.user_ratings_total} {t('venues.details.reviews')})
                    </p>
                  )}
                 
                  {selectedVenue.price_level && (
                    <p className="price-details">
                      <strong>{t('venues.details.priceLevel')}:</strong> {'$'.repeat(selectedVenue.price_level)}
                    </p>
                  )}
                 
                  {selectedVenue.opening_hours && selectedVenue.opening_hours.weekday_text && (
                    <div className="opening-hours">
                      <strong>{t('venues.details.openingHours')}:</strong>
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
                    <h3>{t('venues.details.reviewsTitle')}</h3>
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
                  {!successMessage && (
                    <button className="select-venue-button" onClick={() => selectVenue(selectedVenue)}>
                      {t('venues.selectButton')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenuePage;