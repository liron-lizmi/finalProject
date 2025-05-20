// pages/Events/VendorsPage.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../styles/VendorsPage.css';

window.googleMapsLoaded = window.googleMapsLoaded || false;

const VendorsPage = ({ onSelectVendor }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [map, setMap] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedVendorPhotoIndex, setSelectedVendorPhotoIndex] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
 
  const eventId = location.state?.eventId;
  
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';
  const isEnglish = i18n.language === 'en' || i18n.language === 'en-US';
 
  const [filters, setFilters] = useState({
    area: 'all',
    vendorType: 'all',
    category: 'all',
    amenities: {
      delivery: false,
      kosher: false,
      vegan: false,
      discount: false
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
        center: { lat: 31.7683, lng: 35.2137 }, 
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
                searchVendors(userLocation, filters.category, newMap);
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
                searchVendors(mapOptions.center, filters.category, newMap);
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
            searchVendors(mapOptions.center, filters.category, newMap);
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

  const searchVendors = async (location, category, mapParamDirect = null) => {
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
    switch (category) {
      case 'catering':
        query = 'catering service restaurant';
        break;
      case 'photography':
        query = 'photographer photography studio';
        break;
      case 'music':
        query = 'dj music band';
        break;
      case 'decoration':
        query = 'event decoration design';
        break;
      case 'lighting':
        query = 'event lighting';
        break;
      case 'flowers':
        query = 'florist flower shop';
        break;
      default:
        query = 'event services';
        break;
    }
   
    if (filters.area !== 'all') {
      switch (filters.area) {
        case 'ירושלים והסביבה':
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
          console.log("Found", results.length, "vendors");
         
          const processedResults = await Promise.all(results.map(async vendor => {
            let processedVendor = { ...vendor };
            
            processedVendor.category = category || 'other';
            
            if (containsHebrew(vendor.name)) {
              processedVendor.originalName = vendor.name;
            }
            
            if (vendor.vicinity && containsHebrew(vendor.vicinity)) {
              processedVendor.originalVicinity = vendor.vicinity;
            }
            
            if (vendor.formatted_address && containsHebrew(vendor.formatted_address)) {
              processedVendor.originalFormattedAddress = vendor.formatted_address;
            }
            
            if (isEnglish && containsHebrew(vendor.name)) {
              processedVendor.name = await translateText(vendor.name, 'en');
            }
            
            if (isEnglish && vendor.vicinity && containsHebrew(vendor.vicinity)) {
              processedVendor.vicinity = await translateText(vendor.vicinity, 'en');
            }
            
            if (isEnglish && vendor.formatted_address && containsHebrew(vendor.formatted_address)) {
              processedVendor.formatted_address = await translateText(vendor.formatted_address, 'en');
            }
            
            return processedVendor;
          }));
         
          const filteredResults = filterVendors(processedResults);
         
          setVendors(filteredResults);
         
          const currentMap = mapParamDirect || mapInstance.current || map;
          addMarkers(filteredResults, currentMap);
        } else {
          console.error("Search failed:", status);
          setVendors([]);
         
          clearMarkers();
        }
       
        setLoading(false);
      });
    } catch (error) {
      console.error("Search execution error:", error);
      setLoading(false);
    }
  };
 
  const filterVendors = (vendors) => {
    return vendors.filter(vendor => {
      if (Object.values(filters.amenities).some(val => val)) {
        const vendorText = vendor.name + ' ' + (vendor.vicinity || '') + ' ' + (vendor.formatted_address || '');
       
        if (filters.amenities.delivery && !vendorText.toLowerCase().includes('deliver')) return false;
        if (filters.amenities.kosher && !vendorText.toLowerCase().includes('kosher')) return false;
        if (filters.amenities.vegan && !vendorText.toLowerCase().includes('vegan')) return false;
        if (filters.amenities.discount && !vendorText.toLowerCase().includes('discount')) return false;
      }
     
      return true;
    });
  };
 
  const addMarkers = (vendors, mapParamDirect = null) => {
    clearMarkers();
   
    const currentMap = mapParamDirect || mapInstance.current || map;
   
    if (!currentMap || !window.google) {
      console.error("Map not available for adding markers");
      return;
    }
   
    console.log("Adding markers using map:", currentMap ? "available" : "not available");
   
    const newMarkers = vendors.map(vendor => {
        if (!vendor.geometry || !vendor.geometry.location) return null;
     
        try {
          let marker;
         
          if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
            console.log("Using AdvancedMarkerElement");
            marker = new window.google.maps.marker.AdvancedMarkerElement({
              position: vendor.geometry.location,
              map: currentMap,
              title: vendor.name
            });
           
            marker.addListener('gm_click', () => {
              getVendorDetails(vendor.place_id);
            });
          } else {
            console.log("Using regular Marker (deprecated)");
            marker = new window.google.maps.Marker({
              position: vendor.geometry.location,
              map: currentMap,
              title: vendor.name
            });
           
            marker.addListener('click', () => {
              getVendorDetails(vendor.place_id);
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
   
    const getVendorDetails = async (placeId) => {
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
          console.log("Vendor details loaded:", place.name);
          
          // Find the vendor in our list to get its category
          const vendorInList = vendors.find(v => v.place_id === placeId);
          const category = vendorInList ? vendorInList.category : filters.category || 'other';
          
          let processedPlace = { ...place, category };
          
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
          
          setSelectedVendor(processedPlace);
          
          if (selectedVendorPhotoIndex !== null) {
            setSelectedPhoto(selectedVendorPhotoIndex);
          } else {
            setSelectedPhoto(0);
          }
        } else {
          console.error("Failed to get vendor details:", status);
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
          searchVendors(location, filters.category, currentMap);
        } else {
          const currentMap = mapInstance.current || map;
          if (currentMap && currentMap.getCenter) {
            searchVendors(currentMap.getCenter(), filters.category, currentMap);
          } else {
            searchVendors({ lat: 31.7683, lng: 35.2137 }, filters.category, currentMap);
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
        searchVendors(currentMap.getCenter(), filters.category, currentMap);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            searchVendors(userLocation, filters.category, currentMap);
          },
          () => {
            searchVendors({ lat: 31.7683, lng: 35.2137 }, filters.category, currentMap);
          }
        );
      } else {
        searchVendors({ lat: 31.7683, lng: 35.2137 }, filters.category, currentMap);
      }
    };
   
    const selectVendor = (vendor) => {
      try {

        const category = vendor.category; 
        const vendorCategory = (category === 'all' || !category) ? 'other' : category;

        const vendorData = {
          place_id: vendor.place_id,
          id: vendor.place_id,
          name: vendor.name,
          category: vendorCategory,
          address: vendor.formatted_address || vendor.vicinity,
          phone: vendor.formatted_phone_number || '',
          website: vendor.website || '',
          rating: vendor.rating || 0,
          price_level: vendor.price_level || 0
        };
       
        if (onSelectVendor && typeof onSelectVendor === 'function') {
          onSelectVendor(vendorData);
          setSuccessMessage(t('events.features.vendors.vendorAddedSuccess'));
         
          setTimeout(() => {
            setSelectedVendor(null);
          }, 2000);
        } else {
          localStorage.setItem('selectedVendor', JSON.stringify(vendorData));
          navigate('/create-event', { state: { vendor: vendorData } });
        }
      } catch (error) {
        console.error("Error selecting vendor:", error);
      }
    };
    
    const getCategoryIcon = (category) => {
      switch(category?.toLowerCase()) {
        case 'catering':
          return '🍽️';
        case 'photography':
          return '📸';
        case 'music':
          return '🎵';
        case 'decoration':
          return '🎨';
        case 'lighting':
          return '💡';
        case 'flowers':
          return '💐';
        default:
          return '👨‍🍳';
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
  
    const getMainVendorImage = (vendor) => {
      if (!vendor.photos || vendor.photos.length === 0) {
        return null;
      }
  
      try {
        for (let i = 0; i < vendor.photos.length; i++) {
          const imageUrl = getPhotoUrl(vendor.photos[i], 300, 200, true);
          if (imageUrl) {
            return { url: imageUrl, index: i };
          }
        }
      } catch (error) {
        console.error("Error getting main vendor image:", error);
      }
  
      return null;
    };
  
    const getValidPhotos = (vendor) => {
      if (!vendor.photos || vendor.photos.length === 0) {
        return [];
      }
  
      const validPhotos = [];
      for (let i = 0; i < vendor.photos.length; i++) {
        try {
          const photoUrl = getPhotoUrl(vendor.photos[i], 100, 70);
          if (photoUrl) {
            validPhotos.push({ photo: vendor.photos[i], url: photoUrl, index: i });
          }
        } catch (error) {
          console.error("Error getting photo at index", i, error);
        }
      }
  
      return validPhotos;
    };
   
    return (
      <div className="vendors-page">
        <div className="vendors-header">
          <h1>{t('events.features.vendors.title')}</h1>
          <p>{t('events.features.vendors.description')}</p>
        </div>
       
        <div className="vendors-search-container">
          <form onSubmit={handleSearchSubmit} className="vendors-search-form">
            <input
              type="text"
              placeholder={t('events.features.vendors.searchPlaceholder')}
              value={search}
              onChange={handleSearchChange}
              className="vendors-search-input"
            />
            <button type="submit" className="vendors-search-button">{t('events.features.vendors.searchButton')}</button>
          </form>
        </div>
       
        <div className="vendors-content">
          <div className="vendors-filters">
            <h3>{t('events.features.vendors.filtersTitle')}</h3>
           
            {/* Area */}
            <div className="filter-group">
              <label htmlFor="area">{t('events.features.vendors.filters.areaLabel')}</label>
              <select
                id="area"
                name="area"
                value={filters.area}
                onChange={handleFilterChange}
                className={isRTL ? 'rtl-select' : 'ltr-select'}
              >
                <option value="all">{t('events.features.vendors.filters.allAreas')}</option>
                <option value="ירושלים והסביבה">{t('events.features.vendors.filters.jerusalem')}</option>
                <option value="מרכז">{t('events.features.vendors.filters.center')}</option>
                <option value="דרום">{t('events.features.vendors.filters.south')}</option>
                <option value="צפון">{t('events.features.vendors.filters.north')}</option>
              </select>
            </div>
           
            {/* Vendor Category */}
            <div className="filter-group">
              <label htmlFor="category">{t('events.features.vendors.filters.categoryLabel')}</label>
              <select
                id="category"
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className={isRTL ? 'rtl-select' : 'ltr-select'}
              >
                <option value="all">{t('events.features.vendors.filters.allCategories')}</option>
                <option value="catering">{t('events.features.vendors.categories.catering')}</option>
                <option value="photography">{t('events.features.vendors.categories.photography')}</option>
                <option value="music">{t('events.features.vendors.categories.music')}</option>
                <option value="decoration">{t('events.features.vendors.categories.decoration')}</option>
                <option value="lighting">{t('events.features.vendors.categories.lighting')}</option>
                <option value="flowers">{t('events.features.vendors.categories.flowers')}</option>
              </select>
            </div>
           
            {/* Amenities */}
            <div className="filter-group amenities-group">
              <label>{t('events.features.vendors.filters.amenitiesLabel')}</label>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="delivery"
                    checked={filters.amenities.delivery}
                    onChange={handleFilterChange}
                  />
                  {t('events.features.vendors.filters.delivery')}
                </label>
               
                <label>
                  <input
                    type="checkbox"
                    name="kosher"
                    checked={filters.amenities.kosher}
                    onChange={handleFilterChange}
                  />
                  {t('events.features.vendors.filters.kosher')}
                </label>
               
                <label>
                  <input
                    type="checkbox"
                    name="vegan"
                    checked={filters.amenities.vegan}
                    onChange={handleFilterChange}
                  />
                  {t('events.features.vendors.filters.vegan')}
                </label>
               
                <label>
                  <input
                    type="checkbox"
                    name="discount"
                    checked={filters.amenities.discount}
                    onChange={handleFilterChange}
                  />
                  {t('events.features.vendors.filters.discount')}
                </label>
              </div>
            </div>
           
            <button className="filter-apply-button" onClick={applyFilters}>{t('events.features.vendors.filters.applyButton')}</button>
          </div>
         
          <div className="vendors-results-container">
            <div className="vendors-map" ref={mapRef}></div>
           
            <div className="vendors-list">
              <h3>{t('events.features.vendors.searchResults')}</h3>
             
              {loading ? (
                <div className="loading-indicator">
                  <div className="loading-spinner"></div>
                  <p>{t('events.features.vendors.loading')}</p>
                </div>
              ) : vendors.length === 0 ? (
                <div className="no-results">{t('events.features.vendors.noResults')}</div>
              ) : (
                <div className="vendors-grid">
                  {vendors.map(vendor => {
                    const mainImageData = getMainVendorImage(vendor);
                    const categoryIcon = getCategoryIcon(vendor.category);
                    
                    return (
                      <div
                        key={vendor.place_id}
                        className={`vendor-card ${selectedVendor && selectedVendor.place_id === vendor.place_id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedVendorPhotoIndex(mainImageData ? mainImageData.index : null);
                          getVendorDetails(vendor.place_id);
                        }}
                      >
                        <div className="vendor-category-badge">
                          <span className="category-icon">{categoryIcon}</span>
                        </div>
                        
                        <div className="vendor-image">
                          {mainImageData && mainImageData.url ? (
                            <img
                              src={mainImageData.url}
                              alt={vendor.name}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://dummyimage.com/300x200/eeeeee/333333&text=${encodeURIComponent(vendor.name || t('vendors.defaultVendorName'))}`;
                              }}
                            />
                          ) : (
                            <img
                              src={`https://dummyimage.com/300x200/eeeeee/333333&text=${encodeURIComponent(vendor.name || t('vendors.defaultVendorName'))}`}
                              alt={vendor.name || t('vendors.defaultVendorName')}
                            />
                          )}
                        </div>
                       
                        <div className="vendor-info">
                          <h4>{vendor.name}</h4>
                          <p className="vendor-address">
                            {vendor.formatted_address || vendor.vicinity || t('events.features.vendors.noAddress')}
                          </p>
                         
                          {vendor.rating && (
                            <div className="vendor-rating">
                              <span className="stars">
                                {Array(Math.floor(vendor.rating)).fill().map((_, i) => (
                                  <span key={i} className="star">★</span>
                                ))}
                                {vendor.rating % 1 > 0 && <span className="star half">★</span>}
                              </span>
                              <span className="rating-value">{vendor.rating}</span>
                              <span className="review-count">({vendor.user_ratings_total || 0})</span>
                            </div>
                          )}
                         
                          {vendor.price_level && (
                            <div className="vendor-price">
                              {'$'.repeat(vendor.price_level)}
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
         
          {selectedVendor && (
            <div className="vendor-details">
              <div className="vendor-details-content">
                <div className="vendor-details-header">
                  <div className="vendor-title-section">
                    <span className="vendor-category-icon">{getCategoryIcon(selectedVendor.category)}</span>
                    <h2>{selectedVendor.name}</h2>
                  </div>
                  <button className="close-details" onClick={() => {
                    setSelectedVendor(null);
                    setSelectedVendorPhotoIndex(null);
                  }}>×</button>
                </div>
               
                {/* Success message */}
                {successMessage && (
                  <div className="success-message">
                    {successMessage}
                  </div>
                )}
               
                <div className="vendor-details-body">
                  <div className="vendor-photos">
                    <div className="main-photo">
                      {selectedVendor.photos && selectedVendor.photos.length > 0 ? (
                        (() => {
                          const validPhotos = getValidPhotos(selectedVendor);
                          if (validPhotos.length > 0) {
                            const photoIndex = Math.min(selectedPhoto, validPhotos.length - 1);
                            const photoToShow = validPhotos[photoIndex];
                            
                            return (
                              <img
                                src={getPhotoUrl(photoToShow.photo, 600, 400, true)}
                                alt={selectedVendor.name}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || t('events.features.vendors.defaultVendorName'))}`;
                                }}
                              />
                            );
                          } else {
                            return (
                              <img
                                src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || t('events.features.vendors.defaultVendorName'))}`}
                                alt={selectedVendor.name || t('vendors.defaultVendorName')}
                              />
                            );
                          }
                        })()
                      ) : (
                        <img
                          src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || t('events.features.vendors.defaultVendorName'))}`}
                          alt={selectedVendor.name || t('vendors.defaultVendorName')}
                        />
                      )}
                    </div>
                    
                    {selectedVendor.photos && selectedVendor.photos.length > 0 && getValidPhotos(selectedVendor).length > 0 && (
                      <div className="all-photos">
                        {getValidPhotos(selectedVendor).map(({ photo, url, index }) => (
                          <img
                            key={index}
                            src={url}
                            alt={`${selectedVendor.name} - ${index + 1}`}
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
                              
                  <div className="vendor-info-detailed">
                    <p className="category">
                      <strong>{t('events.features.vendors.vendorDetails.category')}:</strong> {t(`events.features.vendors.categories.${selectedVendor.category?.toLowerCase()}`) || selectedVendor.category}
                    </p>
                    
                    <p className="address">
                      <strong>{t('events.features.vendors.details.address')}:</strong> {
                        isRTL && selectedVendor.originalFormattedAddress ? 
                        selectedVendor.originalFormattedAddress : 
                        selectedVendor.formatted_address || selectedVendor.vicinity
                      }
                    </p>
                   
                    {selectedVendor.formatted_phone_number && (
                      <p className="phone">
                        <strong>{t('events.features.vendors.details.phone')}:</strong> {selectedVendor.formatted_phone_number}
                      </p>
                    )}
                   
                    {selectedVendor.website && (
                      <p className="website">
                        <strong>{t('events.features.vendors.details.website')}:</strong> <a href={selectedVendor.website} target="_blank" rel="noopener noreferrer">{selectedVendor.website}</a>
                      </p>
                    )}
                   
                    {selectedVendor.rating && (
                      <p className="rating-details">
                        <strong>{t('events.features.vendors.details.rating')}:</strong> {selectedVendor.rating} {t('events.features.vendors.details.outOf5')} ({selectedVendor.user_ratings_total} {t('events.features.vendors.details.reviews')})
                      </p>
                    )}
                   
                    {selectedVendor.price_level && (
                      <p className="price-details">
                        <strong>{t('events.features.vendors.details.priceLevel')}:</strong> {'$'.repeat(selectedVendor.price_level)}
                      </p>
                    )}
                   
                    {selectedVendor.opening_hours && selectedVendor.opening_hours.weekday_text && (
                      <div className="opening-hours">
                        <strong>{t('events.features.vendors.details.openingHours')}:</strong>
                        <ul>
                          {selectedVendor.opening_hours.weekday_text.map((day, index) => (
                            <li key={index}>{day}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                 
                  {selectedVendor.reviews && selectedVendor.reviews.length > 0 && (
                    <div className="vendor-reviews">
                      <h3>{t('events.features.vendors.details.reviewsTitle')}</h3>
                      <div className="reviews-list">
                        {selectedVendor.reviews.slice(0, 3).map((review, index) => (
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
                 
                  <div className="vendor-actions">
                    {!successMessage && (
                      <button className="select-vendor-button" onClick={() => selectVendor(selectedVendor)}>
                        {t('events.features.vendors.selectButton')}
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
  
  export default VendorsPage;