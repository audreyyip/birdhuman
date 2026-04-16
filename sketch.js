let capture;
let faceapi;
let detections = [];
let canvas;
let isModelReady = false;

let capturewidth, captureheight;
let scalar = 1; 

let emotions = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];

function setup() {
  // 1. DIMENSIONS & SCALING
  if (windowWidth < windowHeight) {
    capturewidth = windowWidth;
    captureheight = windowWidth * (4 / 3);
  } else {
    capturewidth = Math.min(960, windowWidth);
    captureheight = capturewidth * (3 / 4);
  }
  scalar = capturewidth / 960;

  canvas = createCanvas(capturewidth, captureheight);
  centerCanvas();

  // 2. THE VIDEO "BLACK HOLE" (Stops the ghost video)
  let container = createDiv('');
  container.style('width', '0px');
  container.style('height', '0px');
  container.style('overflow', 'hidden');
  
  const constraints = {
    video: {
      width: { ideal: capturewidth },
      height: { ideal: captureheight },
      facingMode: 'user'
    }
  };

  capture = createCapture(constraints);
  capture.parent(container); // Moves video into the 0px box
  capture.hide();
  capture.elt.setAttribute('playsinline', '');

  // 3. START FACE API
  const faceOptions = { withLandmarks: true, withExpressions: true, flipHorizontal: false };
  faceapi = ml5.faceApi(capture, faceOptions, faceReady);
}

function faceReady() {
  isModelReady = true;
  faceapi.detect(gotFaces);
}

function gotFaces(error, result) {
  if (error) {
    console.log(error);
    return;
  }
  detections = result;
  faceapi.detect(gotFaces);
}

function draw() {
  background(0);

  if (!isModelReady) {
    drawLoadingScreen();
  } else {
    // MAIN APP
    push();
    translate(width, 0);
    scale(-1, 1);
    if (capture.loadedmetadata) {
      image(capture, 0, 0, width, height);
    }

    if (detections.length > 0) {
      fill(0, 255, 0);
      noStroke();
      for (let i = 0; i < detections.length; i++) {
        let points = detections[i].landmarks.positions;
        for (let j = 0; j < points.length; j++) {
          circle(points[j]._x, points[j]._y, 5 * scalar);
        }
      }
    }
    pop();

    if (detections.length > 0) {
      drawUI();
    }
  }
}

function drawLoadingScreen() {
  fill(255);
  textAlign(CENTER, CENTER);
  
  // Title
  textSize(32 * scalar);
  text("SETTING UP...", width / 2, height / 2 - 100 * scalar);
  
  // Instructions
  textSize(18 * scalar);
  fill(200);
  text("Tips for best results:", width / 2, height / 2 - 40 * scalar);
  
  fill(255);
  textSize(16 * scalar);
  let instructions = [
    "• Make sure there is a light source is in front of you",
    "• Keep your face centered in the frame",
  ];
  
  for(let i=0; i < instructions.length; i++) {
    text(instructions[i], width / 2, height / 2 + (i * 25 * scalar));
  }
  
  // Pulsing Loader
  let pulseAlpha = map(sin(frameCount * 0.1), -1, 1, 50, 255);
  fill(0, 255, 0, pulseAlpha);
  ellipse(width / 2, height / 2 + 130 * scalar, 15 * scalar, 15 * scalar);
}

function drawUI() {
  let baseTextSize = 20 * scalar;
  let margin = 30 * scalar;
  textSize(baseTextSize);
  textAlign(LEFT);

  for (let i = 0; i < detections.length; i++) {
    for (let k = 0; k < emotions.length; k++) {
      let thisEmotion = emotions[k];
      let level = detections[i].expressions[thisEmotion];
      let yPos = margin + (margin * k);
      
      fill(255);
      text(thisEmotion.toUpperCase() + ": " + nf(level, 1, 2), 20 * scalar, yPos);
      fill(0, 255, 0);
      rect(20 * scalar, yPos + (5 * scalar), level * (150 * scalar), 8 * scalar);
    }
  }
}

function windowResized() {
  if (windowWidth < windowHeight) {
    capturewidth = windowWidth;
    captureheight = windowWidth * (4 / 3);
  } else {
    capturewidth = Math.min(960, windowWidth);
    captureheight = capturewidth * (3 / 4);
  }
  resizeCanvas(capturewidth, captureheight);
  scalar = capturewidth / 960;
  centerCanvas();
}

function centerCanvas() {
  let x = (windowWidth - width) / 2;
  let y = (windowHeight - height) / 2;
  canvas.position(x, y);
}