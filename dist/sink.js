/*! sink.js build:0.0.0, development. Copyright(c) 2013 Eric Zhang, Michelle Bu, Rolland Wu MIT Licensed */
(function(exports){
util = {
  getChromeProxyFunctions: function(obj, metadata, path, nested) {
    util.log('Init proxy functions', metadata, path);

    if (path !== '') {
      path += '.';
    }

    var updates = [];
    var deletes = [];

    // Send updates incrementally.
    function sendUpdates() {
      if (updates.length !== 0) {
        metadata.socket.send(JSON.stringify(['update', updates, (metadata.force ? undefined : metadata.version)]));
        updates = [];
      }

      if (deletes.length !== 0) {
        metadata.socket.send(JSON.stringify(['delete', deletes, (metadata.force ? undefined : metadata.version)]));
        deletes = [];
      }
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
          var _p = Proxy.create(util.getChromeProxyFunctions(p, metadata, _path, nested));
          nested[_path] = p;

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

        if (!pd.__sinkAddedProperty) {
          var socket = metadata.socket; //LAYOUT:[ ‘update’, [[‘michelle.lastname’, ‘bu’]], 1 ]
          updates.push([path + name, pd]);
          util.setZeroTimeout(sendUpdates);
        } else {
          pd = pd.__sinkAddedProperty;
        }

        // RECURSIVE PROXYYYYYY.
        if (typeof(pd) === 'object') {
          pd = proxify(pd, path + name);
        }
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
        // propagate delete to server.
        deletes.push(path + name);
        util.setZeroTimeout(sendUpdates);

        delete nested[path + '.' + name];
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

  log: function () {
    if (util.debug) {
      var err = false;
      var copy = Array.prototype.slice.call(arguments);
      copy.unshift('SINK: ');
      for (var i = 0, l = copy.length; i < l; i++){
        if (copy[i] instanceof Error) {
          copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
          err = true;
        }
      }
      err ? console.error.apply(console, copy) : console.log.apply(console, copy);
    }
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
  var nested = {};
  nested[''] = o;
  options.version = 1;

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o, options, '', nested));

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

  function updateObject(properties) {
    for (var j = 0, jj = properties.length; j < jj; j++) {
      var property = properties[j];
      property[0] = property[0].split('.');
      var key = property[0].pop();
      var nesting = property[0].join('.');

      nested[nesting][key] = property[1];
    }

    // We should not be receiving messages out of order.
  };

  function deleteProperties(properties) {
    for (var j = 0, jj = properties.length; j < jj; j++) {
      var property = properties[j];
      var continuation = property;
      property = property.split('.');
      var key = property.pop();
      var nesting = property.join('.');

      delete nested[nesting][key];
      // TODO: delete all further nested things in continuation.
      delete nested[continuation];
    }
  }

  // bind ws handlers
  socket.onmessage = function(event) {
    var data = JSON.parse(event.data);
    util.log("Received message:", data);
    var message_type = data[0];
    var properties = data[1];
    var version = data[2];

    if (message_type === 'init') {
      initObject(properties);

    } else if (message_type === 'update' || message_type === 'collision') {
      updateObject(properties);

      if (message_type === 'collision') {
        // TODO: what to pass into the collision callback?
        if (options.collision) {
          options.collision(new Error('You tried to update the sink at the same time as someone else!'));
        }
      }

    } else if (message_type === 'delete') {
      deleteProperties(properties);

    } else if (message_type === 'success') {
      version = data[1];
    }

    // else success
    options.version = version;
  };
};

exports.sink = sink;

})(this);
