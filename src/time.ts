// How long ago, roughly: "3d 4h", "5h 12m" or "8m". For the GM queues' waiting times.
export function since(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  const [d, h, m] = [Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60), minutes % 60]
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
