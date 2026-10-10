// SPA entry point: loads global styles and mounts the Svelte app.
import 'bootstrap/dist/css/bootstrap.min.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

export default mount(App, { target: document.getElementById('app')! });
