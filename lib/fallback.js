// Sink fallback--should work for Chrome with no flags.
function Fallback(options) {
  this.sink = {};
  this.options = options;

  // TODO: do requestAnimationFrame and getter/setters.
  //setInterval
}

// Initialize our object with all the recieved values
Fallback.prototype.initObject = function(properties) {
  var fields = Object.keys(properties);
  for (var j = 0, jj = fields.length; j < jj; j++) {
    var field = fields[j];
    this.obj[field] = properties[field];
  }
};

Fallback.prototype.updateObject = function(properties) {
  // TODO
  for (var j = 0, jj = properties.length; j < jj; j++) {
    var property = properties[j];

  }
};

Fallback.prototype.deleteProperties = function(properties) {
  // TODO
  for (var j = 0, jj = properties.length; j < jj; j++) {
    var property = properties[j];

  }
};
