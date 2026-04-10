console.log("sketch.js loaded");
let video;
let faceMesh;
let faces = [];

function preload() {
  faceMesh = ml5.faceMesh({ flipped: true });
}

function mousePressed() {
  console.log(faces);
}

function gotFaces(results) {
  faces = results;
}

function setup() {
  let canvas = createCanvas(640, 480);
  canvas.parent(document.body); // explicitly attach canvas to body
  video = createCapture(VIDEO, { flipped: true }, () => {
    console.log("Camera ready! Width:", video.width);
  });
  video.hide();
  faceMesh.detectStart(video, gotFaces);
  console.log("setup complete");
}

function draw() {
  background(0); // black background so you can see if canvas is rendering at all

  if (video.width === 0) {
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(16);
    text("Waiting for camera...", width / 2, height / 2);
    return;
  }

  image(video, 0, 0, width, height);

  for (let face of faces) {
    for (let i = 0; i < face.keypoints.length; i++) {
      let keypoint = face.keypoints[i];
      fill(255, 255, 0);
      noStroke();
      circle(keypoint.x, keypoint.y, 5);
    }
  }
}