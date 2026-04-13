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

    // Minimum visibility confidence for a landmark to count as "visible"
    var MIN_VISIBILITY = 0.6;

    // Which landmark indices are required to be visible for each exercise
    // MediaPipe pose landmark indices:
    // 11=left_shoulder, 12=right_shoulder, 13=left_elbow, 14=right_elbow,
    // 15=left_wrist, 16=right_wrist, 23=left_hip, 24=right_hip,
    // 25=left_knee, 26=right_knee, 27=left_ankle, 28=right_ankle
    var requiredLandmarks = {
        plank:  [11, 12, 23, 24, 25, 26, 27, 28],          // shoulders, hips, knees, ankles
        pushup: [11, 12, 13, 14, 15, 16, 23, 24, 25, 26],  // shoulders, elbows, wrists, hips, knees
        lunge:  [23, 24, 25, 26, 27, 28]                    // hips, knees, ankles
    };

    // What body orientation roughly looks like for each exercise
    // We check if the person is roughly horizontal (plank/pushup) or vertical (lunge)
    function detectBodyOrientation(landmarks) {
        var lShoulder = landmarks[11];
        var rShoulder = landmarks[12];
        var lAnkle = landmarks[27];
        var rAnkle = landmarks[28];
        var lHip = landmarks[23];
        var rHip = landmarks[24];

        // Average shoulder and ankle/hip positions
        var shoulderY = (lShoulder.y + rShoulder.y) / 2;
        var hipY = (lHip.y + rHip.y) / 2;
        var ankleY = (lAnkle.y + rAnkle.y) / 2;

        var shoulderX = (lShoulder.x + rShoulder.x) / 2;
        var hipX = (lHip.x + rHip.x) / 2;
        var ankleX = (lAnkle.x + rAnkle.x) / 2;

        // Vertical span (shoulder to ankle in Y) vs horizontal span
        var verticalSpan = Math.abs(ankleY - shoulderY);
        var horizontalSpan = Math.abs(ankleX - shoulderX);

        // If horizontal span > vertical span, body is roughly horizontal
        if (horizontalSpan > verticalSpan * 0.8) {
            return 'horizontal';
        }
        // If the torso is mostly upright
        if (verticalSpan > horizontalSpan * 0.8) {
            return 'vertical';
        }
        return 'unknown';
    }

    // Check if user is roughly in the right position for the selected exercise
    function isInExercisePosition(landmarks, exercise) {
        var orientation = detectBodyOrientation(landmarks);

        var lHip = landmarks[23];
        var rHip = landmarks[24];
        var lKnee = landmarks[25];
        var rKnee = landmarks[26];
        var lShoulder = landmarks[11];
        var rShoulder = landmarks[12];

        var hipY = (lHip.y + rHip.y) / 2;
        var shoulderY = (lShoulder.y + rShoulder.y) / 2;
        var kneeY = (lKnee.y + rKnee.y) / 2;

        if (exercise === 'plank' || exercise === 'pushup') {
            // For plank/pushup, body should be roughly horizontal
            // and hands should be on the ground (wrists below shoulders)
            return orientation === 'horizontal';
        }

        if (exercise === 'lunge') {
            // For lunge, body should be roughly vertical (upright torso)
            // and at least one knee should be significantly bent
            if (orientation !== 'vertical') return false;

            // Check if hips are lowered (below normal standing — hips closer to knees)
            var hipToKneeRatio = Math.abs(kneeY - hipY);
            var shoulderToHipRatio = Math.abs(hipY - shoulderY);
            // In a lunge the hips drop, so hip-to-knee distance shrinks relative to shoulder-to-hip
            return hipToKneeRatio < shoulderToHipRatio * 1.2;
        }

        return false;
    }

    // Check how many required landmarks are visible
    function checkBodyVisibility(landmarks, exercise) {
        var required = requiredLandmarks[exercise] || requiredLandmarks.plank;
        var visibleCount = 0;
        var missingParts = [];

        for (var i = 0; i < required.length; i++) {
            var idx = required[i];
            var lm = landmarks[idx];
            if (lm && lm.visibility >= MIN_VISIBILITY) {
                visibleCount++;
            } else {
                missingParts.push(idx);
            }
        }

        return {
            ratio: visibleCount / required.length,
            visibleCount: visibleCount,
            totalRequired: required.length,
            missingParts: missingParts
        };
    }

    // Convert missing landmark indices to human-readable body part names
    function describeMissingParts(missingIndices) {
        var partNames = {
            11: 'left shoulder', 12: 'right shoulder',
            13: 'left elbow', 14: 'right elbow',
            15: 'left wrist', 16: 'right wrist',
            23: 'left hip', 24: 'right hip',
            25: 'left knee', 26: 'right knee',
            27: 'left ankle', 28: 'right ankle'
        };
        // Group into body regions
        var regions = [];
        var hasUpper = false, hasLower = false;
        for (var i = 0; i < missingIndices.length; i++) {
            var idx = missingIndices[i];
            if (idx <= 16) hasUpper = true;
            if (idx >= 23) hasLower = true;
        }
        if (hasLower && hasUpper) return 'your full body';
        if (hasLower) return 'your legs and hips';
        if (hasUpper) return 'your arms and shoulders';
        return 'some body parts';
    }

    // Guidance text for getting into position
    var positionGuide = {
        plank: 'Get into a plank: arms straight, body in a line, face the camera from the side.',
        pushup: 'Get into pushup position: arms straight, body in a line, face the camera from the side.',
        lunge: 'Stand facing the camera from the side, then step one foot forward and lower your hips.'
    };

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
        feedbackElement.innerHTML = '<p>' + positionGuide[currentPose] + '</p>';
        lastSpokenFeedback = "";
    }

    // Text to Speech
    var speaker = new SpeechSynthesisUtterance();
    speaker.rate = 1.0;
    speaker.lang = 'en-US';
    var lastSpeakTime = 0;
    var SPEAK_COOLDOWN = 3000; // Don't repeat audio more than once every 3 seconds

    function speak(text) {
        var now = Date.now();
        if (text && text !== lastSpokenFeedback && (now - lastSpeakTime) > SPEAK_COOLDOWN) {
            lastSpokenFeedback = text;
            lastSpeakTime = now;
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
            var feedbackMessage = '';
            var feedbackColor = '#fff';
            var incorrectLandmarks = [];

            // STEP 1: Check if enough of the body is visible
            var exercise = (currentPose === 'pushup') ? 'pushup' : currentPose;
            var visibility = checkBodyVisibility(landmarks, exercise);

            if (visibility.ratio < 0.6) {
                // Not enough body visible
                var missingDesc = describeMissingParts(visibility.missingParts);
                feedbackMessage = 'Step back so the camera can see ' + missingDesc + '.';
                feedbackColor = '#ff9800';

                setFeedback(feedbackMessage, feedbackColor);
                speak(feedbackMessage);
                drawSkeleton(landmarks, incorrectLandmarks);
                canvasCtx.restore();
                return;
            }

            // STEP 2: Check if user is in the right position for this exercise
            if (!isInExercisePosition(landmarks, exercise)) {
                feedbackMessage = positionGuide[currentPose];
                feedbackColor = '#42a5f5';

                setFeedback(feedbackMessage, feedbackColor);
                speak(feedbackMessage);
                drawSkeleton(landmarks, incorrectLandmarks);
                canvasCtx.restore();
                return;
            }

            // STEP 3: User is in position — evaluate form
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

            // Default to good form — only override if a rule is violated
            feedbackMessage = 'Great Form! Hold it.';
            feedbackColor = '#4caf50';

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
                            feedbackColor = '#ff5252';
                            if (angleName.indexOf('knee') !== -1) badPoints.push(points.leftKnee, points.rightKnee);
                            if (angleName.indexOf('hip') !== -1) badPoints.push(points.leftHip, points.rightHip);
                            if (angleName.indexOf('elbow') !== -1) badPoints.push(points.leftElbow, points.rightElbow);
                        } else if (angleValue > rule.range[1] && rule.feedback_high) {
                            feedbackMessage = rule.feedback_high;
                            feedbackColor = '#ff5252';
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

            setFeedback(feedbackMessage, feedbackColor);
            speak(feedbackMessage);
            drawSkeleton(landmarks, incorrectLandmarks);

        } else {
            feedbackElement.innerHTML = '<p>No person detected. Step into the frame.</p>';
            feedbackElement.style.borderLeft = '4px solid #ff9800';
        }
        canvasCtx.restore();
    }

    function setFeedback(message, color) {
        feedbackElement.innerHTML = '<p>' + message + '</p>';
        feedbackElement.style.borderLeft = '4px solid ' + color;
    }

    function drawSkeleton(landmarks, incorrectLandmarks) {
        window.drawConnectors(canvasCtx, landmarks, window.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        window.drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2, radius: 5 });
        if (incorrectLandmarks.length > 0) {
            window.drawLandmarks(canvasCtx, incorrectLandmarks, { color: '#FFFF00', lineWidth: 2, radius: 10 });
        }
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
            canvasElement.width = 1280;
            canvasElement.height = 720;
            feedbackElement.innerHTML = '<p>' + positionGuide[currentPose] + '</p>';
        }).catch(function (err) {
            console.error('Camera start failed:', err);
            feedbackElement.innerHTML = '<p>Camera access denied. Please allow camera access and reload.</p>';
        });
    }).catch(function (err) {
        console.error('Pose model failed to load:', err);
        feedbackElement.innerHTML = '<p>Failed to load AI model. Check your internet connection and reload.</p>';
    });
})();
