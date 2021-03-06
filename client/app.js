import uR from 'unrest.io'
import Game, { Play } from './Game'

import './tags'
import './routes'

uR.auth.GREETING = 'Welcome to Tetris Rain!'
uR.auth.auto = true
uR.ready(() => {
  uR.admin.start()
  Game.__makeMeta()
  Play.__makeMeta()
})

if (window.HMR) {
  window.location.reload()
}
window.HMR = true
