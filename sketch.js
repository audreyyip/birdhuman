let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: true, flipHorizontal: false };

let vidW = 640; 
let vidH = 480;
let showCamera = true;

let lerpSpeed = 0.2;   
let pg; 
let isDrawing = false;
let myCanvas;
let isMobile = false; 

// NEW: Threshold and Stroke State Trackers
let mouthThreshold = 2; // Stops painting if the mouth opening is smaller than 4px
let isMouthOpen = false; 

let activePoints = { leftEye: false, rightEye: false, nose: true, mouth: false };
let currentPoints = {
  leftEye: { x: undefined, y: undefined, prevX: undefined, prevY: undefined },
  rightEye: { x: undefined, y: undefined, prevX: undefined, prevY: undefined },
  nose: { x: undefined, y: undefined, prevX: undefined, prevY: undefined },
  mouth: { x: undefined, y: undefined, prevX: undefined, prevY: undefined }
};

let currentColor = '#00FF00'; 
let isErasing = false;
let undoStack = [];
let shapes = ['circle', 'square', 'triangle', 'star'];
let shapeIndex = 0;

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  isMobile = window.innerWidth <= 1024 || /Mobi|Android/i.test(navigator.userAgent);
  let videoConstraints = { facingMode: "user" };

  if (isMobile) {
    videoConstraints.width = { ideal: 480 };
    videoConstraints.height = { ideal: 640 };
  }

  myCanvas = createCanvas(vidW, vidH);
  myCanvas.parent('video-wrapper'); 

  myCanvas.elt.addEventListener('pointerdown', (e) => {
    if (isMobile) { e.preventDefault(); toggleDrawing(); }
  });

  pg = createGraphics(vidW, vidH);
  pg.clear();

  let constraints = { audio: false, video: videoConstraints };
  video = createCapture(constraints);
  video.parent('video-wrapper'); 
  video.elt.setAttribute('playsinline', '');
  video.elt.setAttribute('autoplay', '');
  video.elt.muted = true; // CRITICAL: Fixes mobile browsers blocking the camera
  
  video.elt.addEventListener('loadedmetadata', () => {
    vidW = video.elt.videoWidth || 640;
    vidH = video.elt.videoHeight || 480;
    resizeCanvas(vidW, vidH);
    pg.resizeCanvas(vidW, vidH);
    pg.clear();
    calculateLayout();
    saveState();
    faceMesh.detectStart(video, gotFaces);
  });

  window.addEventListener('keydown', function(e) {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault(); 
      if (document.activeElement) document.activeElement.blur(); 
      toggleDrawing();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undoStroke(); }
  }, { passive: false });

  document.getElementById('btn-shapes-toggle').addEventListener('click', () => { document.getElementById('shapes-panel').classList.toggle('hidden'); });
  document.getElementById('btn-colors-toggle').addEventListener('click', () => { document.getElementById('colors-panel').classList.toggle('hidden'); });
  document.getElementById('btn-custom-color').addEventListener('click', () => { document.getElementById('color-picker').click(); });

  // --- FIX: FACE WIDGET LOGIC ---
  // 1. Target the actual window, not the button wrapper!
  let faceWindow = document.getElementById('face-widget-window'); 
  let toggleBtn = document.getElementById('face-widget-toggle');
  let closeBtn = document.getElementById('face-widget-close');

  // 2. Logic to OPEN the window (Prevents bouncing to the top)
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault(); 
    faceWindow.classList.remove('hidden'); 
  });

  // 3. Logic to CLOSE the window (Stops drag events from firing)
  closeBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  closeBtn.addEventListener('touchstart', (e) => e.stopPropagation());
  closeBtn.addEventListener('click', (e) => { 
    e.stopPropagation(); 
    faceWindow.classList.add('hidden');
  });
  
  // 4. Attach drag behavior to the window
  dragElement(faceWindow);
  // -----------------------------

  let facePointsUI = document.querySelectorAll('.face-point');
  facePointsUI.forEach(btn => {
    btn.addEventListener('click', (e) => {
      let pointName = btn.getAttribute('data-point');
      activePoints[pointName] = !activePoints[pointName]; 
      if (activePoints[pointName]) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
        currentPoints[pointName].x = undefined; currentPoints[pointName].y = undefined;
        currentPoints[pointName].prevX = undefined; currentPoints[pointName].prevY = undefined;
      }
    });
  });

  document.getElementById('btn-undo').addEventListener('click', undoStroke);
  document.getElementById('btn-reset').addEventListener('click', () => { pg.clear(); undoStack = []; saveState(); });
  document.getElementById('btn-download').addEventListener('click', downloadArtResponsive);
  document.getElementById('btn-eraser').addEventListener('click', () => { isErasing = !isErasing; });
  document.getElementById('btn-selfie').addEventListener('click', takeSelfie);
  document.getElementById('btn-toggle-cam').addEventListener('click', (e) => { showCamera = !showCamera; });

  let shapeButtons = document.querySelectorAll('.shape-btn');
  shapeButtons.forEach((btn) => {
    btn.addEventListener('click', () => { shapeIndex = shapes.indexOf(btn.getAttribute('data-shape')); updateShapeUI(); });
  });

  document.getElementById('color-picker').addEventListener('input', (e) => { isErasing = false; currentColor = e.target.value; });
  let colorButtons = document.querySelectorAll('.color-btn');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      isErasing = false; 
      currentColor = e.target.getAttribute('data-color'); 
      document.getElementById('color-picker').value = currentColor;
    });
  });
}

