# ZARAY — traitement avancé des logos

ZARAY utilise deux niveaux de traitement dans le navigateur :

1. Détection locale des arrière-plans uniformes et recadrage conservateur.
2. Lorsque cette détection ne suffit pas et que le fichier est opaque, segmentation par modèle IA ORMBG pour les fonds multicolores, textures et photographies.

Les pixels de l'image sont analysés **dans le navigateur** ; aucun logo n'est transmis à un service d'inférence distant. Le premier traitement d'un fond complexe peut nécessiter le téléchargement du modèle et de sa bibliothèque d'exécution. En l'absence de connexion ou de capacités suffisantes, l'image originale est conservée.

## Dépendances et licences

- [Transformers.js](https://github.com/huggingface/transformers.js) — version 4.3.2, licence Apache 2.0.
- [ORMBG ONNX](https://huggingface.co/onnx-community/ormbg-ONNX) — modèle de segmentation distribué sous licence Apache 2.0. Variante `uint8` utilisée sur WebAssembly.

La segmentation peut échouer à distinguer des parties du logo d'un fond semblable (ombres, dégradés, textures ou objets superposés). ZARAY vérifie la silhouette et préserve les couleurs d'origine ; une garantie de détourage exact au pixel près pour **toutes** les images est impossible. Les administrateurs peuvent comparer l'aperçu avant d'enregistrer. La fonction ne modifie pas rétroactivement les logos existants.
