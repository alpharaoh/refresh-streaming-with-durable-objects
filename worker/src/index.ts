import { DurableObject } from 'cloudflare:workers';
import { streamText } from 'ai';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { handleWebSocket, sendMessage } from './utils/webhook';
import { CorsResponse } from './utils/cors-response';

const CLEAR_STREAM_MESSAGE = 'clear_text';

export class MyDurableObject extends DurableObject<Env> {
	connections: Set<WebSocket>;
	google: GoogleGenerativeAIProvider;
	stream: string;
	isGenerating: boolean;

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
		this.stream = '';
		this.isGenerating = false;

		// Initialize the stored stream in memory upon creation of DO
		ctx.blockConcurrencyWhile(async () => {
			this.stream = (await ctx.storage.get<string>('stream')) || '';
		});
	}

	async fetch(request: Request): Promise<Response> {
		// CORS pre-flight
		if (request.method === 'OPTIONS') {
			return new CorsResponse(this.env.ALLOWED_ORIGIN_URL, undefined, { status: 204 });
		}

		// Websocket upgrade
		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			// Accept and add the WebSocket to the set of connections
			await handleWebSocket(this.connections, server);
			server.send(this.stream);

			return new Response(undefined, {
				status: 101,
				webSocket: client,
			});
		}

		// GET /prompt
		if (request.method === 'POST' && new URL(request.url).pathname === '/prompt') {
			const prompt = 'Write me a poem about the sun';

			if (this.isGenerating) {
				return new CorsResponse(this.env.ALLOWED_ORIGIN_URL, 'Busy', { status: 429 });
			}

			this.isGenerating = true;
			const generation = this.promptLlm(prompt).finally(() => (this.isGenerating = false));
			// Ensure DO stays alive while generating
			this.ctx.waitUntil(generation);

			return new CorsResponse(this.env.ALLOWED_ORIGIN_URL, 'Prompt received', { status: 200 });
		}

		// Fallback
		return new CorsResponse(this.env.ALLOWED_ORIGIN_URL, 'Not found', { status: 404 });
	}

	async promptLlm(prompt: string): Promise<void> {
		// Clear the stream upon new prompt
		this.stream = '';
		await this.ctx.storage.put('stream', '');
		sendMessage(this.connections, CLEAR_STREAM_MESSAGE);

		const { textStream } = streamText({
			model: this.google('models/gemini-2.0-flash-exp'),
			system: 'You are a friendly assistant!',
			prompt,
		});

		let fullOutput = '';

		for await (const chunk of textStream) {
			fullOutput += chunk;

			sendMessage(this.connections, chunk);

			this.stream = fullOutput;
		}

		// Persist the stream output to disk storage
		await this.ctx.storage.put('stream', fullOutput);
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
