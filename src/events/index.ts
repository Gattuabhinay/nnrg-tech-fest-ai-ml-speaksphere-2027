import { codeManiaConfig } from "./CodeMania/config";
import { idea2AppConfig } from "./Idea2App/config";
import { paperPresentationConfig } from "./PaperPresentation/config";
import { quickPuzzleConfig } from "./QuickPuzzle/config";
import { speakSphereConfig } from "./SpeakSphere/config";
import { techTitanConfig } from "./TechTitan/config";
import type { EventConfig } from "./types";

export type { EventConfig } from "./types";

export const eventConfigs: EventConfig[] = [
  techTitanConfig,
  speakSphereConfig,
  codeManiaConfig,
  idea2AppConfig,
  quickPuzzleConfig,
  paperPresentationConfig,
];
