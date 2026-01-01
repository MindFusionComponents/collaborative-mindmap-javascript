// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

import { Diagram } from '@mindfusion/diagramming';
import { Rect } from '@mindfusion/drawing';

// Server-side diagram instance
const serverDiagram = new Diagram();

// Create a default diagram
const node1 = serverDiagram.factory.createShapeNode(10, 10, 30, 30);
node1.text = "Hello";
node1.id = "node1";
const node2 = serverDiagram.factory.createShapeNode(60, 25, 30, 30);
node2.text = "World";
node2.id = "node2";
const link = serverDiagram.factory.createDiagramLink(node1, node2);
link.id = "link1";


// Helper functions
function findNode(id) {
	return serverDiagram.nodes.find(n => n.id === id);
}

function findLink(id) {
	return serverDiagram.links.find(l => l.id === id);
}


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send the current diagram to the new client
    socket.emit('load', serverDiagram.toJson());

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    socket.on('nodeCreated', (data) => {
        const node = serverDiagram.factory.createShapeNode(data.x, data.y, data.width, data.height);
        node.id = data.id;
        node.text = data.text;
        socket.broadcast.emit('nodeCreated', data);
    });
    socket.on('nodeModified', (data) => {
		const node = findNode(data.id);
		if (node) {
			node.bounds = new Rect(data.x, data.y, data.width, data.height);
		}
        socket.broadcast.emit('nodeModified', data);
    });
    socket.on('nodeTextEdited', (data) => {
        const node = findNode(data.id);
		if (node) {
			node.text = data.text;
		}
        socket.broadcast.emit('nodeTextEdited', data);
    });
    socket.on('nodeDeleted', (data) => {
        const node = findNode(data.id);
		if (node) {
			serverDiagram.removeItem(node);
		}
        socket.broadcast.emit('nodeDeleted', data);
    });
    socket.on('linkCreated', (data) => {
        const origin = findNode(data.originId);
		const destination = findNode(data.destinationId);
		if (origin && destination) {
			const link = serverDiagram.factory.createDiagramLink(origin, destination);
			link.id = data.id;
			link.text = data.text;
		}
        socket.broadcast.emit('linkCreated', data);
    });
    socket.on('linkModified', (data) => {
        const link = findLink(data.id);
		if (link) {
			const origin = findNode(data.originId);
			const destination = findNode(data.destinationId);
			if (origin && destination) {
				link.origin = origin;
				link.destination = destination;
			}
		}
        socket.broadcast.emit('linkModified', data);
    });
    socket.on('linkTextEdited', (data) => {
        const link = findLink(data.id);
		if (link) {
			link.text = data.text;
		}
        socket.broadcast.emit('linkTextEdited', data);
    });
    socket.on('linkDeleted', (data) => {
        const link = findLink(data.id);
		if (link) {
			serverDiagram.removeItem(link);
		}
        socket.broadcast.emit('linkDeleted', data);
    });
    socket.on('clear', () => {
        serverDiagram.clearAll();
        socket.broadcast.emit('clear');
    });
    socket.on('load', (data) => {
        serverDiagram.fromJson(data);
        socket.broadcast.emit('load', data);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
