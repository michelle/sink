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
