import { useState, useEffect } from 'react';
import { adminListUsers, adminListUserOrders, adminUsersStats } from '../lib/adminApi';

const PAGE_SIZE = 50;

export default function UsersSection() {
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [diagnostiquedCount, setDiagnostiquedCount] = useState(0);

  // Debounce simple sur la recherche : 350ms apres la derniere frappe
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Re-fetch quand on change de page ou de recherche — via RPC admin_list_users
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, count, error } = await adminListUsers({
          limit:  PAGE_SIZE,
          offset: page * PAGE_SIZE,
          search: debouncedSearch.trim() || null,
        });
        if (cancelled) return;
        if (error) console.error('Users fetch error:', error);
        setUsers(data || []);
        setTotalCount(count || 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, debouncedSearch]);

  // Reset page a 0 quand on change le terme de recherche
  useEffect(() => { setPage(0); }, [debouncedSearch]);

  // Stats globales : nb diagnostiques (independant de la page) — via RPC
  useEffect(() => {
    (async () => {
      const { data } = await adminUsersStats();
      if (data) setDiagnostiquedCount(data.diagnosed || 0);
    })();
  }, []);

  const selectUser = async (u) => {
    setSelected(u);
    const { data } = await adminListUserOrders(u.id);
    setUserOrders(data || []);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (selected) {
    return <UserDetail user={selected} orders={userOrders} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <h1>Utilisatrices</h1>
          <p>
            {totalCount} cliente{totalCount > 1 ? 's' : ''} · {diagnostiquedCount} diagnostic{diagnostiquedCount > 1 ? 's' : ''} complété{diagnostiquedCount > 1 ? 's' : ''}
            {totalPages > 1 && ` · page ${page + 1}/${totalPages}`}
          </p>
        </div>
      </header>

      <input
        type="text"
        className="adm-search-input"
        placeholder="🔍 Rechercher par nom, email, téléphone..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="adm-empty">Chargement…</div>
      ) : users.length === 0 ? (
        <div className="adm-empty">
          <div style={{ fontSize: 48, opacity: 0.2 }}>👥</div>
          <p>{debouncedSearch ? `Aucune cliente ne correspond à "${debouncedSearch}"` : 'Aucune cliente inscrite'}</p>
        </div>
      ) : (
        <>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Localisation</th>
                <th>Profil peau</th>
                <th>Inscrite le</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} onClick={() => selectUser(u)} style={{ cursor: 'pointer' }}>
                  <td><strong>{u.first_name} {u.last_name}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{u.neighborhood ? `${u.neighborhood}, ` : ''}{u.city || '—'}</td>
                  <td>
                    {u.skin_type
                      ? <span className="adm-badge good">{u.skin_type} {u.skin_phototype}</span>
                      : <span className="adm-badge medium">À compléter</span>}
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 8px',
              marginTop: 8,
              borderTop: '1px solid #EEE',
              fontSize: 12,
            }}>
              <button
                className="adm-btn-sec"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                style={{ minWidth: 100 }}
              >← Précédent</button>
              <span style={{ color: '#6B6B6B', fontWeight: 600 }}>
                Page {page + 1} / {totalPages}
              </span>
              <button
                className="adm-btn-sec"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
                style={{ minWidth: 100 }}
              >Suivant →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function UserDetail({ user, orders, onBack }) {
  const totalSpent = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + (o.total || 0), 0);
  const waUrl = user.phone ? 'https://wa.me/' + user.phone.replace(/\D/g, '') : null;

  return (
    <div className="adm-section">
      <header className="adm-header">
        <div>
          <button className="adm-link" onClick={onBack}>← Retour</button>
          <h1>{user.first_name} {user.last_name}</h1>
          <p>Inscrite le {new Date(user.created_at).toLocaleDateString('fr-FR')}</p>
        </div>
        {waUrl && (
          <a className="adm-wa-btn" href={waUrl} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
        )}
      </header>

      <div className="adm-kpi-grid">
        <div className="adm-kpi">
          <div className="adm-kpi-label">DÉPENSÉ</div>
          <div className="adm-kpi-value" style={{ color: '#1F8B4C' }}>
            {totalSpent.toLocaleString('fr-FR')}<small>FCFA</small>
          </div>
          <div className="adm-kpi-meta">{orders.filter(o => o.status === 'delivered').length} commandes livrées</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">COMMANDES</div>
          <div className="adm-kpi-value">{orders.length}</div>
          <div className="adm-kpi-meta">au total</div>
        </div>
        <div className="adm-kpi">
          <div className="adm-kpi-label">PROFIL PEAU</div>
          <div className="adm-kpi-value" style={{ fontSize: 18 }}>{user.skin_type || 'À compléter'}</div>
          <div className="adm-kpi-meta">Phototype {user.skin_phototype || '?'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div className="adm-recent-card">
          <h3>📋 Informations</h3>
          <p style={{ fontSize: 13, padding: '4px 0' }}>📧 {user.email}</p>
          <p style={{ fontSize: 13, padding: '4px 0' }}>📞 {user.phone || '—'}</p>
          <p style={{ fontSize: 13, padding: '4px 0' }}>📍 {user.neighborhood ? `${user.neighborhood}, ` : ''}{user.city || '—'}</p>
          <p style={{ fontSize: 13, padding: '4px 0' }}>👤 {user.skin_type} · Phototype {user.skin_phototype}</p>
          {user.skin_concerns?.length > 0 && (
            <p style={{ fontSize: 13, padding: '4px 0' }}>💧 {user.skin_concerns.join(', ')}</p>
          )}
          {user.budget && <p style={{ fontSize: 13, padding: '4px 0' }}>💰 Budget : {user.budget}</p>}
        </div>

        <div className="adm-recent-card">
          <h3>📦 Historique commandes</h3>
          {orders.length === 0 ? (
            <div className="adm-empty" style={{ padding: 20 }}>Aucune commande</div>
          ) : (
            <table className="adm-table">
              <thead><tr><th>Commande</th><th>Date</th><th>Total</th><th>Statut</th></tr></thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td><code>{o.id}</code></td>
                    <td>{new Date(o.created_at).toLocaleDateString('fr-FR')}</td>
                    <td>{o.total?.toLocaleString('fr-FR')} FCFA</td>
                    <td><span className="adm-badge good">{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
