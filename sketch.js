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

// Shape Variables
let shapes = ['circle', 'rounded-square', 'rounded-triangle', 'star'];
let shapeIndex = 0;

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

  // Connect Core Buttons
  document.getElementById('btn-undo').addEventListener('click', undoStroke);
  document.getElementById('btn-reset').addEventListener('click', () => {
    pg.clear();
    undoStack = [];
    saveState();
  });
  document.getElementById('btn-download').addEventListener('click', () => { save(pg, 'My-Drawing.png'); });
  document.getElementById('btn-eraser').addEventListener('click', () => { isErasing = true; });

  // Connect Shape UI Buttons
  let shapeButtons = document.querySelectorAll('.shape-btn');
  shapeButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      shapeIndex = index;
      updateShapeUI();
    });
  });

  // Color Pickers
  document.getElementById('color-picker').addEventListener('input', (e) => {
    isErasing = false;
    currentColor = e.target.value;
  });

  let colorButtons = document.querySelectorAll('.color-btn');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      isErasing = false; 
      currentColor = e.target.getAttribute('data-color'); 
      document.getElementById('color-picker').value = currentColor;
    });
  });

  // Recording Setup (WebM)
  document.getElementById('btn-record').addEventListener('click', toggleRecord);
  let stream = document.querySelector('canvas').captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = function() {
    let blob = new Blob(recordedChunks, { type: 'video/webm' }); 
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'My-HandsFree-Drawing.webm'; 
    a.click();
    window.URL.revokeObjectURL(url);
    recordedChunks = [];
  };
}

function draw() {
  background(15); 

  // LEFT SIDE
  push();
  translate(640, 0); 
  scale(-1, 1);      
  image(video, 0, 0, 640, 480);
  pop();

  // RIGHT SIDE
  fill(30); 
  noStroke();
  rect(640, 0, 640, 480);
  image(pg, 640, 0);

  if (faces.length > 0) {
    let face = faces[0];

    // Nose Position
    let mirroredNoseX = 640 - face.keypoints[1].x; 
    let noseY = face.keypoints[1].y;
    lerpNoseX = lerp(lerpNoseX, mirroredNoseX, lerpSpeed);
    lerpNoseY = lerp(lerpNoseY, noseY, lerpSpeed);

    // Mouth Size
    let mouthSize = dist(face.keypoints[13].x, face.keypoints[13].y, face.keypoints[14].x, face.keypoints[14].y);

    // DRAWING LOGIC
    if (isDrawing) {
      if (isErasing) {
        pg.erase(); 
        pg.stroke(255); 
        pg.strokeWeight(mouthSize * 1.5); 
        if (prevX !== undefined) {
          pg.line(lerpNoseX, lerpNoseY, prevX, prevY);
        }
        pg.noErase();
      } else {
        pg.noStroke(); 
        pg.fill(currentColor);
        
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

    // Cursors
    fill(255, 0, 0);
    noStroke();
    circle(lerpNoseX, lerpNoseY, 8); 
    
    if (isErasing) {
      fill(255); 
      circle(640 + lerpNoseX, lerpNoseY, 8);
    } else {
      push();
      translate(640, 0);
      drawShapePreview(lerpNoseX, lerpNoseY, 20); 
      pop();
    }
  }

  // UI Text
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Press SPACEBAR to Start/Stop Drawing", 15, 15); 
  text(isDrawing ? "STATUS: 🟢 DRAWING" : "STATUS: 🔴 HOVERING", 15, 40);
  
  if (isRecording) {
    fill(255, 0, 0);
    text("REC", 600, 15);
  }
}

function stampShape(x, y, size) {
  let r = size / 2;
  let activeShape = shapes[shapeIndex];

  if (activeShape === 'circle') {
    pg.noStroke();
    pg.circle(x, y, size);
  } else if (activeShape === 'rounded-square') {
    pg.noStroke();
    pg.rectMode(CENTER);
    pg.rect(x, y, size, size, size * 0.25); 
  } else if (activeShape === 'rounded-triangle') {
    pg.push();
    pg.strokeJoin(ROUND);
    pg.strokeWeight(size * 0.3);
    pg.stroke(currentColor);
    pg.fill(currentColor);
    pg.triangle(x, y - r, x - r, y + r, x + r, y + r);
    pg.pop();
  } else if (activeShape === 'star') {
    pg.noStroke();
    drawStar(pg, x, y, size * 0.25, size * 0.6, 5); 
  }
}

function drawShapePreview(x, y, size) {
  let r = size / 2;
  let activeShape = shapes[shapeIndex];
  
  fill(currentColor);
  if (activeShape === 'circle') {
    noStroke();
    circle(x, y, size);
  } else if (activeShape === 'rounded-square') {
    noStroke();
    rectMode(CENTER);
    rect(x, y, size, size, size * 0.25);
  } else if (activeShape === 'rounded-triangle') {
    strokeJoin(ROUND);
    strokeWeight(size * 0.3);
    stroke(currentColor);
    triangle(x, y - r, x - r, y + r, x + r, y + r);
  } else if (activeShape === 'star') {
    noStroke();
    drawStar(window, x, y, size * 0.25, size * 0.6, 5); 
  }
}

function drawStar(ctx, x, y, radius1, radius2, npoints) {
  let angle = TWO_PI / npoints;
  let halfAngle = angle / 2.0;
  ctx.beginShape();
  for (let a = -PI / 2; a < TWO_PI - PI / 2; a += angle) {
    let sx = x + cos(a) * radius2;
    let sy = y + sin(a) * radius2;
    ctx.vertex(sx, sy);
    sx = x + cos(a + halfAngle) * radius1;
    sy = y + sin(a + halfAngle) * radius1;
    ctx.vertex(sx, sy);
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
    pg.clear();
    pg.image(lastState, 0, 0);
  } else { pg.clear(); }
}

function toggleRecord() {
  let btnRecord = document.getElementById('btn-record');
  if (!isRecording) {
    recordedChunks = [];
    mediaRecorder.start();
    isRecording = true;
    btnRecord.innerText = '⬛ Stop & Save Video';
    btnRecord.classList.add('recording');
  } else {
    mediaRecorder.stop();
    isRecording = false;
    btnRecord.innerText = '🔴 Record Video';
    btnRecord.classList.remove('recording');
  }
}