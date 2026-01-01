import {
	DiagramView,
	Diagram,
	GlassEffect,
	Style,
	ShapeNode,
	PathFinder,
	Overview,
	Ruler,
	Shape
} from "@mindfusion/diagramming";

import { Font, Rect } from "@mindfusion/drawing";

import { Palette } from "@mindfusion/diagramming-controls";

import { ZoomControl } from "@mindfusion/controls";

import { io } from "socket.io-client";


var shapeNodeStyle = new Style();
var diagram = null;
var socket = null;
var applyingRemoteChange = false; // Flag to prevent self-broadcasting

document.addEventListener("DOMContentLoaded", function () {
	socket = io("http://localhost:3000");

	// create a DiagramView component that wraps the "diagram" canvas
	var diagramView = DiagramView.create(document.getElementById("diagram"));
	diagramView.linkBackId = "mindfusionLink";
	diagram = diagramView.diagram;
	diagramView.allowInplaceEdit = true;

	// styling
	shapeNodeStyle.brush = { type: 'SolidBrush', color: '#e0e9e9' };
	shapeNodeStyle.stroke = "#7F7F7F";
	shapeNodeStyle.fontName = "Verdana";
	shapeNodeStyle.fontSize = 4;
	shapeNodeStyle.nodeEffects = [new GlassEffect()];
	diagram.style = shapeNodeStyle;

	// set the size of diagram's scrollable area (unit is millimeter by default)
	diagram.bounds = new Rect(0, 0, 1000, 1000);

	// The server will send the initial diagram upon connection

	// automatically route links drawn by user
	diagram.routeLinks = true;

	// create UI components
	var palette = Palette.create(document.getElementById("palette"));
	palette.captionFont = new Font("sans-serif", 3);
	palette.setTop("200px");
	palette.setWidth("200px");
	palette.setHeight("");
	palette.theme = "business";
	initPalette(palette);

	var overview = Overview.create(document.getElementById("overview"));
	overview.diagramView = diagramView;
	overview.backColor = "#eee";

	var zoomer = ZoomControl.create(document.getElementById("zoomer"));
	zoomer.target = diagramView;
	zoomer.borderColor = "#5a79a5";

	var ruler = Ruler.create(document.getElementById("ruler"));
	ruler.diagramView = diagramView;
	ruler.backColor = "#fff";
	ruler.foreColor = "#5a79a5";
	ruler.textColor = "#5a79a5";

	// buttons
	document.getElementById("newButton").addEventListener("click", onNewClick);
	document.getElementById("saveButton").addEventListener("click", onSaveClick);
	document.getElementById("loadButton").addEventListener("click", onLoadClick);

	// diagram event handlers
	diagram.nodeCreated.addEventListener(onNodeCreated);
	diagram.nodeModified.addEventListener(onNodeModified);
	diagram.nodeTextEdited.addEventListener(onNodeTextEdited);
	diagram.linkTextEdited.addEventListener(onLinkTextEdited);
	diagram.nodeDeleted.addEventListener(onNodeDeleted);
	diagram.linkDeleted.addEventListener(onLinkDeleted);
	diagram.linkCreated.addEventListener(onLinkCreated);
	diagram.linkModified.addEventListener(onLinkModified);
	diagram.linkCreating.addEventListener(onLinkCreating); // validation

	// Socket.IO event handlers for receiving changes
	socket.on('nodeCreated', (model) => {
		applyingRemoteChange = true;
		const node = diagram.factory.createShapeNode(model.x, model.y, model.width, model.height);
		node.id = model.id;
		node.text = model.text;
		node.shape = Shape.fromId(model.shape);
		applyingRemoteChange = false;
	});

	socket.on('nodeModified', (model) => {
		applyingRemoteChange = true;
		const node = findNode(model.id);
		if (node) {
			var newBounds = new Rect(model.x, model.y, model.width, model.height);
			node.setBounds(newBounds, true); // the true argument also updates link end points
		}
		applyingRemoteChange = false;
	});

	socket.on('nodeTextEdited', (model) => {
		applyingRemoteChange = true;
		const node = findNode(model.id);
		if (node) {
			node.text = model.text;
		}
		applyingRemoteChange = false;
	});

	socket.on('nodeDeleted', (model) => {
		applyingRemoteChange = true;
		const node = findNode(model.id);
		if (node) {
			diagram.removeItem(node);
		}
		applyingRemoteChange = false;
	});

	socket.on('linkCreated', (model) => {
		applyingRemoteChange = true;
		const origin = findNode(model.originId);
		const destination = findNode(model.destinationId);
		if (origin && destination) {
			const link = diagram.factory.createDiagramLink(origin, destination);
			link.id = model.id;
			link.text = model.text;
		}
		applyingRemoteChange = false;
	});

	socket.on('linkModified', (model) => {
		applyingRemoteChange = true;
		const link = findLink(model.id);
		if (link) {
			const origin = findNode(model.originId);
			const destination = findNode(model.destinationId);
			if (origin && destination) {
				link.origin = origin;
				link.destination = destination;
			}
		}
		applyingRemoteChange = false;
	});

	socket.on('linkTextEdited', (model) => {
		applyingRemoteChange = true;
		const link = findLink(model.id);
		if (link) {
			link.text = model.text;
		}
		applyingRemoteChange = false;
	});

	socket.on('linkDeleted', (model) => {
		applyingRemoteChange = true;
		const link = findLink(model.id);
		if (link) {
			diagram.removeItem(link);
		}
		applyingRemoteChange = false;
	});

	socket.on('clear', () => {
		applyingRemoteChange = true;
		diagram.clearAll();
		applyingRemoteChange = false;
	});

	socket.on('load', (data) => {
		applyingRemoteChange = true;
		diagram.fromJson(data);
		applyingRemoteChange = false;
	});
});

