export const sendMessage = (connections: Set<WebSocket>, message: string): void => {
	for (const ws of connections) {
		try {
			ws.send(message);
		} catch (err) {
			connections.delete(ws);
		}
	}
};

export const handleWebSocket = async (connections: Set<WebSocket>, ws: WebSocket): Promise<void> => {
	ws.accept();
	connections.add(ws);

	ws.addEventListener('close', () => {
		connections.delete(ws);
	});

	ws.addEventListener('error', () => {
		connections.delete(ws);
	});
};
