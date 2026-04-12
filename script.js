import { calculateAngle } from './utils.js';
import { poses } from './poses.js';

// Because we are loading the scripts in index.html, the objects are now available globally
const { Pose, POSE_CONNECTIONS } = window;
const { drawConnectors, drawLandmarks } = window;
const { Camera } = window;

// Get references to the HTML elements
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const feedbackElement = document.getElementById('feedback');
const repCountElement = document.getElementById('rep-count');

// UI Buttons
const plankBtn = document.getElementById('plankBtn');
const pushupBtn = document.getElementById('pushupBtn');
const lungeBtn = document.getElementById('lungeBtn');

// Global state
let lastSpokenFeedback = "";
let currentPose = "plank"; 
let repCounter = 0;
let pushupStage = 'up'; // Can be 'up' or 'down'

// --- Event Listeners for UI ---
plankBtn.addEventListener('click', () => {
    currentPose = 'plank';
    repCounter = 0;
    updateActiveButton(plankBtn);
});
pushupBtn.addEventListener('click', () => {
    currentPose = 'pushup';
    repCounter = 0;
    pushupStage = 'up';
    updateActiveButton(pushupBtn);
});
lungeBtn.addEventListener('click', () => {
    currentPose = 'lunge';
    repCounter = 0;
    updateActiveButton(lungeBtn);
});

function updateActiveButton(activeBtn) {
    document.querySelectorAll('.btn-exercise').forEach(btn => btn.classList.remove('active'));
    activeBtn.classList.add('active');
    repCountElement.innerText = repCounter;
    feedbackElement.innerHTML = `<p>Get into position for ${activeBtn.innerText}!</p>`;
    lastSpokenFeedback = ""; // Reset speaker
}

// Text to Speech
const speaker = new SpeechSynthesisUtterance();
function speak(text) {
    if (text && text !== lastSpokenFeedback) {
        lastSpokenFeedback = text;
        speaker.text = text;
        window.speechSynthesis.speak(speaker);
    }
}

// This function is the core of the application
function onResults(results) {
    // We are using the results to draw on the canvas, not the raw video
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // Draw the video frame on the canvas
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        const landmarks = results.poseLandmarks;
        let feedbackMessage = "Great Form!";
        let incorrectLandmarks = [];

        // Define all necessary landmarks
        const points = {
            leftShoulder: landmarks[11], leftElbow: landmarks[13], leftWrist: landmarks[15],
            leftHip: landmarks[23], leftKnee: landmarks[25], leftAnkle: landmarks[27],
            rightShoulder: landmarks[12], rightElbow: landmarks[14], rightWrist: landmarks[16],
            rightHip: landmarks[24], rightKnee: landmarks[26], rightAnkle: landmarks[28]
        };

        const angles = {
            left_knee_angle: calculateAngle(points.leftHip, points.leftKnee, points.leftAnkle),
            right_knee_angle: calculateAngle(points.rightHip, points.rightKnee, points.rightAnkle),
            left_hip_angle: calculateAngle(points.leftShoulder, points.leftHip, points.leftKnee),
            right_hip_angle: calculateAngle(points.rightShoulder, points.rightHip, points.rightKnee),
            left_elbow_angle: calculateAngle(points.leftShoulder, points.leftElbow, points.leftWrist),
            right_elbow_angle: calculateAngle(points.rightShoulder, points.rightElbow, points.rightWrist)
        };
        
        let poseRules;
        if (currentPose === 'pushup') {
            poseRules = poses[`pushup_${pushupStage}`];
            const elbowAngle = (angles.left_elbow_angle + angles.right_elbow_angle) / 2;
            if (pushupStage === 'up' && elbowAngle < 100) {
                pushupStage = 'down';
            } else if (pushupStage === 'down' && elbowAngle > 160) {
                pushupStage = 'up';
                repCounter++;
                repCountElement.innerText = repCounter;
            }
        } else {
            poseRules = poses[currentPose];
        }

        if (poseRules) {
            for (const [angleName, angleValue] of Object.entries(angles)) {
                if (poseRules[angleName]) {
                    const rule = poseRules[angleName];
                    const incorrectPoints = [];
                    if (angleValue < rule.range[0] && rule.feedback_low) {
                        feedbackMessage = rule.feedback_low;
                        if(angleName.includes('knee')) incorrectPoints.push(points.leftKnee, points.rightKnee);
                        if(angleName.includes('hip')) incorrectPoints.push(points.leftHip, points.rightHip);
                        if(angleName.includes('elbow')) incorrectPoints.push(points.leftElbow, points.rightElbow);
                    } else if (angleValue > rule.range[1] && rule.feedback_high) {
                        feedbackMessage = rule.feedback_high;
                        if(angleName.includes('knee')) incorrectPoints.push(points.leftKnee, points.rightKnee);
                        if(angleName.includes('hip')) incorrectPoints.push(points.leftHip, points.rightHip);
                        if(angleName.includes('elbow')) incorrectPoints.push(points.leftElbow, points.rightElbow);
                    }
                    if (incorrectPoints.length > 0) {
                        incorrectLandmarks.push(...incorrectPoints);
                        break;
                    }
                }
            }
        }

        feedbackElement.innerHTML = `<p>${feedbackMessage}</p>`;
        speak(feedbackMessage);

        drawConnectors(canvasCtx, landmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2, radius: 5 });
        if (incorrectLandmarks.length > 0) {
            drawLandmarks(canvasCtx, incorrectLandmarks, { color: '#FFFF00', lineWidth: 2, radius: 8 });
        }

    } else {
        feedbackElement.innerHTML = "<p>No person detected.</p>";
    }
    canvasCtx.restore();
}

// --- Main Application Setup ---

feedbackElement.innerHTML = "<p>Initializing...</p>";

const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`,
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({ image: videoElement });
    },
    width: 1280,
    height: 720
});

camera.start();

feedbackElement.innerHTML = "<p>AI Model Loaded. Select an exercise!</p>";
updateActiveButton(plankBtn);
