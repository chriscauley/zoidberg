import _ from 'lodash'
import hash from 'object-hash'
import { range, inRange, find, sum } from 'lodash'

import Pallet from './Pallet'
import config from './config'
import uR from 'unrest.io'
import uP from './pixi'
import Piece from './Piece'
import _tb from './tetris-board.tag'

const { List, Model } = uR.db

export default class Board extends Model {
  static app_label = 'main'
  static model_name = 'Board'
  static fields = {
    W: 10,
    pieces: List(Piece),
  }
  static opts = {
    game: uR.REQUIRED,
    scale: 20, // px per block
    pieces: [],
    red_line: 5,
    x_offset: 5,
  }
  constructor(opts) {
    super(opts)
    window.B = this

    // nested arrays of zeros make up the initial board
    this.pallet = new Pallet({ board: this })
    this.H = this.MAX_H = 100 // set so makePixi can work
    this.makePixi()
    this.reset()
    /*uR.element.create(
      "tetris-board",
      { parent: "#game" },
      { board: this }
    )*/
  }

  reset() {
    this.pixi.grid.y = (this.H - this.MAX_H) * this.scale
    this.pieces && this.pieces.forEach(p => p.removePixi())
    this.pieces = []
    this.H = this.game.b_level + this.game.d_level

    this.squares = range(this.H * this.W).map(() => undefined)
    _.range(this.game.d_level).forEach(i => {
      const p = Piece[this.game.piece_generator]({
        board: this,
        y: this.H - i - 1,
        x: 0,
        locked: true,
      })
      this.pieces.push(p)
      p.set()
    })
    this.getSkyline()
  }

  redraw() {
    this.pixi.stage.children.forEach(c => c.move && c.move())
  }

  update() {
    this.tag && this.tag.update()
  }

  getSkyline() {
    const first = find(this.squares) || { y: this.H }
    const game = this.game
    this.skyline = first.y
    this.top = Math.min(
      this.H - game.visible_height,
      this.skyline - this.red_line,
    )
    this.top = Math.max(this.top, 1)
    game.top = this.top * this.scale
    this.deep_line = this.top + game.visible_height
    this.redraw()
  }

  makePixi = () => {
    this.pixi = uP.Pixi({
      width: 400,
      height: 600,
      scale: this.scale,
      container: '#game',
    })

    this.pixi.board = new uP.PIXI.Container()
    // All of the following are because the container doesn't come from uP.getColor
    this.pixi.board.x = this.x_offset * this.scale
    this.pixi.board.y = this.scale * -this.top
    this.pixi.board.move = () =>
      uP.easeXY(this.pixi.board, this.x_offset, this.top * -1)
    this.pixi.stage.addChild(this.pixi.board)

    this.pixi.grid = uP.sprites.makeGrid(this, {
      width: this.W * this.scale + 1,
      height: this.H * this.scale,
      parent: this.pixi.board,
    })

    this.pixi.danger_zone = uP.sprites.gradient({
      stops: [
        [0, 'red'],
        [0.2, 'red'],
        [0.2, 'rgba(255,0,0,0.5)'],
        [1, 'rgba(255,0,0,0)'],
      ],
      width: 200,
      height: 200,
      parent: this.pixi.board,
    })

    const line_x = this.x_offset - 1
    this.pixi.trigger_line = uP.sprites.makeLine(this, '#FF0000', {
      move: () => [line_x, this.red_line],
    })

    this.pixi.b_level = uP.sprites.makeLine(this, '#0000FF', {
      move: () => [line_x, this.red_line - this.top + 1],
    })

    this.pixi.floor = uP.sprites.makeLine(this, '#333333', {
      move: () => [line_x, this.H - this.top],
    })

    this.pixi.water = uP.sprites.makeLine(this, '#0000FF', {
      move: () => [0, this.deep_line - this.top],
      x: 0,
      width: this.scale * (this.W + this.x_offset * 2),
      height: this.scale * 10,
      alpha: 0.25,
    })

    config.PIECE_LIST.forEach(piece => {
      // this creates style tags for each piece for the preview menu
      const _piece = new Piece({
        board: this,
        shape: piece.shape,
      })
      _piece.toTexture()
      _piece.removePixi()
    })
  }

