import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../styles/VendorsPage.css';
import vendorService from '../../services/vendorService';
import { translateItems, containsHebrew, translateText } from '../../services/translationUtils';

window.googleMapsLoaded = window.googleMapsLoaded || false;

const VendorsPage = ({ onSelectVendor }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [map, setMap] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [displayedVendors, setDisplayedVendors] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [selectedVendorMainPhoto, setSelectedVendorMainPhoto] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';
  const isEnglish = i18n.language === 'en' || i18n.language === 'en-US';
  
  const [filters, setFilters] = useState({
    area: 'all',
    vendorType: 'all',
    specificFilters: [],
    kashrutLevel: 'all'
  });

  const getMapStyles = () => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    
    return [
      { 
        elementType: "geometry", 
        stylers: [{ color: styles.getPropertyValue('--map-geometry-color').trim() || "#f5f5f5" }] 
      },
      { 
        elementType: "labels.text.fill", 
        stylers: [{ color: styles.getPropertyValue('--map-text-color').trim() || "#333333" }] 
      },
      { 
        featureType: "road", 
        elementType: "geometry", 
        stylers: [{ color: styles.getPropertyValue('--map-road-color').trim() || "#ffffff" }] 
      },
      { 
        featureType: "road", 
        elementType: "geometry.stroke", 
        stylers: [{ color: styles.getPropertyValue('--map-road-stroke-color').trim() || "#dddddd" }] 
      },
      { 
        featureType: "water", 
        elementType: "geometry", 
        stylers: [{ color: styles.getPropertyValue('--map-water-color').trim() || "#e0e0e0" }] 
      }
    ];
  };

  const getSpecificFilters = (vendorType) => {
    switch (vendorType) {
      case 'catering':
        return {
          labelKey: 'vendors.specificFilters.catering.title',
          options: [
            { value: 'dairy', labelKey: 'vendors.specificFilters.catering.dairy' },
            { value: 'meat', labelKey: 'vendors.specificFilters.catering.meat' },
            { value: 'pareve', labelKey: 'vendors.specificFilters.catering.pareve' },
            { value: 'vegan', labelKey: 'vendors.specificFilters.catering.vegan' },
            { value: 'vegetarian', labelKey: 'vendors.specificFilters.catering.vegetarian' },
            { value: 'gluten-free', labelKey: 'vendors.specificFilters.catering.glutenFree' }
          ]
        };
      case 'photographer':
        return {
          labelKey: 'vendors.specificFilters.photographer.title',
          options: [
            { value: 'wedding', labelKey: 'vendors.specificFilters.photographer.wedding' },
            { value: 'event', labelKey: 'vendors.specificFilters.photographer.event' },
            { value: 'portrait', labelKey: 'vendors.specificFilters.photographer.portrait' },
            { value: 'commercial', labelKey: 'vendors.specificFilters.photographer.commercial' }
          ]
        };
      case 'florist':
        return {
          labelKey: 'vendors.specificFilters.florist.title',
          options: [
            { value: 'bridal', labelKey: 'vendors.specificFilters.florist.bridal' },
            { value: 'arrangements', labelKey: 'vendors.specificFilters.florist.arrangements' },
            { value: 'decorations', labelKey: 'vendors.specificFilters.florist.decorations' },
            { value: 'plants', labelKey: 'vendors.specificFilters.florist.plants' }
          ]
        };
      case 'musician':
        return {
          labelKey: 'vendors.specificFilters.musician.title',
          options: [
            { value: 'solo', labelKey: 'vendors.specificFilters.musician.solo' },
            { value: 'band', labelKey: 'vendors.specificFilters.musician.band' },
            { value: 'classical', labelKey: 'vendors.specificFilters.musician.classical' },
            { value: 'modern', labelKey: 'vendors.specificFilters.musician.modern' },
            { value: 'traditional', labelKey: 'vendors.specificFilters.musician.traditional' }
          ]
        };
      case 'dj':
        return {
          labelKey: 'vendors.specificFilters.dj.title',
          options: [
            { value: 'wedding', labelKey: 'vendors.specificFilters.dj.wedding' },
            { value: 'party', labelKey: 'vendors.specificFilters.dj.party' },
            { value: 'corporate', labelKey: 'vendors.specificFilters.dj.corporate' },
            { value: 'with-equipment', labelKey: 'vendors.specificFilters.dj.withEquipment' }
          ]
        };
      case 'decorator':
        return {
          labelKey: 'vendors.specificFilters.decorator.title',
          options: [
            { value: 'balloons', labelKey: 'vendors.specificFilters.decorator.balloons' },
            { value: 'lighting', labelKey: 'vendors.specificFilters.decorator.lighting' },
            { value: 'furniture', labelKey: 'vendors.specificFilters.decorator.furniture' },
            { value: 'backdrops', labelKey: 'vendors.specificFilters.decorator.backdrops' }
          ]
        };
      case 'makeup':
        return {
          labelKey: 'vendors.specificFilters.makeup.title',
          options: [
            { value: 'bridal', labelKey: 'vendors.specificFilters.makeup.bridal' },
            { value: 'event', labelKey: 'vendors.specificFilters.makeup.event' },
            { value: 'with-hairstyling', labelKey: 'vendors.specificFilters.makeup.withHairstyling' },
            { value: 'mobile', labelKey: 'vendors.specificFilters.makeup.mobile' }
          ]
        };
      case 'transport':
        return {
          labelKey: 'vendors.specificFilters.transport.title',
          options: [
            { value: 'luxury-cars', labelKey: 'vendors.specificFilters.transport.luxuryCars' },
            { value: 'buses', labelKey: 'vendors.specificFilters.transport.buses' },
            { value: 'limousines', labelKey: 'vendors.specificFilters.transport.limousines' },
            { value: 'classic-cars', labelKey: 'vendors.specificFilters.transport.classicCars' }
          ]
        };
      default:
        return null;
    }
  };

  const getKashrutOptions = () => {
    return [
      { value: 'all', labelKey: 'vendors.specificFilters.catering.kashrut.all' },
      { value: 'mehadrin', labelKey: 'vendors.specificFilters.catering.kashrut.mehadrin' },
      { value: 'regular-kosher', labelKey: 'vendors.specificFilters.catering.kashrut.regularKosher' },
      { value: 'rabbinate', labelKey: 'vendors.specificFilters.catering.kashrut.rabbinate' },
      { value: 'badatz', labelKey: 'vendors.specificFilters.catering.kashrut.badatz' },
      { value: 'non-kosher', labelKey: 'vendors.specificFilters.catering.kashrut.nonKosher' }
    ];
  };

  const determineCategoryFromVendorType = (vendorType) => {
    switch (vendorType) {
      case 'catering':
        return 'catering';
      case 'photographer':
        return 'photography';
      case 'florist':
        return 'flowers';
      case 'musician':
        return 'music';
      case 'dj':
        return 'dj';
      case 'decorator':
        return 'decoration';
      case 'makeup':
        return 'makeup';
      case 'transport':
        return 'transportation';
      default:
        return 'other';
    }
  };

  const determineCategoryFromPlaceTypes = (types) => {
    if (!types || !Array.isArray(types)) return 'other';
    
    const typeMapping = {
      'restaurant': 'catering',
      'food': 'catering',
      'meal_takeaway': 'catering',
      'meal_delivery': 'catering',
      'bakery': 'catering',
      'cafe': 'catering',
      
      'photographer': 'photography',
      'photography': 'photography',
      
      'florist': 'flowers',
      'flower_shop': 'flowers',
      
      'musician': 'music',
      'music': 'music',
      'entertainment': 'music',
      
      'beauty_salon': 'makeup',
      'hair_care': 'makeup',
      'spa': 'makeup',
      
      'car_rental': 'transportation',
      'taxi_stand': 'transportation',
      'bus_station': 'transportation',
      'travel_agency': 'transportation',
      
      'event_planning': 'decoration',
      'establishment': 'decoration'
    };
    
    for (const type of types) {
      if (typeMapping[type]) {
        return typeMapping[type];
      }
    }
    
    return 'other';
  };

  const determineCategoryFromName = (name, description = '') => {
    const text = (name + ' ' + description).toLowerCase();
    
    const keywords = {
      catering: ['קייטרינג', 'אוכל', 'מזון', 'catering', 'food', 'restaurant', 'chef', 'cooking', 'מסעדה', 'בישול'],
      photography: ['צילום', 'צלם', 'photography', 'photographer', 'photo', 'camera', 'צילומים', 'מצלמה'],
      flowers: ['פרחים', 'זרים', 'flowers', 'florist', 'bouquet', 'floral', 'פרח', 'זר'],
      music: ['מוזיקה', 'נגן', 'תזמורת', 'music', 'musician', 'band', 'singer', 'נגנים'],
      dj: ['דיג\'יי', 'די ג\'יי', 'dj', 'disc jockey', 'sound', 'די-ג\'יי'],
      decoration: ['עיצוב', 'קישוט', 'decoration', 'design', 'decor', 'עיצובים', 'קישוטים', 'הפקה', 'events', 'הפקת אירועים', 'event planning', 'אירועים', 'ניהול אירועים', 'm-event', 'ניהול', 'תכנון אירועים', 'מפיק', 'הפקות'],
      lighting: ['תאורה', 'lighting', 'אור', 'תאורת', 'lights'],
      makeup: ['איפור', 'יופי', 'makeup', 'beauty', 'cosmetics', 'hair', 'מאפרת', 'שיער'],
      transportation: ['הסעות', 'רכב', 'transportation', 'car', 'bus', 'taxi', 'limousine', 'הסעה']
    };
    
    for (const [category, words] of Object.entries(keywords)) {
      if (words.some(word => text.includes(word))) {
        return category;
      }
    }
    
    return 'other';
  };
  
  const mapRef = useRef(null);
  const placesService = useRef(null);
  const geocoder = useRef(null);
  const scriptRef = useRef(null);
  const isMapInitialized = useRef(false);
  const isEffectRun = useRef(false);
  const mapInstance = useRef(null);

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
  }, [isRTL, i18n.language]);
  
  useEffect(() => {
    if (isEffectRun.current) return;
    isEffectRun.current = true;

    if (window.google && window.google.maps) {
      initMap();
    } else {
      const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

      if (!API_KEY) {
        console.error("Missing Google Maps API key");
        setLoading(false);
        return;
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');

      if (existingScript) {
        const checkGoogleMaps = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkGoogleMaps);
            initMap();
          }
        }, 100);

        setTimeout(() => clearInterval(checkGoogleMaps), 10000);
      } else {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&callback=initVendorsMapCallback&language=${isRTL ? 'he' : 'en'}&region=IL`;
        script.async = true;
        script.defer = true;

        window.initVendorsMapCallback = () => {
          initMap();
        };

        scriptRef.current = script;
        document.head.appendChild(script);
      }
    }
  
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
            }
          } catch (error) {
            console.error("Error clearing marker:", error);
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
      return;
    }
    
    isMapInitialized.current = true;
    
    try {
      const mapOptions = {
        center: { lat: 31.5, lng: 34.75 },
        zoom: 7
      };

      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);

      mapInstance.current = newMap;
      setMap(newMap);

      if (window.google.maps.Geocoder) {
        geocoder.current = new window.google.maps.Geocoder();
      }

      if (window.google.maps.places && window.google.maps.places.PlacesService) {
        const placesDiv = document.createElement('div');
        document.body.appendChild(placesDiv);
        placesService.current = new window.google.maps.places.PlacesService(placesDiv);
      }

      if (!initialLoadDone) {
        setInitialLoadDone(true);
        searchVendors(false);
      }
    } catch (error) {
      console.error("Error in initMap:", error);
      isMapInitialized.current = false;
      setLoading(false);
    }
  };

const searchVendors = async (shouldAppend = false) => {
  if (!shouldAppend) {
    setLoading(true);
    setDisplayedVendors([]);
    setCurrentPage(1);
  } else {
    setLoadingMore(true);
  }

  try {
    const pageToLoad = shouldAppend ? currentPage + 1 : 1;
        
    const result = await vendorService.searchVendors(
      filters,
      search,
      pageToLoad,
      'he'
    );

    let newVendors = result.vendors || [];
    
    if (isEnglish) {
      newVendors = await translateItems(newVendors, 'en');
    }
    
    if (shouldAppend) {
      const updatedVendors = [...displayedVendors, ...newVendors];
      setDisplayedVendors(updatedVendors);
      setCurrentPage(pageToLoad);
    } else {
      setDisplayedVendors(newVendors);
      setCurrentPage(1);
    }
    
    setHasMore(result.hasMore || false);
    
    if (newVendors.length > 0 && map && window.google) {
      if (!shouldAppend) {
        addMarkers(newVendors);
      } else {
        addMarkers([...displayedVendors, ...newVendors]);
      }
    }
    
  } catch (error) {
    console.error('❌ Search error:', error);
    setDisplayedVendors([]);
  } finally {
    setLoading(false);
    setLoadingMore(false);
  }
};

  const addMarkers = (vendors, mapParamDirect = null) => {
    clearMarkers();
    
    const currentMap = mapParamDirect || mapInstance.current || map;
    
    if (!currentMap || !window.google) {
      console.error("Map not available for adding markers");
      return;
    }
        
    const newMarkers = vendors.map(vendor => {
      if (!vendor.geometry || !vendor.geometry.location) return null;
      
      try {
        let marker;
        
        if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
          marker = new window.google.maps.marker.AdvancedMarkerElement({
            position: vendor.geometry.location,
            map: currentMap,
            title: vendor.name
          });
          
          marker.addListener('gm_click', () => {
            getVendorDetails(vendor.place_id);
          });
        } else {
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
    if (!placeId) {
      console.error("Missing placeId");
      return;
    }

    try {
      const vendorDetails = await vendorService.getVendorDetails(
        placeId,
        isRTL ? 'he' : 'en'
      );

      if (!vendorDetails) {
        console.error("No vendor details received");
        return;
      }

      let processedPlace = { ...vendorDetails };

      if (containsHebrew(vendorDetails.name)) {
        processedPlace.originalName = vendorDetails.name;
      }

      if (vendorDetails.formatted_address && containsHebrew(vendorDetails.formatted_address)) {
        processedPlace.originalFormattedAddress = vendorDetails.formatted_address;
      }

      if (vendorDetails.vicinity && containsHebrew(vendorDetails.vicinity)) {
        processedPlace.originalVicinity = vendorDetails.vicinity;
      }

      if (isEnglish) {
        if (containsHebrew(vendorDetails.name)) {
          processedPlace.name = await translateText(vendorDetails.name, 'en');
        }

        if (vendorDetails.formatted_address && containsHebrew(vendorDetails.formatted_address)) {
          processedPlace.formatted_address = await translateText(vendorDetails.formatted_address, 'en');
        }

        if (vendorDetails.vicinity && containsHebrew(vendorDetails.vicinity)) {
          processedPlace.vicinity = await translateText(vendorDetails.vicinity, 'en');
        }

        if (vendorDetails.opening_hours && vendorDetails.opening_hours.weekday_text) {
          processedPlace.opening_hours = {
            ...vendorDetails.opening_hours,
            weekday_text: await Promise.all(
              vendorDetails.opening_hours.weekday_text.map(async (day) => {
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

      setSelectedPhoto(0);

    } catch (error) {
      console.error("Failed to get vendor details:", error);
    }
  };
  
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      if (value.length >= 3) {
        const currentMap = mapInstance.current || map;
        if (currentMap && currentMap.getCenter) {
          searchVendors(currentMap.getCenter(), filters.vendorType, currentMap);
        }
      }
    }, 300);
    
    setSearchTimeout(timeout);
  };
  
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
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
        searchVendors(location, filters.vendorType, currentMap);
      } else {
        const currentMap = mapInstance.current || map;
        if (currentMap && currentMap.getCenter) {
          searchVendors(currentMap.getCenter(), filters.vendorType, currentMap);
        } else {
          searchVendors({ lat: 31.7683, lng: 35.2137 }, filters.vendorType, currentMap);
        }
      }
    });
  };
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'vendorType') {
      setFilters(prev => ({
        ...prev,
        [name]: value,
        specificFilters: [],
        kashrutLevel: value === 'catering' ? prev.kashrutLevel : 'all'
      }));
    } else if (name === 'kashrutLevel') {
      setFilters(prev => ({
        ...prev,
        [name]: value
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSpecificFilterChange = (filterValue) => {
    setFilters(prev => ({
      ...prev,
      specificFilters: prev.specificFilters.includes(filterValue)
        ? prev.specificFilters.filter(f => f !== filterValue)
        : [...prev.specificFilters, filterValue]
    }));
  };
  
  const applyFilters = () => {
    
    vendorService.clearFiltersCache(filters, search);
    
    setCurrentPage(1);
    setDisplayedVendors([]);
    setHasMore(false);
    clearMarkers();
    
    searchVendors(false);
  };
  
  const selectVendor = (vendor) => {
    try {
      let category = 'other';
      
      if (filters.vendorType && filters.vendorType !== 'all') {
        category = determineCategoryFromVendorType(filters.vendorType);
      }
      else if (vendor.types && vendor.types.length > 0) {
        const typeCategory = determineCategoryFromPlaceTypes(vendor.types);
        if (typeCategory !== 'other') {
          category = typeCategory;
        }
      }
      
      if (category === 'other') {
        const nameBasedCategory = determineCategoryFromName(vendor.name, vendor.vicinity);
        category = nameBasedCategory;
      }
      
      const vendorData = {
        place_id: vendor.place_id,
        id: vendor.place_id,
        name: vendor.name,
        address: vendor.formatted_address || vendor.vicinity,
        phone: vendor.formatted_phone_number || '',
        website: vendor.website || '',
        rating: vendor.rating || 0,
        price_level: vendor.price_level || 0,
        category: category
      };
    
      if (onSelectVendor && typeof onSelectVendor === 'function') {
        onSelectVendor(vendorData);
        setSuccessMessage(t('vendors.vendorAddedSuccess'));
        
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

  const getMainVendorImage = (vendor) => {
    if (!vendor.photos || vendor.photos.length === 0) {
      console.warn('⚠️ No photos for:', vendor.name);
      return null;
    }

    for (let i = 0; i < vendor.photos.length; i++) {
      const photo = vendor.photos[i];
      
      if (photo && photo.url && typeof photo.url === 'string' && photo.url.startsWith('http')) {
        return { 
          url: photo.url, 
          index: i,
          photo_reference: photo.photo_reference || null
        };
      }
    }

    console.warn('⚠️ No valid photos found for:', vendor.name);
    return null;
  };

  const getValidPhotos = (vendor) => {
  if (!vendor.photos || vendor.photos.length === 0) {
    return [];
  }

  const validPhotos = [];
  
  for (let i = 0; i < vendor.photos.length; i++) {
    const photo = vendor.photos[i];
    
    if (photo && photo.url && typeof photo.url === 'string' && photo.url.startsWith('http')) {
      validPhotos.push({ photo: photo, url: photo.url, index: i });
    }
  }

  return validPhotos;
};

  const currentSpecificFilters = getSpecificFilters(filters.vendorType);
  const kashrutOptions = getKashrutOptions();

  const handleLoadMore = () => {
    searchVendors(true); 
  };

  return (
    <div className="vp-vendors-page">
      <div className="vp-vendors-header">
        <h1>{t('vendors.searchTitle')}</h1>
        <p>{t('vendors.searchSubtitle')}</p>
      </div>
      
      <div className="vp-vendors-search-container">
        <form onSubmit={handleSearchSubmit} className="vp-vendors-search-form">
          <input
            type="text"
            placeholder={t('vendors.searchPlaceholder')}
            value={search}
            onChange={handleSearchChange}
            className="vp-vendors-search-input"
          />
          <button type="submit" className="vp-vendors-search-button">{t('vendors.searchButton')}</button>
        </form>
      </div>
      
      <div className="vp-vendors-content">
        <div className="vp-vendors-filters">
          <h3>{t('vendors.filtersTitle')}</h3>
          
          <div className="vp-filter-group">
            <label htmlFor="area">{t('vendors.filters.areaLabel')}</label>
            <select
              id="area"
              name="area"
              value={filters.area}
              onChange={handleFilterChange}
              className={isRTL ? 'vp-rtl-select' : 'vp-ltr-select'}
            >
              <option value="all">{t('vendors.filters.allAreas')}</option>
              <option value="ירושלים">{t('vendors.filters.jerusalem')}</option>
              <option value="מרכז">{t('vendors.filters.center')}</option>
              <option value="דרום">{t('vendors.filters.south')}</option>
              <option value="צפון">{t('vendors.filters.north')}</option>
            </select>
          </div>
          
          <div className="vp-filter-group">
            <label htmlFor="vendorType">{t('vendors.filters.typeLabel')}</label>
            <select
              id="vendorType"
              name="vendorType"
              value={filters.vendorType}
              onChange={handleFilterChange}
              className={isRTL ? 'vp-rtl-select' : 'vp-ltr-select'}
            >
              <option value="all">{t('vendors.filters.allTypes')}</option>
              <option value="catering">{t('vendors.filters.catering')}</option>
              <option value="photographer">{t('vendors.filters.photographer')}</option>
              <option value="florist">{t('vendors.filters.florist')}</option>
              <option value="musician">{t('vendors.filters.musician')}</option>
              <option value="dj">{t('vendors.filters.dj')}</option>
              <option value="decorator">{t('vendors.filters.decorator')}</option>
              <option value="makeup">{t('vendors.filters.makeup')}</option>
              <option value="transport">{t('vendors.filters.transport')}</option>
            </select>
          </div>

          {filters.vendorType === 'catering' && (
            <div className="vp-filter-group">
              <label htmlFor="kashrutLevel">{t('vendors.filters.kashrutLabel')}</label>
              <select
                id="kashrutLevel"
                name="kashrutLevel"
                value={filters.kashrutLevel}
                onChange={handleFilterChange}
                className={isRTL ? 'vp-rtl-select' : 'vp-ltr-select'}
              >
                {kashrutOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filters.vendorType !== 'all' && currentSpecificFilters && (
            <div className="vp-filter-group">
              <label>{t(currentSpecificFilters.labelKey)}</label>
              <div className="vp-checkbox-filters">
                {currentSpecificFilters.options.map(option => (
                  <div key={option.value} className="vp-checkbox-item">
                    <input
                      type="checkbox"
                      id={`filter-${option.value}`}
                      checked={filters.specificFilters.includes(option.value)}
                      onChange={() => handleSpecificFilterChange(option.value)}
                      className="vp-filter-checkbox"
                    />
                    <label
                      htmlFor={`filter-${option.value}`}
                      className="vp-checkbox-label"
                    >
                      {t(option.labelKey)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <button className="vp-filter-apply-button" onClick={applyFilters}>{t('vendors.filters.applyButton')}</button>
        </div>
        
        <div className="vp-vendors-results-container">
          <div className="vp-vendors-map" ref={mapRef}></div>
          
          <div className="vp-vendors-list">
            <div className="vp-vendors-list-header">
              <h3>{t('vendors.searchResults')}</h3>
            </div>
            
            {loading ? (
              <div className="vp-loading-indicator">
                <p>{t('vendors.loading')}</p>
              </div>
            ) : displayedVendors.length === 0 ? (
              <div className="vp-no-results">{t('vendors.noResults')}</div>
            ) : (
              <>
                <div className="vp-vendors-grid">
                  {displayedVendors.map(vendor => {
                    const mainImageData = getMainVendorImage(vendor);
                    
                    return (
                      <div
                        key={vendor.place_id}
                        className={`vp-vendor-card ${selectedVendor && selectedVendor.place_id === vendor.place_id ? 'vp-selected' : ''}`}
                        onClick={() => {
                          const mainImageData = getMainVendorImage(vendor);
                          if (mainImageData) {
                            setSelectedVendorMainPhoto({
                              url: mainImageData.url,
                              photo_reference: mainImageData.photo_reference
                            });
                          } else {
                            setSelectedVendorMainPhoto(null);
                          }
                          getVendorDetails(vendor.place_id);
                        }}
                      >
                        <div className="vp-vendor-image">
                          {mainImageData && mainImageData.url ? (
                            <img
                              src={mainImageData.url}
                              alt={vendor.name}
                              loading="lazy"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = `https://dummyimage.com/300x200/eeeeee/333333&text=${encodeURIComponent(vendor.name || 'No Image')}`;
                              }}
                            />
                          ) : (
                            <img
                              src={`https://dummyimage.com/300x200/cccccc/666666&text=${encodeURIComponent(vendor.name || 'No Image')}`}
                              alt={vendor.name || 'Vendor'}
                              loading="lazy"
                            />
                          )}
                        </div>
                        
                        <div className="vp-vendor-info">
                          <h4>{vendor.name}</h4>
                          <p className="vp-vendor-address">
                            {vendor.formatted_address || vendor.vicinity || t('vendors.noAddress')}
                          </p>
                          
                          {vendor.rating && (
                            <div className="vp-vendor-rating">
                              <span className="vp-stars">
                                {Array(Math.floor(vendor.rating)).fill().map((_, i) => (
                                  <span key={i} className="vp-star">★</span>
                                ))}
                                {vendor.rating % 1 > 0 && <span className="vp-star vp-half">★</span>}
                              </span>
                              <span className="vp-rating-value">{vendor.rating}</span>
                              <span className="vp-review-count">({vendor.user_ratings_total || 0})</span>
                            </div>
                          )}
                          
                          {vendor.price_level && (
                            <div className="vp-vendor-price">
                              {'₪'.repeat(vendor.price_level)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && !loading && displayedVendors.length > 0 && (
                  <div className="vp-load-more-container">
                    <button 
                      className="vp-load-more-button" 
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? t('vendors.loadingMore') : t('vendors.loadMore')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {selectedVendor && (
          <div className="vp-vendor-details">
            <div className="vp-vendor-details-content">
              <div className="vp-vendor-details-header">
                <h2>{selectedVendor.name}</h2>
                <button className="vp-close-details" onClick={() => {
                  setSelectedVendor(null);
                  setSelectedVendorMainPhoto(null);
                }}>×</button>
              </div>
              
              {successMessage && (
                <div className="vp-success-message">
                  {successMessage}
                </div>
              )}
              
              <div className="vp-vendor-photos">
                <div className="vp-main-photo">
                  {selectedVendor.photos && selectedVendor.photos.length > 0 ? (
                    (() => {
                      const validPhotos = getValidPhotos(selectedVendor);
                      
                      if (validPhotos.length === 0) {
                        return (
                          <img
                            src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || 'No Image')}`}
                            alt={selectedVendor.name || 'Vendor'}
                            loading="lazy"
                          />
                        );
                      }
                      
                      if (selectedPhoto === 0 && selectedVendorMainPhoto) {
                        return (
                          <img
                            src={selectedVendorMainPhoto.url}
                            alt={selectedVendor.name}
                            loading="lazy"
                            onError={(e) => {
                              e.target.onerror = null;
                              if (validPhotos.length > 0) {
                                e.target.src = validPhotos[0].url;
                              }
                            }}
                          />
                        );
                      }
                      
                      const photoIndex = Math.min(selectedPhoto, validPhotos.length - 1);
                      const photoToShow = validPhotos[photoIndex];
                      
                      return (
                        <img
                          src={photoToShow.url}
                          alt={selectedVendor.name}
                          loading="lazy"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || 'No Image')}`;
                          }}
                        />
                      );
                    })()
                  ) : (
                    <img
                      src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || 'No Image')}`}
                      alt={selectedVendor.name || 'Vendor'}
                      loading="lazy"
                    />
                  )}
                </div>
                
                {selectedVendor.photos && selectedVendor.photos.length > 0 && getValidPhotos(selectedVendor).length > 0 && (
                  <div className="vp-all-photos">
                    {getValidPhotos(selectedVendor).map(({ url, index }) => (
                      <img
                        key={index}
                        src={url}
                        alt={`${selectedVendor.name} - ${index + 1}`}
                        className={`vp-thumbnail-photo ${selectedPhoto === index ? 'vp-selected' : ''}`}
                        onClick={() => setSelectedPhoto(index)}
                        loading="lazy"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
                          
              <div className="vp-vendor-info-detailed">
                <p className="vp-address">
                  <strong>{t('vendors.details.address')}:</strong> {
                    isRTL && selectedVendor.originalFormattedAddress ?
                    selectedVendor.originalFormattedAddress :
                    selectedVendor.formatted_address || selectedVendor.vicinity
                  }
                </p>
                
                {selectedVendor.formatted_phone_number && (
                  <p className="vp-phone">
                    <strong>{t('vendors.details.phone')}:</strong> {selectedVendor.formatted_phone_number}
                  </p>
                )}
                
                {selectedVendor.website && (
                  <p className="vp-website">
                    <strong>{t('vendors.details.website')}:</strong> <a href={selectedVendor.website} target="_blank" rel="noopener noreferrer">{selectedVendor.website}</a>
                  </p>
                )}
                
                {selectedVendor.rating && (
                  <p className="vp-rating-details">
                    <strong>{t('vendors.details.rating')}:</strong> {selectedVendor.rating} {t('vendors.details.outOf5')} ({selectedVendor.user_ratings_total} {t('vendors.details.reviews')})
                  </p>
                )}
                
                {selectedVendor.price_level && (
                  <p className="vp-price-details">
                    <strong>{t('vendors.details.priceLevel')}:</strong> {'₪'.repeat(selectedVendor.price_level)}
                  </p>
                )}
                
                {selectedVendor.opening_hours && selectedVendor.opening_hours.weekday_text && (
                  <div className="vp-opening-hours">
                    <strong>{t('vendors.details.openingHours')}:</strong>
                    <ul>
                      {selectedVendor.opening_hours.weekday_text.map((day, index) => (
                        <li key={index}>{day}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {selectedVendor.reviews && selectedVendor.reviews.length > 0 && (
                <div className="vp-vendor-reviews">
                  <h3>{t('vendors.details.reviewsTitle')}</h3>
                  <div className="vp-reviews-list">
                    {selectedVendor.reviews.slice(0, 3).map((review, index) => (
                      <div key={index} className="vp-review">
                        <div className="vp-review-header">
                          <span className="vp-reviewer">{review.author_name}</span>
                          <span className="vp-review-rating">
                            {'★'.repeat(review.rating)}
                            {'☆'.repeat(5 - review.rating)}
                          </span>
                          <span className="vp-review-date">{new Date(review.time * 1000).toLocaleDateString()}</span>
                        </div>
                        <p className="vp-review-text">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="vp-vendor-actions">
                {!successMessage && (
                  <button className="vp-select-vendor-button" onClick={() => selectVendor(selectedVendor)}>
                    {t('vendors.selectButton')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default VendorsPage;