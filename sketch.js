let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: true, flipHorizontal: false };

// Responsive Layout Variables
let mode = 'desktop'; 
let vidW = 640; // Native video widths (defaults)
let vidH = 480;
let panelW = 640; // Responsive rendered widths
let panelH = 480;
let showCamera = true;

// Drawing & Smoothing
let lerpSpeed = 0.2;   
let pg; // Internal Drawing Buffer (Locked to native video resolution)
let isDrawing = false;
let lerpNoseX = 0;
let lerpNoseY = 0;
let prevX, prevY;

// Tools
let currentColor = '#00FF00'; 
let isErasing = false;
let undoStack = [];

// Recording
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

// Shape Variables
let shapes = ['circle', 'rounded-square', 'rounded-triangle', 'star'];
let shapeIndex = 0;

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  let cnv = createCanvas(100, 100); // Temporary size, resized immediately
  cnv.parent('canvas-container');

  // Request standard constraints like your reference code
  let constraints = { video: { facingMode: "user" } };
  
  video = createCapture(constraints, function() {
    // Once video loads, extract its true aspect ratio & resolution
    vidW = video.elt.videoWidth || 640;
    vidH = video.elt.videoHeight || 480;
    
    // Create internal pristine buffer mapping directly to camera resolution
    pg = createGraphics(vidW, vidH);
    pg.clear();
    
    calculateLayout();
    saveState();
    faceMesh.detectStart(video, gotFaces);
  });
  video.hide();

  // Connect Buttons
  document.getElementById('btn-undo').addEventListener('click', undoStroke);
  document.getElementById('btn-reset').addEventListener('click', () => {
    pg.clear(); undoStack = []; saveState();
  });
  document.getElementById('btn-download').addEventListener('click', () => { save(pg, 'My-Drawing.png'); });
  document.getElementById('btn-eraser').addEventListener('click', () => { isErasing = true; });

  // Mobile Camera Toggle
  document.getElementById('btn-toggle-cam').addEventListener('click', (e) => {
    showCamera = !showCamera;
    e.target.style.opacity = showCamera ? '1' : '0.5';
  });

  // Shapes & Colors
  let shapeButtons = document.querySelectorAll('.shape-btn');
  shapeButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => { shapeIndex = index; updateShapeUI(); });
  });

  document.getElementById('color-picker').addEventListener('input', (e) => {
    isErasing = false; currentColor = e.target.value;
  });

  let colorButtons = document.querySelectorAll('.color-btn');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      isErasing = false; 
      currentColor = e.target.getAttribute('data-color'); 
      document.getElementById('color-picker').value = currentColor;
    });
  });

  // Record webm
  document.getElementById('btn-record').addEventListener('click', toggleRecord);
  let stream = document.querySelector('canvas').captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = function() {
    let blob = new Blob(recordedChunks, { type: 'video/webm' }); 
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'HandsFree-Drawing.webm'; 
    a.click();
    window.URL.revokeObjectURL(url);
    recordedChunks = [];
  };
}

// Dynamically scale mapping when browser size changes
function windowResized() {
  calculateLayout();
}

function calculateLayout() {
  if (vidW === 0 || vidH === 0) return;
  
  let aspect = vidH / vidW;
  let container = document.getElementById('canvas-container');
  let availW = container.clientWidth;
  let availH = container.clientHeight;

  if (windowWidth <= 800) {
    // MOBILE: Overlay
    mode = 'mobile';
    panelW = availW;
    panelH = panelW * aspect;
    if (panelH > availH) { panelH = availH; panelW = panelH / aspect; }
    resizeCanvas(panelW, panelH);
  } else if (windowWidth <= 1024) {
    // TABLET: Stacked Vertically
    mode = 'tablet';
    panelW = availW;
    panelH = panelW * aspect;
    if (panelH * 2 > availH) { panelH = availH / 2; panelW = panelH / aspect; }
    resizeCanvas(panelW, panelH * 2);
  } else {
    // DESKTOP: Side by Side
    mode = 'desktop';
    panelW = availW / 2;
    panelH = panelW * aspect;
    if (panelH > availH) { panelH = availH; panelW = panelH / aspect; }
    resizeCanvas(panelW * 2, panelH);
  }
}

