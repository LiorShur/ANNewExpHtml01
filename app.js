// === GLOBAL VARIABLES ===
let map, marker, watchId;
let path = [];
let routeData = [];
let lastCoords = null;
let totalDistance = 0;
let startTime = null;
let timerInterval = null;
let isPaused = false;
let elapsedTime = 0;
let mediaRecorder;
let audioChunks = [];
let isTracking = false;
// let rotationEnabled = false;
// let currentHeading = 0;
// let lastHeading = null;
// let headingListenerAttached = false;
// let rotateDeg = 0;
// let headingUpdateTime = 0;
// let orientationListenerActive = false;
// let lastUpdate = 0;
// let lastRotationUpdate = 0;
// let currentRotation = 0;
// let lastOrientationUpdate = 0;
// let mapWrapper = document.getElementById('mapWrapper'); // wrapper div for #map

function setControlButtonsEnabled(enabled) {
  const idsToDisable = [
    "startBtn",
    "resetBtn",
    "prepareAndExportBtn",
    "exportAllRoutesBtn",
    "exportDataBtn",
    "exportPDFBtn",
    "exportGPXBtn",
    "toggleArchivePanelBtn",
    "clearArchiveBtnBtn",
    "closeHistoryBtn",
    "clearAllSessionsBtn",
    "clearAllAppDataBtn",
    "loadSessionBtn",
  ];

  idsToDisable.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !enabled;
      el.style.opacity = enabled ? "1" : "0.5";
      el.style.pointerEvents = enabled ? "auto" : "none";
    }
  });
}


function setTrackingButtonsEnabled(enabled) {
  const startBtn = document.getElementById("startBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (startBtn) startBtn.disabled = !enabled;
  if (pauseBtn) pauseBtn.disabled = !enabled;
  if (stopBtn) stopBtn.disabled = !enabled;
}

const noteIcon = L.divIcon({
  className: 'custom-icon note-icon',
  html: '📝',
  iconSize: [36, 36]
});

const photoIcon = L.divIcon({
  className: 'custom-icon photo-icon',
  html: '📸',
  iconSize: [36, 36]
});
const audioIcon = L.divIcon({
  className: 'custom-icon audio-icon',
  html: '<span title="Audio">🎙️</span>',
  iconSize: [24, 24]
});

const videoIcon = L.divIcon({
  className: 'custom-icon video-icon',
  html: '<span title="Video">🎬</span>',
  iconSize: [24, 24]
});

// const noteIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Note">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <path fill="orange" d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/>
//         <text x="6" y="17" font-size="12" fill="black">📝</text>
//       </svg>
//     </div>`
// });

// const photoIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Photo">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <path fill="#2196F3" d="M21 19V5H3v14h18zM3 3h18a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2z"/>
//         <circle cx="12" cy="12" r="3" fill="white"/>
//       </svg>
//     </div>`
// });

// const audioIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Audio">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <rect x="9" y="4" width="6" height="14" fill="purple"/>
//         <path d="M5 10v4h2v-4H5zm12 0v4h2v-4h-2z" fill="gray"/>
//       </svg>
//     </div>`
// });

// const videoIcon = L.divIcon({
//   className: 'custom-icon',
//   html: `
//     <div title="Video">
//       <svg width="24" height="24" viewBox="0 0 24 24">
//         <rect x="4" y="5" width="14" height="14" fill="#4CAF50"/>
//         <polygon points="10,9 15,12 10,15" fill="white"/>
//       </svg>
//     </div>`
// });

// === INIT LEAFLET MAP ===

function initMap(callback) {

  //   // If a map already exists on this container, remove it
  if (map && map.remove) {
    map.remove(); // Clean up the previous map instance
  }
//   // Now safely initialize a new map
  map = L.map('map').setView([0, 0], 15);


  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Add initial marker at [0, 0]
  marker = L.marker([0, 0]).addTo(map).bindPopup("Start").openPopup();

  // Try to get user location and delay view update to avoid premature map interaction
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // Use a short timeout to ensure map is ready before setting view
        setTimeout(() => {
          map.setView(userLocation, 17);
          marker.setLatLng(userLocation);
        }, 150); // slight delay to avoid _leaflet_pos error
      },
      error => {
        console.warn("Geolocation failed or denied, using default.");
      }
    );
  }

  if (callback) callback();
}

function togglePanel(id) {
  const panels = ['exportPanel', 'summaryPanel', 'devToolsPanel'];

  panels.forEach(panelId => {
    const el = document.getElementById(panelId);
    if (panelId !== id) {
      el?.classList.add('hidden');
    }
  });

  const selected = document.getElementById(id);
  if (selected) {
    selected.classList.toggle('hidden');
  }
}

// === BACKUP & AUTOSAVE ===
let autoSaveInterval = null;

function startAutoBackup() {
  autoSaveInterval = setInterval(() => {
    const backupData = { routeData, totalDistance, elapsedTime };
    localStorage.setItem("route_backup", JSON.stringify(backupData));
    console.log("🔄 Auto-saved route progress.");
  }, 20000);
}

function stopAutoBackup() {
  clearInterval(autoSaveInterval);
  localStorage.removeItem("route_backup");
  console.log("✅ Auto-backup stopped and cleared.");
}

// === TIMER ===
function startTimer() {
  elapsedTime = 0;
  startTime = Date.now();
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const now = Date.now();
  elapsedTime = now - startTime;
  const hrs = Math.floor(elapsedTime / (1000 * 60 * 60));
  const mins = Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((elapsedTime % (1000 * 60)) / 1000);
  const formatted = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  document.getElementById("timer").textContent = formatted;
  //document.getElementById("liveTimer").textContent = formatted;
}

function resumeTimer() {
  if (!timerInterval) {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }
}


// === DISTANCE ===
function haversineDistance(coord1, coord2) {
  const R = 6371;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(coord1.lat)) * Math.cos(toRad(coord2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// === ROUTE TRACKING ===

function disableStartButton() {
  const btn = document.getElementById("startBtn");
  if (btn) {
    btn.disabled = true;
  }
}

window.startTracking = function () {
  openAccessibilityForm();

  setTrackingButtonsEnabled(true);
  document.getElementById("startBtn").disabled = true;
  document.getElementById("resetBtn").disabled = true;
  document.getElementById("takePhotoBtn").disabled = false;

  isTracking = true;
  setControlButtonsEnabled(false);
  startAutoBackup();

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 50) return;

        const latLng = { lat: latitude, lng: longitude };

        if (lastCoords) {
          const dist = haversineDistance(lastCoords, latLng);
          if (dist > 1 || dist < 0.005) return;
          totalDistance += dist;
        }

        lastCoords = latLng;
        path.push(latLng);

        marker.setLatLng(latLng);
        map.panTo(latLng, { animate: true });

        if (path.length > 1) {
          const segment = [path[path.length - 2], path[path.length - 1]];
          L.polyline(segment, { color: 'green', weight: 4 }).addTo(map);
        }

        routeData.push({
          type: "location",
          timestamp: Date.now(),
          coords: latLng
        });

        document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    startTime = Date.now() - elapsedTime;
    clearInterval(timerInterval);
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);

    } else {
    alert("Geolocation not supported");
  }
};


// Extracted position handler
function positionHandler(position) {
  const { latitude, longitude, accuracy } = position.coords;
  if (accuracy > 50) return; // Less accurate fix

  const latLng = { lat: latitude, lng: longitude };

  marker.setLatLng(latLng);

  if (lastCoords) {
    const dist = haversineDistance(lastCoords, latLng);

    if (dist > 1) return;        // Skip large jumps
    if (dist < 0.005) return;    // Skip jitter (<5 meters)

    // Optional: filter stationary jitter
    if (dist < 0.003 && Date.now() - lastTimestamp < 5000) return;

    totalDistance += dist;
  }

  lastCoords = latLng;
  lastTimestamp = Date.now();

  path.push(latLng);
  marker.setLatLng(latLng);
  
  map.panTo(latLng, { animate: true });

  if (path.length > 1) {
    const segment = [path[path.length - 2], path[path.length - 1]];
    L.polyline(segment, { color: 'green', weight: 4 }).addTo(map);
  }

  routeData.push({
    type: "location",
    timestamp: Date.now(),
    coords: latLng
  });

  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
}


// window.stopTracking = function () {
//   // 5. Cleanup (if needed for pause/stop tracking)

//   if (watchId) navigator.geolocation.clearWatch(watchId);
//   stopTimer();
//   stopAutoBackup();
// const wantsToFill = confirm("Do you want to fill out the accessibility questionnaire?");
// if (wantsToFill) openAccessibilityForm();

//   const wantsToSave = confirm("💾 Do you want to save this route?");
//   if (wantsToSave) {
//     const wasSaved = saveSession(); // returns true if saved
//     if (wasSaved) {
//       //Summary();
//       resetApp();
//     } else {
//       resumeTracking();
//     }
//   } else {
//     resumeTracking();
//   }
// };

window.stopTracking = function () {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  stopTimer();
  stopAutoBackup();

  const wantsToFill = confirm("Do you want to fill out the accessibility questionnaire?");
  if (wantsToFill) {
    openAccessibilityForm(() => {
      proceedWithRouteSave();
    });
  } else {
    proceedWithRouteSave();
  }
}

function proceedWithRouteSave() {
  const wantsToSave = confirm("💾 Do you want to save this route?");
  if (wantsToSave) {
    const wasSaved = saveSession();
    if (wasSaved) resetApp();
    else resumeTracking();
  } else {
    resumeTracking();
  }
}


function resetApp() {
  // Clear state
  routeData = [];
  path = [];
  lastCoords = null;
  totalDistance = 0;
  elapsedTime = 0;
  startTime = null;
  isPaused = false;

  // Reset display
  document.getElementById("distance").textContent = "0.00 km";
  document.getElementById("timer").textContent = "00:00:00";

  // Stop autosave and clear backup
  stopAutoBackup();
  localStorage.removeItem("route_backup");

  // Clear map layers if needed
  if (map) {
    map.eachLayer(layer => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
  }

  // Re-add base tile layer and marker
  if (!map) {
    initMap();
  }

  const defaultView = [0, 0];
  map.setView(defaultView, 15);
  marker = L.marker(defaultView).addTo(map).bindPopup("Start").openPopup();

  // Try to recenter map on user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        map.setView(userLocation, 17);
        marker.setLatLng(userLocation);
      },
      error => {
        console.warn("Geolocation failed or denied, using default.");
      }
    );
  }
  setTrackingButtonsEnabled(true);
  document.getElementById("resetBtn").disabled = false;
  isTracking = false;
  setControlButtonsEnabled(true);   // ✅ re-enable controls

  console.log("🧹 App reset — ready for a new session!");
}

window.confirmAndResetApp = function () {
  // if (routeData.length > 0) {
  //   const confirmReset = confirm("⚠️ Are you sure you want to reset?");
  //   if (!confirmReset) return;
  // }
  const confirmReset = confirm("⚠️ Are you sure you want to reset?");
  if (confirmReset) resetApp();
};

window.resumeTracking = function () {
  if (!isPaused) return;

  isPaused = false;
  setTrackingButtonsEnabled(true);

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (accuracy > 50) return;

        const latLng = { lat: latitude, lng: longitude };

        if (lastCoords) {
          const dist = haversineDistance(lastCoords, latLng);
          if (dist > 1 || dist < 0.005) return;
          totalDistance += dist;
        }

        lastCoords = latLng;
        path.push(latLng);

        marker.setLatLng(latLng);
        map.panTo(latLng, { animate: true });

        if (path.length > 1) {
          const segment = [path[path.length - 2], path[path.length - 1]];
          L.polyline(segment, { color: 'green', weight: 4 }).addTo(map);
        }

        routeData.push({
          type: "location",
          timestamp: Date.now(),
          coords: latLng
        });

        document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
      },
      err => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    startTime = Date.now() - elapsedTime;
    clearInterval(timerInterval);
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);

  }
  startAutoBackup();
};


function Summary() {
  alert(`🏁 Route Stats:
Total Distance: ${totalDistance.toFixed(2)} km
Total Time: ${document.getElementById("timer").textContent}`);
}

// === TRACKING ===
window.togglePause = function () {
  isPaused = !isPaused;
  // 5. Cleanup (if needed for pause/stop tracking)
  function stopRotation() {
  window.removeEventListener("deviceorientation", handleOrientation, true);
  orientationListenerActive = false;
}
  //document.getElementById("pauseButtonLabel").textContent = isPaused ? "Resume" : "Pause";
  if (!isPaused) {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 1000);
  } else {
    clearInterval(timerInterval);
  }
};

function pad(n) {
  return n.toString().padStart(2, "0");
}

// === MEDIA CAPTURE ===
window.capturePhoto = () => document.getElementById("photoInput").click();
window.captureVideo = () => document.getElementById("videoInput").click();

window.addTextNote = function () {
  const note = prompt("Enter your note:");
  if (note) {
    navigator.geolocation.getCurrentPosition(position => {
      routeData.push({
        type: "text",
        timestamp: Date.now(),
        coords: { lat: position.coords.latitude, lng: position.coords.longitude },
        content: note
      });
      alert("Note saved.");
    });
  }
};

window.startAudioRecording = function () {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          navigator.geolocation.getCurrentPosition(pos => {
            routeData.push({
              type: "audio",
              timestamp: Date.now(),
              coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              content: reader.result
            });
            alert("Audio saved.");
          });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000);
    })
    .catch(() => alert("Microphone access denied"));
};

function compressImage(file, quality, callback) {
  const img = new Image();
  const reader = new FileReader();

  reader.onload = () => {
    img.src = reader.result;
  };
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const maxWidth = 600;  // Reduce max width
    const quality = 0.5;   // Lower quality from 0.7 to 0.5
    const scale = Math.min(1, maxWidth / img.width);
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL("image/jpeg", quality));
  };

  reader.readAsDataURL(file);
}

// === MEDIA INPUT EVENTS ===
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("photoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          routeData.push({
            type: "photo",
            timestamp: Date.now(),
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            content: reader.result
          });
          alert("Photo saved.");
        });
      };
      // reader.readAsDataURL(file);
      compressImage(file, 0.5, base64 => {
  navigator.geolocation.getCurrentPosition(pos => {
    routeData.push({
      type: "photo",
      timestamp: Date.now(),
      coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      content: base64
    });
    alert("📷 Compressed photo saved.");
  });
});

    }
  });

  document.getElementById("videoInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        navigator.geolocation.getCurrentPosition(pos => {
          routeData.push({
            type: "video",
            timestamp: Date.now(),
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            content: reader.result
          });
          alert("Video saved.");
        });
      };
      reader.readAsDataURL(file);
    }
  });
});

// function openAccessibilityForm() {
//   document.getElementById("accessibilityOverlay").style.display = "flex";
// }
function openAccessibilityForm(onComplete) {
  const form = document.getElementById("accessibilityOverlay");

  // Prefill logic if needed
  form.style.display = "flex";

  form._onComplete = onComplete; // store callback
}

function closeAccessibilityForm() {
  document.getElementById("accessibilityOverlay").style.display = "none";
}

// ===  ROUTE & NOTES ===
let noteMarkers = []; // Global array to track note markers

