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
  const [allVendors, setAllVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [map, setMap] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedVendorPhotoIndex, setSelectedVendorPhotoIndex] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
 
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [searchTimeout, setSearchTimeout] = useState(null);
 
  const eventId = location.state?.eventId;
 
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';
  const isEnglish = i18n.language === 'en' || i18n.language === 'en-US';
 
  const [filters, setFilters] = useState({
    area: 'all',
    vendorType: 'all',
    specificFilters: [],
    kashrutLevel: 'all'
  });

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

  useEffect(() => {
    const totalVendors = allVendors.length;
    const pages = Math.ceil(totalVendors / vendorsPerPage);
    setTotalPages(pages);
   
    const startIndex = (currentPage - 1) * vendorsPerPage;
    const endIndex = startIndex + vendorsPerPage;
    const currentVendors = allVendors.slice(startIndex, endIndex);
   
    setVendors(currentVendors);
   
    if (currentVendors.length > 0) {
      addMarkers(currentVendors);
    }
  }, [allVendors, currentPage, vendorsPerPage]);

  const getLocationForArea = (area) => {
    switch (area) {
      case 'ירושלים':
        return {
          location: { lat: 31.7683, lng: 35.2137 },
          radius: 20000
        };
      case 'מרכז':
        return {
          location: { lat: 32.0853, lng: 34.7818 },
          radius: 20000  
        };
      case 'דרום':
        return {
          location: { lat: 31.2518, lng: 34.7915 },
          radius: 35000  
        };
      case 'צפון':
        return {
          location: { lat: 32.7940, lng: 35.0423 },
          radius: 30000
        };
      default:
        return null;
    }
  };

  const isVendorInArea = (vendor, selectedArea) => {
    if (selectedArea === 'all') return true;
   
    if (!vendor.geometry || !vendor.geometry.location) return false;
   
    const venueLat = typeof vendor.geometry.location.lat === 'function' ?
      vendor.geometry.location.lat() : vendor.geometry.location.lat;
    const venueLng = typeof vendor.geometry.location.lng === 'function' ?
      vendor.geometry.location.lng() : vendor.geometry.location.lng;
   
    if (isNaN(venueLat) || isNaN(venueLng)) return false;
   
    const areaLocation = getLocationForArea(selectedArea);
    if (!areaLocation) return true;
   
    const distance = calculateDistance(
      venueLat, venueLng,
      areaLocation.location.lat, areaLocation.location.lng
    );
   
    return distance <= areaLocation.radius;
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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

  const buildSearchQuery = (vendorType, searchTerm = '') => {
    let query = '';
   
    if (!vendorType || vendorType === 'all') {
      query = 'event services wedding party celebration catering photographer florist music entertainment';
    } else {
      switch (vendorType) {
        case 'catering':
          query = 'catering service food restaurant chef';
         
          if (filters.kashrutLevel && filters.kashrutLevel !== 'all') {
            switch (filters.kashrutLevel) {
              case 'mehadrin':
                query += ' מהדרין mehadrin kosher';
                break;
              case 'regular-kosher':
                query += ' כשר kosher';
                break;
              case 'rabbinate':
                query += ' רבנות rabbinate kosher';
                break;
              case 'badatz':
                query += ' בד"ץ badatz kosher';
                break;
              case 'non-kosher':
                query += ' לא כשר non kosher';
                break;
            }
          }
         
          if (filters.specificFilters.length > 0) {
            filters.specificFilters.forEach(filter => {
              switch (filter) {
                case 'dairy':
                  query += ' חלבי dairy חלב milk';
                  break;
                case 'meat':
                  query += ' בשרי meat בשר';
                  break;
                case 'pareve':
                  query += ' פרווה pareve';
                  break;
                case 'vegan':
                  query += ' טבעוני vegan';
                  break;
                case 'vegetarian':
                  query += ' צמחוני vegetarian';
                  break;
                case 'gluten-free':
                  query += ' ללא גלוטן gluten free';
                  break;
              }
            });
          }
          break;
         
        case 'photographer':
          query = 'photographer photography studio';
          if (filters.specificFilters.length > 0) {
            query += ' ' + filters.specificFilters.join(' ');
          }
          break;
         
        case 'florist':
          query = 'florist flower shop';
          if (filters.specificFilters.length > 0) {
            filters.specificFilters.forEach(filter => {
              switch (filter) {
                case 'bridal':
                  query += ' bridal wedding';
                  break;
                case 'arrangements':
                  query += ' arrangements';
                  break;
                case 'decorations':
                  query += ' decorations';
                  break;
                case 'plants':
                  query += ' plants';
                  break;
              }
            });
          }
          break;
         
        case 'musician':
          query = 'musician entertainment band music';
          if (filters.specificFilters.length > 0) {
            query += ' ' + filters.specificFilters.join(' ');
          }
          break;
         
        case 'dj':
          query = 'dj sound entertainment music';
          if (filters.specificFilters.length > 0) {
            filters.specificFilters.forEach(filter => {
              switch (filter) {
                case 'wedding':
                  query += ' wedding';
                  break;
                case 'party':
                  query += ' party';
                  break;
                case 'corporate':
                  query += ' corporate';
                  break;
                case 'with-equipment':
                  query += ' equipment sound system';
                  break;
              }
            });
          }
          break;
         
        case 'decorator':
          query = 'event decorator design planning';
          if (filters.specificFilters.length > 0) {
            query += ' ' + filters.specificFilters.join(' ');
          }
          break;
         
        case 'makeup':
          query = 'makeup artist beauty';
          if (filters.specificFilters.length > 0) {
            filters.specificFilters.forEach(filter => {
              switch (filter) {
                case 'bridal':
                  query += ' bridal wedding';
                  break;
                case 'event':
                  query += ' event';
                  break;
                case 'with-hairstyling':
                  query += ' hairstyling';
                  break;
                case 'mobile':
                  query += ' mobile service';
                  break;
              }
            });
          }
          break;
         
        case 'transport':
          query = 'transportation rental service car bus';
          if (filters.specificFilters.length > 0) {
            filters.specificFilters.forEach(filter => {
              switch (filter) {
                case 'luxury-cars':
                  query += ' luxury cars';
                  break;
                case 'buses':
                  query += ' buses';
                  break;
                case 'limousines':
                  query += ' limousines';
                  break;
                case 'classic-cars':
                  query += ' classic vintage cars';
                  break;
              }
            });
          }
          break;
         
        default:
          query = 'event services provider';
          break;
      }
    }
   
    if (searchTerm) {
      query += ' ' + searchTerm;
    }
   
    return query;
  };

  const filterVendorsByAdvancedCriteria = (vendors) => {
    return vendors.filter(vendor => {
      const vendorText = (vendor.name + ' ' + (vendor.vicinity || '') + ' ' + (vendor.formatted_address || '')).toLowerCase();
     
      const venueKeywords = ['hotel', 'hall', 'venue', 'event center', 'convention', 'resort', 'banquet', 'palace', 'manor', 'estate'];
      const isVenue = venueKeywords.some(keyword => vendorText.includes(keyword));
     
      if (isVenue) return false;
     
      if (filters.vendorType === 'catering' && filters.kashrutLevel && filters.kashrutLevel !== 'all') {
        const kashrutKeywords = {
          'mehadrin': ['מהדרין', 'mehadrin'],
          'regular-kosher': ['כשר', 'kosher'],
          'rabbinate': ['רבנות', 'rabbinate'],
          'badatz': ['בד"ץ', 'badatz'],
          'non-kosher': ['לא כשר', 'non kosher', 'טרף']
        };
       
        const levelKeywords = kashrutKeywords[filters.kashrutLevel];
        if (levelKeywords) {
          const hasKashrutMatch = levelKeywords.some(keyword => vendorText.includes(keyword));
          if (!hasKashrutMatch) return false;
        }
      }
     
      if (filters.specificFilters.length > 0) {
        const hasMatchingFilter = filters.specificFilters.some(filter => {
          const filterKeywords = {
            'dairy': ['חלבי', 'dairy', 'חלב', 'milk'],
            'meat': ['בשרי', 'meat', 'בשר'],
            'pareve': ['פרווה', 'pareve'],
            'vegan': ['טבעוני', 'vegan'],
            'vegetarian': ['צמחוני', 'vegetarian'],
            'gluten-free': ['ללא גלוטן', 'gluten free', 'celiac']
          };
         
          const keywords = filterKeywords[filter];
          if (keywords) {
            return keywords.some(keyword => vendorText.includes(keyword));
          }
         
          return vendorText.includes(filter);
        });
       
        if (!hasMatchingFilter) return false;
      }
     
      return true;
    });
  };
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
        gestureHandling: 'greedy',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
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

      const israelCenter = { lat: 31.5, lng: 34.75 };
      newMap.setCenter(israelCenter);
      newMap.setZoom(7);

      if (placesService.current) {
        console.log("Performing initial optimized search");
        searchVendors(israelCenter, 'all', newMap);
      } else {
        console.error("Places service not available for search");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error in initMap:", error);
      isMapInitialized.current = false;
      setLoading(false);
    }
  };

  const collectAllResults = async (request, mapParamDirect) => {
    return new Promise((resolve) => {
      let allResults = [];
      let paginationCount = 0;
      const maxPages = 2;
     
      const performSearch = (searchRequest) => {
        placesService.current.textSearch(searchRequest, async (results, status, pagination) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            console.log(`Found ${results.length} vendors in batch ${paginationCount + 1}`);
           
            const processedResults = await Promise.all(results.map(async vendor => {
              let processedVendor = { ...vendor };
             
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
           
            allResults = [...allResults, ...processedResults];
            paginationCount++;

            if (pagination &&
                pagination.hasNextPage &&
                typeof pagination.nextPage === 'function' &&
                paginationCount < maxPages) {
              console.log(`Getting page ${paginationCount + 1}, current total: ${allResults.length}`);
              setTimeout(() => {
                pagination.nextPage();
              }, 50);
            } else {
              console.log(`Search completed with ${allResults.length} total results after ${paginationCount} pages`);
              resolve(allResults);
            }
          } else {
            console.log(`Search finished with status: ${status} after ${paginationCount} pages`);
            resolve(allResults);
          }
        });
      };
     
      performSearch(request);
    });
  };

  const searchVendors = async (location, vendorType, mapParamDirect = null) => {
    console.log(`Starting optimized searchVendors - vendorType: ${vendorType}, area: ${filters.area}, kashrut: ${filters.kashrutLevel}`);
   
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
    setCurrentPage(1);

    const performOptimizedSearches = async (centerLocation, radius, searchType) => {
      const searchQueries = [];
     
      if (searchType === 'all') {
        searchQueries.push(
          'event services Israel',
          'catering photographer Israel',
          'florist musician Israel',
          'dj decorator Israel',
          'makeup transportation Israel',
          'קייטרינג צלם פרחים'
        );
      } else {
        const baseQuery = buildSearchQuery(searchType, search);
        searchQueries.push(
          baseQuery + ' Israel',
          baseQuery.split(' ').slice(0, 4).join(' ') + ' Israel'
        );
      }

      let allResults = [];
     
      for (let i = 0; i < searchQueries.length; i++) {
        const query = searchQueries[i];
        console.log(`Performing search ${i + 1}/${searchQueries.length}: ${query}`);
       
        const request = {
          query: query,
          location: centerLocation,
          radius: radius,
          language: isRTL ? 'he' : 'en'
        };
       
        try {
          const results = await collectAllResults(request, mapParamDirect);
          allResults = [...allResults, ...results];
          console.log(`Search ${i + 1} completed: ${results.length} results`);
         
          if (i < searchQueries.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          console.error(`Error in search ${i + 1}:`, error);
        }
      }
     
      return allResults;
    };

    let locationObj = location;
    let searchRadius = 50000;

    const areaLocation = getLocationForArea(filters.area);
    if (areaLocation) {
      locationObj = areaLocation.location;
      searchRadius = areaLocation.radius;
      console.log("Using area-specific location:", locationObj, "with radius:", searchRadius);
    } else if (typeof location.lat === 'function') {
      locationObj = {
        lat: location.lat(),
        lng: location.lng()
      };
    }

    if (filters.area === 'all') {
      const searchAreas = [
        { lat: 32.0853, lng: 34.7818, name: 'Center', radius: 25000 },
        { lat: 31.7683, lng: 35.2137, name: 'Jerusalem', radius: 20000 },
        { lat: 32.7940, lng: 35.0423, name: 'North', radius: 30000 }
      ];
     
      console.log("Starting optimized nationwide search with advanced filtering");
     
      try {
        let allResults = [];
       
        for (const area of searchAreas) {
          console.log(`Starting search for area: ${area.name}`);
          const areaResults = await performOptimizedSearches(area, area.radius, vendorType);
          allResults = [...allResults, ...areaResults];
          console.log(`Area ${area.name} completed: ${areaResults.length} results`);
        }
       
        const uniqueResults = [];
        const seenIds = new Set();
       
        allResults.forEach(vendor => {
          if (!seenIds.has(vendor.place_id)) {
            seenIds.add(vendor.place_id);
            uniqueResults.push(vendor);
          }
        });
       
        const filteredResults = filterVendorsByAdvancedCriteria(uniqueResults);
       
        console.log(`Nationwide search completed: ${filteredResults.length} total filtered results`);
       
        setAllVendors(filteredResults);
        setLoading(false);
        return;
       
      } catch (error) {
        console.error("Error in nationwide search:", error);
        setLoading(false);
        return;
      }
    }
   
    try {
      console.log(`Starting optimized search for specific area: ${filters.area}`);
      const allResults = await performOptimizedSearches(locationObj, searchRadius, vendorType);
     
      const uniqueResults = [];
      const seenIds = new Set();
     
      allResults.forEach(vendor => {
        if (!seenIds.has(vendor.place_id)) {
          seenIds.add(vendor.place_id);
          uniqueResults.push(vendor);
        }
      });
     
      let filteredResults = filterVendorsByAdvancedCriteria(uniqueResults);
     
      filteredResults = filteredResults.filter(vendor => {
        return isVendorInArea(vendor, filters.area);
      });
     
      console.log(`Area search completed: ${filteredResults.length} total filtered results for area: ${filters.area}, type: ${filters.vendorType}, kashrut: ${filters.kashrutLevel}`);
     
      setAllVendors(filteredResults);
      setLoading(false);
    } catch (error) {
      console.error("Search execution error:", error);
      setLoading(false);
    }
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
        'geometry', 'vicinity', 'url', 'photo', 'types'
      ],
      language: isRTL ? 'he' : 'en'
    };
 
    placesService.current.getDetails(request, async (place, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
        console.log("Vendor details loaded:", place.name, "Types:", place.types);
       
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
    console.log("Applying filters:", filters);
    const currentMap = mapInstance.current || map;
   
    setAllVendors([]);
    setVendors([]);
    setCurrentPage(1);
    setTotalPages(0);
    setLoading(true);
   
    clearMarkers();

    const areaLocation = getLocationForArea(filters.area);
    if (areaLocation) {
      if (currentMap) {
        currentMap.setCenter(areaLocation.location);
        currentMap.setZoom(10);
      }
      searchVendors(areaLocation.location, filters.vendorType, currentMap);
      return;
    }

    if (filters.area === 'all') {
      const israelCenter = { lat: 31.5, lng: 34.75 };
      if (currentMap) {
        currentMap.setCenter(israelCenter);
        currentMap.setZoom(7);
      }
      searchVendors(israelCenter, filters.vendorType, currentMap);
      return;
    }

    if (currentMap && currentMap.getCenter) {
      searchVendors(currentMap.getCenter(), filters.vendorType, currentMap);
    } else {
      const israelCenter = { lat: 31.5, lng: 34.75 };
      searchVendors(israelCenter, filters.vendorType, currentMap);
    }
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
   
    const resultsElement = document.querySelector('.vendors-list');
    if (resultsElement) {
      resultsElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  const renderPaginationNumbers = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 7;
   
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
   
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (currentPage > 1) {
      pageNumbers.push(
        <button
          key="prev"
          onClick={() => handlePageChange(currentPage - 1)}
          className="pagination-btn pagination-prev"
        >
          ‹
        </button>
      );
    }

    if (startPage > 1) {
      pageNumbers.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className="pagination-btn"
        >
          1
        </button>
      );
      if (startPage > 2) {
        pageNumbers.push(
          <span key="ellipsis1" className="pagination-ellipsis">...</span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(
          <span key="ellipsis2" className="pagination-ellipsis">...</span>
        );
      }
      pageNumbers.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="pagination-btn"
        >
          {totalPages}
        </button>
      );
    }

    if (currentPage < totalPages) {
      pageNumbers.push(
        <button
          key="next"
          onClick={() => handlePageChange(currentPage + 1)}
          className="pagination-btn pagination-next"
        >
          ›
        </button>
      );
    }

    return pageNumbers;
  };
 
  const selectVendor = (vendor) => {
    try {
      let category = 'other';
     
      console.log("=== Vendor Selection Debug ===");
      console.log("Vendor name:", vendor.name);
      console.log("Current filter:", filters.vendorType);
      console.log("Vendor types:", vendor.types);
      console.log("Vendor vicinity:", vendor.vicinity);
     
      if (filters.vendorType && filters.vendorType !== 'all') {
        category = determineCategoryFromVendorType(filters.vendorType);
        console.log("Category from filter:", category);
      }
      else if (vendor.types && vendor.types.length > 0) {
        const typeCategory = determineCategoryFromPlaceTypes(vendor.types);
        if (typeCategory !== 'other') {
          category = typeCategory;
          console.log("Category from place types:", category);
        }
      }
     
      if (category === 'other') {
        const nameBasedCategory = determineCategoryFromName(vendor.name, vendor.vicinity);
        category = nameBasedCategory;
        console.log("Category from name analysis:", category);
      }
     
      console.log("Final category assigned:", category);
      console.log("===============================");
     
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

  const currentSpecificFilters = getSpecificFilters(filters.vendorType);
  const kashrutOptions = getKashrutOptions();

  return (
    <div className="vendors-page">
      <div className="vendors-header">
        <h1>{t('vendors.searchTitle')}</h1>
        <p>{t('vendors.searchSubtitle')}</p>
      </div>
     
      <div className="vendors-search-container">
        <form onSubmit={handleSearchSubmit} className="vendors-search-form">
          <input
            type="text"
            placeholder={t('vendors.searchPlaceholder')}
            value={search}
            onChange={handleSearchChange}
            className="vendors-search-input"
          />
          <button type="submit" className="vendors-search-button">{t('vendors.searchButton')}</button>
        </form>
      </div>
     
      <div className="vendors-content">
        <div className="vendors-filters">
          <h3>{t('vendors.filtersTitle')}</h3>
         
          <div className="filter-group">
            <label htmlFor="area">{t('vendors.filters.areaLabel')}</label>
            <select
              id="area"
              name="area"
              value={filters.area}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="all">{t('vendors.filters.allAreas')}</option>
              <option value="ירושלים">{t('vendors.filters.jerusalem')}</option>
              <option value="מרכז">{t('vendors.filters.center')}</option>
              <option value="דרום">{t('vendors.filters.south')}</option>
              <option value="צפון">{t('vendors.filters.north')}</option>
            </select>
          </div>
         
          <div className="filter-group">
            <label htmlFor="vendorType">{t('vendors.filters.typeLabel')}</label>
            <select
              id="vendorType"
              name="vendorType"
              value={filters.vendorType}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
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
            <div className="filter-group">
              <label htmlFor="kashrutLevel">{t('vendors.filters.kashrutLabel')}</label>
              <select
                id="kashrutLevel"
                name="kashrutLevel"
                value={filters.kashrutLevel}
                onChange={handleFilterChange}
                className={isRTL ? 'rtl-select' : 'ltr-select'}
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
            <div className="filter-group">
              <label>{t(currentSpecificFilters.labelKey)}</label>
              <div className="checkbox-filters">
                {currentSpecificFilters.options.map(option => (
                  <div key={option.value} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={`filter-${option.value}`}
                      checked={filters.specificFilters.includes(option.value)}
                      onChange={() => handleSpecificFilterChange(option.value)}
                      className="filter-checkbox"
                    />
                    <label
                      htmlFor={`filter-${option.value}`}
                      className="checkbox-label"
                    >
                      {t(option.labelKey)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
         
          <button className="filter-apply-button" onClick={applyFilters}>{t('vendors.filters.applyButton')}</button>
        </div>
       
        <div className="vendors-results-container">
          <div className="vendors-map" ref={mapRef}></div>
         
          <div className="vendors-list">
            <div className="vendors-list-header">
              <h3>{t('vendors.searchResults')}</h3>
              {!loading && allVendors.length > 0 && (
                <div className="results-info">
                  {t('general.showingResults', { 
                  start: ((currentPage - 1) * vendorsPerPage) + 1,
                  end: Math.min(currentPage * vendorsPerPage, allVendors.length),
                  total: allVendors.length 
                })}
                </div>
              )}
            </div>
           
            {loading ? (
              <div className="loading-indicator">
                <div className="loading-spinner"></div>
                <p>{t('vendors.loading')}</p>
              </div>
            ) : vendors.length === 0 ? (
              <div className="no-results">{t('vendors.noResults')}</div>
            ) : (
              <>
                <div className="vendors-grid">
                  {vendors.map(vendor => {
                    const mainImageData = getMainVendorImage(vendor);
                   
                    return (
                      <div
                        key={vendor.place_id}
                        className={`vendor-card ${selectedVendor && selectedVendor.place_id === vendor.place_id ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedVendorPhotoIndex(mainImageData ? mainImageData.index : null);
                          getVendorDetails(vendor.place_id);
                        }}
                      >
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
                            {vendor.formatted_address || vendor.vicinity || t('vendors.noAddress')}
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
                              {'₪'.repeat(vendor.price_level)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="pagination-container">
                    <div className="pagination">
                      {renderPaginationNumbers()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
       
        {selectedVendor && (
          <div className="vendor-details">
            <div className="vendor-details-content">
              <div className="vendor-details-header">
                <h2>{selectedVendor.name}</h2>
                <button className="close-details" onClick={() => {
                  setSelectedVendor(null);
                  setSelectedVendorPhotoIndex(null);
                }}>×</button>
              </div>
             
              {successMessage && (
                <div className="success-message">
                  {successMessage}
                </div>
              )}
             
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
                              e.target.src = `https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || t('vendors.defaultVendorName'))}`;
                            }}
                          />
                        );
                      } else {
                        return (
                          <img
                            src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || t('vendors.defaultVendorName'))}`}
                            alt={selectedVendor.name || t('vendors.defaultVendorName')}
                          />
                        );
                      }
                    })()
                  ) : (
                    <img
                      src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVendor.name || t('vendors.defaultVendorName'))}`}
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
                <p className="address">
                  <strong>{t('vendors.details.address')}:</strong> {
                    isRTL && selectedVendor.originalFormattedAddress ?
                    selectedVendor.originalFormattedAddress :
                    selectedVendor.formatted_address || selectedVendor.vicinity
                  }
                </p>
               
                {selectedVendor.formatted_phone_number && (
                  <p className="phone">
                    <strong>{t('vendors.details.phone')}:</strong> {selectedVendor.formatted_phone_number}
                  </p>
                )}
               
                {selectedVendor.website && (
                  <p className="website">
                    <strong>{t('vendors.details.website')}:</strong> <a href={selectedVendor.website} target="_blank" rel="noopener noreferrer">{selectedVendor.website}</a>
                  </p>
                )}
               
                {selectedVendor.rating && (
                  <p className="rating-details">
                    <strong>{t('vendors.details.rating')}:</strong> {selectedVendor.rating} {t('vendors.details.outOf5')} ({selectedVendor.user_ratings_total} {t('vendors.details.reviews')})
                  </p>
                )}
               
                {selectedVendor.price_level && (
                  <p className="price-details">
                    <strong>{t('vendors.details.priceLevel')}:</strong> {'₪'.repeat(selectedVendor.price_level)}
                  </p>
                )}
               
                {selectedVendor.opening_hours && selectedVendor.opening_hours.weekday_text && (
                  <div className="opening-hours">
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
                <div className="vendor-reviews">
                  <h3>{t('vendors.details.reviewsTitle')}</h3>
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