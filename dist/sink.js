/*! sink.js build:0.0.0, development. Copyright(c) 2013 Eric Zhang, Michelle Bu, Rolland Wu MIT Licensed */
(function(exports){
util = {
  getChromeProxyFunctions: function(obj) {
    return {
      get: function(receiver, name) {
        return obj[name];
      },

      set: function(receiver, name, pd) {
        var socket = new WebSocket('localhost:9090');
        //LAYOUT:[ ‘update’, ‘michelle.lastname’, ‘bu’, 1 ]
        console.log("version")
        var sendme = ['update', name, pd, version]
        obj[name] = pd;
      },

      // Fundamental traps.
      getOwnPropertyDescriptor: function(name) {
        var desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc !== undefined) { desc.configurable = true; }
        return desc;
      },

      getPropertyDescriptor: function(name) {
        var desc = Object.getPropertyDescriptor(obj, name);
        if (desc !== undefined) { desc.configurable = true; }
        return desc;
      },

      getOwnPropertyNames: function() {
        return Object.getOwnPropertyNames(obj);
      },

      getPropertyNames: function(name) {
        return Object.getPropertyNames(obj);
      },

      defineProperty: function(name, pd) {
        Object.defineProperty(obj, name, pd);
      },

      delete: function(name) {
        return delete obj.name;
      },

      fix: function() {
        if (Object.isFrozen(obj)) {
          var result = {};
          var names = Object.getOwnPropertyNames(obj);
          for (var i = 0, ii = names.length; i < ii; i += 1) {
            var name = names[i];
            result[name] = Object.getOwnPropertyDescriptor(obj, name);
          }
          return result;
        }
        return undefined;
      }
    };
  },

  setZeroTimeout: (function(global) {
    var timeouts = [];
    var messageName = 'zero-timeout-message';

    // Like setTimeout, but only takes a function argument.	 There's
    // no time argument (always zero) and no arguments (you have to
    // use a closure).
    function setZeroTimeoutPostMessage(fn) {
      timeouts.push(fn);
      global.postMessage(messageName, '*');
    }

    function handleMessage(event) {
      if (event.source == global && event.data == messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (timeouts.length) {
          timeouts.shift()();
        }
      }
    }
    if (global.addEventListener) {
      global.addEventListener('message', handleMessage, true);
    } else if (global.attachEvent) {
      global.attachEvent('onmessage', handleMessage);
    }
    return setZeroTimeoutPostMessage;
  }(this))
};function sink(namespace, cb) {

  var o = {};

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o));

  // start ws connection
  var socket = new WebSocket('localhost:9000');
  var currentVersion = 1;
  /*
  Current method for collisions: If we receive an update with version = 
  currentVersion+2, we begin storing all changed variables. Then when we receive
  any skipped versions, we only update nonupdated versions
  key is propertyName, value is propertyValue
  */
  var updateOutOfOrder = {};
  // bind ws handlers
  socket.onmessage = function(event) {
    var messageType = event.data[0];
    var properties = event.data[1];
    var propertyName = properties[0];
    var val = properties[1];
    var version = properties[2];
    if (messageType == 'init') {
        //initialize our object with all the recieved values
        for (var j = 0, jj = properties.length; j < jj; j++) {
            p[propertyName] = val;
        }
        //callback
        currentVersion = version;
        cb(p);
    } else if (messageType == 'update') {
        if (version > currentVersion + 1){
            //received a future update message, do not apply
            updateOutOfOrder[version] = event;
        } else if (version === currentVersion+1) {
            for (var j = 0, jj = properties.length; j < jj; j++) {
                p[propertyName] = val;
            }
            //Check if we have waiting updates
            updateKeys = Object.keys(updateOutOfOrder);
            if (updateKeys.length !== 0) {
                //update from updateOutOfOrder
                var updateVersion = version + 1;
                while (updateOutOfOrder[updateVersion]) {
                    var updateEvent = updateOutOfOrder[updateVersion];
                    var updateproperties = updateEvent[1];
                    var updateName = updateProperties[0];
                    var updateVal = updateProperties[1];
                    for (var j = 0, jj = updateProperties.length; j < jj; j++) {
                        p[updateName] = updateLength;
                    }
                    delete updateOutOfOrder[updateVersion]
                    updateVersion += 1;
                }
            }
        } else{
            //receiving an update from the past
            //SHOULD NEVER HAPPEN IN CURRENT IMPLEMENTATION
            console.log("received old version: " + version);
            console.log("Current version is: " + currentVersion);
        }
    } else if (messageType == 'collision') {
        //version is the updated value
        console.log("Collision Detected!");
        //TODO: Call the collision function if it exists
    } else if (messageType == 'success'){
        currentVersion = version;
    }
  };
};

exports.sink = sink;

})(this);
