export default {
  async fetch(request, env, ctx) {
    return await env.PYTHON.fetch(request);
  }
}
