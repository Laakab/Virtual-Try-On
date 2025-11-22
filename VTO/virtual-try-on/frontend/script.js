const video = document.getElementById('webcam');
const canvas = document.getElementById('output-canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('file-input');
const productList = document.getElementById('product-list');
const loading = document.getElementById('loading');

let currentStream = null;
let currentImage = null; // Image object
let isCameraActive = false;

// Multi-Asset State
let overlays = []; // Array of overlay objects
let selectedOverlayIndex = -1;

// Interaction State
let isDragging = false;
let isResizing = false;
let isRotating = false;
let lastMouseX = 0;
let lastMouseY = 0;

const API_URL = 'http://localhost:8000';

// Initialize
async function init() {
    loadProducts();
    setupEventListeners();
    setupCanvasInteractions();
    requestAnimationFrame(renderLoop);
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();

        productList.innerHTML = '';
        products.forEach(product => {
            const div = document.createElement('div');
            div.className = 'product-card';
            div.onclick = () => addProduct(product);

            const img = document.createElement('img');
            // Use Backend URL for images to avoid Tainted Canvas (CORS)
            img.src = `${API_URL}${product.image}`;
            img.crossOrigin = "Anonymous";

            const name = document.createElement('div');
            name.innerText = product.name;

            div.appendChild(img);
            div.appendChild(name);
            productList.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to load products", err);
        productList.innerHTML = '<p>Make sure backend is running!</p>';
    }
}

function setupEventListeners() {
    document.getElementById('btn-camera').onclick = startCamera;
    document.getElementById('btn-upload').onclick = () => fileInput.click();
    fileInput.onchange = handleFileUpload;
    document.getElementById('btn-download').onclick = downloadImage;
    document.getElementById('btn-delete').onclick = deleteSelectedOverlay;

    // Keyboard support for delete
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedOverlay();
        }
    });
}

function setupCanvasInteractions() {
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);

    // Touch support
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleMouseUp);
}

// --- Camera & Image Handling ---

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        currentStream = stream;
        isCameraActive = true;

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
        };
    } catch (err) {
        console.error("Camera error", err);
        alert("Could not access camera");
    }
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            isCameraActive = false;
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }

            canvas.width = img.width;
            canvas.height = img.height;
            currentImage = img;

            overlays = [];
            selectedOverlayIndex = -1;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function addProduct(product) {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Important for CORS
    img.onload = () => {
        const newOverlay = {
            id: Date.now(), // Unique ID
            productId: product.id,
            image: img,
            x: canvas.width / 2,
            y: canvas.height / 2,
            width: 150,
            height: 150 * (img.height / img.width),
            rotation: 0
        };

        overlays.push(newOverlay);
        selectedOverlayIndex = overlays.length - 1; // Select the new item

        // Try to auto-place
        if (currentImage) {
            autoPlaceOverlay(currentImage, newOverlay);
        }
    };
    img.src = `${API_URL}${product.image}`;
}

function deleteSelectedOverlay() {
    if (selectedOverlayIndex !== -1) {
        overlays.splice(selectedOverlayIndex, 1);
        selectedOverlayIndex = -1;
    } else {
        alert("Please select an item to delete.");
    }
}

async function autoPlaceOverlay(imageSource, overlay) {
    loading.classList.remove('hidden');

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(imageSource, 0, 0, canvas.width, canvas.height);

    tempCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('file', blob);

        try {
            const response = await fetch(`${API_URL}/detect_landmarks`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.landmarks) {
                updateOverlayFromLandmarks(data.landmarks, overlay);
            }
        } catch (err) {
            console.error("Landmark detection failed", err);
        } finally {
            loading.classList.add('hidden');
        }
    }, 'image/jpeg');
}

function updateOverlayFromLandmarks(landmarks, overlay) {
    let type = 'sunglasses';
    if (overlay.productId.includes('hat')) type = 'hat';
    if (overlay.productId.includes('coat')) type = 'coat';

    if (type === 'sunglasses') {
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];

        const dx = rightEye.x - leftEye.x;
        const dy = rightEye.y - leftEye.y;
        const angle = Math.atan2(dy, dx);
        const width = Math.sqrt(dx * dx + dy * dy) * 2.5;
        const centerX = (leftEye.x + rightEye.x) / 2;
        const centerY = (leftEye.y + rightEye.y) / 2;

        overlay.width = width;
        overlay.height = width * (overlay.image.height / overlay.image.width);
        overlay.x = centerX;
        overlay.y = centerY;
        overlay.rotation = angle;

    } else if (type === 'hat') {
        const forehead = landmarks[10];
        const chin = landmarks[152];
        const faceHeight = Math.sqrt(Math.pow(chin.x - forehead.x, 2) + Math.pow(chin.y - forehead.y, 2));

        overlay.width = faceHeight * 1.5;
        overlay.height = overlay.width * (overlay.image.height / overlay.image.width);
        overlay.x = forehead.x;
        overlay.y = forehead.y - overlay.height * 0.5;
        overlay.rotation = 0;

    } else if (type === 'coat') {
        const chin = landmarks[152];
        const leftFace = landmarks[234];
        const rightFace = landmarks[454];
        const faceWidth = Math.sqrt(Math.pow(rightFace.x - leftFace.x, 2) + Math.pow(rightFace.y - leftFace.y, 2));

        overlay.width = faceWidth * 4.0;
        overlay.height = overlay.width * (overlay.image.height / overlay.image.width);
        overlay.x = chin.x;
        overlay.y = chin.y + faceWidth * 0.8;
        overlay.rotation = 0;
    }
}

