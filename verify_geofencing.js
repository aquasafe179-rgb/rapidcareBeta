const { extractCoordinatesFromUrl } = require('./utils/coordinateExtractor');

function testGeofence() {
    console.log("--- Testing Coordinate Extraction ---");
    const urls = [
        "https://www.google.com/maps/@21.2567,81.6294,15z",
        "https://www.google.com/maps?q=19.0760,72.8777",
        "https://www.google.co.in/maps/place/AIIMS+Raipur/@21.2570086,81.5794025,17z/data=!3m1!4b1!4m6!3m5!1s0x3a28de4f00000001:0x41e8c0576356bd6!8m2!3d21.2570086!4d81.5819774!16s%2Fm%2F0_r76z4?entry=ttu",
    ];

    urls.forEach(url => {
        const coords = extractCoordinatesFromUrl(url);
        console.log(`URL: ${url.substring(0, 50)}...`);
        console.log(`Result: ${JSON.stringify(coords)}`);
    });

    console.log("\n--- Testing Haversine Distance ---");
    // Manual implementation of the distance function from the route
    function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    const hospital = { lat: 21.2567, lng: 81.6294 }; // AIIMS Raipur approx
    const near = { lat: 21.2570, lng: 81.6300 };   // ~100m away
    const far = { lat: 21.2800, lng: 81.6500 };    // ~3km away

    const distNear = getDistance(near.lat, near.lng, hospital.lat, hospital.lng);
    const distFar = getDistance(far.lat, far.lng, hospital.lat, hospital.lng);

    console.log(`Near distance: ${(distNear * 1000).toFixed(2)}m (Within 500m: ${distNear <= 0.5})`);
    console.log(`Far distance: ${(distFar * 1000).toFixed(2)}m (Within 500m: ${distFar <= 0.5})`);
}

testGeofence();
