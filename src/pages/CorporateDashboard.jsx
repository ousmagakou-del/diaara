// ════════════════════════════════════════════════════════════════
// YARAM — CorporateDashboard
// URL : /corporate/dashboard
// ════════════════════════════════════════════════════════════════
//
// Dashboard entreprise pour un user rattache a un compte corporate
// approuve. KPI + factures + team + bouton nouvelle commande bulk.
// ════════════════════════════════════════════════════════════════

import { useEffect, useState, useMemo } from 'react';
import { useNav, useUser } from '../App';
import { supabase } from '../lib/supabase';
import SiteLayout from '../components/SiteLayout';
import { formatPrice } from '../lib/utils';
import { toast } from '../lib/toast';
import './PartnerApplication.css';
import './CorporateDashboard.css';

export default function CorporateDashboard() {
  const { navigate } = useNav();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: res, error } = await supabase.rpc('corporate_get_my_account');
      if (cancelled) return;
      if (error) {
        console.warn('[corporate] load error:', error?.message);
        setData({ success: false, error: error.message });
      } else {
        setData(res);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const account = data?.account;
  const invoices = data?.invoices || [];
  const users = data?.users || [];
  const balanceOwed = data?.balance_owed || 0;

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthInvoices = invoices.filter((i) => new Date(i.created_at) >= monthStart);
    const monthAmount = thisMonthInvoices.reduce((s, i) => s + Number(i.amount_fcfa || 0), 0);
    const pendingInv = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue');
    const paidInv = invoices.filter((i) => i.status === 'paid');
    return {
      ordersThisMonth: thisMonthInvoices.length,
      spentThisMonth: monthAmount,
      pendingCount: pendingInv.length,
      paidCount: paidInv.length,
    };
  }, [invoices]);

  const creditAvailable = account
    ? Math.max(0, (account.credit_limit_fcfa || 0) - balanceOwed)
    : 0;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const { data: res, error } = await supabase.rpc('corporate_invite_user', {
      p_email: inviteEmail.trim(),
      p_role: 'buyer',
    });
    setInviting(false);
    if (error || !res?.success) {
      toast.error('Erreur : ' + (res?.error || error?.message || 'inconnue'));
      return;
    }
    if (res.attached) {
      toast.success('Utilisateur ajoute au compte');
    } else {
      toast.success('Invitation enregistree — l utilisateur sera rattache a sa 1ere connexion');
    }
    setInviteEmail('');
    // reload
    const { data: refreshed } = await supabase.rpc('corporate_get_my_account');
    if (refreshed) setData(refreshed);
  };

  if (loading) {
    return (
      <SiteLayout>
        <div className="corp-loading">Chargement du compte pro…</div>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="corp-empty">
          <h2>Connexion requise</h2>
          <p>Connecte-toi avec le compte associe a ton entreprise.</p>
          <button className="pa-btn-primary" onClick={() => navigate('profile')}>Se connecter</button>
        </div>
      </SiteLayout>
    );
  }

  if (!account) {
    return (
      <SiteLayout>
        <div className="corp-empty">
          <h2>Aucun compte entreprise</h2>
          <p>Tu n as pas encore de compte YARAM Pro. Depose une candidature — reponse sous 48h.</p>
          <a className="pa-btn-primary" href="/corporate">Ouvrir un compte pro</a>
        </div>
      </SiteLayout>
    );
  }

  if (account.status === 'pending_approval') {
    return (
      <SiteLayout>
        <div className="corp-empty">
          <div className="corp-status-badge corp-status-badge--pending">En attente d approbation</div>
          <h2>{account.legal_name}</h2>
          <p>Ta candidature a bien ete recue. Notre equipe commerciale te contacte sous 48h ouvrees pour finaliser :</p>
          <ul className="corp-checklist">
            <li>Remise volume negociee</li>
            <li>Ligne de credit personnalisee</li>
            <li>Jour de livraison groupee</li>
            <li>Contrat signable en ligne</li>
          </ul>
          <a href="https://wa.me/221774388766" className="pa-btn-primary">Contacter le commercial</a>
        </div>
      </SiteLayout>
    );
  }

  if (account.status === 'suspended') {
    return (
      <SiteLayout>
        <div className="corp-empty">
          <div className="corp-status-badge corp-status-badge--suspended">Compte suspendu</div>
          <h2>{account.legal_name}</h2>
          <p>Ton compte est actuellement suspendu. Contacte l equipe pour resoudre.</p>
          <a href="mailto:pro@yaram.app" className="pa-btn-primary">pro@yaram.app</a>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="corp-dash">
        {/* Header */}
        <header className="corp-header">
          <div>
            <div className="corp-eyebrow">YARAM Pro</div>
            <h1>{account.legal_name}</h1>
            <div className="corp-header-sub">
              <span className="corp-status-badge corp-status-badge--active">Actif</span>
              <span>Remise {account.discount_pct}% · Paiement {account.payment_terms_days}j</span>
            </div>
          </div>
          <button className="pa-btn-primary" onClick={() => navigate('shop')}>Nouvelle commande bulk</button>
        </header>

        {/* KPIs */}
        <div className="corp-kpis">
          <KpiCard label="Commandes ce mois" value={stats.ordersThisMonth} />
          <KpiCard label="Budget consomme" value={`${formatPrice(stats.spentThisMonth)} FCFA`} />
          <KpiCard
            label="Credit disponible"
            value={`${formatPrice(creditAvailable)} FCFA`}
            sub={`sur ${formatPrice(account.credit_limit_fcfa || 0)} FCFA`}
            highlight
          />
          <KpiCard label="Factures en cours" value={stats.pendingCount} sub={`${stats.paidCount} payees`} />
        </div>

        {/* Factures */}
        <section className="corp-section">
          <div className="corp-section-head">
            <h2>Factures</h2>
            <div className="corp-section-hint">Paiement a {account.payment_terms_days} jours · Virement Wave ou bancaire</div>
          </div>
          {invoices.length === 0 ? (
            <div className="corp-empty-inline">Aucune facture pour l instant.</div>
          ) : (
            <div className="corp-table-wrap">
              <table className="corp-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Date</th>
                    <th>Echeance</th>
                    <th>Montant</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="mono">{inv.invoice_number}</td>
                      <td>{new Date(inv.created_at).toLocaleDateString('fr-FR')}</td>
                      <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="strong">{formatPrice(inv.amount_fcfa)} FCFA</td>
                      <td>
                        <InvoiceStatusBadge status={inv.status} dueDate={inv.due_date} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Team */}
        <section className="corp-section">
          <div className="corp-section-head">
            <h2>Team members</h2>
            <div className="corp-section-hint">{users.length} utilisateur{users.length > 1 ? 's' : ''} rattache{users.length > 1 ? 's' : ''}</div>
          </div>
          <div className="corp-team">
            {users.map((u) => (
              <div key={u.user_id} className="corp-team-row">
                <div className="corp-team-avatar" aria-hidden="true">{(u.invited_email || 'U')[0].toUpperCase()}</div>
                <div className="corp-team-body">
                  <div className="corp-team-email">{u.invited_email || u.user_id}</div>
                  <div className="corp-team-role">{u.role}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="corp-invite">
            <input
              type="email"
              placeholder="email@collaborateur.sn"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button className="pa-btn-primary" onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
              {inviting ? 'Ajout…' : 'Inviter'}
            </button>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}

function KpiCard({ label, value, sub, highlight }) {
  return (
    <div className={`corp-kpi ${highlight ? 'corp-kpi--brand' : ''}`}>
      <div className="corp-kpi-value">{value}</div>
      <div className="corp-kpi-label">{label}</div>
      {sub && <div className="corp-kpi-sub">{sub}</div>}
    </div>
  );
}

function InvoiceStatusBadge({ status, dueDate }) {
  let cls = 'corp-inv-badge';
  let label = status;
  if (status === 'paid') { cls += ' corp-inv-badge--paid'; label = 'Payee'; }
  else if (status === 'overdue') { cls += ' corp-inv-badge--overdue'; label = 'En retard'; }
  else if (status === 'pending') {
    const overdue = dueDate && new Date(dueDate) < new Date();
    if (overdue) { cls += ' corp-inv-badge--overdue'; label = 'En retard'; }
    else { cls += ' corp-inv-badge--pending'; label = 'En attente'; }
  } else if (status === 'cancelled') { cls += ' corp-inv-badge--cancelled'; label = 'Annulee'; }
  return <span className={cls}>{label}</span>;
}
