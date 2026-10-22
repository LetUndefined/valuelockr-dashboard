import React from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./Dashboard";
import ClipTest from "./ClipTest";
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/hanken-grotesk";
import "./base.css";

// Public test target for the QR on a ValueLockr Clip; everything else is the
// signed-in ops dashboard.
const clipTest = window.location.pathname.match(/^\/test\/clip\/c\/(VL-[0-9A-Fa-f]{12})\/?$/);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {clipTest ? <ClipTest clipId={clipTest[1].toUpperCase()} /> : <Dashboard />}
  </React.StrictMode>
);
