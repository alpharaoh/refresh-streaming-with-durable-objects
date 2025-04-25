import { DurableObject } from 'cloudflare:workers';
import { streamText } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { clearStream, handleWebSocket, sendMessage } from './utils';

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

			// Accept and add the WebSocket to the set of connections
			await handleWebSocket(this.ctx, this.connections, server);

			return new Response(undefined, {
				status: 101,
				webSocket: client,
			});
		}

		// GET /prompt
		if (request.method === 'POST' && new URL(request.url).pathname === '/prompt') {
			const prompt = 'Write me a poem about the sun';

			this.promptLlm(prompt);

			return new Response('Prompt received');
		}

		// Fallback
		return new Response('Not found');
	}

	async promptLlm(prompt: string): Promise<void> {
		await clearStream(this.ctx, this.connections);

		const { textStream } = streamText({
			model: this.google('models/gemini-2.0-flash-exp'),
			system: 'You are a friendly assistant!',
			prompt,
		});

		let fullOutput = '';

		for await (const chunk of textStream) {
			fullOutput += chunk;

			sendMessage(this.connections, chunk);
			await this.ctx.storage.put('stream', fullOutput);
		}
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
