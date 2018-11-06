const sanitizePoints = points => {
  if (points === '?') return 0
  if (!points) return 0
  return points
};
