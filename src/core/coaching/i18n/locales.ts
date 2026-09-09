/**
 * Multi-language localization dictionary for Golf Body OS Audio Coach.
 * Default language: English (en-US).
 * Supported languages: English (en-US), Swedish (sv-SE).
 */

export type SupportedLanguage = 'en-US' | 'sv-SE';

export type CoachingPhraseKey =
  | 'STEP_INTO_FRAME'
  | 'NO_POSE'
  | 'WHOLE_BODY_NOT_VISIBLE'
  | 'SHOW_HEAD'
  | 'SHOW_FEET'
  | 'TURN_LEFT_SIDE_TO_CAMERA'
  | 'MOVE_BACK'
  | 'MOVE_CLOSER'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'HOLD_STILL'
  | 'READY'
  | 'GET_READY'
  | 'COUNTDOWN_3'
  | 'COUNTDOWN_2'
  | 'COUNTDOWN_1'
  | 'COUNTDOWN_GO'
  | 'CUE_STRAIGHTEN_LEGS'
  | 'CUE_SOFTEN_KNEES'
  | 'CUE_NEUTRAL_NECK'
  | 'CUE_HINGE_DEEPER'
  | 'CUE_HINGE_DOWN'
  | 'CUE_DRIVE_UP'
  | 'FACE_CAMERA'
  | 'CROSS_ARMS'
  | 'ROTATE_LEFT'
  | 'HOLD_POSITION'
  | 'RETURN_CENTER'
  | 'ROTATE_RIGHT'
  | 'KEEP_HIPS_STILL'
  | 'ROTATION_DONE'
  | 'REP_1_DONE'
  | 'REP_2_DONE'
  | 'ALL_REPS_DONE'
  | 'ANALYZING'
  | 'BRIEFING_ROTATION_1'
  | 'BRIEFING_ROTATION_2'
  | 'BRIEFING_ROTATION_3'
  | 'BRIEFING_HINGE_1'
  | 'BRIEFING_HINGE_2'
  | 'BRIEFING_HINGE_3'
  | 'BRIEFING_LISTEN'
  | 'SCREENING_WELCOME'
  | 'SCREENING_STEP_TRANSITION'
  | 'SCREENING_ALL_COMPLETE';

