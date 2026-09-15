# Robot med rörliga fingrar — version 1

## Snabbstart

1. Packa upp ZIP-filen.
2. Importera `Robot_Walking_FingerRig.glb` i ditt 3D-program eller din app.
3. Välj animationen `Hands_OpenClose` för att se båda händerna öppnas och slutas.
4. Välj `Test_Thumb`, `Test_Index`, `Test_Middle`, `Test_Ring` eller `Test_Pinky` för att testa en fingertyp i taget på båda händerna.
5. Välj originalets `Walking` eller `Running` i motsvarande fil för kroppsanimeringen.

GLB-filerna är färdiga att importera. Du behöver inte köra Python-skripten för att använda dem. Vilket reglage/menyalternativ som väljer animation beror på din 3D-visare.

## Vad som ändrats

- Alla tre originalmodellerna har fått 30 nya deformerande fingerben: 3 per finger inklusive tummen, på båda händerna.
- Skelettet har totalt 57 skin-joints, jämfört med originalets 27. Dessutom finns tio obundna fingertoppsmarkörer.
- Nya ben har namn som `mixamorig:LeftHandIndex1`, `...Index2`, `...Index3` och motsvarande `RightHand`.
- Fingrarnas meshvikter har kopplats till de nya benen; att rotera benen flyttar faktiskt fingrarnas geometri.
- Benens lokala X-axel används för böjning från deras vilorotation. Basleden kan också användas för fingerspridning.
- Ursprunglig geometri, UV, normaltextur, material och befintliga animationsspår har bevarats. Bara skin-vikter och rigg har utökats.

## Animationer

| Klipp | Funktion |
| --- | --- |
| `Hands_Open` | Öppna händer, kroppen i modellens vilopose |
| `Hands_OpenClose` | Fyra sekunders öppna–slut–öppna-loop |
| `Hands_Fist` | Sluten hand, statisk testpose |
| `Hands_GolfGrip_Preview` | Första böjda greppose, utan klubba |
| `Test_Thumb` / `Index` / `Middle` / `Ring` / `Pinky` | Fingertyp för sig, båda händerna |
| `FingersOnly_OpenClose` | Endast fingrar; kan spelas tillsammans med kroppsanimering |
| `FingersOnly_GolfGrip` | Endast fingrar i grepposen; kan spelas tillsammans med kroppsanimering |

De vanliga `Hands_*`- och `Test_*`-klippen sätter också kroppen i vilopose. Blanda dem därför inte med Walking/Running. Använd `FingersOnly_*` som separat lager samtidigt med originalets kroppsanimation. Dessa lager berör bara de 30 nya fingerbenen. I en motor med animationsmixer måste även animationslagret startas; det startar inte automatiskt av att filen laddas.

Varje finger på respektive hand kan också styras individuellt via sitt bennamn. Testklippen rör båda händernas motsvarande finger för enklare kontroll; detta begränsar inte individuell styrning.

## Viktiga begränsningar

- Detta är en första fungerande fingerrigg, geometriskt anpassad till just dessa Meshy-filer. Benplacering och vikter är beräknade och kontrollerade i meshförhandsvisning, inte finjusterade för hand i Blender.
- Golfgreppet är en STARTPOSE, inte ett verifierat korrekt tvåhandsgrepp om en klubba. Ingen klubba ingår. Skaftdiameter, händernas placering, tumopposition och fingrarnas kontakt behöver anpassas i appen/3D-programmet.
- Ingen kollisionslösare eller automatisk kontakt mot handflata/klubba ingår. Extremt böjda poser kan ge lokala överlappningar och kräva viktjustering.
- Fingrarnas befintliga mesh deformeras; modellen har inte byggts om till separata hårda mekaniska fingersegment.
- Originalets färgmaterial är grått och innehåller en normaltextur, men ingen cyan/vit/orange färgtextur. Färgerna från tidigare robotbilder finns alltså inte i dessa uppladdade GLB-filer och har inte återskapats.
- Kontrollerna har gjorts genom direkt GLB-läsning och numerisk skinning samt renderad meshförhandsvisning. Exporten har inte provspelats i din målapp eller i Blender.

## Kontrollfiler

`Hand_Pose_Check.png` visar faktiska deformerade handmeshar i öppen, sluten och greppose. `Hands_OpenClose_Preview.gif` visar loopen. Det är kontrollrenderingar av GLB-geometrin, inte AI-genererade bilder.

`validation.json` innehåller resultat för bindpose, normaliserade vikter, rörelse i samtliga tio fingrar och bevarad kroppsanimering. `rig_metadata.json` innehåller benens vilotransformer. `build_report.json` visar antalet tilldelade meshpunkter per finger.

Originalets animationsklipp finns kvar i varje uppdaterad GLB. Behåll gärna också din ursprungliga Meshy-ZIP separat.

## Reproducerbarhet för utvecklare

Python-skripten i `tools/` använder numpy, scipy, matplotlib och Pillow. De är specialanpassade till den medföljande Meshy-modellen, inte en generell automatisk handriggare.

För att köra om bygget: skapa `tools/upload/` och lägg den ursprungliga ZIP-filen där med namnet `Meshy_AI_Neon_Embrace_biped.zip`. Kör sedan `python rig_fingers.py` och `python validate_rig.py` från `tools/`. Använd original-ZIP:en, inte det här utökade paketet.
