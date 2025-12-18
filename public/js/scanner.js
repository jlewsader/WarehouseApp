console.log("scanner.js loaded");

// Camera scanner state
let codeReader = null;
let scannerMode = null; // 'search' or 'inbound'
let isScanning = false;
let videoStream = null;

/**
 * Open the camera scanner modal
 * @param {string} mode - 'search' or 'inbound' to determine which input to populate
 */
function openCameraScanner(mode) {
  scannerMode = mode;
  const modal = document.getElementById("camera-scanner-modal");
  const statusEl = document.getElementById("scanner-status");

  if (!modal) {
    console.error("Scanner modal not found");
    return;
  }

  modal.style.display = "flex";
  statusEl.textContent = "Initializing camera...";

  // Initialize scanner after modal is visible
  setTimeout(() => {
    initializeScanner();
  }, 100);
}

/**
 * Close the camera scanner modal and cleanup
 */
function closeCameraScanner() {
  const modal = document.getElementById("camera-scanner-modal");
  const statusEl = document.getElementById("scanner-status");

  if (codeReader && isScanning) {
    try {
      codeReader.reset();
      console.log("Scanner stopped");
    } catch (err) {
      console.error("Error stopping scanner:", err);
    }
    isScanning = false;
  }

  modal.style.display = "none";
  statusEl.textContent = "Position barcode within frame";
  
  // Clear video element
  const videoEl = document.getElementById("qr-reader");
  if (videoEl) {
    videoEl.innerHTML = '';
  }

  scannerMode = null;
}

/**
 * Initialize the ZXing barcode scanner
 */
function initializeScanner() {
  const statusEl = document.getElementById("scanner-status");
  const videoEl = document.getElementById("qr-reader");

  if (isScanning) {
    console.log("Scanner already running");
    return;
  }

  // Check if ZXing is available
  if (typeof ZXing === 'undefined') {
    console.error("ZXing library not loaded!");
    statusEl.textContent = "Scanner library not loaded. Please refresh the page.";
    return;
  }

  // Check if getUserMedia is supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.error("getUserMedia not supported");
    statusEl.innerHTML = "Camera not supported. <br>Using file upload instead:";
    showFileUploadFallback();
    return;
  }

  // Create video element for camera feed
  videoEl.innerHTML = '<video id="scanner-video" style="width: 100%; height: auto; max-height: 400px;"></video>';
  const video = document.getElementById('scanner-video');

  // Create ZXing code reader
  codeReader = new ZXing.BrowserMultiFormatReader();
  console.log("ZXing scanner created");

  statusEl.textContent = "Requesting camera access...";

  // Start decoding from video device
  codeReader.decodeFromVideoDevice(undefined, video, (result, err) => {
    if (result) {
      console.log("Barcode scanned:", result.text);
      statusEl.textContent = `Scanned: ${result.text}`;
      
      // Provide haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      // Handle the scanned barcode
      handleScannedBarcode(result.text);
      
      // Close scanner after short delay
      setTimeout(() => {
        closeCameraScanner();
      }, 500);
    }
    
    if (err && !(err instanceof ZXing.NotFoundException)) {
      console.error("Scan error:", err);
    }
  })
  .then(() => {
    isScanning = true;
    statusEl.textContent = "Position barcode within frame";
    console.log("ZXing scanner started successfully");
  })
  .catch((err) => {
    console.error("Unable to start scanner:", err);
    
    let errorMsg = "Camera error: ";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      errorMsg += "Permission denied. Please allow camera access.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      errorMsg += "No camera found.";
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      errorMsg += "Camera in use by another app.";
    } else {
      errorMsg += err.message || "Try file upload instead.";
    }
    
    statusEl.textContent = errorMsg;
    isScanning = false;
    showFileUploadFallback();
  });
}

/**
 * Show file upload fallback for scanning barcode from image
 */