// --- DRAG WIDGET FUNCTIONALITY ---
function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  // Attach drag event to the header if it exists, otherwise to the whole window
  let header = document.getElementById(elmnt.id + "-header");
  if (header) {
    header.onmousedown = dragMouseDown;
    header.ontouchstart = dragTouchStart;
  } else {
    elmnt.onmousedown = dragMouseDown;
    elmnt.ontouchstart = dragTouchStart;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    
    // Lock in the current screen position before breaking the anchors
    let rect = elmnt.getBoundingClientRect();
    elmnt.style.top = rect.top + "px";
    elmnt.style.left = rect.left + "px";
    elmnt.style.bottom = 'auto'; 
    elmnt.style.right = 'auto'; 
  }

  function dragTouchStart(e) {
    e = e || window.event;
    pos3 = e.touches[0].clientX;
    pos4 = e.touches[0].clientY;
    document.ontouchend = closeDragElement;
    document.ontouchmove = elementTouchDrag;
    
    // Lock in the current screen position for mobile touches too
    let rect = elmnt.getBoundingClientRect();
    elmnt.style.top = rect.top + "px";
    elmnt.style.left = rect.left + "px";
    elmnt.style.bottom = 'auto'; 
    elmnt.style.right = 'auto'; 
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function elementTouchDrag(e) {
    e = e || window.event;
    pos1 = pos3 - e.touches[0].clientX;
    pos2 = pos4 - e.touches[0].clientY;
    pos3 = e.touches[0].clientX;
    pos4 = e.touches[0].clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    document.ontouchend = null;
    document.ontouchmove = null;
  }
}

function windowResized() { calculateLayout(); }

function calculateLayout() {
  let container = document.getElementById('canvas-container');
  let wrapper = document.getElementById('video-wrapper');
  wrapper.style.width = container.clientWidth + 'px'; wrapper.style.height = container.clientHeight + 'px';
}

function draw() {
  clear(); // Makes canvas transparent so the native HTML video shows through
  
  // If camera is toggled "off", draw a black box on the canvas to cover the video beneath
  if (!showCamera) {
    fill(0);
    rect(0, 0, vidW, vidH);
  }

  if (!isDrawing) {
    fill(0, 0, 0, 150);
    rect(0, 0, vidW, vidH);
  }

  if (faces.length > 0) {
    let face = faces[0];
    let mouthSize = dist(face.keypoints[13].x, face.keypoints[13].y, face.keypoints[14].x, face.keypoints[14].y);
    
    let currentMouthOpen = mouthSize > mouthThreshold;

    if (isDrawing) {
      if (currentMouthOpen && !isMouthOpen) {
        saveState(); 
      }
      isMouthOpen = currentMouthOpen;
    }

    let rawPts = {
      nose: face.keypoints[1], 
      leftEye: face.keypoints[159], 
      rightEye: face.keypoints[386],
      mouth: { x: (face.keypoints[13].x + face.keypoints[14].x) / 2, y: (face.keypoints[13].y + face.keypoints[14].y) / 2 }
    };

    for (let key in currentPoints) {
      if (activePoints[key]) {
        let mirroredX = vidW - rawPts[key].x;
        let targetY = rawPts[key].y;

        if (currentPoints[key].x === undefined) {
          currentPoints[key].x = mirroredX; currentPoints[key].y = targetY;
        } else {
          currentPoints[key].x = lerp(currentPoints[key].x, mirroredX, lerpSpeed);
          currentPoints[key].y = lerp(currentPoints[key].y, targetY, lerpSpeed);
        }

        let shouldPaint = isDrawing && currentMouthOpen;

        if (shouldPaint) {
          let cx = currentPoints[key].x, cy = currentPoints[key].y;
          let px = currentPoints[key].prevX, py = currentPoints[key].prevY;

          if (isErasing) {
            pg.erase(); pg.stroke(255); pg.strokeWeight(mouthSize * 2); 
            if (px !== undefined) pg.line(cx, cy, px, py);
            pg.noErase();
          } else {
            pg.noStroke(); pg.fill(currentColor);
            if (px !== undefined) {
              let d = dist(px, py, cx, cy);
              let steps = Math.max(1, d / 2); 
              for (let i = 0; i <= steps; i++) {
                let interX = lerp(px, cx, i / steps);
                let interY = lerp(py, cy, i / steps);
                stampShape(interX, interY, mouthSize);
              }
            }
          }
        }
        
        if (shouldPaint) {
          currentPoints[key].prevX = currentPoints[key].x;
          currentPoints[key].prevY = currentPoints[key].y;
        } else {
          currentPoints[key].prevX = undefined;
          currentPoints[key].prevY = undefined;
        }
      }
    }
  }

  image(pg, 0, 0);

  if (faces.length > 0) {
    let mouthSize = dist(faces[0].keypoints[13].x, faces[0].keypoints[13].y, faces[0].keypoints[14].x, faces[0].keypoints[14].y);
    let previewSize = Math.max(mouthSize, 5); 

    for (let key in currentPoints) {
      if (activePoints[key] && currentPoints[key].x !== undefined) {
        push();
        translate(currentPoints[key].x, currentPoints[key].y);
        if (isErasing) {
          noFill(); stroke(255); strokeWeight(2); circle(0, 0, previewSize * 2);
        } else {
          drawShapePreview(0, 0, previewSize); 
        }
        pop();
      }
    }
  }
}

