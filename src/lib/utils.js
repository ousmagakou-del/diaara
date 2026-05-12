export function scoreClass(score) {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'medium';
  if (score >= 30) return 'poor';
  return 'bad';
}

export function formatPrice(price) {
  return (price || 0).toLocaleString('fr-FR');
}

export function getShippingZone(city = '', country = '') {
  const c = (city || '').toLowerCase();
  const co = (country || '').toLowerCase();
  if (co && !co.includes('sénégal') && !co.includes('senegal') && co !== '') {
    return { zone: 'Hors Sénégal', delay: 'Bientôt', price: 0, freeFrom: 0, available: false };
  }
  if (c.includes('dakar')) return { zone: 'Dakar', delay: '24h', price: 1500, freeFrom: 30000 };
  if (c.includes('thiès') || c.includes('thies') || c.includes('mbour') || c.includes('saly')) return { zone: 'Thiès / Mbour', delay: '48h', price: 2500, freeFrom: 30000 };
  if (c.includes('saint-louis') || c.includes('kaolack')) return { zone: 'Saint-Louis / Kaolack', delay: '48-72h', price: 3000, freeFrom: 40000 };
  return { zone: 'Reste du Sénégal', delay: '72h', price: 3500, freeFrom: 50000 };
}