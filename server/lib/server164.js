var url = require('url');
var util = require('./util.js');
var express = require('express');

function SinkServer164(port) {
  var server = express();

  var rooms = {};
  
  server.get('/listen/:room/:version', function(req, res){
    console.log('Got listen');
    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    var room = req.params.room;
    if (!rooms[room]) {
      rooms[room] = {version: 1, data: {}};
    }
    if (rooms[room].version == req.params.version) {
      res.send('Up to date');
      return;
    }    
    res.send(rooms[room]);
  });

  server.get('/send/:room/:version', function(req, res) {
    console.log('Got send', req.query.data);
    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    var room = req.params.room;
    var version = parseInt(req.params.version, 10);
    var data = req.query.data;
    if (!rooms[room]) {
      res.send('Invalid room');
      return;
    }
    if (rooms[room].version !== version) {
      res.send(rooms[room]);
      return;
    }
    
    rooms[room].version++;
    rooms[room].data = JSON.parse(data);
    res.send(rooms[room]);
  });

  server.listen(port);
  
  console.log('Sink164 server started on', port);
}
 
exports.SinkServer164 = SinkServer164;
