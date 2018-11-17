import _ from 'lodash'

import Board from './Board'
import CanvasObject, { Ease } from './CanvasObject'
import Controller from './Controller'
import config from './config'
import Piece from './Piece'

import './ui.tag'

export default class Game extends CanvasObject {
  constructor() {
    super()
    this.DEBUG = ~window.location.search.indexOf('debug')
    this.makeVars()
    this.container = document.getElementById('game')
    this.tags = {}

    this.animation_time = 500
    this.canvas = this.newCanvas({
      id: 'game_canvas',
      width: 400,
      height: window.innerHeight,
      parent: this.container,
    })
    this.ctx = this.canvas.ctx

    this.makeActions()
    this.controller = new Controller(this)
    this.board = new Board(this)
    this.animation_canvas = this.newCanvas({
      width: config.WIDTH * this.scale + 1,
      height: config.HEIGHT * this.scale + 1,
    })

    this.reset()
    this.board.draw()
    this.tick = this.tick.bind(this)
    this.tick()
    this.DEBUG && this.loadGame(430)
  }

  animateLines(lines) {
    if (!lines.length) {
      return
    }
    const ctx = this.animation_canvas.ctx
    ctx.clearRect(
      0,
      0,
      this.animation_canvas.width,
      this.animation_canvas.height,
    )
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    lines.forEach(line_no => {
      ctx.drawImage(
        this.board.canvas,
        0,
        line_no * this.scale, // sx, sy,
        this.board.canvas.width,
        this.scale, // sw, sh,
        0,
        (line_no - this.board.top) * this.scale, // dx, dy,
        this.board.canvas.width,
        this.scale, // dw, dh
      )
      ctx.fillRect(
        0,
        (line_no - this.board.top) * this.scale, // dx, dy,
        this.board.canvas.width,
        this.scale, // dw, dh
      )
    })
    this.animation_opacity = new Ease(250, 1, -1)
  }

  tick() {
    cancelAnimationFrame(this.animation_frame)
    this.draw()
    this.animation_frame = requestAnimationFrame(this.tick)
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.save()
    this.ctx.translate(this.x_margin, this.y_margin)
    let current_top = this.top
    if (this.animations) {
      const a = this.animations[0]
      const r =
        1 - Math.pow((new Date().valueOf() - a.start) / this.animation_time, 2)
      if (r < 0) {
        this.animations = undefined
      } else {
        current_top = a.to - (a.to - a.from) * r
      }
    }
    // draw grid and floor
    this.floor = config.HEIGHT - current_top / this.scale
    const grid_rows = this.floor
    this.ctx.drawImage(
      this.board.grid,
      0,
      current_top,
      this.board.grid.width,
      grid_rows * this.scale,
      0,
      0,
      this.board.grid.width,
      grid_rows * this.scale,
    )
    this.drawBox(
      -0.5,
      this.floor,
      this.board.canvas.width / this.scale + 1,
      4 / this.scale,
      'black',
    )
    this.drawBox(
      -0.5,
      this.trigger_line,
      this.board.canvas.width / this.scale + 1,
      4 / this.scale,
      'red',
    )
    this.drawBox(
      -0.5,
      this.config.b_level - this.board.top + 1,
      this.board.canvas.width / this.scale + 1,
      4 / this.scale,
      'blue',
    )

    // draw board
    this.ctx.drawImage(
      this.board.canvas,
      0,
      current_top, // sx, sy,
      this.canvas.width,
      this.canvas.height, // sWidth, sHeight,
      0,
      0, // dx, dy,
      this.canvas.width,
      this.canvas.height, // dWidth, dHeight
    )

    // draw water
    this.drawBox(
      -5,
      this.board.deep_line - this.board.top,
      config.WIDTH + 10,
      this.canvas.height,
      'rgba(0,0,255,0.25)',
    )

    // animation
    const a_opacity = this.animation_opacity && this.animation_opacity.get()
    if (a_opacity) {
      this.ctx.globalAlpha = a_opacity
      this.ctx.drawImage(this.animation_canvas, 0, 0)
      this.ctx.globalAlpha = 1
    }

    // draw ghost
    this.ctx.globalAlpha = 0.5
    this._piece.draw(this, current_top / this.scale - this._piece.ghost_dy)
    this.ctx.globalAlpha = 1

    // draw piece
    this._piece.draw(this, current_top / this.scale)

    this.ctx.restore() // remove translates above
  }

