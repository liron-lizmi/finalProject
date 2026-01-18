import React,  { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '../../../styles/VenuePage.css';
import venueService from '../../../services/venueService';
import { translateItems} from '../../../services/translationUtils';

window.googleMapsLoaded = window.googleMapsLoaded || false;

const VenuePage = ({ onSelectVenue }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [venues, setVenues] = useState([]);
  const [allVenues, setAllVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [search, setSearch] = useState('');
  const [map, setMap] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [selectedVenuePhotoIndex, setSelectedVenuePhotoIndex] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [markers, setMarkers] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [venuesPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [filtersApplied, setFiltersApplied] = useState(false);
  
  const [filters, setFilters] = useState({
    area: 'all',
    venueType: 'all',
    venueStyle: 'all',
    amenities: {
      parking: false,
      accessibility: false,
      outdoorSpace: false,
      catering: false
    },
    distance: '50',
  });

  const mapRef = useRef(null);
  const isMapInitialized = useRef(false);
  const isEffectRun = useRef(false);
  const mapInstance = useRef(null);
  const searchCache = useRef(new Map());
 
  const eventId = location.state?.eventId;
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';
  const isEnglish = i18n.language === 'en' || i18n.language === 'en-US';

const searchVenues = async (filterParams, searchQuery = '', shouldApplyFilters = false) => {
  setLoading(true);
  setCurrentPage(1);
  setAllVenues([]);
  setVenues([]);
  clearMarkers();

  try {
    const result = await venueService.searchVenues(
      filterParams, 
      searchQuery, 
      1,
      isRTL ? 'he' : 'en'
    );
    
    let venues = result.venues;
    
    if (isEnglish) {
      venues = await translateItems(venues, 'en');
    }
    
    setAllVenues(venues);
    setHasMoreResults(result.hasMore);
    setLoading(false);

  } catch (error) {
    console.error('Error searching venues:', error);
    setError(error.message || t('errors.generalError'));
    setLoading(false);
  }
};

  const getVenueDetails = async (placeId) => {
    if (!placeId) return;
  
    try {
      
      const details = await venueService.getVenueDetails(
        placeId, 
        isRTL ? 'he' : 'en'
      );

      setSelectedVenue(details);
      
      if (selectedVenuePhotoIndex !== null) {
        setSelectedPhoto(selectedVenuePhotoIndex);
      } else {
        setSelectedPhoto(0);
      }

    } catch (error) {
      console.error('  Error loading venue details:', error);
      setError(error.message || t('errors.generalError'));
    }
  };

  const loadNextPage = async () => {
    if (loadingPage || !hasMoreResults) return;
    
    setLoadingPage(true);

    try {
      const nextPage = currentPage + 1;
      
      const result = await venueService.searchVenues(
        filters,
        search,
        nextPage,
        isRTL ? 'he' : 'en'
      );

      setAllVenues(prev => [...prev, ...result.venues]);
      setCurrentPage(nextPage);
      setHasMoreResults(result.hasMore);

    } catch (error) {
      console.error('Error loading next page:', error);
      setError(error.message || t('errors.generalError'));
    } finally {
      setLoadingPage(false);
    }
  };

  const addMarkers = (venues) => {
    clearMarkers();
  
    const currentMap = mapInstance.current || map;
    if (!currentMap || !window.google) return;

    const newMarkers = venues.map(venue => {
      if (!venue.geometry || !venue.geometry.location) return null;
      
      try {
        const position = {
          lat: venue.geometry.location.lat,
          lng: venue.geometry.location.lng
        };

        const marker = new window.google.maps.Marker({
          position: position,
          map: currentMap,
          title: venue.name
        });
        
        marker.addListener('click', () => {
          getVenueDetails(venue.place_id);
        });
        
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

  const updateMapBounds = (venues) => {
    const currentMap = mapInstance.current || map;
    if (!currentMap || !window.google || venues.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    
    venues.forEach(venue => {
      if (venue.geometry && venue.geometry.location) {
        bounds.extend({
          lat: venue.geometry.location.lat,
          lng: venue.geometry.location.lng
        });
      }
    });

    currentMap.fitBounds(bounds);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    searchVenues(filters, search);
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
    setAllVenues([]);
    setVenues([]);
    setCurrentPage(1);
    setTotalPages(0);
    setHasMoreResults(false);
    clearMarkers();
    
    setFiltersApplied(true); 
    searchVenues(filters, search, true);
  };

 const loadCurrentPageVenues = () => {
    setVenues(allVenues);
    
    if (allVenues.length > 0) {
      addMarkers(allVenues);
      updateMapBounds(allVenues);
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

  const getPhotoUrl = (photo, maxWidth = 300, maxHeight = 200) => {
    if (photo && photo.url) {
      return photo.url;
    }
    
    if (typeof photo === 'string' && photo.startsWith('http')) {
      return photo;
    }
    
    return null;
  };

  const getMainVenueImage = (venue) => {
    if (!venue.photos || venue.photos.length === 0) return null;

    for (let i = 0; i < venue.photos.length; i++) {
      const photo = venue.photos[i];
      const imageUrl = getPhotoUrl(photo, 300, 200);
      
      if (imageUrl && imageUrl.trim() !== '') {
        return { url: imageUrl, index: i };
      }
    }
    
    return null;
  };

  const getValidPhotos = (venue) => {
    if (!venue.photos || venue.photos.length === 0) return [];

    return venue.photos.map((photo, index) => {
      const url = getPhotoUrl(photo, 100, 70);
      if (url && url.trim() !== '') {
        return { photo, url, index };
      }
      return null;
    }).filter(Boolean);
  };

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
  }, [isRTL, i18n.language]);

  useEffect(() => {
    if (isEffectRun.current) return;
    isEffectRun.current = true;
   
    const initMap = () => {
      if (!mapRef.current || !window.google) return;
      if (isMapInitialized.current) return;
      
      isMapInitialized.current = true;

      const mapOptions = {
        center: { lat: 31.7683, lng: 35.2137 },
        zoom: 7,
      };

      const newMap = new window.google.maps.Map(mapRef.current, mapOptions);
      mapInstance.current = newMap;
      setMap(newMap);
            
      setFiltersApplied(false); 
      searchVenues(filters, '', false); 
    };

    if (window.google && window.google.maps) {
      initMap();
    } else {
      const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&callback=initMapCallback&language=${isRTL ? 'he' : 'en'}`;
      script.async = true;
      script.defer = true;
      
      window.initMapCallback = initMap;
      document.head.appendChild(script);
    }

    return () => {
      clearMarkers();
    };
  }, []);

  useEffect(() => {
    if (allVenues.length > 0) {
      const totalVenues = allVenues.length;
      const pages = Math.ceil(totalVenues / venuesPerPage);
      setTotalPages(pages);
      
      loadCurrentPageVenues();
      addMarkers(allVenues);
      updateMapBounds(allVenues);
    }
  }, [allVenues, currentPage, venuesPerPage]);

  return (
    <div className="vup-venue-page">
      <div className="vup-venue-header">
        <h1>{t('events.features.venues.searchTitle')}</h1>
        <p>{t('events.features.venues.searchSubtitle')}</p>
      </div>
     
      <div className="vup-venue-search-container">
        <form onSubmit={handleSearchSubmit} className="vup-venue-search-form">
          <input
            type="text"
            placeholder={t('events.features.venues.searchPlaceholder')}
            value={search}
            onChange={handleSearchChange}
            className="vup-venue-search-input"
          />
          <button type="submit" className="vup-venue-search-button">
            {t('events.features.venues.searchButton')}
          </button>
        </form>
      </div>
     
      <div className="vup-venue-content">
        <div className="vup-venue-filters">
          <h3>{t('events.features.venues.filtersTitle')}</h3>
         
          <div className="vup-filter-group">
            <label htmlFor="area">{t('events.features.venues.filters.areaLabel')}</label>
            <select
              id="area"
              name="area"
              value={filters.area}
              onChange={handleFilterChange}
              className={isRTL ? 'vup-rtl-select' : 'vup-ltr-select'}
            >
              <option value="all">{t('events.features.venues.filters.allAreas')}</option>
              <option value="jerusalem">{t('events.features.venues.filters.jerusalem')}</option>
              <option value="center">{t('events.features.venues.filters.center')}</option>
              <option value="south">{t('events.features.venues.filters.south')}</option>
              <option value="north">{t('events.features.venues.filters.north')}</option>
            </select>
          </div>
         
          <div className="vup-filter-group">
            <label htmlFor="venueType">{t('events.features.venues.filters.typeLabel')}</label>
            <select
              id="venueType"
              name="venueType"
              value={filters.venueType}
              onChange={handleFilterChange}
              className={isRTL ? 'vup-rtl-select' : 'vup-ltr-select'}
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
         
          <div className="vup-filter-group">
            <label htmlFor="venueStyle">{t('events.features.venues.filters.styleLabel')}</label>
            <select
              id="venueStyle"
              name="venueStyle"
              value={filters.venueStyle}
              onChange={handleFilterChange}
              className={isRTL ? 'vup-rtl-select' : 'vup-ltr-select'}
            >
              <option value="all">{t('events.features.venues.filters.allStyles')}</option>
              <option value="modern">{t('events.features.venues.filters.modern')}</option>
              <option value="classic">{t('events.features.venues.filters.classic')}</option>
              <option value="luxury">{t('events.features.venues.filters.luxury')}</option>
              <option value="urban">{t('events.features.venues.filters.outside/garden')}</option>
            </select>
          </div>
         
          <div className="vup-filter-group vup-amenities-group">
            <label>{t('events.features.venues.filters.amenitiesLabel')}</label>
            <div className="vup-checkbox-group">
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
            </div>
          </div>
         
          <button className="vup-filter-apply-button" onClick={applyFilters}>
            {t('events.features.venues.filters.applyButton')}
          </button>
        </div>
       
        <div className="vup-venue-results-container">
          <div className="vup-venue-map" ref={mapRef}></div>
         
          <div className="vup-venue-list">
            <div className="vup-venue-list-header">
              <h3>{t('events.features.venues.searchResults')}</h3>
            </div>
            {error && (
              <div className="vup-error-message">
                {error}
                <button 
                  className="vup-error-close-btn"
                  onClick={() => setError(null)}
                >
                  ×
                </button>
              </div>
            )}
           
            {loading ? (
              <div className="vup-loading-indicator">
                <p>{t('events.features.venues.loading')}</p>
              </div>
            ) : venues.length === 0 ? (
              <div className="vup-no-results">{t('events.features.venues.noResults')}</div>
            ) : (
              <>
                <div className="vup-venues-grid">
                  {venues.map(venue => (
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
                  ))}
                </div>
                {hasMoreResults && (
                  <div className="vup-load-more-container">
                    <button 
                      className="vup-load-more-button"
                      onClick={loadNextPage}
                      disabled={loadingPage}
                    >
                      {loadingPage ? (
                        t('common.loading')
                      ) : (
                        t('common.loadMore')
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
       
        {selectedVenue && (
          <div className="vup-venue-details">
            <div className="vup-venue-details-content">
              <div className="vup-venue-details-header">
                <h2>{selectedVenue.name}</h2>
                <button className="vup-close-details" onClick={() => {
                  setSelectedVenue(null);
                  setSelectedVenuePhotoIndex(null);
                }}>×</button>
              </div>
             
              {successMessage && (
                <div className="vup-success-message">
                  {successMessage}
                </div>
              )}
             
              <div className="vup-venue-photos">
                <div className="vup-main-photo">
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
                  <div className="vup-all-photos">
                    {getValidPhotos(selectedVenue).map(({ photo, url, index }) => (
                      <img
                        key={index}
                        src={url}
                        alt={`${selectedVenue.name} - ${index + 1}`}
                        className={`vup-thumbnail-photo ${selectedPhoto === index ? 'vup-selected' : ''}`}
                        onClick={() => setSelectedPhoto(index)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
                          
              <div className="vup-venue-info-detailed">
                <p className="vup-address">
                  <strong>{t('events.features.venues.details.address')}:</strong> {
                    isRTL && selectedVenue.originalFormattedAddress ? 
                    selectedVenue.originalFormattedAddress : 
                    selectedVenue.formatted_address || selectedVenue.vicinity
                  }
                </p>
               
                {selectedVenue.formatted_phone_number && (
                  <p className="vup-phone">
                    <strong>{t('events.features.venues.details.phone')}:</strong> {selectedVenue.formatted_phone_number}
                  </p>
                )}
               
                {selectedVenue.website && (
                  <p className="vup-website">
                    <strong>{t('events.features.venues.details.website')}:</strong> <a href={selectedVenue.website} target="_blank" rel="noopener noreferrer">{selectedVenue.website}</a>
                  </p>
                )}
               
                {selectedVenue.rating && (
                  <p className="vup-rating-details">
                    <strong>{t('events.features.venues.details.rating')}:</strong> {selectedVenue.rating} {t('events.features.venues.details.outOf5')} ({selectedVenue.user_ratings_total} {t('events.features.venues.details.reviews')})
                  </p>
                )}
               
                {selectedVenue.opening_hours && selectedVenue.opening_hours.weekday_text && (
                  <div className="vup-opening-hours">
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
                <div className="vup-venue-reviews">
                  <h3>{t('events.features.venues.details.reviewsTitle')}</h3>
                  <div className="vup-reviews-list">
                    {selectedVenue.reviews.slice(0, 3).map((review, index) => (
                      <div key={index} className="vup-review">
                        <div className="vup-review-header">
                          <span className="vup-reviewer">{review.author_name}</span>
                          <span className="vup-review-rating">
                            {'★'.repeat(review.rating)}
                            {'☆'.repeat(5 - review.rating)}
                          </span>
                          <span className="vup-review-date">{new Date(review.time * 1000).toLocaleDateString()}</span>
                        </div>
                        <p className="vup-review-text">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
             
              <div className="vup-venue-actions">
                {!successMessage && (
                  <button className="vup-select-venue-button" onClick={() => selectVenue(selectedVenue)}>
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
  const imageRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

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

  const getDefaultImage = () => {
    const truncatedName = venue.name?.substring(0, 15) || 'Venue';
    return `https://via.placeholder.com/300x200/4CAF50/ffffff?text=${encodeURIComponent(truncatedName)}`;
  };

  const getImageUrl = () => {
    if (!venue.photos || venue.photos.length === 0) {
      return getDefaultImage();
    }

    const photo = venue.photos[0];
    
    if (photo && photo.url) {
      return photo.url;
    }
    
    if (typeof photo === 'string' && photo.startsWith('http')) {
      return photo;
    }
    
    if (photo && photo.photo_reference) {
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=300&photoreference=${photo.photo_reference}&key=${apiKey}`;
      }
    }
    
    return getDefaultImage();
  };

  const imageUrl = getImageUrl();

  return (
    <div 
      ref={imageRef}
      className={`vup-venue-card ${isSelected ? 'vup-selected' : ''}`}
      onClick={onClick}
    >
      <div className="vup-venue-image">
        {isVisible ? (
          <>
            {!imageLoaded && !imageError && (
              <div className="vup-image-loading">
              </div>
            )}
            <img
              src={imageUrl}
              alt={venue.name}
              className={imageLoaded ? 'vup-loaded' : 'vup-loading'}
              onLoad={() => {
                setImageLoaded(true);
              }}
              onError={(e) => {
                setImageError(true);
                setImageLoaded(true);
                if (e.target.src !== getDefaultImage()) {
                  e.target.src = getDefaultImage();
                }
              }}
              loading="lazy"
            />
            
          </>
        ) : (
          <div className="vup-image-placeholder"></div>
        )}
      </div>
      
      <div className="vup-venue-info">
        <h4>{venue.name}</h4>
        <p className="vup-venue-address">
          {venue.formatted_address || venue.vicinity || t('events.features.venues.noAddress')}
        </p>
        
        {venue.rating && (
          <div className="vup-venue-rating">
            <span className="vup-stars">
              {Array(Math.floor(venue.rating)).fill().map((_, i) => (
                <span key={i} className="vup-star">★</span>
              ))}
            </span>
            <span className="vup-rating-value">{venue.rating}</span>
            <span className="vup-review-count">({venue.user_ratings_total || 0})</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenuePage;