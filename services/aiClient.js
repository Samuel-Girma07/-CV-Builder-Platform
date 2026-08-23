const OpenAI = require('openai');
const { logger } = require('../middlewares/logger');

// Primary: configurable via NVIDIA_MODEL (large, best quality).
// Fallback: small fast model used when the primary is slow or erroring.
const PRIMARY_MODEL = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';
const FALLBACK_MODEL = 'meta/llama-3.1-8b-instruct';

// The primary gets a short fast-fail window; the fallback gets whatever
// remains of ONE shared deadline, so total server time can never exceed it.
const PRIMARY_TIMEOUT_MS = 15000;
const TOTAL_DEADLINE_MS = 75000;

const AI_UNAVAILABLE_MESSAGE = 'The AI service is currently unavailable. Please try again in a moment.';

const nvidiaClient = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

/**
 * Run a chat completion against the primary model, transparently retrying on
 * the fast fallback model if the primary errors or stalls. A single shared
 * deadline bounds the worst case; every in-flight request is abortable.
 * @param {object} params - chat.completions.create() params (without `model`)
 */
async function callAi(params) {
  const startedAt = Date.now();

  // ── Primary attempt ────────────────────────────────────────────
  logger.info(`AI call: primary model ${PRIMARY_MODEL}`);
  const primaryAbort = new AbortController();
  const hardStop = setTimeout(() => primaryAbort.abort(), TOTAL_DEADLINE_MS);
  let raceTimer;
  try {
    const result = await Promise.race([
      nvidiaClient.chat.completions.create(
        { ...params, model: PRIMARY_MODEL },
        { signal: primaryAbort.signal }
      ),
      new Promise((_, reject) => {
        raceTimer = setTimeout(() => reject(new Error('primary_timeout')), PRIMARY_TIMEOUT_MS);
      }),
    ]);
    clearTimeout(hardStop);
    clearTimeout(raceTimer);
    return result;
  } catch (err) {
    clearTimeout(hardStop);
    clearTimeout(raceTimer);
    primaryAbort.abort();
    logger.warn(
      err.message === 'primary_timeout'
        ? `AI call: primary timed out after ${PRIMARY_TIMEOUT_MS}ms. Trying fallback.`
        : `AI call: primary error (${err.message}). Trying fallback.`
    );
  }

  // ── Fallback attempt ───────────────────────────────────────────
  const remaining = TOTAL_DEADLINE_MS - (Date.now() - startedAt);
  if (remaining <= 2000) {
    logger.error('AI call: shared deadline exhausted before fallback could run.');
    throw new Error(AI_UNAVAILABLE_MESSAGE);
  }

  logger.info(`AI call: fallback model ${FALLBACK_MODEL} (budget ${remaining}ms)`);
  const fallbackAbort = new AbortController();
  const fallbackStop = setTimeout(() => fallbackAbort.abort(), remaining);
  try {
    const result = await nvidiaClient.chat.completions.create(
      { ...params, model: FALLBACK_MODEL },
      { signal: fallbackAbort.signal }
    );
    clearTimeout(fallbackStop);
    return result;
  } catch (err) {
    clearTimeout(fallbackStop);
    fallbackAbort.abort();
    logger.error(`AI call: fallback also failed (${err.message})`);
    throw new Error(AI_UNAVAILABLE_MESSAGE);
  }
}

/**
 * Streaming variant of callAi. Same resilience contract: primary gets a
 * short window, the fallback gets whatever remains of one shared deadline.
 *
 * @param {object} params - chat.completions.create() params (without `model`)
 * @param {object} handlers
 * @param {(delta: string) => void} [handlers.onDelta] - incremental text
 * @param {() => void} [handlers.onReset] - called when partial output from a
 *   failed attempt must be discarded before the fallback restarts clean
 * @param {AbortSignal} [handlers.signal] - external cancel (client disconnect)
 * @returns {Promise<string>} the full generated text
 */
async function callAiStream(params, { onDelta = () => {}, onReset, signal } = {}) {
  const startedAt = Date.now();

  async function runAttempt(model, budgetMs) {
    const abort = new AbortController();
    const stopTimer = setTimeout(() => abort.abort(), Math.max(2000, budgetMs));
    const onExternalAbort = () => abort.abort();
    if (signal) {
      if (signal.aborted) onExternalAbort();
      else signal.addEventListener('abort', onExternalAbort, { once: true });
    }
    let emitted = 0;
    try {
      const stream = await nvidiaClient.chat.completions.create(
        { ...params, model, stream: true },
        { signal: abort.signal }
      );
      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          full += delta;
          emitted += delta.length;
          onDelta(delta);
        }
      }
      if (!full.trim()) throw new Error('empty_stream');
      return full;
    } catch (err) {
      err.emittedChars = emitted;
      throw err;
    } finally {
      clearTimeout(stopTimer);
      if (signal) signal.removeEventListener('abort', onExternalAbort);
      abort.abort(); // release the underlying connection either way
    }
  }

  logger.info(`AI stream: primary model ${PRIMARY_MODEL}`);
  try {
    return await runAttempt(PRIMARY_MODEL, PRIMARY_TIMEOUT_MS);
  } catch (primaryErr) {
    if (primaryErr.emittedChars > 0 && typeof onReset === 'function') {
      onReset();
    }
    logger.warn(
      `AI stream: primary failed after ${primaryErr.emittedChars} chars (${primaryErr.message}). Trying fallback.`
    );
  }

  const remaining = TOTAL_DEADLINE_MS - (Date.now() - startedAt);
  if (remaining <= 2000) {
    logger.error('AI stream: shared deadline exhausted before fallback could run.');
    throw new Error(AI_UNAVAILABLE_MESSAGE);
  }

  logger.info(`AI stream: fallback model ${FALLBACK_MODEL} (budget ${remaining}ms)`);
  try {
    return await runAttempt(FALLBACK_MODEL, remaining);
  } catch (err) {
    logger.error(`AI stream: fallback also failed (${err.message})`);
    throw new Error(AI_UNAVAILABLE_MESSAGE);
  }
}

module.exports = { callAi, callAiStream, AI_UNAVAILABLE_MESSAGE };
