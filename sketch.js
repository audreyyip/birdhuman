let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: false };

// Drawing & Smoothing
let lerpSpeed = 0.2;   
let pg; 
let isDrawing = false;
let lerpNoseX = 0;
let lerpNoseY = 0;
let prevX, prevY;

// Tools
let currentColor = '#00FF00'; // Default Green
let isErasing = false;
let undoStack = [];

// Recording
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  // Connect canvas to the HTML div
  let cnv = createCanvas(1280, 480); 
  cnv.parent('canvas-container');

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  
  pg = createGraphics(640, 480);
  pg.clear();

  saveState();
  faceMesh.detectStart(video, gotFaces);

  // --- CONNECT HTML BUTTONS TO JAVASCRIPT LOGIC ---
  
  // Undo & Eraser
  document.getElementById('btn-undo').addEventListener('click', undoStroke);
  document.getElementById('btn-eraser').addEventListener('click', () => { isErasing = true; });

  // Connect all color buttons at once
  let colorButtons = document.querySelectorAll('.color-btn');
  colorButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      isErasing = false; 
      // Pulls the hex code from the HTML data-color attribute
      currentColor = e.target.getAttribute('data-color'); 
    });
  });

  // Record Button
  document.getElementById('btn-record').addEventListener('click', toggleRecord);

  // Setup MediaRecorder for Canvas Capture
  let stream = document.querySelector('canvas').captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  
  mediaRecorder.ondataavailable = function(e) {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  
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

  // --- LEFT SIDE: MIRRORED VIDEO ---
  push();
  translate(640, 0); 
  scale(-1, 1);      
  image(video, 0, 0, 640, 480);
  pop();

  // --- RIGHT SIDE: DRAWING CANVAS ---
  fill(30); 
  noStroke();
  rect(640, 0, 640, 480);
  image(pg, 640, 0);

  // --- PROCESSING FACES ---
  if (faces.length > 0) {
    let face = faces[0];

    // Track mirrored nose coordinates
    let mirroredNoseX = 640 - face.keypoints[1].x; 
    let noseY = face.keypoints[1].y;

    lerpNoseX = lerp(lerpNoseX, mirroredNoseX, lerpSpeed);
    lerpNoseY = lerp(lerpNoseY, noseY, lerpSpeed);

    // Mouth Opening controls size
    let mouthSize = dist(face.keypoints[13].x, face.keypoints[13].y, face.keypoints[14].x, face.keypoints[14].y);

    // --- DRAWING TO THE BUFFER ---
    if (isDrawing) {
      if (isErasing) {
        pg.erase(); 
        pg.strokeWeight(mouthSize * 1.5); 
      } else {
        pg.noErase();
        pg.stroke(currentColor);
        pg.strokeWeight(mouthSize);
      }
      
      if (prevX !== undefined) {
        pg.line(lerpNoseX, lerpNoseY, prevX, prevY);
      }
    }
    
    prevX = lerpNoseX;
    prevY = lerpNoseY;

    // --- VISUAL CURSORS ---
    fill(255, 0, 0);
    noStroke();
    circle(lerpNoseX, lerpNoseY, 8);
    
    if (isErasing) fill(255); 
    else fill(currentColor);  
    circle(640 + lerpNoseX, lerpNoseY, 8);
  }

  // --- ON-SCREEN INSTRUCTIONS ---
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
  if (undoStack.length > 10) {
    undoStack.shift(); 
  }
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
    
    // Update button visually via JavaScript
    btnRecord.innerText = '⬛ Stop & Save Video';
    btnRecord.classList.add('recording'); // Triggers CSS style
  } else {
    mediaRecorder.stop();
    isRecording = false;
    
    btnRecord.innerText = '🔴 Start Recording';
    btnRecord.classList.remove('recording');
  }
}
