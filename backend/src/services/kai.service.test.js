const assert = require('assert');
const { parseKaiStream } = require('./kai.service');

(async () => {
  const rawStream = [
    'data: {"function_call": "search_knowledge_base", "streaming": true, "chat_id": "6a437391a3bf6615ac9859a5", "timestamp": 1782805394.101034}',
    'data: {"response": "Our", "streaming": true, "chat_id": "6a437391a3bf6615ac9859a5", "timestamp": 1782805395.781444, "is_thought": null}',
    'data: {"response": " Professional Certificate programs are non-degree, non-credit offerings designed for skilling and career", "streaming": true, "chat_id": "6a437391a3bf6615ac9859a5", "timestamp": 1782805395.783854, "is_thought": null}',
    'data: {"response": " acceleration. They do not grant academic credits, nor do they count toward a BITS Pilani degree.\n\nIf you are interested in", "streaming": true, "chat_id": "6a437391a3bf6615ac9859a5", "timestamp": 1782805395.783984, "is_thought": null}',
    'data: {"response": " pursuing a degree, we offer separate UGC-approved online degree programs that you may wish to explore.\n\nPlease let us know if you", "streaming": true, "chat_id": "6a437391a3bf6615ac9859a5", "timestamp": 1782805395.838684, "is_thought": null}',
    'data: {"response": " have more questions.\n\n", "streaming": true, "chat_id": "6a437391a3bf6615ac9859a5", "timestamp": 1782805395.915469, "is_thought": null}',
    'data: {"response": "stream_complete", "streaming": false, "chat_id": "6a437391a3bf6615ac9859a5", "timestamp": 1782805396.131288, "action_items": [{"label": "Explore Degree Programs", "type": "prompt", "action": {"payload": "Tell me about your degree programs"}}, {"label": "View Certificate Details", "type": "prompt", "action": {"payload": "Tell me more about Professional Certificate programs"}}], "token_usage": {"prompt_token_count": 11430, "candidates_token_count": 121, "total_token_count": 11551, "cached_content_token_count": 8157, "thoughts_token_count": 0, "tool_use_prompt_token_count": 0, "metadata_event_count": 11, "source": "usage_metadata"}, "widgets": []}',
    'data: {"response": "chat_saved", "streaming": false, "chat_id": "6a437391a3bf6615ac9859a5", "message_id": "6a437394a3bf6615ac9859a7", "timestamp": 1782805396.503212}'
  ].join('\n');

  const extracted = parseKaiStream(rawStream);
  assert.strictEqual(
    extracted,
    'Our Professional Certificate programs are non-degree, non-credit offerings designed for skilling and career acceleration. They do not grant academic credits, nor do they count toward a BITS Pilani degree.\n\nIf you are interested in pursuing a degree, we offer separate UGC-approved online degree programs that you may wish to explore.\n\nPlease let us know if you have more questions.',
    'Expected a clean merged stream answer without stream control events'
  );

  console.log('kai service stream parse test passed');
})();
