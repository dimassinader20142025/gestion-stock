# Gestion de stock — électroménager

Socle initial d'une application de gestion de stock unitaire par numéro de série,
avec une API Node.js/Express, PostgreSQL et une interface React/TypeScript.

## Prérequis

- Node.js 20+
- Docker Desktop (pour PostgreSQL local)
- npm 10+

## Démarrage local

1. Démarrer la base de données avec `docker compose up -d`.
   Le schéma est appliqué automatiquement lors de sa première initialisation.
2. Copier `.env.example` vers `.env` si ce n'est pas déjà fait.
3. Installer les dépendances avec `npm install`.
4. Lancer l'API et l'interface avec `npm run dev`.

La base de développement n'écoute que sur `localhost`. Pour l'arrêter, exécuter
`docker compose down` (les données persistent dans le volume Docker).

L'interface est servie par Vite et l'API écoute sur le port 3001 par défaut.
Les appels `/api` de l'interface sont relayés vers l'API.

## Fonctionnalités présentes

- Tableau de bord : unités en stock, produits sous le seuil d'alerte et dossiers SAV ouverts.
- Liste du catalogue avec le nombre d'unités disponibles.
- API de lecture pour le résumé et le catalogue.
- Schéma initial pour les entrepôts, produits, unités sérialisées, factures,
  paiements et dossiers SAV.

## Prochaines étapes métier

- Ajouter les opérations transactionnelles de réception, transfert et vente, en
  mettant à jour l'unité et son historique dans la même transaction.
- Ajouter l'authentification, les rôles et la traçabilité des opérations.
- Définir les règles de retour/annulation et l'historique des mouvements.
- Ajouter les formulaires de gestion et des tests d'intégration PostgreSQL.

Les montants sont stockés avec trois décimales pour convenir au TND. La devise
et l'affichage devront rester cohérents dans les écrans et les exports.
