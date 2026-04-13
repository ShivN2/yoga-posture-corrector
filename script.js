(function () {
    var videoElement = document.getElementById('webcam');
    var canvasElement = document.getElementById('output_canvas');
    var canvasCtx = canvasElement.getContext('2d');
    var feedbackElement = document.getElementById('feedback');
    var repCountElement = document.getElementById('rep-count');

    var plankBtn = document.getElementById('plankBtn');
    var pushupBtn = document.getElementById('pushupBtn');
    var lungeBtn = document.getElementById('lungeBtn');

    // --- Constants ---
    var MIN_VISIBILITY = 0.55;

    // Body-only landmark indices (no face, no hands/feet detail)
    var BODY_LANDMARKS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

    // Custom bone connections (body skeleton only)
    var BODY_CONNECTIONS = [
        [11, 12], // shoulder to shoulder
        [11, 23], // left shoulder to left hip
        [12, 24], // right shoulder to right hip
        [23, 24], // hip to hip
        [11, 13], // left upper arm
        [13, 15], // left forearm
        [12, 14], // right upper arm
        [14, 16], // right forearm
        [23, 25], // left thigh
        [25, 27], // left shin
        [24, 26], // right thigh
        [26, 28]  // right shin
    ];

    // Required landmarks per exercise for visibility check
    var requiredLandmarks = {
        plank:  [11, 12, 23, 24, 25, 26, 27, 28],
        pushup: [11, 12, 13, 14, 15, 16, 23, 24, 25, 26],
        lunge:  [11, 12, 23, 24, 25, 26, 27, 28]
    };

    var positionGuide = {
        plank: 'Get into a plank: arms straight, body in a line. Face the camera from the side.',
        pushup: 'Get into pushup position: arms straight, body in a line. Face the camera from the side.',
        lunge: 'Stand sideways to the camera. Step one foot forward and lower your hips.'
    };

    // --- State ---
    var lastSpokenFeedback = '';
    var currentPose = 'plank';
    var repCounter = 0;
    var pushupStage = 'up';

    // --- UI ---
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
        setFeedback(positionGuide[currentPose], '#42a5f5');
        lastSpokenFeedback = '';
    }

    // --- Speech ---
    var speaker = new SpeechSynthesisUtterance();
    speaker.rate = 1.0;
    speaker.lang = 'en-US';
    var lastSpeakTime = 0;
    var SPEAK_COOLDOWN = 3000;

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

    // --- Helpers ---

    function setFeedback(message, color) {
        feedbackElement.innerHTML = '<p>' + message + '</p>';
        feedbackElement.style.borderLeftColor = color;
    }

    function checkBodyVisibility(landmarks, exercise) {
        var required = requiredLandmarks[exercise] || requiredLandmarks.plank;
        var visibleCount = 0;
        for (var i = 0; i < required.length; i++) {
            if (landmarks[required[i]] && landmarks[required[i]].visibility >= MIN_VISIBILITY) {
                visibleCount++;
            }
        }
        return visibleCount / required.length;
    }

    // Determine if hip is sagging or piking relative to shoulder-ankle line
    function isHipSagging(shoulder, hip, ankle) {
        var dx = ankle.x - shoulder.x;
        if (Math.abs(dx) < 0.01) return false; // near-vertical view, can't tell
        var t = (hip.x - shoulder.x) / dx;
        var expectedY = shoulder.y + t * (ankle.y - shoulder.y);
        // In normalized coords, Y increases downward. Hip below line = sagging.
        return hip.y > expectedY + 0.02;
    }

    // Angle-based position detection
    function isInExercisePosition(landmarks, exercise) {
        var lShoulder = landmarks[11], rShoulder = landmarks[12];
        var lHip = landmarks[23], rHip = landmarks[24];
        var lKnee = landmarks[25], rKnee = landmarks[26];
        var lAnkle = landmarks[27], rAnkle = landmarks[28];

        var midShoulderX = (lShoulder.x + rShoulder.x) / 2;
        var midShoulderY = (lShoulder.y + rShoulder.y) / 2;
        var midHipX = (lHip.x + rHip.x) / 2;
        var midHipY = (lHip.y + rHip.y) / 2;
        var midAnkleX = (lAnkle.x + rAnkle.x) / 2;
        var midAnkleY = (lAnkle.y + rAnkle.y) / 2;

        // Torso angle from vertical: 0 = upright, 90 = horizontal
        var torsoAngle = Math.abs(Math.atan2(
            midHipX - midShoulderX,
            midHipY - midShoulderY
        )) * (180 / Math.PI);

        if (exercise === 'plank' || exercise === 'pushup') {
            // Torso should be far from vertical (> 45 deg)
            if (torsoAngle < 45) return false;
            // Shoulder-hip-ankle should be roughly straight (> 140 deg)
            var bodyLineAngle = calculateAngle(
                { x: midShoulderX, y: midShoulderY },
                { x: midHipX, y: midHipY },
                { x: midAnkleX, y: midAnkleY }
            );
            return bodyLineAngle > 140;
        }

        if (exercise === 'lunge') {
            // Torso should be mostly upright (< 35 deg from vertical)
            if (torsoAngle > 35) return false;
            // At least one knee should be significantly bent
            var leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
            var rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
            return leftKneeAngle < 140 || rightKneeAngle < 140;
        }

        return false;
    }

    // --- Custom Skeleton Drawing (body only, no face) ---

    function drawSkeleton(landmarks, incorrectIndices) {
        var w = canvasElement.width;
        var h = canvasElement.height;

        // Build set of incorrect indices for fast lookup
        var errSet = {};
        for (var e = 0; e < incorrectIndices.length; e++) {
            errSet[incorrectIndices[e]] = true;
        }

        // Draw bone connections
        for (var c = 0; c < BODY_CONNECTIONS.length; c++) {
            var si = BODY_CONNECTIONS[c][0];
            var ei = BODY_CONNECTIONS[c][1];
            var sLm = landmarks[si];
            var eLm = landmarks[ei];

            if (sLm.visibility < MIN_VISIBILITY || eLm.visibility < MIN_VISIBILITY) continue;

            var isErr = errSet[si] || errSet[ei];

            canvasCtx.beginPath();
            canvasCtx.moveTo(sLm.x * w, sLm.y * h);
            canvasCtx.lineTo(eLm.x * w, eLm.y * h);
            canvasCtx.strokeStyle = isErr ? '#FF4444' : '#00FF88';
            canvasCtx.lineWidth = isErr ? 5 : 3;
            canvasCtx.stroke();
        }

        // Draw joint dots (body only)
        for (var j = 0; j < BODY_LANDMARKS.length; j++) {
            var idx = BODY_LANDMARKS[j];
            var lm = landmarks[idx];
            if (lm.visibility < MIN_VISIBILITY) continue;

            var isErrJoint = errSet[idx];
            canvasCtx.beginPath();
            canvasCtx.arc(lm.x * w, lm.y * h, isErrJoint ? 9 : 5, 0, 2 * Math.PI);
            canvasCtx.fillStyle = isErrJoint ? '#FFFF00' : '#FFFFFF';
            canvasCtx.fill();
            canvasCtx.strokeStyle = isErrJoint ? '#FF4444' : '#00AA66';
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();
        }
    }

    // --- Core Results Callback ---

    function onResults(results) {
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (!results.poseLandmarks) {
            setFeedback('No person detected. Step into the frame.', '#ff9800');
            canvasCtx.restore();
            return;
        }

        var landmarks = results.poseLandmarks;
        var incorrectIndices = [];
        var exercise = (currentPose === 'pushup') ? 'pushup' : currentPose;

        // STEP 1: Body visibility check
        var visRatio = checkBodyVisibility(landmarks, exercise);
        if (visRatio < 0.6) {
            setFeedback('Step back so the camera can see your full body.', '#ff9800');
            speak('Step back so the camera can see your full body.');
            drawSkeleton(landmarks, incorrectIndices);
            canvasCtx.restore();
            return;
        }

        // STEP 2: Exercise position check
        if (!isInExercisePosition(landmarks, exercise)) {
            setFeedback(positionGuide[currentPose], '#42a5f5');
            speak(positionGuide[currentPose]);
            drawSkeleton(landmarks, incorrectIndices);
            canvasCtx.restore();
            return;
        }

        // STEP 3: Calculate angles and evaluate form
        var points = {
            leftShoulder: landmarks[11], leftElbow: landmarks[13], leftWrist: landmarks[15],
            leftHip: landmarks[23], leftKnee: landmarks[25], leftAnkle: landmarks[27],
            rightShoulder: landmarks[12], rightElbow: landmarks[14], rightWrist: landmarks[16],
            rightHip: landmarks[24], rightKnee: landmarks[26], rightAnkle: landmarks[28]
        };

        var angles, angleLandmarkMap, poseRules;

        if (currentPose === 'lunge') {
            // Determine front vs back leg (front = more bent knee)
            var lKneeA = calculateAngle(points.leftHip, points.leftKnee, points.leftAnkle);
            var rKneeA = calculateAngle(points.rightHip, points.rightKnee, points.rightAnkle);

            var front = (lKneeA < rKneeA) ? 'left' : 'right';
            var back = (front === 'left') ? 'right' : 'left';

            var midShoulder = {
                x: (points.leftShoulder.x + points.rightShoulder.x) / 2,
                y: (points.leftShoulder.y + points.rightShoulder.y) / 2
            };
            var midHip = {
                x: (points.leftHip.x + points.rightHip.x) / 2,
                y: (points.leftHip.y + points.rightHip.y) / 2
            };
            // Virtual point directly below hip for torso-upright measurement
            var belowHip = { x: midHip.x, y: midHip.y + 0.1 };

            angles = {
                front_knee_angle: (front === 'left') ? lKneeA : rKneeA,
                back_knee_angle: (front === 'left') ? rKneeA : lKneeA,
                front_hip_angle: calculateAngle(
                    points[front + 'Shoulder'], points[front + 'Hip'], points[front + 'Knee']
                ),
                torso_upright: calculateAngle(midShoulder, midHip, belowHip)
            };

            var fKneeIdx = (front === 'left') ? 25 : 26;
            var bKneeIdx = (front === 'left') ? 26 : 25;
            var fHipIdx = (front === 'left') ? 23 : 24;

            angleLandmarkMap = {
                'front_knee_angle': [fKneeIdx],
                'back_knee_angle': [bKneeIdx],
                'front_hip_angle': [fHipIdx],
                'torso_upright': [11, 12, 23, 24]
            };

            poseRules = poses.lunge;

        } else {
            // Plank / Pushup
            angles = {
                left_knee_angle: calculateAngle(points.leftHip, points.leftKnee, points.leftAnkle),
                right_knee_angle: calculateAngle(points.rightHip, points.rightKnee, points.rightAnkle),
                left_hip_angle: calculateAngle(points.leftShoulder, points.leftHip, points.leftKnee),
                right_hip_angle: calculateAngle(points.rightShoulder, points.rightHip, points.rightKnee),
                left_elbow_angle: calculateAngle(points.leftShoulder, points.leftElbow, points.leftWrist),
                right_elbow_angle: calculateAngle(points.rightShoulder, points.rightElbow, points.rightWrist)
            };

            angleLandmarkMap = {
                'left_knee_angle': [25], 'right_knee_angle': [26],
                'left_hip_angle': [23], 'right_hip_angle': [24],
                'left_elbow_angle': [13], 'right_elbow_angle': [14]
            };

            if (currentPose === 'pushup') {
                poseRules = poses['pushup_' + pushupStage];
                var avgElbow = (angles.left_elbow_angle + angles.right_elbow_angle) / 2;
                if (pushupStage === 'up' && avgElbow < 100) {
                    pushupStage = 'down';
                } else if (pushupStage === 'down' && avgElbow > 160) {
                    pushupStage = 'up';
                    repCounter++;
                    repCountElement.innerText = repCounter;
                }
            } else {
                poseRules = poses.plank;
            }
        }

        // Collect ALL violations
        var violations = [];
        if (poseRules) {
            var angleNames = Object.keys(angles);
            for (var i = 0; i < angleNames.length; i++) {
                var name = angleNames[i];
                var value = angles[name];
                var rule = poseRules[name];
                if (!rule) continue;

                var deviation = 0;
                var msg = null;

                if (value < rule.range[0]) {
                    deviation = rule.range[0] - value;

                    // Special hip sagging detection for plank/pushup
                    if ((currentPose === 'plank' || currentPose === 'pushup') && name.indexOf('hip') !== -1) {
                        var side = (name.indexOf('left') !== -1) ? 'left' : 'right';
                        if (isHipSagging(points[side + 'Shoulder'], points[side + 'Hip'], points[side + 'Ankle'])) {
                            msg = 'Raise your hips. They are sagging.';
                        } else {
                            msg = 'Lower your hips. They are too high.';
                        }
                    } else if (rule.feedback_low) {
                        msg = rule.feedback_low;
                    }
                } else if (value > rule.range[1]) {
                    deviation = value - rule.range[1];

                    if ((currentPose === 'plank' || currentPose === 'pushup') && name.indexOf('hip') !== -1) {
                        // Angle > 180 range max shouldn't happen, but handle it
                        msg = 'Lower your hips slightly.';
                    } else if (rule.feedback_high) {
                        msg = rule.feedback_high;
                    }
                }

                if (msg) {
                    var badIdx = angleLandmarkMap[name] || [];
                    violations.push({
                        message: msg,
                        severity: rule.severity || 1,
                        deviation: deviation,
                        landmarks: badIdx
                    });
                }
            }
        }

        // Show highest-priority violation, highlight ALL bad joints
        var feedbackMessage = 'Great Form! Hold it.';
        var feedbackColor = '#4caf50';

        if (violations.length > 0) {
            violations.sort(function (a, b) {
                if (b.severity !== a.severity) return b.severity - a.severity;
                return b.deviation - a.deviation;
            });
            feedbackMessage = violations[0].message;
            feedbackColor = '#ff5252';
            for (var v = 0; v < violations.length; v++) {
                for (var li = 0; li < violations[v].landmarks.length; li++) {
                    incorrectIndices.push(violations[v].landmarks[li]);
                }
            }
        }

        setFeedback(feedbackMessage, feedbackColor);
        speak(feedbackMessage);
        drawSkeleton(landmarks, incorrectIndices);
        canvasCtx.restore();
    }

    // --- Initialization ---
    feedbackElement.innerHTML = '<p>Initializing AI model...</p>';

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
            // Size canvas to viewport
            canvasElement.width = window.innerWidth;
            canvasElement.height = window.innerHeight;
            setFeedback(positionGuide[currentPose], '#42a5f5');
        }).catch(function (err) {
            console.error('Camera start failed:', err);
            setFeedback('Camera access denied. Allow camera and reload.', '#ff5252');
        });
    }).catch(function (err) {
        console.error('Pose model failed to load:', err);
        setFeedback('Failed to load AI model. Check internet and reload.', '#ff5252');
    });

    // Keep canvas sized to viewport on resize
    window.addEventListener('resize', function () {
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
    });
})();
