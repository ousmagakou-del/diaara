import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './client';
import { getAllProducts } from './products';

// ═══════════════════════════════════════════════
// SCAN IA
// ═══════════════════════════════════════════════

export async function analyzeSkinPhotos({ frontBase64, leftBase64, rightBase64 }) {
  try {
    // ─── JWT user si dispo pour que l'edge function injecte le health_profile ───
    // Sinon on tombe sur l'anon key (permet un scan sans compte connecte).
    let bearer = SUPABASE_ANON_KEY;
    let userId = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        bearer = session.access_token;
        userId = session.user?.id || null;
      }
    } catch { /* fallback anon */ }

    // ─── Recupere birth_date + allergies depuis users_profile pour enrichir la requete ───
    // realAge = year(now) - year(birth_date). quick_allergies = array.
    let realAge = null;
    let quickAllergies = [];
    if (userId) {
      try {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('birth_date, allergies')
          .eq('id', userId)
          .maybeSingle();
        if (profile?.birth_date) {
          const y = new Date(profile.birth_date).getFullYear();
          if (!Number.isNaN(y)) {
            const age = new Date().getFullYear() - y;
            if (age > 0 && age < 130) realAge = age;
          }
        }
        // allergies peut etre stocke en TEXT (SkinQuiz) ou array (health_profile).
        // On normalise en array de strings non vides.
        const raw = profile?.allergies;
        if (Array.isArray(raw)) {
          quickAllergies = raw.filter(x => typeof x === 'string' && x.trim());
        } else if (typeof raw === 'string' && raw.trim()) {
          quickAllergies = raw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
        }
      } catch (e) {
        console.warn('[analyzeSkinPhotos] users_profile read failed:', e?.message);
      }
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-skin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearer}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        photos: { front: frontBase64, left: leftBase64, right: rightBase64 },
        realAge,
        quick_allergies: quickAllergies,
      }),
    });
    return await response.json();
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function uploadScanPhoto(file, scanId, type) {
  const fileName = `${scanId}/${type}_${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('skin-scans').upload(fileName, file, {
    contentType: 'image/jpeg', upsert: true
  });
  if (error) return null;
  // Vague D : bucket prive, on garde le format URL "publique" pour back-compat DB
  // mais l'affichage passera par getSignedStorageUrl() pour generer une URL signee.
  const { data } = supabase.storage.from('skin-scans').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function saveSkinScan({ userId, photoFrontUrl, photoLeftUrl, photoRightUrl, analysis }) {
  const { data, error } = await supabase.from('skin_scans').insert({
    user_id: userId,
    photo_front_url: photoFrontUrl, photo_left_url: photoLeftUrl, photo_right_url: photoRightUrl,
    skin_type: analysis.skin_type, skin_score: analysis.skin_score, diagnosis: analysis,
  }).select().single();
  if (error) return null;
  return data;
}

export async function getMySkinScans() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];
  // PERF : limit 100 + colonnes nécessaires uniquement (le diagnostic JSON peut être lourd)
  const { data } = await supabase.from('skin_scans')
    .select('id, skin_type, skin_score, diagnosis, photo_front_url, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  return data || [];
}

export async function getLatestSkinScan() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase.from('skin_scans').select('*')
    .eq('user_id', session.user.id).order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  return data;
}

export async function getProductsForSkinDiagnosis(diagnosis) {
  const allProducts = await getAllProducts();
  const recommendedIngredients = (diagnosis.ingredients_recommandes || []).map(i => String(i || '').toLowerCase());
  const avoidIngredients = (diagnosis.ingredients_a_eviter || []).map(i => String(i || '').toLowerCase());
  const compatibles = [], avoid = [];
  for (const product of allProducts) {
    const productText = `${product.name || ''} ${product.description || ''} ${product.ingredients || ''}`.toLowerCase();
    if (avoidIngredients.some(ing => productText.includes(ing))) {
      avoid.push(product); continue;
    }
    if (recommendedIngredients.some(ing => productText.includes(ing))) {
      compatibles.push(product);
    }
  }
  return { compatibles, avoid };
}
