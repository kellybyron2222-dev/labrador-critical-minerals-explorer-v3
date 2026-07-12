/**
 * Critical Minerals Explorer - Entry Point
 * Labrador, Canada Mineral Exploration Platform
 */

import './css/style.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import MineralsMapApp from './js/app.js';

const app = new MineralsMapApp();

if (import.meta.env.DEV) {
  window.app = app;
}
