import {Hooks} from 'PluginSDK';
import Service from '../structs/Service';
import ValidatorUtil from '../utils/ValidatorUtil';
import VolumeConstants from '../constants/VolumeConstants';

const getFindPropertiesRecursive = function (service, item) {

  return Object.keys(item).reduce(function (memo, subItem) {

    if (item[subItem].type === 'group') {
      Object.keys(item[subItem].properties).forEach(function (key) {
        memo[key] = item[subItem].properties[key].default;

        if (item[subItem].properties[key].getter &&
          !!item[subItem].properties[key].getter(service)) {
          memo[key] = item[subItem].properties[key].getter(service);
        }
      });

      return memo;
    }

    if (item[subItem].type === 'object') {
      memo[subItem] = getFindPropertiesRecursive(service, item[subItem].properties);

      return memo;
    }

    memo[subItem] = item[subItem].default;

    if (item[subItem].getter) {
      memo[subItem] = item[subItem].getter(service);
    }

    return memo;
  }, {});
};

// Removes redundant attributes
const pruneHealthCheckAttributes = function (healthCheckSchema, healthCheck) {
  let properties = healthCheckSchema
    .properties
    .healthChecks
    .itemShape
    .properties;

  return Object.keys(properties).reduce(function (memo, prop) {
    if (!properties[prop].shouldShow
      || properties[prop].shouldShow(healthCheck)) {

      if (prop === 'command') {
        memo[prop] = {value: healthCheck[prop]};

        return memo;
      }

      memo[prop] = healthCheck[prop];
    }

    return memo;
  }, {});
};

