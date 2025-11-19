import Replicate from 'replicate'
import dotenv from 'dotenv'
dotenv.config()

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  userAgent: 'https://www.npmjs.com/package/create-replicate'
})
const model = 'minimax/video-01-director:377cde553c72d2a8a034a2824a43b63b9472247d670dbb14d8c917abb2d39b64'
const input = {
  prompt: '[truck left, pan right, tracking shot] bullet time effect',
  prompt_optimizer: true,
  first_frame_image: 'https://replicate.delivery/pbxt/MYlgrLz3fkaOdsOpAY4H0ugeGkhJaZj2AM3LrzChrRA2FSyt/MemeLoveTriangle_297886754.webp',
}

console.log('Using model: %s', model)
console.log('With input: %O', input)

console.log('Running...')
const output = await replicate.run(model, { input })
console.log('Done!', output)