  tickPieces() {
    this.pieces.forEach(p => p.tick())
  }

  removeLines(removed_ys = this._getFullYs(), force) {
    this.wipeLines(removed_ys)
    this._removeLines(removed_ys, force)
    this.getSkyline()
    this.findGoldBars()
    this.detectShake()
    this.tickPieces()
    this.checkVictory()
  }

  savePlay() {
    let data = {
      game: this.game.id,
      actions: this.game.actions,
    }
    const current_hash = (data.hash = hash(this.serialize()))
    const replay = this.game.replaying
    if (replay) {
      data = replay.serialize()
      if (replay.hash && replay.hash !== current_hash) {
        throw 'Hash mismatch on replay #' + replay.id
      } else {
        console.log('hash matched!') // eslint-disable-line
      }
      data.hash = current_hash
    }
    return uR.db.main.Play.objects.create(data).then(obj => (this.play = obj))
  }

  checkVictory() {
    if (!this.pieces.filter(p => p.locked).length) {
      this.savePlay().then(play => {
        uR.router.route(`#!/score/${play.id}/`)
      })
    }
  }

  wipeLines(ys) {
    // note, this intentionally triggers for lines that don't actually get removed
    // ie gold lines, deep lines, etc
    ys.forEach(y => {
      const sprite = uP.sprites.getColor('#888888', {
        parent: this.pixi.board,
        y: y * this.scale,
        width: this.scale * this.W,
        height: this.scale,
      })
      uP.ease(sprite, { alpha: 0 })
    })
  }

  _getFullYs() {
    const full_ys = []
    for (let y = this.skyline; y < this.H; y++) {
      const squares = this.getLine(y)
      if (squares.length !== this.W) {
        continue
      }

      if (y >= this.deep_line && !squares.find(s => s.piece.is_gold)) {
        this.makeDeep(squares)
        continue
      }

      this.scoreLine(y)
      full_ys.push(y)
    }
    return full_ys
  }

  _repiece() {
    // remove dead pieces and check splits
    _.remove(this.pieces, p => !p.squares.length).forEach(p => p.removePixi())
    this.pieces.forEach(p => p.checkSplit())
  }

  _removeLines(remove_ys, force) {
    const drop_ys = remove_ys.filter(y => {
      // try to remove squares on line
      // certain pieces (gold, deep) may not be removable
      this.getLine(y).map(s => s.kill(force))

      // A line gets dropped if the entire row was successfully removed
      return !this.getLine(y).length
    })

    this._repiece()

    if (!drop_ys.length) {
      return
    }

    this.pieces
      .filter(p => p.y < this.deep_line)
      .filter(p => {
        // how far does this piece need to drop?
        const drop = drop_ys.filter(y => y > p.y).length
        if (!drop) {
          return
        }
        p.remove()
        p.y += drop
        return true
      })
      .forEach(p => p.set())
  }

  makeDeep(squares) {
    if (squares.find(s => s.is_deep)) {
      return
    }
    const piece = new Piece({
      board: this,
      color: this.pallet.DEEP,
      x: 0,
      y: squares[0].y,
      squares: squares.map(s => {
        s.kill()
        return { dx: s.x, dy: 0 }
      }),
    })
    piece.is_deep = true
    piece.set()
  }