function showFileUploadFallback() {
  const readerDiv = document.getElementById("qr-reader");
  if (!readerDiv) return;
  
  // Clear existing content
  readerDiv.innerHTML = '';
  
  // Create file input for image upload
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.capture = 'environment'; // Hint to use camera on mobile
  fileInput.style.cssText = 'display: block; margin: 20px auto; padding: 10px; font-size: 16px;';
  
  const label = document.createElement('div');
  label.style.cssText = 'text-align: center; color: white; padding: 20px; font-size: 14px;';
  label.textContent = 'Take a photo of the barcode:';
  
  readerDiv.appendChild(label);
  readerDiv.appendChild(fileInput);
  
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusEl = document.getElementById("scanner-status");
    statusEl.textContent = "Processing image...";
    
    if (typeof ZXing === 'undefined') {
      statusEl.textContent = "Scanner library not available.";
      return;
    }
    
    try {
      const reader = new ZXing.BrowserMultiFormatReader();
      const imageUrl = URL.createObjectURL(file);
      
      const result = await reader.decodeFromImageUrl(imageUrl);
      
      URL.revokeObjectURL(imageUrl);
      
      console.log("Barcode scanned from file:", result.text);
      statusEl.textContent = `Scanned: ${result.text}`;
      
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      handleScannedBarcode(result.text);
      
      setTimeout(() => {
        closeCameraScanner();
      }, 500);
    } catch (err) {
      console.error("Error scanning file:", err);
      statusEl.textContent = "Could not read barcode. Try a clearer, closer photo with good lighting.";
    }
  });
}

/**
 * Handle successful barcode scan
 * @param {string} decodedText - The scanned barcode text
 * @param {object} decodedResult - Full scan result object
 */
function onScanSuccess(decodedText, decodedResult) {
  console.log("Barcode scanned:", decodedText);
  console.log("Scan result:", decodedResult);

  // Provide haptic feedback if available
  if (navigator.vibrate) {
    navigator.vibrate(200);
  }

  // Update status
  const statusEl = document.getElementById("scanner-status");
  statusEl.textContent = `Scanned: ${decodedText}`;

  // Handle the scanned barcode based on mode
  handleScannedBarcode(decodedText);

  // Close scanner after short delay
  setTimeout(() => {
    closeCameraScanner();
  }, 500);
}

/**
 * Handle scan errors (usually just "not found" which we can ignore)
 * @param {string} errorMessage - Error message
 */
function onScanError(errorMessage) {
  // Don't log "not found" errors as they spam the console
  // Only log actual errors
  if (!errorMessage.includes("NotFoundException")) {
    console.warn("Scan error:", errorMessage);
  }
}

/**
 * Process the scanned barcode and populate appropriate input
 * @param {string} barcode - The scanned barcode text
 */
function handleScannedBarcode(barcode) {
  if (!barcode || !scannerMode) return;

  if (scannerMode === 'search') {
    // Update search barcode input
    const app = window.vueApp;
    if (app) {
      app.search.barcode = barcode;
      // Automatically parse the barcode
      setTimeout(() => {
        app.prefillFromBarcode();
      }, 100);
    }
  } else if (scannerMode === 'inbound') {
    // Update inbound scan barcode input
    const app = window.vueApp;
    if (app) {
      app.scan.barcode = barcode;
      // Automatically lookup the barcode
      setTimeout(() => {
        app.lookupInboundBarcode();
      }, 100);
    }
  }
}

// Make functions available globally
window.openCameraScanner = openCameraScanner;
window.closeCameraScanner = closeCameraScanner;
window.switchToFileUpload = switchToFileUpload;

/**
 * Switch from live camera to file upload mode
 */
function switchToFileUpload() {
  // Stop camera if running
  if (codeReader && isScanning) {
    try {
      codeReader.reset();
      isScanning = false;
    } catch (err) {
      console.error("Error stopping scanner:", err);
      isScanning = false;
    }
  }
  showFileUploadFallback();
}
