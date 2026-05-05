// src/main.ts
import "./ui/style.css";
import { createEngine } from "./engine/audio";
import { createScheduler } from "./engine/scheduler";
import { mountApp } from "./ui/app";
import { loadSettings } from "./settings/store";
import { APP_NAME, formatDocumentTitle } from "./version";

const root = document.getElementById("app")!;
const engine = createEngine();
const sched = createScheduler(engine);

const settings = loadSettings();
document.title = formatDocumentTitle();
console.log(`${APP_NAME} settings:`, settings);

mountApp(root, engine, sched);
