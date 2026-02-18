// utils/coordinateExtractor.js
// Utility to extract latitude and longitude from Google Maps URLs

/**
 * Extract coordinates from various Google Maps URL formats
 * @param {string} url - Google Maps URL
 * @returns {Object|null} - { lat: number, lng: number } or null if not found
 */
function extractCoordinatesFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  // Pattern 1: @lat,lng format (e.g., https://maps.google.com/@21.2567,81.6294,15z)
  const match1 = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match1) {
    return { lat: parseFloat(match1[1]), lng: parseFloat(match1[2]) };
  }

  // Pattern 2: q=lat,lng format (e.g., https://maps.google.com/?q=21.2567,81.6294)
  const match2 = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match2) {
    return { lat: parseFloat(match2[1]), lng: parseFloat(match2[2]) };
  }

  // Pattern 3: ll=lat,lng format
  const match3 = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match3) {
    return { lat: parseFloat(match3[1]), lng: parseFloat(match3[2]) };
  }

  // Pattern 4: place_id with coordinates in the URL
  const match4 = url.match(/place\/([^\/]+)\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match4) {
    return { lat: parseFloat(match4[2]), lng: parseFloat(match4[3]) };
  }

  return null;
}

/**
 * Update hospital document with coordinates if googleMapUrl is provided
 * @param {Object} hospitalDoc - Mongoose hospital document
 * @returns {Promise<Object>} - Updated hospital document or original if no coordinates found
 */
async function updateHospitalCoordinates(hospitalDoc) {
  if (!hospitalDoc) return null;

  const url = hospitalDoc.googleMapUrl || hospitalDoc.mapLink || hospitalDoc.location || hospitalDoc.locationLink;
  
  if (!url) {
    return hospitalDoc;
  }

  const coords = extractCoordinatesFromUrl(url);
  
  if (coords && coords.lat && coords.lng) {
    hospitalDoc.location = {
      lat: coords.lat,
      lng: coords.lng
    };
    return hospitalDoc;
  }

  return hospitalDoc;
}

module.exports = {
  extractCoordinatesFromUrl,
  updateHospitalCoordinates
};

