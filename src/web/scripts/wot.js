// Definition of Player object.
var Player = function() {
	this.id 		= null;
	this.position 	= null;
	this.team 		= null;
	this.alive		= null;
	this.clock		= null;
	this.turret_direction = 0;
	this.hull_direction = null;
	this.received_damage = false;
}

Player.prototype = {

}

// Definition of Model object
var Model = function(game, map_boundaries) {
	this.players 		= {};
	this.clock			= 0;
	this.game			= game;
	this.map_boundaries = map_boundaries;
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
			player.turret_direction += frame.hull_orientation[1] * 0.34 / 2;
			player.hull_direction = frame.hull_orientation[0];
			player.team 	= frame.team;
			player.clock	= this.clock;
		}

		if (typeof(frame.source) != 'undefined'
				&& typeof(frame.health) != 'undefined') {
			var player = this.getPlayer(frame.player_id);
			player.received_damage = true;
			player.clock = this.clock;
			var vehicles = this.game.vehicles;
			console.log(vehicles[frame.source].name + " (" + vehicles[frame.source].vehicleType + ") hit " 
				+ vehicles[player.id].name + " (" + vehicles[player.id].vehicleType + ")" );
		}

		if (typeof(frame.target) != 'undefined'
				&& typeof(frame.destroyed_by) != 'undefined') {
			var player 	 = this.getPlayer(frame.target);
			player.alive = false;
			player.clock = this.clock;
		}
	}
}

var Viewer = function(target, serviceUrl) {
	this.target = target;
	this.serviceUrl = serviceUrl;
	this.model = null;

	// configure the target element as a replay viewer
	target.classList.add('replay-viewer');

	this.map = document.createElement('img');
	this.map.classList.add('map');
	this.map.width = this.map.height = 500
	this.target.appendChild(this.map);

	this.overlay = document.createElement('canvas');
	this.overlay.classList.add('overlay');
	this.overlay.width = this.overlay .height = 500;
	this.target.appendChild(this.overlay);

	this.link = document.createElement('a');
	this.link.classList.add('permalink');
	this.link.innerText = "PERMALINK";
	this.link.style.display = "none";
	this.target.appendChild(this.link);

	this.recorder_team  = null;
}

Viewer.prototype = {
	replay: function(data) {
		var ctx = this.overlay.getContext("2d");
		this.model = new Model(data.summary, data.map_boundaries);
		this.recorder_team = data.summary.vehicles[data.recorder_id].team - 1;
		var update = function(model, packets, window_start, window_size, start_ix) {
			// model of the viewer change -> stop
			if (this.model != model) {
				return;
			}

			var window_end = window_start + window_size, ix;
			for (ix = start_ix; ix < packets.length; ix++) {
				var packet = packets[ix];

				if (typeof(packet.clock) == 'undefined') {
					continue;
				}

				// escape when outside of window size
				if (packet.clock > window_end) {
					break;
				}

				// update model with packet
				model.update(packet);
			}

			this.show(data, ctx);
			
			if (ix < packets.length) {
				setTimeout(update.bind(this, model, packets, window_end, window_size, ix), 100);	
			}
		}

		update.call(this, this.model, data.packets, 0, 0.2, 0);
	},
	show: function(data, ctx) {
		// reset overlay
		ctx.clearRect(0, 0, 500, 500);

		ctx.fillStyle = "#FFFF00";
		ctx.textBaseline = "top";
		ctx.font = "bold 20px sans-serif";
		ctx.fillText(String(this.model.clock.toFixed(2)), 8, 5);

		for (var player_id in this.model.players) {
			var player = this.model.players[player_id];
			if (typeof(player.team) == undefined
					|| player.position == null
					|| [0,1].indexOf(player.team) < 0) {
				continue;
			}

			var coord = to_2d_coord(player.position, this.model.map_boundaries, 500, 500);
			
			var colors = [
				[0, 255, 0],
				[255, 0, 0]
			];

			var recorder_color = [0, 0, 255];

			ctx.lineWidth = 2;
			var color = player.id == data.recorder_id ?  recorder_color : colors[player.team ^ this.recorder_team];

			if (player.received_damage) {
				color = [255, 255, 255];
				player.received_damage = false;
			}

			var age   = player.alive ? ((this.model.clock - player.clock) / 20) : 0;
			age = age > 0.66 ? 0.66 : age;
			var style = "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + (1 - age) +  ")";

			ctx.strokeStyle = ctx.fillStyle = style;
			ctx.beginPath();
			ctx.arc(coord.x, coord.y, 3, 0, 2*Math.PI);

			if (player.alive) {
				ctx.fill();
			} else {
				ctx.stroke();	
			}

			if (player.id == data.recorder_id) {
				// draw turret direction
				ctx.beginPath();
				ctx.moveTo(coord.x,coord.y);
				var rotation = player.hull_direction  - Math.PI / 2 +  player.turret_direction ;
				ctx.lineTo(coord.x + 50*Math.cos(rotation),coord.y + 50*Math.sin(rotation));
				ctx.stroke();

				// draw turret direction
				ctx.strokeStyle = "#FFFF00";
				ctx.beginPath();
				ctx.moveTo(coord.x,coord.y);
				rotation = player.hull_direction  - Math.PI / 2;
				ctx.lineTo(coord.x + 50*Math.cos(rotation),coord.y + 50*Math.sin(rotation));
				ctx.stroke();
			}
		}
	},
	fetch: function(id) {
		this.serviceRequest({id: id});
	},
	process: function(file) {
		this.serviceRequest({file: file});
	},
	serviceRequest: function(values) {
		// send data request
		var replayRequest = new XMLHttpRequest();
		replayRequest.open("POST", this.serviceUrl, true);
		
		var map = this.map;
		var viewer = this;
		map.classList.add('loading');
		this.link.style.display = "none";
		replayRequest.onreadystatechange = (function(state) {
			if(replayRequest.readyState != XMLHttpRequest.DONE) {
				return;
			}

			if (replayRequest.status != 200) {
				alert('Server request failed!');
				return;
			}

			// proces data
			var response = JSON.parse(replayRequest.response);
			var data = response.data;
			var mapURL = 'maps/' + data["map"] + "_" + data["mode"] + "_" + (data["summary"].vehicles[data.recorder_id].team - 1) + ".png";
			map.setAttribute('src', mapURL);
			map.classList.remove('loading');
			this.link.style.display = "block";
			this.link.href = 'http://' + response.permalink;

			// play
			viewer.replay(data);
		}).bind(this);

		var formData = new FormData();
		for (key in values) {
			formData.append(key, values[key]);
		}

		replayRequest.send(formData);
	}
}

function to_2d_coord(position, map_boundaries, width, height) {
    var x = position[0], y = position[2], z = position[1];
    x = (x - map_boundaries[0][0]) * (width / (map_boundaries[1][0] - map_boundaries[0][0] + 1));
    y = (map_boundaries[1][1] - y) * (height / (map_boundaries[1][1] - map_boundaries[0][1] + 1));
    return { x: x, y: y };
}

function onRangeInputChange(e) {
	if (e.target.updating) {
		e.target.updating = true;
	}
}