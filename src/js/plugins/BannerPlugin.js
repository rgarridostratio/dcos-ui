/*eslint-disable no-unused-vars*/
import React from "react";
/*eslint-enable no-unused-vars*/

import IconInfo from "../components/icons/IconInfo";
import DOMUtils from "../utils/DOMUtils";

const BannerPlugin = {

  configuration: {
    backgroundColor: "#1E232F",
    foregroundColor: "#FFFFFF",
    headerTitle: null,
    headerContent: null,
    footerContent: null,
    imagePath: null,
    dismissible: null
  },

  /**
   * @param  {Object} Plugins The Plugins API
   */
  initialize: function (Plugins) {
    Plugins.addAction("applicationDidUpdate",
      this.applicationDidUpdate.bind(this)
    );
    Plugins.addFilter("applicationContents",
      this.applicationContents.bind(this)
    );
    Plugins.addFilter("overlayNewWindowButton",
      this.overlayNewWindowButton.bind(this)
    );
  },

  configure: function (configuration) {
    // Only merge keys that have a non-null value
    Object.keys(configuration).forEach((key) => {
      if (configuration[key] != null) {
        this.configuration[key] = configuration[key];
      }
    });
  },

  isEnabled: function () {
    let configuration = this.configuration;

    return configuration.headerTitle != null ||
      configuration.headerContent != null ||
      configuration.footerContent != null ||
      configuration.imagePath != null;
  },

  toggleFullContent: function () {
    let banner = document.querySelector(".banner-plugin-wrapper");
    banner.classList.toggle("display-full");
  },

  applicationDidUpdate: function () {
    if (this.isEnabled() === false || !DOMUtils.isTopFrame()) {
      return;
    }

    let frame = document.getElementById("banner-plugin-iframe");
    if (frame == null) {
      return;
    }

    if (this.historyListenerAdded) {
      return;
    }

    this.historyListenerAdded = true;
    let frameWindow = frame.contentWindow;
    let topWindow = window;

    frameWindow.addEventListener("popstate", function () {
      topWindow.location.hash = frameWindow.location.hash;
    });
  },

  applicationContents: function () {
    if (this.isEnabled() === false || !DOMUtils.isTopFrame()) {
      return null;
    }

    return (
      <div className="banner-plugin-wrapper">
        {this.getHeader()}

        <iframe
          frameBorder="0"
          id="banner-plugin-iframe"
          src="index.html" />

        {this.getFooter()}
      </div>
    );
  },

  overlayNewWindowButton: function (button) {
    if (this.isEnabled()) {
      return null;
    }

    return button;
  },

  getColorStyles: function () {
    return {
      color: this.configuration.foregroundColor,
      backgroundColor: this.configuration.backgroundColor
    };
  },

  getIcon: function () {
    let imagePath = this.configuration.imagePath;

    if (imagePath == null || imagePath === "") {
      return null;
    }

    return (
      <span className="
        icon
        icon-small
        icon-image-container
        icon-app-container">
        <img src={imagePath} />
      </span>
    );
  },

  getTitle: function () {
    let title = this.configuration.headerTitle;

    if (title == null || title === "") {
      return null;
    }

    return (
      <h5
        className="title flush-top flush-bottom"
        style={{color: this.configuration.foregroundColor}}>
        {title}
      </h5>
    );
  },

  getHeaderContent: function () {
    let content = this.configuration.headerContent;

    if (content == null || content === "") {
      return null;
    }

    return (
      <span className="content hidden-mini" title={content}>
        {content}
      </span>
    );
  },

  getHeader: function () {
    let icon = this.getIcon();
    let title = this.getTitle();
    let content = this.getHeaderContent();

    if (icon == null && title == null && content == null) {
      return null;
    }

    return (
      <header
        className="flex-container"
        style={this.getColorStyles()}>
        <span className="flex-container">
          <span>
            {icon}
            {title}
          </span>
          <span
            className="banner-plugin-info-icon clickable hidden-small hidden-medium hidden-large"
            onClick={this.toggleFullContent}>
            <IconInfo fill={this.configuration.foregroundColor} />
          </span>
        </span>
        {content}
      </header>
    );
  },

  getFooter: function () {
    let content = this.configuration.footerContent;

    if (content == null || content === "") {
      return null;
    }

    return (
      <footer style={this.getColorStyles()}>
        <span className="content" title={content}>
          {content}
        </span>
      </footer>
    );
  }

};

export default BannerPlugin;
