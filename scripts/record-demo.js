#!/usr/bin/env node
/**
 * ReviewLens AI — automated demo recorder
 *
 * Records a full walkthrough of all features:
 *   1. Home page
 *   2. Ingestion (URL → session)
 *   3. Proactive Insight Brief
 *   4. Quick-Start Prompts
 *   5. AI response + Citations
 *   6. Contextual Follow-Up Chips
 *   7. Guardrails — off-topic refusal
 *   8. Guardrails — input validation
 *
 * Usage:
 *   node scripts/record-demo.js
 *
 * Env vars (all optional):
 *   BASE_URL            — default: https://reviewlens-ai-f6lj.onrender.com
 *   TRUSTPILOT_URL      — default: https://www.trustpilot.com/review/notion.so
 *   REVIEW_CAP          — default: 10  (keep small for demo speed)
 *   EXISTING_SESSION_ID — skip ingestion, jump straight to this session
 *   CHROME_PATH         — override Chrome executable path
 *   SKIP_VOICEOVER      — set to "1" to skip TTS generation
 *
 * Output: demo-out/demo.mp4  (video + voice-over mixed)
 *
 * Target duration: ~3 minutes
 */

const { chromium } = require('playwright-core');
const { execSync, spawnSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.BASE_URL || 'https://reviewlens-ai-f6lj.onrender.com';
const TRUSTPILOT_URL = process.env.TRUSTPILOT_URL || 'https://www.trustpilot.com/review/notion.so';
const REVIEW_CAP = process.env.REVIEW_CAP || '10';
const EXISTING_SESSION_ID = process.env.EXISTING_SESSION_ID || '';
const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SKIP_VOICEOVER = process.env.SKIP_VOICEOVER === '1';

const OUT_DIR = path.join(__dirname, '..', 'demo-out');
const WEBM_PATH = path.join(OUT_DIR, 'demo.webm');
const VIDEO_ONLY_MP4 = path.join(OUT_DIR, 'demo-video-only.mp4');
const NARRATION_PATH = path.join(OUT_DIR, 'narration.aiff');
const MP4_PATH = path.join(OUT_DIR, 'demo.mp4');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function slowType(locator, text, delayMs = 50) {
  await locator.click();
  for (const ch of text) {
    await locator.type(ch);
    await pause(delayMs);
  }
}

async function waitForInsightBrief(page) {
  await page.waitForSelector('text=AI Insights', { timeout: 60_000 });
  try {
    await page.waitForSelector('text=Analyzing reviews…', { state: 'detached', timeout: 90_000 });
  } catch { /* already gone or never appeared */ }
}

async function waitForAssistantResponse(page) {
  try {
    await page.waitForSelector('text=Thinking…', { timeout: 10_000 });
  } catch { /* already gone */ }
  await page.waitForSelector('text=Thinking…', { state: 'detached', timeout: 90_000 });
}

async function waitForFollowUpChips(page) {
  try {
    await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 30_000 });
  } catch { /* ignore */ }
  await pause(800);
}

// ─────────────────────────────────────────────────────────
// Voice-over: macOS `say` TTS
// Each scene has a narration line. We generate one audio
// segment per scene with silence padding, then stitch with
// ffmpeg into a single AIFF, then mix over the video.
// ─────────────────────────────────────────────────────────

const NARRATION_VOICE = 'Samantha';
const NARRATION_RATE = 160; // words per minute

const SCENES = [
  // [scene_id, duration_ms, narration_text]
  ['home',       8_000,  'Welcome to ReviewLens AI — the fastest way to turn customer reviews into product insights.'],
  ['ingest',    12_000,  'Simply paste a Trustpilot URL and set a review cap. ReviewLens scrapes and stores the data automatically.'],
  ['progress',  10_000,  'Ingestion runs in real time. Watch as pages are fetched and reviews are saved to the database.'],
  ['session',    6_000,  'Once ingestion completes, you land on your session dashboard.'],
  ['insights',  18_000,  'ReviewLens immediately generates a proactive Insight Brief — key themes, sentiment patterns, and actionable signals — without you asking a single question.'],
  ['expand',    12_000,  'Click the card to expand the full brief. Each theme is grounded in the actual review data.'],
  ['quickstart', 8_000,  'Quick-Start Prompts let you jump straight to the most valuable questions with a single click.'],
  ['response',  20_000,  'Claude analyzes every review in context and streams a structured answer back to you, with citations linking each claim to its source review.'],
  ['citations', 10_000,  'Every factual claim includes an inline citation. Expand sources to see the exact reviews that back each statement.'],
  ['chips',     15_000,  'After each answer, contextual Follow-Up Chips suggest the next most relevant questions — so the analysis drives itself.'],
  ['chip_resp', 18_000,  'Click a chip to drill deeper. The conversation builds on prior context, giving you richer answers with every exchange.'],
  ['guardrail_refusal', 16_000, 'ReviewLens includes built-in guardrails. Ask about anything outside the review data — like a competitor or a general knowledge question — and the model politely refuses.'],
  ['guardrail_input',   10_000, 'Short or empty inputs are caught client-side before they ever reach the model.'],
  ['final',     7_000,   'ReviewLens AI — ship smarter products by listening to every customer, at scale.'],
];

