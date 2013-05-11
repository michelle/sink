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

  function updateObject(properties, version) {
    /*if (version && version > options.version + 1){
      // received a future update message, do not apply
      updateOutOfOrder[version] = event;

    } else if (!version || version === options.version + 1) {
    */
    for (var j = 0, jj = properties.length; j < jj; j++) {
      var property = properties[j];
      property[0] = property[0].split('.');
      var key = property[0].pop();
      var nesting = property[0].join('.');

      nested[nesting][key] = property[1];
    }

      /*
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
    }*/

    // We should not be receiving messages out of order.
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
