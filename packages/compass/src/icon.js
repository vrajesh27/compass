const path = require('path');
const COMPASS_ICON = path.join(
  __dirname,
  require('./app/images/compass-dialog-icon.png')
);
const nativeImage = require('electron').nativeImage;

/**
 * Convenience for getting the app icon to customize native UI components
 * via electron.
 *
 * @example
 * ```javascript
 * const icon = require('./icon');
 * const dialog = require('electron').dialog;
 * dialog.showMessageBox({icon: icon, message: 'I have a nice Compass icon.'});
 * ```
 *
 * @see https://jira.mongodb.org/browse/COMPASS-586
 */
module.exports = nativeImage.createFromPath(COMPASS_ICON);
module.exports.path = COMPASS_ICON;
