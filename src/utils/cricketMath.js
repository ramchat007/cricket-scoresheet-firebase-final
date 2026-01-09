
export function strikeRate(runs, balls) {
  return balls ? ((runs / balls) * 100).toFixed(2) : "0.00";
}
