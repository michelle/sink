/*! sink.js build:0.0.0, development. Copyright(c) 2013 Eric Zhang, Michelle Bu, Rolland Wu MIT Licensed */
(function(exports){
util = {
  extend: function(dest, source) {
    for(var key in source) {
      if(source.hasOwnProperty(key)) {
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
        // no change.
        if (obj[name] === pd) {
          return;
        } else if (typeof(pd) == "function"){
          //For now, do not support function updates
          //return;
        }

        var socket = metadata.socket; //LAYOUT:[ ‘update’, [[‘michelle.lastname’, ‘bu’]], 1 ]
        updates.push([path + name, pd]);
        util.setZeroTimeout(sendUpdates);

        // RECURSIVE PROXYYYYYY.
        if (typeof(pd) === 'object') {
          pd = util.proxify(pd, path + name, {metadata: metadata, nested: nested});
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
  }(this))
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

  var o = {};
  var nested = {};
  nested[''] = o;

  var server = options.host;
  server += options.port ? ':' + options.port : '';

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o, options, '', nested));

  // start ws connection
  var socket = new WebSocket('ws://' + server + '?room=' + namespace);
  options.socket = socket;

  // Initialize our object with all the recieved values
  function initObject(properties) {
    var fields = Object.keys(properties);
    for (var j = 0, jj = fields.length; j < jj; j++) {
      var field = fields[j];
      o[field] = util.proxify(properties[field], field, {metadata: options, nested: nested});
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
        options.collision(new Error('You tried to update the sink at the same time as someone else!'));
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
