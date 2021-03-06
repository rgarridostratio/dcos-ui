import {Link} from 'react-router';
import React from 'react';
import {StoreMixin} from 'mesosphere-shared-reactjs';

import ComponentList from '../components/ComponentList';
import Config from '../config/Config';
import DCOSStore from '../stores/DCOSStore';
import HealthSorting from '../constants/HealthSorting';
import HostTimeSeriesChart from '../components/charts/HostTimeSeriesChart';
import Icon from '../components/Icon';
import InternalStorageMixin from '../mixins/InternalStorageMixin';
import MesosSummaryStore from '../stores/MesosSummaryStore';
import Page from '../components/Page';
import Panel from '../components/Panel';
import ResourceTimeSeriesChart from '../components/charts/ResourceTimeSeriesChart';
import ServiceList from '../components/ServiceList';
import StringUtil from '../utils/StringUtil';
import TasksChart from '../components/charts/TasksChart';
import SidebarActions from '../events/SidebarActions';
import UnitHealthStore from '../stores/UnitHealthStore';

function getMesosState() {
  let states = MesosSummaryStore.get('states');
  let last = states.lastSuccessful();

  return {
    activeNodes: states.getActiveNodesByState(),
    hostCount: last.getActiveSlaves().length,
    usedResourcesStates: states.getResourceStatesForNodeIDs(),
    usedResources: last.getSlaveUsedResources(),
    tasks: last.getServiceList().sumTaskStates(),
    totalResources: last.getSlaveTotalResources()
  };
}

