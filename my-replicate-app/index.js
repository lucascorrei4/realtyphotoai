import Replicate from 'replicate'
import dotenv from 'dotenv'
dotenv.config()

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  userAgent: 'https://www.npmjs.com/package/create-replicate'
})
const model = 'google/veo-3.1-fast:af87cbb0ee4dfffefb483e206251676fe21107fdec31aeb1f8855b55acea4fda'
const input = {
  image: 'https://replicate.delivery/pbxt/NtDCMBJNIQTOU0mZtlnlrqrPLgYvTvpCISbFIiweYPsotGY5/replicate-prediction-gn4tnddn5drme0csx1yt3jvy4c.jpeg',
  prompt: 'Overlapping geometric shapes, pulsing to upbeat electronic music with SFX of shifting patterns',
  duration: 8,
  last_frame: 'https://replicate.delivery/pbxt/NtDCLnwTQaPfLhgaNDmLevN8QivDFS8V91M8pCwEpDNIN9uA/replicate-prediction-8m82ekaj7hrma0csx1xrkmqjhm.jpeg',
  resolution: '720p',
  aspect_ratio: '16:9',
  generate_audio: true,
}

console.log('Using model: %s', model)
console.log('With input: %O', input)

console.log('Running...')
const output = await replicate.run(model, { input })
console.log('Done!', output)
