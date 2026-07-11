// ════════════════════════════════════════════════════════════════════
// ReviewCard — carte avis premium (avatar, note, date, texte, actions)
// ════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import './ReviewCard.css';

const IcoStar = ({ filled = true, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const IcoThumbUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-6 0v4H4l1 11h11l1-6"/>
    <path d="M20 9h-6"/>
  </svg>
);

const IcoThumbDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 15v4a3 3 0 0 0 6 0v-4h4l-1-11H8L7 10"/>
    <path d="M4 15h6"/>
  </svg>
);

const IcoVerify = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l2.4 4.8L20 8l-4 3.9.9 5.6L12 15l-4.9 2.6L8 11.9 4 8l5.6-1.2z"/>
  </svg>
);

const timeAgo = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "a l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function ReviewCard({ review, onHelpful, onPhotoClick }) {
  const [voted, setVoted] = useState(null); // 'up' | 'down' | null
  const [helpfulCount, setHelpfulCount] = useState(Number(review?.helpful_count) || 0);

  const rating = Math.max(1, Math.min(5, Math.round(Number(review?.rating) || 0)));
  const name = review?.author_name || review?.user_name || 'Anonyme';
  const photos = Array.isArray(review?.photos) ? review.photos : [];

  const handleVote = (type) => {
    if (voted === type) return;
    if (voted === null) {
      setHelpfulCount((c) => c + (type === 'up' ? 1 : 0));
    } else if (voted === 'up' && type === 'down') {
      setHelpfulCount((c) => Math.max(0, c - 1));
    } else if (voted === 'down' && type === 'up') {
      setHelpfulCount((c) => c + 1);
    }
    setVoted(type);
    onHelpful?.(review?.id, type);
  };

  return (
    <article className="rev-card">
      <header className="rev-card-head">
        <div className="rev-card-author">
          <div className="rev-card-avatar" aria-hidden>
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="rev-card-meta">
            <div className="rev-card-name">
              {name}
              {review?.verified_purchase && (
                <span className="rev-card-verify" title="Achat verifie">
                  <IcoVerify /> Achat verifie
                </span>
              )}
            </div>
            <div className="rev-card-sub">
              <div className="rev-card-stars" aria-label={`Note ${rating} sur 5`}>
                {[1,2,3,4,5].map((i) => (
                  <span key={i} className={i <= rating ? 'rev-star on' : 'rev-star'}>
                    <IcoStar size={14} filled={i <= rating} />
                  </span>
                ))}
              </div>
              <span className="rev-card-date">{timeAgo(review?.created_at)}</span>
            </div>
          </div>
        </div>
      </header>

      {review?.title && <h4 className="rev-card-title">{review.title}</h4>}
      {review?.comment && <p className="rev-card-comment">{review.comment}</p>}

      {photos.length > 0 && (
        <div className="rev-card-photos">
          {photos.slice(0, 4).map((src, i) => (
            <button
              key={i}
              type="button"
              className="rev-card-photo"
              onClick={() => onPhotoClick?.(photos, i)}
              aria-label={`Voir photo ${i + 1} de l'avis`}
            >
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <footer className="rev-card-actions">
        <span className="rev-card-helpful-label">Cet avis vous a-t-il ete utile ?</span>
        <div className="rev-card-vote-group">
          <button
            type="button"
            className={`rev-vote ${voted === 'up' ? 'is-active' : ''}`}
            onClick={() => handleVote('up')}
            aria-label="Utile"
          >
            <IcoThumbUp />
            <span>{helpfulCount > 0 ? helpfulCount : 'Oui'}</span>
          </button>
          <button
            type="button"
            className={`rev-vote ${voted === 'down' ? 'is-active' : ''}`}
            onClick={() => handleVote('down')}
            aria-label="Pas utile"
          >
            <IcoThumbDown />
            <span>Non</span>
          </button>
        </div>
      </footer>
    </article>
  );
}
