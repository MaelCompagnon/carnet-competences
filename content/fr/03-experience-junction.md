---
page: experience-junction
route: /experiences/junction-2026
grille_ppp: "Description & analyse d'une expérience (projet réalisé pendant ma scolarité)"
ordre: 2
---

# Junction 2026 : 48 heures pour prouver qui réécrit l'histoire

**Type :** Hackathon international, premier hackathon de ma vie
**Lieu et date :** Espoo (Finlande), novembre 2026
**Événement :** Junction 2026, « The European Tech Renaissance » : environ 2 000 participants, 48 heures, plus de 35 partenaires dont NVIDIA, Google DeepMind et OpenAI
**Équipe :** ENLMe, 4 élèves-ingénieurs de l'ESAIP (Léopold, Maël, Nathanaël, Eléa)
**Résultat :** prix NVIDIA « Best use of Nemotron » (une carte graphique NVIDIA RTX 5080 Founders Edition), parmi environ 500 équipes

## Le défi

Nous avons choisi le challenge « Wikipedia Through Time », porté par MariaDB. Wikipédia sert de mémoire au monde : étudiants, journalistes et modèles d'IA s'y fient. Mais l'histoire peut s'y réécrire une modification à la fois : un mot changé, une légende de photo trompeuse, une source supprimée.

## Ce que nous avons construit : TimeProof

TimeProof montre qui réécrit l'histoire sur Wikipédia, quand et comment, et ne publie que ce qu'il peut prouver.

- **Une machine à remonter le temps.** Les 862 076 révisions de 19 742 articles finnois sur l'histoire de la Finlande (de 2003 à 2026) sont stockées dans des tables versionnées MariaDB. Une seule requête permet de revoir n'importe quel article tel qu'il était à n'importe quelle date.
- **La règle des deux modèles.** NVIDIA Nemotron enquête sur chaque modification suspecte, en lisant le texte et en regardant l'image. Gemini tranche. Un cas n'est publié que si les deux modèles sont d'accord. Sinon, c'est un humain qui décide.
- **Des preuves pour chaque cas.** Différences mot à mot, chronologie, durée de mise en ligne, estimation haute du nombre de lecteurs exposés, archive avant/après des images.
- **Une éthique explicite.** Aucun compte Wikipédia n'est nommé. L'outil ne modifie jamais Wikipédia. Les modifications de test sont étiquetées comme telles.

## Mon rôle

J'étais responsable de la partie analyse, c'est-à-dire de l'enquête menée par l'IA :
- les règles de détection des modifications candidates (images, sources supprimées, choix des mots) ;
- le script d'enquête Nemotron, et quatre versions successives des prompts, comparées sur de vraies modifications ;
- la récupération des images avec leurs auteurs et leurs licences, et les cartes de preuves (avant/après) ;
- la campagne de modifications de test, plantées volontairement pour mesurer ce que le système détecte vraiment ;
- une partie de la documentation, du plan de travail et des textes de soumission.

## Les difficultés

- **La fatigue.** 48 heures, c'est court pour construire et long pour rester lucide. Il a fallu choisir ce qui comptait vraiment et accepter de laisser le reste.
- **Les premières idées.** Trouver un angle à la fois utile, faisable en 48 heures et démontrable devant un jury a été la phase la plus incertaine.
- **Fiabiliser un modèle d'IA.** Un modèle qui « trouve » des problèmes partout ne sert à rien. Les versions successives des prompts et les modifications de test nous ont permis de mesurer, plutôt que de supposer.

## Ce que j'en retire

| Compétence | Comment je l'ai développée |
|---|---|
| IA générative appliquée | Utilisation d'un modèle vision-langage (Nemotron) sur du texte et des images |
| Prompt engineering et évaluation | 4 itérations comparées, tests sur des cas plantés, règle des deux modèles |
| Données | Traitement de 862 000 révisions, tables versionnées MariaDB |
| Travail en équipe sous contrainte | Répartition à 4, décisions rapides, livraison en 48 heures |
| Éthique de l'IA | Ne publier que ce qui est prouvé, anonymiser, toujours garder un humain dans la boucle |
| Ouverture et réseau | Rencontres avec des développeurs et des partenaires du monde entier |

Trois leçons : livrer en 48 heures oblige à se concentrer sur l'essentiel, une bonne équipe fait toute la différence, et sortir de sa zone de confort finit toujours par payer.

## Le lien avec le métier que je vise

C'est ma première expérience complète d'ingénierie IA : choisir un modèle, le faire travailler sur des données réelles et multimodales, mesurer sa fiabilité et en encadrer les limites. Le fait que NVIDIA ait récompensé notre usage de Nemotron me conforte dans l'envie de travailler sur des modèles qui perçoivent le monde, et pas seulement du texte.

**Preuves :** [Code de TimeProof sur GitHub](https://github.com/MaelCompagnon/TimeProof) · [Post LinkedIn, avec la vidéo de démonstration](https://www.linkedin.com/feed/update/urn:li:activity:7528098898842877952/)
