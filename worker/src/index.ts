import { DurableObject } from 'cloudflare:workers';
import { streamText } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';

export class MyDurableObject extends DurableObject<Env> {
	connections: Set<WebSocket>;
	google: GoogleGenerativeAIProvider;

	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);

		this.connections = new Set();
		this.google = createGoogleGenerativeAI({ apiKey: env.GOOGLE_API_KEY });
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			await this.handleWebSocket(server);

			return new Response(undefined, {
				status: 101,
				webSocket: client,
			});
		}

		// GET /prompt
		if (request.method === 'GET' && new URL(request.url).pathname === '/prompt') {
			const prompt = 'Write me a poem about the sun';

			this.promptLlm(prompt);

			return new Response('Prompt received');
		}

		// Fallback
		return new Response('Not found');
	}

	sendMessage(message: string): void {
		// Send to all WebSocket clients
		for (const ws of this.connections) {
			try {
				ws.send(message);
			} catch (err) {
				// Clean up dead connections
				this.connections.delete(ws);
			}
		}
	}

	async promptLlm(prompt: string): Promise<void> {
		await this.ctx.storage.put('stream', '');
		console.log('Prompting LLM with:', prompt);

		const { textStream } = streamText({
			model: this.google('models/gemini-2.0-flash-exp'),
			system: 'You are a friendly assistant!',
			prompt,
		});

		let fullOutput = '';

		for await (const chunk of textStream) {
			fullOutput += chunk;

			console.log('Sending chunk:', chunk);

			this.sendMessage(chunk);
			await this.ctx.storage.put('stream', fullOutput);
		}
	}

	async handleWebSocket(ws: WebSocket) {
		console.log('New WebSocket connection');

		ws.accept();
		this.connections.add(ws);

		ws.send((await this.ctx.storage.get('stream')) as string);

		ws.addEventListener('close', () => {
			this.connections.delete(ws);
		});

		ws.addEventListener('error', () => {
			this.connections.delete(ws);
		});
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const CHANNEL_NAME = 'foo';

		const id = env.MY_DURABLE_OBJECT.idFromName(CHANNEL_NAME);
		const stub = env.MY_DURABLE_OBJECT.get(id);

		return stub.fetch(request);
	},
} satisfies ExportedHandler<Env>;
