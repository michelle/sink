/*! sink.js build:0.0.0, development. Copyright(c) 2013 Eric Zhang, Michelle Bu, Rolland Wu MIT Licensed */
(function(exports){
util = {
  getChromeProxyFunctions: function(obj, metadata, path) {
    console.log('init proxy functions', metadata, path);

    if (path !== '') {
      path += '.';
    }

    var updates = [];

    // Send updates incrementally.
    function sendUpdates() {
      if (updates.length === 0) {
        return;
      }

      metadata.socket.send(JSON.stringify(['update', updates, (metadata.force ? undefined : metadata.version)]));
      updates = [];
    };

    return {
      get: function(receiver, name) {
        return obj[name];
      },

      set: function(receiver, name, pd) {
        function proxify(_obj, _path) {
          if (typeof(_obj) !== 'object') {
            return _obj;
          }

          var p = {};
          // Create proxy now or later?
          var _p = Proxy.create(util.getChromeProxyFunctions(p, metadata, _path));

          if (_path !== '') {
            _path += '.';
          }

          var fields = Object.keys(_obj);
          for (var i = 0, ii = fields.length; i < ii; i += 1) {
            var field = fields[i];
            p[field] = proxify(_obj[field], _path + field);
          }

          return _p;
        };

        var socket = metadata.socket; //LAYOUT:[ ‘update’, [[‘michelle.lastname’, ‘bu’]], 1 ]
        updates.push([path + name, pd]);

        // RECURSIVE PROXYYYYYY.
        if (typeof(pd) === 'object') {
          pd = proxify(pd, path + name);
        }
        obj[name] = pd;

        util.setZeroTimeout(sendUpdates);
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
        return delete obj[name];
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
};
function sink(namespace, options, cb) {
  if (typeof(options) === 'function') {
    cb = options;
    options = {};
  }

  var o = {};
  options.version = 1;

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o, options, ''));

  // start ws connection
  var socket = new WebSocket('ws://localhost:8080?room=' + namespace);
  options.socket = socket;

  /* Current method for collisions: If we receive an update with version = 
   * currentVersion+2, we begin storing all changed variables. Then when we receive
   * any skipped versions, we only update nonupdated versions
   * key is propertyName, value is propertyValue
   */
  var updateOutOfOrder = {};

  // Initialize our object with all the recieved values
  function initObject(properties) {
    var fields = Object.keys(properties);
    for (var j = 0, jj = fields.length; j < jj; j++) {
      var field = fields[j];
      o[field] = properties[field];
    }

    cb(p);
  };

  function updateObject(properties, version) {
    if (version && version > options.version + 1){
      // received a future update message, do not apply
      updateOutOfOrder[version] = event;

    } else if (!version || version === options.version + 1) {

      for (var j = 0, jj = properties.length; j < jj; j++) {
        var property = properties[j];
        o[property[0]] = property[1];
      }

      // Check if we have waiting updates
      updateKeys = Object.keys(updateOutOfOrder);
      if (updateKeys.length !== 0) {
        // update from updateOutOfOrder
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

    } else {
      // receiving an update from the past
      // SHOULD NEVER HAPPEN IN CURRENT IMPLEMENTATION
      console.log("received old version: " + version);
      console.log("Current version is: " + options.version);
    }
  };

  // bind ws handlers
  socket.onmessage = function(event) {
    var data = JSON.parse(event.data);
    console.log("received message:", data);
    var message_type = data[0];
    var properties = data[1];
    var version = data[2];

    if (message_type === 'init') {
      initObject(properties);

    } else if (message_type === 'update' || message_type === 'collision') {
      updateObject(properties, version);

      if (message_type === 'collision') {
        // TODO: what to pass into the collision callback?
        if (options.collision) {
          options.collision(new Error('You tried to update the sink at the same time as someone else!'));
        }
      }

    } else if (message_type === 'success') {
      version = data[1];
    }

    // else success
    options.version = version;
  };
};

exports.sink = sink;

})(this);
