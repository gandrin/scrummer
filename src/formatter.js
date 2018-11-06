const formatPoints = points => {
  if (points === '?') return '?'
  return Math.round(points * 10) / 10
}
