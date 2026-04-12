// This file will store the geometric rules for different poses.
// Each pose is defined by the target angles of various joints.
// The angles are defined as a range [min_angle, max_angle] in degrees.

export const poses = {
    "plank": {
        // We want the body to be in a straight line, so the hip and knee angles should be close to 180.
        'left_hip_angle': {
            'range': [160, 180],
            'feedback_low': 'Raise your hips.',
            'feedback_high': 'Lower your hips.'
        },
        'right_hip_angle': {
            'range': [160, 180],
            'feedback_low': 'Raise your hips.',
            'feedback_high': 'Lower your hips.'
        },
        'left_knee_angle': {
            'range': [160, 180],
            'feedback_low': 'Straighten your left leg.',
            'feedback_high': null // No feedback if leg is hyper-extended
        },
        'right_knee_angle': {
            'range': [160, 180],
            'feedback_low': 'Straighten your right leg.',
            'feedback_high': null
        }
    },
    // We will add pushups, lunges, etc. here later.
    "pushup_up": {
        // Similar to plank, but elbows are straight
        'left_elbow_angle': {
            'range': [160, 180],
            'feedback_low': 'Straighten your left arm.',
            'feedback_high': null
        },
        'right_elbow_angle': {
            'range': [160, 180],
            'feedback_low': 'Straighten your right arm.',
            'feedback_high': null
        },
        // ... include hip and knee angles from plank
    },
    "pushup_down": {
        // Elbows should be bent
        'left_elbow_angle': {
            'range': [70, 100],
            'feedback_low': 'Go lower.',
            'feedback_high': 'Don\'t go quite so low.'
        },
        'right_elbow_angle': {
            'range': [70, 100],
            'feedback_low': 'Go lower.',
            'feedback_high': 'Don\'t go quite so low.'
        },
        // ... include hip and knee angles from plank
    },
    "lunge": {
        'left_knee_angle': {
            'range': [80, 110],
            'feedback_low': 'Bend your left knee more.',
            'feedback_high': 'Bend your left knee less.'
        },
        'right_knee_angle': {
            'range': [80, 110],
            'feedback_low': 'Bend your right knee more.',
            'feedback_high': 'Bend your right knee less.'
        },
         'left_hip_angle': {
            'range': [80, 110],
            'feedback_low': 'Lower your hips.',
            'feedback_high': 'Raise your hips.'
        },
        'right_hip_angle': {
            'range': [80, 110],
            'feedback_low': 'Lower your hips.',
            'feedback_high': 'Raise your hips.'
        }
    }
};