  makeVars() {
    this.scale = 20
    this.config = {
      b_level: 10,
      n_preview: 5,
    }
    this.visible_height = 20
    this.x_margin = 100
    this.y_margin = 20
    this.pieces = []
    for (let i = 0; i < 8; i++) {
      //this.pieces = this.pieces.concat(2,3,7,6)
      //this.pieces = this.pieces.concat([6,6,6,6])
      //this.pieces = this.pieces.concat(2,3,2,3)
    }

    this.level = 1
    this.speed = this.speed0 = 700
    this.speedK = 60

    this.turns = []
  }

  reset(id) {
    this.id = id || 'autosave'
    this.piece = undefined
    this._piece = undefined
    this.makeVars()
    this.turn = 0

    this.controller.reset(id)
    this.board.reset(id)
    this.getPiece()
    this.tags.scores && this.tags.scores.reset()
    this.updatePieceList()
    this.getSkyline()
  }

  nextTurn() {
    this.getSkyline()
    this.board.removeLines()
    this.turns.push({
      n: this.piece.n,
      x: this.piece.x,
      y: this.piece.y,
    })
    this.turn++
    this.getPiece()
    if (!this._piece.check()) {
      this.gameOver()
      return
    }
  }

  saveGame(_id) {
    //uR.storage.set(_id,this.serialize());
  }

  loadGame(_id, _reset) {
    throw 'NotImplemented'
  }

  getSkyline() {
    this.board.getSkyline()

    const old_top = Math.max(this.top, 0)
    let top =
      (this.board.skyline - this.visible_height + this.config.b_level) *
      this.board.scale
    top = Math.min(
      (config.HEIGHT - this.visible_height) * this.board.scale,
      top,
    )
    this.trigger_line = Math.max(top / this.scale, this.config.b_level)
    this.top = Math.max(top, this.scale)
    this.board.top = this.top / this.scale
    this.board.deep_line = this.board.top + this.visible_height
    if (this.top !== old_top) {
      this.top_from = old_top
      this.animations = [
        { from: old_top, to: this.top, start: new Date().valueOf() },
      ]
    }
  }

  updatePieceList() {
    while (this.pieces.length <= this.turn + this.config.n_preview + 2) {
      this.pieces.push(Math.floor(config.N_TYPES * Math.random()) + 1)
    }
    const visible = this.pieces.slice(
      this.turn + 1,
      this.turn + 1 + this.config.n_preview,
    )
    const empty = this.config.n_preview - visible.length
    this.tags.next_piece && this.tags.next_piece.setPieces(visible, empty)
    return this.pieces[this.turn]
  }

  getPiece(N) {
    N = N || this.updatePieceList()

    let y = Math.max(this.board.top - this.config.b_level, 0)
    y = Math.max(y, this.board.top)
    const r = 0
    this.piece = {
      n: N,
      x: config.WIDTH / 2,
      y: y,
      r: r,
      dx: config.PIECES[N][r][0],
      dy: config.PIECES[N][r][1],
    }
    this._piece = new Piece({
      x: config.WIDTH / 2,
      y: y,
      r: 0,
      shape: config._shapes[N],
      board: this.board,
    })
    this.board.pieces.push(this._piece)
  }

  gameOver() {
    this.reset()
  }

  makeActions() {
    this.act = {
      left: () => this._piece.moveLeft(),
      right: () => this._piece.moveRight(),

      down: () => {
        if (!this._piece.moveDown()) {
          this._piece.lock()
          this.nextTurn()
        }
      },

      rotate: () => {
        this._piece.rotateLeft()
      },

      drop: () => {
        if (!this._piece.drop()) {
          this._piece.lock()
          this.nextTurn()
        }
      },
      lock: () => {
        this._piece.lock()
        this.nextTurn()
      },
      swapPiece: () => {
        if (this.last_swap === this.turn) {
          return
        }
        this.last_swap = this.turn
        if (!this.swapped_piece) {
          this.swapped_piece = this.pieces.splice(this.turn, 1)[0]
          this.getPiece()
        } else {
          const old_piece = this.swapped_piece
          this.swapped_piece = this.piece.n
          this.piece = undefined
          this.getPiece(old_piece)
          this.pieces[this.turn] = this.piece.n
        }
        this.tags.piece_stash.setPieces([this.swapped_piece], 0)
      },
    }
  }
}