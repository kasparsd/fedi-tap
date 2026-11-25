import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { framed } from "./lib/frame.js";

const target = document.getElementById("app");

if (framed()) {
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = "FediTap can’t run inside another page. Open it in its own tab.";
  const link = document.createElement("a");
  link.href = location.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Open FediTap";
  target.append(message, link);
} else {
  mount(App, { target });
}
