var poses = {
    beginner: {
        "plank": {
            'left_hip_angle':  { range: [140, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [140, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [145, 180], feedback_low: 'Straighten your left leg.', feedback_high: null, severity: 2 },
            'right_knee_angle': { range: [145, 180], feedback_low: 'Straighten your right leg.', feedback_high: null, severity: 2 }
        },
        "pushup_up": {
            'left_elbow_angle':  { range: [150, 180], feedback_low: 'Straighten your arms.', feedback_high: null, severity: 2 },
            'right_elbow_angle': { range: [150, 180], feedback_low: 'Straighten your arms.', feedback_high: null, severity: 2 },
            'left_hip_angle':  { range: [140, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [140, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [145, 180], feedback_low: 'Straighten your legs.', feedback_high: null, severity: 1 },
            'right_knee_angle': { range: [145, 180], feedback_low: 'Straighten your legs.', feedback_high: null, severity: 1 }
        },
        "pushup_down": {
            'left_elbow_angle':  { range: [60, 110], feedback_low: 'Go lower.', feedback_high: 'Bend your arms more.', severity: 2 },
            'right_elbow_angle': { range: [60, 110], feedback_low: 'Go lower.', feedback_high: 'Bend your arms more.', severity: 2 },
            'left_hip_angle':  { range: [140, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [140, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [145, 180], feedback_low: 'Keep your legs straight.', feedback_high: null, severity: 1 },
            'right_knee_angle': { range: [145, 180], feedback_low: 'Keep your legs straight.', feedback_high: null, severity: 1 }
        },
        "lunge": {
            'front_knee_angle': { range: [70, 115], feedback_low: 'Bend your front knee more.', feedback_high: 'Your front knee is too straight. Lower your hips.', severity: 3 },
            'back_knee_angle':  { range: [80, 150], feedback_low: 'Extend your back leg more.', feedback_high: 'Bend your back knee slightly.', severity: 2 },
            'front_hip_angle':  { range: [65, 120], feedback_low: 'Lower your hips more.', feedback_high: 'Lean your torso forward less.', severity: 2 },
            'torso_upright':    { range: [145, 180], feedback_low: 'Stand more upright. Keep your torso straight.', feedback_high: null, severity: 3 }
        }
    },
    intermediate: {
        "plank": {
            'left_hip_angle':  { range: [150, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [150, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [155, 180], feedback_low: 'Straighten your left leg.', feedback_high: null, severity: 2 },
            'right_knee_angle': { range: [155, 180], feedback_low: 'Straighten your right leg.', feedback_high: null, severity: 2 }
        },
        "pushup_up": {
            'left_elbow_angle':  { range: [160, 180], feedback_low: 'Straighten your arms.', feedback_high: null, severity: 2 },
            'right_elbow_angle': { range: [160, 180], feedback_low: 'Straighten your arms.', feedback_high: null, severity: 2 },
            'left_hip_angle':  { range: [150, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [150, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [155, 180], feedback_low: 'Straighten your legs.', feedback_high: null, severity: 1 },
            'right_knee_angle': { range: [155, 180], feedback_low: 'Straighten your legs.', feedback_high: null, severity: 1 }
        },
        "pushup_down": {
            'left_elbow_angle':  { range: [70, 100], feedback_low: 'Go lower.', feedback_high: 'Bend your arms more.', severity: 2 },
            'right_elbow_angle': { range: [70, 100], feedback_low: 'Go lower.', feedback_high: 'Bend your arms more.', severity: 2 },
            'left_hip_angle':  { range: [150, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [150, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [155, 180], feedback_low: 'Keep your legs straight.', feedback_high: null, severity: 1 },
            'right_knee_angle': { range: [155, 180], feedback_low: 'Keep your legs straight.', feedback_high: null, severity: 1 }
        },
        "lunge": {
            'front_knee_angle': { range: [80, 105], feedback_low: 'Bend your front knee more.', feedback_high: 'Your front knee is too straight. Lower your hips.', severity: 3 },
            'back_knee_angle':  { range: [90, 140], feedback_low: 'Extend your back leg more.', feedback_high: 'Bend your back knee slightly.', severity: 2 },
            'front_hip_angle':  { range: [75, 110], feedback_low: 'Lower your hips more.', feedback_high: 'Lean your torso forward less.', severity: 2 },
            'torso_upright':    { range: [155, 180], feedback_low: 'Stand more upright. Keep your torso straight.', feedback_high: null, severity: 3 }
        }
    },
    expert: {
        "plank": {
            'left_hip_angle':  { range: [160, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [160, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [165, 180], feedback_low: 'Straighten your left leg.', feedback_high: null, severity: 2 },
            'right_knee_angle': { range: [165, 180], feedback_low: 'Straighten your right leg.', feedback_high: null, severity: 2 }
        },
        "pushup_up": {
            'left_elbow_angle':  { range: [165, 180], feedback_low: 'Straighten your arms.', feedback_high: null, severity: 2 },
            'right_elbow_angle': { range: [165, 180], feedback_low: 'Straighten your arms.', feedback_high: null, severity: 2 },
            'left_hip_angle':  { range: [160, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [160, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [165, 180], feedback_low: 'Straighten your legs.', feedback_high: null, severity: 1 },
            'right_knee_angle': { range: [165, 180], feedback_low: 'Straighten your legs.', feedback_high: null, severity: 1 }
        },
        "pushup_down": {
            'left_elbow_angle':  { range: [75, 95], feedback_low: 'Go lower.', feedback_high: 'Bend your arms more.', severity: 2 },
            'right_elbow_angle': { range: [75, 95], feedback_low: 'Go lower.', feedback_high: 'Bend your arms more.', severity: 2 },
            'left_hip_angle':  { range: [160, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'right_hip_angle': { range: [160, 180], feedback_low: null, feedback_high: null, severity: 3 },
            'left_knee_angle':  { range: [165, 180], feedback_low: 'Keep your legs straight.', feedback_high: null, severity: 1 },
            'right_knee_angle': { range: [165, 180], feedback_low: 'Keep your legs straight.', feedback_high: null, severity: 1 }
        },
        "lunge": {
            'front_knee_angle': { range: [85, 100], feedback_low: 'Bend your front knee more.', feedback_high: 'Your front knee is too straight. Lower your hips.', severity: 3 },
            'back_knee_angle':  { range: [95, 130], feedback_low: 'Extend your back leg more.', feedback_high: 'Bend your back knee slightly.', severity: 2 },
            'front_hip_angle':  { range: [80, 105], feedback_low: 'Lower your hips more.', feedback_high: 'Lean your torso forward less.', severity: 2 },
            'torso_upright':    { range: [160, 180], feedback_low: 'Stand more upright. Keep your torso straight.', feedback_high: null, severity: 3 }
        }
    }
};
