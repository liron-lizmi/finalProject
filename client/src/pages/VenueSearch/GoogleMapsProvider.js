// src/pages/VenueSearch/GoogleMapsProvider.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

// הספריות שנרצה לטעון
const libraries = ['places'];

// יצירת הקונטקסט
const GoogleMapsContext = createContext(null);

// ספק הקונטקסט
export const GoogleMapsProvider = ({ children }) => {
  const [map, setMap] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const [geocoder, setGeocoder] = useState(null);

  // טעינת ה-API של גוגל מפות
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // יצירת שירות המקומות והג'אוקודר כשה-API נטען
  useEffect(() => {
    if (isLoaded && window.google) {
      // אם יש מפה, נשתמש בה, אחרת ניצור אלמנט מפה זמני
      if (map) {
        setPlacesService(new window.google.maps.places.PlacesService(map));
      } else {
        const tempDiv = document.createElement('div');
        setPlacesService(new window.google.maps.places.PlacesService(tempDiv));
      }
      
      // יצירת geocoder
      setGeocoder(new window.google.maps.Geocoder());
    }
  }, [isLoaded, map]);

  const value = {
    isLoaded,
    loadError,
    map,
    setMap,
    placesService,
    geocoder,
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY
  };

  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
};

// הוק לשימוש ב-Google Maps Context
export const useGoogleMaps = () => {
  const context = useContext(GoogleMapsContext);
  if (context === null) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
};