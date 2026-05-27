/**
 * Computes a simple moving average over an array of numbers.
 * Leading values (before the window fills) use whatever data is available.
 * Returns an array of the same length as the input.
 */
export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1)
    const slice = values.slice(start, index + 1)
    const sum = slice.reduce((acc, v) => acc + v, 0)
    return Math.round((sum / slice.length) * 10) / 10
  })
}
