let faceMesh;
let video;
let faces = [];
let options = { maxFaces: 1, refineLandmarks: false, flipHorizontal: false };

function preload() {
  // Load the faceMesh model
  faceMesh = ml5.faceMesh(options);
}

function setup() {
  createCanvas(640, 480);
  // Create the webcam video and hide it
  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();
  // Start detecting faces from the webcam video
  faceMesh.detectStart(video, gotFaces);
}

function draw() {
  // Draw the webcam video
  image(video, 0, 0, width, height);
  background(0);
  // Draw all the tracked face points
  // for (let i = 0; i < faces.length; i++) {
  //   let face = faces[i];
  //   for (let j = 0; j < face.keypoints.length; j++) {
  //     let keypoint = face.keypoints[j];
  //     fill(0, 255, 0);
  //     noStroke();
  //     circle(keypoint.x, keypoint.y, 5);
  //   }
  // }

  if (faces.length > 0) {
    let face = faces[0];
    image(video, 0, 0);

    // Draw exterior lip contour
    beginShape();
    for (let i = 0; i < lipsExterior.length; i++) {
      let index = lipsExterior[i];
      let keypoint = face.keypoints[index];
      stroke(255, 255, 0);
      strokeWeight(0);
      noFill();
      vertex(keypoint.x, keypoint.y);
    }
    endShape(CLOSE);

    // Draw interior lip contour
    beginShape();
    for (let i = 0; i < lipsInterior.length; i++) {
      let index = lipsInterior[i];
      let keypoint = face.keypoints[index];
      stroke(255, 0, 255);
      strokeWeight(0);
      noFill();
      vertex(keypoint.x, keypoint.y);
    }
    endShape(CLOSE);

    // Calculate mouth opening distance
    let a = face.keypoints[13];
    let b = face.keypoints[14];
    let d = dist(a.x, a.y, b.x, b.y);

    // Calculate eye opening distance (using top and bottom lids)
let e = face.keypoints[159];
let f = face.keypoints[145];
let g = dist(e.x, e.y, f.x, f.y);

    // Draw a circle on the nose with size based on mouth opening
    let nose = face.keypoints[19];
    fill(0, 255, 0);
    circle(nose.x, nose.y, d);
  }
}

// Callback function for when faceMesh outputs data
function gotFaces(results) {
  // Save the output to the faces variable
  faces = results;
}

let eye = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];

let lipsExterior = [267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61, 185, 40, 39, 37, 0];

// Define the interior lip landmark indices for drawing the inner lip contour
let lipsInterior = [13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 191, 80, 81, 82];
