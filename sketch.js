let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: true, flipHorizontal: false };

// Drawing & Smoothing
let lerpSpeed = 0.2;   
let pg; 
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

// --- NEW SHAPE & BLINK VARIABLES ---
let shapes = ['circle', 'triangle', 'square'];
let shapeIndex = 0;
let isBlinking = false;
let blinkStartTime = 0;
let shapeChangedThisBlink = false;
const BLINK_THRESHOLD = 0.25; 

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  let cnv = createCanvas(1280, 480); 
  cnv.parent('canvas-container');

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  pg = createGraphics(640, 480);
  pg.clear();

  saveState();
  faceMesh.detectStart(video, gotFaces);

  // --- CONNECT HTML BUTTONS ---
  document.getElementById('btn-undo').addEventListener('click', undoStroke);
  
  // RESET BUTTON
  document.getElementById('btn-reset').addEventListener('click', () => {
    pg.clear();
    undoStack = [];
    saveState();
  });

  // DOWNLOAD BUTTON (Downloads as PNG)
  document.getElementById('btn-download').addEventListener('click', () => {
    save(pg, 'My-Drawing.png');
  });

  document.getElementById('btn-eraser').addEventListener('click', () => { isErasing = true; });

  // COLOR PICKER (RGB Spectrum)
  document.getElementById('color-picker').addEventListener('input', (e) => {
    isErasing = false;
    currentColor = e.target.value;
  });

  // STANDARD COLORS
  let colorButtons = document.querySelectorAll('.color-btn');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      isErasing = false; 
      currentColor = e.target.getAttribute('data-color'); 
      // Sync the color picker visual with the button pressed
      document.getElementById('color-picker').value = currentColor;
    });
  });

  document.getElementById('btn-record').addEventListener('click', toggleRecord);

  // --- MP4 RECORDING SETUP ---
  let stream = document.querySelector('canvas').captureStream(30);
  
  // Force H.264 codec for standard MP4 playback compatibility
  let recOptions = { mimeType: 'video/webm;codecs=h264' };
  if (!MediaRecorder.isTypeSupported(recOptions.mimeType)) {
    recOptions = { mimeType: 'video/webm' }; // Safe fallback if browser strictly refuses
  }
  
  mediaRecorder = new MediaRecorder(stream, recOptions);
  mediaRecorder.ondataavailable = function(e) {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  
  mediaRecorder.onstop = function() {
    let blob = new Blob(recordedChunks, { type: 'video/mp4' }); // Wrap in MP4 container
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'My-HandsFree-Drawing.mp4'; // Download as MP4
    a.click();
    window.URL.revokeObjectURL(url);
    recordedChunks = [];
  };
}

