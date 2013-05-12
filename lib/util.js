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

        var socket = metadata.socket; //LAYOUT:[ ‘update’, [[‘michelle.lastname’, ‘bu’]], 1 ]
        updates.push([path + name, pd]);
        util.setZeroTimeout(sendUpdates);

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
        // getPropertyDescriptor not in ES5
        var desc = Object.getOwnPropertyDescriptor(obj, name);
        if (desc !== undefined) { desc.configurable = true; }
        return desc;
      },

      getOwnPropertyNames: function() {
        return Object.getOwnPropertyNames(obj);
      },

      getPropertyNames: function(name) {
        return Object.keys(obj);
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

  isArray: function(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
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