function showRouteDataOnMap() {
  if (noteMarkers.length > 0) {
    noteMarkers.forEach(marker => marker.remove());
    noteMarkers = [];
  }

  if (!routeData || routeData.length === 0) {
    alert("No notes, photos, or media found in this route.");
    return;
  }

  const bounds = L.latLngBounds([]);
  let noteCounter = 1, photoCounter = 1, audioCounter = 1, videoCounter = 1;

  routeData.forEach(entry => {
    const { coords, type, content } = entry;
    if (!coords) return;

    if (type === "location") {
      bounds.extend(coords);
      return;
    }

    let icon, tooltip, popupHTML;

    switch (type) {
      case "text":
        icon = noteIcon;
        tooltip = `Note ${noteCounter}`;
        popupHTML = `<b>${tooltip}</b><br><p>${content}</p>`;
        noteCounter++;
        break;
      case "photo":
        icon = photoIcon;
        tooltip = `Photo ${photoCounter}`;
        popupHTML = `<b>${tooltip}</b><br><img src="${content}" style="width:150px" onclick="showMediaFullScreen('${content}', 'photo')">`;
        photoCounter++;
        break;
      case "audio":
        icon = audioIcon;
        tooltip = `Audio ${audioCounter}`;
        popupHTML = `<b>${tooltip}</b><br><audio controls src="${content}"></audio>`;
        audioCounter++;
        break;
      case "video":
        icon = videoIcon;
        tooltip = `Video ${videoCounter}`;
        popupHTML = `<b>${tooltip}</b><br><video controls width="200" src="${content}" onclick="showMediaFullScreen('${content}', 'video')"></video>`;
        videoCounter++;
        break;
    }

    const marker = L.marker(coords, { icon }).addTo(map);
    marker.bindTooltip(tooltip);
    marker.bindPopup(popupHTML);

    noteMarkers.push(marker);
    bounds.extend(coords);
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds);
  } else {
    map.setZoom(17);
  }
}


// === FULLSCREEN MEDIA VIEWER ===
window.showMediaFullScreen = function (content, type) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0, 0, 0, 0.8)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "20px";
  closeBtn.style.right = "20px";
  closeBtn.style.padding = "10px 20px";
  closeBtn.style.backgroundColor = "#f44336";
  closeBtn.style.color = "#fff";
  closeBtn.onclick = () => document.body.removeChild(overlay);

  overlay.appendChild(closeBtn);

  const media = document.createElement(type === "photo" ? "img" : "video");
  media.src = content;
  media.style.maxWidth = "90%";
  media.style.maxHeight = "90%";
  if (type === "video") media.controls = true;

  overlay.appendChild(media);
  document.body.appendChild(overlay);
};

// === SAVE SESSION ===

window.addEventListener("beforeunload", function (e) {
  if (routeData.length > 0) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});

window.saveSession = function () {
  console.log("🔍 Attempting to save session...");

    if (!routeData || routeData.length === 0) {
    alert("⚠️ No route data to save.");
    return false;
  }

  const name = prompt("Enter a name for this route:");
  if (!name) return false;

  const session = {
    name,
    date: new Date().toISOString(),
    time: document.getElementById("timer").textContent,
    distance: totalDistance.toFixed(2),
    data: routeData
  };

  try {
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.push(session);
    localStorage.setItem("sessions", JSON.stringify(sessions));
    localStorage.removeItem("route_backup");

    alert(`✅ Route saved successfully!

🏁 Route Summary:
📏 Distance: ${totalDistance.toFixed(2)} km
⏱️ Time: ${document.getElementById("timer").textContent}`);
    document.getElementById("resetBtn").disabled = false;
    loadSavedSessions();
    return true;
  } catch (e) {
    // console.error("❌ Save failed:", e);
    // alert("❌ Could not save the route.");
    // return false;
    console.warn("❌ Save failed due to storage limits. Falling back to auto-export...");
    exportData();
    exportGPX();
    exportPDF();
    exportRouteSummary(); // ✅ Use your rich summary generator
    alert("🛡 Storage full. Auto-exported full route summary as backup.");
    return false;
  }
  document.getElementById("resetBtn").disabled = false;
  initMap();
};


