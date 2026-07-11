// ════════════════════════════════════════════════════════════════════
// YARAM — Q&A publique produits (Amazon-style)
// ════════════════════════════════════════════════════════════════════
// RPCs Supabase SECURITY DEFINER cote client :
//   - qa_get_questions      (public read - top 3 answers per question)
//   - qa_ask_question       (authenticated)
//   - qa_answer_question    (authenticated - detecte auto is_pharmacist)
//   - qa_vote               (authenticated - helpful/not_helpful)
// ════════════════════════════════════════════════════════════════════

import { supabase } from './client';

export async function getProductQuestions(productId, limit = 20) {
  if (!productId) return [];
  const { data, error } = await supabase.rpc('qa_get_questions', {
    p_product_id: productId,
    p_limit: limit,
  });
  if (error) {
    console.warn('[getProductQuestions]', error.message);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function askProductQuestion(productId, questionText) {
  if (!productId) return { ok: false, error: 'missing_product_id' };
  const q = String(questionText || '').trim();
  if (q.length < 5) return { ok: false, error: 'question_too_short' };
  const { data, error } = await supabase.rpc('qa_ask_question', {
    p_product_id: productId,
    p_question: q,
  });
  if (error) {
    console.warn('[askProductQuestion]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data };
}

export async function answerProductQuestion(questionId, answerText) {
  if (!questionId) return { ok: false, error: 'missing_question_id' };
  const a = String(answerText || '').trim();
  if (a.length < 3) return { ok: false, error: 'answer_too_short' };
  const { data, error } = await supabase.rpc('qa_answer_question', {
    p_question_id: questionId,
    p_answer: a,
  });
  if (error) {
    console.warn('[answerProductQuestion]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data };
}

export async function voteOnQA(targetType, targetId, voteType) {
  if (!targetId || !['question', 'answer'].includes(targetType)) {
    return { ok: false, error: 'invalid_target' };
  }
  if (!['helpful', 'not_helpful'].includes(voteType)) {
    return { ok: false, error: 'invalid_vote' };
  }
  const { data, error } = await supabase.rpc('qa_vote', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_vote_type: voteType,
  });
  if (error) {
    console.warn('[voteOnQA]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true, ...(data || {}) };
}

// Admin
export async function adminListQAModeration(limit = 50) {
  const { data, error } = await supabase.rpc('admin_qa_list_moderation', {
    p_limit: limit,
  });
  if (error) {
    console.warn('[adminListQAModeration]', error.message);
    return { questions: [], answers: [] };
  }
  return data || { questions: [], answers: [] };
}

export async function adminModerateQA(targetType, targetId, action) {
  if (!targetId || !['question', 'answer'].includes(targetType)) {
    return { ok: false, error: 'invalid_target' };
  }
  if (!['approve', 'reject', 'flag'].includes(action)) {
    return { ok: false, error: 'invalid_action' };
  }
  const { error } = await supabase.rpc('admin_qa_moderate', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_action: action,
  });
  if (error) {
    console.warn('[adminModerateQA]', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
