import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App"; // Or MainApp, depending on your setup
import "./styles.css";

// 🟢 1. Create an explicit context object outside the render tree
const helmetContext = {};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* 🟢 2. Pass the context object directly into the Provider */}
    <HelmetProvider context={helmetContext}>
        <App />
    </HelmetProvider>
  </React.StrictMode>,
);