// === LOAD SESSION LIST ===
window.loadSavedSessions = function () {
  const list = document.getElementById("savedSessionsList");
  list.innerHTML = "";
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

  sessions.forEach((session, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${session.name}</strong>
      <button id=loadSessionBtn" onclick="loadSession(${index})">View</button>
    `;
    list.appendChild(li);
  });
};

// === LOAD A SESSION ===

window.loadSession = function (index) {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  const session = sessions[index];

  if (!session || !session.data || session.data.length === 0) {
    alert("❌ This session has no data to export.");
    return;
  }

  routeData = session.data;
  totalDistance = parseFloat(session.distance);
  elapsedTime = 0;
  lastCoords = null;

  path = routeData.filter(e => e.type === "location").map(e => e.coords);

  document.getElementById("timer").textContent = session.time;
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
  //document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

  const accessibilityEntry = session.data.find(e => e.type === "accessibility");
  if (accessibilityEntry) {
  prefillAccessibilityForm(accessibilityEntry.content);
  }

  initMap(() => {
    drawSavedRoutePath();
    showRouteDataOnMap();
    setTrackingButtonsEnabled(false);
  });
}

function drawSavedRoutePath() {
  if (!map || path.length === 0) return;

  const polyline = L.polyline(path, {
    color: 'green',
    weight: 3
  }).addTo(map);

  const bounds = polyline.getBounds();
  map.fitBounds(bounds);

  if (!marker) {
    marker = L.marker(path[0]).addTo(map).bindPopup("Start").openPopup();
  } else {
    marker.setLatLng(path[0]);
  }
}

function loadMostRecentSession(callback) {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  if (sessions.length === 0) {
    alert("❌ No saved sessions found to export.");
    return;
  }

  const mostRecent = sessions[sessions.length - 1];
  routeData = mostRecent.data;
  totalDistance = parseFloat(mostRecent.distance);
  elapsedTime = 0;

  path = routeData.filter(e => e.type === "location").map(e => e.coords);

  // Update UI
  document.getElementById("timer").textContent = mostRecent.time;
  document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";

  if (typeof initMap === "function") {
    initMap(() => {
      drawSavedRoutePath();
      showRouteDataOnMap();
      setTrackingButtonsEnabled(false);

      //disableStartButton();
      if (typeof callback === "function") callback();
    });
  } else if (typeof callback === "function") {
    callback(); // proceed even if map doesn't load
  }
}

function toggleExportDropdown() {
  const dropdown = document.getElementById("exportDropdown");
  if (!dropdown) return;

  dropdown.style.display = dropdown.style.display === "none" || dropdown.style.display === ""
    ? "block"
    : "none";
}

// === EXPORT JSON ===
window.exportData = function () {
  const fileName = `route-${new Date().toISOString()}.json`;
  const blob = new Blob([JSON.stringify(routeData, null, 2)], { type: "application/json" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// === EXPORT GPX ===
window.exportGPX = function () {
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NatureTracker" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Route</name><trkseg>\n`;

  routeData
    .filter(e => e.type === "location")
    .forEach(e => {
      gpx += `<trkpt lat="${e.coords.lat}" lon="${e.coords.lng}">
  <time>${new Date(e.timestamp).toISOString()}</time>
</trkpt>\n`;
    });

  gpx += `</trkseg></trk></gpx>`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `route-${Date.now()}.gpx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// === EXPORT PDF ===
window.exportPDF = async function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 10;

  doc.setFontSize(16);
  doc.text("Nature Tracker - Route Summary", 10, y);
  y += 10;

  for (const entry of routeData) {
    if (y > 260) {
      doc.addPage();
      y = 10;
    }

    doc.setFontSize(12);
    doc.text(`Type: ${entry.type}`, 10, y); y += 6;
    doc.text(`Time: ${new Date(entry.timestamp).toLocaleString()}`, 10, y); y += 6;
    doc.text(`Lat: ${entry.coords.lat.toFixed(5)}, Lng: ${entry.coords.lng.toFixed(5)}`, 10, y); y += 6;

    if (entry.type === "text") {
      doc.text(`Note: ${entry.content}`, 10, y); y += 10;
    }
    else if (entry.type === "photo") {
      try {
        doc.addImage(entry.content, "JPEG", 10, y, 50, 40);
        y += 50;
      } catch {
        doc.text("Photo not embedded", 10, y); y += 10;
      }
    }
    else if (entry.type === "audio") {
      doc.text("Audio note recorded (not embeddable)", 10, y); y += 10;
    }
    else if (entry.type === "video") {
      doc.text("Video recorded (not embeddable)", 10, y); y += 10;
    }
  }

  doc.save(`route-${Date.now()}.pdf`);
};

// === SHAREABLE LINK ===
window.generateShareableLink = function () {
  const json = JSON.stringify(routeData);
  const base64 = btoa(json);
  const url = `${location.origin}${location.pathname}?data=${encodeURIComponent(base64)}`;

  navigator.clipboard.writeText(url)
    .then(() => alert("Shareable link copied to clipboard!"));
};

// === ON LOAD SHARED LINK HANDLER ===

window.onload = function () {

  toggleDarkMode()

  window.addEventListener("beforeunload", function (e) {
  if (isTracking) {
    e.preventDefault();
    e.returnValue = '';
  }
});

  const btn = document.getElementById("takePhotoBtn");
  if (btn) btn.disabled = true;

  const params = new URLSearchParams(window.location.search);
  const base64Data = params.get("data");

  if (base64Data) {
    try {
      const json = atob(base64Data);
      const sharedData = JSON.parse(json);
      routeData = sharedData;
      console.log("✅ Shared route loaded.");

      path = routeData.filter(e => e.type === "location").map(e => e.coords);

      initMap(() => {
        drawSavedRoutePath();
        showRouteDataOnMap();
        setTrackingButtonsEnabled(false);

      });
    } catch (e) {
      console.error("❌ Invalid shared data:", e);
      alert("⚠️ Failed to load shared route.");
    }
  } else {
    const backup = localStorage.getItem("route_backup");
    if (backup) {
      const restore = confirm("🛠️ Unsaved route found! Would you like to restore it?");
      if (restore) {
        try {
          const backupData = JSON.parse(backup);
          if (!backupData.routeData || backupData.routeData.length === 0) {
            throw new Error("Backup routeData is empty or invalid.");
          }

          routeData = backupData.routeData;
          totalDistance = backupData.totalDistance || 0;
          elapsedTime = backupData.elapsedTime || 0;

          path = routeData.filter(e => e.type === "location").map(e => e.coords);

          initMap(() => {
            drawSavedRoutePath();
            showRouteDataOnMap();
            //setTrackingButtonsEnabled(false);

            //disableStartButton();
          });

          document.getElementById("distance").textContent = totalDistance.toFixed(2) + " km";
          //document.getElementById("liveDistance").textContent = totalDistance.toFixed(2) + " km";

          startTime = Date.now() - elapsedTime;
          updateTimerDisplay();
          setTrackingButtonsEnabled(true);
          startAutoBackup();
          //startTimer();
          //updateTimerDisplay(); // ✅ only display the recovered time
          // Do not auto-start the timer or backup
          
          

          //disableStartButton();

          alert("✅ Route recovered successfully!");
        } catch (e) {
          console.error("❌ Failed to restore backup:", e);
          alert("⚠️ Could not restore saved backup. Data might be corrupted.");
          resetApp();
          localStorage.removeItem("route_backup");
        }
      } else {
        localStorage.removeItem("route_backup");
        resetApp();
      }
    } else {
      console.log("ℹ️ No backup found. Loading session list.");
      loadSavedSessions();
      if (!map) initMap(); // Fallback map init if no session or route loaded
    }
  }

  // Ensure map initializes if nothing was triggered above
  if (!map) initMap();
};

// === SUMMARY ARCHIVE MODULE ===

function toggleArchivePanel() {
  const panel = document.getElementById("archivePanel");
  //const arrow = document.getElementById("archiveArrow");

  panel.classList.toggle("open");
  if (panel.classList.contains("open")) {
    //arrow.textContent = "▲";
    SummaryArchive.showArchiveBrowser("archivePanel");
  } else {
    //arrow.textContent = "▼";
  }
}

const SummaryArchive = (() => {
  const STORAGE_KEY = "summary_archive";

  function getArchive() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  }

  function saveToArchive(name, htmlContent, media = {}) {
    const archive = getArchive();
    archive.push({
      id: Date.now(),
      name,
      date: new Date().toISOString(),
      html: htmlContent,
      media
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
    alert("✅ Route summary saved to archive!");
  }

  function listSummaries() {
    return getArchive();
  }

  function deleteSummary(id) {
  const confirmed = confirm("🗑️ Are you sure you want to delete this route summary?");
  if (!confirmed) return;

  const archive = getArchive();
  const updatedArchive = archive.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedArchive));

  // Smooth fade-out effect
  const container = document.getElementById("archivePanel");
  if (container) {
    const listItems = container.querySelectorAll("li");
    listItems.forEach(li => {
      if (li.innerHTML.includes(`SummaryArchive.deleteSummary(${id})`)) {
        li.classList.add("fade-out", "remove");
        setTimeout(() => {
          li.remove();
          if (container.querySelectorAll("li").length === 0) {
            showArchiveBrowser(); // rebuild the empty UI
          }
        }, 500);
      }
    });
  }
}


  function viewSummary(id) {
    const item = getArchive().find(entry => entry.id === id);
    if (!item) return alert("Summary not found!");

    const blob = new Blob([item.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  function clearAll() {
    const confirmClear = confirm("⚠️ This will delete all saved summaries permanently. Continue?");
    if (confirmClear) {
      localStorage.removeItem(STORAGE_KEY);
      showArchiveBrowser();
      alert("🧹 Archive cleared!");
      toggleArchivePanel();
    }
  }

  function showArchiveBrowser(containerId = "archivePanel") {
    const container = document.getElementById(containerId);
    if (!container) return;

    const archive = getArchive();
    container.innerHTML = "<h3>📜 Saved Route Summaries</h3>";

    if (archive.length === 0) {
      container.innerHTML += "<p>No summaries found.</p>";
      return;
    }

    const ul = document.createElement("ul");
    archive.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `
        <b>${item.name}</b> (${item.date.split("T")[0]})
        <button class="toggle panel button" onclick="SummaryArchive.viewSummary(${item.id})">View</button>
        <button class="toggle panel button" onclick="SummaryArchive.deleteSummary(${item.id})">Delete</button>
      `;
      ul.appendChild(li);
    });

    container.appendChild(ul);
  }

  return {
    saveToArchive,
    listSummaries,
    viewSummary,
    deleteSummary,
    showArchiveBrowser,
    clearAll
  };
})();

function haversineDistance(a, b) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const a_ = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1-a_));
}

async function getElevation(lat, lng) {
  const url = `https://api.opentopodata.org/v1/test-dataset?locations=${lat},${lng}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results?.[0]?.elevation ?? null;
}

async function generateElevationChartCanvas(route) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");

  await new Promise(resolve => {
    new Chart(ctx, {
      type: "line",
      data: {
        labels: route.map((_, i) => i),
        datasets: [{
          label: "Elevation (m)",
          data: route.map(e => e.elevation),
          borderColor: "green",
          fill: true,
          tension: 0.2
        }]
      },
      options: {
        animation: false,
        responsive: false
      },
      plugins: [{
        id: "onComplete",
        afterRender: chart => resolve()
      }]
    });
  });
  return canvas;
}

async function exportRouteSummary() {
  const mostRecent = JSON.parse(localStorage.getItem("sessions") || "[]").slice(-1)[0];
  const defaultName = mostRecent?.name || "My Route";
  const name = prompt("📁 הזן שם לקובץ הסיכום:", defaultName);
  if (!name) return;

  if (!routeData || !Array.isArray(routeData) || routeData.length === 0) {
    alert("⚠️ No route data available to export. Please track or load a route first.");
    return;
  }

  console.log("✅ Route data exists, length:", routeData.length);

  const hasLocation = routeData.some(entry => entry.type === "location");
  if (!hasLocation) {
    alert("⚠️ No location data found in this session.");
    return;
  }

  console.log("✅ Has location data");

  const zip = new JSZip();
  const notesFolder = zip.folder("notes");
  const imagesFolder = zip.folder("images");
  const audioFolder = zip.folder("audio");
  const mediaForArchive = {};

  let markersJS = "";
  let pathCoords = [];
  let enriched = [];

  let noteCounter = 1;
  let photoCounter = 1;
  let audioCounter = 1;

  console.log("🔄 Processing route data...");

  // Process route data
  for (const entry of routeData) {
    if (entry.type === "location") {
      pathCoords.push([entry.coords.lat, entry.coords.lng]);
      enriched.push({ ...entry });
    } else if (entry.type === "text") {
      notesFolder.file(`note${noteCounter}.txt`, entry.content);
      const safeNoteContent = encodeURIComponent(entry.content);

markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
  icon: L.divIcon({ className: 'custom-icon', html: '📝', iconSize: [24, 24] })
})
  .addTo(map)
  .bindTooltip("Note ${noteCounter}")
  .bindPopup("<b>Note ${noteCounter}</b><br><pre>" + decodeURIComponent("${safeNoteContent}") + "</pre>");
`;
noteCounter++;
    } else if (entry.type === "photo") {
      const base64Data = entry.content.split(",")[1];
      imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
      const safeImagePath = `images/photo${photoCounter}.jpg`;

markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
  icon: L.divIcon({ className: 'custom-icon', html: '📸', iconSize: [24, 24] })
})
  .addTo(map)
  .bindTooltip("Photo ${photoCounter}")
  .bindPopup("<b>Photo ${photoCounter}</b><br><img src='${safeImagePath}' style='width:200px'>");
`;
photoCounter++;
    } else if (entry.type === "audio") {
      const base64Data = entry.content.split(",")[1];
      audioFolder.file(`audio${audioCounter}.webm`, base64Data, { base64: true });
      markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
`;
      audioCounter++;
    }
  }

  console.log("✅ Processed route data. PathCoords:", pathCoords.length, "Enriched:", enriched.length);

  // Enrich with elevation
for (const entry of enriched) {
  if (entry.type === "location" && entry.elevation == null) {
    try {
      entry.elevation = await getElevation(entry.coords.lat, entry.coords.lng);
    } catch (e) {
      console.warn("Failed to get elevation for", entry.coords, e);
      entry.elevation = 0; // fallback
    }
  }
}


  // Accessibility computation
  let accessibleLength = 0;
  for (let i = 1; i < enriched.length; i++) {
    const a = enriched[i - 1], b = enriched[i];
    if (a.elevation != null && b.elevation != null) {
      const dist = haversineDistance(a.coords, b.coords);
      const elev = b.elevation - a.elevation;
      const grade = (elev / (dist * 1000)) * 100;
      if (Math.abs(grade) <= 6) accessibleLength += dist * 1000;
    }
  }

  // Load form data
  const formDataRaw = localStorage.getItem("accessibilityData");
  const data = formDataRaw ? JSON.parse(formDataRaw) : {};

  // Helpers
  const mapField = (key, fallback = '---') =>
    Array.isArray(data[key]) ? data[key].join(", ") : (data[key] || fallback);

  const getBoolLabel = (condition) => condition ? "✅ כן" : "❌ לא";

  // Calculate map bounds - FIXED: Check if pathCoords has data
  const boundsData = pathCoords.length >= 2 ? 
    [pathCoords[0], pathCoords[pathCoords.length - 1]] : 
    (pathCoords.length === 1 ? [pathCoords[0], pathCoords[0]] : [[32.0853, 34.7818], [32.0853, 34.7818]]); // Default to Tel Aviv if no coords


    console.log("🔍 Sample enriched data:", enriched.slice(0, 3));
  // Escape JSON data for HTML embedding - CRITICAL FIX
  const routeDataEscaped = JSON.stringify(enriched)
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r');
  const pathCoordsEscaped = JSON.stringify(pathCoords).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const boundsEscaped = JSON.stringify(boundsData).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  console.log("Bounds data:", boundsData);
  console.log("Route data length:", enriched.length);
  console.log("Path coords length:", pathCoords.length);

  // Build HTML content with FIXED JavaScript embedding
  let htmlContent = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />

  <style>
    body {
      font-family: sans-serif;
      direction: rtl;
      background: #f0f0f0;
      margin: 0;
      padding: 20px;
    }
    .hero {
      position: relative;
      height: 320px;
      background: url('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAHCAlgDASIAAhEBAxEB/8QAGgAAAwEBAQEAAAAAAAAAAAAAAAIDBAEFBv/EAEAQAAIBAwMCBAQFBAIABgEDBQECEQADIQQSMUFREyJhcYGRofAFMrHB0RQjQuFS8SQzNGJyghUGNUNjkqLS4v/EABkBAQEBAQEBAAAAAAAAAAAAAAABAgMEBf/EACYRAQEBAAICAgIBBQEBAAAAAAARAQIhEjEDQRNRBBQiMmFxUvD/2gAMAwEAAhEDEQA/AFiiKaKIr774xYoiniiKBYrkU8URUCxRFNFciqFiiKaKIoQkURTxRFAkURTxXIoFiiKaKIoQsURTRRFAkURTRRFEhYoimiiKBIoiniiKBIoimiiKoWK5FPFEUCRRFPFEUCRRFNFEUQkURTxXIoFiiKaKIoFArsU0URQLFciniiKCcURTxRFCE21yKeKIqpCRRFPFEUCRRFPFEVCEiiKeKIosJFEU8VyKBYoiniiKEJFciniuxRISKIpooiiliiKaKIoFiuRTxRFCFiiKaKIoQsURNNFEUCxXYpooigWKIp4rkUIWK7FNFEVFLFEU0URQLFFNFFBeK7Fdiio05FEV2KIoORRFdooFiiKauUHIoiuxRFByKIrsURQciiK7RFAsURTURQLFEV2iKo5FcimiigWKIpq5RHIoiuxRQLFEU1coORRFdooORRFdooORXIpqKBYoimrlELFEU0URQciiK7RQciuRTURRSxRFNFcigWKIpooiqhYoimoiiFiiKaKIopYoimoigWKIpq5FAsURTRRFAsV2K7RFByKIrtEUCxRFNFEUCxXYrsUUHIoiu0UCxXYrtEUHIorsURUHIrsV2iiuRRFdiigWKIpqKDkUV2KKDRFEU0URWK0WKIrsURShYoimiiKULRFNFEVaFiiKaKIpQsUU0VyKUciuRTRRFKFiiKaKIpQtEV2KIoFoimiiKoWKIporkURyK5FNFEUC0RTRXIojkUV2KIorlcpqIoFoimooFiiKaK5FEcrlNFEVQtFNFEUCxRTRXIoOUV2KIoFopooiiFiimiiKBYrtdoopYoimoopYoiu0RRHK5FNFFEciiK7FFByiK7FEUUsV2K7FFByiK7RQciuRTUUCxRFNFFAsV2K7RQcortFByKIrtEVByiK7RQFFdiig0URTRRFYbLFEU0URQLFFdiiKDlEV2KIoFiiKaKIoFiiKaKIoFiimiiKBYoimiuRQciuRTRRFAsURTRRFULFciniuRQLFEU0URSoSKIp4rkUoWKIpooirSFiuRTxRFKQkURTxXIpSFiiKaKIpSFiiKaKIpQkURTxXIpUhYoimiiKULFEU0URVCxRFNFEUqQkURTRRFAsURTRRFFhYoimiiKBIoiniuRQLFFNFEUQsURTRRFAtdiuxRFFciuRTRRFAtFNFEUQsURTRRFAtFNFEUCxRFNFEUUsURTRRFAsV2K7FFByiuxRFByKK7FFBpiu12KIrm25FcimiiKBYoimiiKBYoimiiKBYoimiiKBYoimiiKBYoimiiKBYrkU8VyKBYoim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') center center/cover no-repeat;
      color: white;
      display: flex;
      align-items: flex-end;
      padding: 20px;
    }
    .hero-overlay {
      background: rgba(0, 0, 0, 0.4);
      padding: 20px;
      border-radius: 8px;
    }
    .hero-overlay h1 {
      margin: 0;
      font-size: 32px;
    }
    .metadata {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-top: 8px;
      font-size: 14px;
    }
    .container {
      background: white;
      padding: 20px;
      max-width: 900px;
      margin: auto;
      box-shadow: 0 0 10px #ccc;
    }
    h1, h2, h3 {
      color: #2c5530;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin-bottom: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
    .media-counts {
      background: #e8f5e9;
      padding: 10px;
      border-radius: 5px;
      margin-bottom: 15px;
    }
    
    .legend span {
      margin-left: 10px;
    }
    .tab-bar button {
      margin: 5px;
      padding: 8px 16px;
      border: 1px solid #ccc;
      background: #f5f5f5;
      cursor: pointer;
    }
    .tab-bar button.active {
      background: #2c5530;
      color: white;
    }
    .tab-bar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    
    .tab-content { 
      display: none; 
    } 
    .tab-content.active { 
      display: block; 
      margin-top: 20px; 
    }

    #map { 
      height: 400px; 
      width: 100%; 
      margin-bottom: 20px;
      border: 1px solid #ccc;
    } 
    #chart { 
      height: 300px;
  width: 100%;
  max-height: 300px;
  background: white;
  border: 1px solid #ccc;
    } 
      #chart-tab canvas {
  height: 300px !important;
  width: 100% !important;
}
    .map-section { 
      display: block; 
      margin-bottom: 30px; 
    }
    .custom-icon {
      text-align: center;
      line-height: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏞️ ${mapField("trailName")} – סיכום מסלול</h1>
    <div class="media-counts">
      <b>📸 תמונות:</b> ${photoCounter - 1} |
      <b>📝 הערות:</b> ${noteCounter - 1} |
      <b>🎧 אודיו:</b> ${audioCounter - 1} |
      <b>♿ אורך נגיש:</b> ${Math.round(accessibleLength)} מ'
    </div>

    <h2>🔎 מידע כללי</h2>
    <ul>
      <li><b>שם השביל:</b> ${mapField("trailName")}</li>
      <li><b>מיקום:</b> ${mapField("location")}</li>
      <li><b>אורך (ק"מ):</b> ${mapField("trailLength")}</li>
      <li><b>משך משוער:</b> ${mapField("estimatedTime")}</li>
      <li><b>סוג מסלול:</b> ${mapField("trailType")}</li>
    </ul>

    <div class="tab-bar">
      <button onclick="openTab('map')" class="active">🗺️ מפה</button>
      <button onclick="openTab('chart')">📈 גרף גובה</button>
      <button onclick="openTab('accessibility')">♿ נגישות</button>
      <button onclick="openTab('terrain')">🛤️ טופוגרפיה</button>
      <button onclick="openTab('facilities')">🏕️ מתקנים</button>
      <button onclick="openTab('notes')">📝 הערות</button>
    </div>

    <div id="map" class="tab-content active">
    <p>תוכן מפה כאן</p>
  </div>
  <div id="chart" class="tab-content">
    <canvas id="chart-canvas"></canvas>
    <div class="legend">
          <b>מקרא שיפועים:</b><br />
          <span style="color:green">🟩 ≤ 6% (קל)</span>
          <span style="color:orange">🟧 6–10% (בינוני)</span>
          <span style="color:red">🟥 > 10% (תלול)</span>
        </div>
  </div>
        

    <div class="tab-content" id="accessibility">
      <h3>♿ פרטי נגישות</h3>
      <ul>
        <li><b>נגישות לכיסא גלגלים:</b> ${mapField("wheelchairAccess")}</li>
        <li><b>אביזרי ניידות תואמים:</b> ${mapField("mobilityAids")}</li>
        <li><b>מאפייני שטח:</b> ${mapField("terrainFeatures")}</li>
        <li><b>מאפיינים חזותיים:</b> ${mapField("visualFeatures")}</li>
        <li><b>תאורה:</b> ${mapField("lighting")}</li>
        <li><b>מכשולים חזותיים:</b> ${mapField("hazards")}</li>
        <li><b>נגיש לכלבי נחיה:</b> ${mapField("guideDogFriendly")}</li>
        <li><b>מאפיינים שמיעתיים:</b> ${mapField("hearingFeatures")}</li>
        <li><b>תקשורת חירום:</b> ${mapField("emergencyComm")}</li>
        <li><b>מורכבות ניווט:</b> ${mapField("navigationComplexity")}</li>
        <li><b>תמיכה קוגניטיבית:</b> ${mapField("cognitiveFeatures")}</li>
        <li><b>רמת רעש:</b> ${mapField("noiseLevel")}</li>
        <li><b>צפיפות:</b> ${mapField("crowdLevel")}</li>
      </ul>
    </div>

    <div class="tab-content" id="terrain">
      <h3>🛤️ סוג משטח וגובה</h3>
      <ul>
        <li><b>סוג משטח:</b> ${mapField("surfaceType")}</li>
        <li><b>רוחב השביל:</b> ${mapField("pathWidth")} מטרים</li>
        <li><b>מצב המשטח:</b> ${mapField("surfaceCondition")}</li>
        <li><b>שיפוע מרבי:</b> ${mapField("maxGrade")}%</li>
        <li><b>שיפוע ממוצע:</b> ${mapField("avgGrade")}%</li>
        <li><b>עלייה בגובה:</b> ${mapField("elevationGain")} מטרים</li>
        <li><b>מקטעים תלולים:</b> ${mapField("steepSections")}</li>
      </ul>
    </div>

    <div class="tab-content" id="facilities">
      <h3>🏕️ מתקנים ושירותים</h3>
      <ul>
        <li><b>חניה נגישה:</b> ${getBoolLabel(data.facilities?.includes("accessible-parking"))}</li>
        <li><b>מקומות חניה נגישה:</b> ${mapField("accessibleParkingSpaces")}</li>
        <li><b>שירותים נגישים:</b> ${getBoolLabel(data.facilities?.includes("accessible-restrooms"))}</li>
        <li><b>ברזיות:</b> ${getBoolLabel(data.facilities?.includes("water-fountains"))}</li>
        <li><b>אזורי פיקניק:</b> ${getBoolLabel(data.facilities?.includes("picnic-areas"))}</li>
        <li><b>מחסות:</b> ${getBoolLabel(data.facilities?.includes("shelters"))}</li>
        <li><b>מרכז מידע:</b> ${getBoolLabel(data.facilities?.includes("info-center"))}</li>
        <li><b>תשלום בכניסה:</b> ${mapField("entryFee")}</li>
        <li><b>תחבורה ציבורית:</b> ${mapField("publicTransport")}</li>
      </ul>
    </div>

    <div class="tab-content" id="notes">
      <h3>📝 הערות נוספות</h3>
      <ul>
        <li><b>זמנים מומלצים:</b> ${mapField("bestTimes")}</li>
        <li><b>הערות כלליות:</b><br>${mapField("additionalNotes")}</li>
        <li><b>שם הסוקר:</b> ${mapField("surveyorName")}</li>
        <li><b>תאריך הסקר:</b> ${mapField("surveyDate")}</li>
      </ul>
    </div>
  </div>

  <script>

  let route = [];
let pathCoords = [];
let bounds = [];

    // Tab function
    let chartRendered = false;

function openTab(id) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');

  // 🟢 Invalidate map only if tab is map
  if (id === 'map' && window.mapInstance) {
    setTimeout(() => {
      window.mapInstance.invalidateSize();
    }, 200);
  }

  // 🟢 Render chart if entering chart tab for first time
  if (id === 'chart' && !chartRendered) {
  renderElevationChart();
  chartRendered = true;
}
}



    // MAIN INITIALIZATION - FIXED
    window.addEventListener("DOMContentLoaded", () => {
      console.log("Chart.js version:", Chart?.version);
      console.log('DOMContentLoaded event fired');
      route = window.route;
      pathCoords = window.pathCoords;
      bounds = window.bounds;


      // Parse the route data - CRITICAL FIX: Properly parse escaped JSON
      const routeDataStr = "${routeDataEscaped}";
      const pathCoordsStr = "${pathCoordsEscaped}";
      const boundsStr = "${boundsEscaped}";
      

      
     try {
  route = JSON.parse(routeDataStr);
  pathCoords = JSON.parse(pathCoordsStr);
  bounds = JSON.parse(boundsStr);
} catch (e) {
  console.error('JSON parsing error:', e);
  route = [];
  pathCoords = [];
  bounds = [[32.0853, 34.7818], [32.0853, 34.7818]];
}



      console.log("Parsed route data:", route);
      console.log("Parsed path coords:", pathCoords);
      console.log("Parsed bounds:", bounds);

      // Check if we have valid data
      if (!route || route.length === 0) {
        console.warn('No route data available');
        document.getElementById('map').innerHTML = '<p>אין נתוני מסלול זמינים</p>';
        return;
      }

      // Initialize map
      try {
        const mapElement = document.getElementById('map');
        if (!mapElement) {
          console.error('Map element not found!');
          return;
        }

        const map = L.map('map');
        window.mapInstance = map; // Store globally for tab switching

        // Set view based on bounds or default
        if (pathCoords.length > 0) {
          const latLngs = pathCoords.map(coord => [coord[0], coord[1]]);
          map.fitBounds(latLngs);
        } else {
          map.setView([32.0853, 34.7818], 10); // Default to Tel Aviv
        }

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Add route polyline if we have path coordinates
        if (pathCoords.length > 1) {
          L.polyline(pathCoords, { color: 'blue', weight: 3 }).addTo(map);
        }

        // Haversine distance function
        const haversine = (a, b) => {
          const toRad = x => x * Math.PI / 180;
          const R = 6371;
          const dLat = toRad(b.lat - a.lat);
          const dLng = toRad(b.lng - a.lng);
          const lat1 = toRad(a.lat);
          const lat2 = toRad(b.lat);
          const a_ = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
          return R * 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1-a_));
        };

        // Add colored route segments based on grade
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1];
          const b = route[i];
          
          if (a.coords && b.coords && a.elevation != null && b.elevation != null) {
            const dist = haversine(a.coords, b.coords);
            const elev = b.elevation - a.elevation;
            const grade = (elev / (dist * 1000)) * 100;
            const color = Math.abs(grade) > 10 ? 'red' : Math.abs(grade) > 6 ? 'orange' : 'green';
            
            L.polyline([[a.coords.lat, a.coords.lng], [b.coords.lat, b.coords.lng]], { 
              color: color, 
              weight: 4,
              opacity: 0.7
            }).addTo(map);
          }
        }

        // Add markers for start/end
        if (route.length > 0) {
          const startPoint = route[0];
          L.marker([startPoint.coords.lat, startPoint.coords.lng], {
            icon: L.divIcon({ 
              className: 'custom-icon', 
              html: '🏁', 
              iconSize: [30, 30] 
            })
          })
          .addTo(map)
          .bindPopup("<b>התחלת המסלול</b>");

          if (route.length > 1) {
            const endPoint = route[route.length - 1];
            L.marker([endPoint.coords.lat, endPoint.coords.lng], {
              icon: L.divIcon({ 
                className: 'custom-icon', 
                html: '🏁', 
                iconSize: [30, 30] 
              })
            })
            .addTo(map)
            .bindPopup("<b>סוף המסלול</b>");
          }
        }

        // Add custom markers (photos, notes, etc.)
        ${markersJS}

        console.log('Map initialized successfully');

      } catch (mapError) {
        console.error('Error initializing map:', mapError);
      }

});
</script>
<script>
      // Initialize elevation chart
// Delay chart rendering to allow full layout
// console.log("Chart element found?", !!chartElement);
// console.log("Elevation data:", elevationData);
// console.log("Chart.js version:", Chart);

function renderElevationChart() {
  console.log("🟢 renderElevationChart CALLED");

  

  const chartElement = document.getElementById("chart-canvas");
  if (!chartElement) {
    console.error('Chart canvas not found!');
    return;
  }

  const elevationData = route.map(p => p.elevation || 0);



  console.log("📊 Elevation data:", elevationData);

  new Chart(chartElement, {
    type: "line",
    data: {
      labels: route.map((_, i) => "נקודה " + (i + 1)),
      datasets: [{
        label: "גובה (מ')",
        data: elevationData,
        borderColor: "green",
        backgroundColor: "rgba(0, 255, 0, 0.1)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

</script>
</body>
</html>`;

  // Add media files to archive
  routeData.forEach((entry, i) => {
    if (entry.type === "photo") {
      const base64 = entry.content?.split(",")[1];
      if (base64 && base64.length > 100) {
        mediaForArchive[`photo${i + 1}.jpg`] = { content: base64, isBase64: true };
      }
    } else if (entry.type === "text") {
      if (entry.content?.trim()) {
        mediaForArchive[`note${i + 1}.txt`] = { content: entry.content, isBase64: false };
      }
    }
  });

  // Save to archive if available
  if (typeof SummaryArchive !== 'undefined') {
    SummaryArchive.saveToArchive(name, htmlContent, mediaForArchive);
  }

  // Debug output
  console.log("=== FINAL HTML DEBUG ===");
  console.log("HTML length:", htmlContent.length);
  console.log("Route data length:", enriched.length);
  console.log("Path coords length:", pathCoords.length);
  
  // Save HTML file to ZIP
  zip.file("index.html", htmlContent);

  // Add media files to ZIP
  Object.entries(mediaForArchive).forEach(([filename, data]) => {
    if (typeof data === 'object' && data.isBase64) {
      zip.file(filename, data.content, { base64: true });
    } else {
      zip.file(filename, typeof data === 'object' ? data.content : data);
    }
  });

  // Generate and download ZIP
  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `route-summary-${Date.now()}.zip`;
    a.click();
    console.log("✅ Route summary exported successfully.");
  } catch (e) {
    console.error("❌ Export failed:", e);
    alert("❌ Failed to export route summary.");
  }

  resetApp();
  initMap();
}



