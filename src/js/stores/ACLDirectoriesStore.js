import {Store} from 'mesosphere-shared-reactjs';

import ACLDirectoriesActions from '../events/ACLDirectoriesActions';
import ActionTypes from '../constants/ActionTypes';
import AppDispatcher from '../events/AppDispatcher';
import EventTypes from '../constants/EventTypes';
import GetSetMixin from '../mixins/GetSetMixin';
import List from '../structs/List';

var ACLDirectoriesStore = Store.createStore({
  storeID: 'aclDirectories',

  mixins: [GetSetMixin],

  addChangeListener: function (eventName, callback) {
    this.on(eventName, callback);
  },

  removeChangeListener: function (eventName, callback) {
    this.removeListener(eventName, callback);
  },

  fetchDirectories: ACLDirectoriesActions.fetchDirectories,

  processDirectoriesSuccess(directories) {
    this.set({
      directories: new List({items: directories})
    });
    this.emit(EventTypes.ACL_DIRECTORIES_CHANGED);
  },

  dispatcherIndex: AppDispatcher.register(function (payload) {
    let source = payload.source;
    if (source !== ActionTypes.SERVER_ACTION) {
      return false;
    }

    let {data, type} = payload.action;

    switch (type) {
      // Get a list of external directories
      case ActionTypes.REQUEST_ACL_DIRECTORIES_SUCCESS:
        ACLDirectoriesStore.processDirectoriesSuccess(data);
        break;
      case ActionTypes.REQUEST_ACL_DIRECTORIES_ERROR:
        ACLDirectoriesStore.emit(EventTypes.ACL_DIRECTORIES_ERROR, data);
        break;
    }

    return true;
  })
});

module.exports = ACLDirectoriesStore;
