paper.install(window);
let svg = null;
let svgButton = null;
let test = false;
let divJ = null
$(document).ready( function() {

	let canvas = document.getElementById("paperCanvas")

	paper.setup(canvas);

	// global object to store all parameters: braille dimensions are standards
	let braille = {
		marginWidth: 3,
		marginHeight: 5,
		paperWidth: 175,
		paperHeight: 290,
		letterWidth: 2.3,
		dotRadius: 1.25,
		letterPadding: 3.75,
		linePadding: 3,
		headDownPosition: -2.0,
		headUpPosition: 10,
		speed: 4000,
		delta: false,
		goToZero: false,
		invertX: true,
		invertY: true,
		mirrorX: true,
		mirrorY: true,
		svgStep: 2,
		svgDots: true,
		svgPosX: 0,
		svgPosY: 0,
		// svgScale: 1,
		language: "6 pontos do Brasil",
		GCODEup: 'M3 S0',
		GCODEdown: 'M3 S1',
		usedotgrid: false,

	};

	let pixelMillimeterRatio = null;

	let text = '';
	let gcode = '';
	let sortedgcode = '';

	let xhead = 0;
	let yhead = 0;

	// Replace a char at index in a string
	function replaceAt(s, n, t) {
	    return s.substring(0, n) + t + s.substring(n + 1);
	}

	function DotPosition (xpos, ypos) {
		this.x = xpos;
		this.y = ypos;
	}

	var GCODEdotposition = [];
	var GCODEsvgdotposition = [];

	let latinToBraille = new Map(); 		// get braille dot indices from char
	let dotMap = null;					// get dot order from x, y dot coordinates
	let numberPrefix = null; 			// the indices of the number prefix of the language

	let gcodeSetAbsolutePositioning = function() {
		return 'G90;\r\n';
	}

	let gcodeMotorOff = function()
	{
		return 'M84;\r\n';
	}

	let gcodeHome = function ()
	{
		str = 'G28 X;\r\n';
		str += 'G28 Y;\r\n';

		return str;
	}

	let gcodeResetPosition = function(X, Y, Z) {
		return 'G92' + gcodePosition(X, Y, Z);
	}

	let gcodeSetSpeed = function(speed) {
		return 'G1 F' + speed + ';\r\n'
	}

	let gcodePosition = function(X, Y, Z) {
		let code = ''
		if(X == null && Y == null && Z == null) {
			throw new Error("Null position when moving")
		}
		if(X != null) {
			code += ' X' + X.toFixed(2)
		}
		if(Y != null) {
			code += ' Y' + Y.toFixed(2)
		}
		if(Z != null) {
			code += ' Z' + Z.toFixed(2)
		}
		code += ';\r\n'
		return code
	}

	let gcodeGoTo = function(X, Y, Z) {
		return 'G0' + gcodePosition(X, Y, Z)
	}

	let gcodeMoveTo = function(X, Y, Z) {
		return 'G1' + gcodePosition(X, Y, Z)
	}

	let gcodeMoveToCached = function (X,Y,Z)
	{
		if (X != null)
			xhead = X;
		if (Y != null)
			yhead = Y;

		return gcodeMoveTo (X,Y,Z);
	}


	let gcodeprintdot = function () {
		let s = braille.GCODEdown + ';\r\n';
		s += braille.GCODEup + ';\r\n';

		return (s);
	}

	let gcodePrintDotCached = function ()
	{
		if (xhead != null && yhead != null)
			GCODEdotposition.push (new DotPosition (xhead,yhead));

		return gcodeprintdot ();
	}

	let gcodeGraphDotCached = function ()
	{
		if (xhead != null && yhead != null)
			GCODEsvgdotposition.push (new DotPosition (xhead,yhead));

		return gcodeprintdot ();
	}

	let buildoptimizedgcode = function ()
	{
		var sortedpositions = [];
		var gridsizex = Math.floor(braille.paperWidth / braille.svgStep);
		var gridsizey = Math.floor (braille.paperHeight / braille.svgStep);



		var dotgrid = Array(gridsizex);
		for (i = 0;i < gridsizex; i++)
		{
			dotgrid[i] = new Array (gridsizey);
			dotgrid[i].fill (0);
		}
		codestr = gcodeHome ();



		codestr += gcodeSetSpeed(braille.speed);


		if(braille.goToZero) {
			codestr += gcodeMoveTo(0, 0, 0)
		}


		GCODEdotposition.sort (function (a,b) {
			if (a.y == b.y) return (a.x - b.x);
			return (a.y - b.y);
		})

		sortedpositions = gcodesortzigzag (GCODEdotposition);

		console.log("sorted positions:" + sortedpositions.length);

		if (braille.usedotgrid == true)
			console.log ("filtering dot neighbor");

		for (i = 0; i < sortedpositions.length; i++)
		{
			codestr += gcodeMoveTo (sortedpositions[i].x, sortedpositions[i].y);
			codestr += gcodeprintdot ();
			dotgrid[Math.floor(sortedpositions[i].x / braille.svgStep)][Math.floor(sortedpositions[i].y / braille.svgStep)] = 1;
		}

		// print svg
		for (i=0; i < GCODEsvgdotposition.length; i++)
		{
			var gx = Math.floor (GCODEsvgdotposition[i].x / braille.svgStep);
			var gy = Math.floor (GCODEsvgdotposition[i].y / braille.svgStep);

			if (gx < 0 || gx >= gridsizex)
				continue;
			if (gy < 0 || gy >= gridsizey)
				continue;

			if (braille.usedotgrid  == true)
			{
				if (dotgrid[gx][gy] == 0)
				{
					codestr += gcodeMoveTo (GCODEsvgdotposition[i].x, GCODEsvgdotposition[i].y);
					codestr += gcodeprintdot ();
					dotgrid[gx][gy] = 1;
				}
				else
				{
					console.log ("dot filtered");
				}
			}
			else
			{
				codestr += gcodeMoveTo (GCODEsvgdotposition[i].x, GCODEsvgdotposition[i].y);
				codestr += gcodeprintdot ();
			}
		}


		codestr += gcodeMoveTo (0,braille.paperHeight);
		codestr += gcodeMotorOff ();
		return (codestr);
	}


	// draw SVG
	let dotAt = function (point, gcode, bounds, lastDot) {
		let px = braille.invertX ? -point.x : braille.paperWidth - point.x;
		let py = braille.invertY ? -point.y : braille.paperHeight - point.y;
		gcode.code += gcodeMoveToCached(braille.mirrorX ? -px : px, braille.mirrorY ? -py : py)
		gcodeGraphDotCached(braille.mirrorX ? -px : px, braille.mirrorY ? -py : py)
		// move printer head
		gcode.code += gcodeMoveTo(null, null, braille.headDownPosition);
		if(braille.svgDots || lastDot) {
			gcode.code += gcodeMoveTo(null, null, braille.headUpPosition);
		}
	}

	let itemMustBeDrawn = function (item)  {
		return (item.strokeWidth > 0 && item.strokeColor != null) || item.fillColor != null;
	}

	let plotItem = function (item, gcode, bounds)  {
		if(!item.visible) {
			return
		}

		if(item.className == 'Shape') {
			let shape = item
			if(itemMustBeDrawn(shape)) {
				let path = shape.toPath(true)
				item.parent.addChildren(item.children)
				item.remove()
				item = path
			}
		}
		if((item.className == 'Path' ||
			item.className == 'CompoundPath') && item.strokeWidth > 0) {
			let path = item
			if(path.segments != null) {
				for(let i=0 ; i < path.length ; i  += braille.svgStep) {
					dotAt(path.getPointAt(i), gcode, bounds, i + braille.svgStep >= path.length)
				}
			}
		}
		if(item.children == null) {
			return
		}
		for(let child of item.children) {
			plotItem(child, gcode, bounds)
		}
	}

	// gcode sort by line
	let gcodesortzigzag = function (positions)
	{
		var i;
		var  s = 0;
		var e = 0;
		var dir = 1;
		var tmp = [];
		var sorted = [];

		if (positions == null)
			return (sorted);

		while (e < positions.length)
		{
			while ((positions[s].y == positions[e].y) )
			{
				e++;
				if (e == (positions.length))
				{
						break;
				}
			}

			//if (e - s >= 0)
			{
				for (i = s; i < e; i++)
				{
					tmp.push (positions[i]);
				}
				tmp.sort (function (a,b) {
					if (a.y == b.y) return ((a.x - b.x) * dir);
						return (a.y - b.y);
				})

				for(i = 0; i < tmp.length; i++)
					sorted.push (tmp[i]);
				tmp = [];
				dir = - dir;

				s = e;
			}
			if (e >= positions.length)
			{
					break;
			}
		}

		return (sorted);
	}

	// Generates code
	let svgToGCode = function(svg, gcode) {
		//svg.scaling = mmPerPixels
		plotItem(svg, gcode, svg.bounds)
		//svg.scaling =1;// mmPerPixels
		if (GCODEsvgdotposition != null && GCODEsvgdotposition.length > 0)
			GCODEsvgdotposition.sort (function (a,b) {
				if (a.y == b.y) return (a.x - b.x);
				return (a.y - b.y);
			})
	}

	// Draw braille and generate gcode
	let brailleToGCode = function() {

		let is8dot = braille.language.indexOf("8 pontos") >= 0

		// Compute the pixel to millimeter ratio
		let paperWidth = braille.paperWidth;
		let paperHeight = braille.paperHeight;

		let canvasWidth = canvas.width / window.devicePixelRatio;
		let canvasHeight = canvas.height / window.devicePixelRatio;

		let realRatio = paperWidth / paperHeight;
		let pixelRatio = canvasWidth / canvasHeight;

		let finalWidthPixel = 0;
		let finalHeightPixel = 0;

		let pixelMillimeterRatio = Math.min(canvasWidth / paperWidth, canvasHeight / paperHeight)

		// Up / down position of the printer head, in millimeter
		let headUpPosition = braille.headUpPosition;
		let headDownPosition = braille.headDownPosition;

		project.clear();


		// Start GCode
		GCODEdotposition = [];
		GCODEsvgdotposition = [];
		gcode = gcodeSetAbsolutePositioning();
		// gcode += gcodeResetPosition(0, 0, 0)
		gcode += gcodeSetSpeed(braille.speed);
		if(braille.goToZero) {
			gcode += gcodeMoveTo(0, 0, 0)
		}
		gcode += gcodeMoveTo(0, 0, headUpPosition);

		// initialize position: top left + margin
		let currentX = braille.marginWidth;
		let currentY = braille.marginHeight;
		let letterWidth = braille.letterWidth;

		// draw page bounds
		//let bounds = new Path.Rectangle(0, 0, Math.max(braille.paperWidth * pixelMillimeterRatio, 0), Math.max(0, braille.paperHeight * pixelMillimeterRatio));


		paper.project.activeLayer.applyMatrix = false;
		paper.project.activeLayer.scaling = pixelMillimeterRatio;
		let bounds = new Path.Rectangle(0, 0, Math.max(braille.paperWidth , 0), Math.max(0, braille.paperHeight ));
		bounds.strokeWidth = 1;
		bounds.strokeColor = 'blue';


		//let test = new Path.Circle (new Point(210/2 , 290/2 ), (50) );
		//test.strokeWidth = 3;
		//test.strokeColor = 'black';

		let isWritingNumber = false;
		let isSpecialchar =false;
		let textCopy = '' + text
		let textGroup = new Group()

		// iterate through each char: draw braille code and add gcode
		for(let i = 0 ; i < textCopy.length ; i++) {
			let char = textCopy[i]

			// check special cases:
			//let charIsCapitalLetter = is8dot ? false : /[A-Z]/.test(char)
			let charIsCapitalLetter = is8dot ? false : isUpperCase(char);
		let charIsLineBreak = /\r?\n|\r/.test(char)

			// If char is line break: reset currentX and increase currentY
			if(charIsLineBreak) {
				currentY += (is8dot ? 2 : 3) * letterWidth + braille.linePadding;
				currentX = braille.marginWidth;

				if(currentY > braille.paperHeight - braille.marginHeight) { 				// if there is not enough space on paper: stop
					break;
				}
				continue;
			}

			// Check if char exists in map
			if(!latinToBraille.has(char.toLowerCase())) {
				console.log('Character ' + char + ' was not translated in braille.');
				continue;
			}

			let indices = latinToBraille.get(char);

			// handle special cases:
			if(!isWritingNumber && !isNaN(parseInt(compairCharAgaistDevnagriNumber(char)))) { 			// if we are not in a number sequence and char is a number: add prefix and enter number sequence
				indices = numberPrefix;
				i--; 													// we will reread the same character
				isWritingNumber = true;
			} else if(isWritingNumber && char == ' ') {
				isWritingNumber = false;
			} else if( charIsCapitalLetter ) { 							// if capital letter: add prefix, lowerCase letter and reread the same char
				indices = [4, 6];
				textCopy = replaceAt(textCopy, i, textCopy[i].toLowerCase());
				i--;
			}
			 if(!isSpecialchar && getPrefixforSpecialcharacter(char).length>0)
			 {
				indices = getPrefixforSpecialcharacter(char);
				i--; 													// we will reread the same character
				isSpecialchar = true;
			 }

			// compute corresponding printer coordinates
			let gx = braille.invertX ? -currentX : braille.paperWidth - currentX;
			let gy = -currentY; 				// canvas y axis goes downward, printers goes upward

			if(braille.delta) { 				// delta printers have their origin in the center of the sheet
				gx -= braille.paperWidth / 2;
				gy += braille.paperHeight / 2;
			} else if(!braille.invertY) {
				gy += braille.paperHeight;
			}

			// add gcode
			gcode += gcodeMoveToCached(braille.mirrorX ? -gx : gx, braille.mirrorY ? -gy : gy)

			// Draw braille char and compute gcode
			let charGroup = new Group()
			textGroup.addChild(charGroup)

			// Iterate through all indices
			for(let y = 0 ; y < (is8dot ? 4 : 3) ; y++) {
				for(let x = 0 ; x < 2 ; x++) {

					if(indices.indexOf(dotMap[x][y]) != -1) { 			// if index exists in current char: draw the dot
						let px = currentX + x * letterWidth
						let py = currentY + y * letterWidth
						//let dot = new Path.Circle(new Point(px * pixelMillimeterRatio, py * pixelMillimeterRatio), (braille.dotRadius / 2) * pixelMillimeterRatio);
						let dot = new Path.Circle(new Point(px , py ), (braille.dotRadius / 2) );
						dot.fillColor = 'black';

						charGroup.addChild(dot);

						// Compute corresponding gcode position
						if(x > 0 || y > 0) {

							gx = braille.invertX ? - px : braille.paperWidth - px;
							gy = -py;						// canvas y axis goes downward, printers goes upward

							if(braille.delta) { 			// delta printers have their origin in the center of the sheet
								gx -= braille.paperWidth / 2;
								gy += braille.paperHeight / 2;
							} else if(!braille.invertY){
								gy += braille.paperHeight;
							}

							gcode += gcodeMoveToCached(braille.mirrorX ? -gx : gx, braille.mirrorY ? -gy : gy)
							//GCODEdotposition.push (new DotPosition (braille.mirrorX ? -gx : gx, braille.mirrorY ? -gy : gy));
						}

						// print dot at position
						gcode += gcodePrintDotCached ();

					}
				}
			}

			// update currentX & currentY
			currentX += braille.letterWidth + braille.letterPadding;

			// Test if there is enough room on the line to draw the next character
			if(currentX + braille.letterWidth + braille.dotRadius > braille.paperWidth - braille.marginWidth) { // if we can't: go to next line
				currentY += (is8dot ? 2 : 3) * letterWidth + braille.linePadding;
				currentX = braille.marginWidth;
			}

			if(currentY > braille.paperHeight - braille.marginHeight) { 				// if there is not enough space on paper: stop
				break;
			}
		}

		let mmPerPixels =  paper.view.bounds.width / braille.paperWidth

		// Print the SVG
		if(svg != null) {
			let gcodeObject = {
				code: gcode
			}

			//svg.scaling = 1 / mmPerPixels
			svgToGCode(svg, gcodeObject)
			svg.scaling = 1;//mmPerPixels;

			gcode = gcodeObject.code
		}

		gcode += gcodeMoveTo(0, 0, headUpPosition)
		if(braille.goToZero) {
			gcode += gcodeMoveTo(0, 0, 0)
		}
		//console.log ("gcode", gcode);
		$("#gcode").val(gcode)

		paper.project.activeLayer.addChild(svg)
		let printBounds = textGroup.bounds
		if(svg != null) {
			printBounds = printBounds.unite(svg.bounds)
		}
		printBounds = printBounds.scale(1 / mmPerPixels)
		$('#print-size').text(printBounds.width.toFixed(0) + ' x ' + printBounds.height.toFixed(0))

		// print dot position
		let pstr = GCODEdotposition.length + ' ' +'\r\n' ;
		for (d = 0; d < GCODEdotposition.length; d++)
		{
			pstr += '(' + d + ')' + GCODEdotposition[d].x + ' ' + GCODEdotposition[d].y + '\r\n';
		}

		sortedgcode = buildoptimizedgcode();
		$("#dotposition").val (pstr);
		$("#optimizedgcode").val (sortedgcode);

	}

	let isUpperCase = function(char){
let simbols = ["Á", "Â", "Ã", "À", "É", "Ê", "Í", "Ó", "Ô", "Õ", "Ú", "Ç"];
	return ((/[A-Z]/.test(char)) || (simbols.indexOf(char) != -1));
}
	brailleToGCode()

	// initializeLatinToBraille from corresponding language file
	function initializeLatinToBraille() {

		numberPrefix = languages[braille.language].numberPrefix

		dotMap = languages[braille.language].dotMap

		if(dotMap == null) {
			throw new Error('Dot eight map.')
		}

		// Read in braille description file
		let brailleJSON = languages[braille.language].latinToBraille

		for(let char in brailleJSON) {
			latinToBraille.set(char, brailleJSON[char])
		}
	}
	initializeLatinToBraille();

	// Create GUI
	var gui = new dat.GUI({ autoPlace: false });

	var customContainer = document.getElementById('gui');
	customContainer.appendChild(gui.domElement);

	$(gui.domElement).find('.close-button').remove()

	dat.GUI.toggleHide = () => {}

	let createController = function(name, min, max, callback, folder, buttonName) {
		let f = folder != null ? folder : gui
		let controller = f.add(braille, name, min, max);
		controller.onChange(callback != null ? callback : brailleToGCode);
		controller.onFinishChange(callback != null ? callback : brailleToGCode);
		if(buttonName != null) {
			controller.name(buttonName)
		}
		return controller
	}

	let paperDimensionsFolder = gui.addFolder('Dimensões do papel');
	createController('paperWidth', 1, 1000, null, paperDimensionsFolder, 'Largura do papel');
	createController('paperHeight', 1, 1000, null, paperDimensionsFolder, 'Altura do papel');
	createController('marginWidth', 0, 100, null, paperDimensionsFolder, 'Largura da margem');
	createController('marginHeight', 0, 100, null, paperDimensionsFolder, 'Altura da margem');
	paperDimensionsFolder.open();

	let charDimensionsFolder = gui.addFolder('Dimensões da letra');
	createController('letterWidth', 1, 100, null, charDimensionsFolder, 'Largura da letra');
	createController('dotRadius', 1, 30, null, charDimensionsFolder, 'Diâmetro do ponto braille');
	createController('letterPadding', 1, 30, null, charDimensionsFolder, 'Distância entre as letras');
	createController('linePadding', 1, 30, null, charDimensionsFolder, 'Distância entre as linhas');
	charDimensionsFolder.open();

	let printerSettingsFolder = gui.addFolder('Configurações da impressora');
	createController('headDownPosition', -150, 150, null, printerSettingsFolder, 'Posição baixa da cabeça');
	createController('headUpPosition', -150, 150, null, printerSettingsFolder, 'Posição alta da cabeça');
	createController('speed', 0, 6000, null, printerSettingsFolder, 'Velocidade');
	createController('delta', null, null, null, printerSettingsFolder, 'Impressora delta');
	createController('invertX', null, null, null, printerSettingsFolder, 'X negativo');
	createController('invertY', null, null, null, printerSettingsFolder, 'Y negativo');
	createController('mirrorX', null, null, null, printerSettingsFolder, 'Espelhar X');
	createController('mirrorY', null, null, null, printerSettingsFolder, 'Espelhar Y');
	createController('goToZero', null, null, null, printerSettingsFolder, 'Ir para zero');
	createController('GCODEup', null, null, null, printerSettingsFolder, 'GCODE Subir');
	createController('GCODEdown', null, null, null, printerSettingsFolder, 'GCODE Baixar');


	printerSettingsFolder.open();

	var languageList = []
	for(let lang in languages) {
		languageList.push(lang)
	}

	createController('language', languageList, null, function() {
		initializeLatinToBraille();
		brailleToGCode();
	}, null, 'Variação Braille utilizada');

	// Import SVG to add shapes
	divJ = $("<input data-name='file-selector' type='file' class='form-control' name='file[]'  accept='image/svg+xml'/>")

	let importSVG = (event)=> {
		GCODEsvgdotposition = [];
		svgButton.name('Clear SVG')
		svg = paper.project.importSVG(event.target.result)
		svg.strokeScaling = false
		svg.pivot = svg.bounds.topLeft
		let mmPerPixels =  paper.view.bounds.width / braille.paperWidth

		//svg.scaling = mmPerPixels;
		svg.scaling = 1;
		brailleToGCode()
		//svg.scaling = 1.0;
		svg.sendToBack()
	}

	let handleFileSelect = (event) => {
		let files = event.dataTransfer != null ? event.dataTransfer.files : event.target.files

		for (let i = 0; i < files.length; i++) {
			let file = files.item(i)

			let imageType = /^image\//

			if (!imageType.test(file.type)) {
				continue
			}

			let reader = new FileReader()
			reader.onload = (event)=> importSVG(event)
			reader.readAsText(file)
		}
	}

	let svgFolder = gui.addFolder('SVG');
	svgButton = svgFolder.add({importSVG: ()=> {
		if(svg != null) {
			svgButton.name('Import SVG')
			svg.remove()
			svg = null
			brailleToGCode()

		} else {
			divJ.click()
		}

	} }, 'importSVG')
	svgButton.name('Importar SVG')

	divJ.click((event)=>{
		event.stopPropagation()
		return -1;
	})

	$(svgButton.domElement).append(divJ)
	divJ.hide()
	divJ.change(handleFileSelect)

	// Add download button (to get a text file of the gcode)
	/*
	* hide standard gcode download
	*
	gui.add({saveGCode: function(){
		var a = document.body.appendChild(
			document.createElement("a")
		);
		a.download = "braille.gcode";
		a.href = encodeURI("data:text/plain;charset=utf-8," + gcode);

		a.click(); // Trigger a click on the element
		a.remove();

	}}, 'saveGCode').name('Save GCode')
	*/
	// Add download button (to get a text file of the gcode)
	gui.add({saveOptimGCode: function(){
		var a = document.body.appendChild(
			document.createElement("a")
		);
		a.download = "braille.gcode";
		a.href = encodeURI("data:text/plain;charset=utf-8," + sortedgcode);

		a.click(); // Trigger a click on the element
		a.remove();

	}}, 'saveOptimGCode').name('Baixar arquivo GCode')

	createController('svgStep', 0, 100, null, svgFolder, 'Passo SVG');
	createController('svgDots', null, null , null, svgFolder, 'Pontos do SVG');

	let updateSVGPositionX = (value) => {
		let mmPerPixels =  paper.view.bounds.width / braille.paperWidth;
		svg.position.x = value;// * mmPerPixels;
		console.log (svg.position.x);
		brailleToGCode();
	}

	let updateSVGPositionY = (value) => {
		let mmPerPixels =  paper.view.bounds.width / braille.paperWidth;
		svg.position.y = value;// * mmPerPixels;
		console.log (svg.position.y);
		brailleToGCode();
	}
  createController('usedotgrid', null, null, null, svgFolder, 'Filtro de pontos');
	createController('svgPosX', -500, 500, updateSVGPositionX, svgFolder, 'Posição X do SVG');
	createController('svgPosY', -500, 500, updateSVGPositionY, svgFolder, 'Posição Y do SVG');
	// createController('svgScale', 0.05, 10, null, svgFolder, 'SVG scale');

	// Update all when text changes
	$('#latin').bind('input propertychange', function(event) {
		text = $("#latin").val();
		$('#braille').val(text);
		brailleToGCode(text);
	})

	// Update all when text changes
	$('#braille').bind('input propertychange', function(event) {
		text = $("#braille").val();
		$('#latin').val(text);
		brailleToGCode(text);
	})

})
