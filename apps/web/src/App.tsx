import { useCallback, useEffect, useState, type FormEvent } from 'react';

type Summary = {
  unitsInStock: number;
  lowStockProducts: number;
  openSavCases: number;
  salesToday: number;
};

type Product = {
  id: number;
  referenceModele: string;
  marque: string;
  categorie: string | null;
  designation: string;
  prixVenteTtc: string;
  seuilAlerte: number;
  quantiteEnStock: number;
};

type SectionData = Record<string, unknown>[];

const emptySummary: Summary = {
  unitsInStock: 0,
  lowStockProducts: 0,
  openSavCases: 0,
  salesToday: 0
};

const sectionInfo: Record<string, { title: string; description: string; endpoint: string }> = {
  stock: { title: 'Stock', description: 'Unités sérialisées et entrepôts', endpoint: '/api/stock/units' },
  sales: { title: 'Ventes', description: 'Factures et paiements', endpoint: '/api/sales' },
  sav: { title: 'Service après-vente', description: 'Dossiers SAV et réparations', endpoint: '/api/sav' }
};

function formatPrice(value: string | number): string {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency',
    currency: 'TND',
    maximumFractionDigits: 3
  }).format(Number(value));
}

function getErrorMessage(value: unknown): string {
  return value instanceof Error ? value.message : 'Une erreur est survenue.';
}

