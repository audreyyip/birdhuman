
let capture;
let capturewidth = 1920;    
let captureheight = 1080;

let emotions = ["neutral", "happy", "sad", "angry", "fearful", "disgusted", "surprised"];

// Emotion visuals: each entry has a label color and a draw function
let emotionVisuals = {
  happy:     () => {
    background('#FFD700');
    fill('#fff');
    textSize(80);
    textAlign(CENTER, CENTER);
    text('HAPPY', width/2, height/2 - 120);
  },
  sad:       () => {
    background('#4169E1');
    fill('#fff');
    textSize(80);
    textAlign(CENTER, CENTER);
    text('SAD', width/2, height/2 - 120);
  },
  angry:     () => {
    background('#8B0000');
    fill('#fff');
    textSize(80);
    textAlign(CENTER, CENTER);
    text('ANGRY', width/2, height/2 - 120);
  },
  fearful:   () => {
    background('#1a1a2e');
    fill('#fff');
    textSize(80);
    textAlign(CENTER, CENTER);
    text('FEARFUL', width/2, height/2 - 120);
  },
  disgusted: () => {
    background('#2d5a27');
    fill('#fff');
    textSize(80);
    textAlign(CENTER, CENTER);
    text('DISGUSTED', width/2, height/2 - 120);
  },
  surprised: () => {
    background('#8B008B');
    fill('#fff');
    textSize(80);
    textAlign(CENTER, CENTER);
    text('SURPRISED', width/2, height/2 - 120);
  },
  neutral:   () => {
    background('#444444');
    fill('#fff');
    textSize(80);
    textAlign(CENTER, CENTER);
    text('NEUTRAL', width/2, height/2 - 120);
  }
};

let faceapi;
let detections = [];

function setup() {
  createCanvas(capturewidth, captureheight);
  
  // Constrain video to match canvas resolution
  capture = createCapture({ video: { width: capturewidth, height: captureheight } });
  capture.position(0, 0);
  capture.hide();
  
  const faceOptions = { withLandmarks: true, withExpressions: true, withDescriptors: false };
  faceapi = ml5.faceApi(capture, faceOptions, faceReady);
}

function faceReady() {
  faceapi.detect(gotFaces);
}

function gotFaces(error, result) {
  if (error) { console.log(error); return; }
  detections = result;
  faceapi.detect(gotFaces);
}


function draw() {
  // Only draw black background if no dominant emotion is showing
  let dominantEmotionFound = false;

  if (detections.length > 0) {
    for (let i = 0; i < detections.length; i++) {
      for (let k = 0; k < emotions.length; k++) {
        let thisemotionlevel = detections[i].expressions[emotions[k]];
        if (thisemotionlevel >= 0.6 && emotionVisuals[emotions[k]]) {
          dominantEmotionFound = true;
        }
      }
    }
  }

  if (!dominantEmotionFound) background(0); // default black

  let scaleX = capturewidth / 640;
  let scaleY = captureheight / 480;

  push();
  fill('white');

  if (detections.length > 0) {
    for (let i = 0; i < detections.length; i++) {
      let points = detections[i].landmarks.positions;
      for (let j = 0; j < points.length; j++) {
        circle(points[j]._x * scaleX, points[j]._y * scaleY, 5);
      }

      push();
      textSize(20);
      for (let k = 0; k < emotions.length; k++) {
        let thisemotion = emotions[k];
        let thisemotionlevel = detections[i].expressions[thisemotion];
        let pct = (thisemotionlevel * 100).toFixed(1) + "%";

        if (thisemotionlevel >= 0.6 && emotionVisuals[thisemotion]) {
          push();
          emotionVisuals[thisemotion](); // background drawn here
          pop();
        }

        fill('green');
        text(thisemotion + ": " + pct, 40, 50 + 50 * k);
        rect(40, 60 + 50 * k, thisemotionlevel * 200, 20);
      }
      pop();

      // ✅ Draw landmarks AFTER emotion background so they appear on top
      fill('green');
      noStroke();
      for (let j = 0; j < points.length; j++) {
        circle(points[j]._x * scaleX, points[j]._y * scaleY, 5);
      }
    }
  }

  pop();
}