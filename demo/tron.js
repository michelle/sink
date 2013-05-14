$(document).ready(function() {
  /*
  FIXME:
  -Tron.visited somehow not syncing. When opened in two tabs, neither one "sees" the other's updates
   This is reproducible, when I create a new tab, the old tab stops pushing updates for some reason.
   Is this a collision problem?
  TODO:
  -When we crash, reset ALL players. This would be easier with a start screen and a start button
  - ^ Reset ALL players? Or let the rest continue playing if >= 2?
  -Add a start button!
  -change color/shape of leading square (current position)
  -UI STUFF
  -Decrement number of players if someone leaves
  -Only start if 2 or more players
  -Enforce maximum number of players
  */
  sink('tron_demo', function(Tron) {

    // Canvas stuff
    // Is currently a 45x45 grid.
    var canvas = $("#canvas")[0];
    var ctx = canvas.getContext("2d");
    var w = $("#canvas").width();
    var h = $("#canvas").height();

    // Lets save the cell width in a variable for easy control
    var my_color;
    var cw = 10;
    var direction;
    var score;
    var my_position = "0,0";
    var player_num;

    // Initialize sinked variable
    // FIXME: constants need not be synced.
    if (Tron.visited === undefined) {
      Tron.reset = true;
      Tron.visited = {};
      Tron.players = 0;
      Tron.player_starts = {
        0: ["22,3", "down"],
        1: ["22,42", "up"],
        2: ["3,22","right"],
        3: ["42,22", "left"]
      };
      player_num = 0;
    } else {
      Tron.players += 1;
      player_num = Tron.players;
    }

    // Initialize initial init-conditions
    // ^ lol redundant?
    function init() {

      my_position = Tron.player_starts[player_num % 4][0];
      direction = Tron.player_starts[player_num % 4][1];
      score = 0;
      my_color = util.randomHSLColor();
      Tron.visited = {};

      //Start game loop!
      if (typeof game_loop != "undefined") {
        clearInterval(game_loop);
      }
      game_loop = setInterval(paint, 1000);
    }

    //First init
    init();

    //render loop
    function paint() {
      //paint base canvas
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "black";
      ctx.strokeRect(0, 0, w, h);

      // The movement code for the player to come here.
      var pos_array = my_position.split(",");
      var nx = parseInt(pos_array[0]);
      var ny = parseInt(pos_array[1]);

      // Lets add proper direction based movement now
      if (direction == "right") {
        nx++;
      } else if (direction == "left") {
        nx--;
      } else if (direction == "up") {
        ny--;
      } else if (direction == "down") {
        ny++;
      }

      // update my position
      my_position = nx + "," + ny;

      // Game ends if player crashes into a visited location
      // TODO: Add logic. Currently just ENDS THE GAME :(
      if(nx == -1 || nx == w/cw || ny == -1 || ny == h/cw || Tron.visited[my_position]) {
        // restart game
        console.log("crashed");
        clearInterval(game_loop);
        return;
      }

      // Add new location to visited
      Tron.visited[my_position] = my_color;

      // Paint!
      var visited_keys = Object.keys(Tron.visited)
      for(var i = 0, ii = visited_keys.length; i < ii; i++) {
        var temp_array = visited_keys[i].split(",")
        var temp_x = parseInt(temp_array[0])
        var temp_y = parseInt(temp_array[1])
        paint_cell(temp_x, temp_y, Tron.visited[visited_keys[i]]);
      }

      // Lets paint the score
      var score_text = "Score: " + score;
      ctx.fillText(score_text, 5, h-5);
    }

    // Lets first create a generic function to paint cells
    function paint_cell(x, y, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x*cw, y*cw, cw, cw);
    }

    // Lets add the keyboard controls now
    // use keydown to prevent sending multiple signals at once
    $(document).keydown(function(e){
      var key = e.which || e.keyCode;
      // We will add another clause to prevent reverse gear
      if (key == "37" && direction !== "right") {
        direction = "left";
      } else if (key == "38" && direction !== "down") {
        direction = "up";
      } else if (key == "39" && direction !== "left") {
        direction = "right";
      } else if(key == "40" && direction !== "up") {
        direction = "down"
      };
    })

    // prevent scrolling of window when playing TRON
    window.addEventListener("keydown", function(e) {
      // space and arrow keys
      var key = e.which || e.keyCode;
      if ([32, 37, 38, 39, 40].indexOf(key) > -1) {
          e.preventDefault();
      }
    }, false);

  //end sink
  })

})
