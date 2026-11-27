export type NormalizedColor = [red: number, green: number, blue: number, alpha: number]

const clamp = (value: number, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, value))

const parseChannel = (value: string, scale: number) => {
  const parsed = value.endsWith('%')
    ? (Number.parseFloat(value.slice(0, -1)) / 100) * scale
    : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseAlpha = (value: string | undefined) => {
  if (value === undefined) return 1
  const parsed = parseChannel(value, 1)
  return parsed === null ? null : clamp(parsed)
}

const parseFunction = (source: string) => {
  const match = source
    .trim()
    .toLowerCase()
    .match(/^([\w-]+)\((.*)\)$/)
  if (!match) return null
  const [, name, body] = match
  const [channelBody, alphaBody] = body!.split(/\s*\/\s*/, 2)
  const channels = channelBody!.split(/[\s,]+/).filter(Boolean)
  const commaAlpha =
    alphaBody === undefined && (name === 'rgba' || name === 'hsla') ? channels.pop() : undefined
  const alpha = parseAlpha(alphaBody ?? commaAlpha)
  return { alpha, channels, name }
}

const toByte = (value: number) => Math.round(clamp(value) * 255)

const normalizeRgb = (channels: string[], alpha: number | null): NormalizedColor | null => {
  if (channels.length !== 3 || alpha === null) return null
  const values = channels.map((channel) => parseChannel(channel, 255))
  if (values.some((value) => value === null)) return null
  return [toByte(values[0]! / 255), toByte(values[1]! / 255), toByte(values[2]! / 255), alpha]
}

const normalizeSrgb = (channels: string[], alpha: number | null): NormalizedColor | null => {
  if (channels.length !== 4 || channels[0] !== 'srgb' || alpha === null) return null
  const values = channels.slice(1).map((channel) => parseChannel(channel, 1))
  if (values.some((value) => value === null)) return null
  return [toByte(values[0]!), toByte(values[1]!), toByte(values[2]!), alpha]
}

const parseLightness = (value: string) => {
  const parsed = value.endsWith('%') ? Number.parseFloat(value) / 100 : Number(value)
  return Number.isFinite(parsed) ? clamp(parsed) : null
}

const parseHue = (value: string) => {
  const match = value.match(/^([+-]?(?:\d*\.)?\d+)(deg|grad|rad|turn)?$/)
  if (!match) return null
  const number = Number(match[1])
  const unit = match[2] ?? 'deg'
  const degrees =
    unit === 'grad'
      ? number * 0.9
      : unit === 'rad'
        ? (number * 180) / Math.PI
        : unit === 'turn'
          ? number * 360
          : number
  return (degrees * Math.PI) / 180
}

const normalizeOklch = (channels: string[], alpha: number | null): NormalizedColor | null => {
  if (channels.length !== 3 || alpha === null) return null
  const lightness = parseLightness(channels[0]!)
  const chroma = channels[1]!.endsWith('%')
    ? (Number.parseFloat(channels[1]!) / 100) * 0.4
    : Number(channels[1])
  const hue = parseHue(channels[2]!)
  if (lightness === null || !Number.isFinite(chroma) || hue === null || !Number.isFinite(hue)) {
    return null
  }

  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b
  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3
  const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  const toSrgb = (channel: number) =>
    channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
  return [toByte(toSrgb(red)), toByte(toSrgb(green)), toByte(toSrgb(blue)), alpha]
}

/** Normalize browser computed CSS colors to comparable 8-bit sRGB channels. */
export const normalizeComputedColor = (source: string): NormalizedColor | null => {
  const value = source.trim().toLowerCase()
  if (value === 'transparent') return [0, 0, 0, 0]
  const parsed = parseFunction(value)
  if (!parsed || parsed.alpha === null) return null
  if (parsed.name === 'rgb' || parsed.name === 'rgba') {
    return normalizeRgb(parsed.channels, parsed.alpha)
  }
  if (parsed.name === 'color') return normalizeSrgb(parsed.channels, parsed.alpha)
  if (parsed.name === 'oklch') return normalizeOklch(parsed.channels, parsed.alpha)
  return null
}