function draw() {
  background(15); 

  // LEFT SIDE: MIRRORED VIDEO
  push();
  translate(640, 0); 
  scale(-1, 1);      
  image(video, 0, 0, 640, 480);
  pop();

  // RIGHT SIDE: DRAWING CANVAS
  fill(30); 
  noStroke();
  rect(640, 0, 640, 480);
  image(pg, 640, 0);

  if (faces.length > 0) {
    let face = faces[0];

    // NOSE TRACKING
    let mirroredNoseX = 640 - face.keypoints[1].x; 
    let noseY = face.keypoints[1].y;
    lerpNoseX = lerp(lerpNoseX, mirroredNoseX, lerpSpeed);
    lerpNoseY = lerp(lerpNoseY, noseY, lerpSpeed);

    // MOUTH SIZE
    let mouthSize = dist(face.keypoints[13].x, face.keypoints[13].y, face.keypoints[14].x, face.keypoints[14].y);

    // --- NEW: LONG BLINK SHAPE CHANGING LOGIC ---
    let leftRatio = calculateEAR(face.keypoints, 33, 133, 160, 144, 158, 153);
    let rightRatio = calculateEAR(face.keypoints, 362, 263, 385, 380, 387, 373);
    let currentEyeRatio = Math.max(leftRatio, rightRatio);

    if (currentEyeRatio < BLINK_THRESHOLD) {
      if (!isBlinking) {
        isBlinking = true;
        blinkStartTime = millis(); 
      } else if (millis() - blinkStartTime > 1000 && !shapeChangedThisBlink) {
        // Blink held for 500ms! Change shape and lock it until eyes open.
        shapeIndex = (shapeIndex + 1) % shapes.length;
        shapeChangedThisBlink = true; 
      }
    } else {
      isBlinking = false;
      shapeChangedThisBlink = false; 
    }

    // --- CUSTOM BRUSH RENDERING ---
    if (isDrawing) {
      if (isErasing) {
        pg.erase(); 
        pg.strokeWeight(mouthSize * 1.5); 
        if (prevX !== undefined) {
          pg.line(lerpNoseX, lerpNoseY, prevX, prevY);
        }
        pg.noErase();
      } else {
        // Draw with shapes
        pg.noStroke();
        pg.fill(currentColor);
        
        if (prevX !== undefined) {
          // Calculate distance to fill in gaps between frames
          let d = dist(prevX, prevY, lerpNoseX, lerpNoseY);
          let steps = Math.max(1, d / (mouthSize / 4)); // Overlap stamps densely
          
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

    // --- VISUAL CURSORS ---
    fill(255, 0, 0);
    noStroke();
    circle(lerpNoseX, lerpNoseY, 8);
    
    // Draw current brush shape over the drawing side to act as a preview
    if (isErasing) {
      fill(255); 
      circle(640 + lerpNoseX, lerpNoseY, 8);
    } else {
      fill(currentColor);  
      push();
      translate(640, 0); // Shift rendering to right side
      // Quick temporary Graphics context equivalent for preview
      if (shapes[shapeIndex] === 'circle') circle(lerpNoseX, lerpNoseY, 15);
      else if (shapes[shapeIndex] === 'square') { rectMode(CENTER); rect(lerpNoseX, lerpNoseY, 15, 15); }
      else if (shapes[shapeIndex] === 'triangle') triangle(lerpNoseX, lerpNoseY-7, lerpNoseX-7, lerpNoseY+7, lerpNoseX+7, lerpNoseY+7);
      pop();
    }
  }

  // UI TEXT
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Press SPACEBAR to Start/Stop Drawing", 15, 15); 
  text(isDrawing ? "STATUS: 🟢 DRAWING" : "STATUS: 🔴 HOVERING", 15, 40);
  text("BRUSH: " + shapes[shapeIndex].toUpperCase() + " (Long blink to change)", 15, 65);
  
  if (isRecording) {
    fill(255, 0, 0);
    text("REC", 600, 15);
  }
}

// Helper to stamp the correct geometry onto the canvas
function stampShape(x, y, size) {
  let r = size / 2;
  if (shapes[shapeIndex] === 'circle') {
    pg.circle(x, y, size);
  } else if (shapes[shapeIndex] === 'square') {
    pg.rectMode(CENTER);
    pg.rect(x, y, size, size);
  } else if (shapes[shapeIndex] === 'triangle') {
    pg.triangle(x, y - r, x - r, y + r, x + r, y + r);
  }
}

// Refactored 6-Point EAR Math Function
function calculateEAR(kp, p1, p2, p3, p4, p5, p6) {
  let vert1 = dist(kp[p3].x, kp[p3].y, kp[p4].x, kp[p4].y);
  let vert2 = dist(kp[p5].x, kp[p5].y, kp[p6].x, kp[p6].y);
  let horiz = dist(kp[p1].x, kp[p1].y, kp[p2].x, kp[p2].y);
  return (vert1 + vert2) / (2 * horiz);
}

function gotFaces(results) {
  faces = results;
}

function keyPressed() {
  if (key === ' ') {
    isDrawing = !isDrawing;
    if (isDrawing) {
      saveState();
      prevX = undefined; 
    }
  }
}

function saveState() {
  undoStack.push(pg.get());
  if (undoStack.length > 10) undoStack.shift(); 
}

function undoStroke() {
  if (undoStack.length > 0) {
    let lastState = undoStack.pop();
    pg.clear();
    pg.image(lastState, 0, 0);
  } else {
    pg.clear(); 
  }
}

function toggleRecord() {
  let btnRecord = document.getElementById('btn-record');
  
  if (!isRecording) {
    recordedChunks = [];
    mediaRecorder.start();
    isRecording = true;
    btnRecord.innerText = 'Stop & Save Video';
    btnRecord.classList.add('recording');
  } else {
    mediaRecorder.stop();
    isRecording = false;
    btnRecord.innerText = 'Record Video';
    btnRecord.classList.remove('recording');
  }
}