// Diagram event handlers for emitting changes
function onNodeCreated(sender, args) {
	if (applyingRemoteChange) return;
	const node = args.node;
	// Assign a unique ID if it doesn't have one
	if (!node.id) {
		node.id = socket.id + new Date().valueOf();
	}
	const r = node.bounds;
	const model = {
		id: node.id,
		text: node.text,
		shape: node.shape.id,
		x: r.x,
		y: r.y,
		width: r.width,
		height: r.height
	};
	socket.emit('nodeCreated', model);
}

function onNodeModified(sender, args) {
	if (applyingRemoteChange) return;
	const node = args.node;
	const r = node.bounds;
	const model = {
		id: node.id,
		x: r.x,
		y: r.y,
		width: r.width,
		height: r.height
	};
	socket.emit('nodeModified', model);
}

function onNodeTextEdited(sender, args) {
	if (applyingRemoteChange) return;
	const model = {
		id: args.node.id,
		text: args.newText
	};
	socket.emit('nodeTextEdited', model);
}

function onLinkTextEdited(sender, args) {
	if (applyingRemoteChange) return;
	const model = {
		id: args.link.id,
		text: args.newText
	};
	socket.emit('linkTextEdited', model);
}

function onNodeDeleted(sender, args) {
	if (applyingRemoteChange) return;
	const model = { id: args.node.id };
	socket.emit('nodeDeleted', model);
}

function onLinkDeleted(sender, args) {
	if (applyingRemoteChange) return;
	const model = { id: args.link.id };
	socket.emit('linkDeleted', model);
}

function onLinkCreated(sender, args) {
	if (applyingRemoteChange) return;
	const link = args.link;
	// Assign a unique ID if it doesn't have one
	if (!link.id) {
		link.id = socket.id + new Date().valueOf();
	}
	const model = {
		id: link.id,
		text: link.text,
		originId: link.origin.id,
		destinationId: link.destination.id
	};
	socket.emit('linkCreated', model);
}

function onLinkModified(sender, args) {
	if (applyingRemoteChange) return;
	const link = args.link;
	const model = {
		id: link.id,
		originId: link.origin.id,
		destinationId: link.destination.id
	};
	socket.emit('linkModified', model);
}


function onLinkCreating(diagram, args) {
	if (args.destination == null) {
		// not pointing to a node yet
		return;
	}

	var pathFinder = new PathFinder(diagram);
	var path = pathFinder.findShortestPath(
		args.destination, args.origin);

	if (path != null) {
		// adding this new link would create a cycle
		args.cancel = true;
	}
}

function initPalette(palette) {
	palette.addCategory("Flowchart Shapes");
	var shapes = ["Start", "Input", "Process", "Decision"]
	for (var i = 0; i < shapes.length; ++i) {
		var node = new ShapeNode();
		node.shape = shapes[i];
		node.style = shapeNodeStyle;
		palette.addItem(node, "Flowchart Shapes", shapes[i]);
	}
}

function onNewClick() {
	if (applyingRemoteChange) return;
	diagram.clearAll();
	socket.emit('clear');
}

async function onSaveClick() {
	try {
		const json = diagram.toJson();
		if (window.showSaveFilePicker) {
			const handle = await window.showSaveFilePicker(
				{
					suggestedName: 'diagram.json',
					types: [{
						description: 'JSON Files',
						accept: { 'application/json': ['.json'] },
					}],
				});
			const writable = await handle.createWritable();
			await writable.write(json);
			await writable.close();
		}
		else {
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'diagram.json';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}
	}
	catch (err) {
		console.error(err.name, err.message);
	}
}

async function onLoadClick() {
	if (applyingRemoteChange) return;
	try {
		if (window.showOpenFilePicker) {
			const [handle] = await window.showOpenFilePicker(
				{
					types: [{
						description: 'JSON Files',
						accept: { 'application/json': ['.json'] },
					}],
				});
			const file = await handle.getFile();
			const content = await file.text();
			diagram.fromJson(content);
			socket.emit('load', content);
		}
		else {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = '.json,application/json';
			input.onchange = async (e) => {
				const file = e.target.files[0];
				const content = await file.text();
				diagram.fromJson(content);

				socket.emit('load', content);
			};
			input.click();
		}
	}
	catch (err) {
		console.error(err.name, err.message);
	}
}

// Helper functions
function findNode(id) {
	return diagram.nodes.find(n => n.id === id);
}

function findLink(id) {
	return diagram.links.find(l => l.id === id);
}

