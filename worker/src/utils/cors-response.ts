export class CorsResponse extends Response {
	constructor(allowOrigin: string, body?: BodyInit | null, init: ResponseInit = {}) {
		const headers = new Headers(init.headers);

		headers.set('Access-Control-Allow-Origin', allowOrigin);
		headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		headers.set('Access-Control-Allow-Headers', 'Content-Type');

		super(body, {
			...init,
			headers,
		});
	}
}
