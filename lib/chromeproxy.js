function SyncedProxy(options) {
  this.obj = {};
  this.nested = {};
  this.nested[''] = this.obj;
  this.options = options;

  // Chrome Harmony Proxies
  this.sink = Proxy.create(util.getChromeProxyFunctions(this.obj, options, '', this.nested));

}

// Initialize our object with all the recieved values
SyncedProxy.prototype.initObject = function(properties) {
  var fields = Object.keys(properties);
  for (var j = 0, jj = fields.length; j < jj; j++) {
    var field = fields[j];
    this.obj[field] = util.proxify(properties[field], field, { metadata: this.options, nested: this.nested });
  }
};

SyncedProxy.prototype.updateObject = function(properties) {
  for (var j = 0, jj = properties.length; j < jj; j++) {
    var property = properties[j];
    property[0] = property[0].split('.');
    var key = property[0].pop();
    var nesting = property[0].join('.');

    this.nested[nesting][key] = property[1];
  }

  // We should not be receiving messages out of order.
};

SyncedProxy.prototype.deleteProperties = function(properties) {
  for (var j = 0, jj = properties.length; j < jj; j++) {
    var property = properties[j];
    var continuation = property;
    property = property.split('.');
    var key = property.pop();
    var nesting = property.join('.');

    delete this.nested[nesting][key];
    // TODO: delete all further nested things in continuation.
    delete this.nested[continuation];
  }
};
