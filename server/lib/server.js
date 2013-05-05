var url = require('url');
var WebSocketServer = require('ws').Server

function SinkServer(port) {

  var self = this;

  port = port || 8080;

  // Maps namespaces to rooms.
  this.rooms = {};

  // Start Websocket server.
  this.wss = new WebSocketServer({port: port});
  this.wss.on('connection', function(ws) {

    // Parse request url.
    var url = url.parse(ws.upgradeReq.url);
    var room = self.getRoom(url.query.room);
<<<<<<< HEAD
    
    ws.send('hi');
    
=======
    room.add(ws);

    // On a message, parse it.
    // [ (TYPE), (PROPERTY NAME), (PROPERTY VALUE), (VERSION #)? ]
>>>>>>> de5f2e2317c3c9ec70cd290b4353b571125da9a5
    ws.on('message', function(message) {
      console.log('received: %s', message);

      // Try to parse the message.
      try {
        message = JSON.parse(message);
      } catch (e) {
        return;
      }

      if (message[0] === 'update') {
        room.update(message, ws);
      }
    });

    ws.on('close', function() {
      room.remove(ws);
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
  this.connections = [];
  this.version = 1;
  this.object = {};
};

// Adds a connection, sending it the updated object.
Room.prototype.add = function(ws) {
  // Send the entire object.
  ws.send(JSON.stringify(['init', this.object, this.version]));

  // Push socket to connections.
  this.connections.push(ws);
};

// Remove a connection, sending it the updated object.
Room.prototype.remove = function(ws) {
  // TODO
};

// Updates server version and sends updates to all clients in room.
Room.prototype.update = function(updates, from) {
  var version = updates[2];
  updates = updates[1];

  // Check if collision.
  if (version && version !== this.version) {
    var old_fields = [];
    for (var i = 0, ii = updates.length; i < ii; i += 1) {
      var field = updates[i][0]
      old_fields.push([field, this.object[field]]);
    }
    from.send(JSON.stringify(['collision', old_fields, this.version]));
    return;
  }

  // Sync with self.
  this.sync(updates);
  this.version += 1;

  // Update all clients.
  for (var i = 0, ii = this.connections.length; i < ii; i += 1) {
    var connection = this.connections[i];
    if (connection !== from) {
      connection.send(JSON.stringify(['update', updates, this.version]));
    }
  }

  // Notify original client of success.
  from.send(JSON.stringify(['success', this.version]));
};

Room.prototype.sync = function(updates) {
  // Update all properties.
  for (var i = 0, ii = updates.length; i < ii; i += 1) {
    this.object[updates[0]] = updates[1];
  }
}


exports.SinkServer = SinkServer;
