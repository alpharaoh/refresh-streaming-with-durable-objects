import { DurableObject } from 'cloudflare:workers';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';

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

		// GET /clear
		if (request.method === 'GET' && new URL(request.url).pathname === '/clear') {
			await this.ctx.storage.put('stream', '');

			return new Response('Stream cleared');
		}

		// Fallback
		return new Response('Not found');
	}

	async sendMessage(message: string): Promise<void> {
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
		console.log('Prompting LLM with:', prompt);

		let fullOutput = `Beneath the hush of silver moons,
			Where stars like wayward lilies swoon,
			There lies a gate of mirrored hue—
			A threshold stitched of cloud and dew.

			Beyond it hums a sleeping land,
			Untouched by mortal heart or hand,
			Where rivers laugh and mountains sigh,
			Inside the garden past the sky.

			The roots are spun from dreams half-spoke,
			The trunks from songs the ancients wrote.
			The leaves are glass, the branches gleam,
			With fruits that birth another dream.

			Each petal sings in whispered streams,
			The colors dance beyond their seams.
			A thousand scents in chorus rise—
			Warm cedar smoke, wet stone, sunrise.

			The ground is soft as lullabies,
			It hums beneath with breath and sighs.
			Each stone, each blade, each bending reed,
			Recites some long-forgotten creed.

			The air is thick with honeyed light,
			As if each atom learned to write.
			It writes of love, it weaves of grief,
			It pens the bones of every leaf.

			There stands a tree of woven gold,
			Its branches spiral, tight and bold,
			And on its boughs are nested things—
			Not birds, but echoes stitched with wings.

			The river's mouth, a yawning flame,
			Sings every time you call a name;
			Your voice returns, not quite the same,
			As if your soul had caught the blame.

			The mountains weep with snow of fire,
			Their crowns ablaze with cool desire.
			They crack and moan like fiddles played
			Upon a shipwreck's ghostly grave.

			There in the Garden, time is thin—
			It folds and flips with every spin.
			A thousand futures clothe the ground,
			Each step a different path unwound.

			A boy could stumble into age,
			A crone could step and turn the page,
			Become again a babe of grace,
			With dimpled hands and milk-sweet face.

			The stars above are stitched with thread,
			From thoughts of all the dreaming dead;
			Their light is not a mindless flame,
			But each a soul who sang their name.

			The Garden's heart is not a throne,
			No king, no queen, no blood, no bone—
			But in its core, a pond does lie,
			Reflecting not the Earth, but sky.

			Its surface smooth, its ripples spare,
			Each gaze unlocks a hidden stair`;

		let soFar = '';

		for (let i = 0; i < fullOutput.length; i++) {
			const chunk = fullOutput.substring(i, i + 1);

			soFar += chunk;

			console.log('Sending chunk:', chunk);
			this.sendMessage(chunk);

			await this.ctx.storage.put('stream', soFar);

			await new Promise((resolve) => setTimeout(resolve, 2));
		}

		// const { textStream } = streamText({
		// 	model: google('models/gemini-2.0-flash-exp'),
		// 	system: 'You are a friendly assistant!',
		// 	prompt,
		// });
		//
		// let fullOutput = '';
		//
		// for await (const chunk of textStream) {
		// 	fullOutput += chunk;
		//
		// 	console.log('Sending chunk:', chunk);
		//
		// 	this.sendMessage(chunk);
		// }

		// await this.ctx.storage.put('stream', fullOutput);
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