// async function exportRouteSummary() {

//   const mostRecent = JSON.parse(localStorage.getItem("sessions") || "[]").slice(-1)[0];
//   const defaultName = mostRecent?.name || "My Route";
//   const name = prompt("📁 הזן שם לקובץ הסיכום:", defaultName);
//   if (!name) return;

//     if (!routeData || !Array.isArray(routeData) || routeData.length === 0) {
//     alert("⚠️ No route data available to export. Please track or load a route first.");
//     return;
//   }

//   console.log("✅ Route data exists, length:", routeData.length);

//   const hasLocation = routeData.some(entry => entry.type === "location");
//   if (!hasLocation) {
//     alert("⚠️ No location data found in this session.");
//     return;
//   }

//   console.log("✅ Has location data");

//   const zip = new JSZip();

//   console.log("✅ JSZip created");

//   const notesFolder = zip.folder("notes");
//   const imagesFolder = zip.folder("images");
//   const audioFolder = zip.folder("audio");
//   const mediaForArchive = {};

//   let markersJS = "";
//   let pathCoords = [];
//   let enriched = [];

//   let noteCounter = 1;
//   let photoCounter = 1;
//   let audioCounter = 1;

//   console.log("🔄 Processing route data...");


//   for (const entry of routeData) {
//     if (entry.type === "location") {
//       pathCoords.push([entry.coords.lat, entry.coords.lng]);
//       enriched.push({ ...entry }); // clone for later enrichment
//     } else if (entry.type === "text") {
//       notesFolder.file(`note${noteCounter}.txt`, entry.content);
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
//   icon: L.divIcon({ className: 'custom-icon', html: '📝', iconSize: [24, 24] })
// })
//   .addTo(map)
//   .bindTooltip("Note ${noteCounter}")
//   .bindPopup("<b>Note ${noteCounter}</b><br><pre>${entry.content}</pre>");
// `;
//       noteCounter++;
//     } else if (entry.type === "photo") {
//       const base64Data = entry.content.split(",")[1];
//       imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
//   icon: L.divIcon({ className: 'custom-icon', html: '📸', iconSize: [24, 24] })
// })
//   .addTo(map)
//   .bindTooltip("Photo ${photoCounter}")
//   .bindPopup("<b>Photo ${photoCounter}</b><br><img src='images/photo${photoCounter}.jpg' style='width:200px'>");
// `;
//       photoCounter++;
//     } else if (entry.type === "audio") {
//       const base64Data = entry.content.split(",")[1];
//       audioFolder.file(`audio${audioCounter}.webm`, base64Data, { base64: true });
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}])
//   .addTo(map)
//   .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
// `;
//       audioCounter++;
//     }
//   }

//   console.log("✅ Processed route data. PathCoords:", pathCoords.length, "Enriched:", enriched.length);

//   // Enrich with elevation
//   for (const entry of enriched) {
//     if (entry.type === "location" && entry.elevation == null) {
//       entry.elevation = await getElevation(entry.coords.lat, entry.coords.lng);
//     }
//   }

//   // Accessibility computation
//   let accessibleLength = 0;
//   for (let i = 1; i < enriched.length; i++) {
//     const a = enriched[i - 1], b = enriched[i];
//     if (a.elevation != null && b.elevation != null) {
//       const dist = haversineDistance(a.coords, b.coords);
//       const elev = b.elevation - a.elevation;
//       const grade = (elev / (dist * 1000)) * 100;
//       if (Math.abs(grade) <= 6) accessibleLength += dist * 1000;
//     }
//   }

//   // Elevation chart PNG
//   const elevationCanvas = await generateElevationChartCanvas(enriched);
//   const base64Chart = elevationCanvas.toDataURL("image/png");
//   const elevationBlob = await new Promise(res => elevationCanvas.toBlob(res, "image/png"));
//   zip.file("elevation.png", elevationBlob);
//   mediaForArchive["elevation.png"] = base64Chart.split(",")[1];
//   const formData = JSON.parse(localStorage.getItem("accessibilityForm") || "{}");

//   // Utility for displaying checkbox and other fields
//   const formatField = (val) => Array.isArray(val) ? val.join(", ") : (val || "—");
  
//   const trailType = formatField(formData.trailType);
//   const terrainFeatures = formatField(formData.terrainFeatures);
//   const mobilityAids = formatField(formData.mobilityAids);
//   const visualFeatures = formatField(formData.visualFeatures);
//   const hearingFeatures = formatField(formData.hearingFeatures);
//   const cognitiveFeatures = formatField(formData.cognitiveFeatures);
//   const facilities = formatField(formData.facilities);
//   const bestTimes = formatField(formData.bestTimes);
  
//   // Load form data from localStorage
//   const formDataRaw = localStorage.getItem("accessibilityData");
//   const data = formDataRaw ? JSON.parse(formDataRaw) : {};

//   // Helpers
//   const mapField = (key, fallback = '---') =>
//     Array.isArray(data[key]) ? data[key].join(", ") : (data[key] || fallback);

//   const getBoolLabel = (condition) => condition ? "✅ כן" : "❌ לא";

//   // Media counts (from earlier in app)
//   // const photoCount = 1;
//   // const noteCount = 1;
//   // const audioCount = 1;
//   // let pathCoords = [];
//   // let enriched = [];
//   // const accessibleLength = data.accessibleLength || 0;
//   // const boundsVar = JSON.stringify(pathCoords);

// const boundsVar = JSON.stringify(pathCoords.length ? [pathCoords[0], pathCoords[pathCoords.length - 1]] : []);

// // const routeDataEscaped = JSON.stringify(enriched).replace(/'/g, "\\'").replace(/\n/g, "\\n");
// // const pathCoordsEscaped = JSON.stringify(pathCoords).replace(/'/g, "\\'").replace(/\n/g, "\\n");
// // const boundsVarEscaped = JSON.stringify(pathCoords.length ? [pathCoords[0], pathCoords[pathCoords.length - 1]] : []);

// console.log("boundsVar:", boundsVar);
// console.log("JSON.stringify(pathCoords):", JSON.stringify(pathCoords));
// console.log("JSON.stringify(enriched):", JSON.stringify(enriched));
// console.log("markersJS:", markersJS);

//   // START building HTML content
//   let htmlContent = `
// <!DOCTYPE html>
// <html lang="he" dir="rtl">
// <head>
//   <meta charset="UTF-8">
//   <title>${name}</title>
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
// <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
// <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
// <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />

// <script>
// console.log('JavaScript test 1 - head section');
// </script>

//   <style>
//     body {
//       font-family: sans-serif;
//       direction: rtl;
//       background: #f0f0f0;
//       margin: 0;
//       padding: 20px;
//     }
//     .container {
//       background: white;
//       padding: 20px;
//       max-width: 900px;
//       margin: auto;
//       box-shadow: 0 0 10px #ccc;
//     }
//     h1, h2, h3 {
//       color: #2c5530;
//     }
//     ul {
//       list-style: none;
//       padding: 0;
//     }
//     li {
//       margin-bottom: 5px;
//     }
//     .section {
//       margin-bottom: 30px;
//     }
//     .media-counts {
//       background: #e8f5e9;
//       padding: 10px;
//       border-radius: 5px;
//       margin-bottom: 15px;
//     }
    
//     .legend span {
//       margin-left: 10px;
//     }
//     .tab-bar button {
//       margin: 5px;
//     }
//     .tab-bar {
//       display: flex;
//       gap: 10px;
//       flex-wrap: wrap;
//     }
    
//     .tab-content { display: none; } 
//     .tab-content.active { display: block; margin-top: 20px; }

//     #map { height: 400px; width: 100%; position: relative; z-index: 1; margin-bottom: 20px; } 
//     #chart { height: 300px !important; /* Fixed height */ width: 100% !important; /* Fixed width */ max-height: 300px !important; position: relative; z-index: 10; display: block !important; background: white; } 
//     .leaflet-container { z-index: 1 !important; position: relative !important; } 
//     .map-section { display: block; margin-bottom: 30px; } /* Fix Chart.js 
//     canvas sizing issues */ .map-section canvas { max-width: 100% !important; max-height: 300px !important; height: 300px !important; position: relative !important; display: block !important; }
//   </style>
// </head>
// <body>
//   <div class="container">
//     <h1>🏞️ ${mapField("trailName")} – סיכום מסלול</h1>
//     <div class="media-counts">
//       <b>📸 תמונות:</b> ${photoCounter} |
//       <b>📝 הערות:</b> ${noteCounter} |
//       <b>🎧 אודיו:</b> ${audioCounter} |
//       <b>♿ אורך נגיש:</b> ${accessibleLength} מ'
//     </div>

