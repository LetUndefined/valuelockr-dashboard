import React from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./Dashboard";
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/hanken-grotesk";
import "./base.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Dashboard />
  </React.StrictMode>
);
