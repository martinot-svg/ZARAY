# Logos transparents — tickets Wi-Fi et portails captifs ZARAY

## Règles d'importation

L'administrateur de chaque site doit fournir **un logo PNG ou WebP dont l'arrière-plan est déjà transparent**. Les JPEG et les images totalement opaques ne sont pas acceptés comme nouveaux logos.

L'import ZARAY réalise uniquement :

1. La validation du format et de la présence d'une véritable transparence (sur le navigateur, puis dans l'API à l'enregistrement).
2. Le rognage automatique des lignes et colonnes composées **exclusivement de pixels entièrement transparents** (alpha = 0) autour du logo.
3. Le redimensionnement proportionnel si nécessaire pour respecter la limite de stockage du modèle.

**Aucune suppression de fond, segmentation IA, détection de couleurs ni découpe à l'intérieur du logo.** Tous les pixels non transparents, y compris les ombres légères et les détails semi-transparents, restent dans les limites de l'image.

Le fichier résultant est enregistré au niveau du site et partagé entre les tickets et le portail captif HTML exporté. Les aperçus conservent le fond transparent ; ils ne recréent pas de rectangle opaque.

Les logos déjà enregistrés ne sont pas modifiés rétrospectivement. Les anciens fichiers JPEG restent en base et peuvent être conservés pendant la modification des autres réglages, sans exiger une réimportation. Pour bénéficier du rognage, l'administrateur doit importer un nouveau logo PNG/WebP avec transparence.

La limite technique d'import est de 2 Mo, mais les données finales doivent respecter la contrainte de stockage en base. Si le fichier ne peut pas être optimisé sans supprimer de pixels, l'import est refusé avec un message explicatif.
