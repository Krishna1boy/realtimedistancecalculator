// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const distanceEl = document.getElementById('distance');
const speedEl = document.getElementById('speed');
const timeEl = document.getElementById('time');
const avgSpeedEl = document.getElementById('avgSpeed');
const maxSpeedEl = document.getElementById('maxSpeed');
const gpsStatusEl = document.getElementById('gpsStatus');

// Tracking variables
let isTracking = false;
let watchId = null;
let startTime = null;
let elapsedTime = 0;
let totalDistance = 0; // in meters
let lastPosition = null;
let lastTimestamp = null;
let currentSpeed = 0; // in km/h
let maxSpeed = 0;
let speedReadings = [];
let timerInterval = null;

// Simulation mode for testing on devices without GPS
let simulationMode = false;
let simulationInterval = null;

// Initialize
startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);
resetBtn.addEventListener('click', resetTracking);

// Check for simulation mode on page load
window.addEventListener('load', () => {
    checkDeviceCapability();
});

function checkDeviceCapability() {
    // Detect if device likely has real GPS (mobile device)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
        const useSimulation = confirm(
            '⚠️ LAPTOP DETECTED\n\n' +
            'This device appears to be a laptop without real GPS.\n\n' +
            'For REAL usage:\n' +
            '• Use a smartphone or tablet with GPS\n' +
            '• Go outdoors and move (walk/run/bike)\n\n' +
            'Would you like to enable DEMO MODE for testing?\n' +
            '(Simulates movement with random speed)'
        );

        if (useSimulation) {
            simulationMode = true;
            gpsStatusEl.textContent = 'Demo Mode Ready';
            gpsStatusEl.style.color = '#3b82f6';
        }
    }
}

function startTracking() {
    if (!navigator.geolocation && !simulationMode) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    isTracking = true;
    startTime = Date.now() - elapsedTime;

    // Update button states
    startBtn.disabled = true;
    stopBtn.disabled = false;

    if (simulationMode) {
        startSimulation();
    } else {
        gpsStatusEl.textContent = 'Acquiring GPS...';
        gpsStatusEl.style.color = '#f59e0b';

        // Start watching position with high accuracy
        watchId = navigator.geolocation.watchPosition(
            handlePositionUpdate,
            handlePositionError,
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    }

    // Start timer
    timerInterval = setInterval(updateTimer, 100); // Update every 100ms for smooth display
}

function stopTracking() {
    isTracking = false;

    // Update button states
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Stop watching position
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    // Stop simulation
    if (simulationInterval !== null) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }

    // Stop timer
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    gpsStatusEl.textContent = simulationMode ? 'Demo Stopped' : 'Stopped';
    gpsStatusEl.style.color = '#ef4444';
}

function resetTracking() {
    stopTracking();

    // Reset all variables
    elapsedTime = 0;
    totalDistance = 0;
    currentSpeed = 0;
    maxSpeed = 0;
    speedReadings = [];
    lastPosition = null;
    lastTimestamp = null;

    // Reset display
    distanceEl.textContent = '0.00';
    speedEl.textContent = '0.00';
    timeEl.textContent = '00:00';
    avgSpeedEl.textContent = '0.00 km/h';
    maxSpeedEl.textContent = '0.00 km/h';
    gpsStatusEl.textContent = 'Not started';
    gpsStatusEl.style.color = '#6b7280';

    startBtn.disabled = false;
    stopBtn.disabled = true;
}

function startSimulation() {
    gpsStatusEl.textContent = 'Demo Mode Active';
    gpsStatusEl.style.color = '#3b82f6';

    // Simulate GPS updates every 500ms
    simulationInterval = setInterval(() => {
        if (!isTracking) return;

        // Generate random speed between 0-30 km/h (walking/jogging speed)
        // Add some variance to make it realistic
        const baseSpeed = 5 + Math.random() * 10; // 5-15 km/h
        const variance = (Math.random() - 0.5) * 2; // -1 to +1
        currentSpeed = Math.max(0, baseSpeed + variance);

        // Calculate distance for this time interval
        // Distance = Speed × Time
        const timeInterval = 0.5; // 500ms = 0.5 seconds
        const distanceIncrement = (currentSpeed / 3.6) * timeInterval; // convert km/h to m/s, then multiply by time

        totalDistance += distanceIncrement;

        // Update speed statistics
        speedReadings.push(currentSpeed);
        if (currentSpeed > maxSpeed) {
            maxSpeed = currentSpeed;
        }

        // Update display
        updateDisplay();
    }, 500);
}