//     <h2>🔎 מידע כללי</h2>
//     <ul>
//       <li><b>שם השביל:</b> ${mapField("trailName")}</li>
//       <li><b>מיקום:</b> ${mapField("location")}</li>
//       <li><b>אורך (ק"מ):</b> ${mapField("trailLength")}</li>
//       <li><b>משך משוער:</b> ${mapField("estimatedTime")}</li>
//       <li><b>סוג מסלול:</b> ${trailType}</li>
//     </ul>

//     <div class="tab-bar">
//       <button onclick="openTab('map')">🗺️ מפה</button>
//       <button onclick="openTab('accessibility')">♿ נגישות</button>
//       <button onclick="openTab('terrain')">🛤️ טופוגרפיה</button>
//       <button onclick="openTab('facilities')">🏕️ מתקנים</button>
//       <button onclick="openTab('notes')">📝 הערות</button>
//     </div>

//     <div class="tab-content active" id="map">
//       <h3>🗺️ תצוגת מסלול</h3>

//     <div class="map-section">
//       <div id="map"></div>
//       <canvas id="chart" width="800" height="300" style="max-height: 300px;"></canvas>
//       <div class="legend">
//         <b>מקרא שיפועים:</b><br />
//         <span style="color:green">🟩 ≤ 6% (קל)</span>
//         <span style="color:orange">🟧 6–10% (בינוני)</span>
//         <span style="color:red">🟥 > 10% (תלול)</span>
//       </div>
//     </div>
//     </div>
//   `;
//   htmlContent += `
//     <div class="tab-content" id="accessibility">
//       <h3>♿ פרטי נגישות</h3>
//       <ul>
//         <li><b>נגישות לכיסא גלגלים:</b> ${mapField("wheelchairAccess")}</li>
//         <li><b>אביזרי ניידות תואמים:</b> ${mapField("mobilityAids")}</li>
//         <li>עזרים: ${mobilityAids}</li>
//         <li><b>מאפייני שטח:</b> ${terrainFeatures}</li>
//         <li><b>מאפיינים חזותיים:</b> ${visualFeatures}</li>
//         <li><b>תאורה:</b> ${mapField("lighting")}</li>
//         <li><b>מכשולים חזותיים:</b> ${mapField("hazards")}</li>
//         <li><b>שלטי ברייל:</b> ${data.visualFeatures?.includes("braille-signage") ? "✅ כן" : "❌ לא"}</li>
//         <li><b>נגיש לכלבי נחיה:</b> ${mapField("guideDogFriendly")}</li>
//         <li><b>מאפיינים שמיעתיים:</b> ${hearingFeatures}</li>
//         <li><b>תקשורת חירום:</b> ${mapField("emergencyComm")}</li>
//         <li><b>מורכבות ניווט:</b> ${mapField("navigationComplexity")}</li>
//         <li><b>תמיכה קוגניטיבית:</b> ${cognitiveFeatures}</li>
//         <li><b>רמת רעש:</b> ${mapField("noiseLevel")}</li>
//         <li><b>צפיפות:</b> ${mapField("crowdLevel")}</li>
//       </ul>
//     </div>

//     <div class="tab-content" id="terrain">
//       <h3>🛤️ סוג משטח וגובה</h3>
//       <ul>
//         <li><b>סוג משטח:</b> ${mapField("surfaceType")}</li>
//         <li><b>רוחב השביל:</b> ${mapField("pathWidth")} מטרים</li>
//         <li><b>מצב המשטח:</b> ${mapField("surfaceCondition")}</li>
//         <li><b>שיפוע מרבי:</b> ${mapField("maxGrade")}%</li>
//         <li><b>שיפוע ממוצע:</b> ${mapField("avgGrade")}%</li>
//         <li><b>עלייה בגובה:</b> ${mapField("elevationGain")} מטרים</li>
//         <li><b>מקטעים תלולים:</b> ${mapField("steepSections")}</li>
//       </ul>
//     </div>

//     <div class="tab-content" id="facilities">
//       <h3>🏕️ מתקנים ושירותים</h3>
//       <ul>
//         <li><b>חניה נגישה:</b> ${getBoolLabel(data.facilities?.includes("accessible-parking"))}</li>
//         <li><b>מקומות חניה נגישה:</b> ${mapField("accessibleParkingSpaces")}</li>
//         <li><b>שירותים נגישים:</b> ${getBoolLabel(data.facilities?.includes("accessible-restrooms"))}</li>
//         <li><b>ברזיות:</b> ${getBoolLabel(data.facilities?.includes("water-fountains"))}</li>
//         <li><b>אזורי פיקניק:</b> ${getBoolLabel(data.facilities?.includes("picnic-areas"))}</li>
//         <li><b>מחסות:</b> ${getBoolLabel(data.facilities?.includes("shelters"))}</li>
//         <li><b>מרכז מידע:</b> ${getBoolLabel(data.facilities?.includes("info-center"))}</li>
//         <li><b>תשלום בכניסה:</b> ${mapField("entryFee")}</li>
//         <li><b>תחבורה ציבורית:</b> ${mapField("publicTransport")}</li>
//       </ul>
//     </div>

//     <div class="tab-content" id="notes">
//       <h3>📝 הערות נוספות</h3>
//       <ul>
//         <li><b>זמנים מומלצים:</b> ${bestTimes}</li>
//         <li><b>הערות כלליות:</b><br>${mapField("additionalNotes")}</li>
//         <li><b>שם הסוקר:</b> ${mapField("surveyorName")}</li>
//         <li><b>תאריך הסקר:</b> ${mapField("surveyDate")}</li>
//       </ul>
//     </div>
//   `;
//   htmlContent += `
//     </div>

//     <script>
// console.log('JavaScript test 2 - before main script');
// console.log('Chart.js loaded:', typeof Chart !== 'undefined');
// console.log('Leaflet loaded:', typeof L !== 'undefined');
// </script>

//     <script>
//       function openTab(id) {
//   document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
//   document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
//   document.getElementById(id).classList.add('active');
//   event.target.classList.add('active');

//   // Force map reflow when its tab is opened
//   if (id === 'map' && window.map && typeof window.map.invalidateSize === "function") {
//     setTimeout(() => {
//       window.map.invalidateSize();
//       initChart(); // Initialize chart after map is ready
//     }, 250);
//   }
// }

      
//     </script>
//     <script>
//         window.addEventListener("DOMContentLoaded", () => {
//   console.log('DOMContentLoaded event fired');

//   // Define route data FIRST
//   const route = ${JSON.stringify(enriched)};
  
//   // Create elevation data from route
//   const elevationData = route.map(p => p.elevation || 0);
  
//   // Create map center from route bounds
//   const bounds = L.latLngBounds(${boundsVar});
//   const mapCenter = bounds.getCenter();

//   // NOW we can debug the data
//   console.log("Route data:", route);
//   console.log("Route length:", route ? route.length : "undefined");
//   console.log("Elevation data:", elevationData);
//   console.log("Elevation length:", elevationData ? elevationData.length : "undefined");
//   console.log("First route point:", route && route[0]);
//   console.log("Map center coordinates:", mapCenter);

//   // Debug: Check if elements exist
//   console.log('Map element:', document.getElementById('map'));
//   console.log('Chart element:', document.getElementById('chart'));

//   // Initialize map
//   var map = L.map('map');
//   map.fitBounds(bounds);

//   L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     maxZoom: 18,
//     attribution: '&copy; OpenStreetMap contributors'
//   }).addTo(map);

//   L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);

//   const haversine = (a, b) => {
//     const toRad = x => x * Math.PI / 180, R = 6371;
//     const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
//     const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
//     const a_ = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
//     return R * 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1-a_));
//   };

  

//   // Add route segments with colors
//   for (let i = 1; i < route.length; i++) {
//     const a = route[i - 1], b = route[i];
//     const dist = haversine(a.coords, b.coords);
//     const elev = b.elevation - a.elevation;
//     const grade = (elev / (dist * 1000)) * 100;
//     const color = Math.abs(grade) > 10 ? 'red' : Math.abs(grade) > 6 ? 'orange' : 'green';
//     L.polyline([a.coords, b.coords], { color }).addTo(map);
//   }
  
//   if (route.length > 0) {
//   const point = route[0];
//   L.marker([point.coords.lat, point.coords.lng], {
//     icon: L.divIcon({ className: 'custom-icon', html: '📍', iconSize: [24, 24] })
//   })
//   .addTo(map)
//   .bindTooltip("Location Point")
//   .bindPopup("<b>Location</b><br>Lat: " + point.coords.lat + "<br>Lng: " + point.coords.lng);
// }

//   // Initialize chart with error handling
//   try {
//     const chartElement = document.getElementById("chart");
//     if (!chartElement) {
//       console.error('Chart element not found!');
//       return;
//     }
    
//     console.log('Creating chart with data:', elevationData);
    
//     const chart = new Chart(chartElement, {
//       type: "line",
//       data: {
//         labels: route.map((_, i) => "Point " + (i + 1)),
//         datasets: [{
//           label: "גובה (מ')",
//           data: elevationData,
//           borderColor: "green",
//           backgroundColor: "rgba(0, 255, 0, 0.1)",
//           tension: 0.3,
//           fill: true
//         }]
//       },
//       options: {
//         responsive: true,
//         maintainAspectRatio: false,
//         plugins: {
//           legend: {
//             display: true
//           }
//         },
//         scales: {
//           y: {
//             beginAtZero: false,
//             title: {
//               display: true,
//               text: 'גובה (מ\')'
//             }
//           },
//           x: {
//             title: {
//               display: true,
//               text: 'נקודות במסלול'
//             }
//           }
//         },
//         layout: {
//           padding: 10
//         }
//       }
//     });
    
//     console.log('Chart created successfully:', chart);
//   } catch (error) {
//     console.error('Error creating chart:', error);
//   }

//   // Make map globally accessible
//   window.map = map;
// });
// </script>

//   </body>
// </html>
// `;

    
// // Photos and notes
// routeData.forEach((entry, i) => {
//   if (entry.type === "photo") {
//     const base64 = entry.content?.split(",")[1];  // Get only base64 part
//     if (base64 && base64.length > 100) { // Validate length
//       mediaForArchive[`photo${i + 1}.jpg`] = { content: base64, isBase64: true };
//     }
//   } else if (entry.type === "text") {
//     if (entry.content?.trim()) {
//       mediaForArchive[`note${i + 1}.txt`] = { content: entry.content, isBase64: false };
//     }
//   }
// });
// SummaryArchive.saveToArchive(name, htmlContent, mediaForArchive);

// // Add this right before: zip.file("index.html", htmlContent);

// console.log("=== DEBUGGING GENERATED HTML ===");
// console.log("HTML length:", htmlContent.length);
// console.log("First 500 chars:", htmlContent.substring(0, 500));

// // Check for problematic characters in the JSON data
// console.log("Route data sample:", JSON.stringify(enriched).substring(0, 200));
// console.log("Path coords sample:", JSON.stringify(pathCoords).substring(0, 200));
// console.log("Bounds var:", boundsVar);

// // Look for script section
// const scriptStart = htmlContent.indexOf('<script>');
// const scriptEnd = htmlContent.indexOf('</script>', scriptStart);
// if (scriptStart !== -1) {
//   console.log("Script section found at position:", scriptStart);
//   console.log("Script content (first 300 chars):", htmlContent.substring(scriptStart, scriptStart + 300));
// } else {
//   console.log("❌ No script section found in HTML!");
// }

// // Save to localStorage for inspection
// localStorage.setItem('debugHTML', htmlContent);
// console.log("💾 Full HTML saved to localStorage as 'debugHTML'");
// console.log("📋 Run this in console to copy: copy(localStorage.getItem('debugHTML'))");

// // HTML
// zip.file("index.html", htmlContent);

// // Optional: PDF Blob
// if (typeof pdfBlob !== "undefined" && pdfBlob instanceof Blob) {
//   zip.file("route-summary.pdf", pdfBlob); // ⚠️ No base64:true!
// }

// // Add media files
// Object.entries(mediaForArchive).forEach(([filename, { content, isBase64 }]) => {
//   zip.file(filename, content, isBase64 ? { base64: true } : {});
// });

// // Generate and download ZIP
// try {
//   const blob = await zip.generateAsync({ type: "blob" });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement("a");
//   a.href = url;
//   a.download = `route-summary-${Date.now()}.zip`;
//   a.click();
//   console.log("✅ Route summary exported successfully.");
// } catch (e) {
//   console.error("❌ Export failed:", e);
//   alert("❌ Failed to export route summary.");
// }


//   resetApp();
//   initMap();
// }

// For normal app route tracking
// async function exportRouteSummary() {
//   console.log("📦 Attempting route export...");

//   if (!routeData || !Array.isArray(routeData) || routeData.length === 0) {
//     alert("⚠️ No route data available to export. Please track or load a route first.");
//     return;
//   }

//   const hasLocation = routeData.some(entry => entry.type === "location");
//   if (!hasLocation) {
//     alert("⚠️ No location data found in this session.");
//     return;
//   }

//   const mostRecent = JSON.parse(localStorage.getItem("sessions") || "[]").slice(-1)[0];
//   const defaultName = mostRecent?.name || "My Route";
//   const name = prompt("Enter a title for this route summary:", defaultName);
//   if (!name) return;

//   const zip = new JSZip();
//   const notesFolder = zip.folder("notes");
//   const imagesFolder = zip.folder("images");
//   const audioFolder = zip.folder("audio");
//   const mediaForArchive = {};

//   let markersJS = "";
//   let pathCoords = [];
//   let enriched = [];
//   let noteCounter = 1;
//   let photoCounter = 1;
//   let audioCounter = 1;

//   for (const entry of routeData) {
//     if (entry.type === "location") {
//       pathCoords.push([entry.coords.lat, entry.coords.lng]);
//       enriched.push({ ...entry }); // clone for later enrichment
//     } else if (entry.type === "text") {
//       notesFolder.file(`note${noteCounter}.txt`, entry.content);
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
//   icon: L.divIcon({ className: 'custom-icon', html: '📝', iconSize: [24, 24] })
// })
//   .addTo(map)
//   .bindTooltip("Note ${noteCounter}")
//   .bindPopup("<b>Note ${noteCounter}</b><br><pre>${entry.content}</pre>");
// `;
//       noteCounter++;
//     } else if (entry.type === "photo") {
//       const base64Data = entry.content.split(",")[1];
//       imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}], {
//   icon: L.divIcon({ className: 'custom-icon', html: '📸', iconSize: [24, 24] })
// })
//   .addTo(map)
//   .bindTooltip("Photo ${photoCounter}")
//   .bindPopup("<b>Photo ${photoCounter}</b><br><img src='images/photo${photoCounter}.jpg' style='width:200px'>");
// `;
//       photoCounter++;
//     } else if (entry.type === "audio") {
//       const base64Data = entry.content.split(",")[1];
//       audioFolder.file(`audio${audioCounter}.webm`, base64Data, { base64: true });
//       markersJS += `
// L.marker([${entry.coords.lat}, ${entry.coords.lng}])
//   .addTo(map)
//   .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
// `;
//       audioCounter++;
//     }
//   }

