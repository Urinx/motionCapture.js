/* motionCapture.js 0.9.0, @license MIT, (c) 2014 Eular */
(function(){
	"use strict";

	function $(el){
		return document.querySelector(el);
	}

	var MotionCapture = function(opts){
		var defaultOpts = {
			w:400,
			h:300,
		};

		this.opts = opts || defaultOpts;
		this.video = null;
		this.canvas = null;
		this.context = null;
		this.funcQuene = {};

		this._init();
	};

	MotionCapture.prototype = {
		_init: function(){
			this.video = $('video');
			this.canvas = $('canvas');
			this.context = this.canvas.getContext('2d');

			var opts = this.opts,
				w = opts.w,
				h = opts.h;

			this.video.width = w;
			this.video.height = h;
			this.canvas.width = w;
			this.canvas.height = h;
		},
		start: function(){
			this.getCameraPermission(this.output);
		},
		getCameraPermission: function(succFunc, errFunc){
			navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
			window.URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

			var conf={
					'video':true,
				},
				err = function(error){
					console.warn('Error: '+error.name);
					errFunc && errFunc();
				},
				video = this.video,
				context = this.context,
				funcQuene = this.funcQuene;

			if(navigator.getUserMedia){
				navigator.getUserMedia(conf, function(stream){
					video.src = window.URL.createObjectURL(stream);
      				video.play();
      				succFunc(video, context, funcQuene);
				}, err);
			}
			else{
				console.warn('navigator.getUserMedia API is NOT supported!');
				alert('Please use Chrome.');
				return;
			}
		},
		output: function(v, c, f){
			var w = v.width,
				h = v.height;

			var pre=[], now=[], tmp=[], cpt=[], cpts=[];
			var imgDat, newImgDat;

			function loop(){
				c.drawImage(v, 0, 0, w, h);
				imgDat = c.getImageData(0, 0, w, h);

				pre = now;
				// now = GaussianFilter(imgDat.data, w, h);
				now = graynize(imgDat.data);
				tmp = greenize(now, pre, 50);
				
				if (tmp.changePoints.length > 1000) {
					cpt = getCenterPoint(tmp.changePoints, w);
					cpts.push(cpt);
					addCenterPoint(tmp.result, cpt, w);

					if (cpts.length > 5) {
						var d = getDirection(cpts);
						d && f[d] && f[d]();
						cpts = [];
					}
				}

				newImgDat = c.createImageData(w, h);
				copyImgData(newImgDat, tmp.result);
				c.clearRect(0, 0, w, h);
				c.putImageData(newImgDat, 0, 0);

				window.requestAnimationFrame(loop);
			}
			loop();
		},
		// ========================================
		catch: function(direc, func){
			this.funcQuene[direc] = func;
			return this;
		},
	};
	// ===================================================
	// Gaussian Filter --- It's too slow, need more faster
	// ===================================================
	function GaussianFilter(arr, w, h){
		var k = 3,
			sigma = 1,
			g_filter = fspecial('gaussian', k, sigma),
			d = Math.floor(k/2),
			newArr = [];

		newArr = arr;

		for (var x = d; x < w-d; x++) {
			for (var y = d; y < h-d; y++) {
				var i = getPixel(x, y, w),
					iArr = [
						[getPixel(x-1, y-1, w),getPixel(x, y-1, w),getPixel(x+1, y-1, w)],
						[getPixel(x-1, y, w),i,getPixel(x+1, y, w)],
						[getPixel(x-1, y+1, w),getPixel(x, y+1, w),getPixel(x+1, y+1, w)]
					],
					r=[],g=[],b=[];
				iArr.map(function(a){
					r.push([]);
					g.push([]);
					b.push([]);
					a.map(function(c){
						r[r.length-1].push(arr[c]);
						g[g.length-1].push(arr[c+1]);
						b[b.length-1].push(arr[c+2]);
					});
				});
				newArr[i]=Math.floor(sum(mult(r,g_filter)))%255;
				newArr[i+1]=Math.floor(sum(mult(g,g_filter)))%255;
				newArr[i+2]=Math.floor(sum(mult(b,g_filter)))%255;
			}
		}
		return newArr;
	}
	function fspecial(func_name, kernel_size, sigma){
		kernel_size = kernel_size || 3;
		sigma = sigma || 1;

		if (func_name == 'gaussian') {
			var m = (kernel_size - 1) / 2,
				sumh = 0,
				h = [],
				t = [];

			for (var i = -m; i < m+1; i++) {
				t = [];
				for (var  j= -m; j < m+1; j++) {
					t.push(Math.exp( -(i*i+j*j) / (2*sigma*sigma) ));
				}
				h.push(t);
			}

			sumh = sum(h);
			if (sumh != 0) {
				for (var i = 0; i < h.length; i++) {
					for (var j = 0; j < h[i].length; j++) {
						h[i][j] /= sumh;
					}
				}
			}
			return h;
		};
	}
	function sum(arr){
		if (arr instanceof Array) {
			var t = 0;
			arr.map(function(a){
				t += sum(a);
			});
			return t;
		}
		return arr;
	}
	function mult(mat1,mat2){
		var m = mat1.length,
			n = mat1[0].length,
			p = mat2[0].length,
			r = [];
		for (var i = 0; i < m; i++) {
			r[i] = [];
			for (var k = 0; k < p; k++) {
				var s = 0;
				for (var j = 0; j < n; j++) {
					s += mat1[i][j] * mat2[j][k];
				}
				r[i].push(s);
			}
		}
		return r;
	}
	function copyImgData(to, from){
		for (var i = 0; i < from.length; i++) {
			to.data[i] = from[i];
		}
	}
	function graynize(arr){
		var newArr=[],bb=0;
		for (var i = 0; i < arr.length; i=i+4) {
			// R:0.30 G:0.59 B:0.11
			bb=(arr[i]*30+arr[i+1]*59+arr[i+2]*11)/100;
			newArr[i]=bb;
			newArr[i+1]=bb;
			newArr[i+2]=bb;
			newArr[i+3]=255;
		}
		return newArr;
	}
	function greenize(now, pre, k){
		var newArr=[],changePoints=[];
		for (var i = 0; i < now.length; i=i+4) {
			if (now[i]>=pre[i]+k || now[i]<=pre[i]-k) {
				newArr[i]=0;
				newArr[i+1]=255;
				newArr[i+2]=0;
				newArr[i+3]=255;
				changePoints.push(i);
			}
			else{
				newArr[i]=now[i];
				newArr[i+1]=now[i+1];
				newArr[i+2]=now[i+2];
				newArr[i+3]=255;
			}
		}
		return {
			result: newArr,
			changePoints: changePoints,
		};
	}
	function getX(i, w){
		return (i/4)%w;
	}
	function getY(i, w){
		return (i/4-(i/4)%w)/w;
	}
	function getPixel(x, y, w){
		return (y*w+x)*4;
	}
	// Need to be improved
	function getCenterPoint(arr, w){
			var x = 0,
				y = 0,
				l = arr.length;
			if (l>0) {
				for (var i = 0; i < l; i++) {
					x += getX(arr[i],w);
					y += getY(arr[i],w);
				}
				x = Math.floor(x / l);
				y = Math.floor(y / l);
			}
			return [x, y];
	}
	function addCenterPoint(arr, cpt, w){
		var r = 3,
			i = 0;
		for (var x = cpt[0]-r; x < cpt[0]+r; x++) {
			for (var y = cpt[1]-r; y < cpt[1]+r; y++) {
				i = getPixel(x, y, w);
				arr[i]=255;
				arr[i+1]=0;
				arr[i+2]=0;
				arr[i+3]=255;
			}
		}
	}
	function getDirection(cpts){
		var dx = cpts[cpts.length-1][0] - cpts[0][0],
			dy = cpts[cpts.length-1][1] - cpts[0][1],
			abs = Math.abs;

		if (abs(dx/dy) > 1) {
			if (dx > 0) {
				return 'right';
			}
			return 'left';
		}
		else{
			if (dy > 0) {
				return 'down'
			}
			return 'up';
		}
	}
	// ============================
	// ============================

	if (typeof exports === 'object') {
		// CommonJS support
		module.exports = MotionCapture;
	}
	else if (typeof define === 'function' && define.amd) {
		// support AMD
		define(function() { return MotionCapture; });
	}
	else {
		// support browser
		window.MotionCapture = MotionCapture;
	}

})();