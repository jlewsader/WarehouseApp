console.log("scanner.js loaded");

// Camera scanner state
let scannerMode = null; // 'search' or 'inbound'
let isScanning = false;

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

  isScanning = false;

  // Stop Quagga
  if (typeof Quagga !== 'undefined') {
    try {
      Quagga.stop();
      console.log("Quagga stopped");
    } catch (err) {
      console.error("Error stopping Quagga:", err);
    }
  }
  
  // Clear video element
  const videoEl = document.getElementById("qr-reader");
  if (videoEl) {
    videoEl.innerHTML = '<div class="scan-guide"></div>';
  }

  modal.style.display = "none";
  statusEl.textContent = "Position barcode within frame";

  scannerMode = null;
}

/**
 * Initialize Quagga barcode scanner (optimized for 1D barcodes)
 */
function initializeScanner() {
  const statusEl = document.getElementById("scanner-status");
  const videoEl = document.getElementById("qr-reader");

  if (isScanning) {
    console.log("Scanner already running");
    return;
  }

  // Check if Quagga is available
  if (typeof Quagga === 'undefined') {
    console.error("Quagga library not loaded!");
    statusEl.textContent = "Scanner library not loaded. Please refresh the page.";
    return;
  }

  statusEl.textContent = "Starting camera...";
  console.log("Initializing Quagga for Code 128");

  // Quagga configuration optimized for Code 128 on mobile
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: videoEl,
      constraints: {
        facingMode: "environment", // Rear camera
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    },
    decoder: {
      readers: ["code_128_reader"], // Only Code 128
      multiple: false
    },
    locate: true, // Enable locator for better detection
    locator: {
      patchSize: "medium",
      halfSample: true // Faster processing
    },
    numOfWorkers: 0, // Run in main thread for better iOS performance
    frequency: 20 // Scan 20 times per second for faster detection
  }, function(err) {
    if (err) {
      console.error("Quagga initialization error:", err);
      statusEl.textContent = "Camera error: " + err.message;
      showFileUploadFallback();
      return;
    }
    
    console.log("Quagga initialized successfully");
    Quagga.start();
    isScanning = true;
    statusEl.textContent = "Position barcode in view";
  });

  // Listen for barcode detection
  Quagga.onDetected(function(result) {
    const code = result.codeResult.code;
    console.log("Barcode detected:", code);
    statusEl.textContent = `Scanned: ${code}`;
    
    // Visual feedback
    const canvas = videoEl.querySelector('canvas');
    if (canvas) {
      canvas.style.border = "3px solid #22c55e";
      setTimeout(() => canvas.style.border = "", 200);
    }
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
    
    // Handle the barcode
    handleScannedBarcode(code);
    
    // Close scanner
    setTimeout(() => {
      closeCameraScanner();
    }, 500);
  });

  // Optional: Log processing info
  let processCount = 0;
  Quagga.onProcessed(function(result) {
    processCount++;
    if (processCount % 100 === 0) {
      console.log(`Processed ${processCount} frames`);
    }
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
    
    if (typeof Quagga === 'undefined') {
      statusEl.textContent = "Scanner library not available.";
      return;
    }
    
    try {
      const imageUrl = URL.createObjectURL(file);
      
      Quagga.decodeSingle({
        src: imageUrl,
        numOfWorkers: 0,
        decoder: {
          readers: ["code_128_reader"]
        }
      }, function(result) {
        URL.revokeObjectURL(imageUrl);
        
        if (result && result.codeResult) {
          console.log("Barcode scanned from file:", result.codeResult.code);
          statusEl.textContent = `Scanned: ${result.codeResult.code}`;
          
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
          
          handleScannedBarcode(result.codeResult.code);
          
          setTimeout(() => {
            closeCameraScanner();
          }, 500);
        } else {
          statusEl.textContent = "Could not read barcode. Try a clearer photo with good lighting.";
        }
      });
    } catch (err) {
      console.error("Error scanning file:", err);
      statusEl.textContent = "Could not read barcode. Try a clearer photo.";
    }
  });
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
  if (isScanning && typeof Quagga !== 'undefined') {
    try {
      Quagga.stop();
      isScanning = false;
    } catch (err) {
      console.error("Error stopping scanner:", err);
      isScanning = false;
    }
  }
  showFileUploadFallback();
}