function generateNarrationAudio(scenes) {
  if (SKIP_VOICEOVER) {
    console.log('⏭   SKIP_VOICEOVER=1 — skipping TTS generation.');
    return null;
  }

  console.log('\n🎙  Generating voice-over narration…');

  const segmentFiles = [];
  const silencePath = path.join(OUT_DIR, 'silence_500ms.aiff');

  // Generate 500ms silence clip once
  spawnSync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-t', '0.5', '-c:a', 'pcm_s16le', silencePath,
  ], { stdio: 'inherit' });

  for (const [id, _durationMs, text] of scenes) {
    const segPath = path.join(OUT_DIR, `narr_${id}.aiff`);
    console.log(`    TTS: ${id}`);
    const result = spawnSync('say', [
      '-v', NARRATION_VOICE,
      '-r', String(NARRATION_RATE),
      '-o', segPath,
      '--data-format=LEF32@44100',
      text,
    ], { stdio: 'inherit' });
    if (result.status !== 0) {
      console.warn(`    Warning: say failed for scene ${id}`);
    }
    segmentFiles.push(segPath);
    segmentFiles.push(silencePath); // short gap between scenes
  }

  // Concatenate all segments into one AIFF using ffmpeg concat
  // Build a concat input list
  const concatListPath = path.join(OUT_DIR, 'narr_concat.txt');
  const listContent = segmentFiles
    .filter(f => fs.existsSync(f))
    .map(f => `file '${f}'`)
    .join('\n');
  fs.writeFileSync(concatListPath, listContent);

  console.log('    Concatenating narration segments…');
  const concatResult = spawnSync('ffmpeg', [
    '-y', '-f', 'concat', '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    NARRATION_PATH,
  ], { stdio: 'inherit' });

  if (concatResult.status !== 0) {
    console.warn('    Warning: narration concat failed — demo will have no audio.');
    return null;
  }

  // Cleanup segment files
  for (const f of segmentFiles) {
    if (f !== silencePath && fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (fs.existsSync(silencePath)) fs.unlinkSync(silencePath);
  if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);

  console.log(`    Narration saved: ${NARRATION_PATH}`);
  return NARRATION_PATH;
}

// ─────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────