//   // Enrich with elevation
//   for (const entry of enriched) {
//     if (entry.type === "location" && entry.elevation == null) {
//       entry.elevation = await getElevation(entry.coords.lat, entry.coords.lng);
//     }
//   }

//   // Accessibility computation
//   let accessibleLength = 0;
//   for (let i = 1; i < enriched.length; i++) {
//     const a = enriched[i - 1], b = enriched[i];
//     if (a.elevation != null && b.elevation != null) {
//       const dist = haversineDistance(a.coords, b.coords);
//       const elev = b.elevation - a.elevation;
//       const grade = (elev / (dist * 1000)) * 100;
//       if (Math.abs(grade) <= 6) accessibleLength += dist * 1000;
//     }
//   }

//   // Elevation chart PNG
//   const elevationCanvas = await generateElevationChartCanvas(enriched);
//   const base64Chart = elevationCanvas.toDataURL("image/png");
//   const elevationBlob = await new Promise(res => elevationCanvas.toBlob(res, "image/png"));
//   zip.file("elevation.png", elevationBlob);
//   mediaForArchive["elevation.png"] = base64Chart.split(",")[1];

//   // const accessibilityEntry = routeData.find(e => e.type === "accessibility");
//   // const accessibilityData = accessibilityEntry ? accessibilityEntry.content : null;
//   // const accessibilityJSON = JSON.stringify(accessibilityData);

//   const accessibilityData = JSON.parse(localStorage.getItem("accessibilityData") || "null");
// console.log(accessibilityData);
//   const boundsVar = JSON.stringify(pathCoords);

//   const htmlContent = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//   <meta charset="UTF-8">
//   <title>${name}</title>
//   <meta name="viewport" content="width=device-width, initial-scale=1.0">
//   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
//   <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
//   <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
//   <style>
//     body { margin: 0; font-family: Arial, sans-serif; }
//     #map { height: 60vh; }
//     #summaryPanel { padding: 20px; background: #f7f7f7; }
//     #routeTitle { font-size: 24px; margin-bottom: 10px; color: #2c3e50; }
//     .stats { margin-top: 10px; }
//     .stats b { display: inline-block; width: 120px; }
//     #description { margin-top: 20px; }
//     #description textarea { width: 100%; height: 100px; font-size: 14px; }
//     #accessibilityDetails ul { list-style-type: none; padding-left: 0; }
//     #accessibilityDetails li { margin-bottom: 5px; }
//   </style>
// </head>
// <body>
// <div id="summaryPanel">
//   <div id="routeTitle">📍 ${name}</div>
//   <div class="stats">
//     <div><b>Distance:</b> ${totalDistance.toFixed(2)} km</div>
//     <div><b>Time:</b> ${document.getElementById("timer").textContent}</div>
//     <div><b>Photos:</b> ${photoCounter - 1}</div>
//     <div><b>Notes:</b> ${noteCounter - 1}</div>
//     <div><b>Audios:</b> ${audioCounter - 1}</div>
//     <p><b>Accessible Length:</b> ${accessibleLength.toFixed(0)} m</p>
//   </div>
//   <div id="description">
//     <h4>General Description:</h4>
//     <textarea placeholder="Add notes or observations about the route here..."></textarea>
//     </div>
//   <div id="accessibilityDetailsContainer"></div>
// </div>

// <canvas id="chart" width="800" height="200">Chart Goes Here</canvas>

// <div style="margin-top: 10px;">
//   <b>Gradient Legend:</b><br>
//   <span style="color:green">🟩 ≤ 6% (Mild)</span>&nbsp;&nbsp;
//   <span style="color:orange">🟧 6–10% (Moderate)</span>&nbsp;&nbsp;
//   <span style="color:red">🟥 > 10% (Steep)</span>
// </div>

// <div id="map"></div>
// <script>
// var map = L.map('map');
// var bounds = L.latLngBounds(${boundsVar});
// map.fitBounds(bounds);

// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//   maxZoom: 18,
//   attribution: '&copy; OpenStreetMap contributors'
// }).addTo(map);

// L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);

// const route = ${JSON.stringify(enriched)};
//   const haversine = (a, b) => {
//     const toRad = x => x * Math.PI / 180, R = 6371;
//     const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
//     const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
//     const a_ = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
//     return R * 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1-a_));
//   };

//   for (let i = 1; i < route.length; i++) {
//     const a = route[i - 1], b = route[i];
//     const dist = haversine(a.coords, b.coords);
//     const elev = b.elevation - a.elevation;
//     const grade = (elev / (dist * 1000)) * 100;
//     const color = Math.abs(grade) > 10 ? 'red' : Math.abs(grade) > 6 ? 'orange' : 'green';
//     L.polyline([a.coords, b.coords], { color }).addTo(map);
//   }


// ${markersJS}

// // Accessibility summary rendering
// (function(){
//   const data = ${JSON.stringify(accessibilityData)};
//   if (!data) return;
//   const html = \`
//     <div id="accessibilityDetails">
//       <h3>♿ Accessibility Details</h3>
//       <ul>
//         <li><b>Disabled Parking:</b> \${data.disabledParkingCount}</li>
//         <li><b>Path Type:</b> \${data.pathType}</li>
//         <li><b>Accessible Length:</b> \${data.accessibleLength} m</li>
//         <li><b>Route Type:</b> \${data.routeType}</li>
//         <li><b>Slope:</b> \${data.slope}</li>
//         <li><b>Points of Interest:</b> \${data.pointsOfInterest}</li>
//         <li><b>Lookouts:</b> \${data.lookouts ? "Yes" : "No"}</li>
//         <li><b>Picnic Spots:</b> \${data.picnicSpots ? "Yes" : "No"}</li>
//         <li><b>Accessible Toilets:</b> \${data.accessibleToilets ? "Yes" : "No"}</li>
//         <li><b>Benches:</b> \${data.benches ? "Yes" : "No"}</li>
//         <li><b>Shade:</b> \${data.shade}</li>
//       </ul>
//     </div>\`;
//   document.getElementById("accessibilityDetailsContainer").innerHTML = html;
// })();

//   new Chart(document.getElementById("chart"), {
//     type: "line",
//     data: {
//       labels: route.map((c, i) => i),
//       datasets: [{
//         label: "Elevation (m)",
//         data: route.map(c => c.elevation),
//         borderColor: "green",
//         tension: 0.3,
//         fill: true
//       }]
//     }
//   });

// </script>
// </body>
// </html>
// `;

//   //const mediaForArchive = {};
//   routeData.forEach((entry, i) => {
//     if (entry.type === "photo") {
//       const base64 = entry.content.split(",")[1];
//       mediaForArchive[`photo${i + 1}.jpg`] = base64;
//     } else if (entry.type === "text") {
//       mediaForArchive[`note${i + 1}.txt`] = entry.content;
//     }
//   });
//   SummaryArchive.saveToArchive(name, htmlContent, mediaForArchive);

//   zip.file("index.html", htmlContent);

//   try {
//     const blob = await zip.generateAsync({ type: "blob" });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = `route-summary-${Date.now()}.zip`;
//     a.click();
//     console.log("✅ Route summary exported successfully.");
//   } catch (e) {
//     console.error("❌ Export failed:", e);
//     alert("❌ Failed to export route summary.");
//   }

//   resetApp();
//   initMap();
// }


async function exportAllRoutes() {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

  if (sessions.length === 0) {
    alert("No saved sessions to export!");
    return;
  }

  const zip = new JSZip();
  const explorerTableRows = [];

  for (const session of sessions) {
    const folderName = session.name.toLowerCase().replace(/\s+/g, "-");
    const sessionFolder = zip.folder(`routes/${folderName}`);
    const notesFolder = sessionFolder.folder("notes");
    const imagesFolder = sessionFolder.folder("images");
    const audioFolder = sessionFolder.folder("audio");

    let markersJS = "";
    let pathCoords = [];
    let noteCounter = 1;
    let photoCounter = 1;
    let audioCounter = 1;

    for (const entry of session.data) {
      if (entry.type === "location") {
        pathCoords.push([entry.coords.lat, entry.coords.lng]);
      } else if (entry.type === "text") {
        notesFolder.file(`note${noteCounter}.txt`, entry.content);
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Note ${noteCounter}</b><br><pre>${entry.content}</pre>");
`;
        noteCounter++;
      } else if (entry.type === "photo") {
        const base64Data = entry.content.split(",")[1];
        imagesFolder.file(`photo${photoCounter}.jpg`, base64Data, { base64: true });
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup(\`
    <b>Photo ${photoCounter}</b><br>
    <img src='images/photo${photoCounter}.jpg' style='width:200px;cursor:pointer' onclick='showFullScreen(this)'>
  \`);
`;
        photoCounter++;
      } else if (entry.type === "audio") {
        const base64Data = entry.content.split(",")[1];
        audioFolder.file(`audio${audioCounter}.webm`, base64Data, { base64: true });
        markersJS += `
L.marker([${entry.coords.lat}, ${entry.coords.lng}])
  .addTo(map)
  .bindPopup("<b>Audio ${audioCounter}</b><br><audio controls src='audio/audio${audioCounter}.webm'></audio>");
`;
        audioCounter++;
      }
    }
    
  // const accessibilityEntry = routeData.find(e => e.type === "accessibility");
  // const accessibilityData = accessibilityEntry ? accessibilityEntry.content : null;
  // const accessibilityJSON = JSON.stringify(accessibilityData);

    const accessibilityData = JSON.parse(localStorage.getItem("accessibilityData") || "null");
   
    if (pathCoords.length === 0) continue;

    const boundsVar = JSON.stringify(pathCoords);
    const sessionHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${session.name}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.3/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.3/dist/leaflet.js"></script>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    #map { height: 60vh; }
    #summaryPanel {
      padding: 20px;
      background: #f7f7f7;
    }
    #routeTitle {
      font-size: 24px;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .stats { margin-top: 10px; }
    .stats b { display: inline-block; width: 120px; }
    #description { margin-top: 20px; }
    #description textarea {
      width: 100%;
      height: 100px;
      font-size: 14px;
    }
    #accessibilityDetails ul { list-style-type: none; padding-left: 0; }
    #accessibilityDetails li { margin-bottom: 5px; }
  </style>
</head>
<body>
<div id="summaryPanel">
  <div id="routeTitle">📍 ${session.name}</div>
  <div class="stats">
    <div><b>Distance:</b> ${session.distance} km</div>
    <div><b>Time:</b> ${session.time}</div>
    <div><b>Photos:</b> ${photoCounter - 1}</div>
    <div><b>Notes:</b> ${noteCounter - 1}</div>
    <div><b>Audios:</b> ${audioCounter - 1}</div>
  </div>
  // Inject accessibility content
const accessibilityEntry = routeData.find(e => e.type === "accessibility");
const accessibilityHTML = generateAccessibilityHTML(accessibilityEntry ? accessibilityEntry.content : null);
document.getElementById("summaryPanel").innerHTML += accessibilityHTML;

  <div id="description">
    <h4>General Description:</h4>
    <textarea placeholder="Add notes or observations about the route here..."></textarea>
  </div>
  <div id="accessibilityDetailsContainer"></div>
</div>

<div id="map"></div>
<script>
var map = L.map('map');
var bounds = L.latLngBounds(${boundsVar});
map.fitBounds(bounds);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

L.polyline(${JSON.stringify(pathCoords)}, { color: 'blue' }).addTo(map);

${markersJS}

// Fullscreen photo viewer
function showFullScreen(img) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.9)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.onclick = () => document.body.removeChild(overlay);

  const fullImg = document.createElement("img");
  fullImg.src = img.src;
  fullImg.style.maxWidth = "90%";
  fullImg.style.maxHeight = "90%";
  overlay.appendChild(fullImg);
  document.body.appendChild(overlay);
}

