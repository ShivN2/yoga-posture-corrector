/**
 * Calculates the angle between three 2D points (landmarks).
 * @param {object} a - The first landmark point (e.g., shoulder).
 * @param {object} b - The second landmark point, the vertex of the angle (e.g., elbow).
 * @param {object} c - The third landmark point (e.g., wrist).
 * @returns {number} The angle in degrees.
 */
function calculateAngle(a, b, c) {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return angle;
}