function stampShape(x, y, size) {
  let r = size / 2;
  let activeShape = shapes[shapeIndex];
  if (activeShape === 'circle') { pg.circle(x, y, size); } 
  else if (activeShape === 'square') { pg.rectMode(CENTER); pg.rect(x, y, size, size); } 
  else if (activeShape === 'triangle') { pg.triangle(x, y - r, x - r, y + r, x + r, y + r); } 
  else if (activeShape === 'star') { drawStar(pg, x, y, size * 0.25, size * 0.6, 5); }
}

function drawShapePreview(x, y, size) {
  let r = size / 2;
  let activeShape = shapes[shapeIndex];
  fill(currentColor); noStroke();
  if (activeShape === 'circle') { circle(x, y, size); } 
  else if (activeShape === 'square') { rectMode(CENTER); rect(x, y, size, size); } 
  else if (activeShape === 'triangle') { triangle(x, y - r, x - r, y + r, x + r, y + r); } 
  else if (activeShape === 'star') { drawStar(window._p5 || this, x, y, size * 0.25, size * 0.6, 5); }
}

function drawStar(ctx, x, y, radius1, radius2, npoints) {
  let angle = TWO_PI / npoints;
  let halfAngle = angle / 2.0;
  ctx.beginShape();
  for (let a = -PI / 2; a < TWO_PI - PI / 2; a += angle) {
    let sx = x + cos(a) * radius2; let sy = y + sin(a) * radius2; ctx.vertex(sx, sy);
    sx = x + cos(a + halfAngle) * radius1; sy = y + sin(a + halfAngle) * radius1; ctx.vertex(sx, sy);
  }
  ctx.endShape(CLOSE);
}

function updateShapeUI() {
  let shapeButtons = document.querySelectorAll('.shape-btn');
  shapeButtons.forEach(btn => btn.classList.remove('active'));
  if (shapeButtons[shapeIndex]) { shapeButtons[shapeIndex].classList.add('active'); }
}

function gotFaces(results) { faces = results; }

function toggleDrawing() {
  isDrawing = !isDrawing;
  let intro = document.getElementById('intro-overlay');
  if (intro) intro.style.display = 'none';

  let statusText = document.getElementById('status-indicator');
  if (statusText) statusText.innerText = isDrawing ? "DRAWING" : "HOVERING";
  
  if (isDrawing) { 
    isMouthOpen = false;
    for (let key in currentPoints) {
      currentPoints[key].prevX = undefined;
      currentPoints[key].prevY = undefined;
    }
  }
}

function saveState() { undoStack.push(pg.get()); if (undoStack.length > 15) undoStack.shift(); }
function undoStroke() { if (undoStack.length > 0) { let lastState = undoStack.pop(); pg.clear(); pg.image(lastState, 0, 0); } }

// --- RESPONSIVE DOWNLOAD FUNCTIONS ---
function getScaledCanvas(sourceCanvas, includeVideo = false) {
  let snap = createGraphics(windowWidth, windowHeight);
  let scale = Math.max(windowWidth / width, windowHeight / height);
  let newW = width * scale;
  let newH = height * scale;
  let x = (windowWidth - newW) / 2;
  let y = (windowHeight - newH) / 2;
  
  // If taking a selfie, explicitly stamp the video layer down first
  if (includeVideo && showCamera) {
    snap.push();
    snap.translate(windowWidth, 0);
    snap.scale(-1, 1);
    snap.image(video, x, y, newW, newH); 
    snap.pop();
  } else if (!showCamera && includeVideo) {
    snap.background(0); // Add black background if camera is off
  }
  
  // Stamp the art layer on top
  snap.image(sourceCanvas, x, y, newW, newH);
  return snap;
}

function takeSelfie() { 
  let snap = getScaledCanvas(myCanvas, true); // true = include video layer
  save(snap, 'POLLOCK-SELFIE.png'); 
  snap.remove();
}

function downloadArtResponsive() {
  let snap = getScaledCanvas(pg, false); // false = art only
  save(snap, 'POLLOCK-ART.png');
  snap.remove();
}