export const LOCALES: Record<SupportedLanguage, Record<CoachingPhraseKey, string>> = {
  'en-US': {
    STEP_INTO_FRAME: 'Step into the frame',
    NO_POSE: 'Step into the frame',
    WHOLE_BODY_NOT_VISIBLE: 'Make sure your whole body is visible',
    SHOW_HEAD: 'Ensure your head is visible',
    SHOW_FEET: 'Ensure your feet are visible',
    TURN_LEFT_SIDE_TO_CAMERA: 'Turn your left side to the camera',
    MOVE_BACK: 'Move back',
    MOVE_CLOSER: 'Move closer',
    MOVE_LEFT: 'Move left',
    MOVE_RIGHT: 'Move right',
    HOLD_STILL: 'Hold still',
    READY: 'Ready',
    GET_READY: 'Get ready',
    COUNTDOWN_3: 'Three',
    COUNTDOWN_2: 'Two',
    COUNTDOWN_1: 'One',
    COUNTDOWN_GO: 'Go!',
    CUE_STRAIGHTEN_LEGS: 'Straighten your legs – hinge from the hips!',
    CUE_SOFTEN_KNEES: 'Soften your knees slightly!',
    CUE_NEUTRAL_NECK: 'Keep your neck neutral – eyes on the floor!',
    CUE_HINGE_DEEPER: 'Hinge a little deeper!',
    CUE_HINGE_DOWN: 'Hinge forward from the hips',
    CUE_DRIVE_UP: 'Drive back up to standing',
    FACE_CAMERA: 'Face the camera squarely',
    CROSS_ARMS: 'Cross your arms over your chest',
    ROTATE_LEFT: 'Slowly rotate your shoulders to the left',
    HOLD_POSITION: 'Hold that position',
    RETURN_CENTER: 'Return to center',
    ROTATE_RIGHT: 'Slowly rotate your shoulders to the right',
    KEEP_HIPS_STILL: 'Keep your hips stable and quiet',
    ROTATION_DONE: 'Thoracic rotation test complete! Great job!',
    REP_1_DONE: 'Repetition one complete!',
    REP_2_DONE: 'Repetition two complete!',
    ALL_REPS_DONE: 'All three repetitions complete! Great job!',
    ANALYZING: 'Analyzing your movement...',
    BRIEFING_ROTATION_1: 'Now we will test your thoracic rotation. Stand shoulder-width apart, facing the camera squarely, and cross your arms over your chest.',
    BRIEFING_ROTATION_2: 'When the countdown finishes, slowly rotate your torso as far as you can to the left while keeping your hips still. Then return to center and rotate to the right.',
    BRIEFING_ROTATION_3: 'Get into position to begin.',
    BRIEFING_HINGE_1: 'Now we will test your hip hinge. Stand with your left side to the camera so your whole body is visible, feet shoulder-width apart and knees soft.',
    BRIEFING_HINGE_2: 'When the countdown finishes, hinge forward from your hips with a flat back and push your hips back, then drive back up.',
    BRIEFING_HINGE_3: 'Get into position to begin.',
    BRIEFING_LISTEN: 'Listen to the briefing...',
    SCREENING_WELCOME: 'Welcome to your full Golf Body Screening. We start with the hip hinge in side view.',
    SCREENING_STEP_TRANSITION: 'Great job! Hip hinge complete. Now face the camera squarely for test two: thoracic rotation.',
    SCREENING_ALL_COMPLETE: 'All assessments complete! Compiling your full Golf Body Score.'
  },
  'sv-SE': {
    STEP_INTO_FRAME: 'Kliv in i bild',
    NO_POSE: 'Kliv in i bild',
    WHOLE_BODY_NOT_VISIBLE: 'Se till att hela kroppen syns',
    SHOW_HEAD: 'Se till att huvudet syns',
    SHOW_FEET: 'Se till att fötterna syns',
    TURN_LEFT_SIDE_TO_CAMERA: 'Vänd vänster sida mot kameran',
    MOVE_BACK: 'Backa lite',
    MOVE_CLOSER: 'Gå lite närmare',
    MOVE_LEFT: 'Gå lite åt vänster',
    MOVE_RIGHT: 'Gå lite åt höger',
    HOLD_STILL: 'Stå stilla',
    READY: 'Redo',
    GET_READY: 'Gör dig redo',
    COUNTDOWN_3: 'Tre',
    COUNTDOWN_2: 'Två',
    COUNTDOWN_1: 'Ett',
    COUNTDOWN_GO: 'Kör!',
    CUE_STRAIGHTEN_LEGS: 'Sträck på benen – fäll i höften!',
    CUE_SOFTEN_KNEES: 'Mjuka upp knäna lite!',
    CUE_NEUTRAL_NECK: 'Titta ner i golvet – håll nacken rak!',
    CUE_HINGE_DEEPER: 'Fäll lite djupare!',
    CUE_HINGE_DOWN: 'Fäll framåt från höften',
    CUE_DRIVE_UP: 'Pressa upp till stående',
    FACE_CAMERA: 'Vänd dig rakt mot kameran',
    CROSS_ARMS: 'Korsa armarna över bröstet',
    ROTATE_LEFT: 'Rotera långsamt överkroppen åt vänster',
    HOLD_POSITION: 'Håll kvar',
    RETURN_CENTER: 'Tillbaka till mitten',
    ROTATE_RIGHT: 'Rotera långsamt överkroppen åt höger',
    KEEP_HIPS_STILL: 'Håll höfterna stilla',
    ROTATION_DONE: 'Rotationstest klart! Bra jobbat!',
    REP_1_DONE: 'Repetition ett klar!',
    REP_2_DONE: 'Repetition två klar!',
    ALL_REPS_DONE: 'Alla tre repetitioner klara! Bra jobbat!',
    ANALYZING: 'Analyserar dina rörelser...',
    BRIEFING_ROTATION_1: 'Nu testar vi din bröstryggsrotation. Ställ dig axelbrett och vänd dig rakt mot kameran. Sätt armarna i kors över bröstet.',
    BRIEFING_ROTATION_2: 'När nedräkningen är klar, rotera långsamt överkroppen så långt du kan åt vänster medan du håller höfterna stilla. Sedan gör vi samma sak åt höger.',
    BRIEFING_ROTATION_3: 'Ställ dig i position så startar vi.',
    BRIEFING_HINGE_1: 'Nu testar vi din höftfällning. Ställ dig med vänster sida mot kameran så att hela kroppen syns, med fötterna axelbrett och mjukt böjda knän.',
    BRIEFING_HINGE_2: 'När nedräkningen är klar, fäll överkroppen framåt från höften med rak rygg och skjut bak sätet, och res dig sedan upp.',
    BRIEFING_HINGE_3: 'Ställ dig i position så startar vi.',
    BRIEFING_LISTEN: 'Lyssna på genomgången...',
    SCREENING_WELCOME: 'Välkommen till din kompletta Golf Body Screening. Vi börjar med höftfällning i sidovy.',
    SCREENING_STEP_TRANSITION: 'Bra jobbat! Höftfällningen är klar. Vänd dig nu rakt mot kameran för test två: bröstryggsrotation.',
    SCREENING_ALL_COMPLETE: 'Alla tester klara! Sammanställer din fullständiga Golf Body Score.'
  }
};

export function getPhrase(key: CoachingPhraseKey, lang: SupportedLanguage = 'en-US'): string {
  const dictionary = LOCALES[lang] || LOCALES['en-US'];
  return dictionary[key] || LOCALES['en-US'][key] || key;
}