// Fullscreen photo viewer
function showFullScreen(img) {
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.9)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.zIndex = "9999";
  overlay.onclick = () => document.body.removeChild(overlay);

  const fullImg = document.createElement("img");
  fullImg.src = img.src;
  fullImg.style.maxWidth = "90%";
  fullImg.style.maxHeight = "90%";
  overlay.appendChild(fullImg);
  document.body.appendChild(overlay);
}
// Accessibility summary rendering
(function(){
  const data = ${accessibilityData};
  if (!data) return;
  const html = \`
    <div id="accessibilityDetails">
      <h3>♿ Accessibility Details</h3>
      <ul>
        <li><b>Disabled Parking:</b> \${data.disabledParkingCount}</li>
        <li><b>Path Type:</b> \${data.pathType}</li>
        <li><b>Accessible Length:</b> \${data.accessibleLength} m</li>
        <li><b>Route Type:</b> \${data.routeType}</li>
        <li><b>Slope:</b> \${data.slope}</li>
        <li><b>Points of Interest:</b> \${data.pointsOfInterest}</li>
        <li><b>Lookouts:</b> \${data.lookouts ? "Yes" : "No"}</li>
        <li><b>Picnic Spots:</b> \${data.picnicSpots ? "Yes" : "No"}</li>
        <li><b>Accessible Toilets:</b> \${data.accessibleToilets ? "Yes" : "No"}</li>
        <li><b>Benches:</b> \${data.benches ? "Yes" : "No"}</li>
        <li><b>Shade:</b> \${data.shade}</li>
      </ul>
    </div>\`;
  document.getElementById("accessibilityDetailsContainer").innerHTML = html;
})();
</script>
</body>
</html>
`;

    sessionFolder.file("index.html", sessionHTML);

    explorerTableRows.push({
      name: session.name,
      distance: session.distance,
      time: session.time,
      date: session.date,
      folder: folderName
    });
  }

  // Build the explorer HTML
  let explorerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Route Explorer</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
    h1 { color: #2c3e50; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; border-bottom: 1px solid #ccc; text-align: left; }
    th { background: #3498db; color: white; }
    tr:hover { background: #eaf4fc; }
    a.button {
      background: #2980b9;
      color: white;
      padding: 6px 12px;
      border-radius: 4px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <h1>📦 Exported Route Summaries</h1>
  <table>
    <thead>
      <tr><th>Name</th><th>Distance</th><th>Time</th><th>Date</th><th>View</th></tr>
    </thead>
    <tbody>
`;

  explorerTableRows.forEach(row => {
    explorerHTML += `
<tr>
  <td>${row.name}</td>
  <td>${row.distance} km</td>
  <td>${row.time}</td>
  <td>${row.date.split("T")[0]}</td>
  <td><a class="button" href="routes/${row.folder}/index.html" target="_blank">Open</a></td>
</tr>`;
  });

  explorerHTML += `
    </tbody>
  </table>
</body>
</html>
`;

  zip.file("explorer.html", explorerHTML);

  // Final ZIP
  try {
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all-routes-${Date.now()}.zip`;
    a.click();
    console.log("✅ All routes exported successfully.");
  } catch (e) {
    console.error("❌ Failed to export all routes:", e);
    alert("❌ Export failed.");
  }
}


function closeHistory() {
  document.getElementById("historyPanel").style.display = "none";
}
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
}
function clearAllSessions() {
  const confirmClear = confirm("⚠️ Are you sure you want to clear all saved routes? This cannot be undone!");

  if (confirmClear) {
    localStorage.removeItem("sessions"); // ✅ Clear saved sessions
    localStorage.removeItem("route_backup"); // ✅ Also clear any backup

    document.getElementById("historyList").innerHTML = ""; // ✅ Clear history panel if open
    loadSavedSessions(); // ✅ Refresh empty list if necessary

    alert("✅ All saved routes have been cleared!");
  }
}
function prepareAndExport() {
  loadMostRecentSession(() => {
    exportRouteSummary(); // now routeData is populated
  });
}

function clearAllAppData() {
  const confirmClear = confirm("⚠️ This will permanently delete all routes, summaries, and backups. Continue?");
  if (!confirmClear) return;

  localStorage.removeItem("sessions");
  localStorage.removeItem("summary_archive");
  localStorage.removeItem("route_backup");

  if (document.getElementById("historyList")) {
    document.getElementById("historyList").innerHTML = "";
  }

  if (typeof SummaryArchive !== "undefined") {
    SummaryArchive.showArchiveBrowser(); // refresh if visible
  }

  loadSavedSessions();

  alert("✅ All app data has been cleared!");
}
let wasTimerRunning = false;

function promptAccessibilityForm(callback) {
  document.getElementById("accessibilityFormOverlay").style.display = "flex";

  if (timerInterval) {
    wasTimerRunning = true;
    clearInterval(timerInterval);
  } else {
    wasTimerRunning = false;
  }

  const form = document.getElementById("accessibilityForm");
  form.onsubmit = e => {
    e.preventDefault();

    const formData = new FormData(form);
    const accessibilityData = {};

    for (const [key, value] of formData.entries()) {
      if (value instanceof File && value.name) {
        const reader = new FileReader();
        reader.onload = () => {
          accessibilityData[key] = reader.result;
        };
        reader.readAsDataURL(value);
      } else {
        accessibilityData[key] = value;
      }
    }

    // Optional: Delay execution if awaiting image load
    setTimeout(() => {
      document.getElementById("accessibilityFormOverlay").style.display = "none";
      callback(accessibilityData); // Pass back data
    }, 500);
  };
}
function closeAccessibilityForm() {
  const overlay = document.getElementById("accessibilityOverlay");
  if (overlay) {
    overlay.style.display = "none";
  } else {
    console.warn("⚠️ accessibilityOverlay not found.");
  }
  if (wasTimerRunning) {
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }
}

function prefillAccessibilityForm(data) {
  const form = document.getElementById("accessibilityForm");
  if (!form) return;

  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements[key];
    if (field) {
      if (field.type === "file") {
        // ❌ SKIP file inputs – cannot be set programmatically
        return;
      }
      if (field.type === "checkbox") {
        field.checked = value === "on" || value === true;
      } else {
        field.value = value;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("accessibilityForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      const accessibilityData = {};

      for (const [key, value] of formData.entries()) {
        accessibilityData[key] = value;
      }

      localStorage.setItem("accessibilityData", JSON.stringify(accessibilityData));

      routeData.push({
        type: "accessibility",
        timestamp: Date.now(),
        content: accessibilityData
      });

      alert("✅ Questionnaire saved and added to route!");
      closeAccessibilityForm();
      if (typeof e.target._onComplete === "function") {
    e.target._onComplete();  // resume tracking logic
    e.target._onComplete = null;
  }
    });
  }
});

// (function () {
//   const monitorId = "localStorageStatus";
//   let panel = document.getElementById(monitorId);

//   if (!panel) {
//     panel = document.createElement("div");
//     panel.id = monitorId;
//     panel.className = "storage-monitor";
  
//     panel.innerHTML = `
//       <div id="storageHeader" style="cursor: pointer;">📦 localStorage Monitor ▼</div>
//       <div id="storageContent"></div>
//       <audio id="storageAlertAudio" style="display:none">
//         <source src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=" type="audio/wav">
//       </audio>
//     `;

//     document.body.appendChild(panel);

//   }

//     function getLocalStorageSizeInfo() {
//     let totalBytes = 0;
//     let photoBytes = 0;
//     let photoCount = 0;

//     for (let i = 0; i < localStorage.length; i++) {
//       const key = localStorage.key(i);
//       const value = localStorage.getItem(key);
//       if (!value) continue;

//       const size = new Blob([value]).size;
//       totalBytes += size;

      
//       try {
//   const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");

//   sessions.forEach(session => {
//     if (!session.data || !Array.isArray(session.data)) return;

//     session.data.forEach(entry => {
//       if (entry.type === "photo" && entry.content && entry.content.startsWith("data:image/")) {
//         photoCount++;
//         photoBytes += new Blob([entry.content]).size;
//       }
//     });
//   });
// } catch (e) {
//   console.warn("⚠️ Failed to parse sessions for photo usage:", e);
// }

//     }

//   const maxKB = 5 * 1024;
//   const totalKB = totalBytes / 1024;
//   const availableKB = maxKB - totalKB;
//   const maxBytes = 5 * 1024 * 1024;

//   return {
//     totalKB: totalKB.toFixed(1),
//     availableKB: availableKB.toFixed(1),
//     photoKB: (photoBytes / 1024).toFixed(1),
//     photoCount,
//     photoBytes, // ✅ Add this!
//     totalBytes // optional but useful
//   };
//   }

//   window.renderLocalStorageStatus = function () {
//   const content = document.getElementById("storageContent");
//   if (!content) return;

//   const { totalKB, availableKB, photoKB, photoCount, totalBytes, maxBytes } = getLocalStorageSizeInfo();
//   const percent = ((totalBytes / maxBytes) * 100).toFixed(1);

//   // Header info
//   content.innerHTML = `
//     • Used: ${totalKB} KB<br>
//     • Available: ${availableKB} KB
//   `;

//   // Warning
//   if (parseFloat(percent) >= 50) {
//     content.innerHTML += `<div style="color: yellow; margin-top: 5px;">⚠️ Approaching localStorage limit!</div>`;
//     if (!window.hasWarned) {
//       new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg").play().catch(() => {});
//       window.hasWarned = true;
//     }
//   } else {
//     window.hasWarned = false;
//   }


//   // Add thumbnails
//   const photoThumbs = document.createElement("div");
//   photoThumbs.style.cssText = `
//     margin-top: 10px;
//     display: flex;
//     flex-wrap: wrap;
//     gap: 6px;
//     max-height: 120px;
//     overflow-y: auto;
//     padding: 2px;
//     border-top: 1px solid #ccc;
//     margin-top: 10px;
//   `;

//   const photos = getLocalStoragePhotos(); // ← assumes existing function

//   photos.forEach((photo, index) => {
//     if (!photo.content || !photo.content.startsWith("data:image")) return;

//     const wrapper = document.createElement("div");
//     wrapper.style.cssText = `
//       position: relative;
//       display: inline-block;
//     `;

//     const img = document.createElement("img");
//     img.src = photo.content;
//     img.alt = `Photo ${index + 1}`;
//     img.style.cssText = `
//       width: 50px;
//       height: 50px;
//       object-fit: cover;
//       border-radius: 3px;
//       border: 1px solid #999;
//       max-width: 100%;
//       height: auto;
//     `;

// img.onclick = () => {
//   const viewer = document.createElement("div");
//   viewer.style.cssText = `
//     position: fixed;
//     top: 0; left: 0;
//     width: 100vw; height: 100vh;
//     background: rgba(0, 0, 0, 0.9);
//     display: flex;
//     align-items: center;
//     justify-content: center;
//     z-index: 10001;
//   `;

//   const fullImg = document.createElement("img");
//   fullImg.src = photo.content;
//   fullImg.style.maxWidth = "90%";
//   fullImg.style.maxHeight = "90%";
//   fullImg.style.border = "2px solid white";

//   viewer.appendChild(fullImg);
//   viewer.onclick = () => viewer.remove(); // Click to close
//   document.body.appendChild(viewer);
// };


//     const delBtn = document.createElement("button");
//     delBtn.textContent = "✖";
//     delBtn.title = "Delete photo";
//     delBtn.style.cssText = `
//       position: absolute;
//       top: -6px;
//       right: -6px;
//       background: red;
//       color: white;
//       border: none;
//       border-radius: 50%;
//       width: 16px;
//       height: 16px;
//       font-size: 10px;
//       cursor: pointer;
//       line-height: 16px;
//       padding: 0;
//     `;

//     delBtn.onclick = () => {
//       deletePhotoByTimestamp(photo.timestamp, photo.isBackup);
//       renderLocalStorageStatus();
//     };

//     wrapper.appendChild(img);
//     wrapper.appendChild(delBtn);
//     photoThumbs.appendChild(wrapper);
//   });

//   if (photoThumbs.childElementCount > 0) {
//     content.appendChild(photoThumbs);
//   }

//   if (photoThumbs.childElementCount > 0) {
//   const tools = document.createElement("div");
//   tools.innerHTML = `
//     <button id="deleteAllPhotosBtn" style="margin-top: 10px;">🗑️ Delete All Photos</button>
//     <button id="exportPhotosBtn" style="margin-left: 10px;">💾 Export Photos JSON</button>
//   `;
//   content.appendChild(tools);

//   tools.querySelector("#deleteAllPhotosBtn").onclick = () => {
//     if (confirm("Are you sure you want to delete all stored photos?")) {
//       deleteAllPhotos();
//       renderLocalStorageStatus();
//     }
//   };

//   tools.querySelector("#exportPhotosBtn").onclick = () => {
//     exportAllPhotosAsJSON();
//   };
// }

// };

// function deletePhotoByTimestamp(timestamp) {
//   let updated = false;

//   // 1. Remove from sessions
//   const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
//   sessions.forEach(session => {
//     if (Array.isArray(session.data)) {
//       const originalLength = session.data.length;
//       session.data = session.data.filter(p => p.type !== "photo" || p.timestamp !== timestamp);
//       if (session.data.length < originalLength) updated = true;
//     }
//   });
//   if (updated) localStorage.setItem("sessions", JSON.stringify(sessions));

//   // 2. Remove from route_backup if exists
//   const backup = JSON.parse(localStorage.getItem("route_backup") || "{}");
//   if (Array.isArray(backup.routeData)) {
//     const originalLength = backup.routeData.length;
//     backup.routeData = backup.routeData.filter(p => p.type !== "photo" || p.timestamp !== timestamp);
//     if (backup.routeData.length < originalLength) {
//       localStorage.setItem("route_backup", JSON.stringify(backup));
//     }
//   }
// }

// function deleteAllPhotos() {
//   // Clear photo entries from sessions
//   const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
//   sessions.forEach(session => {
//     if (Array.isArray(session.data)) {
//       session.data = session.data.filter(e => e.type !== "photo");
//     }
//   });
//   localStorage.setItem("sessions", JSON.stringify(sessions));

//   // Clear photo entries from backup
//   const backup = JSON.parse(localStorage.getItem("route_backup") || "{}");
//   if (Array.isArray(backup.routeData)) {
//     backup.routeData = backup.routeData.filter(e => e.type !== "photo");
//     localStorage.setItem("route_backup", JSON.stringify(backup));
//   }
// }

// function exportAllPhotosAsJSON() {
//   const photos = getLocalStoragePhotos();
//   if (photos.length === 0) return alert("No photos to export.");

//   const jsonBlob = new Blob([JSON.stringify(photos, null, 2)], { type: "application/json" });
//   const url = URL.createObjectURL(jsonBlob);

//   const a = document.createElement("a");
//   a.href = url;
//   a.download = "photos_export.json";
//   a.click();

//   URL.revokeObjectURL(url);
// }


//   // Draggable
// //   (function makeDraggable() {
// //   const panel = document.getElementById("localStorageStatus");
// //   const header = document.getElementById("storageHeader");

// //   let offsetX = 0, offsetY = 0, isDragging = false;

// //   header.addEventListener("mousedown", e => {
// //     isDragging = true;
// //     offsetX = e.clientX - panel.offsetLeft;
// //     offsetY = e.clientY - panel.offsetTop;
// //     panel.style.transition = "none";
// //   });

// //   document.addEventListener("mouseup", () => isDragging = false);

// //   document.addEventListener("mousemove", e => {
// //     if (isDragging) {
// //       panel.style.left = `${e.clientX - offsetX}px`;
// //       panel.style.top = `${e.clientY - offsetY}px`;
// //       panel.style.right = "auto";
// //       panel.style.bottom = "auto";
// //     }
// //   });
// // })(); // ✅ this is the function being executed


//   // Toggle
//   document.getElementById("storageHeader").addEventListener("click", () => {
//     const content = document.getElementById("storageContent");
//     const header = document.getElementById("storageHeader");
//     const isVisible = content.style.display !== "none";
//     content.style.display = isVisible ? "none" : "block";
//     header.textContent = isVisible ? "📦 localStorage Monitor ▲" : "📦 localStorage Monitor ▼";
//   });

//   setInterval(renderLocalStorageStatus, 1000);
//   renderLocalStorageStatus();
// })();

function getLocalStorageSizeInfo() {
  let totalBytes = 0;
  let photoBytes = 0;
  let photoCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    if (!value) continue;
    totalBytes += new Blob([value]).size;
  }

  try {
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.forEach(session => {
      if (!session.data || !Array.isArray(session.data)) return;
      session.data.forEach(entry => {
        if (entry.type === "photo" && entry.content?.startsWith("data:image/")) {
          photoCount++;
          photoBytes += new Blob([entry.content]).size;
        }
      });
    });
  } catch (e) {
    console.warn("⚠️ Failed to parse sessions:", e);
  }

  const maxBytes = 5 * 1024 * 1024;
  const totalKB = totalBytes / 1024;
  const availableKB = (maxBytes - totalBytes) / 1024;

  return {
    totalKB: totalKB.toFixed(1),
    availableKB: availableKB.toFixed(1),
    photoKB: (photoBytes / 1024).toFixed(1),
    photoCount,
    photoBytes,
    totalBytes,
    maxBytes
  };
}

function getLocalStoragePhotos() {
  const result = [];
  try {
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.forEach(session => {
      if (!Array.isArray(session.data)) return;
      session.data.forEach(entry => {
        if (entry.type === "photo" && entry.content?.startsWith("data:image/")) {
          result.push(entry);
        }
      });
    });
  } catch (e) {
    console.warn("⚠️ Failed to get photos:", e);
  }
  return result;
}

function deletePhotoByTimestamp(timestamp) {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  sessions.forEach(session => {
    session.data = session.data.filter(p => !(p.type === "photo" && p.timestamp === timestamp));
  });
  localStorage.setItem("sessions", JSON.stringify(sessions));

  const backup = JSON.parse(localStorage.getItem("route_backup") || "{}");
  if (Array.isArray(backup.routeData)) {
    backup.routeData = backup.routeData.filter(p => !(p.type === "photo" && p.timestamp === timestamp));
    localStorage.setItem("route_backup", JSON.stringify(backup));
  }
}

function deleteAllPhotos() {
  const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
  sessions.forEach(session => {
    session.data = session.data.filter(e => e.type !== "photo");
  });
  localStorage.setItem("sessions", JSON.stringify(sessions));

  const backup = JSON.parse(localStorage.getItem("route_backup") || "{}");
  if (Array.isArray(backup.routeData)) {
    backup.routeData = backup.routeData.filter(e => e.type !== "photo");
    localStorage.setItem("route_backup", JSON.stringify(backup));
  }
}

