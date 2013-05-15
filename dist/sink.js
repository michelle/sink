/*! sink.js build:0.0.0, development. Copyright(c) 2013 Eric Zhang, Michelle Bu, Rolland Wu MIT Licensed */
(function(exports){
var util = {
  extend: function(dest, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        dest[key] = source[key];
      }
    }
    return dest;
  },

  getChromeProxyFunctions: function(obj, metadata, path, nested) {
    util.log('Init proxy functions', metadata, path);

    if (path !== '') {
      path += '.';
    }

    var updates = [];
    var deletes = [];
    //var pushes = [];

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

      /* TODO
      if (pushes.length !== 0) {
        metadata.socket.send(JSON.stringify(['push', pushes, (metadata.force ? undefined : metadata.version)]));
        pushes = [];
      }
      */
    };

    return {
      get: function(receiver, name) {
        return obj[name];
      },

      set: function(receiver, name, pd) {
        // no change.
        if (obj[name] === pd || typeof(pd) == "function"){
          // For now, do not support function updates
          return;
        }

        /*
        var index;
        try {
          index = parseInt(name);
        } catch (e) {
          // nothing.
        }

        // Check if pushing to array.
        if (obj.length && index && index === obj.length) {
          pushed.push([path, pd]);
        } else {
          updates.push([path + name, pd]);
        }
        */

        updates.push([path + name, pd]);
        util.setZeroTimeout(sendUpdates);

        // RECURSIVE PROXYYYYYY.
        pd = util.proxify(pd, path + name, {metadata: metadata, nested: nested});
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

      enumerate: function() {
        var result = [];
        for (var name in obj) {
          result.push(name);
        };
        return result;
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

  proxify: function(_obj, _path, _opts) {
    if (typeof(_obj) !== 'object' || !_obj) {
      return _obj;
    }

    var is_arr = util.isArray(_obj);
    var p = {};
    var proto = Object.prototype;
    if (is_arr) {
      p = [];
      proto = Array.prototype;
    }

    var _p = Proxy.create(util.getChromeProxyFunctions(p, _opts.metadata, _path, _opts.nested), proto);
    _opts.nested[_path] = p;

    if (is_arr) {
      for (var i = 0, ii = _obj.length; i < ii; i += 1) {
        p[i] = util.proxify(_obj[i], _path + '.' + i, _opts);
      }
    } else {
      var fields = Object.keys(_obj);
      for (var i = 0, ii = fields.length; i < ii; i += 1) {
        var field = fields[i];
        p[field] = util.proxify(_obj[field], _path + '.' + field, _opts);
      }
    }

    return _p;
  },

  isArray: function(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]" || obj.constructor === Array;
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
  }(this)),

};
function SyncedProxy(options) {
  this.obj = {};
  this.nested = {};
  this.nested[''] = this.obj;
  this.options = options;

  // Chrome Harmony Proxies
  this.sink = Proxy.create(util.getChromeProxyFunctions(this.obj, options, '', this.nested));

}

// Initialize our object with all the recieved values
SyncedProxy.prototype.initObject = function(properties) {
  var fields = Object.keys(properties);
  for (var j = 0, jj = fields.length; j < jj; j++) {
    var field = fields[j];
    this.obj[field] = util.proxify(properties[field], field, { metadata: this.options, nested: this.nested });
  }
};

SyncedProxy.prototype.updateObject = function(properties) {
  for (var j = 0, jj = properties.length; j < jj; j++) {
    var property = properties[j];
    property[0] = property[0].split('.');
    var key = property[0].pop();
    var nesting = property[0].join('.');

    this.nested[nesting][key] = util.proxify(property[1], nesting + '.' + key, { metadata: this.options, nested: this.nested });
  }

  // We should not be receiving messages out of order.
};

SyncedProxy.prototype.deleteProperties = function(properties) {
  for (var j = 0, jj = properties.length; j < jj; j++) {
    var property = properties[j];
    var continuation = property;
    property = property.split('.');
    var key = property.pop();
    var nesting = property.join('.');

    delete this.nested[nesting][key];
    // TODO: delete all further nested things in continuation.
    delete this.nested[continuation];
  }
};
function sink(namespace, options, cb) {
  if (typeof(options) === 'function') {
    cb = options;
    options = {};
  }

  options = util.extend({
    port: '8080',
    host: 'localhost',
    collision: function() {},
    version: 1,
    debug: false
  }, options);

  util.debug = options.debug;

  var synced;

  var server = options.host;
  server += options.port ? ':' + options.port : '';

  if (Proxy && Proxy.create) {
    util.log('This is Chrome.');
    synced = new SyncedProxy(options);
  } else if (Proxy) {
    util.log('This is a direct proxy browser.');
    //synced = new SyncedDirectProxy(options);
  }

  function initSocket() {
    // start ws connection
    try {
      var socket = new WebSocket('ws://' + server + '?room=' + namespace);
    } catch (e) {
      cb(null, new Error('Could not open Websocket connection'));
      return;
    }
    options.socket = socket;

    // bind ws handlers
    socket.onmessage = function(event) {
      var data = JSON.parse(event.data);
      util.log("Received message:", data);
      var message_type = data[0];
      var properties = data[1];
      var version = data[2];

      if (message_type === 'init') {
        synced.initObject(properties);

        cb(synced.sink);
      } else if (message_type === 'update' || message_type === 'collision') {
        synced.updateObject(properties);

        if (message_type === 'collision') {
          // TODO: what to pass into the collision callback?
          options.collision(new Error('You tried to update the sink at the same time as someone else!'));
        }

      } else if (message_type === 'delete') {
        synced.deleteProperties(properties);

      } else if (message_type === 'success') {
        version = data[1];
      }

      // else success
      options.version = version;
    };
  };

  if (synced) {
    util.log('Starting Websocket connection.');
    util.setZeroTimeout(initSocket);
  } else {
    cb(null, new Error('Your browser is not supported'));
  }

};

exports.sink = sink;

})(this);
