export default {
  async fetch(request, env) {
    return await env.FLASK.fetch(request);
  }
}
