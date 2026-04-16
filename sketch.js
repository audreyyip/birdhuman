let capture;
let faceapi;
let detections = [];

let capturewidth, captureheight;
let scalar = 1;
let canvas; // moved to global so windowResized can access it

let emotions = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];

function getResponsiveDimensions() {
  if (windowWidth < windowHeight) {
    // Portrait: fit within the viewport height too, not just width
    let w = windowWidth;
    let h = Math.min(w * (4 / 3), windowHeight); // <-- KEY FIX: cap to screen height
    w = h * (3 / 4); // re-derive width in case height was the constraint
    return { w, h };
  } else {
    let w = Math.min(960, windowWidth);
    let h = w * (3 / 4);
    return { w, h };
  }
}

function setup() {
  let dims = getResponsiveDimensions();
  capturewidth = dims.w;
  captureheight = dims.h;
  scalar = capturewidth / 960;

  canvas = createCanvas(capturewidth, captureheight);
  canvas.position((windowWidth - width) / 2, (windowHeight - height) / 2);

  // Prevent the page body from scrolling/overflowing
  canvas.style('display', 'block');
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#000';

  const constraints = {
    video: {
      width: { ideal: capturewidth },
      height: { ideal: captureheight },
      facingMode: 'user'
    },
    audio: false
  };

  capture = createCapture(constraints, function() {
    // Force the video element to exactly match canvas size
    capture.size(capturewidth, captureheight);
  });
  capture.elt.setAttribute('playsinline', '');
  capture.hide();

  const faceOptions = {
    withLandmarks: true,
    withExpressions: true,
    withDescriptors: false,
    flipHorizontal: false
  };

  faceapi = ml5.faceApi(capture, faceOptions, faceReady);
}

function faceReady() {
  console.log("FaceAPI Model Loaded");
  faceapi.detect(gotFaces);
}

function gotFaces(error, result) {
  if (error) { console.log(error); return; }
  detections = result;
  faceapi.detect(gotFaces);
}

function draw() {
  background(0);

  push();
  translate(width, 0);
  scale(-1, 1);

  if (capture.loadedmetadata) {
    image(capture, 0, 0, width, height);
  }

  if (detections.length > 0) {
    // Scale landmarks from capture resolution to canvas resolution
    let xScale = width / capture.width;
    let yScale = height / capture.height;

    fill(0, 255, 0);
    noStroke();
    for (let i = 0; i < detections.length; i++) {
      let points = detections[i].landmarks.positions;
      for (let j = 0; j < points.length; j++) {
        circle(points[j]._x * xScale, points[j]._y * yScale, 8 * scalar);
      }
    }
  }
  pop();

  if (detections.length > 0) {
    drawUI();
  }
}

function drawUI() {
  let baseTextSize = max(14, 20 * scalar); // minimum 14px so it's never too tiny
  let margin = max(24, 30 * scalar);
  let barMaxWidth = width * 0.35; // bar spans 35% of canvas width, scales naturally
  let leftEdge = 12 * scalar;

  textSize(baseTextSize);
  textAlign(LEFT);
  textFont('monospace');

  for (let i = 0; i < detections.length; i++) {
    for (let k = 0; k < emotions.length; k++) {
      let thisEmotion = emotions[k];
      let level = detections[i].expressions[thisEmotion];
      let yPos = margin + (margin * k);

      // Label
      fill(255);
      noStroke();
      text(thisEmotion.toUpperCase() + ": " + nf(level, 1, 2), leftEdge, yPos);

      // Bar background (dark green)
      fill(0, 80, 0);
      rect(leftEdge, yPos + (5 * scalar), barMaxWidth, 8 * scalar);

      // Bar fill
      fill(0, 255, 0);
      rect(leftEdge, yPos + (5 * scalar), level * barMaxWidth, 8 * scalar);
    }
  }
}