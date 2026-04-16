let capture;
let capturewidth = 960;
let captureheight = 720;

let emotions = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];

let faceapi;
let detections = [];

function setup() {
  // Centers the canvas in the browser window
  let cnv = createCanvas(capturewidth, captureheight);
  cnv.style('display', 'block');
  cnv.position((windowWidth - width) / 2, (windowHeight - height) / 2);

  // Constraints for Mobile and Desktop
  const constraints = {
    video: {
      width: { ideal: capturewidth },
      height: { ideal: captureheight },
      facingMode: 'user' // Forces front camera on mobile
    },
    audio: false
  };

  capture = createCapture(constraints);
  capture.hide();
  capture.elt.setAttribute('playsinline', ''); // Essential for iOS
  capture.size(capturewidth, captureheight);
  

  const faceOptions = {
    withLandmarks: true,
    withExpressions: true,
    withDescriptors: false,
    flipHorizontal: false // We handle flipping manually in draw() for more control
  };

  faceapi = ml5.faceApi(capture, faceOptions, faceReady);
}

function faceReady() {
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

  // --- MIRRORING LOGIC ---
  push();
  translate(width, 0); // Move to the right edge
  scale(-1, 1);        // Flip horizontally
  
  // Draw the video feed
  image(capture, 0, 0, width, height);

  if (detections.length > 0) {
    for (let i = 0; i < detections.length; i++) {
      let points = detections[i].landmarks.positions;
      
      fill(0, 255, 0);
      noStroke();
      for (let j = 0; j < points.length; j++) {
        // Draw circles at the detected landmark points
        circle(points[j]._x, points[j]._y, 5);
      }
    }
  }
  pop(); // End of mirrored section

  // --- UI/TEXT SECTION (Not Mirrored) ---
  if (detections.length > 0) {
    for (let i = 0; i < detections.length; i++) {
      fill(255);
      for (let k = 0; k < emotions.length; k++) {
        let thisemotion = emotions[k];
        let thisemotionlevel = detections[i].expressions[thisemotion];

        textAlign(LEFT);
        text(thisemotion.toUpperCase() + ": " + nf(thisemotionlevel, 1, 2), 40, 30 + 30 * k);
        
        fill(0, 255, 0);
        rect(40, 35 + 30 * k, thisemotionlevel * 100, 5);
        fill(255);
      }
    }
  }
}

// Keep the canvas centered if the window is resized
function windowResized() {
  centerCanvas();
}

function centerCanvas() {
  let x = (windowWidth - width) / 2;
  let y = (windowHeight - height) / 2;
  // This helps if you're using CSS positioning
}