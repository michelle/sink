var url = require('url');
var WebSocketServer = require('ws').Server

function SinkServer(port) {

  var self = this;

  port = port || 8080;
  
  this.rooms = {};
  
  this.wss = new WebSocketServer({port: port});
  this.wss.on('connection', function(ws) {
    var url = url.parse(ws.upgradeReq.url);
    var room = self.getRoom(url.query.room);
    
    ws.send(
    
    ws.on('message', function(message) {
      console.log('received: %s', message);
    });
    ws.send('something');
  });
  console.log('SinkServer running on port', port);
}



exports.SinkServer = SinkServer;