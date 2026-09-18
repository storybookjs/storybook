import Component from '@ember/component';

/**
 *
 * `WelcomeBanner` renders a friendly message and is used to welcome Ember.js users when they first generate an application.
 *
 *
 * ```js
 * {{welcome-banner
 *   backgroundColor=backgroundColor
 *   titleColor=titleColor
 *   subTitleColor=subTitleColor
 *   title=title
 *   subtitle=subtitle
 *   click=(action onClick)
 * }}
 * ```
 *
 * @class WelcomeBanner
 */
export default Component.extend({
  /**
   * The hex-formatted color code for the background.
   * @argument backgroundColor
   * @type {string}
   * @default null
   */
  backgroundColor: null,

  /**
   * The hex-formatted color code for the subtitle.
   * @argument subTitleColor
   * @type {string}
   */
  subTitleColor: null,

  /**
   * The title of the banner.
   * @argument title
   * @type {string}
   */
  title: null,

  /**
   * The subtitle of the banner.
   * @argument subtitle
   * @type {string}
   */
  subtitle: null,
});
