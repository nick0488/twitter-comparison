var app = angular.module("twitterVisualisation", [])

app.factory('socket', function ($rootScope) {
  var socket = io.connect('ws://localhost:3000');
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    }
  };
});



app.controller("mainController", [ "$scope","visualisationService", function($scope,visualisationService) {
    $scope.firstName = visualisationService.data.firstName;
    $scope.lastName = visualisationService.data.lastName; 
	
	var self = this;
	
	self.model = {
		wordOne: "",
		WordTwo: ""
	}
	self.compare = function () {
		visualisationService.filter(self.model.wordOne,self.model.wordTwo);
	}
	self.data = visualisationService.data;
	
	
}]);

app.service("visualisationService", [ "$http", "socket","$interval",function($http,socket,$interval) {
    
	var kw1 = 0;
	var kw2 = 0;
	var data = {
		keywordOne : {
			label : "keywordOne",
			value : 0,
			total : 0
		},
		keywordTwo : {
			label : "keywordTwo",
			value : 100,
			total : 0
		},
		wait : {
			waiting : false,
			time : 0
		},
		init : false
	}
	
	
	
	
	function filter (wordOne,wordTwo) {
		var filterData = {keywordOne: wordOne, keywordTwo : wordTwo};
		resetCounter();
		socket.emit('filter', filterData);
		data.keywordOne.label = wordOne;
		data.keywordTwo.label = wordTwo;
		if(!data.init){
			data.init = true;
		}
	}
	
	function resetCounter() {
		kw1 = 0;
		kw2 = 0;
		data.keywordOne.value = 0;
		data.keywordTwo.value = 100;
		recalc();
	}
	
	
	function recalc() {
		var total = kw1 + kw2;
		kw1p = 0;
		kw2p = 0;
		if(total > 0){
			var kw1p = (kw1/total * 100).toFixed(2);
			var kw2p = (kw2/total * 100).toFixed(2);
			data.keywordOne.value = kw1p;
			data.keywordTwo.value = kw2p;
		}
		
		data.keywordOne.total = kw1;
		data.keywordTwo.total = kw2;
	}
	
	
	var countdownPromise;
	function startCounter(time) {
		var seconds = time/1000;
		data.wait.waiting = true;
		data.wait.time = seconds;
		if(countdownPromise){
			$interval.cancel(countdownPromise);
		}
		countdownPromise = $interval(countDown, 1000)
	}
	function countDown(){
		if(data.wait.waiting){
			data.wait.time = data.wait.time - 1;
			if(data.wait.time <= 0){
				data.wait.waiting = false;
				$interval.cancel(countdownPromise);
			}
			
		}
	}
	
	
	socket.on('keywordOne', function(tweet){
        kw1++;
		recalc();
	})
	socket.on('keywordTwo', function(tweet){
        kw2++;
		recalc();
	})
	socket.on('reconnect', function(time){
        startCounter(time);
	})
	
	return {
		data : data,
		filter : filter,
	}
	
}]);

app.directive("pieChart", function($window) {
  return{
    restrict: "EA",
    scope : {
		data : '=',
		 
	},
    link: function(scope, elem, attrs){
			
		
		var svg = d3.select(elem[0])
			.append("svg").style("height","250px")
			.append("g")
			
		

		svg.append("g")
			.attr("class", "slices");
		svg.append("g")
			.attr("class", "labels");
		svg.append("g")
			.attr("class", "lines");

		var width = 480,
			height = 225,
			radius = Math.min(width, height) / 2;

		var pie = d3.layout.pie()
			.sort(null)
			.value(function(d) {
				return d.value;
			});

		var arc = d3.svg.arc()
			.outerRadius(radius * 0.8)
			.innerRadius(radius * 0.4);

		var outerArc = d3.svg.arc()
			.innerRadius(radius * 0.9)
			.outerRadius(radius * 0.9);

		svg.attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

		var key = function(d){ return d.data.label; };

		var color = d3.scale.ordinal()
			.domain(["keyword One", "KeywordTwo"])
			

		function randomData (){
			var labels = color.domain();
			return labels.map(function(label){
				return { label: label, value: Math.random() }
			});
		}

		//change(randomData());
		scope.$watch("data",scopeData,true);
		scopeData();
		function scopeData () {
			var keywordOne = scope.data.keywordOne;
			var keywordTwo = scope.data.keywordTwo;
			
			color = d3.scale.ordinal()
				.domain([keywordOne.label,keywordTwo.label])
				.range(["#ff6602", "#3f7992"]);
			var labels = [
				{ label: keywordOne.label, value: keywordOne.value },
				{ label: keywordTwo.label, value: keywordTwo.value }
			];
			change(labels);			
			
		}
		//change(scopeData());

		d3.select(".randomize")
			.on("click", function(){
				change(randomData());
			});


		function change(data) {

			/* ------- PIE SLICES -------*/
			var slice = svg.select(".slices").selectAll("path.slice")
				.data(pie(data), key);

			slice.enter()
				.insert("path")
				.style("fill", function(d) { return color(d.data.label); })
				.attr("class", "slice");

			slice		
				.transition().duration(1000)
				.attrTween("d", function(d) {
					this._current = this._current || d;
					var interpolate = d3.interpolate(this._current, d);
					this._current = interpolate(0);
					return function(t) {
						return arc(interpolate(t));
					};
				})

			slice.exit()
				.remove();

			/* ------- TEXT LABELS -------*/

			var text = svg.select(".labels").selectAll("text")
				.data(pie(data), key);

			text.enter()
				.append("text")
				.attr("dy", ".35em")
				.text(function(d) {
					return d.data.label;
				});
			
			function midAngle(d){
				return d.startAngle + (d.endAngle - d.startAngle)/2;
			}

			text.transition().duration(1000)
				.attrTween("transform", function(d) {
					this._current = this._current || d;
					var interpolate = d3.interpolate(this._current, d);
					this._current = interpolate(0);
					return function(t) {
						var d2 = interpolate(t);
						var pos = outerArc.centroid(d2);
						pos[0] = radius * (midAngle(d2) < Math.PI ? 1 : -1);
						return "translate("+ pos +")";
					};
				})
				.styleTween("text-anchor", function(d){
					this._current = this._current || d;
					var interpolate = d3.interpolate(this._current, d);
					this._current = interpolate(0);
					return function(t) {
						var d2 = interpolate(t);
						return midAngle(d2) < Math.PI ? "start":"end";
					};
				});

			text.exit()
				.remove();

			/* ------- SLICE TO TEXT POLYLINES -------*/

			var polyline = svg.select(".lines").selectAll("polyline")
				.data(pie(data), key);
			
			polyline.enter()
				.append("polyline");

			polyline.transition().duration(1000)
				.attrTween("points", function(d){
					this._current = this._current || d;
					var interpolate = d3.interpolate(this._current, d);
					this._current = interpolate(0);
					return function(t) {
						var d2 = interpolate(t);
						var pos = outerArc.centroid(d2);
						pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
						return [arc.centroid(d2), outerArc.centroid(d2), pos];
					};			
				});
			
			polyline.exit()
				.remove();
		};

				
	}
  };
});



  
  
  