function handlePositionUpdate(position) {
    if (!isTracking) return;

    const currentTimestamp = position.timestamp;
    const currentPosition = {
        lat: position.coords.latitude,
        lon: position.coords.longitude
    };

    // Update GPS status with debugging info
    const accuracy = position.coords.accuracy ? position.coords.accuracy.toFixed(1) : 'N/A';
    gpsStatusEl.textContent = `GPS Active (±${accuracy}m)`;
    gpsStatusEl.style.color = '#10b981';

    // Debug logging
    console.log('GPS Update:', {
        lat: currentPosition.lat,
        lon: currentPosition.lon,
        speed: position.coords.speed,
        accuracy: position.coords.accuracy,
        timestamp: new Date(currentTimestamp).toLocaleTimeString()
    });

    // Get speed from GPS if available, otherwise calculate it
    if (position.coords.speed !== null && position.coords.speed >= 0) {
        // Speed from GPS in m/s, convert to km/h
        currentSpeed = position.coords.speed * 3.6;
        console.log('Using GPS speed:', currentSpeed.toFixed(2), 'km/h');
    } else if (lastPosition && lastTimestamp) {
        // Calculate speed using distance and time
        const distance = calculateDistance(
            lastPosition.lat,
            lastPosition.lon,
            currentPosition.lat,
            currentPosition.lon
        );

        const timeDiff = (currentTimestamp - lastTimestamp) / 1000; // in seconds

        if (timeDiff > 0) {
            // Calculate speed in km/h
            currentSpeed = (distance / timeDiff) * 3.6;
            console.log('Calculated speed:', currentSpeed.toFixed(2), 'km/h', 'from distance:', distance.toFixed(2), 'm');
        }
    }

    // Calculate distance if we have a previous position
    if (lastPosition && lastTimestamp) {
        const distance = calculateDistance(
            lastPosition.lat,
            lastPosition.lon,
            currentPosition.lat,
            currentPosition.lon
        );

        console.log('Distance from last position:', distance.toFixed(2), 'm');

        // Only add distance if it's reasonable (not GPS noise)
        // Filter out jumps greater than 100m in one reading
        if (distance < 100) {
            totalDistance += distance;
        } else {
            console.warn('Distance too large, ignoring (possible GPS jump):', distance.toFixed(2), 'm');
        }
    }

    // Update speed statistics
    speedReadings.push(currentSpeed);
    if (currentSpeed > maxSpeed) {
        maxSpeed = currentSpeed;
    }

    // Update display
    updateDisplay();

    // Save current position for next calculation
    lastPosition = currentPosition;
    lastTimestamp = currentTimestamp;
}

function handlePositionError(error) {
    let errorMessage = 'GPS Error';

    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            alert('Please allow location access to use this app');
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable';
            break;
        case error.TIMEOUT:
            errorMessage = 'GPS timeout';
            break;
    }

    gpsStatusEl.textContent = errorMessage;
    gpsStatusEl.style.color = '#ef4444';

    stopTracking();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula to calculate distance between two GPS coordinates
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

function updateTimer() {
    if (!isTracking) return;

    elapsedTime = Date.now() - startTime;

    const totalSeconds = Math.floor(elapsedTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    timeEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function updateDisplay() {
    // Update distance (show in meters if < 1000m, otherwise in km)
    if (totalDistance < 1000) {
        distanceEl.textContent = totalDistance.toFixed(2);
        distanceEl.nextElementSibling.textContent = 'meters';
    } else {
        distanceEl.textContent = (totalDistance / 1000).toFixed(2);
        distanceEl.nextElementSibling.textContent = 'km';
    }

    // Update current speed
    speedEl.textContent = currentSpeed.toFixed(2);

    // Update average speed
    const avgSpeed = speedReadings.length > 0
        ? speedReadings.reduce((a, b) => a + b, 0) / speedReadings.length
        : 0;
    avgSpeedEl.textContent = `${avgSpeed.toFixed(2)} km/h`;

    // Update max speed
    maxSpeedEl.textContent = `${maxSpeed.toFixed(2)} km/h`;
}

// Handle page visibility changes (pause when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && isTracking) {
        // Don't stop tracking, but the watchPosition will continue in background
        console.log('App in background, GPS tracking continues...');
    }
});
