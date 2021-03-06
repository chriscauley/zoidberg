import _ from 'lodash'

import newElement from '../newElement'
import config from '../config'
import uP from '../pixi'
import uR from 'unrest.io'
import Square from './Square'

const { Int, List, Model } = uR.db

//const checkFail = (piece, message) => {
//   const fails = piece.squares.filter(s => !s.validate())
//   if (fails.length) {
//     console.error(piece)
//     console.error(fails)
//     console.error(fails.length, piece.squares.length)
//   }
// }

let _id = 0

export default class Piece extends Model {
  static model_name = 'Piece'
  static app_label = 'main'
  static fields = {
    x: Int(),
    y: Int(0),
    squares: List(Square),
  }
  static opts = {
    board: uR.REQUIRED,
    color: 'pink',
    shape: undefined,
    _needs_split: false,
    _is_current: false,
    locked: false, // locked pieces can't be shaked
  }
  constructor(opts) {
    _.defaults(opts, {
      color: opts.board.pallet[config._shapes.indexOf(opts.shape)],
      x: opts.board.W / 2,
    })
    const template = config.PIECES[opts.shape]
    if (!opts.squares && template) {
      opts.squares = template.squares.map(s => ({
        ...s,
      }))
    }
    super(opts)
    this._id = _id++
    this.r = 0 // current rotation
    this._opts = opts
    this.max_r = template ? template.rotations : 0 // 0,2,4 depending on shape
    this.squares.forEach(s => (s.piece = this)) //#! TODO this should be handled as a FK
    this.pixi = uP.sprites.Sprite()
    this.squares.forEach(s => {
      s.makePixi()
    })
    this.addPixi()
    this.redraw(true)
    this.tick()
  }

  redraw(dirty) {
    if (this.sprite_x !== this.x) {
      // horizontal easing looks weird
      this.sprite_x = this.x
      this.sprite_y = this.y
      this.pixi.x = this.x * this.board.scale
      this.pixi.y = this.y * this.board.scale
    }
    if (this.sprite_y !== this.y) {
      if (this._is_current) {
        // dropping from too high looks weird
        _.assign(this.pixi, {
          x: this.x * this.board.scale,
          y: (this.y - 1) * this.board.scale,
        })
      }
      this.sprite_y = this.y
      uP.easeXY(this.pixi, this.x, this.y)
    }
    if (dirty) {
      // rotated or modified, need to reposition squares
      this.squares.forEach(s => {
        s.sprite.x = s.dx * 20
        s.sprite.y = s.dy * 20
      })

      // from here down is calculating skirt
      // this doesn't have anythign to do with drawing
      const dxs = this.squares.map(s => s.dx)
      const dx0 = _.min(dxs)
      const width = _.max(dxs) - dx0 + 1
      this.skirt = _.range(width).map(i =>
        _.max(this.squares.filter(s => s.dx === dx0 + i).map(s => s.dy)),
      )
      this.skirt.x = this.x + dx0
      this.squares.forEach(s => s.toggleEdge())
      this.makeGem()
    }
    this.getGhost(dirty)
  }

  rotate(spin, force) {
    if (!this.max_r) {
      return
    } // o piece
    this.r += spin
    if (this.r < 0) {
      this.r += this.max_r
    }
    if (this.max_r === 2 && this.r === this.max_r) {
      this.r = 0
      spin = -spin
    }
    this.squares.forEach(square => {
      const { dx, dy } = square
      if (spin > 0) {
        square.dx = dy
        square.dy = -dx
      } else {
        square.dx = -dy
        square.dy = dx
      }
    })
    if (this.check() || force) {
      this.redraw(true)
      return true
    } else {
      this.rotate(-spin)
      this.redraw(true)
    }
  }
  moveLeft = () => this._move([-1, 0])
  moveRight = () => this._move([1, 0])
  moveUp = () => this._move([0, -1])
  moveDown = () => this._move([0, 1])

  rotateLeft = () => this.rotate(1)
  rotateRight = () => this.rotate(-1)

  check() {
    // verifies that the piece is placed somewhere that it can be
    // Here is where we check the board to see if a piece is blocking a movement
    return _.every(this.squares, s => s.check())
  }

  tick() {
    if (this.is_gold && this.break_on === this.board.game.turn) {
      const ys = _.range(4).map(dy => this.y + dy)
      this.board.removeLines(ys, true) // forcefully remove these lines
      return
    }
    this.redraw()
  }

  recenter(dx, dy) {
    if (!dx && !dy) {
      return
    }
    this.x += dx
    this.y += dy
    this.squares.forEach(s => {
      s.dx -= dx
      s.dy -= dy
    })
    _.assign(this.pixi, {
      x: this.x * this.board.scale,
      y: this.y * this.board.scale,
    })
  }