const ServiceUtil = {
  createServiceFromFormModel(formModel, schema, isEdit = false, definition = {}) {

    if (formModel != null) {
      let {
        general,
        optional,
        containerSettings,
        environmentVariables,
        labels,
        volumes,
        networking,
        healthChecks
      } = formModel;

      if (general != null) {
        definition.id = general.id;
        definition.cmd = general.cmd;
        definition.cpus = general.cpus;
        definition.mem = general.mem;
        definition.disk = general.disk;
        definition.instances = general.instances;
      }

      if (optional != null) {
        definition.executor = optional.executor;
        definition.fetch = optional.uris &&
          optional.uris.split(',')
            .map(function (uri) {
              return {uri: uri.trim()};
            });
        definition.constraints = optional.constraints &&
          optional.constraints.split(',')
            .map(function (item) {
              return item.split(':');
            });
        definition.acceptedResourceRoles =
          optional.acceptedResourceRoles &&
            optional.acceptedResourceRoles.split(',')
              .map(function (item) {
                return item.trim();
              });
        definition.user = optional.user;
      }

      if (containerSettings != null && containerSettings.image != null) {
        definition.container = {
          docker: {
            image: containerSettings.image
          }
        };
        if (containerSettings.forcePullImage != null) {
          definition.container.docker.forcePullImage =
            containerSettings.forcePullImage;
        }
        if (containerSettings.privileged != null) {
          definition.container.docker.privileged =
            containerSettings.privileged;
        }
        if (containerSettings.parameters != null) {
          definition.container.docker.parameters =
            containerSettings.parameters;
        }
      }

      if (volumes != null) {
        let type = VolumeConstants.type.MESOS;
        let volumesList = [];

        if (definition.container == null) {
          definition.container = {};
        }

        if (definition.container.docker &&
          definition.container.docker.image) {

          type = VolumeConstants.type.DOCKER;

          if (volumes.dockerVolumes) {
            volumesList = volumesList.concat(
              volumes.dockerVolumes
              .filter(function ({containerPath, hostPath}) {
                return containerPath != null && hostPath != null;
              })
              .map(function ({containerPath, hostPath, mode}) {
                return {
                  containerPath,
                  hostPath,
                  mode: VolumeConstants.mode[mode]
                };
              })
            );
          }
        }

        if (volumes.externalVolumes) {
          let externalVolumes = volumes.externalVolumes
            .map(function ({containerPath, externalName}) {
              return {
                containerPath,
                external: {
                  name: externalName,
                  provider: 'dvdi',
                  options: {
                    'dvdi/driver': 'rexray'
                  }
                },
                mode: 'RW'
              };
            });

          if (externalVolumes.length) {
            volumesList = volumesList.concat(externalVolumes);
          }
          if (!isEdit && volumesList.length) {
            definition.updateStrategy = {
              maximumOverCapacity: 0,
              minimumHealthCapacity: 0
            };
          }
        }

        if (volumes.localVolumes) {
          let localVolumes = volumes.localVolumes
            .map(function ({containerPath, size}) {
              return {
                containerPath,
                persistent: {size},
                mode: VolumeConstants.mode.rw
              };
            });

          if (localVolumes.length) {
            volumesList = volumesList.concat(localVolumes);
            if (!isEdit && volumesList.length) {
              definition.updateStrategy = {
                maximumOverCapacity: 0,
                minimumHealthCapacity: 0
              };
              definition.residency = {
                relaunchEscalationTimeoutSeconds: 10,
                taskLostBehavior: 'WAIT_FOREVER'
              };
            }
          }
        }

        if (volumesList.length) {
          definition.container.type = type;
          definition.container.volumes = volumesList;
        }
      }

      if (labels != null && labels.labels != null) {
        definition.labels = labels.labels.reduce(function (memo, item) {
          if (item.key == null) {
            return memo;
          }

          // The 'undefined' value is not rendered by the JSON.stringify,
          // so make sure empty environment variables are not left unrendered
          let value = item.value;
          if (value == null) {
            value = '';
          }

          memo[item.key] = value;

          return memo;
        }, {});
      }

      if (healthChecks != null && healthChecks.healthChecks != null) {
        definition.healthChecks = healthChecks.healthChecks
          .reduce(function (memo, healthCheck) {
            // Only set defaults if user has changed a value in the form.
            // I.e. user has intent to create a healthCheck.
            let hasSetValue = Object.values(healthCheck).some(function (value) {
              return value != null && value !== false;
            });

            if (hasSetValue) {
              if (healthCheck.portType == null) {
                healthCheck.portType = 'PORT_INDEX';
              }
              if (healthCheck.protocol == null) {
                healthCheck.protocol = 'HTTP';
              }

              memo.push(
                pruneHealthCheckAttributes(
                  schema.properties.healthChecks, healthCheck
                )
              );
            }

            return memo;
          }, []);
      }

      if (environmentVariables != null && environmentVariables.environmentVariables != null) {
        definition.env = environmentVariables.environmentVariables
          .reduce(function (variableMap, variable) {

            if (variable.key == null) {
              return variableMap;
            }

            // The 'undefined' value is not rendered by the JSON.stringify,
            // so make sure empty environment variables are not left unrendered
            let value = variable.value;
            if (value == null) {
              value = '';
            }

            // Pass it through the registered plugins, with key upper cased
            variableMap[variable.key.toUpperCase()] = Hooks.applyFilter(
              'serviceVariableValue',
              value,
              variable,
              definition
            );

            return variableMap;
          }, {});
      }

      if (networking != null) {
        let isContainerApp = containerSettings != null && containerSettings.image != null;

        let networkType = networking.networkType || 'host';

        if (networking.ports != null) {
          networking.ports = networking.ports.filter(function (port) {
            return port.name != null || port.lbPort != null || port.loadBalanced;
          });
        }

        if (networking.ports != null && networking.ports.length) {
          if (networkType === 'host' || !isContainerApp) {
            // Avoid specifying an empty portDefinitions by default
            if (networking.ports.length) {
              definition.portDefinitions = networking.ports.map(function (port, index) {
                let portMapping = {protocol: 'tcp'};
                // Ensure that lbPort is an int
                let lbPort = parseInt(port.lbPort || 0, 10);

                if (networkType === 'host') {
                  portMapping.port = 0;
                }
                if (port.loadBalanced === true) {
                  if (networkType === 'host') {
                    portMapping.port = lbPort;
                  }
                  if (general != null) {
                    portMapping.labels = {};
                    portMapping.labels[`VIP_${index}`] = `${general.id}:${lbPort}`;
                  }
                } else if (lbPort != null && /^\d*$/.test(lbPort) ) {
                  portMapping.port = lbPort;
                }
                if (port.protocol != null) {
                  portMapping.protocol = port.protocol;
                }
                if (port.name != null) {
                  portMapping.name = port.name;
                }

                return portMapping;
              });
            }
          } else {
            definition.container.docker.portMappings = [];
            networking.ports.forEach(function (port, index) {
              let portMapping = {containerPort: 0, protocol: 'tcp'};

              if (port.protocol != null) {
                portMapping.protocol = port.protocol;
              }
              if (port.name != null) {
                portMapping.name = port.name;
              }
              let lbPort = parseInt(port.lbPort || 0, 10);
              portMapping.containerPort = lbPort;

              // Needs to be removed?
              // if (networkType === 'bridge') {
              //   portMapping.hostPort = lbPort;
              // }
              if (port.loadBalanced === true) {

                if (networkType !== 'bridge') {
                  portMapping.servicePort = lbPort;
                }
                portMapping.labels = {};
                if (general != null) {
                  portMapping.labels[`VIP_${index}`] = `${general.id}:${lbPort}`;
                }
              }

              if (['host', 'bridge'].includes(networkType)) {
                definition.container.docker.portMappings.push(portMapping);
              }

              if (!['host', 'bridge'].includes(networkType)) {

                if (port.expose) {
                  portMapping.hostPort = 0;
                }
                definition.container.docker.portMappings.push(portMapping);
                // TODO - Add portDefinition to loadBalanced field
              }
            });
          }
        }

        if (isContainerApp) {
          if (networkType === 'host') {
            definition.container.docker.network = 'HOST';
            delete(definition.ipAddress);
          } else if (networkType === 'bridge') {
            definition.container.docker.network = 'BRIDGE';
            delete(definition.ipAddress);
          } else {
            definition.container.docker.network = 'USER';
            definition.ipAddress = {networkName: networkType};
            delete(definition.portDefinitions);
          }
        }
      }
    }

    definition = Object.keys(definition).reduce(function (memo, key) {
      if (!ValidatorUtil.isEmpty(definition[key])) {
        memo[key] = definition[key];
      } else {
        memo[key] = null;
      }

      return memo;
    }, {});

    return new Service(definition);
  },

  createFormModelFromSchema(schema, service = new Service()) {

    return getFindPropertiesRecursive(service, schema.properties);
  },

  getAppDefinitionFromService(service) {

    let appDefinition = JSON.parse(JSON.stringify(service));

    // General
    appDefinition.id = service.getId();
    appDefinition.cpus = service.getCpus();
    appDefinition.mem = service.getMem();
    appDefinition.disk = service.getDisk();
    appDefinition.instances = service.getInstancesCount();
    appDefinition.cmd = service.getCommand();

    // Optional
    appDefinition.executor = service.getExecutor();
    appDefinition.fetch = service.getFetch();
    appDefinition.constraints = service.getConstraints();
    appDefinition.acceptedResourceRoles = service.getAcceptedResourceRoles();
    appDefinition.user = service.getUser();
    appDefinition.labels = service.getLabels();
    appDefinition.healthChecks = service.getHealthChecks();

    let containerSettings = service.getContainerSettings();
    if (containerSettings &&
      ((containerSettings.docker && containerSettings.docker.image) ||
      containerSettings.type === VolumeConstants.type.MESOS)
    ) {
      appDefinition.container = containerSettings;

      if (appDefinition.container.type === VolumeConstants.type.MESOS) {
        delete(appDefinition.container.docker);
      }
    }

    appDefinition.updateStrategy = service.getUpdateStrategy();
    appDefinition.residency = service.getResidency();
    appDefinition.ipAddress = service.getIpAddress();

    // Environment Variables
    appDefinition.env = service.getEnvironmentVariables();

    appDefinition.portDefinitions = service.getPortDefinitions();

    Hooks.applyFilter(
      'serviceToAppDefinition',
      appDefinition,
      service
    );

    return appDefinition;
  },

  getServiceNameFromTaskID(taskID) {
    let serviceName = taskID.split('.')[0].split('_');
    return serviceName[serviceName.length - 1];
  },

  convertServiceLabelsToArray(service) {
    if (!(service instanceof Service)) {
      return [];
    }

    let labels = service.getLabels();
    if (labels == null) {
      return [];
    }

    return Object.keys(labels).map((key) => ({key, value: labels[key]}));
  }
};

module.exports = ServiceUtil;
