var util = {
  randomHSLColor: function(alpha){
    var hue = Math.floor(Math.random() * 361 + 1);
    var output = (alpha ? 'hsla(' : 'hsl(') + hue + ',38%,50%' + (alpha ? ',' + alpha + ')' : ')');
    return output;
  }
}
