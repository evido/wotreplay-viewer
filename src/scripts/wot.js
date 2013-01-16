// Definition of Player object.
var Player = function() {
	this.id 		= null;
	this.position 	= null;
	this.team 		= null;
	this.alive		= null;
}

Player.prototype = {

}

// Definition of Model object
var Model = function() {
	this.players 	= {};
	this.clock		= 0;
}

Model.prototype = {
	getPlayer: function(id) {
		var player = this.players[id];
		if (typeof(player) == 'undefined') {
			player = new Player();
			player.id = id;
			player.alive = true;
			this.players[id] = player;
		}
		return player;
	},
	update: function(frame) {
		// update clock
		if (typeof(frame.clock) == 'undefined') {
			return;
		}

		if (frame.clock != null) {
			this.clock = frame.clock;
		}
			
		// we are only interested in the packet if it has a clock / player / team values
		if (typeof(frame.position) != 'undefined' 
				&& typeof(frame.player_id) != 'undefined') {
			var player = this.getPlayer(frame.player_id);
			player.position = frame.position;
			player.team 	= frame.team;
		}

		if (typeof(frame.target) != 'undefined'
				&& typeof(frame.destroyed_by) != 'undefined') {
			var player 	 = this.getPlayer(frame.target);
			player.alive = false;
		}
	}
}

function replay(data, target) {
	var overlay = target.getElementsByClassName("overlay")[0];
	var ctx = overlay.getContext("2d");
	var clock = 0, i = 0;
	var model = new Model();
	var update = function(model, packets, start, window_size, start_ix) {
		var ix;
		for (ix = 0; (start_ix + ix) < packets.length; ix++) {
			var packet = packets[start_ix + ix];

			if (typeof(packet.clock) == 'undefined') {
				continue;
			}

			// escape when outside of window size
			if (packet.clock > (start + window_size)) {
				break;
			}

			// update model with packet
			model.update(packet);
		}

		show(model, ctx);
		
		var next_ix = start_ix + ix;
		if (next_ix < packets.length) {
			setTimeout(function() {
				update(model, packets, start + window_size, window_size, next_ix);
			}, 100);	
		}
	}

	update(model, data.packets, 0.0, 0.2, 0);
}

function show(model, ctx) {
	// reset overlay
	ctx.clearRect(0, 0, 500, 500);

	ctx.fillStyle = "#FFFF00";
	ctx.textBaseline = "top";
	ctx.font = "bold 20px sans-serif";
	ctx.fillText(String(model.clock.toFixed(2)), 8, 5);

	for (var player_id in model.players) {
		var player = model.players[player_id];
		if (typeof(player.team) == undefined
				|| player.position == null) {
			continue;
		}

		var coord = to_2d_coord(player.position, [-500, 500, -500, 500], 500, 500);
		
		var styles = [
			"#00FF00",
			"#FF0000"
		];

		ctx.lineWidth = 2;
		ctx.strokeStyle = styles[player.team];
		ctx.fillStyle = styles[player.team];
		ctx.beginPath();
		ctx.arc(coord.x, coord.y, 3, 0, 2*Math.PI);

		if (player.alive) {
			ctx.fill();
		} else {
			ctx.stroke();	
		}
	}
}

function to_2d_coord(position, map_boundaries, width, height) {
    var x = position[0], y = position[2], z = position[1];
    x = (x - map_boundaries[0]) * (width / (map_boundaries[1] - map_boundaries[0] + 1));
    y = (map_boundaries[3] - y) * (height / (map_boundaries[3] - map_boundaries[2] + 1));
    return { x: x, y: y };
}

function setup(target) {
	var replayRequest = new XMLHttpRequest();
	replayRequest.open("GET", "data/output.json");
	replayRequest.onreadystatechange = function(state) {
		if(replayRequest.readyState != XMLHttpRequest.DONE) {
			return;
		}

		// proces data
		var data = JSON.parse(replayRequest.response);
		var map = target.getElementsByClassName('map')[0];
		var mapURL = 'maps/no-border/' + data["map"] + "_" + data["mode"] + ".png";
		map.setAttribute('src', mapURL);

		// play
		replay(data, target);
	}
	replayRequest.send();
}