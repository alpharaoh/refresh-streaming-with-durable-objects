const CLEAR_STREAM_MESSAGE = 'clear_text';

export const sendMessage = (connections: Set<WebSocket>, message: string): void => {
	for (const ws of connections) {
		try {
			ws.send(message);
		} catch (err) {
			connections.delete(ws);
		}
	}
};

export const clearStream = async (ctx: DurableObjectState, connections: Set<WebSocket>): Promise<void> => {
	await ctx.storage.put('stream', '');
	sendMessage(connections, CLEAR_STREAM_MESSAGE);
};

export const handleWebSocket = async (ctx: DurableObjectState, connections: Set<WebSocket>, ws: WebSocket): Promise<void> => {
	ws.accept();
	connections.add(ws);

	const stream = (await ctx.storage.get('stream')) as string;
	if (stream) {
		ws.send(stream);
	}

	ws.addEventListener('close', () => {
		connections.delete(ws);
	});

	ws.addEventListener('error', () => {
		connections.delete(ws);
	});
};
