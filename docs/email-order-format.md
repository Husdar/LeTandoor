# Format des emails de commande (site web)

Le parser (`apps/backend/src/modules/email-orders/parser.ts`) gère deux gabarits
d'emails observés en production, envoyés par le site du restaurant (Hostinger,
expéditeur `noreply@store.hostinger.com` — a changé depuis la mise en place initiale,
qui utilisait `noreply@account.hostinger.com`).

Le filtre `ORDER_EMAIL_SUBJECT_PATTERN` est volontairement large (`commande`) car
l'objet varie selon le gabarit ci-dessous — un filtre trop strict fait passer des
commandes à la trappe silencieusement.

## Gabarit A — "Nouvelle commande #N"

```
<date>  |  <heure>
<Nom du restaurant> a reçu une nouvelle commande de <Nom client>.
Afficher la commande
Ordre #<numéro> résumé

<Nom du plat>
Comman(der|de): <À emporter|Emporter|Livraison>
<quantité> × €<prix unitaire>
€<total ligne>
... (répété par article)

Sous-total (N articles)	€<montant>
Livraison (<lieu>)	€<frais>
Total	€<montant>
Mode de paiement: <texte>
Informations client

<Nom client>
<ligne adresse 1 ou "X">
<ligne adresse 2 ou "X X">
<Pays>
<email>
<téléphone>

Méthode d'expédition :
<lieu de retrait>
```

## Gabarit B — "Votre commande a été expédiée"

Observé à partir de juillet 2026. Différences clés :
- Objet sans numéro (`Votre commande a été expédiée`) — le numéro n'est présent que
  dans le corps (`Ordre #<numéro> résumé`), utilisé comme repère de secours.
- **Pas de ligne `Comman(der|de): ...` par article.** Le type de commande n'est donc
  plus indiqué explicitement — voir déduction ci-dessous.
- Les trois totaux (`Sous-total`, `Livraison`, `Total`) peuvent se retrouver **sur
  une seule ligne concaténée** (artefact de conversion d'un tableau HTML en texte
  brut). Le parser ne s'ancre donc plus en début de ligne pour ces champs.
- Le bloc "Informations client" peut avoir son texte accolé à l'étiquette
  (`Informations client   Nom Client` sur une même ligne), et le téléphone peut être
  suivi immédiatement de `Méthode d'expédition :` sur la même ligne (même artefact
  de mise en page à deux colonnes). Le parser isole d'abord `Méthode d'expédition`
  du reste du bloc avant de traiter les lignes client une à une.
## Gabarit C — "Vous avez reçu une nouvelle commande" (créneau + offres groupées)

Variante la plus riche en informations : c'est la seule à contenir le **créneau
souhaité par le client** et le **délai de préparation minimum**, en pied de bloc
client :

```
Méthode d'expédition :
<lieu de retrait>

<plage 1> / <plage 2> • Délai minimum : <N> min • Livraison : <plage>
<créneau choisi, ex "19h" ou "19h30">
```

Extrait par `resolveRequestedTime()` → `Order.requestedFor` / `Order.prepMinutes`.

Cette variante peut aussi contenir des **articles en offre groupée** (ex. "1 acheté
= 1 offert"), avec un format de ligne différent du gabarit A :

```
- 1 Bowl acheté = 1 Bowl offert — 2x Poulet Curry
  3 x €15.50 = €46.50
```

Différences par rapport au format standard : préfixe promo + tiret cadratin (`—`)
avant le vrai nom du plat, quantité répétée dans le nom (`2x`, à ignorer — la
quantité qui compte est celle de la ligne prix, ici `3`), signe de multiplication en
minuscule (`x` et non `×`), et total sur la **même ligne** (`= €Y`) plutôt que sur
la ligne suivante. Le parser gère les deux formats (regex avec alternative
`\n€Y` / `= €Y`) et nettoie le nom du plat (suppression du préfixe promo et du
`Nx` initial). Un email de ce type a échoué silencieusement avant ce correctif
(voir `EmailIngestLog` du 2026-07-23, commande #2145) — à surveiller si Hostinger
introduit encore d'autres variantes de mise en forme des offres.

## Points d'attention communs

- **Détection du type de commande** : si une ligne `Comman(der|de): ...` est présente
  (gabarit A), elle fait foi. Sinon (gabarit B), le type est déduit de la présence
  d'une vraie adresse dans le bloc client — les commandes à emporter ont `X` / `X X`
  en guise d'adresse, une commande avec une adresse réelle est donc traitée comme
  livraison.
- Le parser vérifie que la somme des articles correspond au sous-total annoncé ; en
  cas d'écart, l'email est rejeté et journalisé dans `EmailIngestLog` (statut `ECHEC`)
  plutôt que de créer une commande avec un montant potentiellement faux.
- Les emails déjà traités (par `messageId` IMAP ou par numéro de commande
  `externalRef`) sont ignorés pour éviter les doublons en cas de re-scan de la boîte.
- La détection ne dépend plus du statut lu/non-lu IMAP (`\Seen`) — un email consulté
  depuis un téléphone avant le passage du serveur serait sinon ignoré à tort. La
  recherche porte sur une fenêtre de quelques jours, la déduplication ci-dessus
  empêchant tout doublon.
