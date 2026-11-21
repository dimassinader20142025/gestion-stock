import express from 'express';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.API_PORT ?? 3001);

app.use(express.json());

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1');
    response.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/stock/summary', async (_request, response, next) => {
  try {
    const result = await pool.query<{
      units_in_stock: string;
      low_stock_products: string;
      open_sav_cases: string;
      sales_today: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM unites_stock WHERE statut = 'EN_STOCK') AS units_in_stock,
        (
          SELECT COUNT(*)
          FROM (
            SELECT p.id
            FROM produits p
            LEFT JOIN unites_stock u
              ON u.produit_id = p.id AND u.statut = 'EN_STOCK'
            GROUP BY p.id, p.seuil_alerte
            HAVING COUNT(u.id) <= p.seuil_alerte
          ) AS low_stock
        ) AS low_stock_products,
        (
          SELECT COUNT(*)
          FROM dossiers_sav
          WHERE statut IN ('OUVERT', 'EN_REPARATION', 'PRET')
        ) AS open_sav_cases,
        (
          SELECT COALESCE(SUM(montant_total_ttc), 0)
          FROM factures
          WHERE date_facture >= CURRENT_DATE
            AND date_facture < CURRENT_DATE + INTERVAL '1 day'
        ) AS sales_today
    `);

    response.json({
      unitsInStock: Number(result.rows[0]?.units_in_stock ?? 0),
      lowStockProducts: Number(result.rows[0]?.low_stock_products ?? 0),
      openSavCases: Number(result.rows[0]?.open_sav_cases ?? 0),
      salesToday: Number(result.rows[0]?.sales_today ?? 0)
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (_request, response, next) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.reference_modele AS "referenceModele",
        p.marque,
        p.categorie,
        p.designation,
        p.prix_vente_ttc AS "prixVenteTtc",
        p.seuil_alerte AS "seuilAlerte",
        COUNT(u.id)::integer AS "quantiteEnStock"
      FROM produits p
      LEFT JOIN unites_stock u
        ON u.produit_id = p.id AND u.statut = 'EN_STOCK'
      GROUP BY p.id
      ORDER BY p.designation
    `);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post('/api/products', async (request, response, next) => {
  const {
    referenceModele,
    marque,
    categorie,
    designation,
    prixAchatHt,
    prixVenteTtc,
    dureeGarantieMois,
    seuilAlerte
  } = request.body ?? {};

  const requiredText = [referenceModele, marque, designation];
  if (!requiredText.every((value) => typeof value === 'string' && value.trim().length > 0)) {
    response.status(400).json({ error: 'La référence, la marque et la désignation sont obligatoires.' });
    return;
  }

  const salePrice = Number(prixVenteTtc);
  const purchasePrice = prixAchatHt === '' || prixAchatHt == null ? null : Number(prixAchatHt);
  const warrantyMonths = Number(dureeGarantieMois ?? 12);
  const alertThreshold = Number(seuilAlerte ?? 5);
  if (!Number.isFinite(salePrice) || salePrice < 0 ||
      (purchasePrice !== null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) ||
      !Number.isInteger(warrantyMonths) || warrantyMonths < 0 ||
      !Number.isInteger(alertThreshold) || alertThreshold < 0) {
    response.status(400).json({ error: 'Vérifiez les prix et les seuils : ils doivent être des nombres positifs ou nuls.' });
    return;
  }

  try {
    const result = await pool.query(`
      INSERT INTO produits (
        reference_modele, marque, categorie, designation,
        prix_achat_ht, prix_vente_ttc, duree_garantie_mois, seuil_alerte
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        reference_modele AS "referenceModele",
        marque,
        categorie,
        designation,
        prix_vente_ttc AS "prixVenteTtc",
        seuil_alerte AS "seuilAlerte"
    `, [
      referenceModele.trim(), marque.trim(),
      typeof categorie === 'string' && categorie.trim() ? categorie.trim() : null,
      designation.trim(), purchasePrice, salePrice, warrantyMonths, alertThreshold
    ]);
    response.status(201).json({ ...result.rows[0], quantiteEnStock: 0 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({ error: 'Cette référence produit existe déjà.' });
      return;
    }
    next(error);
  }
});

app.get('/api/stock/units', async (_request, response, next) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.numero_serie AS "numeroSerie", u.statut,
        p.designation, p.reference_modele AS "referenceModele", e.nom AS entrepot
      FROM unites_stock u
      JOIN produits p ON p.id = u.produit_id
      JOIN entrepots e ON e.id = u.entrepot_id
      ORDER BY p.designation, u.numero_serie
    `);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/sales', async (_request, response, next) => {
  try {
    const result = await pool.query(`
      SELECT id, numero_facture AS "numeroFacture", client_nom AS "clientNom",
        montant_total_ttc AS "montantTotalTtc", statut_paiement AS "statutPaiement", date_facture AS "dateFacture"
      FROM factures
      ORDER BY date_facture DESC
      LIMIT 100
    `);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get('/api/sav', async (_request, response, next) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.description_panne AS "descriptionPanne", d.statut,
        d.sous_garantie AS "sousGarantie", d.date_ouverture AS "dateOuverture",
        p.designation, u.numero_serie AS "numeroSerie"
      FROM dossiers_sav d
      JOIN unites_stock u ON u.id = d.unite_stock_id
      JOIN produits p ON p.id = u.produit_id
      ORDER BY d.date_ouverture DESC
      LIMIT 100
    `);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error('API request failed:', error);
  response.status(500).json({ error: 'Une erreur serveur est survenue.' });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

const shutdown = (): void => {
  server.close(() => {
    void pool.end();
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
