var util = {
  randomHSLColor: function(){
    var hue = Math.floor(Math.random()*361+1)
    var output = "hsl(" + hue + ",38%,50%)"
    return output
  }
}
