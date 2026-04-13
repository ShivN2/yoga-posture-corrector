(function () {
    // Get references to the HTML elements
    var videoElement = document.getElementById('webcam');
    var canvasElement = document.getElementById('output_canvas');
    var canvasCtx = canvasElement.getContext('2d');
    var feedbackElement = document.getElementById('feedback');
    var repCountElement = document.getElementById('rep-count');

    // UI Buttons
    var plankBtn = document.getElementById('plankBtn');
    var pushupBtn = document.getElementById('pushupBtn');
    var lungeBtn = document.getElementById('lungeBtn');

    // Global state
    var lastSpokenFeedback = "";
    var currentPose = "plank";
    var repCounter = 0;
    var pushupStage = 'up';

    // --- Event Listeners for UI ---
    plankBtn.addEventListener('click', function () {
        currentPose = 'plank';
        repCounter = 0;
        updateActiveButton(plankBtn);
    });
    pushupBtn.addEventListener('click', function () {
        currentPose = 'pushup';
        repCounter = 0;
        pushupStage = 'up';
        updateActiveButton(pushupBtn);
    });
    lungeBtn.addEventListener('click', function () {
        currentPose = 'lunge';
        repCounter = 0;
        updateActiveButton(lungeBtn);
    });

    function updateActiveButton(activeBtn) {
        var buttons = document.querySelectorAll('.btn-exercise');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].classList.remove('active');
        }
        activeBtn.classList.add('active');
        repCountElement.innerText = repCounter;
        feedbackElement.innerHTML = '<p>Get into position for ' + activeBtn.innerText + '!</p>';
        lastSpokenFeedback = "";
    }

    // Text to Speech
    var speaker = new SpeechSynthesisUtterance();
    speaker.rate = 1.0;
    speaker.lang = 'en-US';

    function speak(text) {
        if (text && text !== lastSpokenFeedback) {
            lastSpokenFeedback = text;
            window.speechSynthesis.cancel();
            speaker.text = text;
            window.speechSynthesis.speak(speaker);
        }
    }

    // Core pose analysis callback
    function onResults(results) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (results.poseLandmarks) {
            var landmarks = results.poseLandmarks;
            var feedbackMessage = "Great Form!";
            var incorrectLandmarks = [];

            var points = {
                leftShoulder: landmarks[11], leftElbow: landmarks[13], leftWrist: landmarks[15],
                leftHip: landmarks[23], leftKnee: landmarks[25], leftAnkle: landmarks[27],
                rightShoulder: landmarks[12], rightElbow: landmarks[14], rightWrist: landmarks[16],
                rightHip: landmarks[24], rightKnee: landmarks[26], rightAnkle: landmarks[28]
            };

            var angles = {
                left_knee_angle: calculateAngle(points.leftHip, points.leftKnee, points.leftAnkle),
                right_knee_angle: calculateAngle(points.rightHip, points.rightKnee, points.rightAnkle),
                left_hip_angle: calculateAngle(points.leftShoulder, points.leftHip, points.leftKnee),
                right_hip_angle: calculateAngle(points.rightShoulder, points.rightHip, points.rightKnee),
                left_elbow_angle: calculateAngle(points.leftShoulder, points.leftElbow, points.leftWrist),
                right_elbow_angle: calculateAngle(points.rightShoulder, points.rightElbow, points.rightWrist)
            };

            var poseRules;
            if (currentPose === 'pushup') {
                poseRules = poses['pushup_' + pushupStage];
                var elbowAngle = (angles.left_elbow_angle + angles.right_elbow_angle) / 2;
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
                var angleNames = Object.keys(angles);
                for (var i = 0; i < angleNames.length; i++) {
                    var angleName = angleNames[i];
                    var angleValue = angles[angleName];
                    if (poseRules[angleName]) {
                        var rule = poseRules[angleName];
                        var badPoints = [];
                        if (angleValue < rule.range[0] && rule.feedback_low) {
                            feedbackMessage = rule.feedback_low;
                            if (angleName.indexOf('knee') !== -1) badPoints.push(points.leftKnee, points.rightKnee);
                            if (angleName.indexOf('hip') !== -1) badPoints.push(points.leftHip, points.rightHip);
                            if (angleName.indexOf('elbow') !== -1) badPoints.push(points.leftElbow, points.rightElbow);
                        } else if (angleValue > rule.range[1] && rule.feedback_high) {
                            feedbackMessage = rule.feedback_high;
                            if (angleName.indexOf('knee') !== -1) badPoints.push(points.leftKnee, points.rightKnee);
                            if (angleName.indexOf('hip') !== -1) badPoints.push(points.leftHip, points.rightHip);
                            if (angleName.indexOf('elbow') !== -1) badPoints.push(points.leftElbow, points.rightElbow);
                        }
                        if (badPoints.length > 0) {
                            incorrectLandmarks = incorrectLandmarks.concat(badPoints);
                            break;
                        }
                    }
                }
            }

            feedbackElement.innerHTML = '<p>' + feedbackMessage + '</p>';
            speak(feedbackMessage);

            // Draw skeleton
            window.drawConnectors(canvasCtx, landmarks, window.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
            window.drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2, radius: 5 });

            // Highlight incorrect joints in yellow
            if (incorrectLandmarks.length > 0) {
                window.drawLandmarks(canvasCtx, incorrectLandmarks, { color: '#FFFF00', lineWidth: 2, radius: 10 });
            }
        } else {
            feedbackElement.innerHTML = '<p>No person detected. Step into the frame.</p>';
        }
        canvasCtx.restore();
    }

    // --- Initialization ---
    feedbackElement.innerHTML = '<p>Webcam active. Initializing AI model...</p>';

    var pose = new window.Pose({
        locateFile: function (file) {
            return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/' + file;
        }
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    pose.onResults(onResults);

    // Initialize the model, then start camera
    pose.initialize().then(function () {
        feedbackElement.innerHTML = '<p>AI Model loaded. Starting camera...</p>';

        var camera = new window.Camera(videoElement, {
            onFrame: function () {
                return pose.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });

        camera.start().then(function () {
            // Set canvas to match actual video dimensions
            canvasElement.width = 1280;
            canvasElement.height = 720;
            feedbackElement.innerHTML = '<p>Ready! Select an exercise and get into position.</p>';
        }).catch(function (err) {
            console.error('Camera start failed:', err);
            feedbackElement.innerHTML = '<p>Camera access denied. Please allow camera access and reload.</p>';
        });
    }).catch(function (err) {
        console.error('Pose model failed to load:', err);
        feedbackElement.innerHTML = '<p>Failed to load AI model. Check your internet connection and reload.</p>';
    });
})();