function draw() {
  background(15); 

  // Process Coordinates against native video buffer
  if (faces.length > 0) {
    let face = faces[0];
    let mirroredNoseX = vidW - face.keypoints[1].x; 
    let noseY = face.keypoints[1].y;
    lerpNoseX = lerp(lerpNoseX, mirroredNoseX, lerpSpeed);
    lerpNoseY = lerp(lerpNoseY, noseY, lerpSpeed);

    let mouthSize = dist(face.keypoints[13].x, face.keypoints[13].y, face.keypoints[14].x, face.keypoints[14].y);

    if (isDrawing) {
      if (isErasing) {
        pg.erase(); pg.stroke(255); pg.strokeWeight(mouthSize * 1.5); 
        if (prevX !== undefined) pg.line(lerpNoseX, lerpNoseY, prevX, prevY);
        pg.noErase();
      } else {
        pg.noStroke(); pg.fill(currentColor);
        if (prevX !== undefined) {
          let d = dist(prevX, prevY, lerpNoseX, lerpNoseY);
          let steps = Math.max(1, d / (mouthSize / 4)); 
          for (let i = 0; i <= steps; i++) {
            let interX = lerp(prevX, lerpNoseX, i / steps);
            let interY = lerp(prevY, lerpNoseY, i / steps);
            stampShape(interX, interY, mouthSize);
          }
        }
      }
    }
    prevX = lerpNoseX;
    prevY = lerpNoseY;
  }

  // --- RENDER LAYOUT MATRICES ---
  if (mode === 'desktop') {
    // LEFT: Video
    push(); translate(panelW, 0); scale(-1, 1); image(video, 0, 0, panelW, panelH); pop();
    // RIGHT: Canvas
    fill(30); noStroke(); rect(panelW, 0, panelW, panelH); image(pg, panelW, 0, panelW, panelH);
    // Draw Cursors mapped to layout
    drawUIOverlay(0, 0); 
    renderLiveCursors(0, 0, panelW, 0); 

  } else if (mode === 'tablet') {
    // TOP: Video
    push(); translate(panelW, 0); scale(-1, 1); image(video, 0, 0, panelW, panelH); pop();
    // BOTTOM: Canvas
    fill(30); noStroke(); rect(0, panelH, panelW, panelH); image(pg, 0, panelH, panelW, panelH);
    // Draw Cursors
    drawUIOverlay(0, 0);
    renderLiveCursors(0, 0, 0, panelH);

  } else if (mode === 'mobile') {
    // OVERLAY: Video behind Canvas
    if (showCamera) {
      push(); translate(panelW, 0); scale(-1, 1); image(video, 0, 0, panelW, panelH); pop();
    } else {
      fill(30); noStroke(); rect(0, 0, panelW, panelH);
    }
    // Transparent layer to make canvas visible over feed
    fill(0, 0, 0, 50); noStroke(); rect(0, 0, panelW, panelH);
    image(pg, 0, 0, panelW, panelH);
    
    // Draw Cursors
    drawUIOverlay(0, 0);
    renderLiveCursors(0, 0, 0, 0); // No offset needed
  }
}

// Maps internal cursor locations to screen layout locations
function renderLiveCursors(vidOffsetX, vidOffsetY, canvasOffsetX, canvasOffsetY) {
  let scaleRatio = panelW / vidW;
  let screenX = lerpNoseX * scaleRatio;
  let screenY = lerpNoseY * scaleRatio;
  
  // Base Video Cursor (Red Dot)
  fill(255, 0, 0); noStroke();
  circle(screenX + vidOffsetX, screenY + vidOffsetY, 8);

  // Brush Preview Cursor
  push();
  translate(screenX + canvasOffsetX, screenY + canvasOffsetY);
  
  if (isErasing) {
    fill(255); noStroke(); circle(0, 0, 10);
  } else {
    // Scale shape visually for preview
    scale(scaleRatio); 
    drawShapePreview(0, 0, 20); 
  }
  pop();
}

function drawUIOverlay(x, y) {
  fill(255); textSize(14); textAlign(LEFT, TOP);
  if (isRecording) { fill(255, 0, 0); text("REC", panelW - 40, y + 10); }
}

function stampShape(x, y, size) {
  let r = size / 2;
  let activeShape = shapes[shapeIndex];

  if (activeShape === 'circle') {
    pg.noStroke(); pg.circle(x, y, size);
  } else if (activeShape === 'rounded-square') {
    pg.noStroke(); pg.rectMode(CENTER); pg.rect(x, y, size, size, size * 0.25); 
  } else if (activeShape === 'rounded-triangle') {
    pg.push(); pg.strokeJoin(ROUND); pg.strokeWeight(size * 0.3); pg.stroke(currentColor); pg.fill(currentColor);
    pg.triangle(x, y - r, x - r, y + r, x + r, y + r); pg.pop();
  } else if (activeShape === 'star') {
    pg.noStroke(); drawStar(pg, x, y, size * 0.25, size * 0.6, 5); 
  }
}

function drawShapePreview(x, y, size) {
  let r = size / 2;
  let activeShape = shapes[shapeIndex];
  
  fill(currentColor);
  if (activeShape === 'circle') {
    noStroke(); circle(x, y, size);
  } else if (activeShape === 'rounded-square') {
    noStroke(); rectMode(CENTER); rect(x, y, size, size, size * 0.25);
  } else if (activeShape === 'rounded-triangle') {
    strokeJoin(ROUND); strokeWeight(size * 0.3); stroke(currentColor);
    triangle(x, y - r, x - r, y + r, x + r, y + r);
  } else if (activeShape === 'star') {
    noStroke(); drawStar(window, x, y, size * 0.25, size * 0.6, 5); 
  }
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
  shapeButtons[shapeIndex].classList.add('active');
}

function gotFaces(results) { faces = results; }

function keyPressed() {
  if (key === ' ') {
    isDrawing = !isDrawing;
    if (isDrawing) { saveState(); prevX = undefined; }
  }
}

function saveState() {
  undoStack.push(pg.get());
  if (undoStack.length > 10) undoStack.shift(); 
}

function undoStroke() {
  if (undoStack.length > 0) {
    let lastState = undoStack.pop();
    pg.clear(); pg.image(lastState, 0, 0);
  } else { pg.clear(); }
}

function toggleRecord() {
  let btnRecord = document.getElementById('btn-record');
  if (!isRecording) {
    recordedChunks = []; mediaRecorder.start(); isRecording = true;
    btnRecord.innerText = '⬛ Stop Video'; btnRecord.classList.add('recording');
  } else {
    mediaRecorder.stop(); isRecording = false;
    btnRecord.innerText = '🔴 Record Video'; btnRecord.classList.remove('recording');
  }
}