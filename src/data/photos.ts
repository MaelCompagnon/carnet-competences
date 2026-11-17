import type { ImageMetadata } from 'astro';
import type { Lang } from '../i18n/routes';
import antAtelier from '../../assets/photos/ant-atelier.jpg';
import antPublicite from '../../assets/photos/ant-publicite.jpg';
import bdeGala from '../../assets/photos/bde-gala-2025.jpg';
import salmarLigne5 from '../../assets/photos/salmar-ligne-5.jpg';
import salmarDeepTracker from '../../assets/photos/salmar-deep-tracker.jpg';
import ageoMotDePasse from '../../assets/photos/ageo-mot-de-passe-oublie.jpg';
import ageoMaquette from '../../assets/photos/ageo-maquette-reinitialisation.jpg';
import junctionEquipe from '../../assets/photos/junction-equipe.jpg';
import junctionSalle from '../../assets/photos/junction-salle.jpg';
import junctionLicorne from '../../assets/photos/junction-licorne.jpg';
export { default as junctionPoster } from '../../assets/photos/junction-public.jpg';

// Pictures taken from Maël's own documents (LEP, internship reports), list validated by Maël
// on 17 Nov 2026. Never added here: faces of other people, names, signatures, internal company
// data, nor pictures whose source is not Maël's (the SalMar robot photos and map were left out).
// Every caption says what the picture is, and where it comes from when it is not a photo.

export interface Photo {
  src: ImageMetadata;
  alt: Record<Lang, string>;
  caption: Record<Lang, string>;
}

/** Junction 2026: the video of our presentation (YouTube), shown by VideoEmbed.astro. */
export const junctionVideo = {
  id: 'mIXfgXq1Bpw',
  title: { fr: 'Présentation de TimeProof à Junction 2026', en: 'TimeProof presentation at Junction 2026' },
  caption: { fr: 'Notre présentation de TimeProof à Junction 2026', en: 'Our presentation of TimeProof at Junction 2026' },
};

export const photos: Record<'salmar' | 'ageo' | 'engagements' | 'junction', Photo[]> = {
  junction: [
    {
      src: junctionEquipe,
      alt: {
        fr: "Maël Compagnon et ses trois coéquipiers devant l'affiche « European Tech Renaissance » de Junction.",
        en: 'Maël Compagnon and his three teammates in front of the Junction "European Tech Renaissance" poster.',
      },
      caption: { fr: "L'équipe à Junction 2026", en: 'The team at Junction 2026' },
    },
    {
      src: junctionSalle,
      alt: {
        fr: 'La grande salle du hackathon, éclairée de violet : des participants codent sur leurs ordinateurs.',
        en: 'The main hackathon hall, lit in purple: participants coding on their laptops.',
      },
      caption: { fr: 'La salle, pendant les 48 heures', en: 'The hall, during the 48 hours' },
    },
    {
      src: junctionLicorne,
      alt: {
        fr: "Une table de hackathon : canettes, bouteilles, autocollants et une licorne en peluche.",
        en: 'A hackathon table: cans, bottles, stickers and a stuffed unicorn.',
      },
      caption: { fr: 'Sur une table du hackathon', en: 'On a hackathon table' },
    },
  ],
  salmar: [
    {
      src: salmarLigne5,
      alt: {
        fr: "Schéma en sept étapes du parcours d'un filet de saumon sur la ligne 5 : contrôle visuel, parage au couteau, désossage en machine puis à la main, écorchage, contrôle qualité, découpe en portions.",
        en: 'Seven-step diagram of the path of a salmon fillet on line 5: visual check, knife trimming, machine then manual deboning, skinning, quality check, portion cutting.',
      },
      caption: {
        fr: 'Le parcours du filet sur la ligne 5 (visuel illustratif généré par IA, tiré de mon rapport)',
        en: 'The path of a fillet on line 5 (illustrative AI-generated visual, from my report)',
      },
    },
    {
      src: salmarDeepTracker,
      alt: {
        fr: 'Schéma des huit étapes de la ligne de conditionnement Deep Tracker : découpe en portions, mise en barquette, operculation, mise sous vide, découpe longitudinale, étiquetage, injection, découpe transversale.',
        en: 'Diagram of the eight steps of the Deep Tracker packaging line: portion cutting, tray loading, sealing, vacuum packing, lengthwise cutting, labelling, injection, crosswise cutting.',
      },
      caption: {
        fr: 'Les huit étapes de la ligne Deep Tracker (visuel illustratif généré par IA, tiré de mon rapport)',
        en: 'The eight steps of the Deep Tracker line (illustrative AI-generated visual, from my report)',
      },
    },
  ],
  ageo: [
    {
      src: ageoMotDePasse,
      alt: {
        fr: "Page « Mot de passe oublié » de l'espace assuré SG Santé : un champ pour l'identifiant et un bouton « Réinitialiser ».",
        en: 'The "Forgotten password" page of the SG Santé customer area: a field for the user name and a "Reset" button.',
      },
      caption: {
        fr: 'La page « Mot de passe oublié » de SG Santé, point de départ de mon projet',
        en: 'The SG Santé "Forgotten password" page, where my project starts',
      },
    },
    {
      src: ageoMaquette,
      alt: {
        fr: 'Maquette de la page de réinitialisation du mot de passe : les règles du mot de passe, deux champs de saisie et un bouton violet.',
        en: 'Mock-up of the password reset page: the password rules, two input fields and a purple button.',
      },
      caption: {
        fr: 'La maquette de la page de réinitialisation, fournie par le service marketing',
        en: 'The mock-up of the reset page, provided by the marketing team',
      },
    },
  ],
  engagements: [
    {
      src: antAtelier,
      alt: {
        fr: "Maël Compagnon, bras croisés, devant l'écran projeté d'un cours du club ANT.",
        en: 'Maël Compagnon, arms crossed, in front of the projected screen of an ANT club class.',
      },
      caption: {
        fr: 'Le club ANT dans le journal local de Saint-Barthélemy-d’Anjou',
        en: 'The ANT club in the local newspaper of Saint-Barthélemy-d’Anjou',
      },
    },
    {
      src: antPublicite,
      alt: {
        fr: 'Maël Compagnon souriant, avec un bandeau « Maël Compagnon, étudiant 3e année, informatique et réseaux ».',
        en: 'Maël Compagnon smiling, with a banner reading "Maël Compagnon, 3rd-year student, computer science and networks".',
      },
      caption: {
        fr: "Une publicité sur la transition numérique, en partenariat avec l'ESAIP",
        en: 'An advert on the digital transition, in partnership with ESAIP',
      },
    },
    {
      src: bdeGala,
      alt: {
        fr: 'Longues tables dressées en rouge et noir, avant le gala de Noël du BDE.',
        en: "Long tables laid in red and black, before the student union's Christmas gala.",
      },
      caption: {
        fr: 'Le gala de Noël 2025 du BDE',
        en: "The student union's 2025 Christmas gala",
      },
    },
  ],
};