var DashboardPage = React.createClass({

  displayName: 'DashboardPage',

  mixins: [InternalStorageMixin, StoreMixin],

  statics: {
    routeConfig: {
      label: 'Dashboard',
      icon: <Icon id="gauge" />,
      matches: /^\/dashboard/
    },

    // Static life cycle method from react router, that will be called
    // 'when a handler is about to render', i.e. on route change:
    // https://github.com/rackt/react-router/
    // blob/master/docs/api/components/RouteHandler.md
    willTransitionTo() {
      SidebarActions.close();
    }
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  getDefaultProps() {
    return {
      componentsListLength: 5,
      servicesListLength: 5
    };
  },

  componentWillMount() {
    this.store_listeners = [
      {name: 'dcos', events: ['change']},
      {name: 'summary', events: ['success', 'error']},
      {name: 'unitHealth', events: ['success', 'error']}
    ];

    this.internalStorage_set({
      openServicePanel: false,
      openTaskPanel: false
    });
    this.internalStorage_update(getMesosState());
  },

  onSummaryStoreError() {
    this.internalStorage_update(getMesosState());
  },

  onSummaryStoreSuccess() {
    this.internalStorage_update(getMesosState());
  },

  getServicesList() {
    let services = DCOSStore.serviceTree.getServices().getItems();

    let sortedServices = services.sort(function (service, other) {
      let health = service.getHealth();
      let otherHealth = other.getHealth();

      return HealthSorting[health.key] - HealthSorting[otherHealth.key];
    });

    return sortedServices.slice(0, this.props.servicesListLength);
  },

  getUnits() {
    return UnitHealthStore.getUnits();
  },

  getViewAllComponentsButton() {
    var componentCount = this.getUnits().getItems().length;
    if (!componentCount) {
      return null;
    }

    var componentCountWord = StringUtil.pluralize('Component', componentCount);

    return (
      <Link to="system-overview-units"
        className="button button-wide button-inverse more-button">
        {`View all ${componentCount} ${componentCountWord}`}
      </Link>
    );
  },

  getViewAllServicesBtn() {
    let servicesCount = DCOSStore.serviceTree.getServices().getItems().length;
    if (!servicesCount) {
      return null;

    }
    var textContent = 'View all ';
    if (servicesCount > this.props.servicesListLength) {
      textContent += servicesCount + ' ';
    }
    textContent += 'Services';

    return (
      <Link to="services-page"
        className="button button-wide button-inverse more-button">
        {textContent}
      </Link>
    );
  },

  getHeading(title) {
    return (
      <h5 className="flush inverse">
        {title}
      </h5>
    );
  },

  render() {
    var data = this.internalStorage_get();

    return (
      <Page title="Dashboard">
        <div className="grid row">
          <div className="grid-item column-mini-6 column-large-4 column-x-large-3">
            <Panel
              className="panel panel-inverse dashboard-panel dashboard-panel-resource-chart"
              heading={this.getHeading('CPU Allocation')}
              headingClass="panel-header panel-header-bottom-border inverse short-top short-bottom">
              <ResourceTimeSeriesChart
                colorIndex={0}
                usedResourcesStates={data.usedResourcesStates}
                usedResources={data.usedResources}
                totalResources={data.totalResources}
                mode="cpus"
                refreshRate={Config.getRefreshRate()} />
            </Panel>
          </div>
          <div className="grid-item column-mini-6 column-large-4 column-x-large-3">
            <Panel
              className="panel panel-inverse dashboard-panel dashboard-panel-resource-chart"
              heading={this.getHeading('Memory Allocation')}
              headingClass="panel-header panel-header-bottom-border inverse short-top short-bottom">
              <ResourceTimeSeriesChart
                colorIndex={6}
                usedResourcesStates={data.usedResourcesStates}
                usedResources={data.usedResources}
                totalResources={data.totalResources}
                mode="mem"
                refreshRate={Config.getRefreshRate()} />
            </Panel>
          </div>
          <div className="grid-item column-mini-6 column-large-4 column-x-large-3">
            <Panel
              className="panel panel-inverse dashboard-panel dashboard-panel-resource-chart"
              heading={this.getHeading('Disk Allocation')}
              headingClass="panel-header panel-header-bottom-border inverse short-top short-bottom">
              <ResourceTimeSeriesChart
                colorIndex={3}
                usedResourcesStates={data.usedResourcesStates}
                usedResources={data.usedResources}
                totalResources={data.totalResources}
                mode="disk"
                refreshRate={Config.getRefreshRate()} />
            </Panel>
          </div>
          <div className="grid-item column-mini-6 column-large-4 column-x-large-3">
            <Panel
              className="panel panel-inverse dashboard-panel dashboard-panel-list dashboard-panel-list-service-health allow-overflow"
              heading={this.getHeading('Services Health')}
              headingClass="panel-header panel-header-bottom-border inverse short-top short-bottom">
              <ServiceList
                healthProcessed={DCOSStore.dataProcessed}
                services={this.getServicesList()} />
              {this.getViewAllServicesBtn()}
            </Panel>
          </div>
          <div className="grid-item column-mini-6 column-large-4 column-x-large-3">
            <Panel
              className="panel panel-inverse dashboard-panel"
              heading={this.getHeading('Tasks')}
              headingClass="panel-header panel-header-bottom-border inverse short-top short-bottom">
              <TasksChart tasks={data.tasks} />
            </Panel>
          </div>
          <div className="grid-item column-mini-6 column-large-4 column-x-large-3">
            <Panel
              className="panel panel-inverse dashboard-panel dashboard-panel-list dashboard-panel-list-component-health"
              heading={this.getHeading('Component Health')}
              headingClass="panel-header panel-header-bottom-border inverse short-top short-bottom">
              <ComponentList
                displayCount={this.props.componentsListLength}
                units={this.getUnits()} />
              {this.getViewAllComponentsButton()}
            </Panel>
          </div>
          <div className="grid-item column-mini-6 column-large-4 column-x-large-3">
            <Panel
              className="panel panel-inverse dashboard-panel dashboard-panel-resource-chart"
              heading={this.getHeading('Nodes')}
              headingClass="panel-header panel-header-bottom-border inverse short-top short-bottom">
              <HostTimeSeriesChart
                data={data.activeNodes}
                currentValue={data.hostCount}
                refreshRate={Config.getRefreshRate()} />
            </Panel>
          </div>
        </div>
      </Page>
    );
  }
});

module.exports = DashboardPage;
