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

**Rattachement au bon menu (`promoLabel`)** : le nom nettoyé (`Poulet Curry`) est identique à
celui d'un plat à la carte homonyme s'il en existe un — le matcher (`matcher.ts`) les confondait
donc avant ce correctif (vu sur une commande "Poulet Tikka Massala" du 2026-07-26, attribuée à
tort au plat à la carte "Poulet Tikka Masala" à 12€ au lieu de l'offre "Bowl" à 15,50€). Le
parser extrait maintenant le nom du produit promotionnel lui-même (`Bowl`, capturé depuis le
texte avant le tiret via `^\d+\s+(.+?)\s+achet[ée]`) dans `item.promoLabel`, et `ingest.ts`
rattache l'article à ce produit en priorité plutôt qu'à la saveur — à condition qu'un menu_item
nommé en conséquence (ex: "Bowl") existe bien en base (voir Administration → Menu).

## Variante : mode de retrait par article après le nom du plat

Une variante du Gabarit C ajoute le mode de retrait **après** le nom de chaque plat plutôt que
sur une ligne "Commander:" séparée :

```
- Poisson Kashmiri — À emporter
  1 x €12.00 = €12.00
```

À ne pas confondre avec le format "offre groupée" du Gabarit C, où le tiret cadratin a le sens
inverse (le vrai nom du plat suit le tiret, précédé d'un texte promo `1 acheté = 1 offert —`).
Le parser distingue les deux en testant si le texte après le tiret correspond à un mode de
retrait connu (`à emporter`, `livraison`, `sur place`) — si oui, c'est le nom AVANT le tiret qui
est le vrai plat.

**⚠️ Ce suffixe par article n'est PAS fiable pour déterminer le type de commande** — vu sur la
commande #2164 du 2026-07-25 (CHEREAU CHRISTOPHE) : chaque article portait `— À emporter`, alors
que la commande était une vraie livraison (`Méthode d'expédition: Livraison hors lorient`,
adresse réelle, frais de livraison de 5€). La commande avait été créée en base avec `type =
EMPORTER`, sans adresse ni heure de retrait — corrigée manuellement en production après coup.
Le parser capture donc ce suffixe séparément (`dashFulfillmentLabel`) et ne l'utilise qu'en
dernier recours, après `Méthode d'expédition` (voir "Détection du type de commande" ci-dessous).

## Fuseau horaire du créneau souhaité

`resolveRequestedTime()` calcule l'horaire choisi par le client **en heure de Paris**, quel que
soit le fuseau horaire du serveur qui exécute le code. C'est nécessaire car le serveur de
production (Render) tourne en UTC, contrairement à un poste de développement local souvent réglé
sur Europe/Paris — un simple `Date.setHours()` (qui utilise le fuseau du serveur) décalait donc
l'horaire de 2h une fois déployé, sans que ça se voie en local.

## Dérive du gabarit C — vue sur la commande #2201 du 2026-08-08

Hostinger a de nouveau fait évoluer ce gabarit, en silence — l'ingestion s'est mise à échouer
(`EmailIngestLog` en `ECHEC`) pour toute nouvelle commande jusqu'à ce correctif. Différences par
rapport au gabarit C original ci-dessus :
- **Objet sans AUCUN numéro** (`Vous avez reçu une nouvelle commande`) — jusque-là seul le gabarit
  B perdait le numéro dans l'objet, mais gardait `Ordre #N résumé` dans le corps. Ici le repère de
  secours dans le corps a aussi changé de forme : `Nouvelle commande #N` (en tête d'email) et
  `Résumé de la commande #N` (juste avant la liste des articles) — ni l'un ni l'autre ne
  correspond à `Ordre #N résumé`. Le parser reconnaît maintenant `(?:ordre|commande)\s*#N`.
- Le repère `résumé` peut avoir du texte à sa suite sur la même ligne (`Résumé de la commande
  #2201`) au lieu d'être seul en fin de ligne — le parser absorbe le reste de la ligne avant de
  chercher le saut de ligne.
- **"Informations client" → "Coordonnées client"**, et **"Méthode d'expédition" → "Méthode de
  livraison"**. Sans cette correction, le bloc client n'est plus repéré du tout, et le nom du
  client retombe sur un filet de secours peu fiable (`reçu une nouvelle commande de la part de
  <Nom>.` — noter le nouveau "de la part de" qui n'existait pas non plus avant).

**Si Hostinger change encore le gabarit** : la boîte mail réelle (`mohammad.skandar@icloud.com`)
peut être inspectée directement en IMAP avec les identifiants de `.env` pour récupérer le texte
brut d'une commande en échec, puis rejouée localement contre `parseOrderEmail()` sans avoir besoin
d'accès à la base de production — c'est ce qui a permis de diagnostiquer cette dérive.

## Points d'attention communs

- **Détection du type de commande**, par ordre de fiabilité décroissante : (1) une ligne
  `Comman(der|de): ...` par article (gabarit A) ; (2) `Méthode d'expédition` dans le bloc
  client (le plus fiable en l'absence de (1) — ex: "Livraison à domicile" vs le nom d'un
  point de retrait) ; (3) le suffixe `— À emporter`/`— Livraison` après le nom d'un plat
  (gabarit C — non fiable seul, voir avertissement ci-dessus) ; (4) en dernier recours,
  des frais de livraison réels (> 0€) indiquent une livraison. La présence d'une adresse
  seule n'est PAS un bon signal : le compte client affiche sa propre adresse même pour
  une commande à emporter.
- **Format du créneau choisi** : vu à la fois abrégé (`19h`, `19h30`) et en toutes lettres
  (`19 heures`) selon la commande — les deux sont normalisés vers le format abrégé avant
  d'être passés à `resolveRequestedTime()`.
- Le parser vérifie que la somme des articles correspond au sous-total annoncé ; en
  cas d'écart, l'email est rejeté et journalisé dans `EmailIngestLog` (statut `ECHEC`)
  plutôt que de créer une commande avec un montant potentiellement faux.
- Les emails déjà traités avec succès (`TRAITE`) ou déjà en doublon (`IGNORE`, par `messageId`
  IMAP ou par numéro de commande `externalRef`) sont ignorés pour éviter les doublons en cas de
  re-scan de la boîte. Un échec de parsing (`ECHEC`) reste volontairement réessayé à chaque
  passage suivant — sinon une commande touchée par un bug de parsing (comme la dérive de gabarit
  ci-dessus) resterait bloquée pour toujours, même après correction du code, puisque rien d'autre
  ne redéclenche jamais son traitement.
- La détection ne dépend plus du statut lu/non-lu IMAP (`\Seen`) — un email consulté
  depuis un téléphone avant le passage du serveur serait sinon ignoré à tort. La
  recherche porte sur une fenêtre de quelques jours, la déduplication ci-dessus
  empêchant tout doublon.
