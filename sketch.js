let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: true, flipHorizontal: false };

let vidW = 640; 
let vidH = 480;
let showCamera = true;

// Drawing & Smoothing
let lerpSpeed = 0.2;   
let pg; // Internal Drawing Buffer locked to native resolution
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
let shapes = ['circle', 'square', 'triangle', 'star'];
let shapeIndex = 0;

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  // Setup main canvas to strictly match native video specs
  let cnv = createCanvas(vidW, vidH);
  cnv.parent('video-wrapper'); // Attached to the new wrapper

  // Setup internal, non-scaling buffer for pristine drawings
  pg = createGraphics(vidW, vidH);
  pg.clear();

  let constraints = { audio: false, video: { facingMode: "user" } };
  video = createCapture(constraints);
  video.parent('video-wrapper'); // Attached to the new wrapper
  video.elt.setAttribute('playsinline', '');

  video.elt.addEventListener('loadedmetadata', () => {
    // 1. Lock in the EXACT native resolution of the camera
    vidW = video.elt.videoWidth || 640;
    vidH = video.elt.videoHeight || 480;
    
    // 2. Resize internal canvas/buffer to match native specs
    resizeCanvas(vidW, vidH);
    pg.resizeCanvas(vidW, vidH);
    pg.clear();
    
    // 3. Stretch the wrapper visually so everything stays perfectly aligned
    calculateLayout();
    
    saveState();
    faceMesh.detectStart(video, gotFaces);
  });

  // UI Event Listeners
  document.getElementById('btn-undo').addEventListener('click', undoStroke);
  document.getElementById('btn-reset').addEventListener('click', () => {
    pg.clear(); undoStack = []; saveState();
  });
  document.getElementById('btn-download').addEventListener('click', () => { save(pg, 'My-Drawing.png'); });
  document.getElementById('btn-eraser').addEventListener('click', () => { isErasing = true; });

  document.getElementById('btn-toggle-cam').addEventListener('click', (e) => {
    showCamera = !showCamera;
    video.style('opacity', showCamera ? '1' : '0');
    e.target.style.opacity = showCamera ? '1' : '0.5';
  });

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

  // Record Setup
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

// Calculate the visual stretch size of the wrapper (Not internal canvas size)
function windowResized() {
  calculateLayout();
}

function calculateLayout() {
  if (vidW === 0 || vidH === 0) return;
  
  let container = document.getElementById('canvas-container');
  let wrapper = document.getElementById('video-wrapper');
  
  let availW = container.clientWidth;
  let availH = container.clientHeight;
  let aspect = vidW / vidH;
  
  let targetW = availW;
  let targetH = targetW / aspect;
  
  if (targetH > availH) {
    targetH = availH;
    targetW = targetH * aspect;
  }
  
  // Force the wrapper container to fit the screen exactly
  // The CSS handles stretching the canvas/video to match it
  wrapper.style.width = targetW + 'px';
  wrapper.style.height = targetH + 'px';
}

function draw() {
  clear(); // Keep main canvas transparent so video shows underneath

  if (faces.length > 0) {
    let face = faces[0];
    
    // Pure, unmodified coordinates
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

  // Tint over video for contrast
  if (showCamera) {
    fill(0, 0, 0, 80);
    rect(0, 0, vidW, vidH);
  }

  // Draw the internal drawing buffer naturally
  image(pg, 0, 0);

  // Draw the live cursors exactly where the tracking says
  if (faces.length > 0) {
    // Re-calculate mouth size purely for the cursor display
    let mouthSize = dist(faces[0].keypoints[13].x, faces[0].keypoints[13].y, faces[0].keypoints[14].x, faces[0].keypoints[14].y);

    fill(255, 0, 0); noStroke();
    circle(lerpNoseX, lerpNoseY, 8);

    push();
    translate(lerpNoseX, lerpNoseY);
    if (isErasing) {
      fill(255); noStroke(); circle(0, 0, 10);
    } else {
      drawShapePreview(0, 0, mouthSize); 
    }
    pop();
  }
  
  // UI Status
  fill(255); textSize(18); textAlign(LEFT, TOP);
  text(isDrawing ? "🟢 DRAWING" : "🔴 HOVERING", 10, 10);
  if (isRecording) { fill(255, 0, 0); text("REC", vidW - 50, 10); }
}

function stampShape(x, y, size) {
  let r = size / 2;
  let activeShape = shapes[shapeIndex];

  if (activeShape === 'circle') {
    pg.noStroke(); pg.circle(x, y, size);
  } else if (activeShape === 'square') {
    pg.noStroke(); pg.rectMode(CENTER); pg.rect(x, y, size, size); 
  } else if (activeShape === 'triangle') {
    pg.push(); pg.strokeJoin(MITER); pg.strokeWeight(size * 0.1); pg.stroke(currentColor); pg.fill(currentColor);
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
  } else if (activeShape === 'square') {
    noStroke(); rectMode(CENTER); rect(x, y, size, size);
  } else if (activeShape === 'triangle') {
    strokeJoin(MITER); strokeWeight(size * 0.1); stroke(currentColor);
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
  if (shapeButtons[shapeIndex]) {
    shapeButtons[shapeIndex].classList.add('active');
  }
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