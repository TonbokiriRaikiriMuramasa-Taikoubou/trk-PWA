// SPDX-License-Identifier: GPL-3.0-or-later
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.trk.agrg",
  appName: "trk! — AGRG",
  webDir: "mobile-web",
  bundledWebRuntime: false,
  server: {
    // Keep WebView URLs secure so APIs that require a secure context can work
    // where Android WebView supports them. Do not point the app at localhost.
    androidScheme: "https"
  }
};

export default config;
