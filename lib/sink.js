function sink(namespace, cb) {

  var o = {};
  var metadata = { version: 1 };

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o, metadata));

  // start ws connection
  var socket = new WebSocket('ws://localhost:8080?room=' + namespace);
  metadata.socket = socket;

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
    if (version > metadata.version + 1){
      // received a future update message, do not apply
      updateOutOfOrder[version] = event;

    } else if (version === metadata.version + 1) {

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
      console.log("Current version is: " + metadata.version);
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

    } else if (message_type === 'update') {
      updateObject(properties, version);

    } else if (message_type === 'collision') {

      // version is the updated value
      console.log("Collision Detected!");
      // TODO: Call the collision function if it exists
      // DEFAULT if initializing and already existant var, ignore
      // Otherwise, nothing?

    } else if (message_type === 'success') {
      version = data[1];
    }

    // else success
    metadata.version = version;
  };
};

exports.sink = sink;
