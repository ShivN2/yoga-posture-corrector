(function () {
    var videoElement = document.getElementById('webcam');
    var canvasElement = document.getElementById('output_canvas');
    var canvasCtx = canvasElement.getContext('2d');
    var feedbackElement = document.getElementById('feedback');
    var repCountElement = document.getElementById('rep-count');

    var plankBtn = document.getElementById('plankBtn');
    var pushupBtn = document.getElementById('pushupBtn');
    var lungeBtn = document.getElementById('lungeBtn');

    // Guide overlay elements
    var guideOverlay = document.getElementById('guide-overlay');
    var guideCanvas = document.getElementById('guide_canvas');
    var guideCtx = guideCanvas.getContext('2d');
    var guideViewTag = document.getElementById('guide-view-tag');
    var guideTitle = document.getElementById('guide-title');
    var guideInstructions = document.getElementById('guide-instructions');
    var guideStartBtn = document.getElementById('guide-start-btn');

    // --- Constants ---
    var MIN_VISIBILITY = 0.55;
    var BODY_LANDMARKS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    var BODY_CONNECTIONS = [
        [11, 12], [11, 23], [12, 24], [23, 24],
        [11, 13], [13, 15], [12, 14], [14, 16],
        [23, 25], [25, 27], [24, 26], [26, 28]
    ];

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

    // --- Exercise Guide Data ---
    // Each exercise has: view requirement, instructions, stick figure keyframes
    // Stick figure points are in a local coordinate system [0-1, 0-1]
    // Points: [head, shoulder, elbow, wrist, hip, knee, ankle]
    var exerciseGuides = {
        plank: {
            view: 'SIDE VIEW',
            title: 'Plank',
            instructions: 'Position your camera to the side so your full body is visible from head to toe. Keep your body in a straight line from shoulders to ankles.',
            // Two keyframes for subtle breathing animation
            keyframes: [
                { // Good plank
                    head:     [0.18, 0.32],
                    shoulder: [0.22, 0.38],
                    elbow:    [0.20, 0.52],
                    wrist:    [0.18, 0.68],
                    hip:      [0.50, 0.38],
                    knee:     [0.72, 0.40],
                    ankle:    [0.88, 0.42]
                },
                { // Slight sag (wrong form shown briefly)
                    head:     [0.18, 0.32],
                    shoulder: [0.22, 0.38],
                    elbow:    [0.20, 0.52],
                    wrist:    [0.18, 0.68],
                    hip:      [0.50, 0.48],
                    knee:     [0.72, 0.40],
                    ankle:    [0.88, 0.42]
                }
            ],
            // Labels for joints
            labels: {
                shoulder: 'Shoulder',
                hip: 'Hip aligned',
                knee: 'Straight leg',
                ankle: 'Ankle'
            },
            type: 'hold'
        },
        pushup: {
            view: 'SIDE VIEW',
            title: 'Pushups',
            instructions: 'Position your camera to the side. Start with arms straight, lower until elbows are at 90 degrees, then push back up.',
            keyframes: [
                { // Arms extended (up)
                    head:     [0.18, 0.28],
                    shoulder: [0.22, 0.35],
                    elbow:    [0.20, 0.50],
                    wrist:    [0.18, 0.68],
                    hip:      [0.50, 0.35],
                    knee:     [0.72, 0.37],
                    ankle:    [0.88, 0.40]
                },
                { // Arms bent (down)
                    head:     [0.18, 0.42],
                    shoulder: [0.22, 0.48],
                    elbow:    [0.22, 0.58],
                    wrist:    [0.18, 0.68],
                    hip:      [0.50, 0.46],
                    knee:     [0.72, 0.44],
                    ankle:    [0.88, 0.42]
                }
            ],
            labels: {
                shoulder: 'Shoulder',
                elbow: '90\u00B0 bend',
                hip: 'Hips level',
                ankle: 'Ankle'
            },
            type: 'reps'
        },
        lunge: {
            view: 'SIDE VIEW',
            title: 'Lunges',
            instructions: 'Position your camera to the side. Step one foot forward, keep your torso upright, and lower until both knees are near 90 degrees.',
            keyframes: [
                { // Standing
                    head:     [0.45, 0.10],
                    shoulder: [0.45, 0.22],
                    elbow:    [0.45, 0.35],
                    wrist:    [0.45, 0.42],
                    hip:      [0.45, 0.45],
                    knee:     [0.45, 0.65],
                    ankle:    [0.45, 0.85]
                },
                { // Lunge position
                    head:     [0.45, 0.08],
                    shoulder: [0.45, 0.20],
                    elbow:    [0.45, 0.32],
                    wrist:    [0.45, 0.40],
                    hip:      [0.45, 0.42],
                    frontKnee:  [0.28, 0.58],
                    frontAnkle: [0.22, 0.85],
                    backKnee:   [0.62, 0.62],
                    backAnkle:  [0.78, 0.85]
                }
            ],
            labels: {
                shoulder: 'Upright torso',
                hip: 'Hips low',
                frontKnee: 'Front 90\u00B0',
                backKnee: 'Back 90\u00B0'
            },
            type: 'reps'
        }
    };

    // --- State ---
    var lastSpokenFeedback = '';
    var currentPose = 'plank';
    var currentDifficulty = 'beginner';
    var repCounter = 0;
    var pushupStage = 'up';
    var showingGuide = true;
    var guideAnimFrame = null;
    var guideAnimStart = 0;
    var cameraReady = false;

    // Timer state for hold exercises
    var holdTimerStart = 0;
    var holdTimerActive = false;
    var lastGoodFormTime = 0;

    // Escalating speech backoff state
    var speechRepeatCount = 0;
    var SPEECH_BACKOFF = [3000, 8000, 15000, 30000]; // escalating cooldowns in ms

    // --- Guide Animation ---

    function showGuide(exercise) {
        showingGuide = true;
        guideOverlay.classList.remove('hidden');
        var guide = exerciseGuides[exercise];
        guideViewTag.textContent = guide.view;
        guideTitle.textContent = guide.title;
        guideInstructions.textContent = guide.instructions;
        guideAnimStart = Date.now();
        // Reset timer/counter
        holdTimerStart = 0;
        holdTimerActive = false;
        animateGuide(exercise);
    }

    function hideGuide() {
        showingGuide = false;
        guideOverlay.classList.add('hidden');
        if (guideAnimFrame) {
            cancelAnimationFrame(guideAnimFrame);
            guideAnimFrame = null;
        }
    }

    function animateGuide(exercise) {
        var guide = exerciseGuides[exercise];
        var kf = guide.keyframes;
        var elapsed = Date.now() - guideAnimStart;

        // Set canvas resolution
        guideCanvas.width = 380 * 2;
        guideCanvas.height = 320 * 2;
        guideCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);

        var w = guideCanvas.width;
        var h = guideCanvas.height;

        // Animation cycle: 3 seconds per keyframe transition
        var cycleDuration = 3000;
        var t = (elapsed % (cycleDuration * 2)) / cycleDuration; // 0 to 2
        var progress;
        if (t <= 1) {
            progress = t; // 0→1: keyframe 0 to 1
        } else {
            progress = 2 - t; // 1→0: keyframe 1 back to 0
        }
        // Smooth easing
        progress = progress * progress * (3 - 2 * progress);

        var frame0 = kf[0];
        var frame1 = kf[1];

        // Interpolate points
        function lerp(a, b) {
            return [a[0] + (b[0] - a[0]) * progress, a[1] + (b[1] - a[1]) * progress];
        }

        var pts;
        if (exercise === 'lunge') {
            // Lunge has different structure for the two frames
            if (progress < 0.5) {
                // Transitioning from standing to lunge
                var lp = progress * 2; // 0 to 1
                lp = lp * lp * (3 - 2 * lp);
                pts = {
                    head: lerp(frame0.head, frame1.head),
                    shoulder: lerp(frame0.shoulder, frame1.shoulder),
                    hip: lerp(frame0.hip, frame1.hip),
                    frontKnee: lerpSafe(frame0.knee, frame1.frontKnee, lp),
                    frontAnkle: lerpSafe(frame0.ankle, frame1.frontAnkle, lp),
                    backKnee: lerpSafe(frame0.knee, frame1.backKnee, lp),
                    backAnkle: lerpSafe(frame0.ankle, frame1.backAnkle, lp)
                };
            } else {
                pts = {
                    head: frame1.head,
                    shoulder: frame1.shoulder,
                    hip: frame1.hip,
                    frontKnee: frame1.frontKnee,
                    frontAnkle: frame1.frontAnkle,
                    backKnee: frame1.backKnee,
                    backAnkle: frame1.backAnkle
                };
            }
            drawLungeFigure(pts, w, h, guide.labels, progress);
        } else {
            pts = {
                head: lerp(frame0.head, frame1.head),
                shoulder: lerp(frame0.shoulder, frame1.shoulder),
                elbow: lerp(frame0.elbow, frame1.elbow),
                wrist: lerp(frame0.wrist, frame1.wrist),
                hip: lerp(frame0.hip, frame1.hip),
                knee: lerp(frame0.knee, frame1.knee),
                ankle: lerp(frame0.ankle, frame1.ankle)
            };
            drawStandardFigure(pts, w, h, guide.labels, progress);
        }

        // Show which frame is correct vs incorrect
        var isCorrectFrame = progress < 0.3 || progress > 0.7;
        if (exercise !== 'pushup') {
            // For plank, frame0 is correct, frame1 is wrong (sag)
            drawFormIndicator(w, h, isCorrectFrame);
        } else {
            // For pushup, both frames are valid (up and down positions)
            drawFormIndicator(w, h, true);
        }

        guideAnimFrame = requestAnimationFrame(function () {
            if (showingGuide) animateGuide(exercise);
        });
    }

    function lerpSafe(a, b, t) {
        if (!a || !b) return b || a || [0.5, 0.5];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }

    function drawStandardFigure(pts, w, h, labels, progress) {
        var isGood = progress < 0.3 || progress > 0.7;
        var color = isGood ? '#00FF88' : '#FF6666';
        var jointColor = isGood ? '#FFFFFF' : '#FFAA44';

        // Draw bones
        var bones = [
            ['head', 'shoulder'], ['shoulder', 'elbow'], ['elbow', 'wrist'],
            ['shoulder', 'hip'], ['hip', 'knee'], ['knee', 'ankle']
        ];
        guideCtx.lineWidth = 4;
        guideCtx.strokeStyle = color;
        guideCtx.lineCap = 'round';
        for (var i = 0; i < bones.length; i++) {
            var a = pts[bones[i][0]];
            var b = pts[bones[i][1]];
            guideCtx.beginPath();
            guideCtx.moveTo(a[0] * w, a[1] * h);
            guideCtx.lineTo(b[0] * w, b[1] * h);
            guideCtx.stroke();
        }

        // Draw head circle
        guideCtx.beginPath();
        guideCtx.arc(pts.head[0] * w, pts.head[1] * h, 14, 0, Math.PI * 2);
        guideCtx.fillStyle = color;
        guideCtx.fill();

        // Draw joints
        var jointNames = ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle'];
        for (var j = 0; j < jointNames.length; j++) {
            var p = pts[jointNames[j]];
            guideCtx.beginPath();
            guideCtx.arc(p[0] * w, p[1] * h, 6, 0, Math.PI * 2);
            guideCtx.fillStyle = jointColor;
            guideCtx.fill();
        }

        // Draw labels for key joints
        guideCtx.font = 'bold 20px Arial';
        guideCtx.fillStyle = 'rgba(255,255,255,0.8)';
        var labelKeys = Object.keys(labels);
        for (var l = 0; l < labelKeys.length; l++) {
            var key = labelKeys[l];
            if (pts[key]) {
                guideCtx.fillText(labels[key], pts[key][0] * w + 12, pts[key][1] * h - 8);
            }
        }
    }

    function drawLungeFigure(pts, w, h, labels, progress) {
        var color = '#00FF88';
        var jointColor = '#FFFFFF';

        // Bones
        var bones = [
            ['head', 'shoulder'], ['shoulder', 'hip'],
            ['hip', 'frontKnee'], ['frontKnee', 'frontAnkle'],
            ['hip', 'backKnee'], ['backKnee', 'backAnkle']
        ];
        guideCtx.lineWidth = 4;
        guideCtx.strokeStyle = color;
        guideCtx.lineCap = 'round';
        for (var i = 0; i < bones.length; i++) {
            var a = pts[bones[i][0]];
            var b = pts[bones[i][1]];
            if (!a || !b) continue;
            guideCtx.beginPath();
            guideCtx.moveTo(a[0] * w, a[1] * h);
            guideCtx.lineTo(b[0] * w, b[1] * h);
            guideCtx.stroke();
        }

        // Head
        guideCtx.beginPath();
        guideCtx.arc(pts.head[0] * w, pts.head[1] * h, 14, 0, Math.PI * 2);
        guideCtx.fillStyle = color;
        guideCtx.fill();

        // Joints
        var jointNames = ['shoulder', 'hip', 'frontKnee', 'frontAnkle', 'backKnee', 'backAnkle'];
        for (var j = 0; j < jointNames.length; j++) {
            var p = pts[jointNames[j]];
            if (!p) continue;
            guideCtx.beginPath();
            guideCtx.arc(p[0] * w, p[1] * h, 6, 0, Math.PI * 2);
            guideCtx.fillStyle = jointColor;
            guideCtx.fill();
        }

        // Labels
        guideCtx.font = 'bold 20px Arial';
        guideCtx.fillStyle = 'rgba(255,255,255,0.8)';
        var labelKeys = Object.keys(labels);
        for (var l = 0; l < labelKeys.length; l++) {
            var key = labelKeys[l];
            if (pts[key]) {
                guideCtx.fillText(labels[key], pts[key][0] * w + 12, pts[key][1] * h - 8);
            }
        }
    }

    function drawFormIndicator(w, h, isGood) {
        guideCtx.font = 'bold 22px Arial';
        guideCtx.textAlign = 'center';
        if (isGood) {
            guideCtx.fillStyle = '#00FF88';
            guideCtx.fillText('\u2713 Correct Form', w / 2, h - 20);
        } else {
            guideCtx.fillStyle = '#FF6666';
            guideCtx.fillText('\u2717 Common Mistake', w / 2, h - 20);
        }
        guideCtx.textAlign = 'left';
    }

    // --- Timer / Counter Display ---

    function formatTime(seconds) {
        var m = Math.floor(seconds / 60);
        var s = seconds % 60;
        return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }

    function updateTimerDisplay() {
        var guide = exerciseGuides[currentPose];
        if (guide.type === 'hold') {
            if (holdTimerActive) {
                var elapsed = Math.floor((Date.now() - holdTimerStart) / 1000);
                repCountElement.innerText = formatTime(elapsed);
            } else {
                repCountElement.innerText = '00:00';
            }
        } else {
            repCountElement.innerText = repCounter;
        }
    }

    // --- UI ---
    plankBtn.addEventListener('click', function () {
        currentPose = 'plank';
        repCounter = 0;
        holdTimerActive = false;
        showGuide('plank');
        updateActiveButton(plankBtn);
    });
    pushupBtn.addEventListener('click', function () {
        currentPose = 'pushup';
        repCounter = 0;
        pushupStage = 'up';
        holdTimerActive = false;
        showGuide('pushup');
        updateActiveButton(pushupBtn);
    });
    lungeBtn.addEventListener('click', function () {
        currentPose = 'lunge';
        repCounter = 0;
        holdTimerActive = false;
        showGuide('lunge');
        updateActiveButton(lungeBtn);
    });

    guideStartBtn.addEventListener('click', function () {
        hideGuide();
    });

    // Difficulty buttons
    var diffButtons = document.querySelectorAll('.btn-diff');
    for (var di = 0; di < diffButtons.length; di++) {
        diffButtons[di].addEventListener('click', function () {
            currentDifficulty = this.getAttribute('data-level');
            for (var dj = 0; dj < diffButtons.length; dj++) {
                diffButtons[dj].classList.remove('active');
            }
            this.classList.add('active');
            speechRepeatCount = 0;
            lastSpokenFeedback = '';
        });
    }

    function updateActiveButton(activeBtn) {
        var buttons = document.querySelectorAll('.btn-exercise');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].classList.remove('active');
        }
        activeBtn.classList.add('active');
        // Update counter label
        var guide = exerciseGuides[currentPose];
        var counterLabel = document.getElementById('counter-label');
        if (guide.type === 'hold') {
            counterLabel.textContent = 'TIME: ';
        } else {
            counterLabel.textContent = 'REPS: ';
        }
        updateTimerDisplay();
        setFeedback(positionGuide[currentPose], '#42a5f5');
        lastSpokenFeedback = '';
    }

    // --- Speech ---
    var speaker = new SpeechSynthesisUtterance();
    speaker.rate = 1.0;
    speaker.lang = 'en-US';
    var lastSpeakTime = 0;

    function speak(text) {
        var now = Date.now();
        if (!text) return;

        // Different message or good form resets the backoff
        if (text !== lastSpokenFeedback) {
            speechRepeatCount = 0;
            lastSpokenFeedback = text;
            lastSpeakTime = 0; // allow immediate speak
        }

        var cooldown = SPEECH_BACKOFF[Math.min(speechRepeatCount, SPEECH_BACKOFF.length - 1)];
        if ((now - lastSpeakTime) > cooldown) {
            lastSpeakTime = now;
            speechRepeatCount++;
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

    function isHipSagging(shoulder, hip, ankle) {
        var dx = ankle.x - shoulder.x;
        if (Math.abs(dx) < 0.01) return false;
        var t = (hip.x - shoulder.x) / dx;
        var expectedY = shoulder.y + t * (ankle.y - shoulder.y);
        return hip.y > expectedY + 0.02;
    }

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

        var torsoAngle = Math.abs(Math.atan2(
            midHipX - midShoulderX,
            midHipY - midShoulderY
        )) * (180 / Math.PI);

        if (exercise === 'plank' || exercise === 'pushup') {
            if (torsoAngle < 45) return false;
            var bodyLineAngle = calculateAngle(
                { x: midShoulderX, y: midShoulderY },
                { x: midHipX, y: midHipY },
                { x: midAnkleX, y: midAnkleY }
            );
            return bodyLineAngle > 140;
        }

        if (exercise === 'lunge') {
            if (torsoAngle > 35) return false;
            var leftKneeAngle = calculateAngle(lHip, lKnee, lAnkle);
            var rightKneeAngle = calculateAngle(rHip, rKnee, rAnkle);
            return leftKneeAngle < 140 || rightKneeAngle < 140;
        }

        return false;
    }

    // --- Custom Skeleton Drawing ---

    function drawSkeleton(landmarks, incorrectIndices) {
        var w = canvasElement.width;
        var h = canvasElement.height;

        var errSet = {};
        for (var e = 0; e < incorrectIndices.length; e++) {
            errSet[incorrectIndices[e]] = true;
        }

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
        // Don't process if guide is showing
        if (showingGuide) return;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

        if (!results.poseLandmarks) {
            setFeedback('No person detected. Step into the frame.', '#ff9800');
            holdTimerActive = false;
            updateTimerDisplay();
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
            holdTimerActive = false;
            updateTimerDisplay();
            drawSkeleton(landmarks, incorrectIndices);
            canvasCtx.restore();
            return;
        }

        // STEP 2: Exercise position check
        if (!isInExercisePosition(landmarks, exercise)) {
            setFeedback(positionGuide[currentPose], '#42a5f5');
            speak(positionGuide[currentPose]);
            holdTimerActive = false;
            updateTimerDisplay();
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
            var lKneeA = calculateAngle(points.leftHip, points.leftKnee, points.leftAnkle);
            var rKneeA = calculateAngle(points.rightHip, points.rightKnee, points.rightAnkle);
            var front = (lKneeA < rKneeA) ? 'left' : 'right';

            var midShoulder = {
                x: (points.leftShoulder.x + points.rightShoulder.x) / 2,
                y: (points.leftShoulder.y + points.rightShoulder.y) / 2
            };
            var midHip = {
                x: (points.leftHip.x + points.rightHip.x) / 2,
                y: (points.leftHip.y + points.rightHip.y) / 2
            };
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
            poseRules = poses[currentDifficulty].lunge;

        } else {
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
                poseRules = poses[currentDifficulty]['pushup_' + pushupStage];
                var avgElbow = (angles.left_elbow_angle + angles.right_elbow_angle) / 2;
                if (pushupStage === 'up' && avgElbow < 100) {
                    pushupStage = 'down';
                } else if (pushupStage === 'down' && avgElbow > 160) {
                    pushupStage = 'up';
                    repCounter++;
                    updateTimerDisplay();
                }
            } else {
                poseRules = poses[currentDifficulty].plank;
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

        var feedbackMessage = 'Great Form! Hold it.';
        var feedbackColor = '#4caf50';
        var isGoodForm = true;

        if (violations.length === 0) {
            // Good form: reset speech backoff so next correction is immediate
            speechRepeatCount = 0;
            lastSpokenFeedback = '';
        }

        if (violations.length > 0) {
            violations.sort(function (a, b) {
                if (b.severity !== a.severity) return b.severity - a.severity;
                return b.deviation - a.deviation;
            });
            feedbackMessage = violations[0].message;
            feedbackColor = '#ff5252';
            isGoodForm = false;
            for (var v = 0; v < violations.length; v++) {
                for (var li = 0; li < violations[v].landmarks.length; li++) {
                    incorrectIndices.push(violations[v].landmarks[li]);
                }
            }
        }

        // Timer logic for hold exercises (plank)
        if (exerciseGuides[currentPose].type === 'hold') {
            if (isGoodForm) {
                if (!holdTimerActive) {
                    holdTimerActive = true;
                    holdTimerStart = Date.now();
                }
            } else {
                // Pause timer on bad form (don't reset, just pause)
                if (holdTimerActive) {
                    holdTimerActive = false;
                }
            }
            updateTimerDisplay();
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
            canvasElement.width = window.innerWidth;
            canvasElement.height = window.innerHeight;
            cameraReady = true;
            // Show guide for default exercise on first load
            showGuide(currentPose);
            updateActiveButton(plankBtn);
        }).catch(function (err) {
            console.error('Camera start failed:', err);
            setFeedback('Camera access denied. Allow camera and reload.', '#ff5252');
        });
    }).catch(function (err) {
        console.error('Pose model failed to load:', err);
        setFeedback('Failed to load AI model. Check internet and reload.', '#ff5252');
    });

    window.addEventListener('resize', function () {
        canvasElement.width = window.innerWidth;
        canvasElement.height = window.innerHeight;
    });
})();
