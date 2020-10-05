import { PATH } from '../js/helpers.js';

export default class Scenery extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['form'],
      closeOnSubmit: false,
      popOut: true,
      editable: game.user.isGM,
      width: 700,
      template: `${PATH}/templates/scenery.hbs`,
      id: 'scenery-config',
      title: game.i18n.localize('Scenery'),
    });
  }

  /* -------------------------------------------- */

  /**
   * Obtain module metadata and merge it with game settings which track current module visibility
   * @return {Object}   The data provided to the template when rendering the form
   */
  async getData() {
    const flag = canvas.scene.getFlag('scenery', 'data') || {};
    if (!this.bg) this.bg = flag.bg || canvas.scene.data.img;
    if (!this.gm) this.gm = flag.gm || canvas.scene.data.img;
    if (!this.pl) this.pl = flag.pl || canvas.scene.data.img;
    if (!this.variations) {
      this.variations = [{ name: 'Default', file: this.bg }];
      if (flag.variations) flag.variations.forEach((v) => this.variations.push(v));
    }

    // Add extra empty variation
    this.variations.push({ name: '', file: '' });
    // Return data to the template
    return { variations: this.variations, gm: this.gm, pl: this.pl };
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    html.find('.delete').click(() => Scenery.deleteVariation(html));
    html.find('.preview').click(() => Scenery.previewVariation(html));
    super.activateListeners(html);
  }

  /**
   * Display a preview window of the scene
   * @param {HTMLCollection} html the html of the form
   */
  static previewVariation(html) {
    const index = document.activeElement.getAttribute('index');
    window.html = html;
    const url = html.find(`#scenery-row-${index} .image`)[0].value;
    new ImagePopout(url).render(true);
  }

  /**
   * Remove a row in the variation table
   * @param {HTMLCollection} html the html of the form
   */
  static deleteVariation(html) {
    const index = document.activeElement.getAttribute('index');
    html.find(`#scenery-row-${index}`).remove();
  }

  /**
  * Add a new empty row to the form
  * @param {Object} formData
  */
  async addVariation(name = '', file = '', id = null) {
    const html = this.element;
    if (id === null) id = html.find('tbody>tr').length;
    const row = $(await renderTemplate(`${PATH}/templates/variation.hbs`, { id, name, file }));
    row.find('.delete').click(() => Scenery.deleteVariation(html));
    row.find('.preview').click(() => Scenery.previewVariation(html));
    await html.find('.scenery-table').append(row);
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param {Event} event      The initial triggering submission event
   * @param {Object} formData  The object of validated form data with which to update the object
   * @private
   */
  async _updateObject(event, formData) {
    const fd = expandObject(formData);
    this[event.submitter.name](fd);
  }

  /**
   * Scan for variations in current directory of default img
   */
  async scan() {
    window.t = this;
    const path = this.element.find('[name="variations.0.file"]')[0].value;
    const fp = await FilePicker.browse('data', path);
    const defName = path.split('/').pop().split('.').slice(0, -1).join('.');
    const variations = fp.files
      .filter((f) => f !== path)
      .reduce((acc, file) => {
        const fn = file.split('/').pop().split('.').slice(0, -1).join('.');
        if (fn.includes(defName)) {
          const name = fn.replace(defName, '').replace(/[-_]/g, ' ').trim();
          acc.push({ file, name });
        }
        return acc;
      }, []);
    // eslint-disable-next-line no-restricted-syntax
    let index = this.element.find('tbody>tr').length;
    variations.forEach((v) => {
      this.addVariation(v.name, v.file, index);
      index++;
    });
  }

  /**
   * Add a new empty row to the form
   */
  add() {
    this.addVariation();
  }

  /**
   * Validate form input and save to db
   * @param {Object} formData
   */
  async submit(formData) {
    const bg = formData.variations[0].file;
    const variations = Object.values(formData.variations)
      .slice(1)
      .filter((v) => v.file);
    const gm = formData.variations[$('input[name="gm"]:checked').val()]?.file;
    const pl = formData.variations[$('input[name="gm"]:checked').val()]?.file;
    if (!gm || !pl) {
      ui.notifications.error('GM & Player view must have a file');
      return;
    }
    const data = { variations, bg, gm, pl };
    await canvas.scene.update({ img: bg });
    canvas.scene.setFlag('scenery', 'data', data);
    this.close();
  }

  /**
   * Sets background image of the current scene
   * @param {String} img   The image URL to be used
   * @param {Boolean} draw Used to prevent draw if being called during canvasInit
   */
  static setImage(img, draw = true) {
    canvas.scene.data.img = img;
    if (draw) {
      canvas.draw();
      setTimeout(() => canvas.draw(), 60);
    }
  }

  /**
   * React to canvasInit hook to set custom image if needed
   */
  static _onCanvasInit() {
    const data = canvas.scene.getFlag('scenery', 'data');
    if (!data) return;
    const img = (game.user.isGM) ? data.gm : data.pl;
    if (img) Scenery.setImage(img, false);
  }

  /**
   * React to updateScene hook to set custom image if needed
   * @param {Scene} scene
   * @param {Object} data
   */
  static _onUpdateScene(scene, data) {
    if (hasProperty(data, 'flags.scenery.data')) {
      const img = (game.user.isGM) ? data.flags.scenery.data.gm : data.flags.scenery.data.pl;
      if (img) Scenery.setImage(img);
    }
  }
}