function exportAllPhotosAsJSON() {
  const photos = getLocalStoragePhotos();
  if (photos.length === 0) return alert("No photos to export.");
  const jsonBlob = new Blob([JSON.stringify(photos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(jsonBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "photos_export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function renderLocalStorageStatus() {
  const content = document.getElementById("storageContent");
  if (!content) return;

  const { totalKB, availableKB, photoKB, photoCount, totalBytes, maxBytes } = getLocalStorageSizeInfo();
  const percent = ((totalBytes / maxBytes) * 100).toFixed(1);

  content.innerHTML = `
    • Used: ${totalKB} KB<br>
    • Available: ${availableKB} KB
  `;

  if (parseFloat(percent) >= 50) {
    content.innerHTML += `<div style="color: yellow; margin-top: 5px;">⚠️ Approaching localStorage limit!</div>`;
    if (!window.hasWarned) {
      new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg").play().catch(() => {});
      window.hasWarned = true;
    }
  } else {
    window.hasWarned = false;
  }

  const photos = getLocalStoragePhotos();
  if (photos.length) {
    const photoThumbs = document.createElement("div");
    photoThumbs.style.cssText = `
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 120px;
      overflow-y: auto;
      border-top: 1px solid #ccc;
      padding-top: 5px;
    `;

    photos.forEach((photo, index) => {
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";

      const img = document.createElement("img");
      img.src = photo.content;
      img.alt = `Photo ${index + 1}`;
      img.onclick = () => {
        const viewer = document.createElement("div");
        viewer.style.cssText = `
          position: fixed; top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.9);
          display: flex; align-items: center; justify-content: center;
          z-index: 10001;
        `;
        const fullImg = document.createElement("img");
        fullImg.src = photo.content;
        fullImg.style.maxWidth = "90%";
        fullImg.style.maxHeight = "90%";
        viewer.appendChild(fullImg);
        viewer.onclick = () => viewer.remove();
        document.body.appendChild(viewer);
      };

      const delBtn = document.createElement("button");
      delBtn.textContent = "✖";
      delBtn.title = "Delete photo";
      delBtn.style.cssText = `
        position: absolute;
        top: -6px;
        right: -6px;
        background: red;
        color: white;
        border: none;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        font-size: 10px;
        cursor: pointer;
        line-height: 16px;
        padding: 0;
      `;
      delBtn.onclick = () => {
        deletePhotoByTimestamp(photo.timestamp);
        renderLocalStorageStatus();
      };

      wrapper.appendChild(img);
      wrapper.appendChild(delBtn);
      photoThumbs.appendChild(wrapper);
    });

    content.appendChild(photoThumbs);

    const tools = document.createElement("div");
    tools.innerHTML = `
      <button id="deleteAllPhotosBtn" style="margin-top: 10px;">🗑️ Delete All Photos</button>
      <button id="exportPhotosBtn" style="margin-left: 10px;">💾 Export Photos JSON</button>
    `;
    content.appendChild(tools);

    tools.querySelector("#deleteAllPhotosBtn").onclick = () => {
      if (confirm("Are you sure you want to delete all stored photos?")) {
        deleteAllPhotos();
        renderLocalStorageStatus();
      }
    };
    tools.querySelector("#exportPhotosBtn").onclick = exportAllPhotosAsJSON;
  }
}

document.getElementById("storageHeader").addEventListener("click", () => {
  const content = document.getElementById("storageContent");
  const header = document.getElementById("storageHeader");
  const isVisible = content.style.display !== "none";
  content.style.display = isVisible ? "none" : "block";
  header.textContent = isVisible ? "📦 localStorage Monitor ▲" : "📦 localStorage Monitor ▼";
});

setInterval(renderLocalStorageStatus, 1000);
renderLocalStorageStatus();

(function makeDraggable() {
  const panel = document.getElementById("localStorageStatus");
  const header = document.getElementById("storageHeader");

  let offsetX = 0, offsetY = 0, isDragging = false;

  function startDrag(x, y) {
    isDragging = true;
    offsetX = x - panel.offsetLeft;
    offsetY = y - panel.offsetTop;
    panel.classList.add("dragging");
    panel.style.transition = "none";
  }

  function onMove(x, y) {
    if (!isDragging) return;
    panel.style.left = `${x - offsetX}px`;
    panel.style.top = `${y - offsetY}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.position = "fixed";
  }

  function stopDrag() {
    isDragging = false;
    panel.classList.remove("dragging");
  }

  // Mouse events
  header.addEventListener("mousedown", e => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);
  });

  document.addEventListener("mousemove", e => {
    onMove(e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", stopDrag);

  // Touch events
  header.addEventListener("touchstart", e => {
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  });

  document.addEventListener("touchmove", e => {
    if (!isDragging) return;
    const touch = e.touches[0];
    onMove(touch.clientX, touch.clientY);
  }, { passive: false });

  document.addEventListener("touchend", stopDrag);
})();


// (function makeDraggable() {
//   const panel = document.getElementById("localStorageStatus");
//   const header = document.getElementById("storageHeader");

//   let offsetX = 0, offsetY = 0, isDragging = false;

//   header.addEventListener("mousedown", e => {
//     isDragging = true;
//     offsetX = e.clientX - panel.offsetLeft;
//     offsetY = e.clientY - panel.offsetTop;
//     panel.classList.add("dragging");
//     panel.style.transition = "none";
//   });

//   document.addEventListener("mouseup", () => {
//     isDragging = false;
//     panel.classList.remove("dragging");
//   });

//   document.addEventListener("mousemove", e => {
//     if (isDragging) {
//       panel.style.left = `${e.clientX - offsetX}px`;
//       panel.style.top = `${e.clientY - offsetY}px`;
//       panel.style.right = "auto";
//       panel.style.bottom = "auto";
//       panel.style.position = "fixed";
//     }
//   });
// })();

function getLocalStoragePhotos() {
  const photos = [];

  // 1. Check saved sessions
  try {
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.forEach(session => {
      if (!session.data) return;
      session.data.forEach(entry => {
        if (entry.type === "photo" && entry.content?.startsWith("data:image/")) {
          photos.push({
            sessionName: session.name || "Unnamed",
            timestamp: entry.timestamp,
            content: entry.content
          });
        }
      });
    });
  } catch (err) {
    console.warn("⚠️ Failed to read sessions:", err);
  }

  // 2. Check route_backup
  try {
    const backup = JSON.parse(localStorage.getItem("route_backup") || "{}");
    if (Array.isArray(backup.routeData)) {
      backup.routeData.forEach(entry => {
        if (entry.type === "photo" && entry.content?.startsWith("data:image/")) {
          photos.push({
            sessionName: "[Unsaved Backup]",
            timestamp: entry.timestamp,
            content: entry.content,
            isBackup: true
          });
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ Failed to read route_backup:", err);
  }

  return photos;
}
  
function showPhotoCleanupDialog() {
  const photos = getLocalStoragePhotos();

  if (photos.length === 0) {
    alert("📷 No stored photos found.");
    return;
  }

  // Prevent duplicates
  if (document.getElementById("photoCleanupOverlay")) return;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "photoCleanupOverlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  // Modal container
  const modal = document.createElement("div");
  modal.style.cssText = `
    background: white;
    width: 80%;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 20px;
    border-radius: 8px;
    position: relative;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    cursor: move;
  `;

  // Header
  const header = document.createElement("div");
  header.textContent = "🧹 Photo Cleanup";
  header.style.cssText = `
    font-weight: bold;
    margin-bottom: 10px;
    font-size: 18px;
    cursor: move;
  `;
  modal.appendChild(header);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖";
  closeBtn.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: crimson;
    color: white;
    border: none;
    padding: 5px 10px;
    cursor: pointer;
    font-weight: bold;
  `;
  closeBtn.onclick = () => overlay.remove();
  modal.appendChild(closeBtn);

  // Grid container for photos
  const container = document.createElement("div");
  container.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
  `;

  photos.forEach((photo, index) => {
    if (!photo.content || !photo.content.startsWith("data:image")) return;

    const img = document.createElement("img");
    img.src = photo.content;
    img.alt = `Photo ${index + 1}`;
    img.style.width = "100px";
    img.style.height = "100px";
    img.style.objectFit = "cover";
    img.style.border = "1px solid #ccc";
    img.style.borderRadius = "4px";

    const imgWrapper = document.createElement("div");
    imgWrapper.style.position = "relative";
    imgWrapper.style.display = "inline-block";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "🗑️";
    deleteBtn.style.cssText = `
      position: absolute;
      top: -5px;
      right: -5px;
      background: red;
      color: white;
      border: none;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      font-size: 14px;
      cursor: pointer;
    `;

    deleteBtn.onclick = () => {
      // Remove photo from routeData (sessions)
      const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    
      sessions.forEach(session => {
        if (!session.data || !Array.isArray(session.data)) return;
    
        session.data = session.data.filter(entry =>
          !(entry.type === "photo" && entry.timestamp === photo.timestamp && entry.content === photo.content)
        );
      });
    
      localStorage.setItem("sessions", JSON.stringify(sessions));
    
      // Also update route_backup if needed
      const backup = JSON.parse(localStorage.getItem("route_backup") || "{}");
      if (Array.isArray(backup.routeData)) {
        backup.routeData = backup.routeData.filter(entry =>
          !(entry.type === "photo" && entry.timestamp === photo.timestamp && entry.content === photo.content)
        );
        localStorage.setItem("route_backup", JSON.stringify(backup));
      }
    
      // Remove from UI
      imgWrapper.remove();
      renderLocalStorageStatus();
    };
    

    imgWrapper.appendChild(img);
    imgWrapper.appendChild(deleteBtn);
    container.appendChild(imgWrapper);
  });

  modal.appendChild(container);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // === Make Modal Draggable ===
  let isDragging = false, offsetX = 0, offsetY = 0;

  header.addEventListener("mousedown", e => {
    isDragging = true;
    offsetX = e.clientX - modal.offsetLeft;
    offsetY = e.clientY - modal.offsetTop;
    modal.style.transition = "none";
    e.preventDefault();
  });

  document.addEventListener("mouseup", () => isDragging = false);

  document.addEventListener("mousemove", e => {
    if (isDragging) {
      modal.style.position = "fixed";
      modal.style.left = `${e.clientX - offsetX}px`;
      modal.style.top = `${e.clientY - offsetY}px`;
    }
  });
}


window.triggerImport = () => {
  document.getElementById("importFile").click();
};

//  Import Routes
document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const ext = file.name.split(".").pop().toLowerCase();
  if (ext !== "json") {
    alert("Only JSON import is supported currently.");
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Invalid JSON structure");

    routeData = data;
    path = data.filter(e => e.type === "location").map(e => e.coords);

    for (const entry of routeData) {
      if (entry.type === "location" && entry.elevation == null) {
        entry.elevation = await getElevation(entry.coords.lat, entry.coords.lng);
      }
    }

    // Save imported session for re-export
    const sessions = JSON.parse(localStorage.getItem("sessions") || "[]");
    sessions.push({ name: "Imported Route", data: routeData });
    localStorage.setItem("sessions", JSON.stringify(sessions));

    initMap(() => {
      drawSavedRoutePath();
      showRouteDataOnMap();
      alert("✅ Route JSON imported and displayed.");
    });

  } catch (err) {
    console.error("❌ Failed to import route:", err);
    alert("⚠️ Failed to import route. Invalid format or corrupted data.");
  }
});

async function enrichRouteWithElevation(data) {
  const enriched = [];
  for (const entry of data) {
    if (entry.type === "location") {
      const elevation = await getElevation(entry.coords.lat, entry.coords.lng);
      enriched.push({
        ...entry,
        elevation
      });
    } else {
      enriched.push(entry);
    }
  }
  return enriched;
}
  
async function getElevation(lat, lng) {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;

  try {
    console.log(`🌍 Fetching elevation for [${lat}, ${lng}]`);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);

    const data = await res.json();

    // Correctly extract elevation from array
    if (Array.isArray(data.elevation) && data.elevation.length > 0) {
      const elevation = data.elevation[0];
      if (typeof elevation === "number") {
        console.log(`✅ Elevation for [${lat}, ${lng}]: ${elevation}m`);
        return elevation;
      } else {
        console.warn(`⚠️ Invalid elevation value type for [${lat}, ${lng}]`, data.elevation);
        return null;
      }
    } else {
      console.warn(`⚠️ Missing or malformed elevation data for [${lat}, ${lng}]`, data);
      return null;
    }

  } catch (err) {
    console.warn("⚠️ Failed to fetch elevation:", err);
    return null;
  }
}

async function generateElevationChartBase64(coordsWithElevation) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');

  const elevations = coordsWithElevation.map(p => p.elevation);
  const distances = coordsWithElevation.map(p => p.distance);

  const maxElevation = Math.max(...elevations);
  const minElevation = Math.min(...elevations);
  const maxDistance = Math.max(...distances);

  function getY(elev) {
    return canvas.height - ((elev - minElevation) / (maxElevation - minElevation)) * canvas.height;
  }

  function getX(dist) {
    return (dist / maxDistance) * canvas.width;
  }

  ctx.beginPath();
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  for (let i = 0; i < coordsWithElevation.length; i++) {
    const x = getX(distances[i]);
    const y = getY(elevations[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Highlight segments with steep gradient
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  for (let i = 1; i < coordsWithElevation.length; i++) {
    const g = coordsWithElevation[i].gradient;
    if (g >= 6) {
      ctx.beginPath();
      ctx.moveTo(getX(distances[i - 1]), getY(elevations[i - 1]));
      ctx.lineTo(getX(distances[i]), getY(elevations[i]));
      ctx.stroke();
    }
  }

  return canvas.toDataURL('image/png');
}

async function generateElevationChartPNG(route) {
  return new Promise(resolve => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 300;

    const ctx = canvas.getContext("2d");

    const labels = [];
    const data = [];
    let totalDistance = 0;

    const haversine = (a, b) => {
      const toRad = deg => deg * Math.PI / 180;
      const R = 6371;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
      const a_ = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1 - a_));
    };

    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const curr = route[i];
      if (prev.type === "location" && curr.type === "location" && curr.elevation != null) {
        totalDistance += haversine(prev.coords, curr.coords);
        labels.push(totalDistance.toFixed(2));
        data.push(curr.elevation);
      }
    }

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Elevation (m)",
          data,
          borderColor: "green",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { title: { display: true, text: "Distance (km)" } },
          y: { title: { display: true, text: "Elevation (m)" } }
        }
      }
    });

    setTimeout(() => {
      const base64 = canvas.toDataURL("image/png").split(",")[1];
      resolve(base64);
    }, 500); // Wait for Chart.js to render
  });
}

function haversineDistance(a, b) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const a_ = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1-a_));
}

async function generateElevationChartCanvas(route) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");

  await new Promise(resolve => {
    new Chart(ctx, {
      type: "line",
      data: {
        labels: route.map((_, i) => i),
        datasets: [{
          label: "Elevation (m)",
          data: route.map(e => e.elevation),
          borderColor: "green",
          fill: true,
          tension: 0.2
        }]
      },
      options: {
        animation: false,
        responsive: false
      },
      plugins: [{
        id: "onComplete",
        afterRender: chart => resolve()
      }]
    });
  });

  return canvas;
}
