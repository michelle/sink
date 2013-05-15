$(document).ready(function() {

  // Canvas stuff
  var canvas = $("#canvas")[0];
  var ctx = canvas.getContext("2d");

  var WIDTH = $("#canvas").width();
  var HEIGHT = $("#canvas").height();
  var CELL_SIZE = 2;

  // Generic paint fn.
  function paintCell(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  };

  /*
    TODO:
    - Add a start button!
    - Change color/shape of leading square (current position)
    - Enforce maximum number of players
    - Reset button.
  */
  sink('tron_demo', {
        host: '10.10.65.184'
        //debug: true
      }, function(Tron) {

    var STARTING_POSITIONS = {
      0: [[108, 6], "down"],
      1: [[108, 219], "up"],
      2: [[6, 108],"right"],
      3: [[219, 108], "left"]
    };
    var INTERVAL = 1;

    // Variables for this game.
    var my_color;
    var direction;
    var score;
    var player_num;
    var alive = true;

    // My position
    var my_position = "0,0";
    var nx = 0;
    var ny = 0;
    function changePosition(x, y) {
      nx = x;
      ny = y;
      my_position = nx + ',' + ny;
    };
    function moveRight() {
      nx += INTERVAL;
      my_position = nx + ',' + ny;
    };
    function moveLeft() {
      nx -= INTERVAL;
      my_position = nx + ',' + ny;
    };
    function moveUp() {
      ny -= INTERVAL;
      my_position = nx + ',' + ny;
    };
    function moveDown() {
      ny += INTERVAL;
      my_position = nx + ',' + ny;
    };

    // Which key is currently pressed?
    var keyState = {};

    // Initialize sinked variable
    if (Tron.visited === undefined) {
      Tron.visited = {};
      Tron.all_visited = {};
      Tron.players = 0;
      Tron.start = false;
    } else {
      Tron.players += 1;
    }
    player_num = Tron.players;

    // Initialize initial init-conditions.
    function init() {
      var starting = STARTING_POSITIONS[player_num % 4];
      changePosition(starting[0][0], starting[0][1]);
      direction = starting[1];

      score = 0;
      my_color = util.randomHSLColor();
      // Get a unique color.
      while (Tron.visited[my_color]) {
        my_color = util.randomHSLColor();
      }

      Tron.visited[my_color] = [];
      Tron.visited[my_color].push(my_position);
      Tron.all_visited[my_position] = 1;

      if (Object.keys(Tron.visited).length > 1) {
        Tron.start = true;
      }

      window.onbeforeunload = function() {
        if (alive) {
          removeVisited();
        }
        if (Object.keys(Tron.visited).length < 2) {
          Tron.start = false;
        }
      }

      window.requestAnimationFrame(paint);
    }

    // Crash logic.
    function checkCrash() {
      // Game ends if player crashes into a wall or a visited location.
      if (nx === -1 ||
          nx == WIDTH/CELL_SIZE + 1 ||
          ny === -1 ||
          ny == HEIGHT/CELL_SIZE + 1 ||
          Tron.all_visited[my_position]) {

        console.log('Died at', nx, ny);
        alive = false;
        removeVisited();
        if (Object.keys(Tron.visited).length < 2) {
          Tron.start = false;
        }
        return;
      }

      Tron.visited[my_color].push(my_position);
      Tron.all_visited[my_position] = 1;
      score += 1;
    }

    // Removes this player's visited spots.
    function removeVisited() {
      var visited = Tron.visited[my_color];

      for (var i = 0, ii = visited.length; i < ii; i += 1) {
        delete Tron.all_visited[visited[i]];
      }

      delete Tron.visited[my_color];
    }


    // render loop
    function paint() {

      // paint base canvas
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      if (alive && Tron.start) {
        // Change direction if key is selected.
        // Do not allow diagonal moving.
        if (keyState[37] && direction !== 'right') {
          direction = 'left';
        } else if (keyState[38] && direction !== 'down') {
          direction = 'up';
        } else if (keyState[39] && direction !== 'left') {
          direction = 'right';
        } else if (keyState[40] && direction !== 'up') {
          direction = 'down';
        }

        if (direction === 'right') {
          moveRight();
        } else if (direction === 'left') {
          moveLeft();
        } else if (direction === 'up') {
          moveUp();
        } else if (direction === 'down') {
          moveDown();
        }

        checkCrash();
      }

      // Paint!
      var players = Object.keys(Tron.visited);
      for (var i = 0, ii = players.length; i < ii; i += 1) {
        var color = players[i];
        var visited = Tron.visited[color];

        for (var j = 0, jj = visited.length; j < jj; j += 1) {
          var temp_array = visited[j].split(",")
          var temp_x = parseInt(temp_array[0])
          var temp_y = parseInt(temp_array[1])
          paintCell(temp_x, temp_y, color);
        }
      }

      // Lets paint the score
      var score_text = "Score: " + score;
      ctx.fillText(score_text, 5, HEIGHT - 5);

      // Recurse render functions.
      window.requestAnimationFrame(paint);
    }

    // Prevent lag in simply adding a keydown handler.
    window.addEventListener('keydown', function(e) {
      var key = e.keyCode || e.which;
      keyState[key] = true;

      // prevent scrolling of window when playing TRON
      if ([32, 37, 38, 39, 40].indexOf(key) > -1) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', function(e) {
      keyState[e.keyCode || e.which] = false;
    });

    // Begin game.
    init();

  });

});
