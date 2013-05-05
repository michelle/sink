function sink(namespace, cb) {

  var o = {};
  var metadata = {version: 1};

  // Chrome Harmony Proxies
  var p = Proxy.create(util.getChromeProxyFunctions(o, metadata));

  // start ws connection
  var socket = new WebSocket('ws://localhost:9000?room=' + namespace);
  
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
        metadata.version = version;
        cb(p);
    } else if (messageType == 'update') {
        if (version > metadata.version + 1){
            //received a future update message, do not apply
            updateOutOfOrder[version] = event;
        } else if (version === metadata.version+1) {
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
            console.log("Current version is: " + metadata.version);
        }
    } else if (messageType == 'collision') {
        //version is the updated value
        console.log("Collision Detected!");
        //TODO: Call the collision function if it exists
    } else if (messageType == 'success'){
        metadata.version = version;
    }
  };
};

exports.sink = sink;
