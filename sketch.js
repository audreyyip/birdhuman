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
let lerpNoseX = 0;
let lerpNoseY = 0;
let prevX, prevY;

let currentColor = '#00FF00'; 
let isErasing = false;
let undoStack = [];

let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

let shapes = ['circle', 'square', 'triangle', 'star'];
let shapeIndex = 0;

function preload() {
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  let cnv = createCanvas(vidW, vidH);
  cnv.parent('video-wrapper'); 

  pg = createGraphics(vidW, vidH);
  pg.clear();

  let constraints = { audio: false, video: { facingMode: "user" } };
  video = createCapture(constraints);
  video.parent('video-wrapper'); 
  video.elt.setAttribute('playsinline', '');

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

  let acc = document.getElementsByClassName("accordion");
  for (let i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", function() {
      this.classList.toggle("active");
      let panel = this.nextElementSibling;
      if (panel.style.display === "flex") {
        panel.style.display = "none";
      } else {
        panel.style.display = "flex";
      }
    });
  }

  document.getElementById('btn-undo').addEventListener('click', undoStroke);
  document.getElementById('btn-reset').addEventListener('click', () => {
    pg.clear(); undoStack = []; saveState();
  });
  document.getElementById('btn-download').addEventListener('click', () => { save(pg, 'POLLOCK-ART.png'); });
  document.getElementById('btn-eraser').addEventListener('click', () => { isErasing = !isErasing; });

  let drawBtn = document.getElementById('btn-mobile-draw');
  drawBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); 
    toggleDrawing();
  });

  document.getElementById('btn-toggle-cam').addEventListener('click', (e) => {
    showCamera = !showCamera;
    video.style('opacity', showCamera ? '1' : '0');
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

  document.getElementById('btn-record').addEventListener('click', toggleRecord);
  let stream = document.querySelector('canvas').captureStream(30);
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  mediaRecorder.ondataavailable = function(e) { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = function() {
    let blob = new Blob(recordedChunks, { type: 'video/webm' }); 
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'POLLOCK-RECORDING.webm'; 
    a.click();
    recordedChunks = [];
  };
}

function windowResized() {
  calculateLayout();
}

function calculateLayout() {
  let container = document.getElementById('canvas-container');
  let wrapper = document.getElementById('video-wrapper');
  wrapper.style.width = container.clientWidth + 'px';
  wrapper.style.height = container.clientHeight + 'px';
}

function draw() {
  clear(); 

  if (faces.length > 0) {
    let face = faces[0];
    let mirroredNoseX = vidW - face.keypoints[1].x; 
    let noseY = face.keypoints[1].y;
    lerpNoseX = lerp(lerpNoseX, mirroredNoseX, lerpSpeed);
    lerpNoseY = lerp(lerpNoseY, noseY, lerpSpeed);

    let mouthSize = dist(face.keypoints[13].x, face.keypoints[13].y, face.keypoints[14].x, face.keypoints[14].y);

    if (isDrawing) {
      if (isErasing) {
        pg.erase(); pg.stroke(255); pg.strokeWeight(mouthSize * 2); 
        if (prevX !== undefined) pg.line(lerpNoseX, lerpNoseY, prevX, prevY);
        pg.noErase();
      } else {
        pg.noStroke(); pg.fill(currentColor);
        if (prevX !== undefined) {
          let d = dist(prevX, prevY, lerpNoseX, lerpNoseY);
          let steps = Math.max(1, d / 2); 
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

  if (showCamera) {
    fill(0, 0, 0, 100);
    rect(0, 0, vidW, vidH);
  }

  image(pg, 0, 0);

  if (faces.length > 0) {
    let mouthSize = dist(faces[0].keypoints[13].x, faces[0].keypoints[13].y, faces[0].keypoints[14].x, faces[0].keypoints[14].y);
    push();
    translate(lerpNoseX, lerpNoseY);
    if (isErasing) {
      noFill(); stroke(255); strokeWeight(2); circle(0, 0, mouthSize * 2);
    } else {
      drawShapePreview(0, 0, mouthSize); 
    }
    pop();
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
  else if (activeShape === 'star') { drawStar(window, x, y, size * 0.25, size * 0.6, 5); }
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
  
  // Hide the big intro text permanently once they start
  let intro = document.getElementById('intro-overlay');
  if (intro) intro.style.display = 'none';

  // Update Status Indicator
  let statusText = document.getElementById('status-indicator');
  if (statusText) statusText.innerText = isDrawing ? "🟢 DRAWING" : "🔴 HOVERING";

  // Update Mobile Button styling
  let btn = document.getElementById('btn-mobile-draw');
  btn.style.backgroundColor = isDrawing ? "#4CAF50" : "#222";
  
  if (isDrawing) { saveState(); prevX = undefined; }
}

function keyPressed() { if (key === ' ') { toggleDrawing(); } }
function saveState() { undoStack.push(pg.get()); if (undoStack.length > 15) undoStack.shift(); }
function undoStroke() { if (undoStack.length > 0) { let lastState = undoStack.pop(); pg.clear(); pg.image(lastState, 0, 0); } }

function toggleRecord() {
  let btnRecord = document.getElementById('btn-record');
  let recIndicator = document.getElementById('record-indicator');

  if (!isRecording) {
    recordedChunks = []; mediaRecorder.start(); isRecording = true;
    btnRecord.innerText = '⬛ STOP'; btnRecord.classList.add('recording');
    if (recIndicator) recIndicator.style.display = 'block';
  } else {
    mediaRecorder.stop(); isRecording = false;
    btnRecord.innerText = '🔴 RECORD'; btnRecord.classList.remove('recording');
    if (recIndicator) recIndicator.style.display = 'none';
  }
}