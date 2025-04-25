import { DurableObject } from 'cloudflare:workers';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject<Env> {
	connections: Set<WebSocket>;

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
	}

	async getStream(): Promise<string> {
		const current = (await this.ctx.storage.get('stream')) as string;
		return current;
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') === 'websocket') {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			this.handleWebSocket(server);

			return new Response(undefined, {
				status: 101,
				webSocket: client,
			});
		}

		// POST /prompt
		if (request.method === 'POST' && new URL(request.url).pathname === '/prompt') {
			const prompt = 'Write me a poem about the sun';

			this.promptLlm(prompt);

			return new Response('Prompt received');
		}

		// GET /
		if (request.method === 'GET' && new URL(request.url).pathname === '/') {
			const stream = (await this.ctx.storage.get('stream')) as string;

			return new Response(stream);
		}

		// Fallback
		return new Response('Not found');
	}

	async promptLlm(prompt: string): Promise<void> {
		const { textStream } = streamText({
			model: openai('gpt-4o'),
			system: 'You are a friendly assistant!',
			prompt,
		});

		let fullOutput = '';

		for await (const chunk of textStream) {
			fullOutput += chunk;

			// Send to all WebSocket clients
			for (const ws of this.connections) {
				try {
					ws.send(chunk);
				} catch (err) {
					// Clean up dead connections
					this.connections.delete(ws);
				}
			}
		}

		await this.ctx.storage.put('stream', fullOutput);
	}

	handleWebSocket(ws: WebSocket) {
		ws.accept();
		this.connections.add(ws);

		ws.addEventListener('close', () => {
			this.connections.delete(ws);
		});

		ws.addEventListener('error', () => {
			this.connections.delete(ws);
		});
	}
}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env, ctx): Promise<Response> {
		// Create a `DurableObjectId` for an instance of the `MyDurableObject`
		// class named "foo". Requests from all Workers to the instance named
		// "foo" will go to a single globally unique Durable Object instance.
		const id: DurableObjectId = env.MY_DURABLE_OBJECT.idFromName('foo');

		// Create a stub to open a communication channel with the Durable
		// Object instance.
		const stub = env.MY_DURABLE_OBJECT.get(id);

		return stub.fetch(request);
	},
} satisfies ExportedHandler<Env>;