  findGoldBars() {
    // post move operations
    let target_y, target_row
    const reset = () => {
      target_y = undefined
      target_row = undefined
    }
    range(this.skyline, this.H)
      .reverse()
      .forEach(y => {
        const squares = this.getLine(y)
        if (!squares.length || squares[0].piece.is_gold) {
          return
        }
        const row = this.getLine(y, _s => true).map(s => (s ? 1 : 0))
        if (sum(row) !== this.W - 2) {
          return reset() // no missing exactly 2 pieces
        }
        const row_str = row.join('')
        if (row_str.indexOf('00') === -1) {
          return reset() // missing pieces aren't next to each other
        }
        if (!target_row || target_row !== row_str) {
          // first occurrence
          target_row = row_str
          target_y = y
          return
        }
        if (target_y - y === 3) {
          const root_square = this.getLine(y)[0]
          const piece_x = root_square.x
          const piece_y = root_square.y
          const squares = []
          range(y, target_y + 1)
            .map(_y => this.getLine(_y))
            .forEach(line => {
              line.forEach(s => {
                squares.push({ dx: s.x - piece_x, dy: s.y - piece_y })
                s.kill()
              })
            })
          const piece = new Piece({
            x: piece_x,
            y: piece_y,
            color: 'FFD700',
            board: this,
            squares,
          })
          piece.is_gold = true
          piece.set()
          reset()
        }
      })
    this._repiece()
  }
  print(attr = '_id') {
    /*eslint-disable */
    //const c = '0123456789abcdefghijklmnopqrstuvwxyz'
    /*for (let y = this.skyline; y < this.H; y++) {
      const squares = this.squares.slice(y * this.W, (y + 1) * this.W)
      const ids = [y, ...squares.map(s => (s ? s.id : ' '))]
      console.log(ids.join(' '))
    }
    console.log('\n')*/
    for (let y = this.skyline; y < this.skyline+10; y++) {
      const squares = this.squares.slice(y * this.W, (y + 1) * this.W)
      const ids = [
        y,
        " ",
          ...squares.map(s => (s ? s.piece[attr].toString().padStart(3,' ') : '   '))
      ]
      console.log(ids.join(' '))
    }
    console.log('\n\n')
    /*eslint-enable */
  }

  scoreLine(y) {
    // maybe just move this logic to the scores tag?
    if (this.get(0, y).piece.is_deep) {
      this.game.scores.add('deep')
    } else {
      this.game.scores.add('lines')
    }
  }
  exists(x, y) {
    return inRange(x, 0, this.W) && inRange(y, 0, this.H)
  }
  _xy2i = (x, y) => x + y * this.W
  get(x, y) {
    if (x > this.W) {
      return
    }
    return this.squares[this._xy2i(x, y)]
  }
  getLine(y, filter = s => s) {
    return this.squares.slice(y * this.W, (y + 1) * this.W).filter(filter)
  }
  set(x, y, value) {
    const i = this._xy2i(x, y)
    if (this.squares[i]) {
      window.FAIL_SQUARE = value
      throw `Cannot place square in unempty square ${x},${y}`
    }
    this.squares[i] = value
  }
  remove(x, y) {
    this.squares[this._xy2i(x, y)] = undefined
  }

  detectShake() {
    // mark all not locked pieces as able to move
    this.pieces.forEach(p => (p._can_shake = !p.locked))
    this.getLine(this.H - 1).forEach(s => (s.piece._can_shake = false))
    _.range(this.H, this.skyline - 1).forEach(y =>
      this.getLine(y).forEach(s => {
        if (!s.piece._can_shake) {
          return
        }
        const s2 = this.get(s.x, s.y + 1)
        s.piece._can_shake = !s2 || s2.piece._can_shake
      }),
    )

    this.pieces.forEach(p => p.markShake(p._can_shake))
  }

  shake() {
    this.pieces.forEach(p => (p._shaked_y = 0))
    let any_shaked = true
    while (any_shaked) {
      any_shaked = false
      _.range(this.deep_line - 1, this.skyline - 1).forEach(y =>
        this.getLine(y).forEach(s => {
          if (!s.piece.can_shake) {
            return
          }
          s.piece.remove()
          while (s.piece.moveDown()) {
            s.piece._shaked_y++
            any_shaked = true
          }
          s.piece.set()
        }),
      )
    }
    this.removeLines()
  }
}
