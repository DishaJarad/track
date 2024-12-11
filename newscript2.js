// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDmPg_yetiIglgd_Or64ogeU7263ptb11A",
  authDomain: "real-time-tracking-7dd0d.firebaseapp.com",
  databaseURL: "https://real-time-tracking-7dd0d-default-rtdb.firebaseio.com",
  projectId: "real-time-tracking-7dd0d",
  storageBucket: "real-time-tracking-7dd0d.appspot.com",
  messagingSenderId: "139938078018",
  appId: "1:139938078018:web:91dc384a01a2583058fcdb",
  measurementId: "G-L1KLT8CB12"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Initialize map
const map = L.map("map").setView([28.7041, 77.1025], 13); // Default map center, can be changed
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// Custom icon for the destination
const destinationIcon = L.icon({
  iconUrl: "./images/flag.png", // Update this path to your image
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

// Custom icon for source
const sourceIcon = L.icon({
  iconUrl: 'images/bike.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

let destinationCoords = [0, 0];
let sourceMarker = null;
let routeControl = null;

// Function to get coordinates from place name using Nominatim API
function getCoordinatesFromAddress(address) {
  const OPENCAGE_API_KEY = "b2e0f71592fe44ea9391ee8a0698f9ca";
  const apiUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(address)}&key=${OPENCAGE_API_KEY}`;

  return fetch(apiUrl)
    .then(response => response.json())
    .then(data => {
      if (data && data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry;
        console.log(`Coordinates for "${address}": Latitude = ${lat}, Longitude = ${lng}`);
        return [lat, lng];
      } else {
        throw new Error("Address not found");
      }
    })
    .catch(error => {
      console.error("Error fetching coordinates:", error);
      throw error;
    });
}

function fetchAndUpdateDestination() {
  const userId = document.getElementById("userIdInput").value;
  if (!userId) {
    alert("Please enter a User ID.");
    return;
  }

  fetch(`https://real-time-tracking-7dd0d-default-rtdb.firebaseio.com/Receiver/${userId}.json`)
    .then(response => {
      if (!response.ok) throw new Error(`User with ID ${userId} not found.`);
      return response.json();
    })
    .then(data => {
      if (data && data.address) {
        console.log(`Address for User ID ${userId}:`, data.address);
        return getCoordinatesFromAddress(data.address);
      } else {
        throw new Error("No address found for this User ID.");
      }
    })
    .then(coords => {
      destinationCoords = coords;
      updateDestination(coords);
    })
    .catch(error => {
      console.error("Error fetching or updating destination:", error);
      alert(error.message);
    });
}

function sendEmailAlert(currentCoords) {
  let emailSentCount = 0;
  if (emailSentCount >= 1) return; // Prevent sending more than two emails

  const mapUrl = `https://www.openstreetmap.org/?mlat=${currentCoords[0]}&mlon=${currentCoords[1]}#map=16/${currentCoords[0]}/${currentCoords[1]}`;

  const emailData = {
    sender: { name: "BHARAT POST", email: "drjarad11@gmail.com" },
    to: [{ email: "drjarad11@gmail.com", name: "Receiver" }],
    subject: "!!!Track your Post!!!",
    htmlContent: `
      <p>The tracker is now within 2KM of the destination.</p>
      <p>To view the live movement of the source, click the link below:</p>
      <a href="${mapUrl}" target="_blank">View Live Coordinates on Map</a>
    `,
  };

  fetch("https://api.sendinblue.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": "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", // Replace with your actual Sendinblue API key
    },
    body: JSON.stringify(emailData),
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Email sent successfully:", data);
      emailSentCount++; // Increment the counter after successful email sending
    })
    .catch((error) => console.error("Error sending email:", error));
}

// Function to update the destination marker on the map
function updateDestination(coords) {
  // Remove any previous destination marker, if exists
  if (window.destinationMarker) {
    map.removeLayer(window.destinationMarker);
  }

  // Create a marker at the new destination coordinates
  window.destinationMarker = L.marker(coords, { icon: destinationIcon }).addTo(map).bindPopup('Destination').openPopup();

  // Optionally, adjust map view to center on the destination
  map.setView([coords[0], coords[1]], 13); // Update map view to new destination

  // Update routing control with new source and destination
  setupRouting(sourceMarker.getLatLng(), coords);
}

// Setup map and markers
function setupRouting(startCoords, endCoords) {
  if (routeControl) {
    map.removeControl(routeControl); // Remove the previous route
  }
console.log("Wev are in the setuprounting fun");
  routeControl = L.Routing.control({
    waypoints: [
      L.latLng(startCoords[0], startCoords[1]),
      L.latLng(endCoords[0], endCoords[1]),
    ],
    lineOptions: {
      styles: [{ color: 'blue', opacity: 1, weight: 5 }], // Path color
    },
    createMarker: () => null, // Do not add default markers for waypoints
    routeWhileDragging: false,
    showAlternatives: false,
    router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
    show: false, // Disable the route instructions panel
  }).addTo(map);
}

// Update the source marker's position and recalculate the route
function updateSourcePosition(currentCoords) {
  if (!sourceMarker) {
    // Initialize source marker at the first GPS coordinates
    sourceMarker = L.marker(currentCoords, { icon: sourceIcon }).addTo(map).bindPopup('You');
    map.setView(currentCoords); // Center the map on user's location
  } else {
    sourceMarker.setLatLng(currentCoords); // Update marker position
  }

  // Recalculate the route to the destination
  setupRouting(currentCoords, destinationCoords);

  // Check if the source is near the destination
  const distanceToDestination = map.distance(currentCoords, destinationCoords);
  if (distanceToDestination <= 2000 && emailSentCount < 1) {
    sendEmailAlert(currentCoords); // Trigger email alert with coordinates
  }
}

// Fetch live GPS coordinates using the Geolocation API
if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(
    (position) => {
      const currentCoords = [position.coords.latitude, position.coords.longitude];
      console.log('Current Location:', currentCoords);
      updateSourcePosition(currentCoords); // Update the source position and recalculate route
    },
    (error) => {
      console.error('Error fetching location:', error);
      alert('Unable to retrieve your location. Please check your device settings.');
    },
    {
      enableHighAccuracy: true, // Use GPS for accurate location
      maximumAge: 0, // Do not use cached position
      timeout: 10000 // Timeout after 10 seconds if no position is available
    }
  );
} else {
  alert('Geolocation is not supported by your browser.');
}
