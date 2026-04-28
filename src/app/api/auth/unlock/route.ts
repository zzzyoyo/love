import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const expectedDate = process.env.LOVE_DIARY_ANSWER_DATE || '2024-04-19';
const expectedQuestion =
  process.env.LOVE_DIARY_ANSWER_QUESTION || '你爱我吗？';
const expectedMessage = process.env.LOVE_DIARY_ANSWER_MESSAGE || '我爱你！';
const unlockEmail = process.env.LOVE_DIARY_UNLOCK_EMAIL || '';
const unlockPassword = process.env.LOVE_DIARY_UNLOCK_PASSWORD || '';

const COOLDOWN_MS = 3000;
const lastAttemptByIp = new Map<string, number>();

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json(
      { error: '服务未配置' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const ip = getClientIp(request);
  const lastAttempt = lastAttemptByIp.get(ip);
  const now = Date.now();
  if (lastAttempt && now - lastAttempt < COOLDOWN_MS) {
    return Response.json(
      { error: '请求太频繁，请稍后再试' },
      { status: 429, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  lastAttemptByIp.set(ip, now);

  let payload: { date?: string; question?: string; message?: string } | null =
    null;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: '请求格式不正确' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const date = payload?.date?.trim();
  const question = payload?.question?.trim();
  const message = payload?.message?.trim();
  if (!date || !question || !message) {
    return Response.json(
      { error: '请填写完整答案' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (
    date !== expectedDate ||
    question !== expectedQuestion ||
    message !== expectedMessage
  ) {
    return Response.json(
      { error: '答案不正确' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!unlockEmail || !unlockPassword) {
    return Response.json(
      { error: '服务未配置解锁账号' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: unlockEmail,
    password: unlockPassword,
  });

  if (error || !data.session) {
    return Response.json(
      { error: '解锁失败' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { access_token, refresh_token, expires_in, token_type } = data.session;
  return Response.json(
    { access_token, refresh_token, expires_in, token_type },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
