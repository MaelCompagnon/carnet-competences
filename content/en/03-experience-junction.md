---
page: experience-junction
route: /experiences/junction-2026
grille_ppp: "Description & analyse d'une expérience (projet réalisé pendant ma scolarité)"
ordre: 2
---

# Junction 2026: 48 hours to prove who rewrites history

**Type:** International hackathon, the first of my life
**Place and date:** Espoo (Finland), November 2026
**Event:** Junction 2026, "The European Tech Renaissance": about 2,000 participants, 48 hours, more than 35 partners including NVIDIA, Google DeepMind and OpenAI
**Team:** ENLMe, 4 ESAIP engineering students (Léopold, Maël, Nathanaël, Eléa)
**Result:** NVIDIA "Best use of Nemotron" prize (an NVIDIA RTX 5080 Founders Edition graphics card), among about 500 teams

## The challenge

We chose the "Wikipedia Through Time" challenge, run by MariaDB. Wikipedia serves as the world's memory: students, journalists and AI models rely on it. But history can be rewritten there one edit at a time: a changed word, a misleading photo caption, a deleted source.

## What we built: TimeProof

TimeProof shows who rewrites history on Wikipedia, when and how, and only publishes what it can prove.

- **A time machine.** The 862,076 revisions of 19,742 Finnish articles on the history of Finland (from 2003 to 2026) are stored in MariaDB versioned tables. A single query lets you view any article as it was on any date.
- **The two-model rule.** NVIDIA Nemotron investigates each suspicious edit, reading the text and looking at the image. Gemini makes the final call. A case is only published if both models agree. Otherwise, a human decides.
- **Evidence for each case.** Word-by-word differences, timeline, time spent online, an upper estimate of the number of readers exposed, before/after archive of the images.
- **Explicit ethics.** No Wikipedia account is named. The tool never edits Wikipedia. Test edits are labelled as such.

## My role

I was in charge of the analysis part, that is, the investigation carried out by the AI:
- the rules for detecting candidate edits (images, deleted sources, word choices);
- the Nemotron investigation script, and four successive versions of the prompts, compared on real edits;
- retrieving images with their authors and licences, and the evidence cards (before/after);
- the test-edit campaign, deliberately planted to measure what the system really detects;
- part of the documentation, the work plan and the submission texts.

## The difficulties

- **Fatigue.** 48 hours is short for building and long for staying lucid. We had to choose what really mattered and accept leaving the rest.
- **The first ideas.** Finding an angle that was useful, feasible in 48 hours and demonstrable in front of a jury was the most uncertain phase.
- **Making an AI model reliable.** A model that "finds" problems everywhere is useless. The successive prompt versions and the test edits let us measure rather than assume.

## What I take from it

| Skill | How I developed it |
|---|---|
| Applied generative AI | Using a vision-language model (Nemotron) on text and images |
| Prompt engineering and evaluation | 4 compared iterations, tests on planted cases, two-model rule |
| Data | Processing 862,000 revisions, MariaDB versioned tables |
| Teamwork under constraint | Splitting work across 4 people, quick decisions, delivery in 48 hours |
| AI ethics | Only publishing what is proven, anonymising, always keeping a human in the loop |
| Openness and networking | Meeting developers and partners from around the world |

Three lessons: delivering in 48 hours forces you to focus on the essentials, a good team makes all the difference, and stepping out of your comfort zone always ends up paying off.

## The link with my target role

This is my first complete AI engineering experience: choosing a model, making it work on real, multimodal data, measuring its reliability and framing its limits. The fact that NVIDIA rewarded our use of Nemotron strengthens my wish to work on models that perceive the world, and not only text.

**Evidence:** [TimeProof code on GitHub](https://github.com/MaelCompagnon/TimeProof) · [LinkedIn post, with the demo video](https://www.linkedin.com/feed/update/urn:li:activity:7528098898842877952/)
