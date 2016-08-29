import React, {PropTypes} from 'react';

import BreadcrumbSegmentLink from './BreadcrumbSegmentLink';

class BreadcrumbSegment extends React.Component {
  constructor() {
    super(...arguments);

    this.state = {
      isLoadingCrumb: true
    };
  }

  getCrumbLabel() {
    return '';
  }

  /**
   * This method will be called if `isLoadingCrumb` is true.
   * This will return the very last segment in the URL,
   * using that as a the crumb label
   *
   * @return {String} Crumb label
   */
  getBackupCrumbLabel() {
    let {parentRouter, routeName} = this.props;
    let route = parentRouter.namedRoutes[routeName];
    let lastParam = route.paramNames[route.paramNames.length - 1];
    let currentParamValue = parentRouter.getCurrentParams()[lastParam];

    return currentParamValue;
  }

  render() {
    let label = '';

    if (this.state.isLoadingCrumb) {
      label = this.getBackupCrumbLabel();
    } else {
      label = this.getCrumbLabel();
    }

    let route = {
      to: this.props.routeName,
      params: this.props.parentRouter.getCurrentParams()
    };

    return (
      <BreadcrumbSegmentLink label={label} route={route} />
    );
  }
};

BreadcrumbSegment.propTypes = {
  parentRouter: PropTypes.func.isRequired,
  routeName: PropTypes.string.isRequired
};

module.exports = BreadcrumbSegment;
