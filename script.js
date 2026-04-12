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
    currentPose = 'pushup'; // We'll check for 'up' or 'down' stage internally
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

// This function will be called when the model returns its results
function onResults(results) {
    // Clear the canvas
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Draw the skeleton
    if (results.poseLandmarks) {
        // --- Pose Analysis and Feedback ---
        const landmarks = results.poseLandmarks;
        let feedbackMessage = "Great Form!";
        let feedbackGiven = false;
        let incorrectLandmarks = [];

        // Define all necessary landmarks
        const points = {
            leftShoulder: landmarks[11], leftElbow: landmarks[13], leftWrist: landmarks[15],
            leftHip: landmarks[23], leftKnee: landmarks[25], leftAnkle: landmarks[27],
            rightShoulder: landmarks[12], rightElbow: landmarks[14], rightWrist: landmarks[16],
            rightHip: landmarks[24], rightKnee: landmarks[26], rightAnkle: landmarks[28]
        };

        // Calculate all necessary angles
        const angles = {
            left_knee_angle: calculateAngle(points.leftHip, points.leftKnee, points.leftAnkle),
            right_knee_angle: calculateAngle(points.rightHip, points.rightKnee, points.rightAnkle),
            left_hip_angle: calculateAngle(points.leftShoulder, points.leftHip, points.leftKnee),
            right_hip_angle: calculateAngle(points.rightShoulder, points.rightHip, points.rightKnee),
            left_elbow_angle: calculateAngle(points.leftShoulder, points.leftElbow, points.leftWrist),
            right_elbow_angle: calculateAngle(points.rightShoulder, points.rightElbow, points.rightWrist)
        };
        
        // --- Logic for different poses ---
        let poseRules;
        if (currentPose === 'pushup') {
            // Pushup logic with state machine
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

        // Compare live angles to the pose rules
        if (poseRules) {
            for (const [angleName, angleValue] of Object.entries(angles)) {
                if (poseRules[angleName]) {
                    const rule = poseRules[angleName];
                    if (angleValue < rule.range[0] && rule.feedback_low) {
                        feedbackMessage = rule.feedback_low;
                        feedbackGiven = true;
                        // Add relevant landmarks to the incorrect list
                        if(angleName.includes('knee')) incorrectLandmarks.push(landmarks[25], landmarks[26]);
                        if(angleName.includes('hip')) incorrectLandmarks.push(landmarks[23], landmarks[24]);
                        if(angleName.includes('elbow')) incorrectLandmarks.push(landmarks[13], landmarks[14]);
                        break; 
                    } else if (angleValue > rule.range[1] && rule.feedback_high) {
                        feedbackMessage = rule.feedback_high;
                        feedbackGiven = true;
                        if(angleName.includes('knee')) incorrectLandmarks.push(landmarks[25], landmarks[26]);
                        if(angleName.includes('hip')) incorrectLandmarks.push(landmarks[23], landmarks[24]);
                        if(angleName.includes('elbow')) incorrectLandmarks.push(landmarks[13], landmarks[14]);
                        break;
                    }
                }
            }
        }

        // Update UI and speak feedback
        feedbackElement.innerHTML = `<p>${feedbackMessage}</p>`;
        speak(feedbackMessage);

        // --- Drawing ---
        // Draw the main skeleton
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        // Draw all landmarks in a base color
        drawLandmarks(canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2, radius: 5 });
        // Draw the incorrect landmarks in a highlight color
        if (feedbackGiven) {
            drawLandmarks(canvasCtx, incorrectLandmarks, { color: '#FFFF00', lineWidth: 2, radius: 8 });
        }

    } else {
        feedbackElement.innerHTML = "<p>No person detected. Please stand in front of the camera.</p>";
    }
    canvasCtx.restore();
}


// Function to start the webcam
async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 }
        });
        videoElement.srcObject = stream;
        
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve(videoElement);
            };
        });
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        feedbackElement.innerHTML = "<p>Error: Webcam access denied. Please allow camera access and refresh the page.</p>";
    }
}

// Main function to run the application
async function main() {
    feedbackElement.innerHTML = "<p>Please grant webcam access...</p>";
    updateActiveButton(plankBtn); // Set Plank as default active
    const video = await startWebcam();
    
    if (video) {
        feedbackElement.innerHTML = "<p>Webcam active. Initializing AI model...</p>";

        const pose = new Pose({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
            }
        });

        pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        pose.onResults(onResults);

        feedbackElement.innerHTML = "<p>AI Model loaded. Get into a high plank position!</p>";

        async function predictWebcam() {
            if (video.readyState >= 3) {
                await pose.send({ image: video });
            }
            requestAnimationFrame(predictWebcam);
        }

        predictWebcam();
    }
}

// Run the main function when the page loads
main();