// --- Rendering Loop ---

function renderLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background
    if (isCameraActive) {
        ctx.save();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else if (currentImage) {
        ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    }

    // Draw Overlays
    overlays.forEach((overlay, index) => {
        ctx.save();
        ctx.translate(overlay.x, overlay.y);
        ctx.rotate(overlay.rotation);
        ctx.drawImage(
            overlay.image,
            -overlay.width / 2,
            -overlay.height / 2,
            overlay.width,
            overlay.height
        );

        // Draw controls if selected
        if (index === selectedOverlayIndex) {
            drawControls(ctx, overlay);
        }

        ctx.restore();
    });

    requestAnimationFrame(renderLoop);
}

function drawControls(ctx, overlay) {
    const w = overlay.width;
    const h = overlay.height;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Resize handle (bottom-right)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Rotate handle (top-center stick)
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(0, -h / 2 - 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -h / 2 - 20, 6, 0, Math.PI * 2);
    ctx.fill();
}

// --- Interactions ---

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = evt.clientX;
    let clientY = evt.clientY;

    if (evt.touches && evt.touches.length > 0) {
        clientX = evt.touches[0].clientX;
        clientY = evt.touches[0].clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function handleMouseDown(e) {
    const pos = getMousePos(e);
    lastMouseX = pos.x;
    lastMouseY = pos.y;

    // Check if hitting controls of SELECTED overlay first
    if (selectedOverlayIndex !== -1) {
        const overlay = overlays[selectedOverlayIndex];
        if (checkControlsHit(pos, overlay)) return;
    }

    // Check if hitting ANY overlay body (select it)
    // Iterate backwards to select top-most
    for (let i = overlays.length - 1; i >= 0; i--) {
        const overlay = overlays[i];
        if (checkBodyHit(pos, overlay)) {
            selectedOverlayIndex = i;
            isDragging = true;
            return;
        }
    }

    // Clicked empty space
    selectedOverlayIndex = -1;
}

function checkControlsHit(pos, overlay) {
    // Inverse transform
    const dx = pos.x - overlay.x;
    const dy = pos.y - overlay.y;
    const cos = Math.cos(-overlay.rotation);
    const sin = Math.sin(-overlay.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const w = overlay.width;
    const h = overlay.height;

    // Rotate Handle
    if (Math.abs(localX - 0) < 15 && Math.abs(localY - (-h / 2 - 20)) < 15) {
        isRotating = true;
        return true;
    }

    // Resize Handle
    if (Math.abs(localX - w / 2) < 15 && Math.abs(localY - h / 2) < 15) {
        isResizing = true;
        return true;
    }

    return false;
}

function checkBodyHit(pos, overlay) {
    const dx = pos.x - overlay.x;
    const dy = pos.y - overlay.y;
    const cos = Math.cos(-overlay.rotation);
    const sin = Math.sin(-overlay.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const w = overlay.width;
    const h = overlay.height;

    return (localX > -w / 2 && localX < w / 2 && localY > -h / 2 && localY < h / 2);
}

function handleMouseMove(e) {
    const pos = getMousePos(e);

    if (selectedOverlayIndex === -1) return;
    const overlay = overlays[selectedOverlayIndex];

    if (isDragging) {
        const dx = pos.x - lastMouseX;
        const dy = pos.y - lastMouseY;
        overlay.x += dx;
        overlay.y += dy;
    } else if (isResizing) {
        const dx = pos.x - overlay.x;
        const dy = pos.y - overlay.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const currentHalfDiag = Math.sqrt(Math.pow(overlay.width / 2, 2) + Math.pow(overlay.height / 2, 2));
        const scale = dist / currentHalfDiag;

        overlay.width *= scale;
        overlay.height *= scale;

    } else if (isRotating) {
        const dx = pos.x - overlay.x;
        const dy = pos.y - overlay.y;
        overlay.rotation = Math.atan2(dy, dx) + Math.PI / 2;
    }

    lastMouseX = pos.x;
    lastMouseY = pos.y;
}

function handleMouseUp(e) {
    isDragging = false;
    isResizing = false;
    isRotating = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    handleMouseDown(e);
}

function handleTouchMove(e) {
    e.preventDefault();
    handleMouseMove(e);
}

function downloadImage() {
    const link = document.createElement('a');
    link.download = 'try-on-result.png';
    link.href = canvas.toDataURL();
    link.click();
}

init();
