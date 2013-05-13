var url = require('url');
var util = require('./util.js');
var WebSocketServer = require('ws').Server;

function SinkServer(port) {
  var self = this;

  port = port || 8080;

  // Maps namespaces to rooms.
  this.rooms = {};

  // Start Websocket server.
  this.wss = new WebSocketServer({port: port});
  this.wss.on('connection', function(ws) {

    // Parse request url.
    var wsurl = url.parse(ws.upgradeReq.url, true);
    var namespace = wsurl.query.room;
    var room = self.getRoom(namespace);
    room.add(ws);

    // On a message, parse it.
    // [ (TYPE), (PROPERTY NAME), (PROPERTY VALUE), (VERSION #)? ]
    ws.on('message', function(message) {
      console.log('Received: %s', message);

      // Try to parse the message.
      try {
        message = JSON.parse(message);
      } catch (e) {
        return;
      }

      room.update(message, ws);
    });

    ws.on('close', function() {
      room.remove(ws);

      // Reset state.
      if (room.connections.length === 0) {
        delete self.rooms[namespace];
      }
    });

  });
  console.log('SinkServer running on port', port);
};

// Get a room.
SinkServer.prototype.getRoom = function(room) {
  if (!this.rooms[room]) {
    this.rooms[room] = new Room(room);
  }
  return this.rooms[room];
};

function Room(namespace) {
  // TODO: save history?
  this.namespace = namespace;
  this.connections = {};
  this.version = 1;
  this.object = {};
  // IDs for WS.
  this.count = 0;
};

// Adds a connection, sending it the updated object.
Room.prototype.add = function(ws) {
  ws.id = this.count;
  this.count += 1;

  // Send the entire object.
  ws.send(JSON.stringify(['init', this.constructObject(), this.version]));

  // Push socket to connections.
  this.connections[ws.id] = ws;
};

Room.prototype.constructObject = function() {
  return this.construct(this.object);
}

Room.prototype.construct = function(obj) {
  var ret;
  if (typeof(obj) === 'object' && obj) {
    ret = util.isArray(obj) ? [] : {};

    var keys = Object.keys(obj);
    for (var i = 0, ii = keys.length; i < ii; i += 1) {
      var key = keys[i];
      var next_obj = obj[key].value;
      ret[key] = this.construct(next_obj);
    }
  } else {
    ret = obj;
  }

  return ret;
};


// Remove a connection, sending it the updated object.
Room.prototype.remove = function(ws) {
  delete this.connections[ws.id];
};

// Updates server version and sends updates to all clients in room.
// TODO: account for multiple levels of properties.
Room.prototype.update = function(updates, from) {
  var version = updates[2];
  var type = updates[0];

  //console.log(JSON.stringify(updates));
  // Sync with self.
  updates = this.sync(updates, from)
  this.version += 1;
  //console.log(JSON.stringify(updates));

  // Update all clients.
  if (updates.length > 0) {
    var ids = Object.keys(this.connections);
    for (var i = 0, ii = ids.length; i < ii; i += 1) {
      var connection = this.connections[ids[i]];
      if (connection.id !== from.id) {
        connection.send(JSON.stringify([type, updates, this.version]));
      }
    }

    // Notify original client of success.
    from.send(JSON.stringify(['success', this.version]));
  }
};

Room.prototype.sync = function(updates, from) {
  var collisions = [];
  var version = updates[2];
  var type = updates[0];
  updates = updates[1];

  // Confirmed updates.
  var confirmed = [];

  // Update all properties.
  for (var i = 0, ii = updates.length; i < ii; i += 1) {
    var update = updates[i];

    // Check if collision.
    var previous;
    if (version && (previous = this.getLastVersion(update)) && version < previous.version) {
      collisions.push([update[0], this.construct(previous)]);

    } else {
      if (type === 'update') {
        this.updateObject(update);
      } else {
        this.deleteProperty(update);
      }
      confirmed.push(update);
    }
  }

  if (collisions.length > 0) {
    from.send(JSON.stringify(['collision', collisions, this.version]));
  }

  return confirmed;
};


// TODO: handle arrays.
Room.prototype.getLastVersion = function(update) {
  update = update[0].split(".");
  var obj;
  while (update.length && (obj = this.object[update.shift()])) {
    // Lalala.
  }
  return obj;
};

// Deletes a property.
Room.prototype.deleteProperty = function(update) {
  // TODO: error checks. here we assume everything can be found...
  update = update.split(".");
  var obj = this.object;

  while (update.length) {
    var key = update.shift();
    if (!update.length) {
      delete obj[key];
    } else {
      obj = obj[key].value;
    }
  }
}

Room.prototype.updateObject = function(update) {
  // deepcopy hack
  var value = JSON.parse(JSON.stringify(update[1]));
  update = update[0].split(".");
  var obj = this.object;

  while (update.length) {
    var key = update.shift();
    if (update.length && (!obj[key] || (typeof(obj[key].value) !== 'object' && typeof(obj[key] !== 'object')))) {
      obj[key] = { version: this.version, value: {} };
    } else if (!update.length) {
      obj[key] = { version: this.version, value: value };
    }
    obj = obj[key].value;
  }

  function toSpecialObj(_obj) {
    if (typeof(_obj) === 'object' && _obj) {
      var keys = Object.keys(_obj);
      for (var i = 0, ii = keys.length; i < ii; i += 1) {

        var key = keys[i];
        _obj[key] = { version: this.version, value: _obj[key] };
        toSpecialObj(_obj[key].value);
      }
    }
  }

  // Takes care of nested objects.
  toSpecialObj(obj);
};

exports.SinkServer = SinkServer;