export default function App() {
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [products, setProducts] = useState<Product[]>([]);
  const [sectionRows, setSectionRows] = useState<SectionData>([]);
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDashboard = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResponse, productsResponse] = await Promise.all([
        fetch('/api/stock/summary'),
        fetch('/api/products')
      ]);
      if (!summaryResponse.ok || !productsResponse.ok) {
        throw new Error('Impossible de charger les données du tableau de bord.');
      }
      const [summaryData, productsData] = await Promise.all([
        summaryResponse.json() as Promise<Summary>,
        productsResponse.json() as Promise<Product[]>
      ]);
      setSummary(summaryData);
      setProducts(productsData);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onHashChange = (): void => {
      const section = window.location.hash.replace('#', '');
      if (['overview', 'products', 'stock', 'sales', 'sav'].includes(section)) setActiveSection(section);
    };
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (activeSection === 'overview' || activeSection === 'products') return;
    const section = sectionInfo[activeSection];
    if (!section) return;
    let cancelled = false;
    setSectionLoading(true);
    setError(null);
    fetch(section.endpoint)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Impossible de charger « ${section.title} ».`);
        return response.json() as Promise<SectionData>;
      })
      .then((rows) => { if (!cancelled) setSectionRows(rows); })
      .catch((loadError: unknown) => { if (!cancelled) setError(getErrorMessage(loadError)); })
      .finally(() => { if (!cancelled) setSectionLoading(false); });
    return () => { cancelled = true; };
  }, [activeSection, refreshKey]);

  const navigate = (section: string): void => {
    setActiveSection(section);
    setError(null);
    setNotification(null);
    window.history.replaceState(null, '', section === 'overview' ? '#overview' : `#${section}`);
  };

  const addProduct = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSavingProduct(true);
    setError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json() as Product & { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’ajouter le produit.');
      setProducts((current) => [...current, result].sort((a, b) => a.designation.localeCompare(b.designation)));
      setModalOpen(false);
      setNotification('Produit ajouté au catalogue.');
      formElement.reset();
      void loadDashboard();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSavingProduct(false);
    }
  };

  const pageTitle = activeSection === 'overview' ? 'Vue d’ensemble' : activeSection === 'products' ? 'Produits' : sectionInfo[activeSection]?.title ?? 'Vue d’ensemble';

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); navigate('overview'); }} aria-label="StockPilot accueil">
          <span className="brand-mark">S</span><span>StockPilot</span>
        </a>
        <p className="nav-caption">ESPACE DE GESTION</p>
        <nav aria-label="Navigation principale">
          <a className={`nav-link ${activeSection === 'overview' ? 'active' : ''}`} href="#overview" onClick={(event) => { event.preventDefault(); navigate('overview'); }}><span>▦</span> Vue d’ensemble</a>
          <a className={`nav-link ${activeSection === 'products' ? 'active' : ''}`} href="#products" onClick={(event) => { event.preventDefault(); navigate('products'); }}><span>▤</span> Produits</a>
          <a className={`nav-link ${activeSection === 'stock' ? 'active' : ''}`} href="#stock" onClick={(event) => { event.preventDefault(); navigate('stock'); }}><span>▣</span> Stock</a>
          <a className={`nav-link ${activeSection === 'sales' ? 'active' : ''}`} href="#sales" onClick={(event) => { event.preventDefault(); navigate('sales'); }}><span>↗</span> Ventes</a>
          <a className={`nav-link ${activeSection === 'sav' ? 'active' : ''}`} href="#sav" onClick={(event) => { event.preventDefault(); navigate('sav'); }}><span>⌁</span> Service après-vente</a>
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">AD</span>
          <span><strong>Administrateur</strong><small>Gestionnaire</small></span>
          <span className="more">···</span>
        </div>
      </aside>

      <section className="main-panel" id="main-content">
        <header className="topbar">
          <div className="breadcrumb">Accueil <span>/</span> {pageTitle}</div>
          <div className="topbar-right">
            <span className="today">{new Intl.DateTimeFormat('fr-TN', { dateStyle: 'full' }).format(new Date())}</span>
            <button className="icon-button" aria-label="Actualiser les données" onClick={() => { setRefreshKey((key) => key + 1); void loadDashboard(); }}><span aria-hidden="true">⟳</span></button>
            <span className="top-avatar">AD</span>
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div><p className="eyebrow">{activeSection === 'overview' ? 'TABLEAU DE BORD' : 'ESPACE DE GESTION'}</p><h1>{pageTitle}</h1><p className="subtitle">{activeSection === 'overview' ? 'Voici l’état de votre activité aujourd’hui.' : sectionInfo[activeSection]?.description ?? 'Consultez et gérez vos produits.'}</p></div>
            <button className="primary-button" onClick={() => { setError(null); setModalOpen(true); }}><span>＋</span> Ajouter un produit</button>
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}
          {notification && <div className="success-banner" role="status">{notification}<button aria-label="Fermer la notification" onClick={() => setNotification(null)}>×</button></div>}

          {(activeSection === 'overview' || activeSection === 'products') ? <>
            {activeSection === 'overview' && <section className="metrics" aria-label="Indicateurs de stock">
              <article className="metric-card"><div className="metric-top"><span className="metric-icon blue">▣</span><span className="metric-label">Unités en stock</span></div><div className="metric-value">{loading ? '—' : summary.unitsInStock.toLocaleString('fr-TN')}</div><div className="metric-note">Tous entrepôts confondus</div></article>
              <article className="metric-card"><div className="metric-top"><span className="metric-icon orange">⚑</span><span className="metric-label">Alertes de stock</span></div><div className="metric-value">{loading ? '—' : summary.lowStockProducts.toLocaleString('fr-TN')}</div><div className="metric-note">Produits au seuil ou en dessous</div></article>
              <article className="metric-card"><div className="metric-top"><span className="metric-icon violet">⌁</span><span className="metric-label">Dossiers SAV ouverts</span></div><div className="metric-value">{loading ? '—' : summary.openSavCases.toLocaleString('fr-TN')}</div><div className="metric-note">À traiter ou en réparation</div></article>
              <article className="metric-card"><div className="metric-top"><span className="metric-icon green">↗</span><span className="metric-label">Ventes du jour</span></div><div className="metric-value">{loading ? '—' : formatPrice(summary.salesToday)}</div><div className="metric-note">Total des factures du jour</div></article>
            </section>}

            <section className="panel" id="products-panel">
              <div className="panel-heading"><div><h2>{activeSection === 'overview' ? 'État du catalogue' : 'Catalogue des produits'}</h2><p>Produits enregistrés et disponibilité immédiate</p></div><button className="secondary-button" onClick={() => navigate('products')}>Voir le catalogue <span>→</span></button></div>
              <div className="table-wrap"><table>
                <thead><tr><th>PRODUIT</th><th>RÉFÉRENCE</th><th>CATÉGORIE</th><th>PRIX DE VENTE</th><th>DISPONIBILITÉ</th></tr></thead>
                <tbody>
                  {loading && <tr><td className="table-message" colSpan={5}>Chargement du catalogue…</td></tr>}
                  {!loading && products.length === 0 && <tr><td className="table-message" colSpan={5}>Aucun produit enregistré pour le moment.</td></tr>}
                  {!loading && products.map((product) => {
                    const lowStock = product.quantiteEnStock <= product.seuilAlerte;
                    return <tr key={product.id}><td><div className="product-cell"><span className="product-icon">▤</span><span><strong>{product.designation}</strong><small>{product.marque}</small></span></div></td><td className="reference">{product.referenceModele}</td><td>{product.categorie ?? '—'}</td><td className="price">{formatPrice(product.prixVenteTtc)}</td><td><span className={`stock-badge ${lowStock ? 'low' : 'available'}`}><i />{product.quantiteEnStock} {product.quantiteEnStock === 1 ? 'unité' : 'unités'}</span></td></tr>;
                  })}
                </tbody>
              </table></div>
              <div className="panel-footer"><span>{loading ? 'Chargement…' : `${products.length} produit${products.length === 1 ? '' : 's'} affiché${products.length === 1 ? '' : 's'}`}</span><span className="footer-note"><i /> Données synchronisées avec PostgreSQL</span></div>
            </section>
          </> : <section className="panel">
            <div className="panel-heading"><div><h2>{pageTitle}</h2><p>{sectionInfo[activeSection]?.description}</p></div></div>
            <div className="table-wrap"><table><thead><tr>{sectionRows[0] ? Object.keys(sectionRows[0]).map((key) => <th key={key}>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).toUpperCase()}</th>) : <th>INFORMATIONS</th>}</tr></thead>
              <tbody>{sectionLoading && <tr><td className="table-message">Chargement…</td></tr>}{!sectionLoading && sectionRows.length === 0 && <tr><td className="table-message">Aucun élément enregistré pour le moment.</td></tr>}{!sectionLoading && sectionRows.map((row, index) => <tr key={String(row.id ?? index)}>{Object.values(row).map((value, cell) => <td key={cell}>{String(value ?? '—')}</td>)}</tr>)}</tbody>
            </table></div><div className="panel-footer"><span>{sectionRows.length} élément{sectionRows.length === 1 ? '' : 's'}</span><span className="footer-note"><i /> Données synchronisées avec PostgreSQL</span></div>
          </section>}
          <footer className="page-footer">StockPilot <span>·</span> Gestion de stock simplifiée</footer>
        </div>
      </section>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
        <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
          <div className="modal-heading"><div><p className="eyebrow">CATALOGUE</p><h2 id="product-modal-title">Ajouter un produit</h2></div><button className="modal-close" aria-label="Fermer" onClick={() => setModalOpen(false)}>×</button></div>
          <form onSubmit={(event) => { void addProduct(event); }}>
            <div className="form-grid">
              <label>Référence modèle *<input name="referenceModele" maxLength={100} required autoFocus /></label>
              <label>Marque *<input name="marque" maxLength={100} required /></label>
              <label className="form-wide">Désignation *<input name="designation" maxLength={255} required /></label>
              <label>Catégorie<input name="categorie" maxLength={100} /></label>
              <label>Prix de vente TTC (TND) *<input name="prixVenteTtc" type="number" min="0" step="0.001" required /></label>
              <label>Prix d’achat HT (TND)<input name="prixAchatHt" type="number" min="0" step="0.001" /></label>
              <label>Seuil d’alerte<input name="seuilAlerte" type="number" min="0" step="1" defaultValue="5" /></label>
              <label>Garantie (mois)<input name="dureeGarantieMois" type="number" min="0" step="1" defaultValue="12" /></label>
            </div>
            <p className="form-hint">Le produit est ajouté au catalogue. Les unités de stock peuvent être enregistrées séparément.</p>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Annuler</button><button type="submit" className="primary-button" disabled={savingProduct}>{savingProduct ? 'Enregistrement…' : 'Enregistrer le produit'}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
