function sink(namespace, options, cb) {
  if (typeof(options) === 'function') {
    cb = options;
    options = {};
  }

  util.debug = options.debug;

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
