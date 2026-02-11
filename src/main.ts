// src/main.ts
import "./ui/style.css";
import { createEngine } from "./engine/audio";
import { createScheduler } from "./engine/scheduler";
import { mountApp } from "./ui/app";

const root = document.getElementById("app")!;
const engine = createEngine();
const sched = createScheduler(engine);

mountApp(root, engine, sched);
