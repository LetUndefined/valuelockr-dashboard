import React from "react";
import ReactDOM from "react-dom/client";
import Dashboard from "./Dashboard";
import ClipTest from "./ClipTest";
import "@fontsource-variable/big-shoulders-display";
import "@fontsource-variable/hanken-grotesk";
import "./base.css";

// Public buyer page behind a ValueLockr Clip's QR (/c/<public code>);
// everything else is the signed-in ops dashboard.
const clipPage = window.location.pathname.match(/^\/c\/([0-9a-f]{16})\/?$/);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {clipPage ? <ClipTest code={clipPage[1]} /> : <Dashboard />}
  </React.StrictMode>
);