  checkSplit() {
    // see if all pieces are still connected, if not regroup them as new pieces
    if (!this._needs_split) {
      return
    }
    this._needs_split = false

    // get first chunk using square@0,0 or first square
    const home_square =
      this.squares.find(s => !s.dy && !s.dx) || this.squares[0]

    // separate out orphans
    const [squares, orphans] = home_square.getNeighborsAndOrphans(this.squares)
    this.squares = squares

    if (orphans.length) {
      // stick all the orphans on the same piece, we'll retry split after
      const first = orphans[0]
      const piece_opts = {
        x: first.x,
        y: first.y,
        squares: orphans.map(s => ({
          dx: s.x - first.x,
          dy: s.y - first.y,
        })),
      }

      orphans.forEach(s => s.kill())
      const piece = new Piece({
        ...piece_opts,
        board: this.board,
        color: this.color,
      })
      piece.set()
      //checkFail(piece,"orphans")

      if (orphans.length > 1) {
        piece._needs_split = true
        piece.checkSplit()
      }
    }
    // reset to home_square (if moved)
    this.recenter(home_square.dx, home_square.dy)
    this.redraw(true)
    this.pixi.removeChild(this.ghost)
    //checkFail(this,"original")
  }

  toTexture() {
    // get the texture (hopefully cached) for the current piece
    // this is used to create the ghost (rather than making a second piece)
    const slug = `${this.shape}r${this.r}.piece`
    if (!uP.cache[slug]) {
      const canvas = this.board.pixi.renderer.extract.canvas(this.pixi)
      uP.cache[slug] = uP.PIXI.Texture.fromCanvas(canvas)
      if (!this.r) {
        const bg = `background-image: url(${canvas.toDataURL()})`
        const style = `piece-stack .p${this.shape}:before { ${bg} }\n`
        newElement('style', {
          parent: document.head,
          innerHTML: style,
          type: 'text/css',
        })
      }
    }
    return uP.cache[slug]
  }

  checkSkirt = y => {
    // check whether the skirt can fit at given y
    // only useful in determining if a piece can move down
    let blocked = undefined
    this.skirt.forEach((dy, dx) => {
      if (y + dy >= this.board.H) {
        blocked = true
      }
      blocked = blocked || this.board.get(this.skirt.x + dx, y + dy)
    })
    return !blocked
  }

  getGhost(redraw) {
    // when cloning pieces, it generates unecessary ghosts
    // #! TODO: this stops that, but the problem needs to be fixed upstream
    if (!this._is_current) {
      return
    }
    let ghost_dy = 0
    while (this.checkSkirt(this.y + ghost_dy + 1)) {
      if (ghost_dy > 25) {
        break
      }
      ghost_dy++
    }
    if (redraw) {
      this.pixi.removeChild(this.ghost)
      this.ghost = uP.sprites.Sprite({
        texture: this.toTexture(),
        parent: this.pixi,
        alpha: 0.5,
      })
      this.off_x = Math.min(...this.squares.map(s => s.dx))
      this.off_y = Math.min(...this.squares.map(s => s.dy))
    }
    this.ghost.dy = ghost_dy
    this.ghost.y = (this.off_y + ghost_dy) * 20
    this.ghost.x = this.off_x * 20
  }

  drop() {
    const { dy } = this.ghost
    this.ghost.dy = 0
    return (this.y += dy)
  }

  lock() {
    // lock the piece into place on the board
    this.drop()
    this.set()
  }

  set() {
    this.squares.map(s => {
      this.board.set(s.x, s.y, s)
    })
    if (this.board.pieces.indexOf(this) === -1) {
      // this is lazy, board.pieces should be a set or should be more carefully maintined
      this.board.pieces.push(this)
    }
    this.pixi.removeChild(this.ghost)
  }

  remove() {
    this.squares.map(s => this.board.remove(s.x, s.y))
  }

  _move([dx, dy], force) {
    this.x += dx
    this.y += dy
    this.skirt.x += dx
    if (this.check() || force) {
      this.redraw()
      return true
    } else {
      this._move([-dx, -dy], true)
      this.redraw()
    }
  }

  draw(canvas_object, offset_y = 0) {
    // offset_y currently used to make ghost
    this.squares.forEach(s => s.draw(canvas_object, offset_y))
  }

  removePixi() {
    this.board.pixi.board.removeChild(this.pixi)
  }

  addPixi() {
    this.board.pixi.board.addChild(this.pixi)
  }
  markShake(state) {
    this.can_shake = state
    this.squares.forEach(s => {
      s.sprite.shake.visible = state
      s.sprite.edge.visible = !state
    })
  }

  makeGem() {
    this.gem = uP.sprites.getColor('#cccccc', {
      parent: this.pixi,
      width: this.board.scale / 2,
      height: this.board.scale / 2,
      x: this.board.scale / 4,
      y: this.board.scale / 4,
    })
  }
}
