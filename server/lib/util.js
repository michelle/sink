var util = {
  isArray: function(obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  }
};

module.exports = util;
