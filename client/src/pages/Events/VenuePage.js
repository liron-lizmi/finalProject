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
  const [allVenues, setAllVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [map, setMap] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedVenuePhotoIndex, setSelectedVenuePhotoIndex] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [venuesPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
 
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

  const searchCache = useRef(new Map());

  const getLocationForAreaLocal = (area) => {
    switch (area) {
      case 'jerusalem':
        return {
          location: { lat: 31.7683, lng: 35.2137 },
          radius: 30000
        };
      case 'center':
        return {
          location: { lat: 32.0853, lng: 34.7818 }, 
          radius: 25000
        };
      case 'south':
        return {
          location: { lat: 31.2518, lng: 34.7915 }, 
          radius: 30000
        };
      case 'north':
        return {
          location: { lat: 32.7940, lng: 35.0423 }, 
          radius: 30000
        };
      default:
        return null;
    }
  };

  useEffect(() => {
    const totalVenues = allVenues.length;
    const pages = Math.ceil(totalVenues / venuesPerPage);
    setTotalPages(pages);
    
    loadCurrentPageVenues();
  }, [allVenues, currentPage, venuesPerPage]);

  const loadCurrentPageVenues = () => {
    const startIndex = (currentPage - 1) * venuesPerPage;
    const endIndex = startIndex + venuesPerPage;
    const currentVenues = allVenues.slice(startIndex, endIndex);
    
    setVenues(currentVenues);
    
    if (currentVenues.length > 0) {
      addMarkers(currentVenues);
    }
  };

  const getLocationForArea = (area) => {
    const locations = {
      jerusalem: { lat: 31.7683, lng: 35.2137 },
      center: { lat: 32.0853, lng: 34.7818 },
      south: { lat: 31.2518, lng: 34.7915 },
      north: { lat: 32.7940, lng: 35.0423 }
    };
    
    const radii = {
      jerusalem: 30000,
      center: 25000,
      south: 50000,
      north: 50000
    };
    
    return locations[area] ? {
      location: locations[area],
      radius: radii[area]
    } : null;
  };

  const buildSearchQuery = (venueType, searchTerm = '') => {
    let query = '';
    
    if (venueType === 'all') {
      query = 'venue OR hall OR restaurant OR hotel OR "event venue" OR "wedding venue" OR "banquet hall" OR "reception hall" OR "event space" OR "function hall" OR park OR garden OR museum OR "cultural center" OR "community center" OR "event center" OR "celebration venue" OR "party venue" OR ballroom OR "conference center" OR auditorium OR theater OR gallery OR resort OR villa OR club OR "special events" OR "event planning" OR "party hall" OR "celebration hall" OR "festive venue" OR "אולם אירועים" OR "אולם חתונות" OR "מסעדה" OR "בית מלון" OR "גן אירועים" OR "מתחם אירועים" OR "אולם" OR "מרכז אירועים" OR "אולם קבלות" OR "מועדון" OR "וילה" OR "מרכז תרבות" OR "אולם חגיגות" OR "בית אירועים" OR "מרכז כנסים" OR "אולם נשפים" OR "גן נשואין" OR "מתחם חתונות"';
    } else {
      const queryMap = {
        restaurant: 'restaurant OR "dining venue" OR "event restaurant" OR "private dining" OR "banquet restaurant" OR "fine dining" OR "kosher restaurant" OR "celebration restaurant" OR "party restaurant" OR "festive dining" OR "special occasion dining" OR "מסעדה" OR "מסעדת אירועים" OR "מסעדה כשרה" OR "מסעדת חתונות" OR "ביסטרו" OR "מסעדת חגיגות" OR "מסעדה לאירועים" OR "מסעדת קבלות"',
        event_venue: '"event venue" OR "event space" OR "function venue" OR "event center" OR "celebration venue" OR "party venue" OR "special events venue" OR "occasion venue" OR "festive venue" OR "gathering venue" OR "אולם אירועים" OR "מתחם אירועים" OR "מרכז אירועים" OR "אולם חגיגות" OR "מתחם חגיגות" OR "אולם קבלות" OR "מרכז כנסים"',
        banquet_hall: '"banquet hall" OR "wedding hall" OR "function hall" OR "reception hall" OR "ballroom" OR "celebration hall" OR "party hall" OR "festive hall" OR "gathering hall" OR "אולם חתונות" OR "אולם קבלות" OR "אולם אירועים" OR "בית אירועים" OR "אולם חגיגות" OR "אולם נשפים" OR "אולם מסיבות"',
        hotel: 'hotel OR "event hotel" OR "conference hotel" OR "wedding hotel" OR "boutique hotel" OR "resort" OR "celebration hotel" OR "party hotel" OR "event resort" OR "בית מלון" OR "מלון" OR "מלון אירועים" OR "מלון חתונות" OR "אתר נופש" OR "מלון כנסים" OR "מרכז נופש"',
        park: 'park OR garden OR "outdoor venue" OR "botanical garden" OR "nature reserve" OR "public garden" OR "event park" OR "celebration garden" OR "outdoor event space" OR "פארק" OR "גן" OR "גן לאומי" OR "גן ציבורי" OR "גן אירועים" OR "גן נשואין" OR "פארק אירועים"',
        museum: 'museum OR "cultural venue" OR "art gallery" OR "cultural center" OR "heritage site" OR "exhibition hall" OR "cultural space" OR "art center" OR "history center" OR "מוזיאון" OR "מרכז תרבות" OR "גלריה" OR "בית תרבות" OR "מרכז אמנות" OR "בית מוזיאון"'
      };
      
      query = queryMap[venueType] || 'venue OR hall OR "event space" OR "celebration venue" OR "אולם" OR "מקום אירועים" OR "מתחם אירועים"';
    }
   
    if (searchTerm) {
      query += ' ' + searchTerm;
    }
   
    return query;
  };
  
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

      // ביצוע חיפוש מיידי
      if (placesService.current) {
        console.log("Performing initial nationwide search");
        searchVenues(israelCenter, 'all', newMap);
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

  const isVenueInArea = (venue, selectedArea) => {
    if (selectedArea === 'all') return true;
    
    if (!venue.geometry || !venue.geometry.location) return false; 
    
    const venueLat = typeof venue.geometry.location.lat === 'function' ? 
      venue.geometry.location.lat() : venue.geometry.location.lat;
    const venueLng = typeof venue.geometry.location.lng === 'function' ? 
      venue.geometry.location.lng() : venue.geometry.location.lng;
    
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

  const collectAllResults = async (request, mapParamDirect) => {
    return new Promise((resolve) => {
      let allResults = [];
      let paginationCount = 0;
      
      const performSearch = (searchRequest) => {
        placesService.current.textSearch(searchRequest, async (results, status, pagination) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
            console.log(`Found ${results.length} venues in batch ${paginationCount + 1}`);
            
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
            
            allResults = [...allResults, ...processedResults];
            paginationCount++;
  
            if (pagination && 
                pagination.hasNextPage && 
                typeof pagination.nextPage === 'function') {
              console.log(`Getting page ${paginationCount + 1}, current total: ${allResults.length}`);
              setTimeout(() => {
                pagination.nextPage();
              }, 100);
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

  const searchVenues = async (location, venueType, mapParamDirect = null) => {
    console.log(`Starting comprehensive searchVenues - venueType: ${venueType}, area: ${filters.area}`);
    
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

    let locationObj = location;
    let searchRadius = parseInt(filters.distance) * 1000;

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

    const performMultipleSearches = async (centerLocation, radius, searchType) => {
      const searchQueries = [];
      
      if (searchType === 'all') {
        searchQueries.push(
          'event venue Israel',
          'wedding hall Israel',
          'restaurant Israel',
          'hotel Israel',
          'banquet hall Israel',
          'reception hall Israel',
          'event space Israel',
          'party venue Israel',
          'celebration venue Israel',
          'אולם אירועים',
          'אולם חתונות',
          'מסעדה',
          'בית מלון',
          'מרכז אירועים',
          'אולם קבלות',
          'גן אירועים'
        );
      } else {
        const baseQuery = buildSearchQuery(searchType, search);
        searchQueries.push(
          baseQuery + ' Israel',
          baseQuery.split(' OR ').slice(0, 3).join(' OR') + ' Israel',
          baseQuery.split(' OR ').slice(3, 6).join(' OR') + ' Israel'
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
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          console.error(`Error in search ${i + 1}:`, error);
        }
      }
      
      return allResults;
    };

    if (filters.area === 'all') {
      const searchAreas = [
        { lat: 32.0853, lng: 34.7818, name: 'Center', radius: 25000 }, 
        { lat: 31.7683, lng: 35.2137, name: 'Jerusalem', radius: 30000 }, 
        { lat: 32.7940, lng: 35.0423, name: 'North', radius: 50000 }, 
        { lat: 31.2518, lng: 34.7915, name: 'South', radius: 50000 },
        { lat: 32.4279, lng: 34.9165, name: 'Haifa', radius: 35000 },
        { lat: 31.9606, lng: 34.8035, name: 'Rehovot', radius: 30000 }
      ];
      
      console.log("Starting comprehensive nationwide search");
      
      try {
        let allResults = [];
        
        for (const area of searchAreas) {
          console.log(`Starting search for area: ${area.name}`);
          const areaResults = await performMultipleSearches(area, area.radius, venueType);
          allResults = [...allResults, ...areaResults];
          console.log(`Area ${area.name} completed: ${areaResults.length} results`);
        }
        
        const uniqueResults = [];
        const seenIds = new Set();
        
        allResults.forEach(venue => {
          if (!seenIds.has(venue.place_id)) {
            seenIds.add(venue.place_id);
            uniqueResults.push(venue);
          }
        });
        
        const filteredResults = applyAllFilters(uniqueResults);
        console.log(`Nationwide search completed: ${filteredResults.length} total unique results`);
        
        setAllVenues(filteredResults);
        setLoading(false);
        return;
        
      } catch (error) {
        console.error("Error in nationwide search:", error);
        setLoading(false);
        return;
      }
    }
   
    try {
      console.log(`Starting comprehensive search for specific area: ${filters.area}`);
      const allResults = await performMultipleSearches(locationObj, searchRadius, venueType);
      
      const uniqueResults = [];
      const seenIds = new Set();
      
      allResults.forEach(venue => {
        if (!seenIds.has(venue.place_id)) {
          seenIds.add(venue.place_id);
          uniqueResults.push(venue);
        }
      });
      
      const filteredResults = applyAllFilters(uniqueResults);
      
      console.log(`Area search completed: ${filteredResults.length} total unique results for area: ${filters.area}, type: ${filters.venueType}`);
      
      setAllVenues(filteredResults);
      setLoading(false);
    } catch (error) {
      console.error("Search execution error:", error);
      setLoading(false);
    }
  };

  const getVenueStyle = (venue) => {
    const venueText = (venue.name + ' ' + (venue.vicinity || '') + ' ' + (venue.formatted_address || '') + ' ' + (venue.types ? venue.types.join(' ') : '')).toLowerCase();
    
    const styleKeywords = {
      modern: [
        'modern', 'contemporary', 'new', 'fresh', 'loft', 'studio', 'design', 'boutique', 'trendy',
        'מודרני', 'עכשווי', 'חדש', 'דיזיין', 'בוטיק', 'טרנדי', 'סטודיו', 'לופט'
      ],
      classic: [
        'classic', 'traditional', 'historic', 'heritage', 'vintage', 'old', 'antique', 'palace', 'manor', 'estate',
        'קלאסי', 'מסורתי', 'הסטורי', 'עתיק', 'ארמון', 'אחוזה', 'וינטג', 'מורשת', 'קלסי'
      ],
      luxury: [
        'luxury', 'premium', 'deluxe', 'exclusive', 'elite', 'vip', 'royal', 'grand', 'upscale', 'five star', '5 star',
        'יוקרתי', 'פרמיום', 'דלוקס', 'אקסקלוסיבי', 'אליט', 'מלכותי', 'גרנד', 'חמש כוכבים', 'יוקרה'
      ],
      urban: [
        'outdoor', 'garden', 'park', 'nature', 'botanical', 'green', 'landscape', 'terrace', 'patio', 'courtyard', 'rooftop',
        'גן', 'פארק', 'חוץ', 'טבע', 'נוף', 'ירוק', 'מרפסת', 'חצר', 'גג', 'גינה', 'פתוח', 'חיצוני'
      ]
    };
    
    const styles = [];
    
    Object.keys(styleKeywords).forEach(style => {
      const keywords = styleKeywords[style];
      const hasStyleKeyword = keywords.some(keyword => venueText.includes(keyword));
      
      if (hasStyleKeyword) {
        styles.push(style);
      }
    });
    
    if (venue.price_level >= 3 || venue.rating >= 4.5) {
      if (!styles.includes('luxury')) {
        styles.push('luxury');
      }
    }
    
    if (venueText.includes('hotel') || venueText.includes('מלון') || 
        venueText.includes('conference') || venueText.includes('כנסים')) {
      if (!styles.includes('modern')) styles.push('modern');
      if (!styles.includes('luxury')) styles.push('luxury');
    }
    
    if (venueText.includes('museum') || venueText.includes('מוזיאון') ||
        venueText.includes('cultural') || venueText.includes('תרבות')) {
      if (!styles.includes('classic')) styles.push('classic');
    }
    
    if (venueText.includes('park') || venueText.includes('פארק') ||
        venueText.includes('garden') || venueText.includes('גן') ||
        venueText.includes('outdoor') || venueText.includes('חוץ') ||
        venue.types?.some(type => type.includes('park') || type.includes('garden'))) {
      if (!styles.includes('urban')) styles.push('urban');
    }
    
    return styles.length > 0 ? styles : ['modern']; 
  };

  const applyAllFilters = (venues) => {
    console.log(`Starting filtering with ${venues.length} venues`);
    console.log("Current filters:", filters);
  
    return venues.filter(venue => {
      if (filters.area !== 'all' && !isVenueInArea(venue, filters.area)) {
        return false;
      }
      
      if (filters.capacity && filters.capacity !== '') {
        const capacityLimit = parseInt(filters.capacity);
        
        let estimatedCapacity = 0;
        
        if (venue.user_ratings_total) {
          estimatedCapacity = Math.max(venue.user_ratings_total * 1.5, 30);
        }
        
        const venueText = (venue.name + ' ' + (venue.vicinity || '') + ' ' + (venue.formatted_address || '')).toLowerCase();
        if (venueText.includes('hotel') || venueText.includes('מלון') || 
            venueText.includes('center') || venueText.includes('מרכז') ||
            venueText.includes('convention') || venueText.includes('כנסים')) {
          estimatedCapacity *= 2;
        }
        
        if (venueText.includes('café') || venueText.includes('קפה') || 
            venueText.includes('bistro') || venueText.includes('ביסטרו')) {
          estimatedCapacity *= 0.5;
        }
        
        if (estimatedCapacity < capacityLimit) {
          return false;
        }
      }
       
      if (filters.venueStyle !== 'all') {
        const venueStyles = getVenueStyle(venue);
        if (!venueStyles.includes(filters.venueStyle)) {
          return false;
        }
      }
  
      const amenities = filters.amenities;
      const venueText = (venue.name + ' ' + (venue.vicinity || '') + ' ' + (venue.formatted_address || '') + ' ' + (venue.types ? venue.types.join(' ') : '')).toLowerCase();
  
      if (amenities.parking) {
        const parkingKeywords = ['parking', 'חניה', 'חנייה', 'garage', 'מגרש', 'valet', 'חנה', 'חונה', 'מקום חניה', 'חניות'];
        const hasParking = parkingKeywords.some(keyword => venueText.includes(keyword)) ||
                          venue.types?.some(type => type.includes('parking')) ||
                          (venue.price_level >= 3) || 
                          venueText.includes('mall') || venueText.includes('קניון') ||
                          venueText.includes('hotel') || venueText.includes('מלון');
        
        if (!hasParking) {
          return false;
        }
      }
  
      if (amenities.accessibility) {
        const accessibilityKeywords = ['accessible', 'נגיש', 'נגישות', 'wheelchair', 'כיסא גלגלים', 'barrier-free', 'handicap', 'disabled', 'elevator', 'מעלית', 'רמפה', 'ramp'];
        const hasAccessibility = accessibilityKeywords.some(keyword => venueText.includes(keyword)) ||
                                venue.types?.some(type => type.includes('hospital') || type.includes('government') || type.includes('public')) ||
                                (venue.price_level >= 2) ||
                                venueText.includes('modern') || venueText.includes('מודרני') ||
                                venueText.includes('new') || venueText.includes('חדש');
        
        if (!hasAccessibility) {
          return false;
        }
      }
  
      if (amenities.outdoorSpace) {
        const outdoorKeywords = ['outdoor', 'garden', 'terrace', 'גן', 'חוץ', 'מרפסת', 'patio', 'courtyard', 'rooftop', 'balcony', 'park', 'פארק', 'חצר', 'גינה', 'גג', 'פתוח'];
        const hasOutdoorSpace = outdoorKeywords.some(keyword => venueText.includes(keyword)) ||
                               venue.types?.some(type => type.includes('park') || type.includes('garden') || type.includes('outdoor')) ||
                               venueText.includes('villa') || venueText.includes('וילה') ||
                               venueText.includes('resort') || venueText.includes('נופש');
        
        if (!hasOutdoorSpace) {
          return false;
        }
      }
  
      if (amenities.catering) {
        const cateringKeywords = ['catering', 'קייטרינג', 'מטבח', 'restaurant', 'מסעדה', 'kitchen', 'dining', 'food', 'kosher', 'כשר', 'chef', 'שף', 'מזון', 'אוכל', 'ארוחה'];
        const hasCatering = cateringKeywords.some(keyword => venueText.includes(keyword)) ||
                           venue.types?.some(type => type.includes('restaurant') || type.includes('food') || type.includes('meal_delivery') || type.includes('meal_takeaway')) ||
                           venueText.includes('hotel') || venueText.includes('מלון') ||
                           venueText.includes('banquet') || venueText.includes('אולם') ||
                           venueText.includes('event') || venueText.includes('אירוע');
        
        if (!hasCatering) {
          return false;
        }
      }
  
      if (amenities.accommodation) {
        const accommodationKeywords = ['hotel', 'accommodation', 'מלון', 'לינה', 'צימר', 'resort', 'inn', 'lodge', 'guest', 'room', 'חדר', 'אירוח', 'מקום לינה', 'pensione', 'פנסיון'];
        const hasAccommodation = accommodationKeywords.some(keyword => venueText.includes(keyword)) ||
                                venue.types?.some(type => type.includes('lodging') || type.includes('hotel') || type.includes('resort')) ||
                                venueText.includes('boutique') || venueText.includes('בוטיק') ||
                                (venue.price_level >= 3); // מקומות יקרים לרוב יש להם אפשרויות לינה
        
        if (!hasAccommodation) {
          return false;
        }
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
    console.log("Applying filters:", filters);
    const currentMap = mapInstance.current || map;
    
    setAllVenues([]);
    setVenues([]);
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
      searchVenues(areaLocation.location, filters.venueType, currentMap);
      return;
    }
  
    if (filters.area === 'all') {
      const israelCenter = { lat: 31.5, lng: 34.75 };
      if (currentMap) {
        currentMap.setCenter(israelCenter);
        currentMap.setZoom(7); 
      }
      searchVenues(israelCenter, filters.venueType, currentMap);
      return;
    }
  
    if (currentMap && currentMap.getCenter) {
      searchVenues(currentMap.getCenter(), filters.venueType, currentMap);
    } else {
      const israelCenter = { lat: 31.5, lng: 34.75 };
      searchVenues(israelCenter, filters.venueType, currentMap);
    }
  };

  const handlePageChange = (pageNumber) => {
    setLoadingPage(true);
    setCurrentPage(pageNumber);
    
    setTimeout(() => {
      const startIndex = (pageNumber - 1) * venuesPerPage;
      const endIndex = startIndex + venuesPerPage;
      const newPageVenues = allVenues.slice(startIndex, endIndex);
      
      setVenues(newPageVenues);
      setLoadingPage(false);
      
      if (newPageVenues.length > 0) {
        addMarkers(newPageVenues);
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
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
          disabled={loadingPage}
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
          disabled={loadingPage}
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
          disabled={loadingPage}
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
          disabled={loadingPage}
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
          disabled={loadingPage}
        >
          ›
        </button>
      );
    }

    return pageNumbers;
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
        setSuccessMessage(t('events.features.venues.venueAddedSuccess'));
       
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
        const width = useHighQuality ? Math.max(maxWidth, 500) : maxWidth;
        const height = useHighQuality ? Math.max(maxHeight, 300) : maxHeight;
        return photo.getUrl({ maxWidth: width, maxHeight: height });
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

    for (let i = 0; i < venue.photos.length; i++) {
      try {
        const photo = venue.photos[i];
        if (photo && typeof photo.getUrl === 'function') {
          const imageUrl = photo.getUrl({ maxWidth: 300, maxHeight: 200 });
          if (imageUrl && imageUrl.trim() !== '') {
            return { url: imageUrl, index: i };
          }
        }
      } catch (error) {
        console.error(`Error getting photo at index ${i}:`, error);
        continue;
      }
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
        const photo = venue.photos[i];
        if (photo && typeof photo.getUrl === 'function') {
          const photoUrl = photo.getUrl({ maxWidth: 100, maxHeight: 70 });
          if (photoUrl && photoUrl.trim() !== '') {
            validPhotos.push({ photo, url: photoUrl, index: i });
          }
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
        <h1>{t('events.features.venues.searchTitle')}</h1>
        <p>{t('events.features.venues.searchSubtitle')}</p>
      </div>
     
      <div className="venue-search-container">
        <form onSubmit={handleSearchSubmit} className="venue-search-form">
          <input
            type="text"
            placeholder={t('events.features.venues.searchPlaceholder')}
            value={search}
            onChange={handleSearchChange}
            className="venue-search-input"
          />
          <button type="submit" className="venue-search-button">{t('events.features.venues.searchButton')}</button>
        </form>
      </div>
     
      <div className="venue-content">
        <div className="venue-filters">
          <h3>{t('events.features.venues.filtersTitle')}</h3>
         
          <div className="filter-group">
            <label htmlFor="area">{t('events.features.venues.filters.areaLabel')}</label>
            <select
              id="area"
              name="area"
              value={filters.area}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="all">{t('events.features.venues.filters.allAreas')}</option>
              <option value="jerusalem">{t('events.features.venues.filters.jerusalem')}</option>
              <option value="center">{t('events.features.venues.filters.center')}</option>
              <option value="south">{t('events.features.venues.filters.south')}</option>
              <option value="north">{t('events.features.venues.filters.north')}</option>
            </select>
          </div>
         
          <div className="filter-group">
            <label htmlFor="venueType">{t('events.features.venues.filters.typeLabel')}</label>
            <select
              id="venueType"
              name="venueType"
              value={filters.venueType}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="all">{t('events.features.venues.filters.allTypes')}</option>
              <option value="restaurant">{t('events.features.venues.filters.restaurant')}</option>
              <option value="event_venue">{t('events.features.venues.filters.eventVenue')}</option>
              <option value="banquet_hall">{t('events.features.venues.filters.banquetHall')}</option>
              <option value="hotel">{t('events.features.venues.filters.hotel')}</option>
              <option value="park">{t('events.features.venues.filters.park')}</option>
              <option value="museum">{t('events.features.venues.filters.museum')}</option>
            </select>
          </div>
         
          <div className="filter-group">
            <label htmlFor="venueStyle">{t('events.features.venues.filters.styleLabel')}</label>
            <select
              id="venueStyle"
              name="venueStyle"
              value={filters.venueStyle}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="all">{t('events.features.venues.filters.allStyles')}</option>
              <option value="modern">{t('events.features.venues.filters.modern')}</option>
              <option value="classic">{t('events.features.venues.filters.classic')}</option>
              <option value="luxury">{t('events.features.venues.filters.luxury')}</option>
              <option value="urban">{t('events.features.venues.filters.outside/garden')}</option>
            </select>
          </div>
         
          <div className="filter-group">
            <label htmlFor="capacity">{t('events.features.venues.filters.capacityLabel')}</label>
            <select
              id="capacity"
              name="capacity"
              value={filters.capacity}
              onChange={handleFilterChange}
              className={isRTL ? 'rtl-select' : 'ltr-select'}
            >
              <option value="">{t('events.features.venues.filters.selectCapacity')}</option>
              <option value="50">{t('events.features.venues.filters.upTo50')}</option>
              <option value="100">{t('events.features.venues.filters.upTo100')}</option>
              <option value="200">{t('events.features.venues.filters.upTo200')}</option>
              <option value="300">{t('events.features.venues.filters.upTo300')}</option>
              <option value="500">{t('events.features.venues.filters.upTo500')}</option>
              <option value="1000">{t('events.features.venues.filters.above500')}</option>
            </select>
          </div>
         
          <div className="filter-group amenities-group">
            <label>{t('events.features.venues.filters.amenitiesLabel')}</label>
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="parking"
                  checked={filters.amenities.parking}
                  onChange={handleFilterChange}
                />
                {t('events.features.venues.filters.parking')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="accessibility"
                  checked={filters.amenities.accessibility}
                  onChange={handleFilterChange}
                />
                {t('events.features.venues.filters.accessibility')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="outdoorSpace"
                  checked={filters.amenities.outdoorSpace}
                  onChange={handleFilterChange}
                />
                {t('events.features.venues.filters.outdoorSpace')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="catering"
                  checked={filters.amenities.catering}
                  onChange={handleFilterChange}
                />
                {t('events.features.venues.filters.catering')}
              </label>
             
              <label>
                <input
                  type="checkbox"
                  name="accommodation"
                  checked={filters.amenities.accommodation}
                  onChange={handleFilterChange}
                />
                {t('events.features.venues.filters.accommodation')}
              </label>
            </div>
          </div>
         
          <button className="filter-apply-button" onClick={applyFilters}>{t('events.features.venues.filters.applyButton')}</button>
        </div>
       
        <div className="venue-results-container">
          <div className="venue-map" ref={mapRef}></div>
         
          <div className="venue-list">
            <div className="venue-list-header">
              <h3>{t('events.features.venues.searchResults')}</h3>
              {!loading && allVenues.length > 0 && (
                <div className="results-info">
                  מציג {((currentPage - 1) * venuesPerPage) + 1}-{Math.min(currentPage * venuesPerPage, allVenues.length)} מתוך {allVenues.length} תוצאות
                </div>
              )}
            </div>
           
            {loading ? (
              <div className="loading-indicator">
                <div className="loading-spinner"></div>
                <p>{t('events.features.venues.loading')}</p>
              </div>
            ) : loadingPage ? (
              <div className="loading-indicator">
                <div className="loading-spinner"></div>
                <p>טוען עמוד {currentPage}...</p>
              </div>
            ) : venues.length === 0 ? (
              <div className="no-results">{t('events.features.venues.noResults')}</div>
            ) : (
              <>
                <div className="venues-grid">
                  {venues.map(venue => {
                    return (
                      <VenueCardWithImage
                        key={venue.place_id}
                        venue={venue}
                        isSelected={selectedVenue && selectedVenue.place_id === venue.place_id}
                        onClick={() => {
                          const mainImageData = getMainVenueImage(venue);
                          setSelectedVenuePhotoIndex(mainImageData ? mainImageData.index : null);
                          getVenueDetails(venue.place_id);
                        }}
                        t={t}
                      />
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
             
              {successMessage && (
                <div className="success-message">
                  {successMessage}
                </div>
              )}
             
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
                              e.target.src = `https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVenue.name || t('events.features.venues.defaultVenueName'))}`;
                            }}
                          />
                        );
                      } else {
                        return (
                          <img
                            src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVenue.name || t('events.features.venues.defaultVenueName'))}`}
                            alt={selectedVenue.name || t('events.features.venues.defaultVenueName')}
                          />
                        );
                      }
                    })()
                  ) : (
                    <img
                      src={`https://dummyimage.com/600x400/eeeeee/333333&text=${encodeURIComponent(selectedVenue.name || t('events.features.venues.defaultVenueName'))}`}
                      alt={selectedVenue.name || t('events.features.venues.defaultVenueName')}
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
                  <strong>{t('events.features.venues.details.address')}:</strong> {
                    isRTL && selectedVenue.originalFormattedAddress ? 
                    selectedVenue.originalFormattedAddress : 
                    selectedVenue.formatted_address || selectedVenue.vicinity
                  }
                </p>
               
                {selectedVenue.formatted_phone_number && (
                  <p className="phone">
                    <strong>{t('events.features.venues.details.phone')}:</strong> {selectedVenue.formatted_phone_number}
                  </p>
                )}
               
                {selectedVenue.website && (
                  <p className="website">
                    <strong>{t('events.features.venues.details.website')}:</strong> <a href={selectedVenue.website} target="_blank" rel="noopener noreferrer">{selectedVenue.website}</a>
                  </p>
                )}
               
                {selectedVenue.rating && (
                  <p className="rating-details">
                    <strong>{t('events.features.venues.details.rating')}:</strong> {selectedVenue.rating} {t('events.features.venues.details.outOf5')} ({selectedVenue.user_ratings_total} {t('events.features.venues.details.reviews')})
                  </p>
                )}
               
                {selectedVenue.opening_hours && selectedVenue.opening_hours.weekday_text && (
                  <div className="opening-hours">
                    <strong>{t('events.features.venues.details.openingHours')}:</strong>
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
                  <h3>{t('events.features.venues.details.reviewsTitle')}</h3>
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
                    {t('events.features.venues.selectButton')}
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

const VenueCardWithImage = ({ venue, isSelected, onClick, t }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [imageAttempt, setImageAttempt] = useState(0);
  
  const imageRef = useRef(null);
  const maxImageAttempts = 2; 
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: '50px' } 
    );
    
    if (imageRef.current) {
      observer.observe(imageRef.current);
    }
    
    return () => {
      if (imageRef.current) {
        observer.unobserve(imageRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && venue.photos && venue.photos.length > 0 && imageAttempt < maxImageAttempts) {
      const photoIndex = Math.min(imageAttempt, venue.photos.length - 1);
      try {
        const photo = venue.photos[photoIndex];
        if (photo && typeof photo.getUrl === 'function') {
          const url = photo.getUrl({ maxWidth: 300, maxHeight: 200 });
          if (url) {
            setCurrentImageUrl(url);
          } else {
            setImageAttempt(prev => prev + 1);
          }
        }
      } catch (error) {
        setImageAttempt(prev => prev + 1);
      }
    }
  }, [isVisible, venue, imageAttempt]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
    
    if (imageAttempt < maxImageAttempts - 1 && venue.photos && venue.photos.length > imageAttempt + 1) {
      setTimeout(() => {
        setImageAttempt(prev => prev + 1);
        setImageError(false);
      }, 100);
    }
  };

  const getDefaultImage = () => {
    const truncatedName = venue.name?.substring(0, 10) || 'Venue';
    return `https://dummyimage.com/300x200/f8f9fa/6c757d&text=${encodeURIComponent(truncatedName)}`;
  };

  return (
    <div 
      ref={imageRef}
      className={`venue-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="venue-image">
        {isVisible && currentImageUrl && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="image-loading">
                <div className="loading-spinner-small"></div>
              </div>
            )}
            <img
              src={currentImageUrl}
              alt={venue.name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ 
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.2s ease' 
              }}
              loading="lazy"
            />
          </>
        ) : (
          <img
            src={getDefaultImage()}
            alt={venue.name || 'Venue'}
            onLoad={() => setImageLoaded(true)}
            style={{ opacity: 1 }}
          />
        )}
      </div>
      
      <div className="venue-info">
        <h4>{venue.name}</h4>
        <p className="venue-address">
          {venue.formatted_address || venue.vicinity || t('events.features.venues.noAddress')}
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
      </div>
    </div>
  );
};

export default VenuePage;