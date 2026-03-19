import "./resonance/style.css";
import { mountResonanceBreachApp } from "./resonance/app";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root");
}

mountResonanceBreachApp(root);