(async () => {
  console.log('🎬  ReviewLens AI — Demo Recorder (3-minute edition)');
  console.log(`    BASE_URL: ${BASE_URL}`);
  console.log(`    Output:   ${MP4_PATH}`);
  console.log('');

  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`Chrome not found at: ${CHROME_PATH}`);
    console.error('Set CHROME_PATH env var to your Chrome/Chromium executable.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Clean up old files
  for (const f of [WEBM_PATH, VIDEO_ONLY_MP4, MP4_PATH]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: false,
    slowMo: 0,
    args: ['--window-size=1280,800'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: OUT_DIR,
      size: { width: 1280, height: 800 },
    },
  });

  const page = await context.newPage();

  // ─── SCENE: home ─────────────────────────────────────────
  console.log('📍  Scene: home');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await pause(8_000);

  let sessionId = EXISTING_SESSION_ID;

  if (!sessionId) {
    // ─── SCENE: ingest ───────────────────────────────────────
    console.log('📍  Scene: ingest — typing URL');
    const urlInput = page.locator('input[placeholder*="trustpilot"], input[placeholder*="url"], input[type="url"], input[type="text"]').first();
    await urlInput.scrollIntoViewIfNeeded();
    await pause(800);
    await slowType(urlInput, TRUSTPILOT_URL, 40);
    await pause(600);

    // Set cap
    const capInput = page.locator('input[type="number"]').first();
    await capInput.click({ clickCount: 3 });
    await capInput.fill(REVIEW_CAP);
    await pause(800);

    // Linger on filled form before clicking
    await pause(2_500);

    const ingestBtn = page.locator('button:has-text("Ingest Reviews"), button:has-text("Analyze"), button[type="submit"]').first();
    await ingestBtn.click();
    await pause(1_000);

    // ─── SCENE: progress ─────────────────────────────────────
    console.log('📍  Scene: progress — ingestion in flight');
    await pause(10_000);

    console.log('    Waiting for redirect to session page…');
    await page.waitForURL((url) => url.pathname.startsWith('/session/'), {
      timeout: 240_000,
    });

    sessionId = page.url().split('/session/')[1];
    console.log(`    Session ID: ${sessionId}`);
  } else {
    console.log(`📍  Skipping ingestion — session ${sessionId}`);
    await page.goto(`${BASE_URL}/session/${sessionId}`, { waitUntil: 'networkidle' });
  }

  // ─── SCENE: session ──────────────────────────────────────
  console.log('📍  Scene: session page');
  await pause(6_000);

  // ─── SCENE: insights ─────────────────────────────────────
  console.log('📍  Scene: AI Insights Brief loading');
  const insightCard = page.locator('text=AI Insights').first();
  await insightCard.scrollIntoViewIfNeeded();
  await pause(1_000);

  console.log('    Waiting for analysis…');
  await waitForInsightBrief(page);
  await pause(4_000);

  // ─── SCENE: expand ───────────────────────────────────────
  console.log('📍  Scene: expand Insight Brief');
  await insightCard.click();
  await pause(12_000);

  // ─── SCENE: quickstart ───────────────────────────────────
  console.log('📍  Scene: Quick-Start Prompts');
  const quickStartBtn = page.locator('button:has-text("top 3 customer complaints"), button:has-text("complaints"), button:has-text("What are the")').first();
  const hasQuickStart = await quickStartBtn.isVisible().catch(() => false);
  if (hasQuickStart) {
    await quickStartBtn.scrollIntoViewIfNeeded();
    await pause(3_000);
    await quickStartBtn.click();
  } else {
    console.log('    No quick-start chips visible — typing manually');
    const input = page.locator('input[placeholder*="Ask"], input[placeholder*="ask"], textarea').first();
    await input.click();
    await slowType(input, 'What are the top 3 customer complaints?', 45);
    await page.keyboard.press('Enter');
  }

  // ─── SCENE: response ─────────────────────────────────────
  console.log('📍  Scene: waiting for assistant response');
  await waitForAssistantResponse(page);
  await pause(2_000);

  // Scroll to see full response
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(4_000);

  // ─── SCENE: citations ────────────────────────────────────
  console.log('📍  Scene: citations');
  // Try to expand citations (Show more sources button)
  const showMoreBtn = page.locator('button:has-text("Show"), button:has-text("source"), button:has-text("Source")').first();
  const showMoreVisible = await showMoreBtn.isVisible().catch(() => false);
  if (showMoreVisible) {
    await showMoreBtn.scrollIntoViewIfNeeded();
    await pause(2_000);
    await showMoreBtn.click();
    await pause(4_000);
  } else {
    await pause(6_000);
  }

  // Scroll to show citations area
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(4_000);

  // ─── SCENE: chips ────────────────────────────────────────
  console.log('📍  Scene: Follow-Up Chips');
  await waitForFollowUpChips(page);

  const chip = page.locator('button.rounded-full.border-violet-200').first();
  const chipVisible = await chip.isVisible().catch(() => false);
  if (chipVisible) {
    await chip.scrollIntoViewIfNeeded();
    await pause(4_000);
    await chip.click();
    await pause(1_000);
  } else {
    console.log('    No follow-up chips visible — lingering');
    await pause(5_000);
  }

  // ─── SCENE: chip_resp ────────────────────────────────────
  console.log('📍  Scene: chip response');
  if (chipVisible) {
    await waitForAssistantResponse(page);
    await pause(2_000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pause(6_000);
  } else {
    await pause(8_000);
  }

  // ─── SCENE: guardrail_refusal ────────────────────────────
  console.log('📍  Scene: guardrail — off-topic refusal');
  const chatInput = page.locator('input[placeholder*="Ask"], input[placeholder*="ask"], textarea').first();
  await chatInput.scrollIntoViewIfNeeded();
  await chatInput.click();
  await pause(1_000);
  // Type an off-topic question (should trigger [refusal] per system prompt rules 2+3)
  await slowType(chatInput, 'What is the weather forecast in Paris today?', 45);
  await pause(2_000);
  await page.keyboard.press('Enter');
  await waitForAssistantResponse(page);
  await pause(2_000);
  // Scroll to show the refusal message
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(5_000);

  // ─── SCENE: guardrail_input ──────────────────────────────
  console.log('📍  Scene: guardrail — input validation (too short)');
  await chatInput.scrollIntoViewIfNeeded();
  await chatInput.click();
  // Clear any existing text
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await pause(500);
  // Type a single character (too short — preCheck requires >= 3 chars)
  await slowType(chatInput, 'hi', 60);
  await pause(1_500);
  await page.keyboard.press('Enter');
  // Wait briefly — preCheck returns 400 immediately, UI should show error
  await pause(4_000);
  // Clear and show the input is ready again
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await pause(2_000);

  // ─── SCENE: final ────────────────────────────────────────
  console.log('📍  Scene: final wide shot');
  await page.evaluate(() => window.scrollTo(0, 0));
  await pause(7_000);

  // ─── Done — close context to flush video ─────────────────
  console.log('\n⏹   Closing browser and flushing video…');
  await context.close();
  await browser.close();

  // Rename the auto-generated webm
  const files = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.webm'));
  if (files.length === 0) {
    console.error('No webm file found in demo-out/. Recording may have failed.');
    process.exit(1);
  }
  const rawWebm = path.join(OUT_DIR, files[0]);
  fs.renameSync(rawWebm, WEBM_PATH);
  console.log(`    Saved: ${WEBM_PATH}`);

  // Convert webm → mp4 (video only, no audio yet)
  console.log('\n🎞   Converting to MP4…');
  const convertResult = spawnSync('ffmpeg', [
    '-y',
    '-i', WEBM_PATH,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '22',
    '-an', // no audio — will add narration next
    VIDEO_ONLY_MP4,
  ], { stdio: 'inherit' });

  if (convertResult.status !== 0) {
    console.error('ffmpeg conversion failed. WebM is still at:', WEBM_PATH);
    process.exit(1);
  }

  // Generate TTS narration
  const narrationFile = generateNarrationAudio(SCENES);

  // Mix video + narration (or just rename if no narration)
  if (narrationFile && fs.existsSync(narrationFile)) {
    console.log('\n🎙  Mixing video + voice-over…');
    const mixResult = spawnSync('ffmpeg', [
      '-y',
      '-i', VIDEO_ONLY_MP4,
      '-i', narrationFile,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      // Trim audio to video length; pad audio with silence if shorter
      '-filter_complex',
      '[1:a]apad[aout]',
      '-map', '0:v',
      '-map', '[aout]',
      '-shortest',
      MP4_PATH,
    ], { stdio: 'inherit' });

    if (mixResult.status !== 0) {
      console.warn('Audio mix failed — copying video-only version.');
      fs.copyFileSync(VIDEO_ONLY_MP4, MP4_PATH);
    }
  } else {
    console.log('\n⚠️   No narration — saving video-only demo.');
    fs.copyFileSync(VIDEO_ONLY_MP4, MP4_PATH);
  }

  // Cleanup intermediate files
  if (fs.existsSync(VIDEO_ONLY_MP4)) fs.unlinkSync(VIDEO_ONLY_MP4);
  if (narrationFile && fs.existsSync(narrationFile)) fs.unlinkSync(narrationFile);

  console.log(`\n✅  Demo video saved to: ${MP4_PATH}`);
  console.log('    Upload to Loom via loom.com/upload or drag into Loom desktop app.');

  // Print duration
  const probeResult = spawnSync('ffprobe', [
    '-v', 'quiet', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    MP4_PATH,
  ], { encoding: 'utf8' });
  if (probeResult.stdout) {
    const dur = parseFloat(probeResult.stdout.trim());
    const mins = Math.floor(dur / 60);
    const secs = Math.round(dur % 60);
    console.log(`    Duration: ${mins}m ${secs}s`);
  }
})();
