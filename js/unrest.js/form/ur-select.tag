import prepChoices from '../schema/prepChoices'
import config from './config'
import Input from './Input'

class Select extends Input {
  _createInput() {
    this.choices = prepChoices(this)
    this._input = this.tag.root.querySelector("select")
    this._attrs.forEach(attr => {
      this._input[attr] = this[attr]
    })
  }
}

config.tag2class['ur-select'] = Select

<ur-select> 
  <select>
    <option each={ c in field.choices } value={ c.value }>{ c.label }</option>
  </select>

this.field = {}

this.on("mount",() => {
  this.opts.field.bindTag(this)
  this.update()
})
</ur-select>
