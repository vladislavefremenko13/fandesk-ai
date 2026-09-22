import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8787);

const STYLE_RULES = {
  warm: 'warm, natural and personal; keep messages short',
  genz: 'Gen Z style: lowercase, casual abbreviations such as tbh/idk/ngl, max 1–2 emojis',
  playful: 'playful and confident, never pushy or explicit',
  classy: 'calm, elegant and lightly flirtatious'
};

const ZOOMER_RULES = `lazy gen-z texting voice: always lowercase, never use apostrophes, never capitalize the first word, short imperfect messages, use hehe often but naturally. Rotate slang such as ty, thx, gm, lil, ntmy, tbh, btw, ofc, smth, wyd, ngl, what u up to, cuz, bc, nah, nope, yay, yea, yep, yup, wtf, omg, idk, asf, af, fr, lol, lmao, <3, ><, >.<, >,<, :p, :d, xd, :3, >w<. Do not force slang into every sentence.`;

const HARD_BAN_TERMS = [
  'celebrity ai','deepfake','face swap','ai generated','synthetic media','abdl','age play','ageplay','child','minor','teenager','underage','loli','shota','animal','bestiality','corpse','dead body','furry','necrophilia','zoophilia','extreme bondage','blood play','urine','vomit','incest','catfish','fake account','impersonate','stolen identity','terrorism','escort','full service','hooker','human trafficking','meet me','meet up','prostitute','prostitution','revenge porn','rape','non-consensual','kidnap','murder','torture','cashapp','crypto wallet','paypal','venmo','zelle','explicit banner','nude avatar','google ads','self-harm','suicide','cocaine','fentanyl','heroin','meth','molly','bot','buy followers','fake followers','gambling','lottery','sweepstake','worn panties'
];
const REVIEW_TERMS = ['ai chatbot','barely legal','fresh 18','just turned 18','slave','onlyfans','fanvue','loyalfans','pornhub','choke','strangle','leaked','stolen content','public','gun','knife','weapon','alcohol','cannabis'];
function hasTerm(text, terms) { const lower = String(text).toLowerCase(); return terms.find(term => lower.includes(term)); }
function normalizeZoomer(text) { return String(text).replace(/[’']/g, '').toLowerCase(); }
function complianceNote(text) { const hard = hasTerm(text, HARD_BAN_TERMS); const review = hasTerm(text, REVIEW_TERMS); return hard ? `blocked term detected: ${hard}` : review ? `review term detected: ${review}` : null; }

const pick = items => items[Math.floor(Math.random() * items.length)];

function localGenerate({ text = '', style = 'warm', mode = 'replies', name = 'fan', generationMode = 'smart' }) {
  const lower = text.toLowerCase();
  const hasQuestion = text.includes('?');
  const topic = lower.includes('music') ? 'music' : lower.includes('travel') ? 'travel' : lower.includes('work') ? 'work' : 'that';
  const suffix = style === 'genz' ? pick([' tbh 😌', ' ngl 👀', ' lol']) : style === 'playful' ? pick([' 😉', ' ✨', '']) : '';
  if (mode === 'scenario') return {
    title: 'Light flirt, no pressure',
    steps: ['Reply to his last thought before changing the subject.', 'Ask one open question about ' + topic + '.', 'Add one personal detail and invite him to continue.', 'If he replies briefly, give him space instead of pushing.'],
    examples: ['okay, now im actually curious — what usually catches your attention?' + suffix, 'tell me more, im listening 👀' + suffix]
  };
  if (mode === 'broadcast') return {
    drafts: [
      `hey ${name}, just checking in — hows your day going?${suffix}`,
      `i’m in the mood for a good conversation tonight. what’s new with you?${suffix}`,
      `quick question: what has been making you smile lately?${suffix}`
    ],
    note: 'Review personalization and platform limits before sending; do not send the exact same copy to everyone.'
  };
  const openers = hasQuestion ? ['That’s a good question — I’d answer honestly and keep the conversation moving.', 'I like that question. It gives us something fun to talk about.'] : ['That sounds like a mood worth talking about.', 'I like the way you put that.'];
  const result = {
    analysis: { name, tone: style === 'genz' ? 'casual' : 'friendly', intent: hasQuestion ? 'wants the conversation to continue' : 'sharing context', topics: [topic], boundaries: 'do not infer personality from one message' },
    replies: [
      `${pick(openers)} ${style === 'genz' ? 'ngl, tell me a lil more?' : 'would you tell me a little more?'}${suffix}`,
      `${pick(['i like how you put that.', 'youve got my attention.'])} what matters most to you about it?${suffix}`,
      `${pick(['now i want the story behind it.', 'okay, i need the next chapter.'])} how did you get into it?${suffix}`
    ]
  };
  if (style === 'genz') result.replies = result.replies.map(normalizeZoomer);
  return result;
}

async function aiGenerate(payload) {
  const inputIssue = complianceNote(payload.text || '');
  if (!process.env.OPENAI_API_KEY) {
    const fallback = localGenerate(payload);
    return inputIssue ? { ...fallback, note: inputIssue } : fallback;
  }
  const system = `You are a writing assistant for a creator chatting with adult subscribers. Generate only romantic or light flirtation without explicit sexual descriptions, sexual instructions, or promises on the creator's behalf. Do not infer age from an image or text. Always return JSON. All analysis, scenarios and replies must be in English. Style: ${STYLE_RULES[payload.style] || STYLE_RULES.warm}. ${payload.style === 'genz' ? ZOOMER_RULES : ''} Generation mode: ${payload.generationMode || 'smart'}; make each response fresh and distinct from common templates. Never use any hard-ban Fansly term or flagged term; if the input contains one, return a neutral safe reply and mention review in the note. Random seed: ${payload.seed || Math.random().toString(36).slice(2)}. Hard-ban terms: ${HARD_BAN_TERMS.join(', ')}. Review terms: ${REVIEW_TERMS.join(', ')}.`;
  const schema = payload.mode === 'replies'
    ? { type: 'object', properties: { analysis: { type: 'object', properties: { name: { type: 'string' }, tone: { type: 'string' }, intent: { type: 'string' }, topics: { type: 'array', items: { type: 'string' } }, boundaries: { type: 'string' } }, required: ['name', 'tone', 'intent', 'topics', 'boundaries'], additionalProperties: false }, replies: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 } }, required: ['analysis', 'replies'], additionalProperties: false }
    : { type: 'object', properties: { drafts: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 }, note: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, examples: { type: 'array', items: { type: 'string' } }, title: { type: 'string' } }, additionalProperties: false };
  const body = { model: process.env.OPENAI_MODEL || 'gpt-4o-mini', input: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }], text: { format: { type: 'json_schema', name: 'fan_assistant', strict: true, schema } } };
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
  const data = await response.json();
  const raw = data.output?.flatMap(x => x.content || []).find(x => x.type === 'output_text')?.text;
  if (!raw) return localGenerate(payload);
  const parsed = JSON.parse(raw);
  const allText = JSON.stringify(parsed);
  const issue = complianceNote(allText);
  if (issue) return { ...localGenerate({ ...payload, style: 'genz' }), note: issue };
  if (parsed.replies) parsed.replies = parsed.replies.map(normalizeZoomer);
  if (parsed.drafts) parsed.drafts = parsed.drafts.map(normalizeZoomer);
  if (parsed.examples) parsed.examples = parsed.examples.map(normalizeZoomer);
  return parsed;
}

async function bodyJson(req) { let s = ''; for await (const chunk of req) s += chunk; return JSON.parse(s || '{}'); }
function send(res, status, data, type = 'application/json') { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(type === 'application/json' ? JSON.stringify(data) : data); }

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/generate') {
      const payload = await bodyJson(req);
      const result = await aiGenerate(payload);
      return send(res, 200, { ...result, provider: process.env.OPENAI_API_KEY ? 'openai' : 'local-fallback' });
    }
    if (req.method === 'GET') {
      const file = req.url === '/' ? 'index.html' : req.url.slice(1);
      if (!file.includes('..')) {
        const data = await fs.readFile(path.join(root, 'public', file));
        return send(res, 200, data, file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      }
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) { send(res, 500, { error: e.message }); }
});
server.listen(port, () => console.log(`Fan Reply Assistant: http://localhost:${port}`));
