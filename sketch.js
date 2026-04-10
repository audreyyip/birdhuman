let video;
let faceMesh;
let faces = [];

function preload(){
    faceMesh = ml5.faceMesh({flipped:true});
}

function mousePressed(){
    console.log(faces);
}

function gotFaces(results){
    faces = results;
}

function setup() {
    createCanvas(640, 480);
    video = createCapture(VIDEO, { flipped: true });
    video.hide();
    faceMesh.detectStart(video, gotFaces);
}

function draw() {
    image(video,0,0);
    if(faces.length > 0){
        for (let face of faces){
            for(let i=0; i<face.keypoints.length; i++){
                let keypoint = face.keypoints[i];
                fill(255,255,0);
                noStroke();
                circle(keypoint.x,keypoint.y,5);
            }
        }
    }
}